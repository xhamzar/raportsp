import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  classes,
  semesters,
  subjects,
  teacherJournals,
  teachers,
} from '@/lib/server/db/schema';
import { journalCreateSchema } from '@/lib/validators';
import { canTeacherAccessScope, logAudit, requireApiAuth } from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'kurikulum', 'read');
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const date = searchParams.get('date');

  if (classId && !canTeacherAccessScope(auth.user, Number(classId))) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki akses melihat jurnal rombel ini.' },
      { status: 403 }
    );
  }

  const db = getDb();
  const conditions = [];
  if (classId) conditions.push(eq(teacherJournals.classId, Number(classId)));
  if (date) conditions.push(eq(teacherJournals.date, date));

  let rows = await db
    .select({
      id: teacherJournals.id,
      teacherId: teacherJournals.teacherId,
      teacherName: teachers.fullName,
      classId: teacherJournals.classId,
      className: classes.name,
      subjectId: teacherJournals.subjectId,
      subjectName: subjects.name,
      date: teacherJournals.date,
      lessonHour: teacherJournals.lessonHour,
      material: teacherJournals.material,
      objectiveSummary: teacherJournals.objectiveSummary,
      activities: teacherJournals.activities,
      completionStatus: teacherJournals.completionStatus,
      notes: teacherJournals.notes,
      createdAt: teacherJournals.createdAt,
    })
    .from(teacherJournals)
    .innerJoin(teachers, eq(teacherJournals.teacherId, teachers.id))
    .innerJoin(classes, eq(teacherJournals.classId, classes.id))
    .innerJoin(subjects, eq(teacherJournals.subjectId, subjects.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(teacherJournals.date), desc(teacherJournals.id));

  if (!auth.user.hasFullScope) {
    rows = rows.filter((r) => canTeacherAccessScope(auth.user, r.classId, r.subjectId));
  }

  return NextResponse.json({ journals: rows });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'kurikulum', 'create');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const db = getDb();
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);

  const parsed = journalCreateSchema.safeParse({
    ...body,
    semesterId: body?.semesterId || activeSemester.id,
    teacherId: body?.teacherId || auth.user.teacherId || 4,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Data jurnal mengajar tidak valid.' },
      { status: 400 }
    );
  }

  if (!canTeacherAccessScope(auth.user, parsed.data.classId, parsed.data.subjectId)) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki akses mencatat jurnal pada rombel/mapel ini.' },
      { status: 403 }
    );
  }

  const [created] = await db
    .insert(teacherJournals)
    .values({
      ...parsed.data,
      createdAt: new Date().toISOString(),
    })
    .returning();

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'CREATE_JOURNAL',
    entityType: 'teacher_journal',
    entityId: created.id,
    details: `Mencatat jurnal mengajar: ${created.material} (${created.date}).`,
  });

  return NextResponse.json({ ok: true, journal: created }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'kurikulum', 'delete');
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));
  if (!id) {
    return NextResponse.json({ error: 'ID jurnal tidak valid.' }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(teacherJournals)
    .where(eq(teacherJournals.id, id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Jurnal tidak ditemukan.' }, { status: 404 });
  }

  if (!canTeacherAccessScope(auth.user, existing.classId, existing.subjectId)) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki akses menghapus jurnal rombel/mapel ini.' },
      { status: 403 }
    );
  }

  await db.delete(teacherJournals).where(eq(teacherJournals.id, id));
  return NextResponse.json({ ok: true });
}
