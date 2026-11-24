import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import { classStudents, semesters, students } from '@/lib/server/db/schema';
import { canTeacherAccessScope, logAudit, requireApiAuth } from '@/lib/server/auth/session';
import {
  deleteStudentPhotoFile,
  MAX_STUDENT_PHOTO_BYTES,
  readStudentPhotoFile,
  saveStudentPhotoFile,
} from '@/lib/server/services/student-photo';

async function checkStudentScopeAccess(
  studentId: number,
  user: Parameters<typeof canTeacherAccessScope>[0]
): Promise<boolean> {
  if (user.hasFullScope) return true;
  const db = getDb();
  const [activeSemester] = await db
    .select()
    .from(semesters)
    .where(eq(semesters.isActive, true))
    .limit(1);
  if (!activeSemester) return false;

  const [enr] = await db
    .select({ classId: classStudents.classId })
    .from(classStudents)
    .where(
      and(
        eq(classStudents.studentId, studentId),
        eq(classStudents.semesterId, activeSemester.id)
      )
    )
    .limit(1);

  return Boolean(enr && canTeacherAccessScope(user, enr.classId));
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, ['siswa', 'kesiswaan', 'rapor'], 'read');
  if ('error' in auth) return auth.error;

  const { id } = await context.params;
  const studentId = Number(id);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return NextResponse.json({ error: 'ID murid tidak valid.' }, { status: 400 });
  }

  const db = getDb();
  const [student] = await db
    .select({ id: students.id, photoPath: students.photoPath })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);

  if (!student) {
    return NextResponse.json({ error: 'Murid tidak ditemukan.' }, { status: 404 });
  }

  const allowed = await checkStudentScopeAccess(student.id, auth.user);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki akses ke foto murid pada rombel ini.' },
      { status: 403 }
    );
  }

  const file = readStudentPhotoFile(student.photoPath);
  if (!file) {
    return NextResponse.json({ error: 'Foto murid belum tersedia.' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.buffer.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'siswa', 'update');
  if ('error' in auth) return auth.error;

  const { id } = await context.params;
  const studentId = Number(id);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return NextResponse.json({ error: 'ID murid tidak valid.' }, { status: 400 });
  }

  const db = getDb();
  const [student] = await db
    .select({
      id: students.id,
      fullName: students.fullName,
      photoPath: students.photoPath,
    })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);

  if (!student) {
    return NextResponse.json({ error: 'Murid tidak ditemukan.' }, { status: 404 });
  }

  const allowed = await checkStudentScopeAccess(student.id, auth.user);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki akses mengubah foto murid pada rombel ini.' },
      { status: 403 }
    );
  }

  const formData = await req.formData().catch(() => null);
  const uploaded = formData?.get('file');
  if (!(uploaded instanceof File)) {
    return NextResponse.json(
      { error: 'Silakan pilih file foto terlebih dahulu.' },
      { status: 400 }
    );
  }

  if (uploaded.size > MAX_STUDENT_PHOTO_BYTES) {
    return NextResponse.json(
      { error: 'Ukuran foto maksimal 2 MB.' },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await uploaded.arrayBuffer());
  let saved: { fileName: string; contentType: string };
  try {
    saved = saveStudentPhotoFile(student.id, buffer, student.photoPath);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menyimpan file foto murid.' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  await db
    .update(students)
    .set({ photoPath: saved.fileName, updatedAt: now })
    .where(eq(students.id, student.id));

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'UPLOAD_STUDENT_PHOTO',
    entityType: 'student',
    entityId: student.id,
    details: `Mengunggah foto profil murid ${student.fullName}.`,
  });

  return NextResponse.json({
    ok: true,
    photoUrl: `/api/students/${student.id}/photo?v=${Date.now()}`,
  });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'siswa', 'update');
  if ('error' in auth) return auth.error;

  const { id } = await context.params;
  const studentId = Number(id);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return NextResponse.json({ error: 'ID murid tidak valid.' }, { status: 400 });
  }

  const db = getDb();
  const [student] = await db
    .select({
      id: students.id,
      fullName: students.fullName,
      photoPath: students.photoPath,
    })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);

  if (!student) {
    return NextResponse.json({ error: 'Murid tidak ditemukan.' }, { status: 404 });
  }

  const allowed = await checkStudentScopeAccess(student.id, auth.user);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki akses menghapus foto murid pada rombel ini.' },
      { status: 403 }
    );
  }

  deleteStudentPhotoFile(student.photoPath);
  await db
    .update(students)
    .set({ photoPath: '', updatedAt: new Date().toISOString() })
    .where(eq(students.id, student.id));

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'DELETE_STUDENT_PHOTO',
    entityType: 'student',
    entityId: student.id,
    details: `Menghapus foto profil murid ${student.fullName}.`,
  });

  return NextResponse.json({ ok: true, photoUrl: null });
}
