import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import { users, roles } from '@/lib/server/db/schema';
import { loginSchema } from '@/lib/validators';
import { verifyPassword } from '@/lib/server/auth/password';
import {
  attachSessionCookie,
  createSession,
  logAudit,
  verifyMutationOrigin,
} from '@/lib/server/auth/session';

export async function POST(req: NextRequest) {
  await ensureSeeded();
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Origin tidak valid.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Nama pengguna atau kata sandi tidak valid.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      email: users.email,
      passwordHash: users.passwordHash,
      isActive: users.isActive,
      roleCode: roles.code,
      roleName: roles.name,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.username, parsed.data.username))
    .limit(1);

  const user = rows[0];
  if (!user) {
    return NextResponse.json(
      { error: 'Nama pengguna atau kata sandi salah.' },
      { status: 401 }
    );
  }

  if (!user.isActive) {
    return NextResponse.json(
      { error: 'Akun Anda dinonaktifkan. Hubungi Administrator Sekolah.' },
      { status: 403 }
    );
  }

  const envPasscode = process.env.ADMIN_BOOTSTRAP_PASSCODE;
  const matchesEnvOverride =
    user.username === 'admin' && Boolean(envPasscode) && parsed.data.password === envPasscode;
  const matchesStoredHash = verifyPassword(parsed.data.password, user.passwordHash);

  if (!matchesEnvOverride && !matchesStoredHash) {
    return NextResponse.json(
      { error: 'Nama pengguna atau kata sandi salah.' },
      { status: 401 }
    );
  }

  const session = await createSession(user.id, req.headers.get('user-agent') || '');
  await logAudit({
    userId: user.id,
    actorName: user.fullName,
    action: 'LOGIN',
    entityType: 'session',
    entityId: user.id,
    details: `Masuk sebagai ${user.roleName} (${user.username}).`,
  });

  const res = NextResponse.json({
    ok: true,
    token: session.token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      roleCode: user.roleCode,
      roleName: user.roleName,
    },
  });
  attachSessionCookie(res, session.token, session.expiresAt);
  return res;
}
