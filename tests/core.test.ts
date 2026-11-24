import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from '../lib/server/auth/password';
import { eq } from 'drizzle-orm';
import {
  checkRolePermission,
  ensurePermissionsCatalog,
  getDefaultRolePermissions,
  getRolePermissionsFromDb,
  isSystemRoleCode,
  LOCKED_SUPER_ADMIN_PERMISSIONS,
  normalizePermissionKeys,
  ROLE_DEFINITIONS,
} from '../lib/server/auth/rbac';
import {
  type AuthenticatedUser,
  canTeacherAccessScope,
  invalidateAllSessionCaches,
  invalidateSessionCacheByUserId,
  resolveUserScope,
} from '../lib/server/auth/session';
import {
  escHtml,
  formatUpperSafe,
  sanitizeFilename,
} from '../lib/utils/sanitize';
import {
  assessmentWeightSchema,
  dapodikConfigSchema,
  keasramaanIndicatorSchema,
  keasramaanScoreUpdateSchema,
  roleCreateSchema,
  studentCreateSchema,
  studentUpdateSchema,
} from '../lib/validators';
import {
  buildCompetencyDescription,
  buildCompetencyParts,
  calculateSummativeScores,
} from '../lib/server/services/assessment-engine';
import {
  extractJsonBody,
  normalizeWebServiceUrl,
  rowsOf,
  submitRaporToDapodikProtocol,
  submitToDapodikAdapter,
  uuidDeterministic,
  validateDapodikUrl,
} from '../lib/server/services/dapodik-adapter';
import {
  generateStudentTemplateWorkbook,
  parseStudentImportExcel,
} from '../lib/server/services/excel-service';
import {
  computeClassRanking,
  computeTppDisciplineMetrics,
} from '../lib/server/services/print-metrics';
import {
  deleteStudentPhotoFile,
  detectImageFormat,
  readStudentPhotoFile,
  resolveStoredStudentPhotoPath,
  saveStudentPhotoFile,
} from '../lib/server/services/student-photo';
import { getDb, resetDbConnection } from '../lib/server/db';
import {
  classes,
  classStudents,
  dapodikSubjects,
  keasramaanIndicators,
  rolePermissions,
  roles,
  schools,
  students,
  subjects,
  userClassScopes,
  users,
  userSubjectScopes,
} from '../lib/server/db/schema';
import { ensureSeeded, resetSeedFlag } from '../lib/server/db/seed';

test('Password hashing scrypt dan verifikasi token sesi', () => {
  const hash = hashPassword('SandiAman2026!');
  assert.ok(hash.includes(':'));
  assert.equal(verifyPassword('SandiAman2026!', hash), true);
  assert.equal(verifyPassword('Salah123', hash), false);
  assert.equal(verifyPassword('SandiAman2026!', null), false);

  const tok = generateSessionToken();
  assert.equal(tok.length, 64);
  const hashedTok = hashSessionToken(tok);
  assert.equal(hashedTok.length, 64);
  assert.notEqual(hashedTok, tok);
});

test('Kontrol akses RBAC untuk 9 peran sekolah Indonesia termasuk WALI_ASUH', () => {
  assert.equal(ROLE_DEFINITIONS.length, 9);
  assert.equal(checkRolePermission('SUPER_ADMIN', 'backup', 'create'), true);
  assert.equal(checkRolePermission('GURU', 'penilaian', 'update'), true);
  assert.equal(checkRolePermission('GURU', 'backup', 'create'), false);
  assert.equal(checkRolePermission('KEPALA_SEKOLAH', 'administrasi', 'approve'), true);
  assert.equal(checkRolePermission('OPERATOR_SEKOLAH', 'dapodik', 'create'), true);
  assert.equal(checkRolePermission('BENDAHARA', 'penilaian', 'delete'), false);
  assert.equal(checkRolePermission('WALI_ASUH', 'keasramaan', 'update'), true);
  assert.equal(checkRolePermission('GURU', 'keasramaan', 'read'), false);
});

