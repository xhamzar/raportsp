import { NextRequest, NextResponse } from 'next/server';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getAuthenticatedUser, isBootstrapRequired } from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const bootstrapRequired = await isBootstrapRequired();
  const user = await getAuthenticatedUser(req);

  return NextResponse.json({
    bootstrapRequired,
    authenticated: Boolean(user),
    user,
  });
}
