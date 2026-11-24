import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  academicYears,
  assessmentWeights,
  classes,
  classStudents,
  cocurricularProjects,
  cocurricularScores,
  extracurricularScores,
  schools,
  semesters,
  studentAttendance,
  students,
  subjects,
  summativeScores,
} from '@/lib/server/db/schema';
import { calculateSummativeScores } from '@/lib/server/services/assessment-engine';
import {
  generateLegerWorkbook,
  generateSummativeTemplateWorkbook,
} from '@/lib/server/services/excel-service';
import { canTeacherAccessScope, logAudit, requireApiAuth } from '@/lib/server/auth/session';
import { sanitizeFilename } from '@/lib/utils/sanitize';

const MAX_EXCEL_BYTES = 5 * 1024 * 1024;
function isAllowedExcelFile(fileName: string): boolean {
  return /\.(xlsx|xlsm)$/i.test(fileName.trim());
}

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'penilaian', 'export');
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') || 'leger';
  const classId = Number(searchParams.get('classId') || 0);
  const subjectId = Number(searchParams.get('subjectId') || 0);

  const db = getDb();
  const [school] = await db.select().from(schools).limit(1);
  const [activeYear] = await db.select().from(academicYears).where(eq(academicYears.isActive, true)).limit(1);
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);

  const allClasses = await db.select().from(classes).orderBy(asc(classes.gradeLevel));
  const scopedClasses = auth.user.hasFullScope
    ? allClasses
    : allClasses.filter((c) => auth.user.assignedClassIds.includes(c.id));

  const cls = classId
    ? allClasses.find((c) => c.id === classId)
    : scopedClasses.find((c) => c.name === '4 A') || scopedClasses[0] || allClasses[0];

  if (!cls) {
    return NextResponse.json({ error: 'Rombel tidak ditemukan.' }, { status: 404 });
  }
  if (!canTeacherAccessScope(auth.user, cls.id)) {
    return NextResponse.json({ error: 'Anda tidak memiliki akses ke rombel ini.' }, { status: 403 });
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

  if (mode === 'template') {
    const sub = subjectId
      ? (await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1))[0]
      : (await db.select().from(subjects).where(eq(subjects.gradeLevel, cls.gradeLevel)).limit(1))[0];
    if (!sub) {
      return NextResponse.json({ error: 'Mata pelajaran tidak ditemukan.' }, { status: 404 });
    }
    if (!canTeacherAccessScope(auth.user, cls.id, sub.id)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses mengekspor template mata pelajaran ini.' },
        { status: 403 }
      );
    }
    const existingScores = await db
      .select()
      .from(summativeScores)
      .where(and(eq(summativeScores.subjectId, sub.id), eq(summativeScores.semesterId, activeSemester.id)));
    const scoreByStudent = new Map(existingScores.map((s) => [s.studentId, s]));

    const buf = await generateSummativeTemplateWorkbook({
      className: cls.name,
      subjectName: sub.name,
      students: roster.map((r) => {
        const sc = scoreByStudent.get(r.studentId);
        return {
          nisn: r.nisn,
          fullName: r.fullName,
          lm1: sc?.lm1,
          lm2: sc?.lm2,
          lm3: sc?.lm3,
          sts: sc?.sts,
          sas: sc?.sas,
        };
      }),
    });

    const safeFile = sanitizeFilename(`template-nilai-${cls.name.replace(/\s+/g, '')}-${sub.code}.xlsx`);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeFile}"`,
      },
    });
  }

  // Full Class Leger Export
  const classSubjects = await db
    .select()
    .from(subjects)
    .where(eq(subjects.gradeLevel, cls.gradeLevel))
    .orderBy(asc(subjects.sortOrder));

  const scores = await db
    .select()
    .from(summativeScores)
    .where(and(eq(summativeScores.classId, cls.id), eq(summativeScores.semesterId, activeSemester.id)));
  const attRows = await db
    .select()
    .from(studentAttendance)
    .where(and(eq(studentAttendance.classId, cls.id), eq(studentAttendance.semesterId, activeSemester.id)));
  const cocuProjs = await db.select().from(cocurricularProjects).where(eq(cocurricularProjects.classId, cls.id));
  const cocuSc = await db.select().from(cocurricularScores);
  const eksSc = await db
    .select()
    .from(extracurricularScores)
    .where(eq(extracurricularScores.semesterId, activeSemester.id));

  const scoreMap = new Map(scores.map((x) => [`${x.studentId}:${x.subjectId}`, x]));
  const attSummaryMap = new Map<number, { h: number; s: number; i: number; a: number }>();
  for (const att of attRows) {
    const cur = attSummaryMap.get(att.studentId) || { h: 0, s: 0, i: 0, a: 0 };
    if (att.status === 'H') cur.h += 1;
    else if (att.status === 'S') cur.s += 1;
    else if (att.status === 'I') cur.i += 1;
    else if (att.status === 'A') cur.a += 1;
    attSummaryMap.set(att.studentId, cur);
  }
  const primaryProjectId = cocuProjs[0]?.id;
  const cocuMap = new Map<number, string>();
  if (primaryProjectId) {
    for (const c of cocuSc) {
      if (c.projectId === primaryProjectId && !cocuMap.has(c.studentId)) {
        cocuMap.set(c.studentId, c.predicate);
      }
    }
  }
  const eksMap = new Map<number, string>();
  for (const e of eksSc) {
    if (!eksMap.has(e.studentId)) {
      eksMap.set(e.studentId, e.predicate);
    }
  }

  const legerRows = roster
    .map((stu) => {
      const subjectScores: Record<number, number | null> = {};
      const vals: number[] = [];
      for (const sub of classSubjects) {
        const sc = scoreMap.get(`${stu.studentId}:${sub.id}`);
        subjectScores[sub.id] = sc?.finalScore ?? null;
        if (typeof sc?.finalScore === 'number') vals.push(sc.finalScore);
      }
      const average =
        vals.length > 0 ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : 0;
      const myAtt = attSummaryMap.get(stu.studentId) || { h: 0, s: 0, i: 0, a: 0 };

      return {
        rank: 0,
        nisn: stu.nisn,
        fullName: stu.fullName,
        subjectScores,
        average,
        cocurricularPredicate: cocuMap.get(stu.studentId) || '-',
        extracurricularPredicate: eksMap.get(stu.studentId) || '-',
        h: myAtt.h,
        s: myAtt.s,
        i: myAtt.i,
        a: myAtt.a,
      };
    })
    .sort((a, b) => b.average - a.average)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const buf = await generateLegerWorkbook({
    schoolName: school.name,
    className: cls.name,
    academicYear: activeYear.name,
    semester: activeSemester.name,
    subjects: classSubjects.map((s) => ({ id: s.id, code: s.code.split('-')[0], name: s.name })),
    rows: legerRows,
  });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="leger-nilai-${cls.name.replace(/\s+/g, '')}.xlsx"`,
    },
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'penilaian', 'update');
  if ('error' in auth) return auth.error;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file') as File | null;
  const classId = Number(formData?.get('classId') || 0);
  const subjectId = Number(formData?.get('subjectId') || 0);

  if (!file || !classId || !subjectId) {
    return NextResponse.json(
      { error: 'File Excel, rombel, dan mata pelajaran wajib disertakan.' },
      { status: 400 }
    );
  }
  if (!isAllowedExcelFile(file.name)) {
    return NextResponse.json(
      { error: 'Format berkas tidak didukung. Gunakan berkas Excel .xlsx atau .xlsm.' },
      { status: 400 }
    );
  }
  if (file.size > MAX_EXCEL_BYTES) {
    return NextResponse.json(
      { error: 'Ukuran berkas Excel melebihi batas maksimal 5 MB.' },
      { status: 400 }
    );
  }
  if (!canTeacherAccessScope(auth.user, classId, subjectId)) {
    return NextResponse.json(
      { error: 'Anda tidak ditugaskan pada kelas/mata pelajaran ini.' },
      { status: 403 }
    );
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load((await file.arrayBuffer()) as unknown as ArrayBuffer);
  } catch {
    return NextResponse.json(
      { error: 'Berkas Excel rusak atau tidak dapat dibaca.' },
      { status: 400 }
    );
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return NextResponse.json({ error: 'Worksheet Excel tidak ditemukan.' }, { status: 400 });
  }

  const db = getDb();
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);
  const [w] = await db
    .select()
    .from(assessmentWeights)
    .where(
      and(
        eq(assessmentWeights.subjectId, subjectId),
        eq(assessmentWeights.classId, classId),
        eq(assessmentWeights.semesterId, activeSemester.id)
      )
    )
    .limit(1);
  const weights = w || { weightLm: 40, weightSts: 30, weightSas: 30, kktpMin: 75 };

  const allStudents = await db.select().from(students);
  const byNisn = new Map(allStudents.map((s) => [s.nisn, s.id]));

  const parseNum = (val: unknown): number | null => {
    if (val === null || val === undefined || String(val).trim() === '') return null;
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    return n;
  };

  let updated = 0;
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    for (let rIdx = 3; rIdx <= sheet.rowCount; rIdx++) {
      const row = sheet.getRow(rIdx);
      const nisn = String(row.getCell(2).text || row.getCell(2).value || '').trim();
      const studentId = byNisn.get(nisn);
      if (!studentId) continue;

      const lm1 = parseNum(row.getCell(4).value);
      const lm2 = parseNum(row.getCell(5).value);
      const lm3 = parseNum(row.getCell(6).value);
      const sts = parseNum(row.getCell(7).value);
      const sas = parseNum(row.getCell(8).value);

      const calc = calculateSummativeScores({ lm1, lm2, lm3, sts, sas }, weights);

      const existing = await tx
        .select()
        .from(summativeScores)
        .where(
          and(
            eq(summativeScores.studentId, studentId),
            eq(summativeScores.subjectId, subjectId),
            eq(summativeScores.semesterId, activeSemester.id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await tx
          .update(summativeScores)
          .set({
            lm1,
            lm2,
            lm3,
            sts,
            sas,
            midtermScore: calc.midtermScore,
            finalScore: calc.finalScore,
            updatedAt: now,
          })
          .where(eq(summativeScores.id, existing[0].id));
      } else {
        await tx.insert(summativeScores).values({
          studentId,
          subjectId,
          classId,
          semesterId: activeSemester.id,
          lm1,
          lm2,
          lm3,
          sts,
          sas,
          midtermScore: calc.midtermScore,
          finalScore: calc.finalScore,
          updatedAt: now,
        });
      }
      updated++;
    }
  });

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'IMPORT_SUMMATIVE_EXCEL',
    entityType: 'summative_scores',
    entityId: `${classId}-${subjectId}`,
    details: `Mengimpor nilai sumatif untuk ${updated} murid dari ${file.name}.`,
  });

  return NextResponse.json({ ok: true, updated });
}
