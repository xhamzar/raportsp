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
  schoolCalendars,
  schools,
  semesters,
  studentAttendance,
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
        notes: teacherJournals.notes,
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

    const stuAttRows = await db
      .select({
        classId: studentAttendance.classId,
        date: studentAttendance.date,
        status: studentAttendance.status,
      })
      .from(studentAttendance)
      .where(
        targetClass
          ? and(
              eq(studentAttendance.classId, targetClass.id),
              eq(studentAttendance.semesterId, activeSemester.id)
            )
          : eq(studentAttendance.semesterId, activeSemester.id)
      );

    const attCountByClassDate = new Map<
      string,
      { H: number; S: number; I: number; A: number }
    >();
    for (const row of stuAttRows) {
      const key = `${row.classId}:${row.date}`;
      const cur = attCountByClassDate.get(key) || { H: 0, S: 0, I: 0, A: 0 };
      if (row.status === 'H') cur.H += 1;
      else if (row.status === 'S') cur.S += 1;
      else if (row.status === 'I') cur.I += 1;
      else if (row.status === 'A') cur.A += 1;
      attCountByClassDate.set(key, cur);
    }

    const enrichedJournals = journals.map((j) => {
      const counts = attCountByClassDate.get(`${j.classId}:${j.date}`) || {
        H: 0,
        S: 0,
        I: 0,
        A: 0,
      };
      return {
        ...j,
        attendanceSummary: `${counts.H}/${counts.S}/${counts.I}/${counts.A}`,
      };
    });

    return NextResponse.json({
      ...baseMeta,
      doc: docParam,
      month: monthParam,
      journals: enrichedJournals,
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
  const [teacherList, assignments, allSemAttRows, travels, calendars] = await Promise.all([
    db.select().from(teachers).where(eq(teachers.isActive, true)).orderBy(asc(teachers.fullName)),
    db
      .select()
      .from(teacherAssignments)
      .where(eq(teacherAssignments.semesterId, activeSemester.id)),
    db
      .select()
      .from(teacherAttendance)
      .where(eq(teacherAttendance.semesterId, activeSemester.id)),
    db.select().from(officialTravels),
    db
      .select()
      .from(schoolCalendars)
      .where(eq(schoolCalendars.semesterId, activeSemester.id)),
  ]);

  const hasExplicitMonth = Boolean(monthParam && /^\d{4}-\d{2}$/.test(monthParam));
  const latestAttDate = allSemAttRows
    .map((r) => r.date)
    .sort()
    .at(-1);
  const resolvedMonth = hasExplicitMonth
    ? monthParam
    : latestAttDate
    ? latestAttDate.slice(0, 7)
    : new Date().toISOString().slice(0, 7);

  const attRows = hasExplicitMonth
    ? allSemAttRows.filter((r) => r.date.startsWith(resolvedMonth))
    : allSemAttRows;

  const monthlyAttRows = allSemAttRows.filter((r) => r.date.startsWith(resolvedMonth));

  const [yearStr, monthStr] = resolvedMonth.split('-');
  const yearNum = Number(yearStr) || new Date().getFullYear();
  const monthNum = Number(monthStr) || new Date().getMonth() + 1;
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

  const dailyCalendar: Array<{
    day: number;
    date: string;
    isWeekend: boolean;
    holidayType: 'weekend' | 'national' | 'semester' | null;
  }> = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
    const dow = new Date(Date.UTC(yearNum, monthNum - 1, d)).getUTCDay();
    const isWeekend = dow === 0 || dow === 6;

    let holidayType: 'weekend' | 'national' | 'semester' | null = isWeekend ? 'weekend' : null;
    for (const cal of calendars) {
      if (cal.isHoliday && dateStr >= cal.startDate && dateStr <= cal.endDate) {
        holidayType = cal.category.toLowerCase().includes('semester') ? 'semester' : 'national';
        break;
      }
    }
    dailyCalendar.push({ day: d, date: dateStr, isWeekend, holidayType });
  }

  const learningDaysCount = dailyCalendar.filter((d) => d.holidayType === null).length;

  const STATUS_ABBR: Record<string, string> = {
    Hadir: 'H',
    Izin: 'I',
    Sakit: 'S',
    'Dinas Luar': 'DL',
    Cuti: 'CT',
    Alpa: 'TK',
  };

  const dailyMatrixRows = teacherList.map((t) => {
    const tAtt = monthlyAttRows.filter((r) => r.teacherId === t.id);
    const dailyStatuses: Record<number, string> = {};
    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let dinasLuar = 0;
    let cuti = 0;
    let alpa = 0;

    for (const r of tAtt) {
      const dayNum = Number(r.date.slice(8, 10));
      const abbr = STATUS_ABBR[r.status] || '';
      if (dayNum >= 1 && dayNum <= daysInMonth && abbr) {
        dailyStatuses[dayNum] = abbr;
      }
      if (abbr === 'H') hadir += 1;
      else if (abbr === 'I') izin += 1;
      else if (abbr === 'S') sakit += 1;
      else if (abbr === 'DL') dinasLuar += 1;
      else if (abbr === 'CT') cuti += 1;
      else if (abbr === 'TK') alpa += 1;
    }

    return {
      teacherId: t.id,
      fullName: t.fullName,
      nip: t.nip || '-',
      gender: t.gender || 'L',
      education: t.education || '-',
      specialization: t.specialization || 'Guru',
      employmentStatus: t.employmentStatus || 'PNS',
      dailyStatuses,
      counts: { hadir, izin, sakit, dinasLuar, cuti, alpa },
    };
  });

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
    resolvedMonth,
    learningDaysCount,
    dailyCalendar,
    dailyMatrixRows,
    effectiveWorkDays: metrics.effectiveWorkDays,
    teacherSummary: metrics.rows,
    recentAttendanceLogs: recentLogs,
  });
}
