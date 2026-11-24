import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  teachers,
  staff,
  teacherAssignments,
  classes,
  semesters,
} from '@/lib/server/db/schema';
import { teacherCreateSchema } from '@/lib/validators';
import { logAudit, requireApiAuth } from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'guru', 'read');
  if ('error' in auth) return auth.error;

  const db = getDb();
  const teacherList = await db.select().from(teachers).orderBy(teachers.fullName);
  const staffList = await db.select().from(staff).orderBy(staff.fullName);
  const [activeSemester] = await db.select().from(semesters).where(eq(semesters.isActive, true)).limit(1);
  const allClasses = await db.select().from(classes);
  const assignments = activeSemester
    ? await db
        .select()
        .from(teacherAssignments)
        .where(eq(teacherAssignments.semesterId, activeSemester.id))
    : [];

  const classMap = new Map(allClasses.map((c) => [c.id, c.name]));

  const enrichedTeachers = teacherList.map((t) => {
    const myAssignments = assignments.filter((a) => a.teacherId === t.id);
    const totalHours = myAssignments.reduce((acc, a) => acc + a.weeklyHours, 0);
    return {
      ...t,
      weeklyHours: totalHours,
      assignments: myAssignments.map((a) => ({
        ...a,
        className: a.classId ? classMap.get(a.classId) || '-' : 'Lintas Kelas',
      })),
    };
  });

  return NextResponse.json({
    teachers: enrichedTeachers,
    staff: staffList,
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'guru', 'create');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);

  if (body?.kind === 'staff') {
    const staffSchema = z.object({
      fullName: z.string().trim().min(3, 'Nama staff wajib diisi.'),
      gender: z.enum(['L', 'P']),
      nip: z.string().trim().optional().default(''),
      position: z.string().trim().min(2, 'Jabatan wajib diisi.'),
      employmentStatus: z.string().trim().min(2),
      phone: z.string().trim().optional().default(''),
      email: z.string().trim().optional().default(''),
    });
    const parsed = staffSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data staff tidak valid.' },
        { status: 400 }
      );
    }
    const db = getDb();
    const [created] = await db
      .insert(staff)
      .values({ ...parsed.data, isActive: true, createdAt: new Date().toISOString() })
      .returning();
    return NextResponse.json({ ok: true, staff: created }, { status: 201 });
  }

  const parsed = teacherCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Data guru tidak valid.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const now = new Date().toISOString();
  const [created] = await db
    .insert(teachers)
    .values({
      ...parsed.data,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'CREATE_TEACHER',
    entityType: 'teacher',
    entityId: created.id,
    details: `Menambahkan pendidik: ${created.fullName}.`,
  });

  return NextResponse.json({ ok: true, teacher: created }, { status: 201 });
}

const patchTeacherSchema = z.object({
  id: z.number().int().positive(),
  fullName: z.string().trim().min(3).optional(),
  nuptk: z.string().trim().optional(),
  nip: z.string().trim().optional(),
  employmentStatus: z.string().trim().optional(),
  education: z.string().trim().optional(),
  specialization: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'guru', 'update');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = patchTeacherSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data pembaruan guru tidak valid.' }, { status: 400 });
  }

  const db = getDb();
  const { id, ...rest } = parsed.data;
  await db
    .update(teachers)
    .set({ ...rest, updatedAt: new Date().toISOString() })
    .where(eq(teachers.id, id));

  return NextResponse.json({ ok: true });
}
