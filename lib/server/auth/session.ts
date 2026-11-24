import { cookies, headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { eq, and, gt } from 'drizzle-orm';
import { getDb } from '@/lib/server/db';
import {
  users,
  roles,
  userSessions,
  userClassScopes,
  userSubjectScopes,
  classes,
  subjects,
  teacherAssignments,
  schedules,
  auditLogs,
} from '@/lib/server/db/schema';
import { generateSessionToken, hashSessionToken } from './password';
import {
  ACTION_LABELS,
  ActionName,
  getRolePermissionsFromDb,
  ModuleName,
  RoleCode,
  ScopeMode,
} from './rbac';

export const SESSION_COOKIE_NAME = 'sekolahkita_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const SESSION_CACHE_TTL_MS = 30_000; // 30s in-memory session cache

interface SessionCacheEntry {
  user: AuthenticatedUser;
  expiresAtMs: number;
  dbExpiresAtMs: number;
}

const globalSessionState = globalThis as unknown as {
  __sekolahkitaSessionCache?: Map<string, SessionCacheEntry>;
};

function getSessionCache(): Map<string, SessionCacheEntry> {
  if (!globalSessionState.__sekolahkitaSessionCache) {
    globalSessionState.__sekolahkitaSessionCache = new Map();
  }
  return globalSessionState.__sekolahkitaSessionCache;
}

export function invalidateSessionCacheByTokenHash(tokenHash: string) {
  getSessionCache().delete(tokenHash);
}

export function invalidateSessionCacheByToken(rawToken: string) {
  if (!rawToken) return;
  invalidateSessionCacheByTokenHash(hashSessionToken(rawToken));
}

export function invalidateSessionCacheByUserId(userId: number) {
  const cache = getSessionCache();
  for (const [key, entry] of cache.entries()) {
    if (entry.user.id === userId) {
      cache.delete(key);
    }
  }
}

export function invalidateAllSessionCaches() {
  getSessionCache().clear();
}

export interface AuthenticatedUser {
  id: number;
  username: string;
  fullName: string;
  email: string;
  roleId: number;
  roleCode: RoleCode;
  roleName: string;
  isSystemRole: boolean;
  teacherId: number | null;
  isActive: boolean;
  scopeMode: ScopeMode;
  hasFullScope: boolean;
  permissions: string[];
  assignedClassIds: number[];
  assignedSubjectIds: number[];
  homeroomClassIds: number[];
}

export async function createSession(
  userId: number,
  userAgent = ''
): Promise<{ token: string; expiresAt: string }> {
  const db = getDb();
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

  await db.insert(userSessions).values({
    userId,
    tokenHash,
    expiresAt,
    userAgent: userAgent.slice(0, 200),
    createdAt: now.toISOString(),
  });

  await db
    .update(users)
    .set({ lastLoginAt: now.toISOString(), updatedAt: now.toISOString() })
    .where(eq(users.id, userId));

  return { token, expiresAt };
}

export function attachSessionCookie(res: NextResponse, token: string, expiresAt: string) {
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
    maxAge: 0,
  });
}

export async function revokeSessionByToken(token: string) {
  const db = getDb();
  const tokenHash = hashSessionToken(token);
  invalidateSessionCacheByTokenHash(tokenHash);
  await db.delete(userSessions).where(eq(userSessions.tokenHash, tokenHash));
}

