export interface RawStudentScoreRow {
  studentId: number;
  nisn: string;
  nis: string;
  fullName: string;
  gender: string;
  birthPlace: string;
  birthDate: string;
  religion: string;
  address: string | null;
  previousSchool: string | null;
  enrollmentDate: string;
  fatherName: string | null;
  fatherJob: string | null;
  motherName: string | null;
  motherJob: string | null;
  parentPhone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
}

export interface RankedStudentEntry {
  rank: number;
  studentId: number;
  nisn: string;
  nis: string;
  fullName: string;
  totalScore: number;
  subjectCount: number;
  averageScore: number;
  achievementPredicate: string;
  cocurricularNotes: string;
}

export function computeClassRanking(
  roster: Array<{ studentId: number; nisn: string; nis: string; fullName: string }>,
  scoreRows: Array<{ studentId: number; finalScore: number | null }>,
  cocurricularRows: Array<{ studentId: number; title: string; predicate: string }>
): RankedStudentEntry[] {
  const scoresByStudent = new Map<number, number[]>();
  for (const row of scoreRows) {
    if (typeof row.finalScore === 'number' && Number.isFinite(row.finalScore)) {
      const arr = scoresByStudent.get(row.studentId) || [];
      arr.push(row.finalScore);
      scoresByStudent.set(row.studentId, arr);
    }
  }

  const cocuByStudent = new Map<number, string[]>();
  for (const c of cocurricularRows) {
    if (c.predicate) {
      const arr = cocuByStudent.get(c.studentId) || [];
      arr.push(`${c.title} (${c.predicate})`);
      cocuByStudent.set(c.studentId, arr);
    }
  }

  const computed = roster.map((stu) => {
    const vals = scoresByStudent.get(stu.studentId) || [];
    const totalScore = Number(vals.reduce((a, b) => a + b, 0).toFixed(2));
    const subjectCount = vals.length;
    const averageScore =
      subjectCount > 0 ? Number((totalScore / subjectCount).toFixed(2)) : 0;

    let achievementPredicate = 'Peserta Didik Aktif';
    if (averageScore >= 90) achievementPredicate = 'Sangat Memuaskan (Cumlaude Sekolah)';
    else if (averageScore >= 82) achievementPredicate = 'Memuaskan';
    else if (averageScore >= 75) achievementPredicate = 'Baik';

    return {
      studentId: stu.studentId,
      nisn: stu.nisn,
      nis: stu.nis,
      fullName: stu.fullName,
      totalScore,
      subjectCount,
      averageScore,
      achievementPredicate,
      cocurricularNotes: (cocuByStudent.get(stu.studentId) || []).slice(0, 2).join('; '),
    };
  });

  computed.sort((a, b) => {
    if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.fullName.localeCompare(b.fullName, 'id');
  });

  let currentRank = 0;
  let lastAvg = -1;
  return computed.map((item, idx) => {
    if (item.averageScore !== lastAvg) {
      currentRank = idx + 1;
      lastAvg = item.averageScore;
    }
    return {
      rank: currentRank,
      ...item,
    };
  });
}

export interface TeacherTppSummaryRow {
  teacherId: number;
  fullName: string;
  nip: string;
  nuptk: string;
  employmentStatus: string;
  specialization: string;
  weeklyHours: number;
  hadir: number;
  tepatWaktu: number;
  terlambat: number;
  sakit: number;
  izin: number;
  alpa: number;
  dinasLuar: number;
  approvedTravelsCount: number;
  recordedDays: number;
  effectiveWorkDays: number;
  attendancePercent: number;
  tppDisciplineScore: number;
  tppCategory: string;
}

