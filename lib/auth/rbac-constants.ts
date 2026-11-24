export const SYSTEM_ROLE_CODES = [
  'SUPER_ADMIN',
  'ADMIN_SEKOLAH',
  'KEPALA_SEKOLAH',
  'OPERATOR_SEKOLAH',
  'WALI_KELAS',
  'GURU',
  'WALI_ASUH',
  'BENDAHARA',
  'TATA_USAHA',
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];
export type RoleCode = SystemRoleCode | (string & {});

export const SCOPE_MODES = ['ALL', 'ASSIGNED', 'CUSTOM'] as const;
export type ScopeMode = (typeof SCOPE_MODES)[number];

export const SCOPE_MODE_LABELS: Record<ScopeMode, { label: string; description: string }> = {
  ALL: {
    label: 'Semua Kelas & Mapel',
    description: 'Akses lintas seluruh rombongan belajar dan mata pelajaran sekolah.',
  },
  ASSIGNED: {
    label: 'Otomatis Penugasan Guru',
    description: 'Mengikuti kelas binaan wali kelas, jadwal mengajar, dan mapel yang diampu.',
  },
  CUSTOM: {
    label: 'Cakupan Khusus (Manual)',
    description: 'Dibatasi hanya ke daftar rombel dan/atau mata pelajaran yang dipilih admin.',
  },
};

export const FULL_SCOPE_DEFAULT_ROLES: ReadonlySet<string> = new Set([
  'SUPER_ADMIN',
  'ADMIN_SEKOLAH',
  'KEPALA_SEKOLAH',
  'OPERATOR_SEKOLAH',
  'WALI_ASUH',
  'BENDAHARA',
  'TATA_USAHA',
]);

export type ModuleName =
  | 'dashboard'
  | 'sekolah'
  | 'siswa'
  | 'guru'
  | 'kelas'
  | 'kurikulum'
  | 'jadwal'
  | 'penilaian'
  | 'keasramaan'
  | 'absensi'
  | 'rapor'
  | 'kesiswaan'
  | 'dapodik'
  | 'erapor'
  | 'ai'
  | 'pengguna'
  | 'backup'
  | 'administrasi';

export type ActionName = 'read' | 'create' | 'update' | 'delete' | 'export' | 'approve';

export const ALL_MODULES: ModuleName[] = [
  'dashboard',
  'sekolah',
  'kelas',
  'siswa',
  'kesiswaan',
  'guru',
  'kurikulum',
  'jadwal',
  'penilaian',
  'keasramaan',
  'absensi',
  'rapor',
  'administrasi',
  'dapodik',
  'erapor',
  'ai',
  'pengguna',
  'backup',
];

export const ALL_ACTIONS: ActionName[] = [
  'read',
  'create',
  'update',
  'delete',
  'export',
  'approve',
];

export const ACTION_LABELS: Record<ActionName, string> = {
  read: 'Lihat',
  create: 'Tambah',
  update: 'Ubah',
  delete: 'Hapus',
  export: 'Ekspor',
  approve: 'Setujui',
};

export const MODULE_METADATA: Record<
  ModuleName,
  { label: string; route: string; description: string }
