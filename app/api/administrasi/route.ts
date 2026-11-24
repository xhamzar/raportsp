import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import { guestbookEntries, officialTravels, teachers } from '@/lib/server/db/schema';
import { logAudit, requireApiAuth } from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'administrasi', 'read');
  if ('error' in auth) return auth.error;

  const db = getDb();
  const guests = await db
    .select()
    .from(guestbookEntries)
    .orderBy(desc(guestbookEntries.createdAt));
  const travels = await db
    .select({
      id: officialTravels.id,
      teacherId: officialTravels.teacherId,
      teacherName: teachers.fullName,
      destination: officialTravels.destination,
      purpose: officialTravels.purpose,
      letterNumber: officialTravels.letterNumber,
      startDate: officialTravels.startDate,
      endDate: officialTravels.endDate,
      status: officialTravels.status,
      notes: officialTravels.notes,
      createdAt: officialTravels.createdAt,
    })
    .from(officialTravels)
    .innerJoin(teachers, eq(officialTravels.teacherId, teachers.id))
    .orderBy(desc(officialTravels.createdAt));

  return NextResponse.json({ guests, travels });
}

const postSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('guest'),
    visitorName: z.string().trim().min(2, 'Nama tamu wajib diisi.'),
    institution: z.string().trim().min(2, 'Asal instansi/alamat wajib diisi.'),
    purpose: z.string().trim().min(3, 'Keperluan kunjungan wajib diisi.'),
    personToMeet: z.string().trim().min(2, 'Tujuan menemui siapa wajib diisi.'),
    phone: z.string().trim().optional().default(''),
    visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().optional().default(''),
  }),
  z.object({
    type: z.literal('travel'),
    teacherId: z.number().int().positive(),
    destination: z.string().trim().min(2, 'Tujuan perjalanan dinas wajib diisi.'),
    purpose: z.string().trim().min(3, 'Keterangan tugas wajib diisi.'),
    letterNumber: z.string().trim().optional().default(''),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().optional().default(''),
  }),
]);

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'administrasi', 'create');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Data administrasi tidak valid.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const now = new Date().toISOString();

  if (parsed.data.type === 'guest') {
    const [guest] = await db
      .insert(guestbookEntries)
      .values({
        visitorName: parsed.data.visitorName,
        institution: parsed.data.institution,
        purpose: parsed.data.purpose,
        personToMeet: parsed.data.personToMeet,
        phone: parsed.data.phone,
        visitDate: parsed.data.visitDate,
        notes: parsed.data.notes,
        createdAt: now,
      })
      .returning();

    await logAudit({
      userId: auth.user.id,
      actorName: auth.user.fullName,
      action: 'CREATE_GUESTBOOK',
      entityType: 'guestbook',
      entityId: guest.id,
      details: `Mencatat kunjungan tamu: ${guest.visitorName} (${guest.institution}).`,
    });

    return NextResponse.json({ ok: true, guest }, { status: 201 });
  }

  const [travel] = await db
    .insert(officialTravels)
    .values({
      teacherId: parsed.data.teacherId,
      destination: parsed.data.destination,
      purpose: parsed.data.purpose,
      letterNumber: parsed.data.letterNumber,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      status: 'Diajukan',
      notes: parsed.data.notes,
      createdAt: now,
    })
    .returning();

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'CREATE_OFFICIAL_TRAVEL',
    entityType: 'official_travel',
    entityId: travel.id,
    details: `Mengajukan dinas luar ke ${travel.destination}.`,
  });

  return NextResponse.json({ ok: true, travel }, { status: 201 });
}

const patchTravelSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(['Diajukan', 'Disetujui', 'Selesai']),
});

export async function PATCH(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'administrasi', 'approve');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = patchTravelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Status perjalanan dinas tidak valid.' }, { status: 400 });
  }

  const db = getDb();
  await db
    .update(officialTravels)
    .set({ status: parsed.data.status })
    .where(eq(officialTravels.id, parsed.data.id));

  return NextResponse.json({ ok: true });
}
