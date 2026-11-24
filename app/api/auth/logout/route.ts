import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  getAuthenticatedUser,
  invalidateSessionCacheByToken,
  logAudit,
  revokeSessionByToken,
  verifyMutationOrigin,
} from '@/lib/server/auth/session';

export async function POST(req: NextRequest) {
  if (!verifyMutationOrigin(req)) {
    return NextResponse.json({ error: 'Origin tidak valid.' }, { status: 403 });
  }

  const user = await getAuthenticatedUser(req);
  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const token = bearer || cookieToken;

  if (token) {
    invalidateSessionCacheByToken(token);
    await revokeSessionByToken(token);
  }
  if (user) {
    await logAudit({
      userId: user.id,
      actorName: user.fullName,
      action: 'LOGOUT',
      entityType: 'session',
      entityId: user.id,
      details: 'Keluar dari sesi aplikasi.',
    });
  }

  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
