import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/server/db';
import { permissions, rolePermissions } from '@/lib/server/db/schema';
import {
  ALL_ACTIONS,
  ALL_MODULES,
  LOCKED_SUPER_ADMIN_PERMISSIONS,
  type ActionName,
  type ModuleName,
} from '@/lib/auth/rbac-constants';

export * from '@/lib/auth/rbac-constants';

export function normalizePermissionKeys(
  rawKeys: string[],
  roleCode?: string
): string[] {
  const validSet = new Set<string>();
  const allowedModules = new Set<string>(ALL_MODULES);
  const allowedActions = new Set<string>(ALL_ACTIONS);

  for (const key of rawKeys) {
    const [mod, act] = String(key).split(':');
    if (allowedModules.has(mod) && allowedActions.has(act)) {
      validSet.add(`${mod}:${act}`);
    }
  }

  if (roleCode === 'SUPER_ADMIN') {
    for (const locked of LOCKED_SUPER_ADMIN_PERMISSIONS) {
      validSet.add(locked);
    }
  }

  return Array.from(validSet).sort();
}

export async function ensurePermissionsCatalog(): Promise<Map<string, number>> {
  const db = getDb();
  const existing = await db.select().from(permissions);
  const permMap = new Map<string, number>();

  for (const p of existing) {
    permMap.set(`${p.module}:${p.action}`, p.id);
  }

  for (const mod of ALL_MODULES) {
    for (const act of ALL_ACTIONS) {
      const key = `${mod}:${act}`;
      if (!permMap.has(key)) {
        const [inserted] = await db
          .insert(permissions)
          .values({
            module: mod,
            action: act,
            description: `Izin ${act} pada modul ${mod}`,
          })
          .onConflictDoNothing()
          .returning({ id: permissions.id });
        if (inserted) {
          permMap.set(key, inserted.id);
        }
      }
    }
  }

  if (permMap.size < ALL_MODULES.length * ALL_ACTIONS.length) {
    const refreshed = await db.select().from(permissions);
    permMap.clear();
    for (const p of refreshed) {
      permMap.set(`${p.module}:${p.action}`, p.id);
    }
  }

  return permMap;
}

export async function getRolePermissionsFromDb(
  roleId: number,
  roleCode?: string
): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({
      module: permissions.module,
      action: permissions.action,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, roleId));

  const keys = rows.map((r) => `${r.module}:${r.action}`);
  if (roleCode === 'SUPER_ADMIN') {
    const merged = new Set(keys);
    for (const locked of LOCKED_SUPER_ADMIN_PERMISSIONS) {
      merged.add(locked);
    }
    return Array.from(merged).sort();
  }
  return Array.from(new Set(keys)).sort();
}

export function hasPermissionKey(
  permissionList: readonly string[],
  module: ModuleName,
  action: ActionName
): boolean {
  return permissionList.includes(`${module}:${action}`);
}
