import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  schools,
  academicYears,
  semesters,
  schoolCalendars,
  classrooms,
  facilities,
} from '@/lib/server/db/schema';
import { schoolUpdateSchema } from '@/lib/validators';
import { logAudit, requireApiAuth } from '@/lib/server/auth/session';
import { invalidateSchoolLogoCache } from '@/lib/server/services/school-logo-cache';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'sekolah', 'read');
  if ('error' in auth) return auth.error;

  const db = getDb();
  const [school] = await db.select().from(schools).limit(1);
  const years = await db.select().from(academicYears);
  const semList = await db.select().from(semesters);
  const calendars = await db.select().from(schoolCalendars);
  const roomList = await db.select().from(classrooms);
  const facilityList = await db.select().from(facilities);

  return NextResponse.json({
    school,
    academicYears: years,
    semesters: semList,
    calendars,
    classrooms: roomList,
    facilities: facilityList,
  });
}

export async function PUT(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'sekolah', 'update');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = schoolUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Data profil sekolah tidak valid.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const [existing] = await db.select().from(schools).limit(1);
  const now = new Date().toISOString();

  if (existing) {
    await db
      .update(schools)
      .set({
        ...parsed.data,
        enableKeasramaan: parsed.data.enableKeasramaan ?? existing.enableKeasramaan,
        enableAi: parsed.data.enableAi ?? existing.enableAi,
        updatedAt: now,
      })
      .where(eq(schools.id, existing.id));
    invalidateSchoolLogoCache();
  }

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'UPDATE_SCHOOL',
    entityType: 'school',
    entityId: existing?.id ?? 1,
    details: `Memperbarui profil sekolah ${parsed.data.name} (NPSN ${parsed.data.npsn}).`,
  });

  const [updated] = await db.select().from(schools).limit(1);
  return NextResponse.json({ ok: true, school: updated });
}

const actionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('set_active_semester'),
    academicYearId: z.number().int().positive(),
    semesterId: z.number().int().positive(),
    startDate: z.string().optional(),
    reportDate: z.string().optional(),
  }),
  z.object({
    type: z.literal('create_calendar'),
    semesterId: z.number().int().positive(),
    title: z.string().trim().min(2),
    category: z.string().trim().min(2),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    isHoliday: z.boolean().default(false),
    description: z.string().optional().default(''),
  }),
  z.object({
    type: z.literal('create_facility'),
    name: z.string().trim().min(2),
    category: z.string().trim().min(2),
    quantity: z.number().int().min(1),
    condition: z.string().trim().min(2),
    notes: z.string().optional().default(''),
  }),
]);

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'sekolah', 'update');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Permintaan tidak valid.' },
      { status: 400 }
    );
  }

  const db = getDb();
  if (parsed.data.type === 'set_active_semester') {
    const termData = parsed.data;
    await db.transaction(async (tx) => {
      await tx.update(academicYears).set({ isActive: false });
      await tx
        .update(academicYears)
        .set({ isActive: true })
        .where(eq(academicYears.id, termData.academicYearId));

      await tx.update(semesters).set({ isActive: false });
      const semUpdates: Partial<typeof semesters.$inferInsert> = { isActive: true };
      if (termData.startDate) semUpdates.startDate = termData.startDate;
      if (termData.reportDate) semUpdates.reportDate = termData.reportDate;
      await tx.update(semesters).set(semUpdates).where(eq(semesters.id, termData.semesterId));
    });
    await logAudit({
      userId: auth.user.id,
      actorName: auth.user.fullName,
      action: 'UPDATE_ACADEMIC_TERM',
      entityType: 'semester',
      entityId: termData.semesterId,
      details: 'Memperbarui tahun ajaran, semester aktif, dan tanggal kalender rapor.',
    });
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.type === 'create_calendar') {
    const [event] = await db
      .insert(schoolCalendars)
      .values({
        semesterId: parsed.data.semesterId,
        title: parsed.data.title,
        category: parsed.data.category,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        isHoliday: parsed.data.isHoliday,
        description: parsed.data.description,
      })
      .returning();
    return NextResponse.json({ ok: true, event }, { status: 201 });
  }

  const [facility] = await db
    .insert(facilities)
    .values({
      name: parsed.data.name,
      category: parsed.data.category,
      quantity: parsed.data.quantity,
      condition: parsed.data.condition,
      notes: parsed.data.notes,
    })
    .returning();
  return NextResponse.json({ ok: true, facility }, { status: 201 });
}