test('Validasi skema Zod dalam Bahasa Indonesia', () => {
  const validWeight = assessmentWeightSchema.safeParse({
    subjectId: 1,
    classId: 1,
    semesterId: 1,
    weightLm: 40,
    weightSts: 30,
    weightSas: 30,
    kktpMin: 75,
  });
  assert.equal(validWeight.success, true);

  const badWeight = assessmentWeightSchema.safeParse({
    subjectId: 1,
    classId: 1,
    semesterId: 1,
    weightLm: 50,
    weightSts: 30,
    weightSas: 30,
    kktpMin: 75,
  });
  assert.equal(badWeight.success, false);

  const badNisn = studentCreateSchema.safeParse({
    nisn: '12345',
    nis: '24001',
    fullName: 'Budi',
    gender: 'L',
    birthPlace: 'Jakarta',
    birthDate: '2016-01-01',
    religion: 'Islam',
  });
  assert.equal(badNisn.success, false);

  const badDapodik = dapodikConfigSchema.safeParse({
    webServiceUrl: 'http://localhost:5774',
    npsn: '123',
    mode: 'Sandbox',
  });
  assert.equal(badDapodik.success, false);
});

test('Kalkulasi nilai sumatif, remedial KKTP, dan deskripsi kompetensi', () => {
  const calc = calculateSummativeScores(
    { lm1: 80, lm2: 90, lm3: 85, sts: 82, sas: 88 },
    { weightLm: 40, weightSts: 30, weightSas: 30, kktpMin: 75 }
  );
  // LM avg = 85; final = 85*0.4 + 82*0.3 + 88*0.3 = 34 + 24.6 + 26.4 = 85
  assert.equal(calc.lmAverage, 85);
  assert.equal(calc.finalScore, 85);
  assert.equal(calc.kktpPassed, true);

  const remedialCalc = calculateSummativeScores(
    { lm1: 60, lm2: 65, sts: 70, sas: 72, remedialScore: 85 },
    { weightLm: 40, weightSts: 30, weightSas: 30, kktpMin: 75 }
  );
  // Remedial caps effective LM at KKTP (75)
  assert.equal(remedialCalc.effectiveLm, 75);

  const desc = buildCompetencyDescription({
    studentName: 'Alya Putri',
    subjectName: 'Matematika',
    achievedMaterials: ['Pecahan Senilai'],
    needsGuidanceMaterials: ['Pengukuran Sudut'],
    finalScore: 89,
  });
  assert.ok(desc.includes('Alya'));
  assert.ok(desc.includes('Matematika'));
});

test('Adapter Dapodik URL validation, Dry-Run, dan mode Sandbox', async () => {
  assert.equal(validateDapodikUrl('http://localhost:5774').valid, true);
  assert.equal(validateDapodikUrl('http://169.254.169.254/latest').valid, false);
  assert.equal(validateDapodikUrl('ftp://localhost').valid, false);

  const dryRun = await submitToDapodikAdapter({
    webServiceUrl: 'http://localhost:5774',
    apiToken: '',
    mode: 'WebService',
    isDryRun: true,
    phase: 'MATEV',
    payload: {
      npsn: '20104567',
      semesterId: '1',
      rombonganBelajarId: 'RMB-4',
      mataPelajaranId: 'MTK-4',
      mataPelajaranNama: 'Matematika',
      jumlahMurid: 12,
    },
  });
  assert.equal(dryRun.ok, true);
  assert.ok(dryRun.status.includes('Dry-Run'));

  const sandboxRes = await submitToDapodikAdapter({
    webServiceUrl: 'http://localhost:5774',
    apiToken: '',
    mode: 'Sandbox',
    isDryRun: false,
    phase: 'NILAI_AKHIR',
    payload: {
      npsn: '20104567',
      semesterId: '1',
      rombonganBelajarId: 'RMB-4',
      mataPelajaranId: 'MTK-4',
      entries: [],
    },
  });
  assert.equal(sandboxRes.ok, true);
  assert.ok(sandboxRes.status.includes('Sandbox'));
});

