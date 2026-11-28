import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  classes,
  classStudents,
  keasramaanIndicators,
  keasramaanScores,
  schools,
  semesters,
  students,
} from '@/lib/server/db/schema';
import {
  canTeacherAccessScope,
  hasUserPermission,
  logAudit,
  requireApiAuth,
} from '@/lib/server/auth/session';
import {
  keasramaanIndicatorSchema,
  keasramaanScoreUpdateSchema,
} from '@/lib/validators';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, ['keasramaan', 'penilaian', 'rapor'], 'read');
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const classIdParam = Number(searchParams.get('classId') || 0);

  const db = getDb();
  const [school] = await db.select().from(schools).limit(1);
  const [activeSemester] = await db
    .select()
    .from(semesters)
    .where(eq(semesters.isActive, true))
    .limit(1);

  const allClasses = await db.select().from(classes).orderBy(asc(classes.gradeLevel));
  const scopedClasses = auth.user.hasFullScope
    ? allClasses
    : allClasses.filter((c) => auth.user.assignedClassIds.includes(c.id));

  const targetClass = classIdParam
    ? allClasses.find((c) => c.id === classIdParam)
    : scopedClasses.find((c) => c.name === '4 A') || scopedClasses[0] || allClasses[0];

  if (!targetClass) {
    return NextResponse.json({ error: 'Rombel tidak ditemukan.' }, { status: 404 });
  }
  if (!canTeacherAccessScope(auth.user, targetClass.id)) {
    return NextResponse.json(
      { error: 'Anda tidak memiliki akses ke rombel ini.' },
      { status: 403 }
    );
  }

  const indicators = await db
    .select()
    .from(keasramaanIndicators)
    .orderBy(asc(keasramaanIndicators.category), asc(keasramaanIndicators.sortOrder));

  const roster = await db
    .select({
      studentId: students.id,
      nisn: students.nisn,
      nis: students.nis,
      fullName: students.fullName,
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

  const rawScores = await db
    .select()
    .from(keasramaanScores)
    .where(eq(keasramaanScores.semesterId, activeSemester.id));

  const scoreMap = new Map(
    rawScores.map((s) => [`${s.studentId}:${s.indicatorId}`, s])
  );

  const studentRows = roster.map((stu) => {
    let waliAsramaName = '';
    let waliAsuhName = '';
    const items = indicators
      .filter((ind) => ind.isActive)
      .map((ind) => {
        const sc = scoreMap.get(`${stu.studentId}:${ind.id}`);
        if (sc?.waliAsramaName) waliAsramaName = sc.waliAsramaName;
        if (sc?.waliAsuhName) waliAsuhName = sc.waliAsuhName;
        return {
          indicatorId: ind.id,
          category: ind.category,
          name: ind.name,
          learningObjectives: JSON.parse(ind.learningObjectivesJson || '[]') as string[],
          predicate: sc?.predicate || 'B',
          achievedNote: sc?.achievedDescription || '',
          guidanceNote: sc?.guidanceDescription || '',
          notes: '',
        };
      });
    return {
      ...stu,
      waliAsramaName,
      waliAsuhName,
      items,
    };
  });

  return NextResponse.json({
    enabled: Boolean(school?.enableKeasramaan),
    semester: activeSemester,
    classes: scopedClasses,
    selectedClass: targetClass,
    indicators: indicators.map((ind) => ({
      ...ind,
      learningObjectives: JSON.parse(ind.learningObjectivesJson || '[]') as string[],
    })),
    studentRows,
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'keasramaan', 'update');
  if ('error' in auth) return auth.error;

  const db = getDb();
  const [school] = await db.select().from(schools).limit(1);
  if (!school?.enableKeasramaan) {
    return NextResponse.json(
      {
        error:
          'Modul Keasramaan belum diaktifkan. Aktifkan terlebih dahulu pada halaman Pengaturan Sekolah.',
      },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const now = new Date().toISOString();

  if (body?.kind === 'save_indicator') {
    const isCreate = !body.id;
    if (isCreate && !hasUserPermission(auth.user, 'keasramaan', 'create')) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki izin menambah indikator keasramaan.' },
        { status: 403 }
      );
    }

    const parsed = keasramaanIndicatorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data indikator keasramaan tidak valid.' },
        { status: 400 }
      );
    }

    if (parsed.data.id) {
      const updateSet: Partial<typeof keasramaanIndicators.$inferInsert> = {
        category: parsed.data.category,
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
      };
      if (parsed.data.learningObjectives !== undefined) {
        updateSet.learningObjectivesJson = JSON.stringify(parsed.data.learningObjectives);
      }
      await db
        .update(keasramaanIndicators)
        .set(updateSet)
        .where(eq(keasramaanIndicators.id, parsed.data.id));
    } else {
      await db.insert(keasramaanIndicators).values({
        category: parsed.data.category,
        name: parsed.data.name,
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
        learningObjectivesJson: JSON.stringify(parsed.data.learningObjectives || []),
      });
    }

    await logAudit({
      userId: auth.user.id,
      actorName: auth.user.fullName,
      action: parsed.data.id ? 'UPDATE_KEASRAMAAN_INDICATOR' : 'CREATE_KEASRAMAAN_INDICATOR',
      entityType: 'keasramaan_indicators',
      entityId: parsed.data.id ?? 'new',
      details: `${parsed.data.id ? 'Memperbarui' : 'Menambahkan'} indikator keasramaan "${parsed.data.name}" (${parsed.data.category}).`,
    });

    return NextResponse.json({ ok: true });
  }

  if (body?.kind === 'save_indicator_tp') {
    const indicatorId = Number(body?.indicatorId);
    const learningObjectives = Array.isArray(body?.learningObjectives)
      ? body.learningObjectives
          .map((item: unknown) => String(item || '').trim())
          .filter((item: string) => item.length > 0)
      : [];
    if (!indicatorId) {
      return NextResponse.json({ error: 'ID indikator tidak valid.' }, { status: 400 });
    }
    const [existing] = await db
      .select()
      .from(keasramaanIndicators)
      .where(eq(keasramaanIndicators.id, indicatorId))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: 'Indikator keasramaan tidak ditemukan.' }, { status: 404 });
    }
    await db
      .update(keasramaanIndicators)
      .set({ learningObjectivesJson: JSON.stringify(learningObjectives) })
      .where(eq(keasramaanIndicators.id, indicatorId));
    await logAudit({
      userId: auth.user.id,
      actorName: auth.user.fullName,
      action: 'UPDATE_KEASRAMAAN_TP',
      entityType: 'keasramaan_indicators',
      entityId: indicatorId,
      details: `Memperbarui ${learningObjectives.length} tujuan pembinaan pada indikator "${existing.name}".`,
    });
    return NextResponse.json({ ok: true });
  }

  if (body?.kind === 'save_scores') {
    const [activeSemester] = await db
      .select()
      .from(semesters)
      .where(eq(semesters.isActive, true))
      .limit(1);

    const parsed = keasramaanScoreUpdateSchema.safeParse({
      ...body,
      semesterId: body?.semesterId || activeSemester.id,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data nilai keasramaan tidak valid.' },
        { status: 400 }
      );
    }

    if (!canTeacherAccessScope(auth.user, parsed.data.classId)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses keasramaan pada rombel ini.' },
        { status: 403 }
      );
    }

    const semesterId = parsed.data.semesterId || activeSemester.id;
    const existingRows = await db
      .select()
      .from(keasramaanScores)
      .where(eq(keasramaanScores.semesterId, semesterId));
    const existingMap = new Map(
      existingRows.map((r) => [`${r.indicatorId}:${r.studentId}`, r.id])
    );

    await db.transaction(async (tx) => {
      for (const entry of parsed.data.entries) {
        const key = `${entry.indicatorId}:${entry.studentId}`;
        const existingId = existingMap.get(key);
        if (existingId) {
          await tx
            .update(keasramaanScores)
            .set({
              predicate: entry.predicate,
              achievedDescription: entry.achievedNote,
              guidanceDescription: entry.guidanceNote,
              waliAsramaName: entry.waliAsramaName,
              waliAsuhName: entry.waliAsuhName,
              updatedAt: now,
            })
            .where(eq(keasramaanScores.id, existingId));
        } else {
          await tx.insert(keasramaanScores).values({
            indicatorId: entry.indicatorId,
            studentId: entry.studentId,
            semesterId,
            predicate: entry.predicate,
            achievedDescription: entry.achievedNote,
            guidanceDescription: entry.guidanceNote,
            waliAsramaName: entry.waliAsramaName,
            waliAsuhName: entry.waliAsuhName,
            updatedAt: now,
          });
        }
      }
    });

    await logAudit({
      userId: auth.user.id,
      actorName: auth.user.fullName,
      action: 'UPDATE_KEASRAMAAN_SCORES',
      entityType: 'keasramaan_scores',
      entityId: parsed.data.classId,
      details: `Menyimpan ${parsed.data.entries.length} nilai pembinaan keasramaan.`,
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: 'Aksi keasramaan tidak dikenali.' },
    { status: 400 }
  );
}

export async function DELETE(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'keasramaan', 'delete');
  if ('error' in auth) return auth.error;

  const db = getDb();
  const [school] = await db.select().from(schools).limit(1);
  if (!school?.enableKeasramaan) {
    return NextResponse.json(
      {
        error:
          'Modul Keasramaan belum diaktifkan. Aktifkan terlebih dahulu pada halaman Pengaturan Sekolah.',
      },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id') || 0);
  if (!id) {
    return NextResponse.json({ error: 'ID indikator tidak valid.' }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(keasramaanIndicators)
    .where(eq(keasramaanIndicators.id, id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Indikator tidak ditemukan.' }, { status: 404 });
  }

  await db.delete(keasramaanIndicators).where(eq(keasramaanIndicators.id, id));
  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'DELETE_KEASRAMAAN_INDICATOR',
    entityType: 'keasramaan_indicators',
    entityId: id,
    details: `Menghapus indikator keasramaan "${existing.name}".`,
  });

  return NextResponse.json({ ok: true });
}
