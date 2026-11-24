import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import { classes, classStudents, semesters, students } from '@/lib/server/db/schema';
import {
  exportStudentsExcel,
  generateStudentTemplateWorkbook,
  parseStudentImportExcel,
} from '@/lib/server/services/excel-service';
import { canTeacherAccessScope, logAudit, requireApiAuth } from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'siswa', 'export');
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') || 'export';

  if (mode === 'template') {
    const buf = await generateStudentTemplateWorkbook();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="template-impor-murid-sekolahkita.xlsx"',
      },
    });
  }

  const db = getDb();
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);
  const allStudents = await db.select().from(students).orderBy(students.fullName);
  const allClasses = await db.select().from(classes);
  const enrollments = activeSemester
    ? await db.select().from(classStudents).where(eq(classStudents.semesterId, activeSemester.id))
    : [];

  const classMap = new Map(allClasses.map((c) => [c.id, c.name]));
  const enrMap = new Map(enrollments.map((e) => [e.studentId, e.classId]));
  const allowedSet = new Set(auth.user.assignedClassIds);

  const visibleStudents = auth.user.hasFullScope
    ? allStudents
    : allStudents.filter((s) => {
        const clsId = enrMap.get(s.id);
        return clsId !== undefined && allowedSet.has(clsId);
      });

  const rows = visibleStudents.map((s) => ({
    nisn: s.nisn,
    nis: s.nis,
    fullName: s.fullName,
    gender: s.gender,
    birthPlace: s.birthPlace,
    birthDate: s.birthDate,
    religion: s.religion,
    className: classMap.get(enrMap.get(s.id) || -1) || '-',
    status: s.status,
    fatherName: s.fatherName || '',
    motherName: s.motherName || '',
    parentPhone: s.parentPhone || '',
  }));

  if (mode === 'csv') {
    const headers = ['NISN', 'NIS', 'Nama Lengkap', 'JK', 'Tempat Lahir', 'Tanggal Lahir', 'Agama', 'Rombel', 'Status'];
    const csvLines = [
      headers.join(','),
      ...rows.map((r) =>
        [r.nisn, r.nis, `"${r.fullName}"`, r.gender, r.birthPlace, r.birthDate, r.religion, r.className, r.status].join(',')
      ),
    ];
    return new NextResponse(csvLines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="daftar-murid-sekolahkita.csv"',
      },
    });
  }

  const buf = await exportStudentsExcel(rows);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="daftar-murid-sekolahkita.xlsx"',
    },
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'siswa', 'create');
  if ('error' in auth) return auth.error;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file') as File | null;
  const commit = formData?.get('commit') === 'true';

  if (!file) {
    return NextResponse.json({ error: 'Pilih berkas Excel (.xlsx) terlebih dahulu.' }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Ukuran berkas maksimal 5 MB.' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const preview = await parseStudentImportExcel(Buffer.from(arrayBuffer));

  const db = getDb();
  const existingStudents = await db.select({ nisn: students.nisn }).from(students);
  const existingNisnSet = new Set(existingStudents.map((s) => s.nisn));

  const newRows = preview.validRows.filter((r) => !existingNisnSet.has(r.nisn));
  const existingDuplicates = preview.validRows
    .filter((r) => existingNisnSet.has(r.nisn))
    .map((r) => ({ rowNumber: r.rowNumber, nisn: r.nisn, fullName: r.fullName }));

  if (!commit) {
    return NextResponse.json({
      preview: {
        totalParsed: preview.validRows.length,
        readyToInsert: newRows.length,
        rows: newRows.slice(0, 50),
        errors: preview.errors,
        duplicatesInFile: preview.duplicatesInFile,
        existingDuplicates,
      },
    });
  }

  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);
  const allClasses = await db.select().from(classes);
  const classByName = new Map(allClasses.map((c) => [c.name.toLowerCase(), c.id]));

  if (!auth.user.hasFullScope) {
    const unauthorizedClass = newRows.find((r) => {
      const targetClsId = classByName.get(r.className.toLowerCase()) || auth.user.assignedClassIds[0];
      return !targetClsId || !canTeacherAccessScope(auth.user, targetClsId);
    });
    if (unauthorizedClass) {
      return NextResponse.json(
        {
          error: `Akses ditolak: Anda tidak memiliki cakupan untuk mengimpor murid ke kelas "${unauthorizedClass.className}".`,
        },
        { status: 403 }
      );
    }
  }

  const now = new Date().toISOString();
  let insertedCount = 0;

  await db.transaction(async (tx) => {
    for (const r of newRows) {
      const [stu] = await tx
        .insert(students)
        .values({
          nisn: r.nisn,
          nis: r.nis,
          fullName: r.fullName,
          gender: r.gender,
          birthPlace: r.birthPlace,
          birthDate: r.birthDate,
          religion: r.religion,
          address: r.address,
          fatherName: r.fatherName,
          motherName: r.motherName,
          parentPhone: r.parentPhone,
          enrollmentDate: now.slice(0, 10),
          status: 'Aktif',
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: students.id });

      const clsId =
        classByName.get(r.className.toLowerCase()) ||
        (auth.user.hasFullScope ? allClasses[0]?.id : auth.user.assignedClassIds[0]);
      if (clsId && activeSemester) {
        await tx.insert(classStudents).values({
          classId: clsId,
          studentId: stu.id,
          semesterId: activeSemester.id,
          status: 'Aktif',
          enrolledAt: now.slice(0, 10),
        });
      }
      insertedCount++;
    }
  });

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'IMPORT_STUDENTS_EXCEL',
    entityType: 'student',
    details: `Mengimpor ${insertedCount} murid baru dari berkas Excel ${file.name}.`,
  });

  return NextResponse.json({
    ok: true,
    insertedCount,
    skippedDuplicates: existingDuplicates.length,
    errors: preview.errors,
  });
}
