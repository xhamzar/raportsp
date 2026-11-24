import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  students,
  classStudents,
  classes,
  semesters,
  studentStatusHistory,
  studentAffairsRecords,
  teachers,
} from '@/lib/server/db/schema';
import { studentCreateSchema, studentUpdateSchema } from '@/lib/validators';
import {
  canTeacherAccessScope,
  hasUserPermission,
  logAudit,
  requireApiAuth,
} from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, ['siswa', 'kesiswaan'], 'read');
  if ('error' in auth) return auth.error;

  const db = getDb();
  const { searchParams } = new URL(req.url);
  const classIdParam = searchParams.get('classId');
  const search = (searchParams.get('q') || '').trim().toLowerCase();
  const statusFilter = searchParams.get('status') || '';

  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);
  const allClasses = await db.select().from(classes);
  const allStudents = await db.select().from(students).orderBy(students.fullName);
  const activeTeachers = await db
    .select({
      id: teachers.id,
      fullName: teachers.fullName,
      nip: teachers.nip,
      specialization: teachers.specialization,
    })
    .from(teachers)
    .where(eq(teachers.isActive, true))
    .orderBy(asc(teachers.fullName));
  const enrollments = activeSemester
    ? await db.select().from(classStudents).where(eq(classStudents.semesterId, activeSemester.id))
    : await db.select().from(classStudents);

  const classMap = new Map(allClasses.map((c) => [c.id, c]));
  const teacherMap = new Map(activeTeachers.map((t) => [t.id, t]));
  const enrollmentByStudent = new Map(enrollments.map((e) => [e.studentId, e]));
  const allowedClassSet = new Set(auth.user.assignedClassIds);

  let list = allStudents.map((s) => {
    const enr = enrollmentByStudent.get(s.id);
    const cls = enr ? classMap.get(enr.classId) : undefined;
    const waliAsuhTeacher = s.waliAsuhTeacherId ? teacherMap.get(s.waliAsuhTeacherId) : undefined;
    return {
      ...s,
      waliAsuhName: s.waliAsuhName || waliAsuhTeacher?.fullName || '',
      photoUrl: s.photoPath
        ? `/api/students/${s.id}/photo?v=${encodeURIComponent(s.updatedAt)}`
        : null,
      classId: cls?.id ?? null,
      className: cls?.name ?? '-',
      gradeLevel: cls?.gradeLevel ?? null,
    };
  });

  if (!auth.user.hasFullScope) {
    list = list.filter((s) => s.classId !== null && allowedClassSet.has(s.classId));
  }

  if (classIdParam && classIdParam !== 'all') {
    const targetClassId = Number(classIdParam);
    if (!canTeacherAccessScope(auth.user, targetClassId)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses ke rombel ini.' },
        { status: 403 }
      );
    }
    list = list.filter((s) => s.classId === targetClassId);
  }

  if (statusFilter) {
    list = list.filter((s) => s.status === statusFilter);
  }

  if (search) {
    list = list.filter(
      (s) =>
        s.fullName.toLowerCase().includes(search) ||
        s.nisn.includes(search) ||
        s.nis.includes(search) ||
        (s.nik && s.nik.includes(search))
    );
  }

  const canReadKesiswaan = hasUserPermission(auth.user, 'kesiswaan', 'read');
  const rawAffairs = canReadKesiswaan
    ? await db
        .select()
        .from(studentAffairsRecords)
        .orderBy(desc(studentAffairsRecords.date))
        .limit(100)
    : [];

  const affairs = auth.user.hasFullScope
    ? rawAffairs
    : rawAffairs.filter((a) => {
        const enr = enrollmentByStudent.get(a.studentId);
        return enr ? allowedClassSet.has(enr.classId) : false;
      });

  const rawStatusHistory = hasUserPermission(auth.user, 'siswa', 'read')
    ? await db
        .select()
        .from(studentStatusHistory)
        .orderBy(desc(studentStatusHistory.createdAt))
        .limit(50)
    : [];

  const statusHistory = auth.user.hasFullScope
    ? rawStatusHistory
    : rawStatusHistory.filter((h) => {
        const enr = enrollmentByStudent.get(h.studentId);
        return enr ? allowedClassSet.has(enr.classId) : false;
      });

  return NextResponse.json({
    students: hasUserPermission(auth.user, 'siswa', 'read') ? list : [],
    affairs,
    statusHistory,
    teachers: activeTeachers,
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const body = await req.json().catch(() => null);

  // Branch for Student Affairs record
  if (body?.action === 'create_affairs') {
    const auth = await requireApiAuth(req, 'kesiswaan', 'create');
    if ('error' in auth) return auth.error;

    const affairsSchema = z.object({
      studentId: z.number().int().positive(),
      recordType: z.enum(['Prestasi', 'Pelanggaran', 'Konseling', 'UKS', 'Izin']),
      title: z.string().trim().min(2, 'Judul catatan wajib diisi.'),
      description: z.string().trim().min(3, 'Keterangan wajib diisi.'),
      points: z.number().int().default(0),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      isRestricted: z.boolean().default(false),
    });

    const parsed = affairsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Catatan kesiswaan tidak valid.' },
        { status: 400 }
      );
    }

    const db = getDb();
    const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);
    if (!auth.user.hasFullScope && activeSemester) {
      const [enr] = await db
        .select({ classId: classStudents.classId })
        .from(classStudents)
        .where(
          and(
            eq(classStudents.studentId, parsed.data.studentId),
            eq(classStudents.semesterId, activeSemester.id)
          )
        )
        .limit(1);
      if (!enr || !canTeacherAccessScope(auth.user, enr.classId)) {
        return NextResponse.json(
          { error: 'Anda tidak memiliki akses mencatat kesiswaan untuk murid pada rombel ini.' },
          { status: 403 }
        );
      }
    }
    const [created] = await db
      .insert(studentAffairsRecords)
      .values({
        studentId: parsed.data.studentId,
        semesterId: activeSemester.id,
        recordType: parsed.data.recordType,
        title: parsed.data.title,
        description: parsed.data.description,
        points: parsed.data.points,
        date: parsed.data.date,
        recordedByUserId: auth.user.id,
        isRestricted: parsed.data.isRestricted,
        createdAt: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json({ ok: true, record: created }, { status: 201 });
  }

  const auth = await requireApiAuth(req, 'siswa', 'create');
  if ('error' in auth) return auth.error;

  const parsed = studentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Data murid tidak valid.' },
      { status: 400 }
    );
  }

  if (!auth.user.hasFullScope) {
    if (!parsed.data.classId || !canTeacherAccessScope(auth.user, parsed.data.classId)) {
      return NextResponse.json(
        { error: 'Anda hanya dapat menambahkan murid ke rombel yang berada dalam cakupan Anda.' },
        { status: 403 }
      );
    }
  }

  const db = getDb();
  const dup = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.nisn, parsed.data.nisn))
    .limit(1);
  if (dup.length > 0) {
    return NextResponse.json(
      { error: `NISN ${parsed.data.nisn} sudah terdaftar pada sistem.` },
      { status: 409 }
    );
  }

  let resolvedWaliAsuhName = parsed.data.waliAsuhName;
  if (parsed.data.waliAsuhTeacherId && !resolvedWaliAsuhName) {
    const [ptk] = await db
      .select({ fullName: teachers.fullName })
      .from(teachers)
      .where(eq(teachers.id, parsed.data.waliAsuhTeacherId))
      .limit(1);
    if (ptk) resolvedWaliAsuhName = ptk.fullName;
  }

  const now = new Date().toISOString();
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);

  const created = await db.transaction(async (tx) => {
    const [stu] = await tx
      .insert(students)
      .values({
        nisn: parsed.data.nisn,
        nis: parsed.data.nis,
        fullName: parsed.data.fullName,
        nickname: parsed.data.nickname,
        nik: parsed.data.nik,
        gender: parsed.data.gender,
        birthPlace: parsed.data.birthPlace,
        birthDate: parsed.data.birthDate,
        religion: parsed.data.religion,
        childOrder: parsed.data.childOrder ?? null,
        siblingCount: parsed.data.siblingCount ?? null,
        address: parsed.data.address,
        rtRw: parsed.data.rtRw,
        village: parsed.data.village,
        district: parsed.data.district,
        regency: parsed.data.regency,
        province: parsed.data.province,
        postalCode: parsed.data.postalCode,
        phone: parsed.data.phone,
        email: parsed.data.email,
        previousSchool: parsed.data.previousSchool,
        enrollmentDate: parsed.data.enrollmentDate || now.slice(0, 10),
        status: parsed.data.status || 'Aktif',
        fatherName: parsed.data.fatherName,
        fatherNik: parsed.data.fatherNik,
        fatherJob: parsed.data.fatherJob,
        fatherEducation: parsed.data.fatherEducation,
        fatherPhone: parsed.data.fatherPhone,
        motherName: parsed.data.motherName,
        motherNik: parsed.data.motherNik,
        motherJob: parsed.data.motherJob,
        motherEducation: parsed.data.motherEducation,
        motherPhone: parsed.data.motherPhone,
        parentPhone: parsed.data.parentPhone || parsed.data.fatherPhone || parsed.data.motherPhone,
        guardianName: parsed.data.guardianName,
        guardianRelation: parsed.data.guardianRelation,
        guardianJob: parsed.data.guardianJob,
        guardianPhone: parsed.data.guardianPhone,
        guardianAddress: parsed.data.guardianAddress,
        waliAsuhTeacherId: parsed.data.waliAsuhTeacherId ?? null,
        waliAsuhName: resolvedWaliAsuhName,
        waliAsramaName: parsed.data.waliAsramaName,
        dormitoryRoom: parsed.data.dormitoryRoom,
        keasramaanNotes: parsed.data.keasramaanNotes,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (parsed.data.classId && activeSemester) {
      await tx.insert(classStudents).values({
        classId: parsed.data.classId,
        studentId: stu.id,
        semesterId: activeSemester.id,
        status: 'Aktif',
        enrolledAt: now.slice(0, 10),
      });
    }

    return stu;
  });

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'CREATE_STUDENT',
    entityType: 'student',
    entityId: created.id,
    details: `Menambahkan murid baru: ${created.fullName} (NISN ${created.nisn}).`,
  });

  return NextResponse.json({ ok: true, student: created }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'siswa', 'update');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = studentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Data pembaruan murid tidak valid.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(students)
    .where(eq(students.id, parsed.data.id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Murid tidak ditemukan.' }, { status: 404 });
  }

  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);

  if (!auth.user.hasFullScope && activeSemester) {
    const [enr] = await db
      .select({ classId: classStudents.classId })
      .from(classStudents)
      .where(
        and(
          eq(classStudents.studentId, existing.id),
          eq(classStudents.semesterId, activeSemester.id)
        )
      )
      .limit(1);
    if (!enr || !canTeacherAccessScope(auth.user, enr.classId)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses mengubah murid pada rombel ini.' },
        { status: 403 }
      );
    }
    if (parsed.data.classId && !canTeacherAccessScope(auth.user, parsed.data.classId)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses memindahkan murid ke rombel tujuan tersebut.' },
        { status: 403 }
      );
    }
  }

  let resolvedWaliAsuhName = parsed.data.waliAsuhName;
  if (parsed.data.waliAsuhTeacherId !== undefined) {
    if (parsed.data.waliAsuhTeacherId === null) {
      if (resolvedWaliAsuhName === undefined) resolvedWaliAsuhName = '';
    } else if (!resolvedWaliAsuhName) {
      const [ptk] = await db
        .select({ fullName: teachers.fullName })
        .from(teachers)
        .where(eq(teachers.id, parsed.data.waliAsuhTeacherId))
        .limit(1);
      if (ptk) resolvedWaliAsuhName = ptk.fullName;
    }
  }

  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    const updates: Partial<typeof students.$inferInsert> = { updatedAt: now };
    if (parsed.data.fullName !== undefined) updates.fullName = parsed.data.fullName;
    if (parsed.data.nickname !== undefined) updates.nickname = parsed.data.nickname;
    if (parsed.data.nik !== undefined) updates.nik = parsed.data.nik;
    if (parsed.data.gender !== undefined) updates.gender = parsed.data.gender;
    if (parsed.data.birthPlace !== undefined) updates.birthPlace = parsed.data.birthPlace;
    if (parsed.data.birthDate !== undefined) updates.birthDate = parsed.data.birthDate;
    if (parsed.data.religion !== undefined) updates.religion = parsed.data.religion;
    if (parsed.data.childOrder !== undefined) updates.childOrder = parsed.data.childOrder;
    if (parsed.data.siblingCount !== undefined) updates.siblingCount = parsed.data.siblingCount;
    if (parsed.data.address !== undefined) updates.address = parsed.data.address;
    if (parsed.data.rtRw !== undefined) updates.rtRw = parsed.data.rtRw;
    if (parsed.data.village !== undefined) updates.village = parsed.data.village;
    if (parsed.data.district !== undefined) updates.district = parsed.data.district;
    if (parsed.data.regency !== undefined) updates.regency = parsed.data.regency;
    if (parsed.data.province !== undefined) updates.province = parsed.data.province;
    if (parsed.data.postalCode !== undefined) updates.postalCode = parsed.data.postalCode;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
    if (parsed.data.email !== undefined) updates.email = parsed.data.email;
    if (parsed.data.previousSchool !== undefined) updates.previousSchool = parsed.data.previousSchool;
    if (parsed.data.enrollmentDate !== undefined) updates.enrollmentDate = parsed.data.enrollmentDate;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.fatherName !== undefined) updates.fatherName = parsed.data.fatherName;
    if (parsed.data.fatherNik !== undefined) updates.fatherNik = parsed.data.fatherNik;
    if (parsed.data.fatherJob !== undefined) updates.fatherJob = parsed.data.fatherJob;
    if (parsed.data.fatherEducation !== undefined) updates.fatherEducation = parsed.data.fatherEducation;
    if (parsed.data.fatherPhone !== undefined) updates.fatherPhone = parsed.data.fatherPhone;
    if (parsed.data.motherName !== undefined) updates.motherName = parsed.data.motherName;
    if (parsed.data.motherNik !== undefined) updates.motherNik = parsed.data.motherNik;
    if (parsed.data.motherJob !== undefined) updates.motherJob = parsed.data.motherJob;
    if (parsed.data.motherEducation !== undefined) updates.motherEducation = parsed.data.motherEducation;
    if (parsed.data.motherPhone !== undefined) updates.motherPhone = parsed.data.motherPhone;
    if (parsed.data.parentPhone !== undefined) updates.parentPhone = parsed.data.parentPhone;
    if (parsed.data.guardianName !== undefined) updates.guardianName = parsed.data.guardianName;
    if (parsed.data.guardianRelation !== undefined) updates.guardianRelation = parsed.data.guardianRelation;
    if (parsed.data.guardianJob !== undefined) updates.guardianJob = parsed.data.guardianJob;
    if (parsed.data.guardianPhone !== undefined) updates.guardianPhone = parsed.data.guardianPhone;
    if (parsed.data.guardianAddress !== undefined) updates.guardianAddress = parsed.data.guardianAddress;
    if (parsed.data.waliAsuhTeacherId !== undefined) updates.waliAsuhTeacherId = parsed.data.waliAsuhTeacherId;
    if (resolvedWaliAsuhName !== undefined) updates.waliAsuhName = resolvedWaliAsuhName;
    if (parsed.data.waliAsramaName !== undefined) updates.waliAsramaName = parsed.data.waliAsramaName;
    if (parsed.data.dormitoryRoom !== undefined) updates.dormitoryRoom = parsed.data.dormitoryRoom;
    if (parsed.data.keasramaanNotes !== undefined) updates.keasramaanNotes = parsed.data.keasramaanNotes;

    await tx.update(students).set(updates).where(eq(students.id, existing.id));

    if (parsed.data.status && parsed.data.status !== existing.status) {
      await tx.insert(studentStatusHistory).values({
        studentId: existing.id,
        fromStatus: existing.status,
        toStatus: parsed.data.status,
        reason: parsed.data.statusReason || 'Perubahan status murid melalui administrasi.',
        effectiveDate: now.slice(0, 10),
        createdAt: now,
      });
    }

    if (parsed.data.classId && activeSemester) {
      const existingEnrollment = await tx
        .select()
        .from(classStudents)
        .where(
          and(
            eq(classStudents.studentId, existing.id),
            eq(classStudents.semesterId, activeSemester.id)
          )
        )
        .limit(1);

      if (existingEnrollment.length > 0) {
        await tx
          .update(classStudents)
          .set({ classId: parsed.data.classId })
          .where(eq(classStudents.id, existingEnrollment[0].id));
      } else {
        await tx.insert(classStudents).values({
          classId: parsed.data.classId,
          studentId: existing.id,
          semesterId: activeSemester.id,
          status: 'Aktif',
          enrolledAt: now.slice(0, 10),
        });
      }
    }
  });

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'UPDATE_STUDENT',
    entityType: 'student',
    entityId: existing.id,
    details: `Memperbarui profil murid ${parsed.data.fullName || existing.fullName}.`,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'siswa', 'delete');
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));
  if (!id) {
    return NextResponse.json({ error: 'ID murid tidak valid.' }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db.select().from(students).where(eq(students.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Murid tidak ditemukan.' }, { status: 404 });
  }

  if (!auth.user.hasFullScope) {
    const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);
    const enr = activeSemester
      ? (
          await db
            .select({ classId: classStudents.classId })
            .from(classStudents)
            .where(
              and(
                eq(classStudents.studentId, existing.id),
                eq(classStudents.semesterId, activeSemester.id)
              )
            )
            .limit(1)
        )[0]
      : undefined;
    if (!enr || !canTeacherAccessScope(auth.user, enr.classId)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses mengarsipkan murid dari rombel ini.' },
        { status: 403 }
      );
    }
  }

  // Safeguard: preserve historical academic records via soft status transition to Keluar unless explicitly forced with zero scores
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx
      .update(students)
      .set({ status: 'Keluar', updatedAt: now })
      .where(eq(students.id, id));
    await tx.insert(studentStatusHistory).values({
      studentId: id,
      fromStatus: existing.status,
      toStatus: 'Keluar',
      reason: 'Dinonaktifkan dari rombel aktif (riwayat nilai dan rapor tetap dipertahankan).',
      effectiveDate: now.slice(0, 10),
      createdAt: now,
    });
  });

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'ARCHIVE_STUDENT',
    entityType: 'student',
    entityId: id,
    details: `Mengarsipkan murid ${existing.fullName} tanpa menghapus riwayat nilai.`,
  });

  return NextResponse.json({
    ok: true,
    message: 'Murid dipindahkan ke status Keluar agar riwayat akademik tetap terjaga.',
  });
}
