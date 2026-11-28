import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
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
  cocurricularProjectSchema,
  extracurricularSchema,
  formativeBatchSchema,
  formativeUpdateSchema,
  summativeScoreUpdateSchema,
} from '@/lib/validators';
import { calculateSummativeScores } from '@/lib/server/services/assessment-engine';
import {
  buildCocurricularDescription,
  buildExtracurricularDescription,
  computeAverageTwo,
  computeScopeAveragesFromTpScores,
} from '@/lib/assessment-helpers';
import {
  canTeacherAccessScope,
  hasUserPermission,
  logAudit,
  requireApiAuth,
} from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, ['penilaian', 'rapor', 'kurikulum'], 'read');
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

  // Learning objectives for target subject
  const subjectTps = targetSubject
    ? await db
        .select()
        .from(learningObjectives)
        .where(eq(learningObjectives.subjectId, targetSubject.id))
        .orderBy(asc(learningObjectives.atpOrder))
    : [];

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
    let parsedTpScores: Record<string, number | null> = {};
    try {
      parsedTpScores = existing?.tpScoresJson ? JSON.parse(existing.tpScoresJson) : {};
    } catch {
      parsedTpScores = {};
    }
    const hasTpValues = Object.values(parsedTpScores).some(
      (v) => typeof v === 'number' && Number.isFinite(v)
    );
    const scopeCalc =
      hasTpValues && subjectTps.length > 0
        ? computeScopeAveragesFromTpScores(subjectTps, parsedTpScores)
        : null;

    const breakdown = calculateSummativeScores(
      {
        lm1: existing?.lm1,
        lm2: existing?.lm2,
        lm3: existing?.lm3,
        lm4: existing?.lm4,
        lmAverageOverride: scopeCalc?.lmAverage ?? undefined,
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
      stsTes: existing?.stsTes ?? null,
      stsNonTes: existing?.stsNonTes ?? null,
      sasTes: existing?.sasTes ?? null,
      sasNonTes: existing?.sasNonTes ?? null,
      tpScores: parsedTpScores,
      scopeSummaries: scopeCalc?.scopes || [],
      remedialScore: existing?.remedialScore ?? null,
      enrichmentNote: existing?.enrichmentNote ?? '',
      teacherNote: existing?.teacherNote ?? '',
      midtermScore: breakdown.midtermScore,
      finalScore: breakdown.finalScore,
      lmAverage: breakdown.lmAverage,
      kktpPassed: breakdown.kktpPassed,
    };
  });

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
        let dimensionScores: Record<string, string> = {};
        try {
          dimensionScores = sc?.dimensionScoresJson ? JSON.parse(sc.dimensionScoresJson) : {};
        } catch {
          dimensionScores = {};
        }
        return {
          studentId: stu.studentId,
          fullName: stu.fullName,
          predicate: sc?.predicate || '',
          dimensionScores,
          description: sc?.description || '',
        };
      }),
    })),
    extracurriculars: ekstraList.map((e) => ({
      ...e,
      objectives: JSON.parse(e.learningObjectivesJson || '[]'),
      scores: roster.map((stu) => {
        const sc = ekstraMap.get(`${e.id}:${stu.studentId}`);
        let tpScores: Array<{ objective: string; predicate: string }> = [];
        try {
          tpScores = sc?.tpScoresJson ? JSON.parse(sc.tpScoresJson) : [];
        } catch {
          tpScores = [];
        }
        return {
          studentId: stu.studentId,
          fullName: stu.fullName,
          predicate: sc?.predicate || '-',
          tpScores,
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
  const auth = await requireApiAuth(req, ['penilaian', 'rapor', 'kurikulum'], 'read');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const kind = String(body?.kind || '');
  const isHomeroomNote = kind === 'homeroom_note';
  const isMasterSetup = kind === 'cocurricular_project' || kind === 'extracurricular';

  if (isMasterSetup) {
    const action = body?.id ? 'update' : 'create';
    const allowed =
      hasUserPermission(auth.user, 'kurikulum', action) ||
      hasUserPermission(auth.user, 'penilaian', action);
    if (!allowed) {
      return NextResponse.json(
        {
          error: `Akses ditolak: peran ${auth.user.roleName} tidak memiliki izin mengelola daftar ini.`,
        },
        { status: 403 }
      );
    }
  } else if (!isHomeroomNote && !hasUserPermission(auth.user, 'penilaian', 'update')) {
    return NextResponse.json(
      { error: `Akses ditolak: peran ${auth.user.roleName} tidak memiliki izin Ubah pada modul penilaian.` },
      { status: 403 }
    );
  } else if (isHomeroomNote && !hasUserPermission(auth.user, 'penilaian', 'update') && !hasUserPermission(auth.user, 'rapor', 'update')) {
    return NextResponse.json(
      { error: `Akses ditolak: peran ${auth.user.roleName} tidak memiliki izin memperbarui catatan wali kelas.` },
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
      const tps = await tx
        .select({ id: learningObjectives.id, scopeMaterial: learningObjectives.scopeMaterial })
        .from(learningObjectives)
        .where(eq(learningObjectives.subjectId, parsed.data.subjectId))
        .orderBy(asc(learningObjectives.atpOrder));
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
        let lmAverageOverride: number | undefined;
        try {
          const tpScores = r.tpScoresJson ? JSON.parse(r.tpScoresJson) : {};
          if (tps.length > 0 && Object.values(tpScores).some((v) => typeof v === 'number')) {
            const sc = computeScopeAveragesFromTpScores(tps, tpScores);
            if (sc.lmAverage !== null) lmAverageOverride = sc.lmAverage;
          }
        } catch {
          lmAverageOverride = undefined;
        }
        const calc = calculateSummativeScores({ ...r, lmAverageOverride }, parsed.data);
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

    let lm1 = parsed.data.lm1 ?? null;
    let lm2 = parsed.data.lm2 ?? null;
    let lm3 = parsed.data.lm3 ?? null;
    let lm4 = parsed.data.lm4 ?? null;
    let lmAverageOverride: number | undefined;
    const tpScoresObj = parsed.data.tpScores;

    if (tpScoresObj && Object.keys(tpScoresObj).length > 0) {
      const tps = await db
        .select({ id: learningObjectives.id, scopeMaterial: learningObjectives.scopeMaterial })
        .from(learningObjectives)
        .where(eq(learningObjectives.subjectId, parsed.data.subjectId))
        .orderBy(asc(learningObjectives.atpOrder));
      const scopeCalc = computeScopeAveragesFromTpScores(tps, tpScoresObj);
      lm1 = scopeCalc.lm1;
      lm2 = scopeCalc.lm2;
      lm3 = scopeCalc.lm3;
      lm4 = scopeCalc.lm4;
      if (scopeCalc.lmAverage !== null) {
        lmAverageOverride = scopeCalc.lmAverage;
      }
    }

    const stsTesVal = parsed.data.stsTes !== undefined ? parsed.data.stsTes : undefined;
    const stsNonTesVal = parsed.data.stsNonTes !== undefined ? parsed.data.stsNonTes : undefined;
    const computedSts =
      stsTesVal !== undefined || stsNonTesVal !== undefined
        ? computeAverageTwo(stsTesVal ?? null, stsNonTesVal ?? null)
        : parsed.data.sts ?? null;

    const sasTesVal = parsed.data.sasTes !== undefined ? parsed.data.sasTes : undefined;
    const sasNonTesVal = parsed.data.sasNonTes !== undefined ? parsed.data.sasNonTes : undefined;
    const computedSas =
      sasTesVal !== undefined || sasNonTesVal !== undefined
        ? computeAverageTwo(sasTesVal ?? null, sasNonTesVal ?? null)
        : parsed.data.sas ?? null;

    const calc = calculateSummativeScores(
      {
        lm1,
        lm2,
        lm3,
        lm4,
        lmAverageOverride,
        sts: computedSts,
        sas: computedSas,
        remedialScore: parsed.data.remedialScore,
      },
      w || { weightLm: 40, weightSts: 30, weightSas: 30, kktpMin: 75 }
    );

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

    const tpScoresJson = JSON.stringify(tpScoresObj || {});

    if (existing.length > 0) {
      await db
        .update(summativeScores)
        .set({
          lm1,
          lm2,
          lm3,
          lm4,
          sts: computedSts,
          sas: computedSas,
          stsTes: stsTesVal !== undefined ? stsTesVal : existing[0].stsTes,
          stsNonTes: stsNonTesVal !== undefined ? stsNonTesVal : existing[0].stsNonTes,
          sasTes: sasTesVal !== undefined ? sasTesVal : existing[0].sasTes,
          sasNonTes: sasNonTesVal !== undefined ? sasNonTesVal : existing[0].sasNonTes,
          tpScoresJson: tpScoresObj !== undefined ? tpScoresJson : existing[0].tpScoresJson,
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
        lm1,
        lm2,
        lm3,
        lm4,
        sts: computedSts,
        sas: computedSas,
        stsTes: stsTesVal ?? null,
        stsNonTes: stsNonTesVal ?? null,
        sasTes: sasTesVal ?? null,
        sasNonTes: sasNonTesVal ?? null,
        tpScoresJson,
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

    if (parsed.data.status === 'Belum Dinilai') {
      if (existing.length > 0) {
        await db.delete(formativeAssessments).where(eq(formativeAssessments.id, existing[0].id));
      }
      return NextResponse.json({ ok: true });
    }

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

  if (body?.kind === 'formative_batch') {
    const parsed = formativeBatchSchema.safeParse({
      ...body,
      semesterId: body.semesterId || activeSemester.id,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data asesmen formatif murid tidak valid.' }, { status: 400 });
    }
    if (!canTeacherAccessScope(auth.user, parsed.data.classId, parsed.data.subjectId)) {
      return NextResponse.json(
        { error: 'Anda tidak ditugaskan pada kelas/mata pelajaran ini.' },
        { status: 403 }
      );
    }

    await db.transaction(async (tx) => {
      for (const entry of parsed.data.entries) {
        const existing = await tx
          .select()
          .from(formativeAssessments)
          .where(
            and(
              eq(formativeAssessments.studentId, parsed.data.studentId),
              eq(formativeAssessments.learningObjectiveId, entry.learningObjectiveId),
              eq(formativeAssessments.semesterId, parsed.data.semesterId)
            )
          )
          .limit(1);

        if (entry.status === 'Belum Dinilai') {
          if (existing.length > 0) {
            await tx.delete(formativeAssessments).where(eq(formativeAssessments.id, existing[0].id));
          }
        } else if (existing.length > 0) {
          await tx
            .update(formativeAssessments)
            .set({
              status: entry.status,
              score: entry.score ?? null,
              notes: entry.notes,
              updatedAt: now,
            })
            .where(eq(formativeAssessments.id, existing[0].id));
        } else {
          await tx.insert(formativeAssessments).values({
            studentId: parsed.data.studentId,
            subjectId: parsed.data.subjectId,
            learningObjectiveId: entry.learningObjectiveId,
            classId: parsed.data.classId,
            semesterId: parsed.data.semesterId,
            status: entry.status,
            score: entry.score ?? null,
            notes: entry.notes,
            updatedAt: now,
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  }

  if (body?.kind === 'cocurricular_score') {
    const schema = z.object({
      projectId: z.number().int().positive(),
      studentId: z.number().int().positive(),
      predicate: z.enum(['Sangat Baik', 'Baik', 'Cukup', 'Perlu Bimbingan']).optional(),
      dimensionScores: z
        .record(z.string(), z.enum(['Sangat Baik', 'Baik', 'Cukup', 'Perlu Bimbingan']))
        .optional(),
      description: z.string().trim().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data nilai kokurikuler tidak valid.' }, { status: 400 });
    }

    const [proj] = await db
      .select()
      .from(cocurricularProjects)
      .where(eq(cocurricularProjects.id, parsed.data.projectId))
      .limit(1);
    if (!proj) {
      return NextResponse.json({ error: 'Kegiatan kokurikuler tidak ditemukan.' }, { status: 404 });
    }
    if (!canTeacherAccessScope(auth.user, proj.classId)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses menilai kokurikuler pada rombel ini.' },
        { status: 403 }
      );
    }

    let finalPredicate = parsed.data.predicate || 'Baik';
    let finalDescription = parsed.data.description || '';
    const dimScores = parsed.data.dimensionScores || {};
    if (Object.keys(dimScores).length > 0) {
      const dims = JSON.parse(proj.dimensionsJson || '[]') as string[];
      const generated = buildCocurricularDescription(dims, dimScores, finalPredicate);
      finalPredicate = generated.predicate;
      if (!finalDescription) finalDescription = generated.description;
    }
    if (!finalDescription) {
      finalDescription = `Ananda menunjukkan capaian ${finalPredicate.toLowerCase()} pada kegiatan kokurikuler.`;
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
        .set({
          predicate: finalPredicate,
          dimensionScoresJson: JSON.stringify(dimScores),
          description: finalDescription,
          updatedAt: now,
        })
        .where(eq(cocurricularScores.id, existing[0].id));
    } else {
      await db.insert(cocurricularScores).values({
        projectId: parsed.data.projectId,
        studentId: parsed.data.studentId,
        predicate: finalPredicate,
        dimensionScoresJson: JSON.stringify(dimScores),
        description: finalDescription,
        updatedAt: now,
      });
    }
    return NextResponse.json({ ok: true, predicate: finalPredicate, description: finalDescription });
  }

  if (body?.kind === 'extracurricular_score') {
    const schema = z.object({
      extracurricularId: z.number().int().positive(),
      studentId: z.number().int().positive(),
      predicate: z.enum(['Sangat Baik', 'Baik', 'Cukup', 'Kurang']).optional(),
      tpScores: z
        .array(
          z.object({
            objective: z.string().trim().min(1),
            predicate: z.enum(['Sangat Baik', 'Baik', 'Cukup', 'Kurang']),
          })
        )
        .optional(),
      description: z.string().trim().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data nilai ekstrakurikuler tidak valid.' }, { status: 400 });
    }

    const tpScoresArr = parsed.data.tpScores || [];
    let finalPredicate = parsed.data.predicate || 'Baik';
    let finalDescription = parsed.data.description || '';
    if (tpScoresArr.length > 0) {
      const generated = buildExtracurricularDescription(tpScoresArr, finalPredicate);
      finalPredicate = generated.predicate;
      if (!finalDescription) finalDescription = generated.description;
    }
    if (!finalDescription) {
      finalDescription = `Ananda ${finalPredicate.toLowerCase()} dalam berpartisipasi aktif pada kegiatan ekstrakurikuler.`;
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
        .set({
          predicate: finalPredicate,
          tpScoresJson: JSON.stringify(tpScoresArr),
          description: finalDescription,
          updatedAt: now,
        })
        .where(eq(extracurricularScores.id, existing[0].id));
    } else {
      await db.insert(extracurricularScores).values({
        extracurricularId: parsed.data.extracurricularId,
        studentId: parsed.data.studentId,
        semesterId: activeSemester.id,
        predicate: finalPredicate,
        tpScoresJson: JSON.stringify(tpScoresArr),
        description: finalDescription,
        updatedAt: now,
      });
    }
    return NextResponse.json({ ok: true, predicate: finalPredicate, description: finalDescription });
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

  if (body?.kind === 'cocurricular_project') {
    const parsed = cocurricularProjectSchema.safeParse({
      ...body,
      id: body?.id ? Number(body.id) : undefined,
      classId: Number(body?.classId),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data kegiatan kokurikuler tidak valid.' },
        { status: 400 }
      );
    }
    if (!canTeacherAccessScope(auth.user, parsed.data.classId)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses mengelola kokurikuler pada rombel ini.' },
        { status: 403 }
      );
    }

    if (parsed.data.id) {
      await db
        .update(cocurricularProjects)
        .set({
          code: parsed.data.code,
          title: parsed.data.title,
          dimensionsJson: JSON.stringify(parsed.data.dimensions),
          description: parsed.data.description,
        })
        .where(eq(cocurricularProjects.id, parsed.data.id));
      await logAudit({
        userId: auth.user.id,
        actorName: auth.user.fullName,
        action: 'UPDATE_COCURRICULAR_PROJECT',
        entityType: 'cocurricular_projects',
        entityId: parsed.data.id,
        details: `Memperbarui kegiatan kokurikuler ${parsed.data.code}.`,
      });
      return NextResponse.json({ ok: true });
    }

    const [created] = await db
      .insert(cocurricularProjects)
      .values({
        classId: parsed.data.classId,
        semesterId: activeSemester.id,
        code: parsed.data.code,
        title: parsed.data.title,
        dimensionsJson: JSON.stringify(parsed.data.dimensions),
        description: parsed.data.description,
      })
      .returning();
    await logAudit({
      userId: auth.user.id,
      actorName: auth.user.fullName,
      action: 'CREATE_COCURRICULAR_PROJECT',
      entityType: 'cocurricular_projects',
      entityId: created.id,
      details: `Menambahkan kegiatan kokurikuler ${created.code} pada kelas ${parsed.data.classId}.`,
    });
    return NextResponse.json({ ok: true, project: created }, { status: 201 });
  }

  if (body?.kind === 'extracurricular') {
    const parsed = extracurricularSchema.safeParse({
      ...body,
      id: body?.id ? Number(body.id) : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data ekstrakurikuler tidak valid.' },
        { status: 400 }
      );
    }

    if (parsed.data.id) {
      const [existing] = await db
        .select()
        .from(extracurriculars)
        .where(eq(extracurriculars.id, parsed.data.id))
        .limit(1);
      if (!existing) {
        return NextResponse.json({ error: 'Ekstrakurikuler tidak ditemukan.' }, { status: 404 });
      }
      await db
        .update(extracurriculars)
        .set({
          name: parsed.data.name,
          instructorName: parsed.data.instructorName || existing.instructorName || '-',
          scheduleDay: parsed.data.scheduleDay || existing.scheduleDay || 'Sabtu',
          learningObjectivesJson:
            parsed.data.learningObjectives !== undefined
              ? JSON.stringify(parsed.data.learningObjectives)
              : existing.learningObjectivesJson,
        })
        .where(eq(extracurriculars.id, parsed.data.id));
      await logAudit({
        userId: auth.user.id,
        actorName: auth.user.fullName,
        action: 'UPDATE_EXTRACURRICULAR',
        entityType: 'extracurriculars',
        entityId: parsed.data.id,
        details: `Memperbarui ekstrakurikuler ${parsed.data.name}.`,
      });
      return NextResponse.json({ ok: true });
    }

    const [created] = await db
      .insert(extracurriculars)
      .values({
        name: parsed.data.name,
        instructorName: parsed.data.instructorName || '-',
        scheduleDay: parsed.data.scheduleDay || 'Sabtu',
        learningObjectivesJson: JSON.stringify(parsed.data.learningObjectives || []),
      })
      .returning();
    await logAudit({
      userId: auth.user.id,
      actorName: auth.user.fullName,
      action: 'CREATE_EXTRACURRICULAR',
      entityType: 'extracurriculars',
      entityId: created.id,
      details: `Menambahkan ekstrakurikuler ${created.name}.`,
    });
    return NextResponse.json({ ok: true, extracurricular: created }, { status: 201 });
  }

  return NextResponse.json({ error: 'Jenis penyimpanan penilaian tidak dikenali.' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, ['penilaian', 'kurikulum'], 'read');
  if ('error' in auth) return auth.error;

  const canDelete =
    hasUserPermission(auth.user, 'kurikulum', 'delete') ||
    hasUserPermission(auth.user, 'penilaian', 'delete');
  if (!canDelete) {
    return NextResponse.json(
      { error: `Akses ditolak: peran ${auth.user.roleName} tidak memiliki izin menghapus data ini.` },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get('kind');
  const idsParam = searchParams.get('ids');
  const singleId = Number(searchParams.get('id') || 0);
  const ids = idsParam
    ? idsParam
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((x) => Number.isInteger(x) && x > 0)
    : singleId > 0
    ? [singleId]
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: 'ID penghapusan tidak valid.' }, { status: 400 });
  }

  const db = getDb();
  if (kind === 'cocurricular_project') {
    const rows = await db
      .select({ id: cocurricularProjects.id, classId: cocurricularProjects.classId })
      .from(cocurricularProjects)
      .where(inArray(cocurricularProjects.id, ids));
    for (const r of rows) {
      if (!canTeacherAccessScope(auth.user, r.classId)) {
        return NextResponse.json(
          { error: 'Anda tidak memiliki akses menghapus kokurikuler rombel ini.' },
          { status: 403 }
        );
      }
    }
    await db.delete(cocurricularProjects).where(inArray(cocurricularProjects.id, ids));
    return NextResponse.json({ ok: true, deleted: ids.length });
  }

  if (kind === 'extracurricular') {
    await db.delete(extracurriculars).where(inArray(extracurriculars.id, ids));
    return NextResponse.json({ ok: true, deleted: ids.length });
  }

  return NextResponse.json({ error: 'Target penghapusan tidak dikenali.' }, { status: 400 });
}
