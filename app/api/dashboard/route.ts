import { NextRequest, NextResponse } from 'next/server';
import { desc, eq, and } from 'drizzle-orm';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  schools,
  academicYears,
  semesters,
  classes,
  classStudents,
  students,
  teachers,
  subjects,
  studentAttendance,
  teacherAttendance,
  summativeScores,
  cocurricularProjects,
  extracurriculars,
  auditLogs,
  dapodikConfig,
  dapodikSubmissionLogs,
  notifications,
} from '@/lib/server/db/schema';
import { canTeacherAccessScope, requireApiAuth } from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'dashboard', 'read');
  if ('error' in auth) return auth.error;

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const classIdParam = searchParams.get('classId');

  if (classIdParam && !canTeacherAccessScope(auth.user, Number(classIdParam))) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki akses dasbor untuk rombel ini.' },
      { status: 403 }
    );
  }

  const [school] = await db.select().from(schools).limit(1);
  const [activeYear] = await db.select().from(academicYears).where(eq(academicYears.isActive, true)).limit(1);
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);

  const allClasses = await db.select().from(classes);
  const semesterClasses = activeSemester
    ? allClasses.filter((c) => c.semesterId === activeSemester.id)
    : allClasses;

  const visibleClasses = auth.user.hasFullScope
    ? semesterClasses
    : semesterClasses.filter((c) => auth.user.assignedClassIds.includes(c.id));

  const selectedClass =
    (classIdParam ? visibleClasses.find((c) => c.id === Number(classIdParam)) : null) ||
    visibleClasses.find((c) => c.name === '4 A') ||
    visibleClasses[0] ||
    null;

  const allStudents = await db.select().from(students).where(eq(students.status, 'Aktif'));
  const allTeachers = await db.select().from(teachers).where(eq(teachers.isActive, true));
  const allSubjects = await db.select().from(subjects);

  const classRoster = selectedClass
    ? await db
        .select({ studentId: classStudents.studentId })
        .from(classStudents)
        .where(
          and(
            eq(classStudents.classId, selectedClass.id),
            eq(classStudents.semesterId, activeSemester?.id ?? selectedClass.semesterId)
          )
        )
    : [];

  const classSubjects = selectedClass
    ? allSubjects.filter((s) => s.gradeLevel === selectedClass.gradeLevel)
    : allSubjects;

  const attRows = activeSemester
    ? await db
        .select()
        .from(studentAttendance)
        .where(eq(studentAttendance.semesterId, activeSemester.id))
    : [];

  const attCounts = { H: 0, S: 0, I: 0, A: 0 };
  for (const r of attRows) {
    if (r.status === 'H') attCounts.H++;
    else if (r.status === 'S') attCounts.S++;
    else if (r.status === 'I') attCounts.I++;
    else if (r.status === 'A') attCounts.A++;
  }

  const teacherAttRows = activeSemester
    ? await db
        .select()
        .from(teacherAttendance)
        .where(eq(teacherAttendance.semesterId, activeSemester.id))
    : [];
  const teacherPresent = teacherAttRows.filter((t) => t.status === 'Hadir').length;

  // Assessment completion for selected class
  const classScores = selectedClass
    ? await db
        .select()
        .from(summativeScores)
        .where(
          and(
            eq(summativeScores.classId, selectedClass.id),
            eq(summativeScores.semesterId, activeSemester?.id ?? selectedClass.semesterId)
          )
        )
    : [];
  const expectedScoreCells = classRoster.length * classSubjects.length;
  const filledFinalScores = classScores.filter((s) => s.finalScore !== null).length;
  const assessmentCompletionPct =
    expectedScoreCells > 0 ? Math.min(100, Math.round((filledFinalScores / expectedScoreCells) * 100)) : 0;

  // Report readiness: students who have at least 1 finalScore
  const scoredStudentSet = new Set(classScores.filter((s) => s.finalScore !== null).map((s) => s.studentId));
  const reportCompletionPct =
    classRoster.length > 0 ? Math.round((scoredStudentSet.size / classRoster.length) * 100) : 0;

  // Grade distribution across classes for chart
  const allEnrollments = activeSemester
    ? await db
        .select({ classId: classStudents.classId, studentId: classStudents.studentId })
        .from(classStudents)
        .where(eq(classStudents.semesterId, activeSemester.id))
    : [];

  const classDistribution = semesterClasses
    .sort((a, b) => a.gradeLevel - b.gradeLevel)
    .map((cls) => {
      const count = allEnrollments.filter((e) => e.classId === cls.id).length;
      return { className: cls.name, gradeLevel: cls.gradeLevel, students: count };
    });

  // Subject averages for selected class chart
  const subjectPerformance = classSubjects.map((sub) => {
    const subScores = classScores
      .filter((s) => s.subjectId === sub.id && typeof s.finalScore === 'number')
      .map((s) => s.finalScore as number);
    const avg =
      subScores.length > 0
        ? Number((subScores.reduce((a, b) => a + b, 0) / subScores.length).toFixed(1))
        : 0;
    return { code: sub.code.split('-')[0], name: sub.name, average: avg };
  });

  const cocuCount = selectedClass
    ? (
        await db
          .select()
          .from(cocurricularProjects)
          .where(eq(cocurricularProjects.classId, selectedClass.id))
      ).length
    : 0;
  const ekstraCount = (await db.select().from(extracurriculars)).length;

  const [dapodik] = await db.select().from(dapodikConfig).limit(1);
  const pendingSubmissions = Math.max(0, classSubjects.length - (await db.select().from(dapodikSubmissionLogs)).length);
  const recentActivities = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(8);
  const recentNotifications = await db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(5);

  return NextResponse.json({
    school,
    activeYear,
    activeSemester,
    selectedClass,
    stats: {
      totalStudents: allStudents.length,
      classStudentsCount: classRoster.length,
      totalTeachers: allTeachers.length,
      totalClasses: semesterClasses.length,
      totalSubjects: classSubjects.length,
      mandatorySubjects: classSubjects.filter((s) => s.category === 'Wajib').length,
      cocurricularCount: cocuCount,
      extracurricularCount: ekstraCount,
      studentAttendance: attCounts,
      studentAttendanceRate:
        attRows.length > 0 ? Math.round((attCounts.H / attRows.length) * 100) : 100,
      teacherAttendanceRate:
        teacherAttRows.length > 0 ? Math.round((teacherPresent / teacherAttRows.length) * 100) : 100,
      assessmentCompletionPct,
      reportCompletionPct,
      dapodikStatus: dapodik?.connectionStatus || 'Belum Terhubung',
      dapodikLastSync: dapodik?.lastSyncAt || null,
      pendingSyncTasks: pendingSubmissions,
    },
    charts: {
      classDistribution,
      subjectPerformance,
    },
    recentActivities,
    recentNotifications,
  });
}