export function computeTppDisciplineMetrics(params: {
  teachers: Array<{
    id: number;
    fullName: string;
    nip: string | null;
    nuptk: string | null;
    employmentStatus: string;
    specialization: string;
  }>;
  weeklyHoursByTeacher: Map<number, number>;
  attendanceRows: Array<{
    teacherId: number;
    date: string;
    status: string;
    checkInTime: string | null;
  }>;
  approvedTravelsByTeacher: Map<number, number>;
  lateThreshold?: string;
}): {
  effectiveWorkDays: number;
  rows: TeacherTppSummaryRow[];
} {
  const lateThreshold = params.lateThreshold || '07:15';
  const distinctDates = new Set(params.attendanceRows.map((r) => r.date));
  const effectiveWorkDays = distinctDates.size > 0 ? distinctDates.size : 22;

  const attByTeacher = new Map<
    number,
    Array<{ date: string; status: string; checkInTime: string | null }>
  >();
  for (const r of params.attendanceRows) {
    const arr = attByTeacher.get(r.teacherId) || [];
    arr.push(r);
    attByTeacher.set(r.teacherId, arr);
  }

  const rows: TeacherTppSummaryRow[] = params.teachers.map((t) => {
    const myRows = attByTeacher.get(t.id) || [];
    let hadir = 0;
    let tepatWaktu = 0;
    let terlambat = 0;
    let sakit = 0;
    let izin = 0;
    let alpa = 0;
    let dinasLuar = 0;

    for (const r of myRows) {
      if (r.status === 'Hadir') {
        hadir += 1;
        const tStr = (r.checkInTime || '').trim();
        if (tStr && tStr > lateThreshold) {
          terlambat += 1;
        } else {
          tepatWaktu += 1;
        }
      } else if (r.status === 'Sakit') {
        sakit += 1;
      } else if (r.status === 'Izin') {
        izin += 1;
      } else if (r.status === 'Alpa') {
        alpa += 1;
      } else if (r.status === 'Dinas Luar') {
        dinasLuar += 1;
      }
    }

    const approvedTravelsCount = params.approvedTravelsByTeacher.get(t.id) || 0;
    const recordedDays = myRows.length;
    const denom = effectiveWorkDays > 0 ? effectiveWorkDays : 1;

    // Kehadiran murni (Hadir + Dinas Luar terhadap hari kerja efektif)
    const activePresence = hadir + dinasLuar;
    const attendancePercent = Number(
      Math.min(100, Math.max(0, (activePresence / denom) * 100)).toFixed(1)
    );

    // Indeks Disiplin TPP:
    // Hadir/Dinas Luar = 1.0 bobot, Sakit/Izin = 0.5 bobot, keterlambatan mengurangi 0.15/hari, Alpa = 0
    const weightedPoints = Math.max(
      0,
      hadir + dinasLuar + (sakit + izin) * 0.5 - terlambat * 0.15
    );
    const tppDisciplineScore =
      recordedDays === 0
        ? 0
        : Number(Math.min(100, Math.max(0, (weightedPoints / denom) * 100)).toFixed(1));

    let tppCategory = 'Belum Ada Data';
    if (recordedDays > 0) {
      if (tppDisciplineScore >= 95) tppCategory = 'Sangat Baik (100% TPP)';
      else if (tppDisciplineScore >= 85) tppCategory = 'Baik (90% TPP)';
      else if (tppDisciplineScore >= 75) tppCategory = 'Cukup (80% TPP)';
      else tppCategory = 'Perlu Pembinaan';
    }

    return {
      teacherId: t.id,
      fullName: t.fullName,
      nip: t.nip || '-',
      nuptk: t.nuptk || '-',
      employmentStatus: t.employmentStatus,
      specialization: t.specialization,
      weeklyHours: params.weeklyHoursByTeacher.get(t.id) || 0,
      hadir,
      tepatWaktu,
      terlambat,
      sakit,
      izin,
      alpa,
      dinasLuar,
      approvedTravelsCount,
      recordedDays,
      effectiveWorkDays,
      attendancePercent,
      tppDisciplineScore,
      tppCategory,
    };
  });

  return { effectiveWorkDays, rows };
}
