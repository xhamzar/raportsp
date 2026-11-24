import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  classes,
  classStudents,
  schoolCalendars,
  semesters,
  studentAttendance,
  students,
} from '@/lib/server/db/schema';
import { attendanceBatchSchema } from '@/lib/validators';
import { generateAttendanceRecapWorkbook } from '@/lib/server/services/excel-service';
import { canTeacherAccessScope, logAudit, requireApiAuth } from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const classIdParam = Number(searchParams.get('classId') || 0);
  const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const format = searchParams.get('format') || 'json';

  const auth = await requireApiAuth(req, 'absensi', format === 'xlsx' ? 'export' : 'read');
  if ('error' in auth) return auth.error;

  const db = getDb();
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);
  const allClasses = await db.select().from(classes).orderBy(asc(classes.gradeLevel));
  const scopedClasses = auth.user.hasFullScope
    ? allClasses
    : allClasses.filter((c) => auth.user.assignedClassIds.includes(c.id));

  const cls = classIdParam
    ? allClasses.find((c) => c.id === classIdParam)
    : scopedClasses.find((c) => c.name === '4 A') || scopedClasses[0] || allClasses[0];

  if (!cls) {
    return NextResponse.json({ error: 'Rombel tidak ditemukan.' }, { status: 404 });
  }
  if (!canTeacherAccessScope(auth.user, cls.id)) {
    return NextResponse.json({ error: 'Tidak memiliki akses ke rombel ini.' }, { status: 403 });
  }

  const roster = await db
    .select({
      studentId: students.id,
      nisn: students.nisn,
      fullName: students.fullName,
    })
    .from(classStudents)
    .innerJoin(students, eq(classStudents.studentId, students.id))
    .where(and(eq(classStudents.classId, cls.id), eq(classStudents.semesterId, activeSemester.id)))
    .orderBy(asc(students.fullName));

  const dailyRows = await db
    .select()
    .from(studentAttendance)
    .where(and(eq(studentAttendance.classId, cls.id), eq(studentAttendance.date, date)));

  const semesterRows = await db
    .select()
    .from(studentAttendance)
    .where(
      and(
        eq(studentAttendance.classId, cls.id),
        eq(studentAttendance.semesterId, activeSemester.id)
      )
    );

  // Check if selected date falls on a school holiday
  const holidays = await db
    .select()
    .from(schoolCalendars)
    .where(and(eq(schoolCalendars.semesterId, activeSemester.id), eq(schoolCalendars.isHoliday, true)));
  const holidayMatch = holidays.find((h) => date >= h.startDate && date <= h.endDate);

  const dailyByStudent = new Map(dailyRows.map((d) => [d.studentId, d]));
  const semesterCountsByStudent = new Map<
    number,
    { hadir: number; sakit: number; izin: number; alpa: number }
  >();
  for (const s of semesterRows) {
    const cur = semesterCountsByStudent.get(s.studentId) || {
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpa: 0,
    };
    if (s.status === 'H') cur.hadir += 1;
    else if (s.status === 'S') cur.sakit += 1;
    else if (s.status === 'I') cur.izin += 1;
    else if (s.status === 'A') cur.alpa += 1;
    semesterCountsByStudent.set(s.studentId, cur);
  }

  const rows = roster.map((stu, idx) => {
    const rec = dailyByStudent.get(stu.studentId);
    const counts = semesterCountsByStudent.get(stu.studentId) || {
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpa: 0,
    };
    const total = counts.hadir + counts.sakit + counts.izin + counts.alpa;
    const percentage = total > 0 ? Math.round((counts.hadir / total) * 100) : 100;

    return {
      no: idx + 1,
      studentId: stu.studentId,
      nisn: stu.nisn,
      fullName: stu.fullName,
      status: rec?.status || null,
      notes: rec?.notes || '',
      hadir: counts.hadir,
      sakit: counts.sakit,
      izin: counts.izin,
      alpa: counts.alpa,
      percentage,
    };
  });

  if (format === 'xlsx') {
    const buf = await generateAttendanceRecapWorkbook({
      className: cls.name,
      semester: activeSemester.name,
      rows,
    });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="rekap-presensi-${cls.name.replace(/\s+/g, '')}.xlsx"`,
      },
    });
  }

  return NextResponse.json({
    class: cls,
    date,
    holiday: holidayMatch || null,
    rows,
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'absensi', 'create');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const db = getDb();
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);

  const parsed = attendanceBatchSchema.safeParse({
    ...body,
    semesterId: body?.semesterId || activeSemester.id,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Data presensi murid tidak valid.' },
      { status: 400 }
    );
  }
  if (!canTeacherAccessScope(auth.user, parsed.data.classId)) {
    return NextResponse.json({ error: 'Tidak memiliki akses ke rombel ini.' }, { status: 403 });
  }

  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    for (const entry of parsed.data.entries) {
      const existing = await tx
        .select()
        .from(studentAttendance)
        .where(
          and(
            eq(studentAttendance.studentId, entry.studentId),
            eq(studentAttendance.date, parsed.data.date)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await tx
          .update(studentAttendance)
          .set({ status: entry.status, notes: entry.notes, updatedAt: now })
          .where(eq(studentAttendance.id, existing[0].id));
      } else {
        await tx.insert(studentAttendance).values({
          studentId: entry.studentId,
          classId: parsed.data.classId,
          semesterId: parsed.data.semesterId,
          date: parsed.data.date,
          status: entry.status,
          notes: entry.notes,
          updatedAt: now,
        });
      }
    }
  });

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'UPDATE_STUDENT_ATTENDANCE',
    entityType: 'student_attendance',
    entityId: parsed.data.classId,
    details: `Menyimpan presensi harian tanggal ${parsed.data.date} (${parsed.data.entries.length} murid).`,
  });

  return NextResponse.json({ ok: true });
}
