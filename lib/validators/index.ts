import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(2, 'Nama pengguna minimal 2 karakter.'),
  password: z.string().min(4, 'Kata sandi minimal 4 karakter.'),
});

export const bootstrapAdminSchema = z
  .object({
    password: z.string().min(6, 'Kata sandi minimal 6 karakter.'),
    confirmPassword: z.string().min(6, 'Konfirmasi kata sandi minimal 6 karakter.'),
    initializeDemoRoles: z.boolean().optional().default(true),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok.',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi.'),
    newPassword: z.string().min(6, 'Kata sandi baru minimal 6 karakter.'),
    confirmPassword: z.string().min(6, 'Konfirmasi kata sandi wajib diisi.'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Konfirmasi kata sandi baru tidak cocok.',
    path: ['confirmPassword'],
  });

export const schoolUpdateSchema = z.object({
  name: z.string().trim().min(3, 'Nama sekolah minimal 3 karakter.'),
  npsn: z.string().trim().regex(/^\d{8}$/, 'NPSN harus terdiri dari 8 digit angka.'),
  jenjang: z.string().trim().min(2, 'Jenjang pendidikan wajib diisi.'),
  naungan: z.string().trim().min(2, 'Naungan wajib diisi.'),
  status: z.enum(['Negeri', 'Swasta']),
  accreditation: z.string().trim().min(1, 'Akreditasi wajib diisi.'),
  address: z.string().trim().min(5, 'Alamat sekolah minimal 5 karakter.'),
  village: z.string().trim().min(2, 'Desa/Kelurahan wajib diisi.'),
  district: z.string().trim().min(2, 'Kecamatan wajib diisi.'),
  regency: z.string().trim().min(2, 'Kabupaten/Kota wajib diisi.'),
  province: z.string().trim().min(2, 'Provinsi wajib diisi.'),
  postalCode: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
  email: z.string().trim().email('Format email tidak valid.').or(z.literal('')).default(''),
  website: z.string().trim().optional().default(''),
  principalName: z.string().trim().min(3, 'Nama Kepala Sekolah wajib diisi.'),
  principalNip: z.string().trim().optional().default(''),
  enableKeasramaan: z.boolean().optional(),
  enableAi: z.boolean().optional(),
});

const optionalNikSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d{16}$/.test(v), 'NIK harus terdiri dari 16 digit angka.')
  .optional()
  .default('');

const optionalEmailSchema = z
  .string()
  .trim()
  .email('Format email murid tidak valid.')
  .or(z.literal(''))
  .optional()
  .default('');

const optionalPositiveInt = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number().int().positive().nullable().optional()
);

export const studentCreateSchema = z.object({
  nisn: z.string().trim().regex(/^\d{10}$/, 'NISN harus tepat 10 digit angka.'),
  nis: z.string().trim().min(3, 'NIS minimal 3 karakter.'),
  fullName: z.string().trim().min(2, 'Nama lengkap murid wajib diisi.'),
  nickname: z.string().trim().max(60).optional().default(''),
  nik: optionalNikSchema,
  gender: z.enum(['L', 'P']),
  birthPlace: z.string().trim().min(2, 'Tempat lahir wajib diisi.'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal lahir harus YYYY-MM-DD.'),
  religion: z.string().trim().min(2, 'Agama wajib dipilih.'),
  childOrder: optionalPositiveInt,
  siblingCount: optionalPositiveInt,
  address: z.string().trim().optional().default(''),
  rtRw: z.string().trim().max(30).optional().default(''),
  village: z.string().trim().max(100).optional().default(''),
  district: z.string().trim().max(100).optional().default(''),
  regency: z.string().trim().max(100).optional().default(''),
  province: z.string().trim().max(100).optional().default(''),
  postalCode: z.string().trim().max(10).optional().default(''),
  phone: z.string().trim().optional().default(''),
  email: optionalEmailSchema,
  previousSchool: z.string().trim().optional().default(''),
  enrollmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['Aktif', 'Mutasi', 'Lulus', 'Keluar']).optional().default('Aktif'),
  classId: z.number().int().positive('Rombel wajib dipilih.').optional(),
  fatherName: z.string().trim().optional().default(''),
  fatherNik: optionalNikSchema,
  fatherJob: z.string().trim().optional().default(''),
  fatherEducation: z.string().trim().optional().default(''),
  fatherPhone: z.string().trim().optional().default(''),
  motherName: z.string().trim().optional().default(''),
  motherNik: optionalNikSchema,
  motherJob: z.string().trim().optional().default(''),
  motherEducation: z.string().trim().optional().default(''),
  motherPhone: z.string().trim().optional().default(''),
  parentPhone: z.string().trim().optional().default(''),
  guardianName: z.string().trim().optional().default(''),
  guardianRelation: z.string().trim().optional().default(''),
  guardianJob: z.string().trim().optional().default(''),
  guardianPhone: z.string().trim().optional().default(''),
  guardianAddress: z.string().trim().optional().default(''),
  waliAsuhTeacherId: optionalPositiveInt,
  waliAsuhName: z.string().trim().max(120).optional().default(''),
  waliAsramaName: z.string().trim().max(120).optional().default(''),
  dormitoryRoom: z.string().trim().max(80).optional().default(''),
  keasramaanNotes: z.string().trim().max(500).optional().default(''),
});