export async function resolveUserScope(params: {
  userId: number;
  roleCode: string;
  teacherId: number | null;
  scopeMode: ScopeMode;
}): Promise<{
  hasFullScope: boolean;
  assignedClassIds: number[];
  assignedSubjectIds: number[];
  homeroomClassIds: number[];
}> {
  const hasFullScope = params.roleCode === 'SUPER_ADMIN' || params.scopeMode === 'ALL';
  if (hasFullScope) {
    return {
      hasFullScope: true,
      assignedClassIds: [],
      assignedSubjectIds: [],
      homeroomClassIds: [],
    };
  }

  const db = getDb();

  if (params.scopeMode === 'CUSTOM') {
    const clsRows = await db
      .select({ classId: userClassScopes.classId })
      .from(userClassScopes)
      .where(eq(userClassScopes.userId, params.userId));
    const subRows = await db
      .select({ subjectId: userSubjectScopes.subjectId })
      .from(userSubjectScopes)
      .where(eq(userSubjectScopes.userId, params.userId));

    return {
      hasFullScope: false,
      assignedClassIds: Array.from(new Set(clsRows.map((c) => c.classId))),
      assignedSubjectIds: Array.from(new Set(subRows.map((s) => s.subjectId))),
      homeroomClassIds: [],
    };
  }

  // scopeMode === 'ASSIGNED'
  const classSet = new Set<number>();
  const subjectSet = new Set<number>();
  const homeroomClassIds: number[] = [];

  if (params.teacherId) {
    const homeroomClasses = await db
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.homeroomTeacherId, params.teacherId));
    for (const c of homeroomClasses) {
      classSet.add(c.id);
      homeroomClassIds.push(c.id);
    }

    const assignmentRows = await db
      .select({ classId: teacherAssignments.classId })
      .from(teacherAssignments)
      .where(eq(teacherAssignments.teacherId, params.teacherId));
    for (const a of assignmentRows) {
      if (a.classId) classSet.add(a.classId);
    }

    const scheduleRows = await db
      .select({ classId: schedules.classId, subjectId: schedules.subjectId })
      .from(schedules)
      .where(eq(schedules.teacherId, params.teacherId));
    for (const sch of scheduleRows) {
      classSet.add(sch.classId);
      if (sch.subjectId) subjectSet.add(sch.subjectId);
    }

    const teacherSubs = await db
      .select({ id: subjects.id, gradeLevel: subjects.gradeLevel })
      .from(subjects)
      .where(eq(subjects.teacherId, params.teacherId));
    for (const s of teacherSubs) {
      subjectSet.add(s.id);
    }

    if (teacherSubs.length > 0) {
      const gradeLevels = new Set(teacherSubs.map((s) => s.gradeLevel));
      const allClasses = await db
        .select({ id: classes.id, gradeLevel: classes.gradeLevel })
        .from(classes);
      for (const c of allClasses) {
        if (gradeLevels.has(c.gradeLevel)) {
          classSet.add(c.id);
        }
      }
    }
  }

  return {
    hasFullScope: false,
    assignedClassIds: Array.from(classSet),
    assignedSubjectIds: Array.from(subjectSet),
    homeroomClassIds,
  };
}

export async function getAuthenticatedUser(
  req?: NextRequest
): Promise<AuthenticatedUser | null> {
  let rawToken: string | undefined;

  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      rawToken = authHeader.slice(7).trim();
    }
    if (!rawToken) {
      rawToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    }
  } else {
    const h = await headers();
    const authHeader = h.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      rawToken = authHeader.slice(7).trim();
    }
    if (!rawToken) {
      const c = await cookies();
      rawToken = c.get(SESSION_COOKIE_NAME)?.value;
    }
  }

  if (!rawToken) return null;

  const tokenHash = hashSessionToken(rawToken);
  const nowMs = Date.now();
  const cache = getSessionCache();
  const cached = cache.get(tokenHash);
  if (
    cached &&
    nowMs < cached.expiresAtMs &&
    nowMs < cached.dbExpiresAtMs &&
    cached.user.isActive
  ) {
    return cached.user;
  }
  if (cached) {
    cache.delete(tokenHash);
  }

  const db = getDb();
  const nowIso = new Date(nowMs).toISOString();

  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      fullName: users.fullName,
      email: users.email,
      isActive: users.isActive,
      teacherId: users.teacherId,
      scopeMode: users.scopeMode,
      sessionExpiresAt: userSessions.expiresAt,
      roleId: roles.id,
      roleCode: roles.code,
      roleName: roles.name,
      isSystemRole: roles.isSystem,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(userSessions.tokenHash, tokenHash), gt(userSessions.expiresAt, nowIso)))
    .limit(1);

  const user = rows[0];
  if (!user || !user.isActive) return null;

  const scopeMode: ScopeMode =
    user.scopeMode === 'ALL' || user.scopeMode === 'CUSTOM' || user.scopeMode === 'ASSIGNED'
      ? user.scopeMode
      : 'ASSIGNED';

  const [permissionsList, scope] = await Promise.all([
    getRolePermissionsFromDb(user.roleId, user.roleCode),
    resolveUserScope({
      userId: user.userId,
      roleCode: user.roleCode,
      teacherId: user.teacherId,
      scopeMode,
    }),
  ]);

  const authUser: AuthenticatedUser = {
    id: user.userId,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    roleId: user.roleId,
    roleCode: user.roleCode as RoleCode,
    roleName: user.roleName,
    isSystemRole: Boolean(user.isSystemRole),
    teacherId: user.teacherId,
    isActive: user.isActive,
    scopeMode: user.roleCode === 'SUPER_ADMIN' ? 'ALL' : scopeMode,
    hasFullScope: scope.hasFullScope,
    permissions: permissionsList,
    assignedClassIds: scope.assignedClassIds,
    assignedSubjectIds: scope.assignedSubjectIds,
    homeroomClassIds: scope.homeroomClassIds,
  };

  if (cache.size > 1000) {
    cache.clear();
  }
  const dbExpiresAtMs = Date.parse(user.sessionExpiresAt) || nowMs + SESSION_TTL_MS;
  cache.set(tokenHash, {
    user: authUser,
    expiresAtMs: nowMs + SESSION_CACHE_TTL_MS,
    dbExpiresAtMs,
  });

  return authUser;
}

