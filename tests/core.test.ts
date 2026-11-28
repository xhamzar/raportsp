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
  formatIndoDate,
  formatIndoDateRange,
  formatIndoDateTime,
  formatIndoEndOfMonthDate,
  formatIndoMonthYear,
} from '../lib/utils';
import {
  assessmentWeightSchema,
  cocurricularProjectSchema,
  dapodikConfigSchema,
  extracurricularSchema,
  formativeBatchSchema,
  keasramaanIndicatorSchema,
  keasramaanScoreUpdateSchema,
  learningObjectiveSchema,
  roleCreateSchema,
  studentCreateSchema,
  studentUpdateSchema,
  subjectCreateSchema,
  summativeScoreUpdateSchema,
} from '../lib/validators';
import {
  buildCompetencyDescription,
  buildCompetencyParts,
  calculateSummativeScores,
} from '../lib/server/services/assessment-engine';
import {
  buildCocurricularDescription,
  buildExtracurricularDescription,
  computeAverageTwo,
  computeScopeAveragesFromTpScores,
} from '../lib/assessment-helpers';
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
  generateCocurricularTemplateWorkbook,
  generateExtracurricularTemplateWorkbook,
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
import {
  deleteSchoolAssetFile,
  readSchoolAssetFile,
  resolveSchoolAssetPath,
  saveSchoolAssetFile,
} from '../lib/server/services/school-assets';
import { resolveTutorialGuide } from '../lib/tutorial-guides';
import { buildPdfFileName, computePageSlices } from '../lib/pdf-renderer';
import {
  decryptApiKey,
  encryptApiKey,
  maskApiKey,
  resolveProviderEndpoint,
  validateAiBaseUrl,
} from '../lib/server/services/ai-keys';
import { resolveEffectiveAiCredentialsForUser } from '../lib/server/services/ai-assistant';
import { getDb, resetDbConnection } from '../lib/server/db';
import {
  aiConfigs,
  classes,
  classStudents,
  cocurricularProjects,
  cocurricularScores,
  dapodikSubjects,
  extracurriculars,
  extracurricularScores,
  keasramaanIndicators,
  rolePermissions,
  roles,
  schools,
  semesters,
  students,
  subjects,
  summativeScores,
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

test('Pemformatan tanggal Indonesia baku KBBI (1 Februari 2016)', () => {
  assert.equal(formatIndoDate('2016-02-01'), '1 Februari 2016');
  assert.equal(formatIndoDate('2026-11-24T08:30:15Z'), '24 November 2026');
  assert.equal(formatIndoDate(''), '-');
  assert.equal(formatIndoDate(null), '-');
  assert.equal(formatIndoDateTime('2026-11-24T08:30:15Z'), '24 November 2026, 08:30');
  assert.equal(formatIndoDateRange('2016-02-01', '2016-02-01'), '1 Februari 2016');
  assert.equal(
    formatIndoDateRange('2016-02-01', '2016-02-05'),
    '1 Februari 2016 s.d. 5 Februari 2016'
  );
  assert.equal(formatIndoMonthYear('2016-02'), 'Februari 2016');
  assert.equal(formatIndoEndOfMonthDate('2016-02'), '29 Februari 2016');
});

test('Penyimpanan aman tanda tangan & stempel sekolah serta resolusi panduan tutorial per menu', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sekolahkita-assets-'));
  const prevPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(tmpDir, 'assets.db');
  resetDbConnection();

  try {
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);
    const invalidBytes = Buffer.from('<svg onload="alert(1)"></svg>');
    assert.throws(() => saveSchoolAssetFile('signature', invalidBytes), /Format gambar tidak valid/);

    const sig = saveSchoolAssetFile('signature', pngBytes);
    assert.ok(sig.fileName.startsWith('signature-') && sig.fileName.endsWith('.png'));
    const loadedSig = readSchoolAssetFile(sig.fileName);
    assert.equal(loadedSig?.contentType, 'image/png');
    assert.equal(loadedSig?.buffer.equals(pngBytes), true);

    const stamp = saveSchoolAssetFile('stamp', pngBytes);
    assert.ok(stamp.fileName.startsWith('stamp-') && stamp.fileName.endsWith('.png'));

    assert.equal(resolveSchoolAssetPath('../etc/passwd'), null);
    assert.equal(resolveSchoolAssetPath('nested/stamp.png'), null);
    assert.ok(resolveSchoolAssetPath(stamp.fileName));

    assert.equal(deleteSchoolAssetFile(sig.fileName), true);
    assert.equal(readSchoolAssetFile(sig.fileName), null);
    assert.equal(deleteSchoolAssetFile(stamp.fileName), true);
  } finally {
    resetDbConnection();
    if (prevPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = prevPath;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  assert.equal(resolveTutorialGuide('/kurikulum').menuLabel, 'Intrakurikuler & RPM');
  assert.ok(resolveTutorialGuide('/kurikulum').warning);
  assert.equal(resolveTutorialGuide('/intrakurikuler').menuLabel, 'Mata Pelajaran Intrakurikuler');
  assert.equal(resolveTutorialGuide('/kokurikuler').menuLabel, 'Kokurikuler (8 DPL)');
  assert.equal(resolveTutorialGuide('/ekstrakurikuler').menuLabel, 'Ekstrakurikuler');
  assert.equal(resolveTutorialGuide('/keasramaan').menuLabel, 'Mata Evaluasi Keasramaan');
  assert.equal(resolveTutorialGuide('/penilaian').menuLabel, 'Input Nilai');
  assert.equal(resolveTutorialGuide('/penilaian/formatif').menuLabel, 'Asesmen Formatif');
  assert.equal(resolveTutorialGuide('/penilaian/sumatif').menuLabel, 'Asesmen Sumatif');
  assert.equal(resolveTutorialGuide('/rapor').menuLabel, 'Cetak Dokumen');
  assert.equal(resolveTutorialGuide('/pengaturan').menuLabel, 'Pengaturan');
  assert.equal(resolveTutorialGuide('/tidak-dikenal').menuLabel, 'Beranda');
  assert.equal(
    buildPdfFileName(['Rapor', 'Kelas 4 A', '2026/2027']),
    'Rapor_Kelas_4_A_2026_2027.pdf'
  );
  assert.equal(buildPdfFileName(['', null]), 'Dokumen_Sekolah.pdf');

  // Paginasi pintar: baris yang melintasi batas potong harus pindah utuh ke halaman berikutnya
  const slices = computePageSlices(3600, 2246, 70, [
    { start: 2100, end: 2260 }, // melintasi rawCut ~2176 -> potong di 2100
    { start: 3000, end: 3580 }, // blok tanda tangan + footer -> ikut utuh di halaman 2
  ]);
  assert.equal(slices.length, 2);
  assert.equal(slices[0].endY, 2100);
  assert.equal(slices[1].startY, 2100);
  assert.equal(slices[1].endY, 3600);

  // Dengan bottomReservePx = 104 (catatan kaki tiap halaman), halaman tunggal > 2142 dipecah bersih
  const footerSlices = computePageSlices(2200, 2246, 70, [{ start: 1950, end: 2120 }], 104);
  assert.equal(footerSlices.length, 2);
  assert.equal(footerSlices[0].endY, 1950);
  assert.equal(footerSlices[1].startY, 1950);
  assert.equal(footerSlices[1].endY, 2200);
});

test('Enkripsi Kunci API AI, validasi SSRF Base URL, endpoint provider, dan cakupan sekolah/pribadi', async () => {
  // 1. Enkripsi AES-256-GCM & masking
  const sampleKey = 'demo-provider-token-12345678';
  const encrypted = encryptApiKey(sampleKey);
  assert.ok(encrypted.startsWith('v1:'));
  assert.equal(encrypted.includes(sampleKey), false);
  assert.equal(decryptApiKey(encrypted), sampleKey);
  assert.equal(decryptApiKey(`${encrypted}00`), null);
  assert.equal(maskApiKey(sampleKey), 'demo••••5678');

  // 2. Validasi SSRF Base URL
  assert.deepEqual(validateAiBaseUrl(''), { valid: true, normalized: '' });
  assert.deepEqual(validateAiBaseUrl('https://generativelanguage.googleapis.com/'), {
    valid: true,
    normalized: 'https://generativelanguage.googleapis.com',
  });
  assert.equal(validateAiBaseUrl('http://generativelanguage.googleapis.com').valid, false);
  assert.equal(validateAiBaseUrl('https://localhost:8443/v1').valid, false);
  assert.equal(validateAiBaseUrl('https://127.0.0.1/v1').valid, false);
  assert.equal(validateAiBaseUrl('https://169.254.169.254/latest').valid, false);
  assert.equal(validateAiBaseUrl('https://192.168.1.10/v1').valid, false);
  assert.equal(validateAiBaseUrl('https://openrouter.ai/api/v1?key=abc').valid, false);

  // 3. Resolusi endpoint Gemini native vs OpenAI-compatible
  const geminiDefault = resolveProviderEndpoint({ model: 'gemini-2.5-flash', baseUrl: '' });
  assert.equal(geminiDefault.mode, 'gemini-native');
  assert.equal(
    geminiDefault.endpointUrl,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
  );

  const openRouter = resolveProviderEndpoint({
    model: 'google/gemini-2.5-flash',
    baseUrl: 'https://openrouter.ai/api/v1/',
  });
  assert.equal(openRouter.mode, 'openai-compat');
  assert.equal(openRouter.endpointUrl, 'https://openrouter.ai/api/v1/chat/completions');

  const deepSeekRoot = resolveProviderEndpoint({
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
  });
  assert.equal(deepSeekRoot.mode, 'openai-compat');
  assert.equal(deepSeekRoot.endpointUrl, 'https://api.deepseek.com/v1/chat/completions');

  const geminiOpenAiCompat = resolveProviderEndpoint({
    model: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  });
  assert.equal(geminiOpenAiCompat.mode, 'openai-compat');
  assert.equal(
    geminiOpenAiCompat.endpointUrl,
    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
  );

  // 4. Isolasi kunci sekolah (Admin/Kepsek) vs kunci pribadi (Guru)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sekolahkita-aikeys-'));
  const prevPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(tmpDir, 'aikeys.db');
  resetDbConnection();
  resetSeedFlag();

  try {
    await ensureSeeded();
    const db = getDb();
    const allUsers = await db.select().from(users);
    const adminUser = allUsers[0];
    const guruUser = allUsers[1] || allUsers[0];

    const now = new Date().toISOString();
    await db.insert(aiConfigs).values({
      ownerKey: 'school',
      scope: 'school',
      userId: null,
      apiKeyEnc: encryptApiKey('school-key-9999'),
      model: 'gemini-2.5-flash',
      baseUrl: '',
      updatedAt: now,
    });

    const adminAuth: AuthenticatedUser = {
      id: adminUser.id,
      username: adminUser.username,
      fullName: adminUser.fullName,
      email: adminUser.email,
      roleId: adminUser.roleId,
      roleCode: 'ADMIN_SEKOLAH',
      roleName: 'Admin Sekolah',
      isSystemRole: true,
      teacherId: null,
      isActive: true,
      scopeMode: 'ALL',
      hasFullScope: true,
      permissions: ['ai:read', 'ai:create', 'sekolah:update'],
      assignedClassIds: [],
      assignedSubjectIds: [],
      homeroomClassIds: [],
    };

    const guruAuth: AuthenticatedUser = {
      id: guruUser.id + 50,
      username: 'guru.test',
      fullName: 'Guru Test',
      email: 'guru@example.com',
      roleId: guruUser.roleId,
      roleCode: 'GURU',
      roleName: 'Guru Mapel',
      isSystemRole: true,
      teacherId: null,
      isActive: true,
      scopeMode: 'ASSIGNED',
      hasFullScope: false,
      permissions: ['ai:read', 'ai:create'],
      assignedClassIds: [],
      assignedSubjectIds: [],
      homeroomClassIds: [],
    };

    // Admin mewarisi kunci sekolah jika belum mengisi kunci pribadi
    const resolvedAdmin = await resolveEffectiveAiCredentialsForUser(adminAuth);
    assert.equal(resolvedAdmin?.source, 'school');
    assert.equal(resolvedAdmin?.apiKey, 'school-key-9999');

    // Guru tidak mewarisi kunci sekolah (wajib isi kunci pribadi)
    const resolvedGuruEmpty = await resolveEffectiveAiCredentialsForUser(guruAuth);
    assert.equal(resolvedGuruEmpty, null);

    // Setelah guru (via user valid di DB) mengisi kunci pribadi, kunci pribadi dipakai
    await db.insert(aiConfigs).values({
      ownerKey: `user:${guruUser.id}`,
      scope: 'user',
      userId: guruUser.id,
      apiKeyEnc: encryptApiKey('guru-personal-7777'),
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com',
      updatedAt: now,
    });

    const resolvedGuruSaved = await resolveEffectiveAiCredentialsForUser({
      ...guruAuth,
      id: guruUser.id,
    });
    assert.equal(resolvedGuruSaved?.source, 'personal');
    assert.equal(resolvedGuruSaved?.apiKey, 'guru-personal-7777');
    assert.equal(resolvedGuruSaved?.model, 'deepseek-chat');
  } finally {
    resetDbConnection();
    resetSeedFlag();
    if (prevPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = prevPath;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Skema Mata Pelajaran praktis (Intrakurikuler, Kokurikuler 8 DPL, Ekstrakurikuler, Keasramaan) & persistensi DB', async () => {
  // 1. Intrakurikuler: kode/singkatan opsional, JP default 2
  const mapelTanpaKode = subjectCreateSchema.safeParse({
    name: 'Ilmu Pengetahuan Alam dan Sosial',
    category: 'Wajib',
    gradeLevel: 7,
    kkm: 75,
  });
  assert.equal(mapelTanpaKode.success, true);
  if (mapelTanpaKode.success) {
    assert.equal(mapelTanpaKode.data.code, '');
    assert.equal(mapelTanpaKode.data.weeklyHours, 2);
  }

  // 2. Tujuan Pembelajaran (TP): kode & lingkup materi opsional
  const tpPraktis = learningObjectiveSchema.safeParse({
    subjectId: 1,
    semesterId: 1,
    description: 'Peserta didik mampu menjelaskan perubahan wujud zat.',
  });
  assert.equal(tpPraktis.success, true);
  if (tpPraktis.success) {
    assert.equal(tpPraktis.data.code, '');
    assert.equal(tpPraktis.data.scopeMaterial, 'Umum');
  }

  // 3. Kokurikuler: minimal 1 dari 8 DPL wajib dipilih
  const invalidKokurikuler = cocurricularProjectSchema.safeParse({
    classId: 1,
    semesterId: 1,
    code: 'K1-1',
    title: 'Proyek Pengelolaan Sampah',
    dimensions: [],
  });
  assert.equal(invalidKokurikuler.success, false);

  const validKokurikuler = cocurricularProjectSchema.safeParse({
    classId: 1,
    semesterId: 1,
    code: 'K1-1',
    title: 'Merancang kegiatan pengelolaan sampah di lingkungan sekolah.',
    dimensions: ['Penalaran Kritis', 'Kolaborasi', 'Kreativitas', 'Kesehatan'],
  });
  assert.equal(validKokurikuler.success, true);

  // 4. Ekstrakurikuler & TP
  const validEkskul = extracurricularSchema.safeParse({
    name: 'Pramuka',
    learningObjectives: ['Disiplin baris-berbaris', 'Kerja sama regu'],
  });
  assert.equal(validEkskul.success, true);

  // 5. Indikator Keasramaan: mendukung kategori fleksibel & daftar TP
  const validKeasramaan = keasramaanIndicatorSchema.safeParse({
    category: 'Kemandirian',
    name: 'Pembiasaan kemandirian dalam kegiatan sehari-hari.',
    sortOrder: 1,
    learningObjectives: ['Merapikan tempat tidur sebelum subuh', 'Menyiapkan perlengkapan belajar mandiri'],
  });
  assert.equal(validKeasramaan.success, true);

  // 6. Verifikasi migrasi kolom learning_objectives_json & persistensi di SQLite
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sekolahkita-mapel-'));
  const prevPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(tmpDir, 'mapel.db');
  resetDbConnection();
  resetSeedFlag();

  try {
    await ensureSeeded();
    const db = getDb();

    const [insertedSub] = await db
      .insert(subjects)
      .values({
        code: '',
        name: 'Seni Tari Nusantara',
        category: 'Pilihan',
        gradeLevel: 7,
        fase: 'D',
        kkm: 78,
        weeklyHours: 2,
        sortOrder: 99,
      })
      .returning();
    assert.equal(insertedSub.code, '');
    assert.equal(insertedSub.sortOrder, 99);

    const [insertedInd] = await db
      .insert(keasramaanIndicators)
      .values({
        category: 'Kemandirian',
        name: 'Pembiasaan kerapian kamar asrama',
        sortOrder: 10,
        isActive: true,
        learningObjectivesJson: JSON.stringify(['Melipat selimut setiap pagi']),
      })
      .returning();
    assert.deepEqual(JSON.parse(insertedInd.learningObjectivesJson), ['Melipat selimut setiap pagi']);

    const activeClasses = await db.select().from(classes).limit(1);
    const activeSemRows = await db.select().from(cocurricularProjects).limit(1);
    const activeEkskulRows = await db.select().from(extracurriculars).limit(1);
    assert.ok(activeClasses.length > 0);
    assert.ok(activeSemRows.length > 0);
    assert.ok(activeEkskulRows.length > 0);
  } finally {
    resetDbConnection();
    resetSeedFlag();
    if (prevPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = prevPath;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Input Nilai praktis: kalkulasi TP/STS/SAS, deskripsi DPL & Ekskul, validasi batch, migrasi kolom DB, dan template Excel', async () => {
  // 1. Rata-rata Tes & Non-Tes
  assert.equal(computeAverageTwo(80, 90), 85);
  assert.equal(computeAverageTwo(84, null), 84);
  assert.equal(computeAverageTwo(null, null), null);

  // 2. Rata-rata Lingkup Materi per TP (mendukung > 4 lingkup materi)
  const scopeCalc = computeScopeAveragesFromTpScores(
    [
      { id: 1, scopeMaterial: 'Bilangan' },
      { id: 2, scopeMaterial: 'Aljabar' },
      { id: 3, scopeMaterial: 'Aljabar' },
      { id: 4, scopeMaterial: 'Geometri' },
      { id: 5, scopeMaterial: 'Pengukuran' },
      { id: 6, scopeMaterial: 'Statistika' },
    ],
    { '1': 80, '2': 70, '3': 90, '4': 85, '5': 75, '6': 95 }
  );
  assert.equal(scopeCalc.scopes.length, 5);
  assert.equal(scopeCalc.lm1, 80);
  assert.equal(scopeCalc.lm2, 80);
  assert.equal(scopeCalc.lm3, 85);
  assert.equal(scopeCalc.lm4, 75);
  // (80 + 80 + 85 + 75 + 95) / 5 = 83
  assert.equal(scopeCalc.lmAverage, 83);

  const calc = calculateSummativeScores(
    {
      lm1: scopeCalc.lm1,
      lm2: scopeCalc.lm2,
      lm3: scopeCalc.lm3,
      lm4: scopeCalc.lm4,
      lmAverageOverride: scopeCalc.lmAverage,
      sts: computeAverageTwo(80, 86),
      sas: computeAverageTwo(88, 92),
    },
    { weightLm: 40, weightSts: 30, weightSas: 30, kktpMin: 75 }
  );
  // 83*0.4 + 83*0.3 + 90*0.3 = 33.2 + 24.9 + 27 = 85.1
  assert.equal(calc.lmAverage, 83);
  assert.equal(calc.finalScore, 85.1);

  // 3. Deskripsi otomatis Kokurikuler & Ekstrakurikuler
  const cocuDesc = buildCocurricularDescription(
    ['Kolaborasi', 'Kreativitas'],
    { Kolaborasi: 'Sangat Baik', Kreativitas: 'Baik' }
  );
  assert.equal(cocuDesc.predicate, 'Sangat Baik');
  assert.ok(cocuDesc.description.includes('Sangat baik dalam kolaborasi'));
  assert.ok(cocuDesc.description.includes('baik dalam kreativitas'));

  const eksDesc = buildExtracurricularDescription([
    { objective: 'Berpartisipasi aktif dalam kegiatan Pramuka.', predicate: 'Baik' },
    { objective: 'Bekerja sama dalam regu.', predicate: 'Sangat Baik' },
  ]);
  assert.equal(eksDesc.predicate, 'Sangat Baik');
  assert.ok(eksDesc.description.startsWith('Ananda '));

  // 4. Validasi Zod formatif batch & sumatif detail TP/Tes/Non-Tes
  assert.equal(
    formativeBatchSchema.safeParse({
      studentId: 1,
      subjectId: 2,
      classId: 3,
      semesterId: 1,
      entries: [
        { learningObjectiveId: 10, status: 'Tercapai' },
        { learningObjectiveId: 11, status: 'Belum Dinilai' },
      ],
    }).success,
    true
  );
  assert.equal(
    summativeScoreUpdateSchema.safeParse({
      studentId: 1,
      subjectId: 2,
      classId: 3,
      semesterId: 1,
      stsTes: 80,
      stsNonTes: 85,
      sasTes: 90,
      sasNonTes: null,
      tpScores: { '10': 88, '11': null },
    }).success,
    true
  );

  // 5. Template Excel Kokurikuler & Ekstrakurikuler
  const cocuBuf = await generateCocurricularTemplateWorkbook({
    className: '7 A',
    projectTitle: 'Pengelolaan Sampah',
    dimensions: ['Kolaborasi', 'Kreativitas'],
    students: [
      {
        nisn: '0165001001',
        fullName: 'Aditya Pranata',
        dimensionScores: { Kolaborasi: 'Baik', Kreativitas: 'Sangat Baik' },
      },
    ],
  });
  assert.ok(cocuBuf.byteLength > 1000);

  const eksBuf = await generateExtracurricularTemplateWorkbook({
    className: '7 A',
    extracurricularName: 'Pramuka',
    objectives: ['Disiplin latihan', 'Kerja sama regu'],
    students: [
      {
        nisn: '0165001001',
        fullName: 'Aditya Pranata',
        tpScores: [{ objective: 'Disiplin latihan', predicate: 'Baik' }],
        predicate: 'Baik',
      },
    ],
  });
  assert.ok(eksBuf.byteLength > 1000);

  // 6. Verifikasi kolom migrasi SQLite baru
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sekolahkita-inputnilai-'));
  const prevPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(tmpDir, 'inputnilai.db');
  resetDbConnection();
  resetSeedFlag();

  try {
    await ensureSeeded();
    const db = getDb();
    const now = new Date().toISOString();
    const [stu] = await db
      .insert(students)
      .values({
        nisn: '9999000011',
        nis: '9901',
        fullName: 'Siswa Uji Input Nilai',
        gender: 'L',
        birthPlace: 'Jakarta',
        birthDate: '2016-05-01',
        religion: 'Islam',
        address: 'Jl. Merdeka No. 1',
        fatherName: 'Ayah Uji',
        motherName: 'Ibu Uji',
        parentPhone: '081234567890',
        enrollmentDate: '2026-07-15',
        status: 'Aktif',
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const [cls] = await db.select().from(classes).limit(1);
    const [sub] = await db.select().from(subjects).limit(1);
    const [sem] = await db.select().from(semesters).limit(1);
    const [proj] = await db.select().from(cocurricularProjects).limit(1);
    const [ek] = await db.select().from(extracurriculars).limit(1);
    assert.ok(stu && cls && sub && sem && proj && ek);
    const [savedSum] = await db
      .insert(summativeScores)
      .values({
        studentId: stu.id,
        subjectId: sub.id,
        classId: cls.id,
        semesterId: sem.id,
        lm1: 88,
        sts: 85,
        sas: 90,
        stsTes: 84,
        stsNonTes: 86,
        sasTes: 89,
        sasNonTes: 91,
        tpScoresJson: JSON.stringify({ '1': 88 }),
        midtermScore: 86.71,
        finalScore: 87.7,
        updatedAt: now,
      })
      .returning();
    assert.equal(savedSum.stsTes, 84);
    assert.equal(savedSum.sasNonTes, 91);
    assert.deepEqual(JSON.parse(savedSum.tpScoresJson), { '1': 88 });

    const [savedCocu] = await db
      .insert(cocurricularScores)
      .values({
        projectId: proj.id,
        studentId: stu.id,
        predicate: cocuDesc.predicate,
        dimensionScoresJson: JSON.stringify({ Kolaborasi: 'Sangat Baik' }),
        description: cocuDesc.description,
        updatedAt: now,
      })
      .returning();
    assert.deepEqual(JSON.parse(savedCocu.dimensionScoresJson), { Kolaborasi: 'Sangat Baik' });

    const [savedEks] = await db
      .insert(extracurricularScores)
      .values({
        extracurricularId: ek.id,
        studentId: stu.id,
        semesterId: sem.id,
        predicate: eksDesc.predicate,
        tpScoresJson: JSON.stringify([{ objective: 'Disiplin', predicate: 'Sangat Baik' }]),
        description: eksDesc.description,
        updatedAt: now,
      })
      .returning();
    assert.equal(JSON.parse(savedEks.tpScoresJson).length, 1);
  } finally {
    resetDbConnection();
    resetSeedFlag();
    if (prevPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = prevPath;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});







