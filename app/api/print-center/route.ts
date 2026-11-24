import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq, like } from 'drizzle-orm';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  academicYears,
  classes,
  classStudents,
  cocurricularProjects,
  cocurricularScores,
  guestbookEntries,
  officialTravels,
  schools,
  semesters,
  students,
  subjects,
  summativeScores,
  teacherAssignments,
  teacherAttendance,
  teacherJournals,
  teachers,
} from '@/lib/server/db/schema';
import {
  canTeacherAccessScope,
  getAuthenticatedUser,
  hasUserPermission,
} from '@/lib/server/auth/session';
import {
  computeClassRanking,
  computeTppDisciplineMetrics,
} from '@/lib/server/services/print-metrics';
import type { ActionName, ModuleName } from '@/lib/auth/rbac-constants';

type PrintDocKey =
  | 'cover'
  | 'biodata'
  | 'rapor'
  | 'piagam'
  | 'keasramaan'
  | 'jurnal'
  | 'buku_tamu'
  | 'presensi_guru'
  | 'laporan_tpp';

const DOC_REQUIRED_MODULES: Record<PrintDocKey, ModuleName[]> = {
  cover: ['rapor'],
  biodata: ['rapor'],
  rapor: ['rapor'],
  piagam: ['rapor'],
  keasramaan: ['keasramaan', 'rapor'],
  jurnal: ['kurikulum'],
  buku_tamu: ['administrasi'],
  presensi_guru: ['absensi', 'guru'],
  laporan_tpp: ['absensi', 'guru'],
};

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Sesi belum masuk. Silakan login terlebih dahulu.' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const docParam = (searchParams.get('doc') || 'rapor') as PrintDocKey;
  const classIdParam = Number(searchParams.get('classId') || 0);
  const monthParam = (searchParams.get('month') || '').trim(); // optional YYYY-MM

  const requiredModules = DOC_REQUIRED_MODULES[docParam];
  if (!requiredModules) {
    return NextResponse.json({ error: 'Jenis dokumen cetak tidak dikenali.' }, { status: 400 });
  }

  const hasAnyModulePermission = (modules: ModuleName[], action: ActionName = 'read') =>
    modules.some((mod) => hasUserPermission(user, mod, action));

  if (!hasAnyModulePermission(requiredModules, 'read')) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki izin mengakses dokumen cetak ini.' },
      { status: 403 }
    );
  }

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

  if (docParam === 'keasramaan' && !school?.enableKeasramaan) {
    return NextResponse.json(
      { error: 'Modul Keasramaan belum diaktifkan pada Pengaturan Sekolah.' },
      { status: 403 }
    );
  }

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
    .leftJoin(teachers, eq(classes.homeroomTeacherId, teachers.id))
    .orderBy(asc(classes.gradeLevel), asc(classes.name));

  const scopedClasses = user.hasFullScope
    ? allClasses
    : allClasses.filter((c) => user.assignedClassIds.includes(c.id));

  const targetClass = classIdParam
    ? allClasses.find((c) => c.id === classIdParam)
    : scopedClasses.find((c) => c.name === '4 A') || scopedClasses[0] || allClasses[0];

  const availableDocs: PrintDocKey[] = (
    Object.keys(DOC_REQUIRED_MODULES) as PrintDocKey[]
  ).filter((key) => {
    if (key === 'keasramaan' && !school?.enableKeasramaan) return false;
    return hasAnyModulePermission(DOC_REQUIRED_MODULES[key], 'read');
  });

  const baseMeta = {
    school,
    academicYear: activeYear,
    semester: activeSemester,
    class: targetClass || null,
    classes: scopedClasses,
    availableDocs,
    canExport:
      hasUserPermission(user, requiredModules[0], 'export') ||
      hasAnyModulePermission(requiredModules, 'read'),
  };

  // Class-scoped student documents: cover, biodata, piagam
  if (docParam === 'cover' || docParam === 'biodata' || docParam === 'piagam') {
    if (!targetClass) {
      return NextResponse.json({ error: 'Rombel tidak ditemukan.' }, { status: 404 });
    }
    if (!canTeacherAccessScope(user, targetClass.id)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses ke rombel ini.' },
        { status: 403 }
      );
    }

    const rosterRows = await db
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
        rtRw: students.rtRw,
        village: students.village,
        district: students.district,
        regency: students.regency,
        province: students.province,
        postalCode: students.postalCode,
        photoPath: students.photoPath,
        updatedAt: students.updatedAt,
        phone: students.phone,
        previousSchool: students.previousSchool,
        enrollmentDate: students.enrollmentDate,
        fatherName: students.fatherName,
        fatherJob: students.fatherJob,
        motherName: students.motherName,
        motherJob: students.motherJob,
        parentPhone: students.parentPhone,
        guardianName: students.guardianName,
        guardianRelation: students.guardianRelation,
        guardianPhone: students.guardianPhone,
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

    const roster = rosterRows.map((s) => ({
      ...s,
      photoUrl: s.photoPath
        ? `/api/students/${s.id}/photo?v=${encodeURIComponent(s.updatedAt)}`
        : null,
    }));

    if (docParam === 'piagam') {
      const [sumRows, cocuProjects, cocuSc] = await Promise.all([
        db
          .select({
            studentId: summativeScores.studentId,
            finalScore: summativeScores.finalScore,
          })
          .from(summativeScores)
          .where(
            and(
              eq(summativeScores.classId, targetClass.id),
              eq(summativeScores.semesterId, activeSemester.id)
            )
          ),
        db
          .select()
          .from(cocurricularProjects)
          .where(eq(cocurricularProjects.classId, targetClass.id)),
        db.select().from(cocurricularScores),
      ]);

      const projTitleMap = new Map(cocuProjects.map((p) => [p.id, p.title]));
      const cocuRows = cocuSc
        .filter((c) => projTitleMap.has(c.projectId))
        .map((c) => ({
          studentId: c.studentId,
          title: projTitleMap.get(c.projectId) || 'Kokurikuler',
          predicate: c.predicate,
        }));

      const rankings = computeClassRanking(
        roster.map((r) => ({
          studentId: r.id,
          nisn: r.nisn,
          nis: r.nis,
          fullName: r.fullName,
        })),
        sumRows,
        cocuRows
      );

      return NextResponse.json({
        ...baseMeta,
        doc: docParam,
        students: roster,
        rankings,
      });
    }

    return NextResponse.json({
      ...baseMeta,
      doc: docParam,
      students: roster,
    });
  }

  // Jurnal Mengajar archive
  if (docParam === 'jurnal') {
    const conds = [];
    if (targetClass) {
      if (!canTeacherAccessScope(user, targetClass.id)) {
        return NextResponse.json(
          { error: 'Anda tidak memiliki akses jurnal rombel ini.' },
          { status: 403 }
        );
      }
      conds.push(eq(teacherJournals.classId, targetClass.id));
    }
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      conds.push(like(teacherJournals.date, `${monthParam}%`));
    }

    let journals = await db
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
      })
      .from(teacherJournals)
      .innerJoin(teachers, eq(teacherJournals.teacherId, teachers.id))
      .innerJoin(classes, eq(teacherJournals.classId, classes.id))
      .innerJoin(subjects, eq(teacherJournals.subjectId, subjects.id))
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(asc(teacherJournals.date), asc(teacherJournals.id));

    if (!user.hasFullScope) {
      journals = journals.filter((j) => canTeacherAccessScope(user, j.classId, j.subjectId));
    }

    return NextResponse.json({
      ...baseMeta,
      doc: docParam,
      month: monthParam,
      journals,
    });
  }

  // Buku Tamu archive
  if (docParam === 'buku_tamu') {
    const guests = await db
      .select()
      .from(guestbookEntries)
      .where(
        monthParam && /^\d{4}-\d{2}$/.test(monthParam)
          ? like(guestbookEntries.visitDate, `${monthParam}%`)
          : undefined
      )
      .orderBy(desc(guestbookEntries.visitDate), desc(guestbookEntries.id));

    return NextResponse.json({
      ...baseMeta,
      doc: docParam,
      month: monthParam,
      guests,
    });
  }

  // Presensi Guru & Laporan TPP
  const [teacherList, assignments, attRows, travels] = await Promise.all([
    db.select().from(teachers).where(eq(teachers.isActive, true)).orderBy(asc(teachers.fullName)),
    db
      .select()
      .from(teacherAssignments)
      .where(eq(teacherAssignments.semesterId, activeSemester.id)),
    db
      .select()
      .from(teacherAttendance)
      .where(
        monthParam && /^\d{4}-\d{2}$/.test(monthParam)
          ? like(teacherAttendance.date, `${monthParam}%`)
          : eq(teacherAttendance.semesterId, activeSemester.id)
      ),
    db.select().from(officialTravels),
  ]);

  const weeklyHoursByTeacher = new Map<number, number>();
  for (const a of assignments) {
    weeklyHoursByTeacher.set(
      a.teacherId,
      (weeklyHoursByTeacher.get(a.teacherId) || 0) + a.weeklyHours
    );
  }

  const approvedTravelsByTeacher = new Map<number, number>();
  for (const tr of travels) {
    if (tr.status === 'Disetujui' || tr.status === 'Selesai') {
      if (!monthParam || tr.startDate.startsWith(monthParam)) {
        approvedTravelsByTeacher.set(
          tr.teacherId,
          (approvedTravelsByTeacher.get(tr.teacherId) || 0) + 1
        );
      }
    }
  }

  const metrics = computeTppDisciplineMetrics({
    teachers: teacherList,
    weeklyHoursByTeacher,
    attendanceRows: attRows,
    approvedTravelsByTeacher,
  });

  const teacherNameById = new Map(teacherList.map((t) => [t.id, t]));
  const recentLogs = attRows
    .slice()
    .sort((a, b) => (b.date > a.date ? 1 : -1))
    .slice(0, 60)
    .map((r) => ({
      id: r.id,
      date: r.date,
      teacherName: teacherNameById.get(r.teacherId)?.fullName || 'Guru',
      nip: teacherNameById.get(r.teacherId)?.nip || '-',
      status: r.status,
      checkInTime: r.checkInTime || '-',
      notes: r.notes || '-',
    }));

  return NextResponse.json({
    ...baseMeta,
    doc: docParam,
    month: monthParam,
    effectiveWorkDays: metrics.effectiveWorkDays,
    teacherSummary: metrics.rows,
    recentAttendanceLogs: recentLogs,
  });
}