export function verifyMutationOrigin(req: NextRequest): boolean {
  if (req.headers.get('x-requested-with') === 'XMLHttpRequest') {
    return true;
  }
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!origin || !host) return true; // non-browser / direct API tool with Bearer
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host === host;
  } catch {
    return false;
  }
}

export function hasUserPermission(
  user: AuthenticatedUser,
  module: ModuleName,
  action: ActionName = 'read'
): boolean {
  return user.permissions.includes(`${module}:${action}`);
}

export async function requireApiAuth(
  req: NextRequest,
  module?: ModuleName | ModuleName[],
  action: ActionName = 'read'
): Promise<{ user: AuthenticatedUser } | { error: NextResponse }> {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (!verifyMutationOrigin(req)) {
      return {
        error: NextResponse.json(
          { error: 'Permintaan lintas origin tidak diizinkan.' },
          { status: 403 }
        ),
      };
    }
  }

  const user = await getAuthenticatedUser(req);
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Sesi tidak valid atau telah berakhir. Silakan masuk kembali.' },
        { status: 401 }
      ),
    };
  }

  if (module) {
    const requiredModules = Array.isArray(module) ? module : [module];
    const allowed = requiredModules.some((m) => user.permissions.includes(`${m}:${action}`));
    if (!allowed) {
      const actionLabel = ACTION_LABELS[action] || action;
      return {
        error: NextResponse.json(
          {
            error: `Akses ditolak: peran ${user.roleName} tidak memiliki izin ${actionLabel} pada modul ${requiredModules.join(' / ')}.`,
          },
          { status: 403 }
        ),
      };
    }
  }

  return { user };
}

export function canTeacherAccessScope(
  user: AuthenticatedUser,
  classId?: number | null,
  subjectId?: number | null
): boolean {
  if (user.hasFullScope) {
    return true;
  }

  if (classId && !user.assignedClassIds.includes(classId)) {
    return false;
  }

  if (subjectId) {
    if (user.scopeMode === 'CUSTOM') {
      if (user.assignedSubjectIds.length > 0) {
        return user.assignedSubjectIds.includes(subjectId);
      }
      return user.assignedClassIds.length > 0;
    }

    // ASSIGNED mode
    if (
      user.roleCode === 'WALI_KELAS' &&
      classId &&
      user.homeroomClassIds.includes(classId)
    ) {
      return true;
    }
    if (
      user.assignedSubjectIds.length === 0 ||
      !user.assignedSubjectIds.includes(subjectId)
    ) {
      return false;
    }
    return true;
  }

  if (!classId && !subjectId) {
    return user.assignedClassIds.length > 0 || user.assignedSubjectIds.length > 0;
  }

  return true;
}

export async function logAudit(params: {
  userId: number | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string | number;
  details: string;
}) {
  const db = getDb();
  await db.insert(auditLogs).values({
    userId: params.userId,
    actorName: params.actorName,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId !== undefined ? String(params.entityId) : '',
    details: params.details,
    createdAt: new Date().toISOString(),
  });
}

export async function isBootstrapRequired(): Promise<boolean> {
  const db = getDb();
  const adminRows = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.username, 'admin'))
    .limit(1);

  if (adminRows.length === 0) return true;
  return !adminRows[0].passwordHash && !process.env.ADMIN_BOOTSTRAP_PASSCODE;
}