> = {
  dashboard: {
    label: 'Beranda & Analitik',
    route: '/dashboard',
    description: 'Ringkasan sekolah, statistik rombel, dan grafik capaian.',
  },
  sekolah: {
    label: 'Identitas & Kalender Sekolah',
    route: '/sekolah',
    description: 'Profil sekolah, NPSN, tahun ajaran, semester, sarpras, dan kalender.',
  },
  kelas: {
    label: 'Rombel & Kelas',
    route: '/kelas',
    description: 'Manajemen rombongan belajar, ruang kelas, dan wali kelas.',
  },
  siswa: {
    label: 'Data Induk Murid',
    route: '/siswa',
    description: 'Data pokok murid, impor/ekspor Excel, dan mutasi status.',
  },
  kesiswaan: {
    label: 'Catatan Kesiswaan',
    route: '/siswa',
    description: 'Catatan prestasi, pembinaan, konseling, dan UKS murid.',
  },
  guru: {
    label: 'Guru & Tenaga Kependidikan',
    route: '/guru',
    description: 'Data pendidik, tendik, dan beban penugasan mengajar.',
  },
  kurikulum: {
    label: 'Kurikulum, CP/TP & Jurnal',
    route: '/kurikulum',
    description: 'Mata pelajaran, CP, TP/ATP, modul RPM, dan jurnal mengajar.',
  },
  jadwal: {
    label: 'Jadwal & Bel Sekolah',
    route: '/jadwal',
    description: 'Penyusunan jadwal pelajaran mingguan dan pengaturan jam bel.',
  },
  penilaian: {
    label: 'Asesmen, Nilai & Leger',
    route: '/penilaian',
    description: 'Bobot nilai, formatif TP, sumatif LM/STS/SAS, kokurikuler, dan leger.',
  },
  keasramaan: {
    label: 'Program & Penilaian Keasramaan',
    route: '/penilaian',
    description: 'Indikator pembinaan asrama, capaian predikat, dan rapor keasramaan.',
  },
  absensi: {
    label: 'Presensi Murid & Guru',
    route: '/absensi',
    description: 'Kehadiran harian murid/guru dan ekspor rekap presensi.',
  },
  rapor: {
    label: 'Rapor & Cetak A4',
    route: '/rapor',
    description: 'Pratinjau, validasi catatan wali kelas, dan cetak rapor Kurikulum Merdeka.',
  },
  administrasi: {
    label: 'Buku Tamu & Dinas Luar',
    route: '/administrasi',
    description: 'Buku tamu sekolah serta pengajuan dan persetujuan surat tugas dinas.',
  },
  dapodik: {
    label: 'Integrasi Dapodik',
    route: '/integrasi',
    description: 'Konfigurasi Web Service Dapodik, pemetaan ID, dan pengiriman MATEV/nilai.',
  },
  erapor: {
    label: 'Integrasi E-Rapor',
    route: '/integrasi',
    description: 'Ekspor dan impor template nilai E-Rapor Kemendikdasmen.',
  },
  ai: {
    label: 'Asisten Draf Kurikulum AI',
    route: '/kurikulum',
    description: 'Pembuatan draf TP, modul ajar RPM, dan deskripsi capaian kompetensi.',
  },
  pengguna: {
    label: 'Manajemen Akun & Peran RBAC',
    route: '/pengaturan',
    description: 'Pengelolaan pengguna, peran kustom, matriks izin, cakupan, dan log audit.',
  },
  backup: {
    label: 'Cadangan & Pemulihan SQLite',
    route: '/pengaturan',
    description: 'Snapshot, pengunduhan, dan pemulihan berkas database sekolah.',
  },
};

export const LOCKED_SUPER_ADMIN_PERMISSIONS: readonly string[] = [
  'dashboard:read',
  'pengguna:read',
  'pengguna:create',
  'pengguna:update',
  'pengguna:delete',
];

export const ROLE_DEFINITIONS: Array<{
  code: SystemRoleCode;
  name: string;
  description: string;
}> = [
  {
    code: 'SUPER_ADMIN',
    name: 'Super Administrator',
    description: 'Akses penuh seluruh modul sistem, manajemen akun, keamanan, dan cadangan database.',
  },
  {
    code: 'ADMIN_SEKOLAH',
    name: 'Administrator Sekolah',
    description: 'Mengelola identitas sekolah, master data siswa, guru, kelas, dan pengaturan akademik.',
  },
  {
    code: 'KEPALA_SEKOLAH',
    name: 'Kepala Sekolah',
    description: 'Memantau dasbor sekolah, menyetujui rapor, mengawasi jurnal guru dan kehadiran.',
  },
  {
    code: 'OPERATOR_SEKOLAH',
    name: 'Operator Sekolah',
    description: 'Mengelola sinkronisasi Dapodik, impor/ekspor E-Rapor, tahun ajaran, dan data pokok.',
  },
  {
    code: 'WALI_KELAS',
    name: 'Wali Kelas / Guru Kelas',
    description: 'Mengelola murid kelas binaan, presensi harian, nilai, catatan wali kelas, dan rapor.',
  },
  {
    code: 'GURU',
    name: 'Guru Mata Pelajaran',
    description: 'Mengelola CP/TP/ATP, jurnal mengajar, dan asesmen pada kelas dan mapel yang diampu.',
  },
  {
    code: 'WALI_ASUH',
    name: 'Wali Asuh / Pembina Asrama',
    description: 'Mengelola pembinaan keasramaan, input indikator & capaian asrama, presensi, dan cetak rapor keasramaan.',
  },
  {
    code: 'BENDAHARA',
    name: 'Bendahara',
    description: 'Mengakses data sekolah, perjalanan dinas luar, dan laporan administrasi sekolah.',
  },
  {
    code: 'TATA_USAHA',
    name: 'Staff Tata Usaha',
    description: 'Mengelola buku tamu, inventaris, kalender sekolah, kesiswaan, dan arsip data.',
  },
];

export function isSystemRoleCode(code: string): code is SystemRoleCode {
  return (SYSTEM_ROLE_CODES as readonly string[]).includes(code);
}

