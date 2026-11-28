import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  classes,
  classStudents,
  eraporImportLogs,
  semesters,
  students,
  subjects,
  summativeScores,
} from '@/lib/server/db/schema';
import { canTeacherAccessScope, logAudit, requireApiAuth } from '@/lib/server/auth/session';
import { sanitizeFilename } from '@/lib/utils/sanitize';

const MAX_ERAPOR_BYTES = 5 * 1024 * 1024;
function isAllowedExcelFile(fileName: string): boolean {
  return /\.(xlsx|xlsm)$/i.test(fileName.trim());
}

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode');
  const classId = Number(searchParams.get('classId') || 0);
  const subjectId = Number(searchParams.get('subjectId') || 0);

  const auth = await requireApiAuth(req, 'erapor', mode === 'export' ? 'export' : 'read');
  if ('error' in auth) return auth.error;

  const db = getDb();

  if (mode === 'export') {
    const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);
    const allClasses = await db.select().from(classes);
    const scopedClasses = auth.user.hasFullScope
      ? allClasses
      : allClasses.filter((c) => auth.user.assignedClassIds.includes(c.id));
    const cls = classId
      ? allClasses.find((c) => c.id === classId)
      : scopedClasses.find((c) => c.name === '4 A') || scopedClasses[0] || allClasses[0];
    if (!cls) {
      return NextResponse.json({ error: 'Rombel tidak ditemukan.' }, { status: 404 });
    }
    const sub = subjectId
      ? (await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1))[0]
      : (await db.select().from(subjects).where(eq(subjects.gradeLevel, cls.gradeLevel)).limit(1))[0];
    if (!sub) {
      return NextResponse.json({ error: 'Mata pelajaran tidak ditemukan.' }, { status: 404 });
    }
    if (!canTeacherAccessScope(auth.user, cls.id, sub.id)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses mengekspor E-Rapor untuk kelas/mapel ini.' },
        { status: 403 }
      );
    }

    const roster = await db
      .select({
        id: students.id,
        nisn: students.nisn,
        nis: students.nis,
        fullName: students.fullName,
      })
      .from(classStudents)
      .innerJoin(students, eq(classStudents.studentId, students.id))
      .where(and(eq(classStudents.classId, cls.id), eq(classStudents.semesterId, activeSemester.id)));

    const scores = await db
      .select()
      .from(summativeScores)
      .where(
        and(
          eq(summativeScores.classId, cls.id),
          eq(summativeScores.subjectId, sub.id),
          eq(summativeScores.semesterId, activeSemester.id)
        )
      );

    const scoreMap = new Map(scores.map((s) => [s.studentId, s]));
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('E-Rapor SD');
    sheet.addRow(['No', 'NISN', 'NIS', 'Nama Peserta Didik', 'Nilai Rapor', 'Deskripsi Capaian Kompetensi']);
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2942' } };

    roster.forEach((stu, idx) => {
      const sc = scoreMap.get(stu.id);
      sheet.addRow([
        idx + 1,
        stu.nisn,
        stu.nis,
        stu.fullName,
        sc?.finalScore ? Math.round(sc.finalScore) : '',
        sc?.teacherNote || '',
      ]);
    });

    sheet.columns = [
      { width: 6 },
      { width: 15 },
      { width: 12 },
      { width: 28 },
      { width: 14 },
      { width: 48 },
    ];

    const safeFile = sanitizeFilename(
      `erapor-${cls.name.replace(/\s+/g, '')}-${sub.code || sub.name.slice(0, 12)}.xlsx`
    );
    const buf = Buffer.from(await workbook.xlsx.writeBuffer());
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeFile}"`,
      },
    });
  }

  const logs = await db
    .select()
    .from(eraporImportLogs)
    .orderBy(desc(eraporImportLogs.createdAt))
    .limit(20);

  return NextResponse.json({ logs });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'erapor', 'create');
  if ('error' in auth) return auth.error;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file') as File | null;
  const templateVersion = String(formData?.get('templateVersion') || 'e-Rapor SD KM 2025/2026');
  const classId = Number(formData?.get('classId') || 0);
  const subjectId = Number(formData?.get('subjectId') || 0);
  const nisnCol = Number(formData?.get('nisnCol') || 2);
  const scoreCol = Number(formData?.get('scoreCol') || 5);
  const descCol = Number(formData?.get('descCol') || 6);
  const commit = formData?.get('commit') === 'true';

  if (!file || !classId || !subjectId) {
    return NextResponse.json(
      { error: 'Berkas Excel, kelas, dan mata pelajaran wajib dipilih.' },
      { status: 400 }
    );
  }
  if (!isAllowedExcelFile(file.name)) {
    return NextResponse.json(
      { error: 'Format berkas harus berupa Excel (.xlsx atau .xlsm).' },
      { status: 400 }
    );
  }
  if (file.size > MAX_ERAPOR_BYTES) {
    return NextResponse.json(
      { error: 'Ukuran berkas E-Rapor melebihi batas maksimal 5 MB.' },
      { status: 400 }
    );
  }
  if (!canTeacherAccessScope(auth.user, classId, subjectId)) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki akses mengimpor nilai E-Rapor untuk kelas/mapel ini.' },
      { status: 403 }
    );
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load((await file.arrayBuffer()) as unknown as ArrayBuffer);
  } catch {
    return NextResponse.json(
      { error: 'Berkas E-Rapor tidak valid atau gagal diurai.' },
      { status: 400 }
    );
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return NextResponse.json({ error: 'Worksheet Excel tidak ditemukan.' }, { status: 400 });
  }

  const db = getDb();
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);
  const allStudents = await db.select().from(students);
  const byNisn = new Map(allStudents.map((s) => [s.nisn, s]));

  const parsedRows: Array<{
    rowNumber: number;
    studentId: number;
    nisn: string;
    fullName: string;
    score: number;
    description: string;
  }> = [];
  const errors: Array<{ rowNumber: number; message: string }> = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nisn = String(row.getCell(nisnCol).text || row.getCell(nisnCol).value || '').replace(/\D/g, '');
    if (!nisn) continue;
    const stu = byNisn.get(nisn);
    if (!stu) {
      errors.push({ rowNumber: r, message: `NISN ${nisn} tidak cocok dengan murid di database.` });
      continue;
    }
    const rawScore = Number(row.getCell(scoreCol).value);
    if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > 100) {
      errors.push({ rowNumber: r, message: `Nilai pada baris ${r} harus berupa angka 0–100.` });
      continue;
    }
    const description = String(row.getCell(descCol).text || row.getCell(descCol).value || '').trim();
    parsedRows.push({
      rowNumber: r,
      studentId: stu.id,
      nisn,
      fullName: stu.fullName,
      score: rawScore,
      description,
    });
  }

  if (!commit) {
    return NextResponse.json({
      preview: {
        fileName: file.name,
        templateVersion,
        totalValid: parsedRows.length,
        rows: parsedRows.slice(0, 30),
        errors,
      },
    });
  }

  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    for (const item of parsedRows) {
      const existing = await tx
        .select()
        .from(summativeScores)
        .where(
          and(
            eq(summativeScores.studentId, item.studentId),
            eq(summativeScores.subjectId, subjectId),
            eq(summativeScores.semesterId, activeSemester.id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await tx
          .update(summativeScores)
          .set({
            finalScore: item.score,
            teacherNote: item.description || existing[0].teacherNote,
            updatedAt: now,
          })
          .where(eq(summativeScores.id, existing[0].id));
      } else {
        await tx.insert(summativeScores).values({
          studentId: item.studentId,
          subjectId,
          classId,
          semesterId: activeSemester.id,
          finalScore: item.score,
          teacherNote: item.description,
          updatedAt: now,
        });
      }
    }

    await tx.insert(eraporImportLogs).values({
      templateVersion,
      fileName: file.name,
      totalRows: parsedRows.length + errors.length,
      successRows: parsedRows.length,
      errorRows: errors.length,
      errorsJson: JSON.stringify(errors),
      createdAt: now,
    });
  });

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'IMPORT_ERAPOR',
    entityType: 'erapor',
    details: `Mengimpor ${parsedRows.length} nilai E-Rapor (${templateVersion}).`,
  });

  return NextResponse.json({
    ok: true,
    importedCount: parsedRows.length,
    errorCount: errors.length,
    errors,
  });
}
