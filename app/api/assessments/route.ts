import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  assessmentWeights,
  classes,
  classStudents,
  cocurricularProjects,
  cocurricularScores,
  extracurriculars,
  extracurricularScores,
  formativeAssessments,
  homeroomNotes,
  learningObjectives,
  semesters,
  students,
  subjects,
  summativeScores,
} from '@/lib/server/db/schema';
import {
  assessmentWeightSchema,
  formativeUpdateSchema,
  summativeScoreUpdateSchema,
} from '@/lib/validators';
import { calculateSummativeScores } from '@/lib/server/services/assessment-engine';
import {
  canTeacherAccessScope,
  hasUserPermission,
  logAudit,
  requireApiAuth,
} from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, ['penilaian', 'rapor'], 'read');
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const classIdParam = Number(searchParams.get('classId') || 0);
  const subjectIdParam = Number(searchParams.get('subjectId') || 0);

  const db = getDb();
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);
  const allClasses = await db.select().from(classes).orderBy(asc(classes.gradeLevel));

  const scopedClasses = auth.user.hasFullScope
    ? allClasses
    : allClasses.filter((c) => auth.user.assignedClassIds.includes(c.id));

  const targetClass = classIdParam
    ? allClasses.find((c) => c.id === classIdParam)
    : scopedClasses.find((c) => c.name === '4 A') || scopedClasses[0] || allClasses[0];

  if (!targetClass) {
    return NextResponse.json({ error: 'Rombel tidak ditemukan.' }, { status: 404 });
  }
  if (!canTeacherAccessScope(auth.user, targetClass.id)) {
    return NextResponse.json({ error: 'Anda tidak memiliki akses ke kelas ini.' }, { status: 403 });
  }

  let classSubjects = await db
    .select()
    .from(subjects)
    .where(eq(subjects.gradeLevel, targetClass.gradeLevel))
    .orderBy(asc(subjects.sortOrder));

  const isHomeroomReadAll =
    auth.user.roleCode === 'WALI_KELAS' &&
    auth.user.scopeMode === 'ASSIGNED' &&
    auth.user.homeroomClassIds.includes(targetClass.id);

  if (!auth.user.hasFullScope && !isHomeroomReadAll && auth.user.assignedSubjectIds.length > 0) {
    const allowedSubs = new Set(auth.user.assignedSubjectIds);
    classSubjects = classSubjects.filter((s) => allowedSubs.has(s.id));
  }

  const targetSubject =
    (subjectIdParam ? classSubjects.find((s) => s.id === subjectIdParam) : null) || classSubjects[0];

  if (subjectIdParam && targetSubject && !canTeacherAccessScope(auth.user, targetClass.id, targetSubject.id)) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki akses ke mata pelajaran ini.' },
      { status: 403 }
    );
  }

  const roster = await db
    .select({
      studentId: students.id,
      nisn: students.nisn,
      nis: students.nis,
      fullName: students.fullName,
    })
    .from(classStudents)
    .innerJoin(students, eq(classStudents.studentId, students.id))
    .where(
      and(
        eq(classStudents.classId, targetClass.id),
        eq(classStudents.semesterId, activeSemester.id)
      )
    )
    .orderBy(asc(students.fullName));

  // Summative weights & scores for target subject
  let weights = {
    weightLm: 40,
    weightSts: 30,
    weightSas: 30,
    kktpMin: targetSubject?.kkm ?? 75,
  };
  if (targetSubject) {
    const [w] = await db
      .select()
      .from(assessmentWeights)
      .where(
        and(
          eq(assessmentWeights.subjectId, targetSubject.id),
          eq(assessmentWeights.classId, targetClass.id),
          eq(assessmentWeights.semesterId, activeSemester.id)
        )
      )
      .limit(1);
    if (w) weights = w;
  }

  const allClassSummative = await db
    .select()
    .from(summativeScores)
    .where(
      and(
        eq(summativeScores.classId, targetClass.id),
        eq(summativeScores.semesterId, activeSemester.id)
      )
    );

  const summativeMap = new Map(
    allClassSummative.map((s) => [`${s.studentId}:${s.subjectId}`, s])
  );

  const subjectSummativeRows = roster.map((stu) => {
    const existing = targetSubject
      ? summativeMap.get(`${stu.studentId}:${targetSubject.id}`)
      : undefined;
    const breakdown = calculateSummativeScores(
      {
        lm1: existing?.lm1,
        lm2: existing?.lm2,
        lm3: existing?.lm3,
        lm4: existing?.lm4,
        sts: existing?.sts,
        sas: existing?.sas,
        remedialScore: existing?.remedialScore,
      },
      weights
    );
    return {
      ...stu,
      lm1: existing?.lm1 ?? null,
      lm2: existing?.lm2 ?? null,
      lm3: existing?.lm3 ?? null,
      lm4: existing?.lm4 ?? null,
      sts: existing?.sts ?? null,
      sas: existing?.sas ?? null,
      remedialScore: existing?.remedialScore ?? null,
      enrichmentNote: existing?.enrichmentNote ?? '',
      teacherNote: existing?.teacherNote ?? '',
      midtermScore: breakdown.midtermScore,
      finalScore: breakdown.finalScore,
      lmAverage: breakdown.lmAverage,
      kktpPassed: breakdown.kktpPassed,
    };
  });

  // Formative TP progress for target subject
  const subjectTps = targetSubject
    ? await db
        .select()
        .from(learningObjectives)
        .where(eq(learningObjectives.subjectId, targetSubject.id))
        .orderBy(asc(learningObjectives.atpOrder))
    : [];

  const formativeRows = targetSubject
    ? await db
        .select()
        .from(formativeAssessments)
        .where(
          and(
            eq(formativeAssessments.subjectId, targetSubject.id),
            eq(formativeAssessments.classId, targetClass.id),
            eq(formativeAssessments.semesterId, activeSemester.id)
          )
        )
    : [];
  const formativeMap = new Map(
    formativeRows.map((f) => [`${f.studentId}:${f.learningObjectiveId}`, f])
  );

  const formativeByStudent = roster.map((stu) => {
    const stuItems = subjectTps.map((tp) => {
      const rec = formativeMap.get(`${stu.studentId}:${tp.id}`);
      return {
        tpId: tp.id,
        code: tp.code,
        scopeMaterial: tp.scopeMaterial,
        description: tp.description,
        status: rec?.status || 'Belum Dinilai',
        score: rec?.score ?? null,
        notes: rec?.notes ?? '',
      };
    });
    return { ...stu, items: stuItems };
  });

  // Cocurricular
  const cocuProjects = await db
    .select()
    .from(cocurricularProjects)
    .where(eq(cocurricularProjects.classId, targetClass.id));
  const cocuScores = await db.select().from(cocurricularScores);
  const cocuScoreMap = new Map(cocuScores.map((s) => [`${s.projectId}:${s.studentId}`, s]));

  // Extracurriculars
  const ekstraList = await db.select().from(extracurriculars);
  const ekstraScores = await db
    .select()
    .from(extracurricularScores)
    .where(eq(extracurricularScores.semesterId, activeSemester.id));
  const ekstraMap = new Map(
    ekstraScores.map((e) => [`${e.extracurricularId}:${e.studentId}`, e])
  );
  const ekstraByStudent = new Map<number, typeof ekstraScores>();
  for (const e of ekstraScores) {
    const arr = ekstraByStudent.get(e.studentId) || [];
    arr.push(e);
    ekstraByStudent.set(e.studentId, arr);
  }

  // Homeroom notes
  const notesRows = await db
    .select()
    .from(homeroomNotes)
    .where(
      and(
        eq(homeroomNotes.classId, targetClass.id),
        eq(homeroomNotes.semesterId, activeSemester.id)
      )
    );
  const noteByStudent = new Map(notesRows.map((n) => [n.studentId, n]));

  // Class Leger
  const legerUnsorted = roster.map((stu) => {
    const perSub: Record<number, number | null> = {};
    const validVals: number[] = [];
    for (const sub of classSubjects) {
      const sc = summativeMap.get(`${stu.studentId}:${sub.id}`);
      const val = sc?.finalScore ?? null;
      perSub[sub.id] = val;
      if (typeof val === 'number') validVals.push(val);
    }
    const average =
      validVals.length > 0
        ? Number((validVals.reduce((a, b) => a + b, 0) / validVals.length).toFixed(2))
        : 0;
    const cocu = cocuProjects.map((p) => {
      const cs = cocuScoreMap.get(`${p.id}:${stu.studentId}`);
      return cs?.predicate || '-';
    });
    const ekstra = ekstraByStudent.get(stu.studentId) || [];

    return {
      studentId: stu.studentId,
      nisn: stu.nisn,
      fullName: stu.fullName,
      subjectScores: perSub,
      scoredSubjectCount: validVals.length,
      totalSubjects: classSubjects.length,
      average,
      cocurricularSummary: cocu[0] || '-',
      cocurricularCount: cocu.filter((x) => x !== '-').length,
      extracurricularSummary: ekstra[0]?.predicate || '-',
      extracurricularCount: ekstra.length,
    };
  });

  const leger = [...legerUnsorted]
    .sort((a, b) => b.average - a.average)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  return NextResponse.json({
    selectedClass: targetClass,
    semester: activeSemester,
    subjects: classSubjects,
    selectedSubject: targetSubject || null,
    weights,
    summativeRows: subjectSummativeRows,
    subjectTps,
    formativeByStudent,
    cocurricularProjects: cocuProjects.map((p) => ({
      ...p,
      dimensions: JSON.parse(p.dimensionsJson || '[]'),
      scores: roster.map((stu) => {
        const sc = cocuScoreMap.get(`${p.id}:${stu.studentId}`);
        return {
          studentId: stu.studentId,
          fullName: stu.fullName,
          predicate: sc?.predicate || 'Baik',
          description: sc?.description || '',
        };
      }),
    })),
    extracurriculars: ekstraList.map((e) => ({
      ...e,
      objectives: JSON.parse(e.learningObjectivesJson || '[]'),
      scores: roster.map((stu) => {
        const sc = ekstraMap.get(`${e.id}:${stu.studentId}`);
        return {
          studentId: stu.studentId,
          fullName: stu.fullName,
          predicate: sc?.predicate || '-',
          description: sc?.description || '',
        };
      }),
    })),
    homeroomNotes: roster.map((stu) => {
      const n = noteByStudent.get(stu.studentId);
      return {
        studentId: stu.studentId,
        fullName: stu.fullName,
        note: n?.note || '',
        promotionDecision: n?.promotionDecision || '',
      };
    }),
    leger,
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, ['penilaian', 'rapor'], 'update');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const isHomeroomNote = body?.kind === 'homeroom_note';
  if (!isHomeroomNote && !hasUserPermission(auth.user, 'penilaian', 'update')) {
    return NextResponse.json(
      { error: `Akses ditolak: peran ${auth.user.roleName} tidak memiliki izin Ubah pada modul penilaian.` },
      { status: 403 }
    );
  }

  const db = getDb();
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);
  const now = new Date().toISOString();

  if (body?.kind === 'weights') {
    const parsed = assessmentWeightSchema.safeParse({
      ...body,
      semesterId: body.semesterId || activeSemester.id,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Bobot penilaian tidak valid.' },
        { status: 400 }
      );
    }
    if (!canTeacherAccessScope(auth.user, parsed.data.classId, parsed.data.subjectId)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses mengubah bobot untuk kelas/mapel ini.' },
        { status: 403 }
      );
    }

    await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(assessmentWeights)
        .where(
          and(
            eq(assessmentWeights.subjectId, parsed.data.subjectId),
            eq(assessmentWeights.classId, parsed.data.classId),
            eq(assessmentWeights.semesterId, parsed.data.semesterId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await tx
          .update(assessmentWeights)
          .set({
            weightLm: parsed.data.weightLm,
            weightSts: parsed.data.weightSts,
            weightSas: parsed.data.weightSas,
            kktpMin: parsed.data.kktpMin,
            updatedAt: now,
          })
          .where(eq(assessmentWeights.id, existing[0].id));
      } else {
        await tx.insert(assessmentWeights).values({
          ...parsed.data,
          updatedAt: now,
        });
      }

      // Recalculate existing summative scores for this subject/class
      const rows = await tx
        .select()
        .from(summativeScores)
        .where(
          and(
            eq(summativeScores.subjectId, parsed.data.subjectId),
            eq(summativeScores.classId, parsed.data.classId),
            eq(summativeScores.semesterId, parsed.data.semesterId)
          )
        );
      for (const r of rows) {
        const calc = calculateSummativeScores(r, parsed.data);
        await tx
          .update(summativeScores)
          .set({ midtermScore: calc.midtermScore, finalScore: calc.finalScore, updatedAt: now })
          .where(eq(summativeScores.id, r.id));
      }
    });

    return NextResponse.json({ ok: true });
  }

  if (body?.kind === 'summative') {
    const parsed = summativeScoreUpdateSchema.safeParse({
      ...body,
      semesterId: body.semesterId || activeSemester.id,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Nilai sumatif tidak valid.' },
        { status: 400 }
      );
    }
    if (!canTeacherAccessScope(auth.user, parsed.data.classId, parsed.data.subjectId)) {
      return NextResponse.json(
        { error: 'Anda tidak ditugaskan pada kelas/mata pelajaran ini.' },
        { status: 403 }
      );
    }

    const [w] = await db
      .select()
      .from(assessmentWeights)
      .where(
        and(
          eq(assessmentWeights.subjectId, parsed.data.subjectId),
          eq(assessmentWeights.classId, parsed.data.classId),
          eq(assessmentWeights.semesterId, parsed.data.semesterId)
        )
      )
      .limit(1);

    const calc = calculateSummativeScores(parsed.data, w || { weightLm: 40, weightSts: 30, weightSas: 30, kktpMin: 75 });

    const existing = await db
      .select()
      .from(summativeScores)
      .where(
        and(
          eq(summativeScores.studentId, parsed.data.studentId),
          eq(summativeScores.subjectId, parsed.data.subjectId),
          eq(summativeScores.semesterId, parsed.data.semesterId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(summativeScores)
        .set({
          lm1: parsed.data.lm1 ?? null,
          lm2: parsed.data.lm2 ?? null,
          lm3: parsed.data.lm3 ?? null,
          lm4: parsed.data.lm4 ?? null,
          sts: parsed.data.sts ?? null,
          sas: parsed.data.sas ?? null,
          remedialScore: parsed.data.remedialScore ?? null,
          enrichmentNote: parsed.data.enrichmentNote,
          teacherNote: parsed.data.teacherNote,
          midtermScore: calc.midtermScore,
          finalScore: calc.finalScore,
          updatedAt: now,
        })
        .where(eq(summativeScores.id, existing[0].id));
    } else {
      await db.insert(summativeScores).values({
        studentId: parsed.data.studentId,
        subjectId: parsed.data.subjectId,
        classId: parsed.data.classId,
        semesterId: parsed.data.semesterId,
        lm1: parsed.data.lm1 ?? null,
        lm2: parsed.data.lm2 ?? null,
        lm3: parsed.data.lm3 ?? null,
        lm4: parsed.data.lm4 ?? null,
        sts: parsed.data.sts ?? null,
        sas: parsed.data.sas ?? null,
        remedialScore: parsed.data.remedialScore ?? null,
        enrichmentNote: parsed.data.enrichmentNote,
        teacherNote: parsed.data.teacherNote,
        midtermScore: calc.midtermScore,
        finalScore: calc.finalScore,
        updatedAt: now,
      });
    }

    return NextResponse.json({ ok: true, breakdown: calc });
  }

  if (body?.kind === 'formative') {
    const parsed = formativeUpdateSchema.safeParse({
      ...body,
      semesterId: body.semesterId || activeSemester.id,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data asesmen formatif tidak valid.' }, { status: 400 });
    }
    if (!canTeacherAccessScope(auth.user, parsed.data.classId, parsed.data.subjectId)) {
      return NextResponse.json(
        { error: 'Anda tidak ditugaskan pada kelas/mata pelajaran ini.' },
        { status: 403 }
      );
    }

    const existing = await db
      .select()
      .from(formativeAssessments)
      .where(
        and(
          eq(formativeAssessments.studentId, parsed.data.studentId),
          eq(formativeAssessments.learningObjectiveId, parsed.data.learningObjectiveId),
          eq(formativeAssessments.semesterId, parsed.data.semesterId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(formativeAssessments)
        .set({
          status: parsed.data.status,
          score: parsed.data.score ?? null,
          notes: parsed.data.notes,
          updatedAt: now,
        })
        .where(eq(formativeAssessments.id, existing[0].id));
    } else {
      await db.insert(formativeAssessments).values({
        ...parsed.data,
        score: parsed.data.score ?? null,
        updatedAt: now,
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (body?.kind === 'cocurricular_score') {
    const schema = z.object({
      projectId: z.number().int().positive(),
      studentId: z.number().int().positive(),
      predicate: z.enum(['Sangat Baik', 'Baik', 'Cukup', 'Perlu Bimbingan']),
      description: z.string().trim().min(3),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data nilai kokurikuler tidak valid.' }, { status: 400 });
    }
    const existing = await db
      .select()
      .from(cocurricularScores)
      .where(
        and(
          eq(cocurricularScores.projectId, parsed.data.projectId),
          eq(cocurricularScores.studentId, parsed.data.studentId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(cocurricularScores)
        .set({ predicate: parsed.data.predicate, description: parsed.data.description, updatedAt: now })
        .where(eq(cocurricularScores.id, existing[0].id));
    } else {
      await db.insert(cocurricularScores).values({ ...parsed.data, updatedAt: now });
    }
    return NextResponse.json({ ok: true });
  }

  if (body?.kind === 'extracurricular_score') {
    const schema = z.object({
      extracurricularId: z.number().int().positive(),
      studentId: z.number().int().positive(),
      predicate: z.enum(['Sangat Baik', 'Baik', 'Cukup', 'Kurang']),
      description: z.string().trim().min(3),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data nilai ekstrakurikuler tidak valid.' }, { status: 400 });
    }
    const existing = await db
      .select()
      .from(extracurricularScores)
      .where(
        and(
          eq(extracurricularScores.extracurricularId, parsed.data.extracurricularId),
          eq(extracurricularScores.studentId, parsed.data.studentId),
          eq(extracurricularScores.semesterId, activeSemester.id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(extracurricularScores)
        .set({ predicate: parsed.data.predicate, description: parsed.data.description, updatedAt: now })
        .where(eq(extracurricularScores.id, existing[0].id));
    } else {
      await db.insert(extracurricularScores).values({
        ...parsed.data,
        semesterId: activeSemester.id,
        updatedAt: now,
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (body?.kind === 'homeroom_note') {
    const schema = z.object({
      classId: z.number().int().positive(),
      entries: z
        .array(
          z.object({
            studentId: z.number().int().positive(),
            note: z.string().trim(),
            promotionDecision: z.string().optional().default(''),
          })
        )
        .min(1),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Catatan wali kelas tidak valid.' }, { status: 400 });
    }
    if (!canTeacherAccessScope(auth.user, parsed.data.classId)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses mengubah catatan wali kelas rombel ini.' },
        { status: 403 }
      );
    }

    await db.transaction(async (tx) => {
      for (const entry of parsed.data.entries) {
        const existing = await tx
          .select()
          .from(homeroomNotes)
          .where(
            and(
              eq(homeroomNotes.studentId, entry.studentId),
              eq(homeroomNotes.semesterId, activeSemester.id)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await tx
            .update(homeroomNotes)
            .set({ note: entry.note, promotionDecision: entry.promotionDecision, updatedAt: now })
            .where(eq(homeroomNotes.id, existing[0].id));
        } else {
          await tx.insert(homeroomNotes).values({
            studentId: entry.studentId,
            classId: parsed.data.classId,
            semesterId: activeSemester.id,
            note: entry.note,
            promotionDecision: entry.promotionDecision,
            updatedAt: now,
          });
        }
      }
    });

    await logAudit({
      userId: auth.user.id,
      actorName: auth.user.fullName,
      action: 'UPDATE_HOMEROOM_NOTES',
      entityType: 'homeroom_notes',
      entityId: parsed.data.classId,
      details: `Memperbarui ${parsed.data.entries.length} catatan wali kelas.`,
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Jenis penyimpanan penilaian tidak dikenali.' }, { status: 400 });
}
