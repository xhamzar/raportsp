import { NextRequest, NextResponse } from 'next/server';
import { asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  auditLogs,
  classes,
  roles,
  semesters,
  subjects,
  teachers,
  userClassScopes,
  users,
  userSubjectScopes,
} from '@/lib/server/db/schema';
import { hashPassword } from '@/lib/server/auth/password';
import { FULL_SCOPE_DEFAULT_ROLES } from '@/lib/server/auth/rbac';
import {
  invalidateSessionCacheByUserId,
  logAudit,
  requireApiAuth,
} from '@/lib/server/auth/session';

const createUserSchema = z.object({
  username: z.string().trim().min(3, 'Username minimal 3 karakter.'),
  fullName: z.string().trim().min(2, 'Nama lengkap wajib diisi.'),
  email: z.string().trim().email('Email tidak valid.'),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter.'),
  roleId: z.number().int().positive(),
  teacherId: z.number().int().positive().nullable().optional(),
  scopeMode: z.enum(['ALL', 'ASSIGNED', 'CUSTOM']).optional(),
  classIds: z.array(z.number().int().positive()).optional().default([]),
  subjectIds: z.array(z.number().int().positive()).optional().default([]),
});

const patchUserSchema = z.object({
  id: z.number().int().positive(),
  isActive: z.boolean().optional(),
  roleId: z.number().int().positive().optional(),
  teacherId: z.number().int().positive().nullable().optional(),
  resetPassword: z.string().min(6, 'Kata sandi baru minimal 6 karakter.').optional(),
  fullName: z.string().trim().min(2).optional(),
  email: z.string().trim().email('Email tidak valid.').optional(),
  scopeMode: z.enum(['ALL', 'ASSIGNED', 'CUSTOM']).optional(),
  classIds: z.array(z.number().int().positive()).optional(),
  subjectIds: z.array(z.number().int().positive()).optional(),
});

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'pengguna', 'read');
  if ('error' in auth) return auth.error;

  const db = getDb();
  const userList = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      email: users.email,
      roleId: users.roleId,
      roleCode: roles.code,
      roleName: roles.name,
      teacherId: users.teacherId,
      scopeMode: users.scopeMode,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .orderBy(asc(users.id));

  const classScopeRows = await db.select().from(userClassScopes);
  const subjectScopeRows = await db.select().from(userSubjectScopes);

  const classScopesByUser = new Map<number, number[]>();
  for (const row of classScopeRows) {
    const arr = classScopesByUser.get(row.userId) || [];
    arr.push(row.classId);
    classScopesByUser.set(row.userId, arr);
  }

  const subjectScopesByUser = new Map<number, number[]>();
  for (const row of subjectScopeRows) {
    const arr = subjectScopesByUser.get(row.userId) || [];
    arr.push(row.subjectId);
    subjectScopesByUser.set(row.userId, arr);
  }

  const enrichedUsers = userList.map((u) => ({
    ...u,
    classIds: classScopesByUser.get(u.id) || [],
    subjectIds: subjectScopesByUser.get(u.id) || [],
  }));

  const roleList = await db.select().from(roles).orderBy(asc(roles.id));
  const teacherList = await db
    .select({ id: teachers.id, fullName: teachers.fullName })
    .from(teachers)
    .orderBy(asc(teachers.fullName));

  const [activeSemester] = await db
    .select()
    .from(semesters)
    .where(eq(semesters.isActive, true))
    .limit(1);

  const allClasses = await db
    .select({
      id: classes.id,
      name: classes.name,
      gradeLevel: classes.gradeLevel,
      fase: classes.fase,
      semesterId: classes.semesterId,
    })
    .from(classes)
    .orderBy(asc(classes.gradeLevel), asc(classes.name));

  const filteredClasses = activeSemester
    ? allClasses.filter((c) => c.semesterId === activeSemester.id)
    : allClasses;

  const subjectList = await db
    .select({
      id: subjects.id,
      code: subjects.code,
      name: subjects.name,
      gradeLevel: subjects.gradeLevel,
    })
    .from(subjects)
    .orderBy(asc(subjects.gradeLevel), asc(subjects.sortOrder));

  const logs = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(40);

  return NextResponse.json({
    users: enrichedUsers,
    roles: roleList,
    teachers: teacherList,
    classes: filteredClasses.length > 0 ? filteredClasses : allClasses,
    subjects: subjectList,
    auditLogs: logs,
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'pengguna', 'create');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Data pengguna tidak valid.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const [targetRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.id, parsed.data.roleId))
    .limit(1);
  if (!targetRole) {
    return NextResponse.json({ error: 'Peran yang dipilih tidak valid.' }, { status: 400 });
  }

  if (targetRole.code === 'SUPER_ADMIN' && auth.user.roleCode !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Hanya Super Administrator yang dapat membuat akun Super Administrator.' },
      { status: 403 }
    );
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, parsed.data.username))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: 'Nama pengguna sudah terdaftar.' },
      { status: 409 }
    );
  }

  const effectiveScopeMode =
    targetRole.code === 'SUPER_ADMIN'
      ? 'ALL'
      : parsed.data.scopeMode ||
        (FULL_SCOPE_DEFAULT_ROLES.has(targetRole.code) && !parsed.data.teacherId
          ? 'ALL'
          : 'ASSIGNED');

  const now = new Date().toISOString();
  const data = parsed.data;

  const created = await db.transaction(async (tx) => {
    const [userRow] = await tx
      .insert(users)
      .values({
        username: data.username,
        fullName: data.fullName,
        email: data.email,
        passwordHash: hashPassword(data.password),
        roleId: data.roleId,
        teacherId: data.teacherId ?? null,
        scopeMode: effectiveScopeMode,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        roleId: users.roleId,
        scopeMode: users.scopeMode,
        isActive: users.isActive,
      });

    if (effectiveScopeMode === 'CUSTOM') {
      for (const classId of Array.from(new Set(data.classIds))) {
        await tx.insert(userClassScopes).values({ userId: userRow.id, classId });
      }
      for (const subjectId of Array.from(new Set(data.subjectIds))) {
        await tx.insert(userSubjectScopes).values({ userId: userRow.id, subjectId });
      }
    }

    return userRow;
  });

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'CREATE_USER',
    entityType: 'user',
    entityId: created.id,
    details: `Menambahkan akun pengguna ${created.username} (Peran: ${targetRole.name}, Cakupan: ${effectiveScopeMode}).`,
  });

  return NextResponse.json({ ok: true, user: created }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'pengguna', 'update');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = patchUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Data pembaruan tidak valid.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const [targetRow] = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      roleId: users.roleId,
      roleCode: roles.code,
      isActive: users.isActive,
      scopeMode: users.scopeMode,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, parsed.data.id))
    .limit(1);

  if (!targetRow) {
    return NextResponse.json({ error: 'Akun pengguna tidak ditemukan.' }, { status: 404 });
  }

  let nextRoleCode = targetRow.roleCode;
  if (parsed.data.roleId && parsed.data.roleId !== targetRow.roleId) {
    const [newRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, parsed.data.roleId))
      .limit(1);
    if (!newRole) {
      return NextResponse.json({ error: 'Peran baru tidak ditemukan.' }, { status: 400 });
    }
    if (
      (newRole.code === 'SUPER_ADMIN' || targetRow.roleCode === 'SUPER_ADMIN') &&
      auth.user.roleCode !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json(
        { error: 'Hanya Super Administrator yang dapat mengubah hak Super Administrator.' },
        { status: 403 }
      );
    }
    if (targetRow.id === auth.user.id) {
      return NextResponse.json(
        { error: 'Anda tidak dapat mengubah peran akun yang sedang digunakan sendiri.' },
        { status: 400 }
      );
    }
    nextRoleCode = newRole.code;
  } else if (targetRow.roleCode === 'SUPER_ADMIN' && auth.user.roleCode !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: 'Hanya Super Administrator yang dapat memodifikasi akun Super Administrator.' },
      { status: 403 }
    );
  }

  if (targetRow.id === auth.user.id && parsed.data.isActive === false) {
    return NextResponse.json(
      { error: 'Anda tidak dapat menonaktifkan akun Anda sendiri.' },
      { status: 400 }
    );
  }

  // Safeguard: never deactivate or demote the last active SUPER_ADMIN
  const wouldRemoveSuperAdmin =
    targetRow.roleCode === 'SUPER_ADMIN' &&
    targetRow.isActive &&
    (parsed.data.isActive === false || nextRoleCode !== 'SUPER_ADMIN');
  if (wouldRemoveSuperAdmin) {
    const activeSuperAdmins = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(roles.code, 'SUPER_ADMIN'));
    const activeCount = activeSuperAdmins.filter((a) => a.id !== targetRow.id).length;
    if (activeCount === 0) {
      return NextResponse.json(
        { error: 'Sekolah harus memiliki minimal satu akun Super Administrator aktif.' },
        { status: 409 }
      );
    }
  }

  const data = parsed.data;
  const effectiveScopeMode =
    nextRoleCode === 'SUPER_ADMIN' ? 'ALL' : data.scopeMode ?? targetRow.scopeMode;

  await db.transaction(async (tx) => {
    const updates: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };
    if (typeof data.isActive === 'boolean') updates.isActive = data.isActive;
    if (data.roleId) updates.roleId = data.roleId;
    if (data.teacherId !== undefined) updates.teacherId = data.teacherId;
    if (data.fullName) updates.fullName = data.fullName;
    if (data.email) updates.email = data.email;
    if (data.scopeMode || nextRoleCode === 'SUPER_ADMIN') {
      updates.scopeMode = effectiveScopeMode;
    }
    if (data.resetPassword) updates.passwordHash = hashPassword(data.resetPassword);

    await tx.update(users).set(updates).where(eq(users.id, targetRow.id));

    if (effectiveScopeMode !== 'CUSTOM' && data.scopeMode) {
      await tx.delete(userClassScopes).where(eq(userClassScopes.userId, targetRow.id));
      await tx.delete(userSubjectScopes).where(eq(userSubjectScopes.userId, targetRow.id));
    } else if (effectiveScopeMode === 'CUSTOM') {
      if (data.classIds !== undefined) {
        await tx.delete(userClassScopes).where(eq(userClassScopes.userId, targetRow.id));
        for (const classId of Array.from(new Set(data.classIds))) {
          await tx.insert(userClassScopes).values({ userId: targetRow.id, classId });
        }
      }
      if (data.subjectIds !== undefined) {
        await tx.delete(userSubjectScopes).where(eq(userSubjectScopes.userId, targetRow.id));
        for (const subjectId of Array.from(new Set(data.subjectIds))) {
          await tx.insert(userSubjectScopes).values({ userId: targetRow.id, subjectId });
        }
      }
    }
  });

  invalidateSessionCacheByUserId(targetRow.id);

  const auditNotes: string[] = [];
  if (data.roleId) auditNotes.push('peran');
  if (data.scopeMode || data.classIds || data.subjectIds) auditNotes.push(`cakupan (${effectiveScopeMode})`);
  if (typeof data.isActive === 'boolean') auditNotes.push(data.isActive ? 'aktivasi' : 'nonaktifkan');
  if (data.resetPassword) auditNotes.push('reset sandi');

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'UPDATE_USER',
    entityType: 'user',
    entityId: targetRow.id,
    details: `Memperbarui akun @${targetRow.username}${
      auditNotes.length > 0 ? ` (${auditNotes.join(', ')})` : ''
    }.`,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'pengguna', 'delete');
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id') || 0);
  if (!id) {
    return NextResponse.json({ error: 'ID akun tidak valid.' }, { status: 400 });
  }

  if (id === auth.user.id) {
    return NextResponse.json(
      { error: 'Anda tidak dapat menghapus akun Anda sendiri.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const [targetRow] = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      roleCode: roles.code,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, id))
    .limit(1);

  if (!targetRow) {
    return NextResponse.json({ error: 'Akun pengguna tidak ditemukan.' }, { status: 404 });
  }

  if (targetRow.roleCode === 'SUPER_ADMIN') {
    if (auth.user.roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Hanya Super Administrator yang dapat menghapus akun Super Administrator.' },
        { status: 403 }
      );
    }
    const superAdmins = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(roles.code, 'SUPER_ADMIN'));
    if (superAdmins.filter((s) => s.id !== id).length === 0) {
      return NextResponse.json(
        { error: 'Akun Super Administrator terakhir tidak dapat dihapus.' },
        { status: 409 }
      );
    }
  }

  await db.delete(users).where(eq(users.id, id));
  invalidateSessionCacheByUserId(id);

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'DELETE_USER',
    entityType: 'user',
    entityId: id,
    details: `Menghapus akun pengguna @${targetRow.username} (${targetRow.fullName}).`,
  });

  return NextResponse.json({ ok: true });
}
