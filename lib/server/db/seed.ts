import { count } from 'drizzle-orm';
import { getDb, getDbPath } from './index';
import {
  roles,
  permissions,
  rolePermissions,
  users,
  schools,
  academicYears,
  semesters,
  schoolCalendars,
  classrooms,
  facilities,
  teachers,
  staff,
  classes,
  subjects,
  learningOutcomes,
  learningObjectives,
  students,
  classStudents,
  teacherAssignments,
  teacherAttendance,
  teacherJournals,
  assessmentWeights,
  formativeAssessments,
  summativeScores,
  cocurricularProjects,
  cocurricularScores,
  extracurriculars,
  extracurricularScores,
  studentAttendance,
  homeroomNotes,
  bellConfigs,
  schedules,
  notifications,
  dapodikConfig,
  dapodikExternalMappings,
  dapodikSubjects,
  keasramaanIndicators,
  keasramaanScores,
} from './schema';
import {
  ALL_ACTIONS,
  ALL_MODULES,
  FULL_SCOPE_DEFAULT_ROLES,
  ROLE_DEFINITIONS,
  ensurePermissionsCatalog,
  getDefaultRolePermissions,
} from '../auth/rbac';
import { eq, isNull } from 'drizzle-orm';

const DAPODIK_SUBJECT_REF: Record<string, string> = {
  PABP: '100014000',
  PP: '200010000',
  BIND: '300010000',
  MTK: '400010000',
  IPAS: '500010000',
  PJOK: '600010000',
  SBDP: '700010000',
  BING: '800010000',
  PLBJ: '900010000',
};

const DEFAULT_KEASRAMAAN_INDICATORS = [
  { category: 'A. Kepemimpinan', name: 'Kemampuan memberikan instruksi', sortOrder: 1 },
  { category: 'A. Kepemimpinan', name: 'Kemampuan mempersuasi', sortOrder: 2 },
  { category: 'A. Kepemimpinan', name: 'Kemampuan menjalin relasi dengan baik', sortOrder: 3 },
  { category: 'B. Ketaatan Ibadah', name: 'Konsistensi beribadah', sortOrder: 4 },
  { category: 'B. Ketaatan Ibadah', name: 'Etika Ibadah', sortOrder: 5 },
];

const globalForSeed = globalThis as unknown as { __seededPath?: string };

export function resetSeedFlag() {
  globalForSeed.__seededPath = undefined;
}

