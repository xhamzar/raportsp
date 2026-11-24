import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import {
  classes,
  classStudents,
  dapodikConfig,
  dapodikExternalMappings,
  dapodikSubjects,
  dapodikSubmissionLogs,
  dapodikSyncLogs,
  schools,
  semesters,
  students,
  subjects,
  summativeScores,
  teachers,
} from '@/lib/server/db/schema';
import { dapodikConfigSchema } from '@/lib/validators';
import {
  normalizeWebServiceUrl,
  submitRaporToDapodikProtocol,
  syncFromDapodikAdapter,
  testDapodikConnection,
  uuidDeterministic,
  validateDapodikUrl,
} from '@/lib/server/services/dapodik-adapter';
import { canTeacherAccessScope, logAudit, requireApiAuth } from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'dapodik', 'read');
  if ('error' in auth) return auth.error;

  const db = getDb();
  const [cfg] = await db.select().from(dapodikConfig).limit(1);
  const [activeSemester] = await db
    .select()
    .from(semesters)
    .where(eq(semesters.isActive, true))
    .limit(1);

  const mappings = await db.select().from(dapodikExternalMappings);
  const catalogSubjects = await db
    .select()
    .from(dapodikSubjects)
    .orderBy(asc(dapodikSubjects.mataPelajaranId));

  const classEnrollments = activeSemester
    ? await db
        .select({
          id: classStudents.id,
          dapodikAnggotaRombelId: classStudents.dapodikAnggotaRombelId,
        })
        .from(classStudents)
        .where(eq(classStudents.semesterId, activeSemester.id))
    : [];
  const mappedAnggotaRombelCount = classEnrollments.filter((e) =>
    Boolean(e.dapodikAnggotaRombelId)
  ).length;

  const syncLogs = await db
    .select()
    .from(dapodikSyncLogs)
    .orderBy(desc(dapodikSyncLogs.createdAt))
    .limit(20);
  const submissionLogs = await db
    .select()
    .from(dapodikSubmissionLogs)
    .orderBy(desc(dapodikSubmissionLogs.createdAt))
    .limit(30);

  return NextResponse.json({
    config: cfg
      ? {
          id: cfg.id,
          webServiceUrl: cfg.webServiceUrl,
          npsn: cfg.npsn,
          hasToken: Boolean(cfg.apiToken),
          tokenMasked: cfg.apiToken
            ? `${cfg.apiToken.slice(0, 4)}••••••••${cfg.apiToken.slice(-3)}`
            : '',
          mode: cfg.mode,
          connectionStatus: cfg.connectionStatus,
          lastSyncAt: cfg.lastSyncAt,
          updatedAt: cfg.updatedAt,
        }
      : null,
    mappingCount: mappings.length,
    dapodikSubjectsCount: catalogSubjects.length,
    dapodikSubjects: catalogSubjects,
    mappedAnggotaRombelCount,
    totalEnrollmentCount: classEnrollments.length,
    syncLogs,
    submissionLogs,
  });
}

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'dapodik', 'update');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const db = getDb();
  const [cfg] = await db.select().from(dapodikConfig).limit(1);
  const now = new Date().toISOString();

  if (body?.action === 'save_config') {
    const parsed = dapodikConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Konfigurasi Dapodik tidak valid.' },
        { status: 400 }
      );
    }

    const urlCheck = validateDapodikUrl(parsed.data.webServiceUrl);
    if (!urlCheck.valid || !urlCheck.normalizedBaseUrl) {
      return NextResponse.json(
        { error: urlCheck.reason || 'Format URL Web Service Dapodik tidak valid.' },
        { status: 400 }
      );
    }

    const normalizedUrl = normalizeWebServiceUrl(urlCheck.normalizedBaseUrl);
    const tokenToSave =
      parsed.data.apiToken && parsed.data.apiToken.trim() !== ''
        ? parsed.data.apiToken.trim()
        : cfg?.apiToken || '';

    if (cfg) {
      await db
        .update(dapodikConfig)
        .set({
          webServiceUrl: normalizedUrl,
          npsn: parsed.data.npsn,
          apiToken: tokenToSave,
          mode: parsed.data.mode,
          updatedAt: now,
        })
        .where(eq(dapodikConfig.id, cfg.id));
    }

    await logAudit({
      userId: auth.user.id,
      actorName: auth.user.fullName,
      action: 'UPDATE_DAPODIK_CONFIG',
      entityType: 'dapodik_config',
      details: `Memperbarui konfigurasi Dapodik (Mode: ${parsed.data.mode}, URL: ${normalizedUrl}, NPSN: ${parsed.data.npsn}).`,
    });

    return NextResponse.json({ ok: true, normalizedUrl });
  }

  if (body?.action === 'test_connection') {
    if (!cfg) {
      return NextResponse.json({ error: 'Konfigurasi Dapodik belum tersedia.' }, { status: 404 });
    }
    const result = await testDapodikConnection({
      webServiceUrl: cfg.webServiceUrl,
      npsn: cfg.npsn,
      apiToken: cfg.apiToken || '',
      mode: cfg.mode as 'WebService' | 'Sandbox',
    });

    await db
      .update(dapodikConfig)
      .set({ connectionStatus: result.statusText, updatedAt: now })
      .where(eq(dapodikConfig.id, cfg.id));

    return NextResponse.json(result);
  }

  if (body?.action === 'sync_master') {
    if (!cfg) {
      return NextResponse.json({ error: 'Konfigurasi Dapodik belum tersedia.' }, { status: 404 });
    }

    const [activeSemester] = await db
      .select()
      .from(semesters)
      .where(eq(semesters.isActive, true))
      .limit(1);
    const allStudents = await db.select().from(students);
    const allClasses = await db.select().from(classes);
    const allSubjects = await db.select().from(subjects);
    const allTeachers = await db.select({ id: teachers.id }).from(teachers);

    const syncRes = await syncFromDapodikAdapter({
      webServiceUrl: cfg.webServiceUrl,
      npsn: cfg.npsn,
      apiToken: cfg.apiToken || '',
      mode: cfg.mode as 'WebService' | 'Sandbox',
      localStudents: allStudents.map((s) => ({
        id: s.id,
        nisn: s.nisn,
        fullName: s.fullName,
        dapodikStudentId: s.dapodikStudentId,
      })),
      localClasses: allClasses.map((c) => ({
        id: c.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
        dapodikRombelId: c.dapodikRombelId,
      })),
      localSubjects: allSubjects.map((sub) => ({
        id: sub.id,
        code: sub.code,
        name: sub.name,
        dapodikMapelId: sub.dapodikMapelId,
      })),
      localTeachersCount: allTeachers.length,
    });

    if (!syncRes.ok) {
      await db.insert(dapodikSyncLogs).values({
        syncType: `Sinkronisasi Protokol Dapodik (${cfg.mode})`,
        direction: 'Import',
        status: 'Gagal',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errorsJson: JSON.stringify([syncRes.error || 'Koneksi Dapodik gagal']),
        createdAt: now,
      });
      return NextResponse.json(
        { ok: false, error: syncRes.error, sections: syncRes.sections },
        { status: 502 }
      );
    }

    const existingMaps = await db
      .select()
      .from(dapodikExternalMappings)
      .where(eq(dapodikExternalMappings.entityType, 'student'));
    const mappedByLocal = new Map(existingMaps.map((m) => [m.localId, m]));

    const existingCatalog = await db.select().from(dapodikSubjects);
    const catalogByMapelId = new Map(existingCatalog.map((c) => [c.mataPelajaranId, c]));

    const classEnrollments = activeSemester
      ? await db
          .select()
          .from(classStudents)
          .where(eq(classStudents.semesterId, activeSemester.id))
      : [];
    const enrollmentByStudentId = new Map(classEnrollments.map((e) => [e.studentId, e]));

    const pbByName = new Map(
      syncRes.pembelajaranByCode.map((p) => [`${p.rombonganBelajarId}:${p.mataPelajaranId}`, p])
    );

    let createdMaps = 0;
    let updatedMaps = 0;

    await db.transaction(async (tx) => {
      // 1. Upsert dapodikSubjects catalog
      for (const cat of syncRes.subjectsCatalog) {
        const existing = catalogByMapelId.get(cat.mapelId);
        if (existing) {
          await tx
            .update(dapodikSubjects)
            .set({ nama: cat.name, updatedAt: now })
            .where(eq(dapodikSubjects.id, existing.id));
        } else {
          await tx.insert(dapodikSubjects).values({
            mataPelajaranId: cat.mapelId,
            nama: cat.name,
            jurusanId: '',
            pilihanSekolah: false,
            pilihanEvaluasi: true,
            updatedAt: now,
          });
        }
      }

      // 2. Sync student mappings, dapodikStudentId, and anggota_rombel_id
      for (const stu of allStudents) {
        const remote = syncRes.anggotaRombelByNisn[stu.nisn];
        const externalPdId =
          remote?.pesertaDidikId ||
          stu.dapodikStudentId ||
          uuidDeterministic(`pd:${cfg.npsn}:${stu.nisn}`);
        const anggotaId =
          remote?.anggotaRombelId ||
          uuidDeterministic(`anggota-rombel:${cfg.npsn}:${stu.nisn}`);

        if (!stu.dapodikStudentId && externalPdId) {
          await tx
            .update(students)
            .set({ dapodikStudentId: externalPdId })
            .where(eq(students.id, stu.id));
        }

        const enrollment = enrollmentByStudentId.get(stu.id);
        if (enrollment && (!enrollment.dapodikAnggotaRombelId || remote?.anggotaRombelId)) {
          await tx
            .update(classStudents)
            .set({ dapodikAnggotaRombelId: anggotaId })
            .where(eq(classStudents.id, enrollment.id));
        }

        const existingMap = mappedByLocal.get(stu.id);
        if (!existingMap) {
          await tx.insert(dapodikExternalMappings).values({
            entityType: 'student',
            localId: stu.id,
            externalId: externalPdId,
            lastSyncedAt: now,
          });
          createdMaps++;
        } else {
          await tx
            .update(dapodikExternalMappings)
            .set({ externalId: externalPdId, lastSyncedAt: now })
            .where(eq(dapodikExternalMappings.id, existingMap.id));
          updatedMaps++;
        }
      }

      // 3. Ensure subjects have dapodikMapelId and dapodikPembelajaranId
      const classByGrade = new Map<number, (typeof allClasses)[number]>();
      for (const c of allClasses) {
        if (!classByGrade.has(c.gradeLevel)) classByGrade.set(c.gradeLevel, c);
      }
      for (const sub of allSubjects) {
        const cls = classByGrade.get(sub.gradeLevel);
        const rombelId =
          cls?.dapodikRombelId || uuidDeterministic(`rombel:${cfg.npsn}:${sub.gradeLevel}`);
        const mapelId = sub.dapodikMapelId || '100014000';
        const matchedPb = pbByName.get(`${rombelId}:${mapelId}`);
        const pbId =
          matchedPb?.pembelajaranId ||
          sub.dapodikPembelajaranId ||
          uuidDeterministic(`pb:${rombelId}:${sub.code}`);

        if (sub.dapodikMapelId !== mapelId || sub.dapodikPembelajaranId !== pbId) {
          await tx
            .update(subjects)
            .set({ dapodikMapelId: mapelId, dapodikPembelajaranId: pbId })
            .where(eq(subjects.id, sub.id));
        }
      }

      await tx
        .update(dapodikConfig)
        .set({
          lastSyncAt: now,
          connectionStatus:
            cfg.mode === 'Sandbox'
              ? 'Mode Pengujian Sandbox Aktif (Simulasi Protokol Resmi 5774)'
              : 'Terhubung ke Web Service Dapodik',
          updatedAt: now,
        })
        .where(eq(dapodikConfig.id, cfg.id));
    });

    await db.insert(dapodikSyncLogs).values({
      syncType: `Sinkronisasi Protokol Resmi (${cfg.mode})`,
      direction: 'Import',
      status: 'Berhasil',
      recordsProcessed: allStudents.length,
      recordsCreated: createdMaps,
      recordsUpdated: updatedMaps,
      errorsJson: '[]',
      createdAt: now,
    });

    await logAudit({
      userId: auth.user.id,
      actorName: auth.user.fullName,
      action: 'SYNC_DAPODIK_MASTER',
      entityType: 'dapodik_sync',
      details: `Sinkronisasi 6 endpoint Dapodik (${cfg.mode}) selesai untuk ${allStudents.length} peserta didik.`,
    });

    return NextResponse.json({
      ok: true,
      mode: cfg.mode,
      processed: allStudents.length,
      mappedNew: createdMaps,
      sections: syncRes.sections,
      message:
        cfg.mode === 'Sandbox'
          ? `[SANDBOX] Sinkronisasi 6 endpoint protokol Dapodik untuk ${allStudents.length} murid berhasil diverifikasi.`
          : `Sinkronisasi ${allStudents.length} data murid dan referensi Dapodik selesai.`,
    });
  }

  if (body?.action === 'submit_grades') {
    const submitSchema = z.object({
      classId: z.number().int().positive(),
      subjectId: z.number().int().positive(),
      isDryRun: z.boolean().default(true),
      allowResubmit: z.boolean().optional().default(false),
    });
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parameter pengiriman nilai tidak valid.' }, { status: 400 });
    }
    if (!canTeacherAccessScope(auth.user, parsed.data.classId, parsed.data.subjectId)) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses mengirim nilai Dapodik untuk kelas/mapel ini.' },
        { status: 403 }
      );
    }

    const [school] = await db.select().from(schools).limit(1);
    const [activeSemester] = await db
      .select()
      .from(semesters)
      .where(eq(semesters.isActive, true))
      .limit(1);
    const [cls] = await db.select().from(classes).where(eq(classes.id, parsed.data.classId)).limit(1);
    const [sub] = await db.select().from(subjects).where(eq(subjects.id, parsed.data.subjectId)).limit(1);

    if (!cls || !sub) {
      return NextResponse.json({ error: 'Rombel atau mata pelajaran tidak ditemukan.' }, { status: 404 });
    }

    const roster = await db
      .select({
        id: students.id,
        nisn: students.nisn,
        fullName: students.fullName,
        dapodikStudentId: students.dapodikStudentId,
        dapodikAnggotaRombelId: classStudents.dapodikAnggotaRombelId,
      })
      .from(classStudents)
      .innerJoin(students, eq(classStudents.studentId, students.id))
      .where(and(eq(classStudents.classId, cls.id), eq(classStudents.semesterId, activeSemester.id)));

    const scoreRows = await db
      .select()
      .from(summativeScores)
      .where(
        and(
          eq(summativeScores.classId, cls.id),
          eq(summativeScores.subjectId, sub.id),
          eq(summativeScores.semesterId, activeSemester.id)
        )
      );
    const scoreByStudent = new Map(scoreRows.map((s) => [s.studentId, s]));

    const missingCount = roster.filter((r) => {
      const sc = scoreByStudent.get(r.id);
      return !sc || sc.finalScore === null || sc.finalScore === undefined;
    }).length;

    if (missingCount > 0) {
      return NextResponse.json(
        {
          error: `Validasi gagal: masih terdapat ${missingCount} murid di kelas ${cls.name} yang belum memiliki nilai akhir untuk ${sub.name}.`,
        },
        { status: 422 }
      );
    }

    // Duplicate non-dry-run submission check
    if (!parsed.data.isDryRun && cfg?.mode === 'WebService') {
      const prevSuccess = await db
        .select()
        .from(dapodikSubmissionLogs)
        .where(
          and(
            eq(dapodikSubmissionLogs.classId, cls.id),
            eq(dapodikSubmissionLogs.subjectId, sub.id),
            eq(dapodikSubmissionLogs.semesterId, activeSemester.id),
            eq(dapodikSubmissionLogs.submissionPhase, 'NILAI_AKHIR'),
            eq(dapodikSubmissionLogs.isDryRun, false),
            eq(dapodikSubmissionLogs.status, 'Berhasil')
          )
        )
        .limit(1);
      if (prevSuccess.length > 0 && !parsed.data.allowResubmit) {
        return NextResponse.json(
          {
            error: `Nilai akhir ${sub.name} kelas ${cls.name} sudah pernah dikirim ke Dapodik. Gunakan mode Dry-Run untuk verifikasi ulang.`,
          },
          { status: 409 }
        );
      }
    }

    const npsn = cfg?.npsn || school.npsn;
    const protocolRes = await submitRaporToDapodikProtocol({
      webServiceUrl: cfg?.webServiceUrl || 'http://localhost:5774',
      npsn,
      apiToken: cfg?.apiToken || '',
      mode: (cfg?.mode as 'WebService' | 'Sandbox') || 'Sandbox',
      isDryRun: parsed.data.isDryRun,
      semesterLabel: activeSemester.name,
      rombonganBelajarId:
        cls.dapodikRombelId || uuidDeterministic(`rombel:${npsn}:${cls.name}`),
      subjectId: sub.id,
      subjectCode: sub.code,
      subjectName: sub.name,
      subjectSortOrder: sub.sortOrder,
      kkm: sub.kkm,
      dapodikMapelId: sub.dapodikMapelId || '100014000',
      dapodikPembelajaranId:
        sub.dapodikPembelajaranId ||
        uuidDeterministic(
          `pb:${cls.dapodikRombelId || uuidDeterministic(`rombel:${npsn}:${cls.name}`)}:${sub.code}`
        ),
      entries: roster.map((r) => {
        const sc = scoreByStudent.get(r.id)!;
        const fallbackAnggotaId =
          r.dapodikAnggotaRombelId || uuidDeterministic(`anggota-rombel:${npsn}:${r.nisn}`);
        return {
          studentId: r.id,
          nisn: r.nisn,
          fullName: r.fullName,
          anggotaRombelId: fallbackAnggotaId,
          finalScore: Number(sc.finalScore || 0),
          competencyDescription: sc.teacherNote || `Capaian pembelajaran ${sub.name} tercatat.`,
        };
      }),
    });

    await db.insert(dapodikSubmissionLogs).values({
      classId: cls.id,
      subjectId: sub.id,
      semesterId: activeSemester.id,
      submissionPhase: 'MATEV',
      isDryRun: parsed.data.isDryRun,
      status: protocolRes.matev.status,
      payloadSummaryJson: JSON.stringify({
        endpoint: 'postMatevRapor',
        id_evaluasi: protocolRes.matev.idEvaluasi,
        reusedExisting: protocolRes.matev.reusedExisting,
        updater_id: protocolRes.updaterId,
        mata_pelajaran_id: protocolRes.matev.payload.mata_pelajaran_id,
      }),
      responseMessage: protocolRes.matev.message,
      createdAt: now,
    });

    if (!protocolRes.matev.ok) {
      return NextResponse.json(
        { ok: false, error: protocolRes.matev.message, matev: protocolRes.matev },
        { status: 502 }
      );
    }

    await db.insert(dapodikSubmissionLogs).values({
      classId: cls.id,
      subjectId: sub.id,
      semesterId: activeSemester.id,
      submissionPhase: 'NILAI_AKHIR',
      isDryRun: parsed.data.isDryRun,
      status: protocolRes.nilai.status,
      payloadSummaryJson: JSON.stringify({
        endpoint: 'postNilai?table=rapor',
        id_evaluasi: protocolRes.matev.idEvaluasi,
        sentCount: protocolRes.nilai.sentCount,
        skippedCount: protocolRes.nilai.skippedCount,
        samplePayloads: protocolRes.nilai.samplePayloads,
      }),
      responseMessage: protocolRes.nilai.message,
      createdAt: now,
    });

    await logAudit({
      userId: auth.user.id,
      actorName: auth.user.fullName,
      action: 'SUBMIT_DAPODIK_GRADES',
      entityType: 'dapodik_submission',
      entityId: `${cls.id}-${sub.id}`,
      details: `Pengiriman postMatevRapor (${protocolRes.matev.idEvaluasi.slice(0, 8)}...) & postNilai?table=rapor untuk ${sub.name} (${cls.name}) — ${protocolRes.nilai.status}.`,
    });

    return NextResponse.json({
      ok: protocolRes.ok,
      updaterId: protocolRes.updaterId,
      matev: protocolRes.matev,
      nilai: protocolRes.nilai,
    });
  }

  return NextResponse.json({ error: 'Aksi Dapodik tidak dikenali.' }, { status: 400 });
}
