import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import { notifications } from '@/lib/server/db/schema';
import { requireApiAuth } from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req);
  if ('error' in auth) return auth.error;

  const db = getDb();
  const rows = await db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return NextResponse.json({ notifications: rows });
}

const patchSchema = z.object({
  id: z.number().int().positive().optional(),
  markAll: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req);
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
  }

  const db = getDb();
  if (parsed.data.markAll) {
    await db.update(notifications).set({ isRead: true });
  } else if (parsed.data.id) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, parsed.data.id));
  }

  return NextResponse.json({ ok: true });
}
