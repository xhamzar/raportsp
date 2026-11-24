import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  academicYears,
  classes,
  classStudents,
  cocurricularProjects,
  cocurricularScores,
  extracurriculars,
  extracurricularScores,
  formativeAssessments,
  homeroomNotes,
  keasramaanIndicators,
  keasramaanScores,
  learningObjectives,
  schools,
  semesters,
  studentAttendance,
  students,
  subjects,
  summativeScores,
  teachers,
} from '@/lib/server/db/schema';
import { buildCompetencyParts } from '@/lib/server/services/assessment-engine';
import { canTeacherAccessScope, requireApiAuth } from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'rapor', 'read');
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const classIdParam = Number(searchParams.get('classId') || 0);
  const studentIdParam = Number(searchParams.get('studentId') || 0);

  const db = getDb();
  const [school] = await db.select().from(schools).limit(1);
  const [activeYear] = await db
    .select()
    .from(academicYears)
    .where(eq(academicYears.isActive, true))
    .limit(1);
  const [activeSemester] = await db
    .select()
    .from(semesters)
    .where(eq(semesters.isActive, true))
    .limit(1);

  const allClasses = await db
    .select({
      id: classes.id,
      name: classes.name,
      gradeLevel: classes.gradeLevel,
      fase: classes.fase,
      homeroomTeacherId: classes.homeroomTeacherId,
      homeroomTeacherName: teachers.fullName,
      homeroomTeacherNip: teachers.nip,
    })
    .from(classes)
    .leftJoin(teachers, eq(classes.homeroomTeacherId, teachers.id));

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
    return NextResponse.json(
      { error: 'Anda tidak memiliki akses rapor untuk rombel ini.' },
      { status: 403 }
    );
  }

  let roster = await db
    .select({
      id: students.id,
      nisn: students.nisn,
      nis: students.nis,
      fullName: students.fullName,
      gender: students.gender,
      birthPlace: students.birthPlace,
      birthDate: students.birthDate,
      religion: students.religion,
      address: students.address,
      fatherName: students.fatherName,
      motherName: students.motherName,
    })
    .from(classStudents)
    .innerJoin(students, eq(classStudents.studentId, students.id))
    .where(and(eq(classStudents.classId, cls.id), eq(classStudents.semesterId, activeSemester.id)))
    .orderBy(asc(students.fullName));

  if (studentIdParam) {
    roster = roster.filter((s) => s.id === studentIdParam);
  }

  const classSubjects = await db
    .select()
    .from(subjects)
    .where(eq(subjects.gradeLevel, cls.gradeLevel))
    .orderBy(asc(subjects.sortOrder));

  const [
    tps,
    formRows,
    sumRows,
    attRows,
    cocuProjs,
    cocuSc,
    eksList,
    eksSc,
    notesRows,
    keasInds,
    keasSc,
  ] = await Promise.all([
    db.select().from(learningObjectives),
    db
      .select()
      .from(formativeAssessments)
      .where(
        and(
          eq(formativeAssessments.classId, cls.id),
          eq(formativeAssessments.semesterId, activeSemester.id)
        )
      ),
    db
      .select()
      .from(summativeScores)
      .where(
        and(
          eq(summativeScores.classId, cls.id),
          eq(summativeScores.semesterId, activeSemester.id)
        )
      ),
    db
      .select()
      .from(studentAttendance)
      .where(
        and(
          eq(studentAttendance.classId, cls.id),
          eq(studentAttendance.semesterId, activeSemester.id)
        )
      ),
    db.select().from(cocurricularProjects).where(eq(cocurricularProjects.classId, cls.id)),
    db.select().from(cocurricularScores),
    db.select().from(extracurriculars),
    db
      .select()
      .from(extracurricularScores)
      .where(eq(extracurricularScores.semesterId, activeSemester.id)),
    db
      .select()
      .from(homeroomNotes)
      .where(
        and(eq(homeroomNotes.classId, cls.id), eq(homeroomNotes.semesterId, activeSemester.id))
      ),
    school?.enableKeasramaan
      ? db
          .select()
          .from(keasramaanIndicators)
          .where(eq(keasramaanIndicators.isActive, true))
          .orderBy(asc(keasramaanIndicators.category), asc(keasramaanIndicators.sortOrder))
      : Promise.resolve([]),
    school?.enableKeasramaan
      ? db
          .select()
          .from(keasramaanScores)
          .where(eq(keasramaanScores.semesterId, activeSemester.id))
      : Promise.resolve([]),
  ]);

  // Pre-index lookup tables in O(1) Maps
  const sumMap = new Map(sumRows.map((x) => [`${x.studentId}:${x.subjectId}`, x]));
  const tpsBySubject = new Map<number, typeof tps>();
  for (const tp of tps) {
    const arr = tpsBySubject.get(tp.subjectId) || [];
    arr.push(tp);
    tpsBySubject.set(tp.subjectId, arr);
  }
  const formMap = new Map(
    formRows.map((f) => [`${f.studentId}:${f.subjectId}:${f.learningObjectiveId}`, f])
  );
  const cocuMap = new Map(cocuSc.map((c) => [`${c.projectId}:${c.studentId}`, c]));
  const eksById = new Map(eksList.map((x) => [x.id, x]));
  const eksByStudent = new Map<number, typeof eksSc>();
  for (const e of eksSc) {
    const arr = eksByStudent.get(e.studentId) || [];
    arr.push(e);
    eksByStudent.set(e.studentId, arr);
  }
  const attSummaryMap = new Map<
    number,
    { hadir: number; sakit: number; izin: number; alpa: number }
  >();
  for (const a of attRows) {
    const cur = attSummaryMap.get(a.studentId) || { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
    if (a.status === 'H') cur.hadir += 1;
    else if (a.status === 'S') cur.sakit += 1;
    else if (a.status === 'I') cur.izin += 1;
    else if (a.status === 'A') cur.alpa += 1;
    attSummaryMap.set(a.studentId, cur);
  }
  const noteByStudent = new Map(notesRows.map((n) => [n.studentId, n]));
  const keasMap = new Map(keasSc.map((k) => [`${k.studentId}:${k.indicatorId}`, k]));

  const isGrade6 = cls.gradeLevel === 6;
  const availableDecisions = isGrade6
    ? ['Lulus', 'Tidak Lulus']
    : ['Naik Kelas', 'Tinggal Kelas'];

  const reports = roster.map((stu) => {
    const subjectGrades = classSubjects.map((sub, idx) => {
      const sc = sumMap.get(`${stu.id}:${sub.id}`);
      const myTps = tpsBySubject.get(sub.id) || [];

      const achieved: string[] = [];
      const needsGuidance: string[] = [];
      for (const tp of myTps) {
        const rec = formMap.get(`${stu.id}:${sub.id}:${tp.id}`);
        if (rec?.status === 'Tercapai') achieved.push(tp.scopeMaterial.toLowerCase());
        else if (rec?.status === 'Perlu Bimbingan' || rec?.status === 'Perlu Pendalaman') {
          needsGuidance.push(tp.scopeMaterial.toLowerCase());
        }
      }

      const parts = buildCompetencyParts({
        studentName: stu.fullName,
        subjectName: sub.name,
        achievedMaterials: achieved,
        needsGuidanceMaterials: needsGuidance,
        finalScore: sc?.finalScore ?? null,
      });

      const finalScoreRounded =
        sc?.finalScore !== null && sc?.finalScore !== undefined
          ? Math.round(sc.finalScore)
          : null;

      return {
        no: idx + 1,
        subjectId: sub.id,
        subjectName: sub.name,
        category: sub.category,
        finalScore: finalScoreRounded,
        competencyDescription: parts.fullText,
        achievedParagraph: parts.achievedText,
        needsGuidanceParagraph: parts.needsGuidanceText,
      };
    });

    const myCocu = cocuProjs.map((p) => {
      const sc = cocuMap.get(`${p.id}:${stu.id}`);
      return {
        code: p.code,
        title: p.title,
        predicate: sc?.predicate || 'Baik',
        description: sc?.description || '-',
      };
    });

    const myEks = (eksByStudent.get(stu.id) || []).map((e) => {
      const info = eksById.get(e.extracurricularId);
      return {
        name: info?.name || 'Ekstrakurikuler',
        predicate: e.predicate,
        description: e.description,
      };
    });

    const attendance = attSummaryMap.get(stu.id) || {
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpa: 0,
    };

    const noteObj = noteByStudent.get(stu.id);

    let waliAsramaName = 'Pembina Asrama';
    let waliAsuhName = 'Wali Asuh';
    const keasramaan = keasInds.map((ind, idx) => {
      const ks = keasMap.get(`${stu.id}:${ind.id}`);
      if (ks?.waliAsramaName) waliAsramaName = ks.waliAsramaName;
      if (ks?.waliAsuhName) waliAsuhName = ks.waliAsuhName;
      return {
        no: idx + 1,
        indicatorId: ind.id,
        category: ind.category,
        name: ind.name,
        predicate: ks?.predicate || 'B',
        achievedNote:
          ks?.achievedDescription ||
          `Ananda menunjukkan capaian baik pada aspek ${ind.name.toLowerCase()}.`,
        guidanceNote: ks?.guidanceDescription || '',
        notes: '',
      };
    });

    return {
      student: stu,
      subjectGrades,
      cocurriculars: myCocu,
      extracurriculars: myEks,
      attendance,
      homeroomNote:
        noteObj?.note ||
        'Ananda menunjukkan perkembangan belajar yang baik selama semester ini. Pertahankan semangat dan kedisiplinan.',
      promotionDecision: noteObj?.promotionDecision || (isGrade6 ? 'Lulus' : 'Naik Kelas'),
      availableDecisions,
      keasramaan,
      keasramaanSigners: {
        waliAsramaName,
        waliAsuhName,
      },
    };
  });

  return NextResponse.json({
    school,
    academicYear: activeYear,
    semester: activeSemester,
    class: cls,
    availableDecisions,
    keasramaanEnabled: Boolean(school?.enableKeasramaan),
    keasramaanIndicators: keasInds,
    reports,
  });
}
