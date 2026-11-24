import { NextRequest, NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  schools,
  academicYears,
  semesters,
  classes,
  teachers,
  notifications,
} from '@/lib/server/db/schema';
import { requireApiAuth } from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req);
  if ('error' in auth) return auth.error;

  const db = getDb();
  const [school] = await db.select().from(schools).limit(1);
  const yearList = await db.select().from(academicYears);
  const semesterList = await db.select().from(semesters);

  const activeYear = yearList.find((y) => y.isActive) || yearList[0];
  const activeSemester = semesterList.find((s) => s.isActive) || semesterList[0];

  let classList = await db
    .select({
      id: classes.id,
      name: classes.name,
      gradeLevel: classes.gradeLevel,
      fase: classes.fase,
      semesterId: classes.semesterId,
      homeroomTeacherId: classes.homeroomTeacherId,
      homeroomTeacherName: teachers.fullName,
      capacity: classes.capacity,
    })
    .from(classes)
    .leftJoin(teachers, eq(classes.homeroomTeacherId, teachers.id));

  if (activeSemester) {
    const filtered = classList.filter((c) => c.semesterId === activeSemester.id);
    if (filtered.length > 0) classList = filtered;
  }

  if (!auth.user.hasFullScope) {
    const allowedSet = new Set(auth.user.assignedClassIds);
    classList = classList.filter((c) => allowedSet.has(c.id));
  }

  classList.sort((a, b) => a.gradeLevel - b.gradeLevel || a.name.localeCompare(b.name));

  const unreadNotifs = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.isRead, false))
    .orderBy(desc(notifications.createdAt));

  return NextResponse.json({
    school,
    academicYears: yearList,
    semesters: semesterList,
    activeYear,
    activeSemester,
    classes: classList,
    unreadNotificationCount: unreadNotifs.length,
    user: auth.user,
  });
}
