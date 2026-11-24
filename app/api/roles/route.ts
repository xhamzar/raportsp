import { NextRequest, NextResponse } from 'next/server';
import { asc, eq, sql } from 'drizzle-orm';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import { permissions, rolePermissions, roles, users } from '@/lib/server/db/schema';
import {
  ACTION_LABELS,
  ALL_ACTIONS,
  ALL_MODULES,
  LOCKED_SUPER_ADMIN_PERMISSIONS,
  MODULE_METADATA,
  ensurePermissionsCatalog,
  getDefaultRolePermissions,
  isSystemRoleCode,
  normalizePermissionKeys,
} from '@/lib/server/auth/rbac';
import {
  invalidateAllSessionCaches,
  logAudit,
  requireApiAuth,
} from '@/lib/server/auth/session';
import { roleCreateSchema, roleUpdateSchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'pengguna', 'read');
  if ('error' in auth) return auth.error;

  const db = getDb();
  await ensurePermissionsCatalog();

  const roleList = await db.select().from(roles).orderBy(asc(roles.id));
  const userCounts = await db
    .select({
      roleId: users.roleId,
      total: sql<number>`count(*)`,
    })
    .from(users)
    .groupBy(users.roleId);
  const countMap = new Map(userCounts.map((c) => [c.roleId, Number(c.total)]));

  const rpRows = await db
    .select({
      roleId: rolePermissions.roleId,
      module: permissions.module,
      action: permissions.action,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id));

  const permsByRole = new Map<number, string[]>();
  for (const row of rpRows) {
    const arr = permsByRole.get(row.roleId) || [];
    arr.push(`${row.module}:${row.action}`);
    permsByRole.set(row.roleId, arr);
  }

  const enrichedRoles = roleList.map((r) => {
    const rawKeys = permsByRole.get(r.id) || [];
    const normalized =
      r.code === 'SUPER_ADMIN'
        ? normalizePermissionKeys(rawKeys, 'SUPER_ADMIN')
        : Array.from(new Set(rawKeys)).sort();

    return {
      ...r,
      isSystem: Boolean(r.isSystem || isSystemRoleCode(r.code)),
      userCount: countMap.get(r.id) ?? 0,
      permissionKeys: normalized,
    };
  });

  return NextResponse.json({
    roles: enrichedRoles,
    modules: ALL_MODULES.map((m) => ({
      key: m,
      label: MODULE_METADATA[m].label,
      route: MODULE_METADATA[m].route,
      description: MODULE_METADATA[m].description,
    })),
    actions: ALL_ACTIONS.map((a) => ({
      key: a,
      label: ACTION_LABELS[a],
    })),
    lockedSuperAdminPermissions: LOCKED_SUPER_ADMIN_PERMISSIONS,
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'pengguna', 'create');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = roleCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Data peran baru tidak valid.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.code, parsed.data.code))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: `Kode peran "${parsed.data.code}" sudah digunakan.` },
      { status: 409 }
    );
  }

  const permMap = await ensurePermissionsCatalog();

  let initialKeys: string[] = [];
  if (parsed.data.cloneFromRoleId) {
    const sourceRows = await db
      .select({ module: permissions.module, action: permissions.action })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, parsed.data.cloneFromRoleId));
    initialKeys = normalizePermissionKeys(
      sourceRows.map((s) => `${s.module}:${s.action}`)
    );
  } else if (parsed.data.permissionKeys && parsed.data.permissionKeys.length > 0) {
    initialKeys = normalizePermissionKeys(parsed.data.permissionKeys);
  } else {
    initialKeys = ['dashboard:read'];
  }

  const data = parsed.data;
  const created = await db.transaction(async (tx) => {
    const [roleRow] = await tx
      .insert(roles)
      .values({
        code: data.code,
        name: data.name,
        description: data.description,
        isSystem: false,
      })
      .returning();

    for (const key of initialKeys) {
      const pId = permMap.get(key);
      if (pId) {
        await tx.insert(rolePermissions).values({
          roleId: roleRow.id,
          permissionId: pId,
        });
      }
    }

    return roleRow;
  });

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'CREATE_ROLE',
    entityType: 'role',
    entityId: created.id,
    details: `Membuat peran kustom ${created.name} (${created.code}) dengan ${initialKeys.length} izin.`,
  });

  return NextResponse.json(
    {
      ok: true,
      role: {
        ...created,
        isSystem: false,
        userCount: 0,
        permissionKeys: initialKeys,
      },
    },
    { status: 201 }
  );
}

