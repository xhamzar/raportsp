import { NextRequest, NextResponse } from 'next/server';
import { eq, isNull } from 'drizzle-orm';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import { users } from '@/lib/server/db/schema';
import { bootstrapAdminSchema } from '@/lib/validators';
import { hashPassword } from '@/lib/server/auth/password';
import {
  attachSessionCookie,
  createSession,
  isBootstrapRequired,
  logAudit,
  verifyMutationOrigin,
} from '@/lib/server/auth/session';

export async function POST(req: NextRequest) {
  await ensureSeeded();
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Origin tidak valid.' }, { status: 403 });
  }

  const needed = await isBootstrapRequired();
  if (!needed) {
    return NextResponse.json(
      { error: 'Akun administrator telah diaktivasi sebelumnya. Silakan masuk melalui formulir login.' },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bootstrapAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Data aktivasi tidak valid.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const passwordHash = hashPassword(parsed.data.password);
  const now = new Date().toISOString();

  const adminRows = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);
  if (adminRows.length === 0) {
    return NextResponse.json({ error: 'Akun admin tidak ditemukan.' }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, adminRows[0].id));

    if (parsed.data.initializeDemoRoles) {
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: now })
        .where(isNull(users.passwordHash));
    }
  });

  const session = await createSession(adminRows[0].id, req.headers.get('user-agent') || '');
  await logAudit({
    userId: adminRows[0].id,
    actorName: adminRows[0].fullName,
    action: 'BOOTSTRAP_ADMIN',
    entityType: 'user',
    entityId: adminRows[0].id,
    details: 'Aktivasi kata sandi awal administrator SEKOLAHKITA.',
  });

  const res = NextResponse.json({
    ok: true,
    token: session.token,
    message: 'Aktivasi berhasil. Selamat datang di SEKOLAHKITA.',
  });
  attachSessionCookie(res, session.token, session.expiresAt);
  return res;
}