export const studentUpdateSchema = z.object({
  id: z.number().int().positive(),
  fullName: z.string().trim().min(2, 'Nama lengkap murid wajib diisi.').optional(),
  nickname: z.string().trim().max(60).optional(),
  nik: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{16}$/.test(v), 'NIK harus terdiri dari 16 digit angka.')
    .optional(),
  gender: z.enum(['L', 'P']).optional(),
  birthPlace: z.string().trim().min(2, 'Tempat lahir wajib diisi.').optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal lahir harus YYYY-MM-DD.').optional(),
  religion: z.string().trim().min(2, 'Agama wajib dipilih.').optional(),
  childOrder: optionalPositiveInt,
  siblingCount: optionalPositiveInt,
  address: z.string().trim().optional(),
  rtRw: z.string().trim().max(30).optional(),
  village: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  regency: z.string().trim().max(100).optional(),
  province: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(10).optional(),
  phone: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .email('Format email murid tidak valid.')
    .or(z.literal(''))
    .optional(),
  previousSchool: z.string().trim().optional(),
  enrollmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['Aktif', 'Mutasi', 'Lulus', 'Keluar']).optional(),
  statusReason: z.string().trim().optional(),
  classId: z.number().int().positive().optional(),
  fatherName: z.string().trim().optional(),
  fatherNik: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{16}$/.test(v), 'NIK Ayah harus terdiri dari 16 digit angka.')
    .optional(),
  fatherJob: z.string().trim().optional(),
  fatherEducation: z.string().trim().optional(),
  fatherPhone: z.string().trim().optional(),
  motherName: z.string().trim().optional(),
  motherNik: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{16}$/.test(v), 'NIK Ibu harus terdiri dari 16 digit angka.')
    .optional(),
  motherJob: z.string().trim().optional(),
  motherEducation: z.string().trim().optional(),
  motherPhone: z.string().trim().optional(),
  parentPhone: z.string().trim().optional(),
  guardianName: z.string().trim().optional(),
  guardianRelation: z.string().trim().optional(),
  guardianJob: z.string().trim().optional(),
  guardianPhone: z.string().trim().optional(),
  guardianAddress: z.string().trim().optional(),
  waliAsuhTeacherId: optionalPositiveInt,
  waliAsuhName: z.string().trim().max(120).optional(),
  waliAsramaName: z.string().trim().max(120).optional(),
  dormitoryRoom: z.string().trim().max(80).optional(),
  keasramaanNotes: z.string().trim().max(500).optional(),
});

export const teacherCreateSchema = z.object({
  fullName: z.string().trim().min(3, 'Nama lengkap guru wajib diisi.'),
  gender: z.enum(['L', 'P']),
  nuptk: z.string().trim().optional().default(''),
  nip: z.string().trim().optional().default(''),
  employmentStatus: z.string().trim().min(2, 'Status kepegawaian wajib diisi.'),
  education: z.string().trim().min(2, 'Pendidikan terakhir wajib diisi.'),
  specialization: z.string().trim().min(2, 'Bidang/Jabatan wajib diisi.'),
  phone: z.string().trim().optional().default(''),
  email: z.string().trim().optional().default(''),
  address: z.string().trim().optional().default(''),
});

export const subjectCreateSchema = z.object({
  code: z.string().trim().min(2, 'Kode mata pelajaran wajib diisi.'),
  name: z.string().trim().min(2, 'Nama mata pelajaran wajib diisi.'),
  category: z.enum(['Wajib', 'Pilihan', 'Muatan Lokal']),
  gradeLevel: z.number().int().min(1).max(12),
  kkm: z.number().int().min(0).max(100),
  weeklyHours: z.number().int().min(1).max(20),
  teacherId: z.number().int().positive().nullable().optional(),
});

export const learningObjectiveSchema = z.object({
  subjectId: z.number().int().positive(),
  semesterId: z.number().int().positive(),
  code: z.string().trim().min(2, 'Kode TP wajib diisi.'),
  scopeMaterial: z.string().trim().min(2, 'Lingkup materi wajib diisi.'),
  description: z.string().trim().min(5, 'Deskripsi Tujuan Pembelajaran minimal 5 karakter.'),
  atpOrder: z.number().int().min(1).default(1),
  kktpThreshold: z.number().int().min(0).max(100).default(75),
});