export function getDefaultRolePermissions(roleCode: RoleCode): Set<string> {
  const perms = new Set<string>();
  const add = (mod: ModuleName, actions: ActionName[]) => {
    for (const a of actions) perms.add(`${mod}:${a}`);
  };

  if (roleCode === 'SUPER_ADMIN') {
    for (const m of ALL_MODULES) add(m, ALL_ACTIONS);
    return perms;
  }

  if (roleCode === 'ADMIN_SEKOLAH') {
    for (const m of ALL_MODULES) {
      if (m !== 'backup') add(m, ALL_ACTIONS);
    }
    add('backup', ['read', 'create', 'export']);
    return perms;
  }

  if (roleCode === 'KEPALA_SEKOLAH') {
    for (const m of ALL_MODULES) {
      add(m, ['read', 'export', 'approve']);
    }
    add('administrasi', ['read', 'create', 'update', 'approve']);
    return perms;
  }

  if (roleCode === 'OPERATOR_SEKOLAH') {
    add('dashboard', ['read']);
    add('sekolah', ['read', 'update']);
    add('siswa', ['read', 'create', 'update', 'export']);
    add('guru', ['read', 'create', 'update', 'export']);
    add('kelas', ['read', 'create', 'update']);
    add('kurikulum', ['read', 'create', 'update', 'export']);
    add('jadwal', ['read', 'create', 'update']);
    add('penilaian', ['read', 'export']);
    add('absensi', ['read', 'export']);
    add('rapor', ['read', 'export']);
    add('dapodik', ALL_ACTIONS);
    add('erapor', ALL_ACTIONS);
    add('administrasi', ['read', 'create', 'update', 'export']);
    return perms;
  }

  if (roleCode === 'WALI_KELAS') {
    add('dashboard', ['read']);
    add('sekolah', ['read']);
    add('siswa', ['read', 'update', 'export']);
    add('guru', ['read']);
    add('kelas', ['read']);
    add('kurikulum', ['read', 'create', 'update']);
    add('jadwal', ['read']);
    add('penilaian', ['read', 'create', 'update', 'export']);
    add('keasramaan', ['read']);
    add('absensi', ['read', 'create', 'update', 'export']);
    add('rapor', ['read', 'create', 'update', 'export']);
    add('kesiswaan', ['read', 'create', 'update']);
    add('erapor', ['read', 'create', 'export']);
    add('ai', ['read', 'create']);
    add('administrasi', ['read', 'create']);
    return perms;
  }

  if (roleCode === 'GURU') {
    add('dashboard', ['read']);
    add('sekolah', ['read']);
    add('siswa', ['read']);
    add('guru', ['read']);
    add('kelas', ['read']);
    add('kurikulum', ['read', 'create', 'update']);
    add('jadwal', ['read']);
    add('penilaian', ['read', 'create', 'update', 'export']);
    add('absensi', ['read', 'create', 'update']);
    add('rapor', ['read']);
    add('ai', ['read', 'create']);
    add('administrasi', ['read', 'create']);
    return perms;
  }

  if (roleCode === 'WALI_ASUH') {
    add('dashboard', ['read']);
    add('sekolah', ['read']);
    add('siswa', ['read']);
    add('kelas', ['read']);
    add('kesiswaan', ['read', 'create', 'update']);
    add('keasramaan', ['read', 'create', 'update', 'delete', 'export']);
    add('absensi', ['read', 'create', 'update']);
    add('rapor', ['read', 'export']);
    add('administrasi', ['read', 'create']);
    return perms;
  }

  if (roleCode === 'BENDAHARA') {
    add('dashboard', ['read']);
    add('sekolah', ['read']);
    add('guru', ['read']);
    add('siswa', ['read']);
    add('administrasi', ['read', 'create', 'update', 'export', 'approve']);
    return perms;
  }

  if (roleCode === 'TATA_USAHA') {
    add('dashboard', ['read']);
    add('sekolah', ['read', 'update']);
    add('siswa', ['read', 'create', 'update', 'export']);
    add('guru', ['read', 'create', 'update']);
    add('kelas', ['read']);
    add('jadwal', ['read', 'create', 'update']);
    add('kesiswaan', ['read', 'create', 'update']);
    add('absensi', ['read', 'export']);
    add('rapor', ['read', 'export']);
    add('administrasi', ['read', 'create', 'update', 'delete', 'export']);
    return perms;
  }

  return perms;
}

export function checkRolePermission(
  roleCode: string,
  module: ModuleName,
  action: ActionName
): boolean {
  const set = getDefaultRolePermissions(roleCode as RoleCode);
  return set.has(`${module}:${action}`);
}