export async function PATCH(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'pengguna', 'update');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = roleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Data pembaruan peran tidak valid.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const [targetRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.id, parsed.data.id))
    .limit(1);

  if (!targetRole) {
    return NextResponse.json({ error: 'Peran tidak ditemukan.' }, { status: 404 });
  }

  if (targetRole.code === 'SUPER_ADMIN' && auth.user.roleCode !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Hanya Super Administrator yang dapat mengubah izin Super Administrator.' },
      { status: 403 }
    );
  }

  const permMap = await ensurePermissionsCatalog();
  let nextPermissionKeys: string[] | null = null;

  if (parsed.data.resetToDefault) {
    if (!isSystemRoleCode(targetRole.code)) {
      return NextResponse.json(
        { error: 'Pemulihan standar bawaan hanya berlaku untuk peran bawaan sistem.' },
        { status: 400 }
      );
    }
    nextPermissionKeys = Array.from(getDefaultRolePermissions(targetRole.code)).sort();
  } else if (parsed.data.permissionKeys) {
    nextPermissionKeys = normalizePermissionKeys(parsed.data.permissionKeys, targetRole.code);
  }

  const data = parsed.data;
  await db.transaction(async (tx) => {
    if (data.name || data.description) {
      await tx
        .update(roles)
        .set({
          name: data.name ?? targetRole.name,
          description: data.description ?? targetRole.description,
        })
        .where(eq(roles.id, targetRole.id));
    }

    if (nextPermissionKeys !== null) {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, targetRole.id));
      for (const key of nextPermissionKeys) {
        const pId = permMap.get(key);
        if (pId) {
          await tx.insert(rolePermissions).values({
            roleId: targetRole.id,
            permissionId: pId,
          });
        }
      }
    }
  });

  invalidateAllSessionCaches();

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: data.resetToDefault ? 'RESET_ROLE_PERMISSIONS' : 'UPDATE_ROLE_PERMISSIONS',
    entityType: 'role',
    entityId: targetRole.id,
    details: data.resetToDefault
      ? `Memulihkan matriks izin bawaan untuk peran ${targetRole.name}.`
      : `Memperbarui peran ${targetRole.name}${
          nextPermissionKeys ? ` (${nextPermissionKeys.length} izin aktif)` : ''
        }.`,
  });

  return NextResponse.json({
    ok: true,
    permissionKeys: nextPermissionKeys,
  });
}

export async function DELETE(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'pengguna', 'delete');
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id') || 0);
  if (!id) {
    return NextResponse.json({ error: 'ID peran tidak valid.' }, { status: 400 });
  }

  const db = getDb();
  const [targetRole] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!targetRole) {
    return NextResponse.json({ error: 'Peran tidak ditemukan.' }, { status: 404 });
  }

  if (targetRole.isSystem || isSystemRoleCode(targetRole.code)) {
    return NextResponse.json(
      { error: 'Peran bawaan sistem tidak dapat dihapus.' },
      { status: 403 }
    );
  }

  const assignedUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.roleId, id));

  if (assignedUsers.length > 0) {
    return NextResponse.json(
      {
        error: `Peran "${targetRole.name}" masih digunakan oleh ${assignedUsers.length} akun pengguna. Alihkan akun tersebut terlebih dahulu.`,
      },
      { status: 409 }
    );
  }

  await db.delete(roles).where(eq(roles.id, id));
  invalidateAllSessionCaches();

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'DELETE_ROLE',
    entityType: 'role',
    entityId: id,
    details: `Menghapus peran kustom ${targetRole.name} (${targetRole.code}).`,
  });

  return NextResponse.json({ ok: true });
}