export const assessmentWeightSchema = z
  .object({
    subjectId: z.number().int().positive(),
    classId: z.number().int().positive(),
    semesterId: z.number().int().positive(),
    weightLm: z.number().int().min(0).max(100),
    weightSts: z.number().int().min(0).max(100),
    weightSas: z.number().int().min(0).max(100),
    kktpMin: z.number().int().min(0).max(100),
  })
  .refine((d) => d.weightLm + d.weightSts + d.weightSas === 100, {
    message: 'Jumlah bobot Lingkup Materi, STS, dan SAS harus tepat 100%.',
  });

const nullableScore = z.number().min(0).max(100).nullable().optional();

export const summativeScoreUpdateSchema = z.object({
  studentId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  classId: z.number().int().positive(),
  semesterId: z.number().int().positive(),
  lm1: nullableScore,
  lm2: nullableScore,
  lm3: nullableScore,
  lm4: nullableScore,
  sts: nullableScore,
  sas: nullableScore,
  remedialScore: nullableScore,
  enrichmentNote: z.string().trim().optional().default(''),
  teacherNote: z.string().trim().optional().default(''),
});

export const formativeUpdateSchema = z.object({
  studentId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  learningObjectiveId: z.number().int().positive(),
  classId: z.number().int().positive(),
  semesterId: z.number().int().positive(),
  status: z.enum(['Tercapai', 'Perlu Pendalaman', 'Perlu Bimbingan']),
  score: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().trim().optional().default(''),
});

export const attendanceBatchSchema = z.object({
  classId: z.number().int().positive(),
  semesterId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.'),
  entries: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        status: z.enum(['H', 'S', 'I', 'A']),
        notes: z.string().trim().optional().default(''),
      })
    )
    .min(1),
});

export const journalCreateSchema = z.object({
  teacherId: z.number().int().positive(),
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  semesterId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lessonHour: z.string().trim().min(1, 'Jam ke- wajib diisi.'),
  material: z.string().trim().min(3, 'Materi pembelajaran wajib diisi.'),
  objectiveSummary: z.string().trim().min(3, 'Tujuan pembelajaran wajib diisi.'),
  activities: z.string().trim().min(3, 'Kegiatan pembelajaran wajib diisi.'),
  completionStatus: z.enum(['Tuntas', 'Sebagian', 'Tertunda']),
  notes: z.string().trim().optional().default(''),
});

export const dapodikConfigSchema = z.object({
  webServiceUrl: z
    .string()
    .trim()
    .min(3, 'Alamat Web Service Dapodik wajib diisi (misal http://localhost:5774).'),
  npsn: z.string().trim().regex(/^\d{8}$/, 'NPSN harus 8 digit.'),
  apiToken: z.string().trim().optional(),
  mode: z.enum(['WebService', 'Sandbox']),
});

export const roleCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z][A-Z0-9_]{2,39}$/,
      'Kode peran harus diawali huruf, terdiri dari huruf kapital, angka, atau garis bawah (3–40 karakter).'
    ),
  name: z.string().trim().min(3, 'Nama peran minimal 3 karakter.').max(60),
  description: z.string().trim().min(5, 'Deskripsi peran minimal 5 karakter.').max(250),
  cloneFromRoleId: z.number().int().positive().nullable().optional(),
  permissionKeys: z.array(z.string()).optional(),
});

export const roleUpdateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().trim().min(3, 'Nama peran minimal 3 karakter.').max(60).optional(),
  description: z.string().trim().min(5, 'Deskripsi peran minimal 5 karakter.').max(250).optional(),
  permissionKeys: z.array(z.string()).optional(),
  resetToDefault: z.boolean().optional(),
});

export const userScopeSchema = z.object({
  scopeMode: z.enum(['ALL', 'ASSIGNED', 'CUSTOM']).default('ASSIGNED'),
  classIds: z.array(z.number().int().positive()).default([]),
  subjectIds: z.array(z.number().int().positive()).default([]),
});

export const keasramaanIndicatorSchema = z.object({
  id: z.number().int().positive().optional(),
  category: z.enum(['A. Kepemimpinan', 'B. Ketaatan Ibadah']),
  name: z.string().trim().min(3, 'Nama indikator keasramaan minimal 3 karakter.').max(120),
  sortOrder: z.number().int().min(1).max(99).default(1),
  isActive: z.boolean().optional().default(true),
});

export const keasramaanScoreUpdateSchema = z.object({
  classId: z.number().int().positive(),
  semesterId: z.number().int().positive().optional(),
  entries: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        indicatorId: z.number().int().positive(),
        predicate: z.enum(['A', 'B', 'C']),
        achievedNote: z.string().trim().max(400).optional().default(''),
        guidanceNote: z.string().trim().max(400).optional().default(''),
        notes: z.string().trim().max(300).optional().default(''),
        waliAsramaName: z.string().trim().max(120).optional().default(''),
        waliAsuhName: z.string().trim().max(120).optional().default(''),
      })
    )
    .min(1),
});

