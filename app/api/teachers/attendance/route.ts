import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import { semesters, teacherAttendance, teachers } from '@/lib/server/db/schema';
import { logAudit, requireApiAuth } from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'absensi', 'read');
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const db = getDb();
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);
  const teacherList = await db.select().from(teachers).where(eq(teachers.isActive, true)).orderBy(teachers.fullName);
  const dailyRows = await db.select().from(teacherAttendance).where(eq(teacherAttendance.date, date));
  const semRows = activeSemester
    ? await db.select().from(teacherAttendance).where(eq(teacherAttendance.semesterId, activeSemester.id))
    : [];

  const dailyMap = new Map(dailyRows.map((r) => [r.teacherId, r]));

  const rows = teacherList.map((t) => {
    const rec = dailyMap.get(t.id);
    const mySem = semRows.filter((r) => r.teacherId === t.id);
    return {
      teacherId: t.id,
      fullName: t.fullName,
      nip: t.nip,
      specialization: t.specialization,
      status: rec?.status || 'Belum presensi',
      checkInTime: rec?.checkInTime || '',
      notes: rec?.notes || '',
      recap: {
        hadir: mySem.filter((r) => r.status === 'Hadir').length,
        sakit: mySem.filter((r) => r.status === 'Sakit').length,
        izin: mySem.filter((r) => r.status === 'Izin').length,
        alpa: mySem.filter((r) => r.status === 'Alpa').length,
        dinasLuar: mySem.filter((r) => r.status === 'Dinas Luar').length,
      },
    };
  });

  return NextResponse.json({ date, rows });
}

const upsertTeacherAttSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z
    .array(
      z.object({
        teacherId: z.number().int().positive(),
        status: z.enum(['Hadir', 'Sakit', 'Izin', 'Alpa', 'Dinas Luar']),
        checkInTime: z.string().optional().default(''),
        notes: z.string().optional().default(''),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'absensi', 'create');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = upsertTeacherAttSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data presensi guru tidak valid.' }, { status: 400 });
  }

  const db = getDb();
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);

  await db.transaction(async (tx) => {
    for (const entry of parsed.data.entries) {
      const existing = await tx
        .select()
        .from(teacherAttendance)
        .where(
          and(
            eq(teacherAttendance.teacherId, entry.teacherId),
            eq(teacherAttendance.date, parsed.data.date)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await tx
          .update(teacherAttendance)
          .set({
            status: entry.status,
            checkInTime: entry.checkInTime || existing[0].checkInTime,
            notes: entry.notes,
          })
          .where(eq(teacherAttendance.id, existing[0].id));
      } else {
        await tx.insert(teacherAttendance).values({
          teacherId: entry.teacherId,
          semesterId: activeSemester.id,
          date: parsed.data.date,
          status: entry.status,
          checkInTime: entry.checkInTime || (entry.status === 'Hadir' ? '06:50' : ''),
          notes: entry.notes,
        });
      }
    }
  });

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'UPDATE_TEACHER_ATTENDANCE',
    entityType: 'teacher_attendance',
    details: `Menyimpan presensi guru tanggal ${parsed.data.date} (${parsed.data.entries.length} entri).`,
  });

  return NextResponse.json({ ok: true });
}
