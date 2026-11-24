import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  academicYears,
  bellConfigs,
  classes,
  classStudents,
  learningObjectives,
  learningOutcomes,
  rpmPlans,
  schedules,
  semesters,
  subjects,
  teachers,
} from '@/lib/server/db/schema';
import { learningObjectiveSchema, subjectCreateSchema } from '@/lib/validators';
import {
  canTeacherAccessScope,
  hasUserPermission,
  logAudit,
  requireApiAuth,
} from '@/lib/server/auth/session';
import type { ModuleName } from '@/lib/server/auth/rbac';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const modParam = searchParams.get('module');
  const requiredModule: ModuleName | ModuleName[] =
    modParam === 'kelas' || modParam === 'jadwal' || modParam === 'kurikulum'
      ? modParam
      : ['kurikulum', 'kelas', 'jadwal', 'penilaian', 'rapor', 'dapodik', 'erapor'];

  const auth = await requireApiAuth(req, requiredModule, 'read');
  if ('error' in auth) return auth.error;

  const classId = Number(searchParams.get('classId') || 0);
  if (classId && !canTeacherAccessScope(auth.user, classId)) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki akses ke rombel ini.' },
      { status: 403 }
    );
  }

  const db = getDb();
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);
  const classList = await db
    .select({
      id: classes.id,
      name: classes.name,
      gradeLevel: classes.gradeLevel,
      fase: classes.fase,
      semesterId: classes.semesterId,
      homeroomTeacherId: classes.homeroomTeacherId,
      homeroomTeacherName: teachers.fullName,
      capacity: classes.capacity,
    })
    .from(classes)
    .leftJoin(teachers, eq(classes.homeroomTeacherId, teachers.id))
    .orderBy(asc(classes.gradeLevel), asc(classes.name));

  const enrollments = activeSemester
    ? await db.select().from(classStudents).where(eq(classStudents.semesterId, activeSemester.id))
    : [];

  let enrichedClasses = classList.map((c) => ({
    ...c,
    studentCount: enrollments.filter((e) => e.classId === c.id).length,
  }));

  if (!auth.user.hasFullScope) {
    const allowedSet = new Set(auth.user.assignedClassIds);
    enrichedClasses = enrichedClasses.filter((c) => allowedSet.has(c.id));
  }

  const targetClass =
    (classId ? enrichedClasses.find((c) => c.id === classId) : null) ||
    enrichedClasses.find((c) => c.name === '4 A') ||
    enrichedClasses[0] ||
    null;

  let allSubjects = await db
    .select({
      id: subjects.id,
      code: subjects.code,
      name: subjects.name,
      category: subjects.category,
      gradeLevel: subjects.gradeLevel,
      fase: subjects.fase,
      kkm: subjects.kkm,
      weeklyHours: subjects.weeklyHours,
      sortOrder: subjects.sortOrder,
      teacherId: subjects.teacherId,
      teacherName: teachers.fullName,
    })
    .from(subjects)
    .leftJoin(teachers, eq(subjects.teacherId, teachers.id))
    .orderBy(asc(subjects.sortOrder), asc(subjects.id));

  if (!auth.user.hasFullScope && auth.user.assignedSubjectIds.length > 0) {
    // For non-homeroom subject teachers or custom subject scope, filter subjects unless WALI_KELAS in homeroom
    const isHomeroomTarget =
      auth.user.roleCode === 'WALI_KELAS' &&
      auth.user.scopeMode === 'ASSIGNED' &&
      targetClass &&
      auth.user.homeroomClassIds.includes(targetClass.id);
    if (!isHomeroomTarget) {
      const subSet = new Set(auth.user.assignedSubjectIds);
      allSubjects = allSubjects.filter((s) => subSet.has(s.id));
    }
  }

  const classSubjects = targetClass
    ? allSubjects.filter((s) => s.gradeLevel === targetClass.gradeLevel)
    : allSubjects;

  const cpList = await db.select().from(learningOutcomes);
  const tpList = await db
    .select()
    .from(learningObjectives)
    .orderBy(asc(learningObjectives.atpOrder), asc(learningObjectives.id));

  const scheduleRows = targetClass
    ? await db
        .select()
        .from(schedules)
        .where(eq(schedules.classId, targetClass.id))
        .orderBy(asc(schedules.dayOfWeek), asc(schedules.periodNumber))
    : [];

  const bells = await db.select().from(bellConfigs).orderBy(asc(bellConfigs.periodNumber));
  const rpmList = targetClass
    ? await db.select().from(rpmPlans).where(eq(rpmPlans.classId, targetClass.id))
    : [];

  return NextResponse.json({
    classes: enrichedClasses,
    selectedClass: targetClass,
    subjects: classSubjects,
    allSubjects,
    learningOutcomes: cpList,
    learningObjectives: tpList,
    schedules: scheduleRows,
    bells,
    rpmPlans: rpmList,
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const baseAuth = await requireApiAuth(req);
  if ('error' in baseAuth) return baseAuth.error;

  const body = await req.json().catch(() => null);
  const kind = String(body?.kind || '');
  const requiredMod: ModuleName =
    kind === 'class' ? 'kelas' : kind === 'schedule' ? 'jadwal' : 'kurikulum';
  if (!hasUserPermission(baseAuth.user, requiredMod, 'create')) {
    return NextResponse.json(
      {
        error: `Akses ditolak: peran ${baseAuth.user.roleName} tidak memiliki izin Tambah pada modul ${requiredMod}.`,
      },
      { status: 403 }
    );
  }
  const auth = baseAuth;

  const db = getDb();
  const [activeYear] = await db.select().from(academicYears).where(eq(academicYears.isActive, true)).limit(1);
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);

  if (body?.kind === 'class') {
    const schema = z.object({
      gradeLevel: z.number().int().min(1).max(12),
      name: z.string().trim().min(2, 'Nama rombel wajib diisi.'),
      homeroomTeacherId: z.number().int().positive().nullable().optional(),
      capacity: z.number().int().min(1).max(50).default(28),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data rombel tidak valid.' },
        { status: 400 }
      );
    }
    const fase =
      parsed.data.gradeLevel <= 2
        ? 'A'
        : parsed.data.gradeLevel <= 4
        ? 'B'
        : parsed.data.gradeLevel <= 6
        ? 'C'
        : parsed.data.gradeLevel <= 9
        ? 'D'
        : 'E/F';
    const [created] = await db
      .insert(classes)
      .values({
        academicYearId: activeYear.id,
        semesterId: activeSemester.id,
        gradeLevel: parsed.data.gradeLevel,
        fase,
        name: parsed.data.name,
        homeroomTeacherId: parsed.data.homeroomTeacherId ?? null,
        capacity: parsed.data.capacity,
      })
      .returning();
    await logAudit({
      userId: auth.user.id,
      actorName: auth.user.fullName,
      action: 'CREATE_CLASS',
      entityType: 'class',
      entityId: created.id,
      details: `Membuat rombel ${created.name} (Fase ${fase}).`,
    });
    return NextResponse.json({ ok: true, class: created }, { status: 201 });
  }

  if (body?.kind === 'subject') {
    const parsed = subjectCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data mata pelajaran tidak valid.' },
        { status: 400 }
      );
    }
    const g = parsed.data.gradeLevel;
    const fase = g <= 2 ? 'A' : g <= 4 ? 'B' : g <= 6 ? 'C' : g <= 9 ? 'D' : 'E';
    const [created] = await db
      .insert(subjects)
      .values({
        ...parsed.data,
        fase,
        sortOrder: 99,
        teacherId: parsed.data.teacherId ?? null,
      })
      .returning();
    return NextResponse.json({ ok: true, subject: created }, { status: 201 });
  }

  if (body?.kind === 'cp') {
    const schema = z.object({
      subjectId: z.number().int().positive(),
      fase: z.string().trim().min(1),
      code: z.string().trim().min(2),
      element: z.string().trim().min(2),
      description: z.string().trim().min(5),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data Capaian Pembelajaran tidak valid.' }, { status: 400 });
    }
    const [created] = await db.insert(learningOutcomes).values(parsed.data).returning();
    return NextResponse.json({ ok: true, cp: created }, { status: 201 });
  }

  if (body?.kind === 'tp') {
    const parsed = learningObjectiveSchema.safeParse({
      ...body,
      semesterId: body?.semesterId || activeSemester.id,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data Tujuan Pembelajaran tidak valid.' },
        { status: 400 }
      );
    }
    const [created] = await db.insert(learningObjectives).values(parsed.data).returning();
    return NextResponse.json({ ok: true, tp: created }, { status: 201 });
  }

  if (body?.kind === 'rpm') {
    const targetClsId = Number(body.classId);
    const targetSubId = Number(body.subjectId);
    if (!canTeacherAccessScope(auth.user, targetClsId, targetSubId)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses ke rombel/mata pelajaran ini.' },
        { status: 403 }
      );
    }
    const now = new Date().toISOString();
    const [created] = await db
      .insert(rpmPlans)
      .values({
        subjectId: targetSubId,
        classId: targetClsId,
        semesterId: activeSemester.id,
        cpText: String(body.cpText || ''),
        scopeMaterial: String(body.scopeMaterial || ''),
        tpIdsJson: JSON.stringify(body.tpIds || []),
        dimensionsJson: JSON.stringify(body.dimensions || []),
        studentCharacteristics: String(body.studentCharacteristics || ''),
        identificationJson: JSON.stringify(body.identification || {}),
        designJson: JSON.stringify(body.design || {}),
        experienceJson: JSON.stringify(body.experience || {}),
        assessmentJson: JSON.stringify(body.assessment || {}),
        status: 'Disetujui',
        createdByUserId: auth.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return NextResponse.json({ ok: true, rpm: created }, { status: 201 });
  }

  if (body?.kind === 'schedule') {
    const schema = z.object({
      classId: z.number().int().positive(),
      dayOfWeek: z.number().int().min(1).max(6),
      periodNumber: z.number().int().min(1).max(14),
      startTime: z.string().min(4),
      endTime: z.string().min(4),
      subjectId: z.number().int().positive().nullable().optional(),
      teacherId: z.number().int().positive().nullable().optional(),
      activityLabel: z.string().optional().default(''),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data jadwal pelajaran tidak valid.' }, { status: 400 });
    }
    if (!canTeacherAccessScope(auth.user, parsed.data.classId)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses mengubah jadwal rombel ini.' },
        { status: 403 }
      );
    }

    // Teacher schedule conflict detection across classes at same day & period
    if (parsed.data.teacherId) {
      const conflicts = await db
        .select({ id: schedules.id, className: classes.name })
        .from(schedules)
        .innerJoin(classes, eq(schedules.classId, classes.id))
        .where(
          and(
            eq(schedules.semesterId, activeSemester.id),
            eq(schedules.dayOfWeek, parsed.data.dayOfWeek),
            eq(schedules.periodNumber, parsed.data.periodNumber),
            eq(schedules.teacherId, parsed.data.teacherId)
          )
        );
      const otherClassConflict = conflicts.find((c) => c.className && c.id);
      if (otherClassConflict && conflicts.some((c) => c.id)) {
        // Check if it's strictly another class
        const sameSlotInThisClass = await db
          .select()
          .from(schedules)
          .where(
            and(
              eq(schedules.classId, parsed.data.classId),
              eq(schedules.dayOfWeek, parsed.data.dayOfWeek),
              eq(schedules.periodNumber, parsed.data.periodNumber)
            )
          );
        if (sameSlotInThisClass.length === 0) {
          return NextResponse.json(
            {
              error: `Bentrok jadwal terdeteksi: guru tersebut sudah terjadwal mengajar di kelas ${otherClassConflict.className} pada jam ke-${parsed.data.periodNumber}.`,
            },
            { status: 409 }
          );
        }
      }
    }

    const existingSlot = await db
      .select()
      .from(schedules)
      .where(
        and(
          eq(schedules.classId, parsed.data.classId),
          eq(schedules.dayOfWeek, parsed.data.dayOfWeek),
          eq(schedules.periodNumber, parsed.data.periodNumber)
        )
      )
      .limit(1);

    if (existingSlot.length > 0) {
      await db
        .update(schedules)
        .set({
          subjectId: parsed.data.subjectId ?? null,
          teacherId: parsed.data.teacherId ?? null,
          activityLabel: parsed.data.activityLabel,
        })
        .where(eq(schedules.id, existingSlot[0].id));
      return NextResponse.json({ ok: true });
    }

    const [created] = await db
      .insert(schedules)
      .values({
        ...parsed.data,
        semesterId: activeSemester.id,
        subjectId: parsed.data.subjectId ?? null,
        teacherId: parsed.data.teacherId ?? null,
      })
      .returning();
    return NextResponse.json({ ok: true, schedule: created }, { status: 201 });
  }

  return NextResponse.json({ error: 'Jenis operasi akademik tidak dikenali.' }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  await ensureSeeded();
  const baseAuth = await requireApiAuth(req);
  if ('error' in baseAuth) return baseAuth.error;

  const body = await req.json().catch(() => null);
  const kind = String(body?.kind || '');
  const requiredMod: ModuleName = kind === 'class' ? 'kelas' : 'kurikulum';
  if (!hasUserPermission(baseAuth.user, requiredMod, 'update')) {
    return NextResponse.json(
      {
        error: `Akses ditolak: peran ${baseAuth.user.roleName} tidak memiliki izin Ubah pada modul ${requiredMod}.`,
      },
      { status: 403 }
    );
  }

  const db = getDb();

  if (body?.kind === 'class' && body.id) {
    if (!canTeacherAccessScope(baseAuth.user, Number(body.id))) {
      return NextResponse.json({ error: 'Tidak memiliki akses ke rombel ini.' }, { status: 403 });
    }
    await db
      .update(classes)
      .set({
        name: body.name,
        homeroomTeacherId: body.homeroomTeacherId ?? null,
        capacity: Number(body.capacity || 28),
      })
      .where(eq(classes.id, Number(body.id)));
    return NextResponse.json({ ok: true });
  }

  if (body?.kind === 'subject' && body.id) {
    await db
      .update(subjects)
      .set({
        name: body.name,
        category: body.category,
        kkm: Number(body.kkm ?? 75),
        weeklyHours: Number(body.weeklyHours ?? 4),
        teacherId: body.teacherId ?? null,
      })
      .where(eq(subjects.id, Number(body.id)));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Permintaan pembaruan tidak valid.' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  await ensureSeeded();
  const baseAuth = await requireApiAuth(req);
  if ('error' in baseAuth) return baseAuth.error;

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get('kind');
  const id = Number(searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'ID tidak valid.' }, { status: 400 });

  const requiredMod: ModuleName = kind === 'schedule' ? 'jadwal' : 'kurikulum';
  if (!hasUserPermission(baseAuth.user, requiredMod, 'delete')) {
    return NextResponse.json(
      {
        error: `Akses ditolak: peran ${baseAuth.user.roleName} tidak memiliki izin Hapus pada modul ${requiredMod}.`,
      },
      { status: 403 }
    );
  }

  const db = getDb();
  if (kind === 'tp') {
    await db.delete(learningObjectives).where(eq(learningObjectives.id, id));
    return NextResponse.json({ ok: true });
  }
  if (kind === 'subject') {
    await db.delete(subjects).where(eq(subjects.id, id));
    return NextResponse.json({ ok: true });
  }
  if (kind === 'schedule') {
    const [sch] = await db.select().from(schedules).where(eq(schedules.id, id)).limit(1);
    if (sch && !canTeacherAccessScope(baseAuth.user, sch.classId)) {
      return NextResponse.json({ error: 'Tidak memiliki akses menghapus jadwal rombel ini.' }, { status: 403 });
    }
    await db.delete(schedules).where(eq(schedules.id, id));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Target penghapusan tidak dikenali.' }, { status: 400 });
}
