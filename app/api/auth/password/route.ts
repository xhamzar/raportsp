import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/server/db';
import { users } from '@/lib/server/db/schema';
import { changePasswordSchema } from '@/lib/validators';
import { hashPassword, verifyPassword } from '@/lib/server/auth/password';
import {
  invalidateSessionCacheByUserId,
  logAudit,
  requireApiAuth,
} from '@/lib/server/auth/session';

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth(req);
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Input kata sandi tidak valid.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const rows = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, auth.user.id))
    .limit(1);

  if (!rows[0] || !verifyPassword(parsed.data.currentPassword, rows[0].passwordHash)) {
    return NextResponse.json(
      { error: 'Kata sandi saat ini tidak sesuai.' },
      { status: 400 }
    );
  }

  await db
    .update(users)
    .set({
      passwordHash: hashPassword(parsed.data.newPassword),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, auth.user.id));

  invalidateSessionCacheByUserId(auth.user.id);

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'CHANGE_PASSWORD',
    entityType: 'user',
    entityId: auth.user.id,
    details: 'Pengguna memperbarui kata sandi akun.',
  });

  return NextResponse.json({ ok: true, message: 'Kata sandi berhasil diperbarui.' });
}