async function syncUpgradedSeedDefaults() {
  const db = getDb();
  const now = new Date().toISOString();
  const permMap = await ensurePermissionsCatalog();

  // Ensure WALI_ASUH role exists
  const existingRoles = await db.select().from(roles);
  const roleByCode = new Map(existingRoles.map((r) => [r.code, r]));
  let waliAsuhRole = roleByCode.get('WALI_ASUH');
  if (!waliAsuhRole) {
    const def = ROLE_DEFINITIONS.find((r) => r.code === 'WALI_ASUH')!;
    const [inserted] = await db
      .insert(roles)
      .values({ code: def.code, name: def.name, description: def.description, isSystem: true })
      .returning();
    waliAsuhRole = inserted;
    for (const key of getDefaultRolePermissions('WALI_ASUH')) {
      const pId = permMap.get(key);
      if (pId) {
        await db
          .insert(rolePermissions)
          .values({ roleId: waliAsuhRole.id, permissionId: pId })
          .onConflictDoNothing();
      }
    }
  }

  // Ensure keasramaan permissions are granted to system roles that include them by default
  for (const code of ['SUPER_ADMIN', 'ADMIN_SEKOLAH', 'KEPALA_SEKOLAH', 'WALI_KELAS'] as const) {
    const roleRow = roleByCode.get(code);
    if (!roleRow) continue;
    for (const key of getDefaultRolePermissions(code)) {
      if (!key.startsWith('keasramaan:')) continue;
      const pId = permMap.get(key);
      if (pId) {
        await db
          .insert(rolePermissions)
          .values({ roleId: roleRow.id, permissionId: pId })
          .onConflictDoNothing();
      }
    }
  }

  // Ensure waliasuh account exists on upgraded DBs
  if (waliAsuhRole) {
    const existingWaliAsuh = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'waliasuh'))
      .limit(1);
    if (existingWaliAsuh.length === 0) {
      const [adminRow] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.username, 'admin'))
        .limit(1);
      await db.insert(users).values({
        username: 'waliasuh',
        fullName: 'Ustadz Ahmad Ridwan, S.Pd.I',
        email: 'waliasuh@sdnnusantara01.sch.id',
        passwordHash: adminRow?.passwordHash ?? null,
        roleId: waliAsuhRole.id,
        teacherId: null,
        scopeMode: 'ALL',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Ensure default Keasramaan indicators exist
  const indCount = await db.select({ value: count() }).from(keasramaanIndicators);
  if ((indCount[0]?.value ?? 0) === 0) {
    await db.insert(keasramaanIndicators).values(
      DEFAULT_KEASRAMAAN_INDICATORS.map((item) => ({ ...item, isActive: true }))
    );
  }

  // Backfill Dapodik mapel & pembelajaran IDs if missing
  const missingSubj = await db
    .select()
    .from(subjects)
    .where(isNull(subjects.dapodikMapelId));
  for (const s of missingSubj) {
    const baseCode = s.code.split('-')[0];
    const mapelId = DAPODIK_SUBJECT_REF[baseCode] || `9900${String(s.id).padStart(5, '0')}`;
    const pbId = `PB-SD-${s.gradeLevel}A-${baseCode}-20261`;
    await db
      .update(subjects)
      .set({
        dapodikMapelId: mapelId,
        dapodikPembelajaranId: s.dapodikPembelajaranId || pbId,
      })
      .where(eq(subjects.id, s.id));
  }

  // Backfill dapodik_anggota_rombel_id if missing
  const missingCs = await db
    .select()
    .from(classStudents)
    .where(isNull(classStudents.dapodikAnggotaRombelId));
  for (const cs of missingCs) {
    await db
      .update(classStudents)
      .set({ dapodikAnggotaRombelId: `AR-${cs.classId}-${cs.studentId}-${cs.semesterId}` })
      .where(eq(classStudents.id, cs.id));
  }

  // Ensure dapodik_subjects reference cache has entries
  const dapoSubCount = await db.select({ value: count() }).from(dapodikSubjects);
  if ((dapoSubCount[0]?.value ?? 0) === 0) {
    const refRows = [
      { id: '100014000', nama: 'Pendidikan Agama Islam dan Budi Pekerti', eval: true },
      { id: '200010000', nama: 'Pendidikan Pancasila', eval: true },
      { id: '300010000', nama: 'Bahasa Indonesia', eval: true },
      { id: '400010000', nama: 'Matematika', eval: true },
      { id: '500010000', nama: 'Ilmu Pengetahuan Alam dan Sosial', eval: true },
      { id: '600010000', nama: 'Pendidikan Jasmani, Olahraga, dan Kesehatan', eval: true },
      { id: '700010000', nama: 'Seni Budaya dan Prakarya', eval: true },
      { id: '800010000', nama: 'Bahasa Inggris', eval: true },
      { id: '900010000', nama: 'Pendidikan Lingkungan dan Budaya Jakarta', eval: true },
    ];
    for (const r of refRows) {
      await db
        .insert(dapodikSubjects)
        .values({
          mataPelajaranId: r.id,
          nama: r.nama,
          jurusanId: '',
          pilihanSekolah: false,
          pilihanEvaluasi: r.eval,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }
  }
}

export async function ensureSeeded() {
  const currentPath = getDbPath();
  if (globalForSeed.__seededPath === currentPath) return;
  const db = getDb();
  const existingSchools = await db.select({ value: count() }).from(schools);
  if ((existingSchools[0]?.value ?? 0) > 0) {
    await syncUpgradedSeedDefaults();
    globalForSeed.__seededPath = currentPath;
    return;
  }

  const now = new Date().toISOString();

  // 1. Roles & Permissions
  const roleMap = new Map<string, number>();
  for (const r of ROLE_DEFINITIONS) {
    const [inserted] = await db
      .insert(roles)
      .values({ code: r.code, name: r.name, description: r.description, isSystem: true })
      .returning({ id: roles.id });
    roleMap.set(r.code, inserted.id);
  }

  const permMap = new Map<string, number>();

  for (const mod of ALL_MODULES) {
    for (const act of ALL_ACTIONS) {
      const [inserted] = await db
        .insert(permissions)
        .values({
          module: mod,
          action: act,
          description: `Izin ${act} pada modul ${mod}`,
        })
        .returning({ id: permissions.id });
      permMap.set(`${mod}:${act}`, inserted.id);
    }
  }

  for (const r of ROLE_DEFINITIONS) {
    const rId = roleMap.get(r.code)!;
    const allowed = getDefaultRolePermissions(r.code);
    for (const key of allowed) {
      const pId = permMap.get(key);
      if (pId) {
        await db.insert(rolePermissions).values({ roleId: rId, permissionId: pId });
      }
    }
  }

  // 2. School Profile (SD Negeri Nusantara - Kurikulum Merdeka)
  await db.insert(schools).values({
    name: 'SD Negeri Nusantara 01',
    npsn: '20104567',
    jenjang: 'Sekolah Dasar (SD)',
    naungan: 'Kementerian Pendidikan Dasar dan Menengah',
    status: 'Negeri',
    accreditation: 'A',
    address: 'Jl. Ki Hajar Dewantara No. 14',
    village: 'Kelurahan Harapan Jaya',
    district: 'Kecamatan Cempaka Putih',
    regency: 'Kota Jakarta Pusat',
    province: 'DKI Jakarta',
    postalCode: '10510',
    phone: '(021) 4248190',
    email: 'info@sdnnusantara01.sch.id',
    website: 'https://sdnnusantara01.sch.id',
    principalName: 'Hj. Ratna Pertiwi, M.Pd.',
    principalNip: '197405121998032004',
    logoUrl: '/images/school-crest.jpg',
    enableKeasramaan: false,
    enableAi: true,
    updatedAt: now,
  });

  // 3. Academic Year & Semesters
  const [ay2026] = await db
    .insert(academicYears)
    .values({
      name: '2026/2027',
      startDate: '2026-07-13',
      endDate: '2027-06-18',
      isActive: true,
    })
    .returning();

  const [semGanjil] = await db
    .insert(semesters)
    .values({
      academicYearId: ay2026.id,
      name: 'Ganjil',
      startDate: '2026-07-13',
      reportDate: '2026-12-18',
      isActive: true,
    })
    .returning();

  await db.insert(semesters).values({
    academicYearId: ay2026.id,
    name: 'Genap',
    startDate: '2027-01-04',
    reportDate: '2027-06-18',
    isActive: false,
  });

  // 4. Calendar Events
  await db.insert(schoolCalendars).values([
    {
      semesterId: semGanjil.id,
      title: 'Hari Pertama Masuk Sekolah & MPLS',
      category: 'Kegiatan Sekolah',
      startDate: '2026-07-13',
      endDate: '2026-07-15',
      isHoliday: false,
      description: 'Pengenalan lingkungan sekolah untuk murid kelas 1-6.',
    },
    {
      semesterId: semGanjil.id,
      title: 'HUT Kemerdekaan Republik Indonesia',
      category: 'Libur Nasional',
      startDate: '2026-08-17',
      endDate: '2026-08-17',
      isHoliday: true,
      description: 'Upacara bendera dan libur peringatan proklamasi.',
    },
    {
      semesterId: semGanjil.id,
      title: 'Sumatif Tengah Semester (STS) Ganjil',
      category: 'Ujian',
      startDate: '2026-09-21',
      endDate: '2026-09-26',
      isHoliday: false,
      description: 'Penilaian tengah semester seluruh rombel Fase A, B, dan C.',
    },
    {
      semesterId: semGanjil.id,
      title: 'Sumatif Akhir Semester (SAS) Ganjil',
      category: 'Ujian',
      startDate: '2026-12-07',
      endDate: '2026-12-12',
      isHoliday: false,
      description: 'Evaluasi akhir semester ganjil.',
    },
    {
      semesterId: semGanjil.id,
      title: 'Pembagian Rapor Semester Ganjil',
      category: 'Pembagian Rapor',
      startDate: '2026-12-18',
      endDate: '2026-12-18',
      isHoliday: false,
      description: 'Penerimaan rapor hasil belajar oleh orang tua/wali murid.',
    },
  ]);

  // 5. Classrooms & Facilities
  const roomRows = await db
    .insert(classrooms)
    .values([
      { code: 'R-1A', name: 'Ruang Kelas 1 A', capacity: 28, condition: 'Baik' },
      { code: 'R-2A', name: 'Ruang Kelas 2 A', capacity: 28, condition: 'Baik' },
      { code: 'R-3A', name: 'Ruang Kelas 3 A', capacity: 28, condition: 'Baik' },
      { code: 'R-4A', name: 'Ruang Kelas 4 A', capacity: 28, condition: 'Baik' },
      { code: 'R-5A', name: 'Ruang Kelas 5 A', capacity: 28, condition: 'Baik' },
      { code: 'R-6A', name: 'Ruang Kelas 6 A', capacity: 28, condition: 'Baik' },
    ])
    .returning();

  await db.insert(facilities).values([
    { name: 'Perpustakaan Pelita Ilmu', category: 'Ruang Penunjang', quantity: 1, condition: 'Baik' },
    { name: 'Ruang UKS Sehat', category: 'Kesehatan', quantity: 1, condition: 'Baik' },
    { name: 'Lapangan Upacara & Olahraga', category: 'Olahraga', quantity: 1, condition: 'Baik' },
    { name: 'Perangkat Chromebooks KBM', category: 'TIK', quantity: 24, condition: 'Baik' },
  ]);

  // 6. Teachers & Staff (SD Guru Kelas 1-6 + Guru PAI + Guru PJOK)
  const teacherRows = await db
    .insert(teachers)
    .values([
      {
        dapodikPtkId: 'PTK-20104567-001',
        nuptk: '4538764665200012',
        nip: '198604122010012008',
        fullName: 'Siti Rahmawati, S.Pd.SD',
        gender: 'P',
        employmentStatus: 'PNS',
        education: 'S1 PGSD',
        specialization: 'Guru Kelas 1',
        phone: '081280001001',
        email: 'siti.rahmawati@sdnnusantara01.sch.id',
        address: 'Jl. Percetakan Negara No. 8, Jakarta Pusat',
        createdAt: now,
        updatedAt: now,
      },
      {
        dapodikPtkId: 'PTK-20104567-002',
        nuptk: '5842765666200023',
        nip: '198807192014022003',
        fullName: 'Dewi Lestari, S.Pd.',
        gender: 'P',
        employmentStatus: 'PNS',
        education: 'S1 PGSD',
        specialization: 'Guru Kelas 2',
        phone: '081280001002',
        email: 'dewi.lestari@sdnnusantara01.sch.id',
        address: 'Jl. Rawasari Timur No. 19, Jakarta Pusat',
        createdAt: now,
        updatedAt: now,
      },
      {
        dapodikPtkId: 'PTK-20104567-003',
        nuptk: '7139767668100044',
        nip: '198911032019031005',
        fullName: 'Arif Santoso, S.Pd.',
        gender: 'L',
        employmentStatus: 'PPPK',
        education: 'S1 PGSD',
        specialization: 'Guru Kelas 3',
        phone: '081280001003',
        email: 'arif.santoso@sdnnusantara01.sch.id',
        address: 'Jl. Pramuka Sari II No. 5, Jakarta Pusat',
        createdAt: now,
        updatedAt: now,
      },
      {
        dapodikPtkId: 'PTK-20104567-004',
        nuptk: '8441763664200055',
        nip: '198502252009022006',
        fullName: 'Rina Kusumawardani, S.Pd., M.Pd.',
        gender: 'P',
        employmentStatus: 'PNS',
        education: 'S2 Pendidikan Dasar',
        specialization: 'Guru Kelas 4',
        phone: '081280001004',
        email: 'rina.kusuma@sdnnusantara01.sch.id',
        address: 'Jl. Cempaka Putih Tengah No. 22, Jakarta Pusat',
        createdAt: now,
        updatedAt: now,
      },
      {
        dapodikPtkId: 'PTK-20104567-005',
        nuptk: '6235768669100066',
        nip: '199006142020121002',
        fullName: 'Bayu Pratama, S.Pd.',
        gender: 'L',
        employmentStatus: 'PPPK',
        education: 'S1 PGSD',
        specialization: 'Guru Kelas 5',
        phone: '081280001005',
        email: 'bayu.pratama@sdnnusantara01.sch.id',
        address: 'Jl. Letjen Suprapto No. 41, Jakarta Pusat',
        createdAt: now,
        updatedAt: now,
      },
      {
        dapodikPtkId: 'PTK-20104567-006',
        nuptk: '3940761662100077',
        nip: '198309102008011004',
        fullName: 'Hasan Basri, S.Pd.SD',
        gender: 'L',
        employmentStatus: 'PNS',
        education: 'S1 PGSD',
        specialization: 'Guru Kelas 6',
        phone: '081280001006',
        email: 'hasan.basri@sdnnusantara01.sch.id',
        address: 'Jl. Mardani Raya No. 12, Jakarta Pusat',
        createdAt: now,
        updatedAt: now,
      },
      {
        dapodikPtkId: 'PTK-20104567-007',
        nuptk: '9133769670100088',
        nip: '199108172022211009',
        fullName: 'Ahmad Fauzi, S.Pd.I',
        gender: 'L',
        employmentStatus: 'PPPK',
        education: 'S1 Pendidikan Agama Islam',
        specialization: 'Guru PAI & Budi Pekerti',
        phone: '081280001007',
        email: 'ahmad.fauzi@sdnnusantara01.sch.id',
        address: 'Jl. Johar Baru IV No. 11, Jakarta Pusat',
        createdAt: now,
        updatedAt: now,
      },
      {
        dapodikPtkId: 'PTK-20104567-008',
        nuptk: '2746770671100099',
        nip: '199203282022211010',
        fullName: 'Dimas Wijaya, S.Or.',
        gender: 'L',
        employmentStatus: 'PPPK',
        education: 'S1 Pendidikan Jasmani',
        specialization: 'Guru PJOK',
        phone: '081280001008',
        email: 'dimas.wijaya@sdnnusantara01.sch.id',
        address: 'Jl. Salemba Tengah No. 7, Jakarta Pusat',
        createdAt: now,
        updatedAt: now,
      },
    ])
    .returning();

  await db.insert(staff).values([
    {
      nip: '198705152015011002',
      fullName: 'Budi Hartono, S.Kom.',
      gender: 'L',
      position: 'Operator Dapodik & Tata Usaha',
      employmentStatus: 'PPPK',
      phone: '081280002001',
      email: 'operator@sdnnusantara01.sch.id',
      createdAt: now,
    },
    {
      nip: '198902112018032001',
      fullName: 'Nadia Safitri, S.E.',
      gender: 'P',
      position: 'Bendahara Sekolah',
      employmentStatus: 'PNS',
      phone: '081280002002',
      email: 'bendahara@sdnnusantara01.sch.id',
      createdAt: now,
    },
  ]);

  // 7. Users for all roles (passwordHash null initially until first-run bootstrap)
  await db.insert(users).values([
    {
      username: 'admin',
      fullName: 'Administrator Utama',
      email: 'admin@sdnnusantara01.sch.id',
      passwordHash: null,
      roleId: roleMap.get('SUPER_ADMIN')!,
      teacherId: null,
      scopeMode: FULL_SCOPE_DEFAULT_ROLES.has('SUPER_ADMIN') ? 'ALL' : 'ASSIGNED',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      username: 'kepsek',
      fullName: 'Hj. Ratna Pertiwi, M.Pd.',
      email: 'kepsek@sdnnusantara01.sch.id',
      passwordHash: null,
      roleId: roleMap.get('KEPALA_SEKOLAH')!,
      teacherId: null,
      scopeMode: FULL_SCOPE_DEFAULT_ROLES.has('KEPALA_SEKOLAH') ? 'ALL' : 'ASSIGNED',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      username: 'operator',
      fullName: 'Budi Hartono, S.Kom.',
      email: 'operator@sdnnusantara01.sch.id',
      passwordHash: null,
      roleId: roleMap.get('OPERATOR_SEKOLAH')!,
      teacherId: null,
      scopeMode: FULL_SCOPE_DEFAULT_ROLES.has('OPERATOR_SEKOLAH') ? 'ALL' : 'ASSIGNED',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      username: 'walikelas4a',
      fullName: 'Rina Kusumawardani, S.Pd., M.Pd.',
      email: 'rina.kusuma@sdnnusantara01.sch.id',
      passwordHash: null,
      roleId: roleMap.get('WALI_KELAS')!,
      teacherId: teacherRows[3].id,
      scopeMode: 'ASSIGNED',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      username: 'gurupai',
      fullName: 'Ahmad Fauzi, S.Pd.I',
      email: 'ahmad.fauzi@sdnnusantara01.sch.id',
      passwordHash: null,
      roleId: roleMap.get('GURU')!,
      teacherId: teacherRows[6].id,
      scopeMode: 'ASSIGNED',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      username: 'bendahara',
      fullName: 'Nadia Safitri, S.E.',
      email: 'bendahara@sdnnusantara01.sch.id',
      passwordHash: null,
      roleId: roleMap.get('BENDAHARA')!,
      teacherId: null,
      scopeMode: FULL_SCOPE_DEFAULT_ROLES.has('BENDAHARA') ? 'ALL' : 'ASSIGNED',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      username: 'tatausaha',
      fullName: 'Staff Tata Usaha',
      email: 'tu@sdnnusantara01.sch.id',
      passwordHash: null,
      roleId: roleMap.get('TATA_USAHA')!,
      teacherId: null,
      scopeMode: FULL_SCOPE_DEFAULT_ROLES.has('TATA_USAHA') ? 'ALL' : 'ASSIGNED',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      username: 'waliasuh',
      fullName: 'Ustadz Ahmad Ridwan, S.Pd.I',
      email: 'waliasuh@sdnnusantara01.sch.id',
      passwordHash: null,
      roleId: roleMap.get('WALI_ASUH')!,
      teacherId: null,
      scopeMode: FULL_SCOPE_DEFAULT_ROLES.has('WALI_ASUH') ? 'ALL' : 'ASSIGNED',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // 8. Classes (SD Kelas 1 A .. 6 A)
  const classRows = await db
    .insert(classes)
    .values([
      {
        academicYearId: ay2026.id,
        semesterId: semGanjil.id,
        gradeLevel: 1,
        fase: 'A',
        name: '1 A',
        homeroomTeacherId: teacherRows[0].id,
        classroomId: roomRows[0].id,
        capacity: 28,
        dapodikRombelId: 'RMB-SD-1A-20261',
      },
      {
        academicYearId: ay2026.id,
        semesterId: semGanjil.id,
        gradeLevel: 2,
        fase: 'A',
        name: '2 A',
        homeroomTeacherId: teacherRows[1].id,
        classroomId: roomRows[1].id,
        capacity: 28,
        dapodikRombelId: 'RMB-SD-2A-20261',
      },
      {
        academicYearId: ay2026.id,
        semesterId: semGanjil.id,
        gradeLevel: 3,
        fase: 'B',
        name: '3 A',
        homeroomTeacherId: teacherRows[2].id,
        classroomId: roomRows[2].id,
        capacity: 28,
        dapodikRombelId: 'RMB-SD-3A-20261',
      },
      {
        academicYearId: ay2026.id,
        semesterId: semGanjil.id,
        gradeLevel: 4,
        fase: 'B',
        name: '4 A',
        homeroomTeacherId: teacherRows[3].id,
        classroomId: roomRows[3].id,
        capacity: 28,
        dapodikRombelId: 'RMB-SD-4A-20261',
      },
      {
        academicYearId: ay2026.id,
        semesterId: semGanjil.id,
        gradeLevel: 5,
        fase: 'C',
        name: '5 A',
        homeroomTeacherId: teacherRows[4].id,
        classroomId: roomRows[4].id,
        capacity: 28,
        dapodikRombelId: 'RMB-SD-5A-20261',
      },
      {
        academicYearId: ay2026.id,
        semesterId: semGanjil.id,
        gradeLevel: 6,
        fase: 'C',
        name: '6 A',
        homeroomTeacherId: teacherRows[5].id,
        classroomId: roomRows[5].id,
        capacity: 28,
        dapodikRombelId: 'RMB-SD-6A-20261',
      },
    ])
    .returning();

  // 9. Subjects for Grades 1..6 (Kurikulum Merdeka SD)
  const sdSubjectsTemplate = [
    { code: 'PABP', name: 'Pendidikan Agama dan Budi Pekerti', category: 'Wajib', kkm: 75, hours: 4, teacherIdx: 6 },
    { code: 'PP', name: 'Pendidikan Pancasila', category: 'Wajib', kkm: 75, hours: 4, teacherIdx: -1 },
    { code: 'BIND', name: 'Bahasa Indonesia', category: 'Wajib', kkm: 75, hours: 6, teacherIdx: -1 },
    { code: 'MTK', name: 'Matematika', category: 'Wajib', kkm: 75, hours: 5, teacherIdx: -1 },
    { code: 'IPAS', name: 'Ilmu Pengetahuan Alam dan Sosial', category: 'Wajib', kkm: 75, hours: 5, teacherIdx: -1 },
    { code: 'PJOK', name: 'Pendidikan Jasmani, Olahraga, dan Kesehatan', category: 'Wajib', kkm: 75, hours: 4, teacherIdx: 7 },
    { code: 'SBDP', name: 'Seni Budaya dan Prakarya', category: 'Wajib', kkm: 75, hours: 3, teacherIdx: -1 },
    { code: 'BING', name: 'Bahasa Inggris', category: 'Pilihan', kkm: 75, hours: 2, teacherIdx: -1 },
    { code: 'PLBJ', name: 'Pendidikan Lingkungan dan Budaya Jakarta', category: 'Muatan Lokal', kkm: 75, hours: 2, teacherIdx: -1 },
  ];

  const insertedSubjects: Array<typeof subjects.$inferSelect> = [];
  for (let grade = 1; grade <= 6; grade++) {
    const fase = grade <= 2 ? 'A' : grade <= 4 ? 'B' : 'C';
    const homeroomTeacher = teacherRows[grade - 1];
    let order = 1;
    for (const tpl of sdSubjectsTemplate) {
      // IPAS dimulai pada Fase B (kelas 3-6) sesuai struktur Kurikulum Merdeka SD
      if (tpl.code === 'IPAS' && grade <= 2) continue;
      if (tpl.code === 'BING' && grade <= 2) continue;
      const assignedTeacherId = tpl.teacherIdx >= 0 ? teacherRows[tpl.teacherIdx].id : homeroomTeacher.id;
      const [sub] = await db
        .insert(subjects)
        .values({
          code: `${tpl.code}-${grade}`,
          name: tpl.name,
          category: tpl.category,
          gradeLevel: grade,
          fase,
          kkm: tpl.kkm,
          weeklyHours: tpl.hours,
          sortOrder: order++,
          teacherId: assignedTeacherId,
          dapodikMapelId: DAPODIK_SUBJECT_REF[tpl.code] || `9900${grade}${order}`,
          dapodikPembelajaranId: `PB-SD-${grade}A-${tpl.code}-20261`,
        })
        .returning();
      insertedSubjects.push(sub);
    }
  }

  // 10. CP & TP/ATP for Grade 4 (Focus Class 4 A) and sample for other grades
  const grade4Subjects = insertedSubjects.filter((s) => s.gradeLevel === 4);
  const grade4TpMap = new Map<number, number[]>();

  for (const sub of grade4Subjects) {
    await db.insert(learningOutcomes).values({
      subjectId: sub.id,
      fase: 'B',
      code: `CP-${sub.code}`,
      element: 'Pemahaman Konsep & Keterampilan Proses',
      description: `Peserta didik mampu memahami konsep dasar, menerapkan keterampilan, dan merefleksikan nilai-nilai pembelajaran pada mata pelajaran ${sub.name} di Fase B.`,
    });

    const tpList = [
      {
        code: `${sub.code}.TP1`,
        scopeMaterial: 'Pemahaman Konsep Dasar',
        description: `Mengidentifikasi dan menjelaskan konsep inti ${sub.name} secara runtut dan tepat.`,
        atpOrder: 1,
      },
      {
        code: `${sub.code}.TP2`,
        scopeMaterial: 'Penerapan dalam Konteks Nyata',
        description: `Menerapkan keterampilan ${sub.name} untuk menyelesaikan masalah sederhana sehari-hari.`,
        atpOrder: 2,
      },
      {
        code: `${sub.code}.TP3`,
        scopeMaterial: 'Analisis dan Refleksi Karya',
        description: `Menyajikan hasil pengamatan atau karya ${sub.name} dengan percaya diri dan santun.`,
        atpOrder: 3,
      },
    ];

    const tpIds: number[] = [];
    for (const tp of tpList) {
      const [insertedTp] = await db
        .insert(learningObjectives)
        .values({
          subjectId: sub.id,
          semesterId: semGanjil.id,
          code: tp.code,
          scopeMaterial: tp.scopeMaterial,
          description: tp.description,
          atpOrder: tp.atpOrder,
          kktpThreshold: 75,
        })
        .returning({ id: learningObjectives.id });
      tpIds.push(insertedTp.id);
    }
    grade4TpMap.set(sub.id, tpIds);

    await db.insert(assessmentWeights).values({
      subjectId: sub.id,
      classId: classRows[3].id, // 4 A
      semesterId: semGanjil.id,
      weightLm: 40,
      weightSts: 30,
      weightSas: 30,
      kktpMin: 75,
      updatedAt: now,
    });
  }

  // Also add 1 sample TP per subject for other grades so all classes have active curriculum items
  for (const sub of insertedSubjects.filter((s) => s.gradeLevel !== 4)) {
    await db.insert(learningObjectives).values({
      subjectId: sub.id,
      semesterId: semGanjil.id,
      code: `${sub.code}.TP1`,
      scopeMaterial: 'Materi Inti Semester Ganjil',
      description: `Memahami dan mempraktikkan kompetensi dasar ${sub.name} kelas ${sub.gradeLevel}.`,
      atpOrder: 1,
      kktpThreshold: 75,
    });
  }

  // 11. Students for Class 4 A (12 realistic SD students) + 3 students per other class
  const class4AStudentsSeed = [
    { name: 'Aditya Pranata', gender: 'L', birthDate: '2016-02-01', religion: 'Islam', father: 'Hendra Pranata', mother: 'Sri Wahyuni' },
    { name: 'Bunga Kirana', gender: 'P', birthDate: '2016-03-14', religion: 'Islam', father: 'Agus Setiawan', mother: 'Lina Marlina' },
    { name: 'Cahya Permata', gender: 'P', birthDate: '2016-04-08', religion: 'Kristen', father: 'Yohanes Permana', mother: 'Maria Magdalena' },
    { name: 'Dian Saputra', gender: 'L', birthDate: '2016-05-19', religion: 'Islam', father: 'Bambang Saputra', mother: 'Rini Astuti' },
    { name: 'Eka Wulandari', gender: 'P', birthDate: '2016-06-22', religion: 'Islam', father: 'Slamet Riyadi', mother: 'Ningsih' },
    { name: 'Farhan Pratama', gender: 'L', birthDate: '2016-01-11', religion: 'Islam', father: 'Dedi Pratama', mother: 'Wati Suryani' },
    { name: 'Gita Lestari', gender: 'P', birthDate: '2016-07-07', religion: 'Hindu', father: 'Made Wijaya', mother: 'Ni Luh Sari' },
    { name: 'Hana Maharani', gender: 'P', birthDate: '2016-08-29', religion: 'Islam', father: 'Fajar Nugroho', mother: 'Ratna Sari' },
    { name: 'Indra Kusuma', gender: 'L', birthDate: '2016-09-12', religion: 'Buddha', father: 'Hendra Kusuma', mother: 'Mei Ling' },
    { name: 'Jihan Safira', gender: 'P', birthDate: '2016-10-03', religion: 'Islam', father: 'Rudi Hartono', mother: 'Yulianti' },
    { name: 'Kirana Putri', gender: 'P', birthDate: '2016-11-15', religion: 'Islam', father: 'Taufik Hidayat', mother: 'Siti Aminah' },
    { name: 'Lintang Ramadhan', gender: 'L', birthDate: '2016-12-04', religion: 'Islam', father: 'Eko Ramadhan', mother: 'Dewi Anggraini' },
  ];

  const class4AStudentRows: Array<typeof students.$inferSelect> = [];
  for (let i = 0; i < class4AStudentsSeed.length; i++) {
    const s = class4AStudentsSeed[i];
    const num = String(i + 1).padStart(3, '0');
    const [stu] = await db
      .insert(students)
      .values({
        dapodikStudentId: `PD-20104567-4A-${num}`,
        nisn: `0164001${num}`,
        nis: `232404${num}`,
        fullName: s.name,
        gender: s.gender,
        birthPlace: 'Jakarta',
        birthDate: s.birthDate,
        religion: s.religion,
        address: `Jl. Harapan Jaya No. ${10 + i}, Jakarta Pusat`,
        phone: `081310004${num}`,
        email: '',
        previousSchool: 'TK Nusantara Jakarta',
        enrollmentDate: '2023-07-17',
        status: 'Aktif',
        fatherName: s.father,
        fatherJob: 'Karyawan Swasta',
        motherName: s.mother,
        motherJob: 'Ibu Rumah Tangga',
        parentPhone: `081310004${num}`,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    class4AStudentRows.push(stu);

    await db.insert(classStudents).values({
      classId: classRows[3].id,
      studentId: stu.id,
      semesterId: semGanjil.id,
      status: 'Aktif',
      enrolledAt: '2026-07-13',
      dapodikAnggotaRombelId: `AR-4A-${stu.id}-${semGanjil.id}`,
    });

    await db.insert(dapodikExternalMappings).values({
      entityType: 'student',
      localId: stu.id,
      externalId: stu.dapodikStudentId!,
      lastSyncedAt: now,
    });
  }

  // Other grades sample students (so switching to 1 A, 2 A, 3 A, 5 A, 6 A shows real students too)
  const otherGradeStudents: Record<number, Array<{ name: string; gender: string }>> = {
    1: [
      { name: 'Alvaro Mahendra', gender: 'L' },
      { name: 'Bianca Azzahra', gender: 'P' },
      { name: 'Cakra Wibowo', gender: 'L' },
    ],
    2: [
      { name: 'Daffa Alfarizi', gender: 'L' },
      { name: 'Elsa Nabila', gender: 'P' },
      { name: 'Fathan Gunawan', gender: 'L' },
    ],
    3: [
      { name: 'Galih Permadi', gender: 'L' },
      { name: 'Hilda Octaviani', gender: 'P' },
      { name: 'Irfan Maulana', gender: 'L' },
    ],
    5: [
      { name: 'Kaysan Alif', gender: 'L' },
      { name: 'Larasati Dewi', gender: 'P' },
      { name: 'Maulana Yusuf', gender: 'L' },
    ],
    6: [
      { name: 'Naufal Hakim', gender: 'L' },
      { name: 'Olivia Putri', gender: 'P' },
      { name: 'Prabu Santika', gender: 'L' },
    ],
  };

  for (const gradeStr of Object.keys(otherGradeStudents)) {
    const grade = Number(gradeStr);
    const cls = classRows[grade - 1];
    const list = otherGradeStudents[grade];
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const num = String(i + 1).padStart(3, '0');
      const birthYear = 2026 - (6 + grade);
      const [stu] = await db
        .insert(students)
        .values({
          dapodikStudentId: `PD-20104567-${grade}A-${num}`,
          nisn: `01${grade}4002${num}`,
          nis: `24250${grade}${num}`,
          fullName: s.name,
          gender: s.gender,
          birthPlace: 'Jakarta',
          birthDate: `${birthYear}-05-10`,
          religion: 'Islam',
          address: `Jl. Cempaka Putih Barat No. ${20 + i}`,
          enrollmentDate: `${2026 - grade + 1}-07-15`,
          status: 'Aktif',
          fatherName: `Orang Tua ${s.name.split(' ')[0]}`,
          motherName: `Ibu ${s.name.split(' ')[0]}`,
          parentPhone: `08129000${grade}${num}`,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await db.insert(classStudents).values({
        classId: cls.id,
        studentId: stu.id,
        semesterId: semGanjil.id,
        status: 'Aktif',
        enrolledAt: '2026-07-13',
        dapodikAnggotaRombelId: `AR-${cls.id}-${stu.id}-${semGanjil.id}`,
      });
    }
  }

  // 12. Summative & Formative Scores for Class 4 A
  const baseScores = [82, 85, 88, 91, 94, 78, 81, 84, 87, 90, 86, 80];
  for (let sIdx = 0; sIdx < class4AStudentRows.length; sIdx++) {
    const stu = class4AStudentRows[sIdx];
    const base = baseScores[sIdx % baseScores.length];

    for (let subIdx = 0; subIdx < grade4Subjects.length; subIdx++) {
      const sub = grade4Subjects[subIdx];
      const delta = ((subIdx * 3 + sIdx) % 7) - 3;
      const lm1 = Math.min(99, Math.max(70, base + delta));
      const lm2 = Math.min(99, Math.max(70, base + delta + 1));
      const lm3 = Math.min(99, Math.max(70, base + delta - 1));
      const sts = Math.min(99, Math.max(70, base + delta));
      const sas = Math.min(99, Math.max(70, base + delta + 2));
      const avgLm = (lm1 + lm2 + lm3) / 3;
      const midterm = Number(((avgLm * 40 + sts * 30) / 70).toFixed(2));
      const finalScore = Number(((avgLm * 0.4) + (sts * 0.3) + (sas * 0.3)).toFixed(2));

      await db.insert(summativeScores).values({
        studentId: stu.id,
        subjectId: sub.id,
        classId: classRows[3].id,
        semesterId: semGanjil.id,
        lm1,
        lm2,
        lm3,
        sts,
        sas,
        midtermScore: midterm,
        finalScore,
        teacherNote: `Menunjukkan penguasaan yang baik dalam ${sub.name}.`,
        updatedAt: now,
      });

      const tpIds = grade4TpMap.get(sub.id) || [];
      for (let t = 0; t < tpIds.length; t++) {
        const status =
          sIdx % 5 === 4 && t === 2
            ? 'Perlu Pendalaman'
            : sIdx % 7 === 5 && t === 0
            ? 'Perlu Bimbingan'
            : 'Tercapai';
        await db.insert(formativeAssessments).values({
          studentId: stu.id,
          subjectId: sub.id,
          learningObjectiveId: tpIds[t],
          classId: classRows[3].id,
          semesterId: semGanjil.id,
          status,
          score: status === 'Tercapai' ? 85 : status === 'Perlu Pendalaman' ? 74 : 68,
          notes: '',
          updatedAt: now,
        });
      }
    }

    await db.insert(homeroomNotes).values({
      studentId: stu.id,
      classId: classRows[3].id,
      semesterId: semGanjil.id,
      note:
        sIdx % 3 === 0
          ? 'Ananda aktif berdiskusi di kelas dan menunjukkan sikap gotong royong yang sangat baik.'
          : 'Terus pertahankan semangat belajar dan ketelitian dalam menyelesaikan tugas mandiri.',
      promotionDecision: '',
      updatedAt: now,
    });
  }

  // 13. Cocurricular (8 DPL) & Extracurriculars for Class 4 A
  const cocuProjects = await db
    .insert(cocurricularProjects)
    .values([
      {
        classId: classRows[3].id,
        semesterId: semGanjil.id,
        code: 'K4-1',
        title: 'Gerakan Sekolah Bersih & Pengelolaan Sampah Terpilah',
        dimensionsJson: JSON.stringify(['Kolaborasi', 'Kreativitas', 'Kesehatan', 'Penalaran Kritis']),
        description: 'Projek kokurikuler penguatan 8 Dimensi Profil Lulusan untuk kelas 4 A.',
      },
      {
        classId: classRows[3].id,
        semesterId: semGanjil.id,
        code: 'K4-2',
        title: 'Gelaran Karya Budaya Nusantara',
        dimensionsJson: JSON.stringify(['Keimanan dan Ketakwaan kepada Tuhan YME', 'Kewargaan', 'Kemandirian', 'Komunikasi']),
        description: 'Presentasi keragaman budaya daerah Indonesia secara berkelompok.',
      },
    ])
    .returning();

  for (let i = 0; i < class4AStudentRows.length; i++) {
    const stu = class4AStudentRows[i];
    for (const proj of cocuProjects) {
      const pred = i % 3 === 0 ? 'Sangat Baik' : 'Baik';
      await db.insert(cocurricularScores).values({
        projectId: proj.id,
        studentId: stu.id,
        predicate: pred,
        description: `${pred} dalam kolaborasi, kreativitas, kemandirian, dan komunikasi selama kegiatan ${proj.title}.`,
        updatedAt: now,
      });
    }
  }

  const ekstraRows = await db
    .insert(extracurriculars)
    .values([
      {
        name: 'Pramuka Siaga & Penggalang',
        instructorName: 'Kak Arif Santoso',
        scheduleDay: 'Sabtu',
        learningObjectivesJson: JSON.stringify([
          'Kedisiplinan dan kemandirian baris-berbaris',
          'Kerja sama regu dan kecakapan tali-temali dasar',
        ]),
      },
      {
        name: 'Seni Tari & Musik Daerah',
        instructorName: 'Ibu Dewi Lestari',
        scheduleDay: 'Rabu',
        learningObjectivesJson: JSON.stringify([
          'Penguasaan gerak dasar tari tradisional Nusantara',
          'Harmoni ansambel angklung sekolah',
        ]),
      },
    ])
    .returning();

  for (let i = 0; i < class4AStudentRows.length; i++) {
    const stu = class4AStudentRows[i];
    await db.insert(extracurricularScores).values({
      extracurricularId: ekstraRows[0].id,
      studentId: stu.id,
      semesterId: semGanjil.id,
      predicate: i % 4 === 0 ? 'Sangat Baik' : 'Baik',
      description: 'Ananda aktif mengikuti kegiatan kepramukaan dan bekerja sama dengan anggota regu.',
      updatedAt: now,
    });
    if (i % 2 === 0) {
      await db.insert(extracurricularScores).values({
        extracurricularId: ekstraRows[1].id,
        studentId: stu.id,
        semesterId: semGanjil.id,
        predicate: 'Baik',
        description: 'Ananda antusias berlatih seni tari dan musik daerah dengan kompak.',
        updatedAt: now,
      });
    }
  }

  // 14. Student & Teacher Attendance Sample (last 5 school days)
  const sampleDates = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'];
  for (const d of sampleDates) {
    for (let i = 0; i < class4AStudentRows.length; i++) {
      const stu = class4AStudentRows[i];
      let status = 'H';
      if (d === '2026-11-18' && i === 3) status = 'S';
      if (d === '2026-11-19' && i === 7) status = 'I';
      await db.insert(studentAttendance).values({
        studentId: stu.id,
        classId: classRows[3].id,
        semesterId: semGanjil.id,
        date: d,
        status,
        notes: status === 'S' ? 'Demam ringan' : status === 'I' ? 'Acara keluarga' : '',
        updatedAt: now,
      });
    }
    for (let t = 0; t < teacherRows.length; t++) {
      await db.insert(teacherAttendance).values({
        teacherId: teacherRows[t].id,
        semesterId: semGanjil.id,
        date: d,
        status: 'Hadir',
        checkInTime: '06:45',
        notes: '',
      });
    }
  }

  // 15. Bell & Sample Schedule + Teacher Assignment + Journal
  await db.insert(bellConfigs).values([
    { periodNumber: 1, startTime: '07:00', endTime: '07:35', label: 'Jam Ke-1', isBreak: false },
    { periodNumber: 2, startTime: '07:35', endTime: '08:10', label: 'Jam Ke-2', isBreak: false },
    { periodNumber: 3, startTime: '08:10', endTime: '08:45', label: 'Jam Ke-3', isBreak: false },
    { periodNumber: 4, startTime: '08:45', endTime: '09:20', label: 'Jam Ke-4', isBreak: false },
    { periodNumber: 5, startTime: '09:20', endTime: '09:40', label: 'Istirahat Pertama', isBreak: true },
    { periodNumber: 6, startTime: '09:40', endTime: '10:15', label: 'Jam Ke-5', isBreak: false },
    { periodNumber: 7, startTime: '10:15', endTime: '10:50', label: 'Jam Ke-6', isBreak: false },
    { periodNumber: 8, startTime: '10:50', endTime: '11:25', label: 'Jam Ke-7', isBreak: false },
    { periodNumber: 9, startTime: '11:25', endTime: '12:00', label: 'Jam Ke-8', isBreak: false },
  ]);

  // Class 4 A Monday-Wednesday sample schedule
  const mtk4 = grade4Subjects.find((s) => s.code.startsWith('MTK'))!;
  const bind4 = grade4Subjects.find((s) => s.code.startsWith('BIND'))!;
  const ipas4 = grade4Subjects.find((s) => s.code.startsWith('IPAS'))!;
  const pabp4 = grade4Subjects.find((s) => s.code.startsWith('PABP'))!;
  const pjok4 = grade4Subjects.find((s) => s.code.startsWith('PJOK'))!;

  await db.insert(schedules).values([
    { classId: classRows[3].id, semesterId: semGanjil.id, dayOfWeek: 1, periodNumber: 1, startTime: '07:00', endTime: '07:35', subjectId: null, teacherId: teacherRows[3].id, activityLabel: 'Upacara Bendera' },
    { classId: classRows[3].id, semesterId: semGanjil.id, dayOfWeek: 1, periodNumber: 2, startTime: '07:35', endTime: '08:10', subjectId: bind4.id, teacherId: teacherRows[3].id, activityLabel: '' },
    { classId: classRows[3].id, semesterId: semGanjil.id, dayOfWeek: 1, periodNumber: 3, startTime: '08:10', endTime: '08:45', subjectId: bind4.id, teacherId: teacherRows[3].id, activityLabel: '' },
    { classId: classRows[3].id, semesterId: semGanjil.id, dayOfWeek: 1, periodNumber: 4, startTime: '08:45', endTime: '09:20', subjectId: mtk4.id, teacherId: teacherRows[3].id, activityLabel: '' },
    { classId: classRows[3].id, semesterId: semGanjil.id, dayOfWeek: 2, periodNumber: 1, startTime: '07:00', endTime: '07:35', subjectId: pabp4.id, teacherId: teacherRows[6].id, activityLabel: '' },
    { classId: classRows[3].id, semesterId: semGanjil.id, dayOfWeek: 2, periodNumber: 2, startTime: '07:35', endTime: '08:10', subjectId: pabp4.id, teacherId: teacherRows[6].id, activityLabel: '' },
    { classId: classRows[3].id, semesterId: semGanjil.id, dayOfWeek: 2, periodNumber: 3, startTime: '08:10', endTime: '08:45', subjectId: ipas4.id, teacherId: teacherRows[3].id, activityLabel: '' },
    { classId: classRows[3].id, semesterId: semGanjil.id, dayOfWeek: 3, periodNumber: 1, startTime: '07:00', endTime: '07:35', subjectId: pjok4.id, teacherId: teacherRows[7].id, activityLabel: '' },
    { classId: classRows[3].id, semesterId: semGanjil.id, dayOfWeek: 3, periodNumber: 2, startTime: '07:35', endTime: '08:10', subjectId: pjok4.id, teacherId: teacherRows[7].id, activityLabel: '' },
  ]);

  for (let i = 0; i < 6; i++) {
    await db.insert(teacherAssignments).values({
      teacherId: teacherRows[i].id,
      classId: classRows[i].id,
      semesterId: semGanjil.id,
      assignmentType: 'Guru Kelas',
      weeklyHours: 24,
      notes: `Wali & Guru Kelas ${classRows[i].name}`,
    });
  }
  await db.insert(teacherAssignments).values([
    { teacherId: teacherRows[6].id, classId: null, semesterId: semGanjil.id, assignmentType: 'Guru Mapel', weeklyHours: 24, notes: 'PAI Kelas 1–6' },
    { teacherId: teacherRows[7].id, classId: null, semesterId: semGanjil.id, assignmentType: 'Guru Mapel', weeklyHours: 24, notes: 'PJOK Kelas 1–6' },
  ]);

  await db.insert(teacherJournals).values([
    {
      teacherId: teacherRows[3].id,
      classId: classRows[3].id,
      subjectId: mtk4.id,
      semesterId: semGanjil.id,
      date: '2026-11-20',
      lessonHour: '1-2',
      material: 'Pecahan Senilai dan Perbandingan Pecahan',
      objectiveSummary: 'Murid mampu menentukan pecahan senilai dengan alat peraga.',
      activities: 'Eksplorasi kertas lipat pecahan, diskusi kelompok, dan kuis singkat.',
      completionStatus: 'Tuntas',
      notes: 'Seluruh murid aktif mengikuti pembelajaran.',
      createdAt: now,
    },
    {
      teacherId: teacherRows[3].id,
      classId: classRows[3].id,
      subjectId: ipas4.id,
      semesterId: semGanjil.id,
      date: '2026-11-19',
      lessonHour: '3-4',
      material: 'Mengubah Bentuk Energi di Sekitar Kita',
      objectiveSummary: 'Murid mengidentifikasi transformasi energi listrik dan gerak.',
      activities: 'Pengamatan alat elektronik sekolah dan lembar kerja eksperimen.',
      completionStatus: 'Tuntas',
      notes: '',
      createdAt: now,
    },
  ]);

  // 16. Notifications & Dapodik Config
  await db.insert(notifications).values([
    {
      userId: null,
      title: 'Batas Akhir Pengisian Nilai Sumatif Ganjil',
      message: 'Pastikan nilai Lingkup Materi, STS, dan SAS kelas 4 A selesai sebelum 12 Desember 2026.',
      category: 'Akademik',
      isRead: false,
      linkHref: '/penilaian',
      createdAt: now,
    },
    {
      userId: null,
      title: 'Sinkronisasi Dapodik Siap Diverifikasi',
      message: 'Data 27 murid aktif dan 6 rombel telah terpetakan. Lakukan uji koneksi Web Service lokal sebelum pengiriman MATEV.',
      category: 'Dapodik',
      isRead: false,
      linkHref: '/integrasi',
      createdAt: now,
    },
    {
      userId: null,
      title: 'Jadwal Pembagian Rapor Semester Ganjil',
      message: 'Pembagian Rapor Semester Ganjil 2026/2027 dijadwalkan pada 18 Desember 2026.',
      category: 'Sistem',
      isRead: false,
      linkHref: '/rapor',
      createdAt: now,
    },
  ]);

  await db.insert(dapodikConfig).values({
    webServiceUrl: 'http://localhost:5774',
    npsn: '20104567',
    apiToken: '',
    mode: 'WebService',
    connectionStatus: 'Belum Terhubung',
    lastSyncAt: null,
    updatedAt: now,
  });

  // 17. Referensi Mapel Dapodik & Indikator Keasramaan + Skor Awal Kelas 4 A
  for (const tpl of sdSubjectsTemplate) {
    await db
      .insert(dapodikSubjects)
      .values({
        mataPelajaranId: DAPODIK_SUBJECT_REF[tpl.code],
        nama: tpl.name,
        jurusanId: '',
        pilihanSekolah: false,
        pilihanEvaluasi: true,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }

  const insertedIndicators = await db
    .insert(keasramaanIndicators)
    .values(DEFAULT_KEASRAMAAN_INDICATORS.map((item) => ({ ...item, isActive: true })))
    .returning();

  for (let sIdx = 0; sIdx < class4AStudentRows.length; sIdx++) {
    const stu = class4AStudentRows[sIdx];
    const firstName = stu.fullName.split(' ')[0];
    for (let iIdx = 0; iIdx < insertedIndicators.length; iIdx++) {
      const ind = insertedIndicators[iIdx];
      const predicate = (sIdx + iIdx) % 4 === 0 ? 'A' : (sIdx + iIdx) % 5 === 4 ? 'C' : 'B';
      await db.insert(keasramaanScores).values({
        indicatorId: ind.id,
        studentId: stu.id,
        semesterId: semGanjil.id,
        predicate,
        achievedDescription: `Ananda ${firstName} menunjukkan perkembangan yang ${
          predicate === 'A' ? 'sangat baik' : predicate === 'B' ? 'baik' : 'cukup baik'
        } dalam ${ind.name.toLowerCase()} di lingkungan asrama dan kelas.`,
        guidanceDescription:
          predicate === 'C'
            ? `Ananda ${firstName} masih perlu bimbingan lanjutan dan pembiasaan rutin terkait ${ind.name.toLowerCase()}.`
            : `Pertahankan konsistensi sikap positif dan terus tingkatkan keteladanan dalam ${ind.name.toLowerCase()}.`,
        waliAsramaName: 'Ustadz Setiawan Budi, S.Pd.',
        waliAsramaNip: '198804152015031002',
        waliAsuhName: 'Ustadz Ahmad Ridwan, S.Pd.I',
        waliAsuhNip: '199106202019031004',
        updatedAt: now,
      });
    }
  }

  globalForSeed.__seededPath = currentPath;
}