test('Pembuatan template ExcelJS murid dan parsing impor', async () => {
  const buf = await generateStudentTemplateWorkbook();
  assert.ok(buf.byteLength > 1000);
  const preview = await parseStudentImportExcel(buf);
  assert.equal(preview.errors.length, 0);
  assert.equal(preview.validRows.length, 1);
  assert.equal(preview.validRows[0].nisn, '0165009001');
});

test('Seeding database SQLite SD Negeri Nusantara 01 dan kueri Drizzle ORM', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sekolahkita-test-'));
  const prevPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');
  resetDbConnection();

  try {
    await ensureSeeded();
    const db = getDb();
    const [school] = await db.select().from(schools).limit(1);
    const classRows = await db.select().from(classes);
    const studentRows = await db.select().from(students);

    assert.equal(school.name, 'SD Negeri Nusantara 01');
    assert.equal(school.npsn, '20104567');
    assert.equal(classRows.length, 6);
    assert.ok(studentRows.length >= 25);
  } finally {
    resetDbConnection();
    if (prevPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = prevPath;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('RBAC dinamis SQLite: penguncian SUPER_ADMIN, peran kustom, dan pemulihan bawaan', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sekolahkita-rbac-'));
  const prevPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(tmpDir, 'rbac.db');
  resetDbConnection();

  try {
    await ensureSeeded();
    const db = getDb();
    const permMap = await ensurePermissionsCatalog();

    // 1. Validasi kunci SUPER_ADMIN saat normalisasi
    const normalizedSuper = normalizePermissionKeys(['siswa:read'], 'SUPER_ADMIN');
    for (const locked of LOCKED_SUPER_ADMIN_PERMISSIONS) {
      assert.ok(normalizedSuper.includes(locked), `Izin terkunci ${locked} wajib dipertahankan`);
    }
    assert.equal(isSystemRoleCode('SUPER_ADMIN'), true);
    assert.equal(isSystemRoleCode('KOORDINATOR_P5'), false);

    // 2. Validasi Zod pembuatan peran kustom
    assert.equal(
      roleCreateSchema.safeParse({
        code: 'KOORDINATOR_P5',
        name: 'Koordinator Kokurikuler',
        description: 'Mengelola projek kokurikuler',
      }).success,
      true
    );
    assert.equal(
      roleCreateSchema.safeParse({
        code: 'invalid-code',
        name: 'X',
        description: 'Y',
      }).success,
      false
    );

    // 3. Modifikasi dinamis rolePermissions di SQLite untuk GURU
    const [guruRole] = await db.select().from(roles).where(eq(roles.code, 'GURU')).limit(1);
    assert.ok(guruRole);

    const initialPerms = await getRolePermissionsFromDb(guruRole.id, guruRole.code);
    assert.equal(initialPerms.includes('backup:read'), false);

    const backupReadId = permMap.get('backup:read');
    assert.ok(backupReadId);
    await db.insert(rolePermissions).values({
      roleId: guruRole.id,
      permissionId: backupReadId,
    });

    const updatedPerms = await getRolePermissionsFromDb(guruRole.id, guruRole.code);
    assert.equal(updatedPerms.includes('backup:read'), true);

    // 4. Pemulihan izin bawaan sistem
    const defaultGuru = Array.from(getDefaultRolePermissions('GURU')).sort();
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, guruRole.id));
    for (const key of defaultGuru) {
      const pId = permMap.get(key);
      if (pId) {
        await db.insert(rolePermissions).values({ roleId: guruRole.id, permissionId: pId });
      }
    }
    const restoredPerms = await getRolePermissionsFromDb(guruRole.id, guruRole.code);
    assert.equal(restoredPerms.includes('backup:read'), false);
    assert.deepEqual(restoredPerms, defaultGuru);

    // 5. Pembuatan & duplikasi peran kustom
    const [customRole] = await db
      .insert(roles)
      .values({
        code: 'KOORDINATOR_P5',
        name: 'Koordinator Kokurikuler',
        description: 'Peran kustom P5',
        isSystem: false,
      })
      .returning();
    const dashReadId = permMap.get('dashboard:read')!;
    const penReadId = permMap.get('penilaian:read')!;
    await db.insert(rolePermissions).values([
      { roleId: customRole.id, permissionId: dashReadId },
      { roleId: customRole.id, permissionId: penReadId },
    ]);
    const customPerms = await getRolePermissionsFromDb(customRole.id, customRole.code);
    assert.deepEqual(customPerms, ['dashboard:read', 'penilaian:read']);
  } finally {
    resetDbConnection();
    if (prevPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = prevPath;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Cakupan kelas & mapel fail-closed (ALL, ASSIGNED, WALI_KELAS, GURU, CUSTOM)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sekolahkita-scope-'));
  const prevPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(tmpDir, 'scope.db');
  resetDbConnection();

  const makeMockUser = (overrides: Partial<AuthenticatedUser>): AuthenticatedUser => ({
    id: 99,
    username: 'mock',
    fullName: 'Mock User',
    email: 'mock@sekolah.id',
    roleId: 1,
    roleCode: 'GURU',
    roleName: 'Guru',
    isSystemRole: true,
    teacherId: null,
    isActive: true,
    scopeMode: 'ASSIGNED',
    hasFullScope: false,
    permissions: ['penilaian:read', 'penilaian:update'],
    assignedClassIds: [],
    assignedSubjectIds: [],
    homeroomClassIds: [],
    ...overrides,
  });

  try {
    // A. hasFullScope selalu diizinkan
    const adminUser = makeMockUser({ roleCode: 'SUPER_ADMIN', scopeMode: 'ALL', hasFullScope: true });
    assert.equal(canTeacherAccessScope(adminUser, 4, 12), true);

    // B. ASSIGNED tanpa kelas/mapel ditugaskan wajib fail-closed (false)
    const unassignedGuru = makeMockUser({ roleCode: 'GURU', scopeMode: 'ASSIGNED' });
    assert.equal(canTeacherAccessScope(unassignedGuru), false);
    assert.equal(canTeacherAccessScope(unassignedGuru, 1), false);
    assert.equal(canTeacherAccessScope(unassignedGuru, 1, 10), false);

    // C. WALI_KELAS boleh membaca/menilai semua mapel di kelas perwaliannya, tetapi ditolak di kelas lain
    const waliUser = makeMockUser({
      roleCode: 'WALI_KELAS',
      scopeMode: 'ASSIGNED',
      assignedClassIds: [4],
      homeroomClassIds: [4],
      assignedSubjectIds: [41],
    });
    assert.equal(canTeacherAccessScope(waliUser, 4, 999), true);
    assert.equal(canTeacherAccessScope(waliUser, 5, 41), false);

    // D. GURU mapel hanya boleh pada kelas & mapel yang ditugaskan
    const mapelUser = makeMockUser({
      roleCode: 'GURU',
      scopeMode: 'ASSIGNED',
      assignedClassIds: [4, 5],
      assignedSubjectIds: [41],
    });
    assert.equal(canTeacherAccessScope(mapelUser, 4, 41), true);
    assert.equal(canTeacherAccessScope(mapelUser, 4, 42), false);
    assert.equal(canTeacherAccessScope(mapelUser, 6, 41), false);

    // E. CUSTOM scope dengan tabel user_class_scopes & user_subject_scopes di SQLite
    await ensureSeeded();
    const db = getDb();
    const [waliRole] = await db.select().from(roles).where(eq(roles.code, 'WALI_KELAS')).limit(1);
    const classRows = await db.select().from(classes);
    const subjectRows = await db.select().from(subjects);
    assert.ok(waliRole && classRows.length >= 2 && subjectRows.length >= 2);

    const [customUser] = await db
      .insert(users)
      .values({
        username: 'guru_kustom_scope',
        fullName: 'Guru Kustom Scope',
        email: 'kustom@sekolah.id',
        passwordHash: 'test:hash',
        roleId: waliRole.id,
        scopeMode: 'CUSTOM',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    await db.insert(userClassScopes).values({
      userId: customUser.id,
      classId: classRows[0].id,
    });
    await db.insert(userSubjectScopes).values({
      userId: customUser.id,
      subjectId: subjectRows[0].id,
    });

    const resolved = await resolveUserScope({
      userId: customUser.id,
      roleCode: 'WALI_KELAS',
      teacherId: null,
      scopeMode: 'CUSTOM',
    });

    assert.equal(resolved.hasFullScope, false);
    assert.deepEqual(resolved.assignedClassIds, [classRows[0].id]);
    assert.deepEqual(resolved.assignedSubjectIds, [subjectRows[0].id]);

    const scopedUser = makeMockUser({
      id: customUser.id,
      roleCode: 'WALI_KELAS',
      scopeMode: 'CUSTOM',
      ...resolved,
    });
    assert.equal(canTeacherAccessScope(scopedUser, classRows[0].id, subjectRows[0].id), true);
    assert.equal(canTeacherAccessScope(scopedUser, classRows[0].id, subjectRows[1].id), false);
    assert.equal(canTeacherAccessScope(scopedUser, classRows[1].id, subjectRows[0].id), false);
  } finally {
    resetDbConnection();
    if (prevPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = prevPath;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Sanitasi HTML aman, formatUpperSafe sebelum escaping, dan sanitizeFilename', () => {
  assert.equal(escHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  // Karakter '&' dalam huruf kapital tetap menjadi '&amp;' (bukan '&AMP;')
  assert.equal(formatUpperSafe('sdn nusantara & mitra <01>'), 'SDN NUSANTARA &amp; MITRA &lt;01&gt;');
  assert.equal(sanitizeFilename('../../Laporan Nilai 2026!.xlsx'), 'Laporan_Nilai_2026_.xlsx');
  assert.equal(sanitizeFilename('   ', 'kosong'), 'kosong');
});

test('Protokol WebService Dapodik: normalisasi URL, UUID v5 RFC 4122, extractJsonBody, rowsOf, dan submitRapor', async () => {
  assert.equal(normalizeWebServiceUrl('192.168.8.114:5774'), 'http://192.168.8.114:5774');
  assert.equal(normalizeWebServiceUrl('http://localhost:5774/WebService/'), 'http://localhost:5774');

  const uuid1 = uuidDeterministic('sekolahkita-matev:20261:RMB-4:400010000');
  const uuid2 = uuidDeterministic('sekolahkita-matev:20261:RMB-4:400010000');
  const uuid3 = uuidDeterministic('sekolahkita-matev:20261:RMB-4:300010000');
  assert.equal(uuid1, uuid2);
  assert.notEqual(uuid1, uuid3);
  assert.match(uuid1, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

  const wrappedJson = extractJsonBody('<br /><b>Notice:</b> ok\n{"rows":{"nama":"SD Negeri Nusantara 01"}}<!-- end -->');
  assert.deepEqual(rowsOf(wrappedJson), [{ nama: 'SD Negeri Nusantara 01' }]);
  assert.deepEqual(rowsOf({ datas: [{ id: 1 }, { id: 2 }] }), [{ id: 1 }, { id: 2 }]);
  assert.throws(() => rowsOf({ success: false, message: 'Token tidak valid' }), /Token tidak valid/);

  const dryRun = await submitRaporToDapodikProtocol({
    webServiceUrl: '192.168.8.114:5774',
    apiToken: 'token-demo',
    mode: 'WebService',
    isDryRun: true,
    npsn: '20104567',
    semesterLabel: '20261',
    rombonganBelajarId: 'RMB-4',
    subjectId: 12,
    subjectName: 'Matematika',
    subjectCode: 'MTK',
    subjectSortOrder: 4,
    kkm: 75,
    dapodikMapelId: '400010000',
    dapodikPembelajaranId: 'pb-mtk-4',
    entries: [
      {
        studentId: 1,
        nisn: '0165001001',
        fullName: 'Alya Putri',
        anggotaRombelId: 'ar-001',
        finalScore: 90,
        competencyDescription: 'Sangat baik dalam operasi pecahan.',
      },
      {
        studentId: 2,
        nisn: '0165001002',
        fullName: 'Bima Pratama',
        anggotaRombelId: '',
        finalScore: 80,
        competencyDescription: 'Baik dalam geometri dasar.',
      },
    ],
  });
  assert.equal(dryRun.ok, true);
  assert.equal(dryRun.nilai.sentCount, 1);
  assert.equal(dryRun.nilai.skippedCount, 1);
  assert.match(dryRun.matev.idEvaluasi, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

  const sandbox = await submitRaporToDapodikProtocol({
    webServiceUrl: 'http://localhost:5774',
    apiToken: '',
    mode: 'Sandbox',
    isDryRun: false,
    npsn: '20104567',
    semesterLabel: '20261',
    rombonganBelajarId: 'RMB-4',
    subjectId: 12,
    subjectName: 'Matematika',
    subjectCode: 'MTK',
    subjectSortOrder: 4,
    kkm: 75,
    dapodikMapelId: '400010000',
    dapodikPembelajaranId: 'pb-mtk-4',
    entries: [
      {
        studentId: 1,
        nisn: '0165001001',
        fullName: 'Alya Putri',
        anggotaRombelId: 'ar-001',
        finalScore: 90,
        competencyDescription: 'Sangat baik dalam operasi pecahan.',
      },
    ],
  });
  assert.equal(sandbox.ok, true);
  assert.ok(sandbox.matev.status.includes('Sandbox'));
  assert.equal(sandbox.nilai.sentCount, 1);
});

test('Pemisahan 2 paragraf capaian kompetensi dan validasi Zod Keasramaan', () => {
  const parts = buildCompetencyParts({
    studentName: 'Alya Putri',
    subjectName: 'Matematika',
    achievedMaterials: ['Pecahan Senilai'],
    needsGuidanceMaterials: ['Pengukuran Sudut'],
    finalScore: 89,
  });
  assert.ok(parts.achievedText.includes('Pecahan Senilai'));
  assert.ok(parts.needsGuidanceText.includes('Pengukuran Sudut'));
  assert.ok(parts.fullText.includes(parts.achievedText));
  assert.ok(parts.fullText.includes(parts.needsGuidanceText));

  assert.equal(
    keasramaanIndicatorSchema.safeParse({
      category: 'A. Kepemimpinan',
      name: 'Kedisiplinan apel pagi',
      sortOrder: 6,
      isActive: true,
    }).success,
    true
  );
  assert.equal(
    keasramaanScoreUpdateSchema.safeParse({
      classId: 1,
      semesterId: 1,
      entries: [
        {
          studentId: 1,
          indicatorId: 1,
          predicate: 'A',
          achievedNote: 'Konsisten beribadah',
          guidanceNote: '',
          notes: 'Tertib',
          waliAsramaName: 'Ustadz Hasan',
          waliAsuhName: 'Ustadz Ahmad',
        },
      ],
    }).success,
    true
  );
  assert.equal(
    keasramaanScoreUpdateSchema.safeParse({
      classId: 1,
      semesterId: 1,
      entries: [{ studentId: 1, indicatorId: 1, predicate: 'Z' }],
    }).success,
    false
  );
});

test('Seeding Keasramaan, WALI_ASUH, dapodikSubjects, dan idempotensi syncUpgradedSeedDefaults serta cache sesi', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sekolahkita-upgrade-'));
  const prevPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(tmpDir, 'upgrade.db');
  resetDbConnection();
  resetSeedFlag();

  try {
    await ensureSeeded();
    // Uji idempotensi saat dijalankan ulang setelah resetSeedFlag
    resetSeedFlag();
    await ensureSeeded();

    const db = getDb();
    const indicators = await db.select().from(keasramaanIndicators);
    const dapSubjects = await db.select().from(dapodikSubjects);
    const [waliAsuhUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, 'waliasuh'))
      .limit(1);
    const enrollments = await db.select().from(classStudents);

    assert.ok(indicators.length >= 5);
    assert.ok(dapSubjects.length >= 9);
    assert.ok(waliAsuhUser);
    assert.ok(enrollments.some((e) => Boolean(e.dapodikAnggotaRombelId)));

    // Pastikan helper invalidasi cache sesi berjalan bersih
    invalidateSessionCacheByUserId(waliAsuhUser.id);
    invalidateAllSessionCaches();
  } finally {
    resetDbConnection();
    resetSeedFlag();
    if (prevPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = prevPath;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Kalkulasi peringkat kelas untuk Piagam dan indeks disiplin Laporan TPP', () => {
  const ranked = computeClassRanking(
    [
      { studentId: 1, nisn: '0165001001', nis: '2401', fullName: 'Alya Putri' },
      { studentId: 2, nisn: '0165001002', nis: '2402', fullName: 'Bima Pratama' },
      { studentId: 3, nisn: '0165001003', nis: '2403', fullName: 'Citra Dewi' },
      { studentId: 4, nisn: '0165001004', nis: '2404', fullName: 'Dodi Santoso' },
    ],
    [
      { studentId: 1, finalScore: 92 },
      { studentId: 1, finalScore: 90 },
      { studentId: 2, finalScore: 85 },
      { studentId: 2, finalScore: 85 },
      { studentId: 3, finalScore: 85 },
      { studentId: 3, finalScore: 85 },
      { studentId: 4, finalScore: 76 },
    ],
    [
      { studentId: 1, title: 'Kewirausahaan', predicate: 'Sangat Berkembang' },
      { studentId: 2, title: 'Kewirausahaan', predicate: 'Berkembang Sesuai Harapan' },
    ]
  );

  // Dense ranking dengan tie pada 85 (peringkat 1, 2, 2, 4)
  assert.equal(ranked[0].studentId, 1);
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[0].averageScore, 91);
  assert.equal(ranked[0].achievementPredicate, 'Sangat Memuaskan (Cumlaude Sekolah)');
  assert.ok(ranked[0].cocurricularNotes.includes('Kewirausahaan'));

  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[2].rank, 2);
  assert.equal(ranked[1].achievementPredicate, 'Memuaskan');

  assert.equal(ranked[3].rank, 4);
  assert.equal(ranked[3].achievementPredicate, 'Baik');

  const tpp = computeTppDisciplineMetrics({
    teachers: [
      {
        id: 10,
        fullName: 'Ibu Siti Rahmawati',
        nip: '198501012010012001',
        nuptk: '1234567890123456',
        employmentStatus: 'PNS',
        specialization: 'Guru Kelas',
      },
      {
        id: 11,
        fullName: 'Pak Hendra Wijaya',
        nip: '198802022014021002',
        nuptk: null,
        employmentStatus: 'PPPK',
        specialization: 'Matematika',
      },
      {
        id: 12,
        fullName: 'Ibu Nisa',
        nip: null,
        nuptk: null,
        employmentStatus: 'Honorer',
        specialization: 'Bahasa Inggris',
      },
    ],
    weeklyHoursByTeacher: new Map([
      [10, 24],
      [11, 18],
    ]),
    attendanceRows: [
      { teacherId: 10, date: '2026-09-01', status: 'Hadir', checkInTime: '07:05' },
      { teacherId: 10, date: '2026-09-02', status: 'Dinas Luar', checkInTime: null },
      { teacherId: 11, date: '2026-09-01', status: 'Hadir', checkInTime: '07:25' },
      { teacherId: 11, date: '2026-09-02', status: 'Alpa', checkInTime: null },
    ],
    approvedTravelsByTeacher: new Map([[10, 1]]),
  });

  assert.equal(tpp.effectiveWorkDays, 2);
  const siti = tpp.rows.find((r) => r.teacherId === 10)!;
  assert.equal(siti.hadir, 1);
  assert.equal(siti.tepatWaktu, 1);
  assert.equal(siti.dinasLuar, 1);
  assert.equal(siti.approvedTravelsCount, 1);
  assert.equal(siti.attendancePercent, 100);
  assert.equal(siti.tppDisciplineScore, 100);
  assert.equal(siti.tppCategory, 'Sangat Baik (100% TPP)');

  const hendra = tpp.rows.find((r) => r.teacherId === 11)!;
  assert.equal(hendra.terlambat, 1);
  assert.equal(hendra.alpa, 1);
  // (1 - 0.15) / 2 * 100 = 42.5
  assert.equal(hendra.tppDisciplineScore, 42.5);
  assert.equal(hendra.tppCategory, 'Perlu Pembinaan');

  const nisa = tpp.rows.find((r) => r.teacherId === 12)!;
  assert.equal(nisa.recordedDays, 0);
  assert.equal(nisa.tppDisciplineScore, 0);
  assert.equal(nisa.tppCategory, 'Belum Ada Data');
});

test('Layanan foto murid lokal: deteksi magic-bytes, penyimpanan aman, dan pengurungan direktori', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sekolahkita-photo-'));
  const prevPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(tmpDir, 'photo.db');
  resetDbConnection();

  try {
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);
    const detected = detectImageFormat(pngBytes);
    assert.deepEqual(detected, { ext: 'png', contentType: 'image/png' });

    const invalidBytes = Buffer.from('<script>alert(1)</script>');
    assert.equal(detectImageFormat(invalidBytes), null);
    assert.throws(() => saveStudentPhotoFile(7, invalidBytes), /Format gambar tidak valid/);

    const saved = saveStudentPhotoFile(7, pngBytes);
    assert.ok(saved.fileName.startsWith('7-') && saved.fileName.endsWith('.png'));
    assert.equal(saved.contentType, 'image/png');

    const loaded = readStudentPhotoFile(saved.fileName);
    assert.ok(loaded);
    assert.equal(loaded?.contentType, 'image/png');
    assert.equal(loaded?.buffer.equals(pngBytes), true);

    assert.equal(resolveStoredStudentPhotoPath('../outside.png'), null);
    assert.equal(resolveStoredStudentPhotoPath('subdir/file.png'), null);
    assert.ok(resolveStoredStudentPhotoPath(saved.fileName));

    assert.equal(deleteStudentPhotoFile(saved.fileName), true);
    assert.equal(readStudentPhotoFile(saved.fileName), null);
  } finally {
    resetDbConnection();
    if (prevPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = prevPath;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Validasi Zod detail murid terstruktur (NIK, alamat, orang tua, wali, dan wali asuh)', () => {
  const validUpdate = studentUpdateSchema.safeParse({
    id: 1,
    fullName: 'Alya Putri',
    nickname: 'Alya',
    nik: '3171015005160001',
    childOrder: 1,
    siblingCount: 2,
    rtRw: '003/005',
    village: 'Menteng',
    district: 'Menteng',
    regency: 'Jakarta Pusat',
    province: 'DKI Jakarta',
    postalCode: '10310',
    fatherNik: '3171011001800002',
    fatherEducation: 'S1/D4',
    fatherJob: 'Karyawan Swasta',
    guardianRelation: 'Paman',
    waliAsuhTeacherId: 2,
    waliAsuhName: 'Pak Hendra Wijaya',
    dormitoryRoom: 'Asrama A-02',
  });
  assert.equal(validUpdate.success, true);

  const badNik = studentUpdateSchema.safeParse({
    id: 1,
    nik: '12345',
  });
  assert.equal(badNik.success, false);
});



