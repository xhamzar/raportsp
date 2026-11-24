import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';

// ============================================================================
// 1. AUTHENTICATION, RBAC & AUDIT
// ============================================================================

export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
});

export const permissions = sqliteTable(
  'permissions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    module: text('module').notNull(),
    action: text('action').notNull(), // read | create | update | delete | export | approve
    description: text('description').notNull(),
  },
  (table) => [uniqueIndex('perm_module_action_idx').on(table.module, table.action)]
);

export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: integer('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [uniqueIndex('role_perm_unique_idx').on(table.roleId, table.permissionId)]
);

export const teachers = sqliteTable('teachers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dapodikPtkId: text('dapodik_ptk_id'),
  nuptk: text('nuptk'),
  nip: text('nip'),
  fullName: text('full_name').notNull(),
  gender: text('gender').notNull().default('L'), // L | P
  employmentStatus: text('employment_status').notNull().default('PNS'), // PNS | PPPK | GTY | Honorer
  education: text('education').notNull().default('S1 PGSD'),
  specialization: text('specialization').notNull().default('Guru Kelas SD'),
  phone: text('phone').default(''),
  email: text('email').default(''),
  address: text('address').default(''),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const staff = sqliteTable('staff', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nip: text('nip'),
  fullName: text('full_name').notNull(),
  gender: text('gender').notNull().default('L'),
  position: text('position').notNull(),
  employmentStatus: text('employment_status').notNull().default('Honorer'),
  phone: text('phone').default(''),
  email: text('email').default(''),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  roleId: integer('role_id')
    .notNull()
    .references(() => roles.id),
  teacherId: integer('teacher_id').references(() => teachers.id, { onDelete: 'set null' }),
  scopeMode: text('scope_mode').notNull().default('ASSIGNED'), // ALL | ASSIGNED | CUSTOM
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const userClassScopes = sqliteTable(
  'user_class_scopes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
  },
  (table) => [uniqueIndex('user_class_scope_idx').on(table.userId, table.classId)]
);

export const userSubjectScopes = sqliteTable(
  'user_subject_scopes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
  },
  (table) => [uniqueIndex('user_subject_scope_idx').on(table.userId, table.subjectId)]
);

export const userSessions = sqliteTable(
  'user_sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: text('expires_at').notNull(),
    userAgent: text('user_agent').default(''),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('session_user_idx').on(table.userId)]
);

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    actorName: text('actor_name').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').default(''),
    details: text('details').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('audit_created_idx').on(table.createdAt)]
);

// ============================================================================
// 2. SCHOOL PROFILE & CALENDAR
// ============================================================================

export const schools = sqliteTable('schools', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  npsn: text('npsn').notNull(),
  jenjang: text('jenjang').notNull().default('Sekolah Dasar (SD)'),
  naungan: text('naungan').notNull().default('Kementerian Pendidikan Dasar dan Menengah'),
  status: text('status').notNull().default('Negeri'),
  accreditation: text('accreditation').notNull().default('A'),
  address: text('address').notNull(),
  village: text('village').notNull(),
  district: text('district').notNull(),
  regency: text('regency').notNull(),
  province: text('province').notNull(),
  postalCode: text('postal_code').default(''),
  phone: text('phone').default(''),
  email: text('email').default(''),
  website: text('website').default(''),
  principalName: text('principal_name').notNull(),
  principalNip: text('principal_nip').default(''),
  logoUrl: text('logo_url').default('/images/school-crest.jpg'),
  enableKeasramaan: integer('enable_keasramaan', { mode: 'boolean' }).notNull().default(false),
  enableAi: integer('enable_ai', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull(),
});

export const academicYears = sqliteTable('academic_years', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(), // e.g., 2026/2027
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
});

export const semesters = sqliteTable('semesters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  academicYearId: integer('academic_year_id')
    .notNull()
    .references(() => academicYears.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // Ganjil | Genap
  startDate: text('start_date').notNull(),
  reportDate: text('report_date').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
});

export const schoolCalendars = sqliteTable('school_calendars', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  semesterId: integer('semester_id')
    .notNull()
    .references(() => semesters.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  category: text('category').notNull(), // Libur Nasional | Ujian | Kegiatan Sekolah | Pembagian Rapor
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  isHoliday: integer('is_holiday', { mode: 'boolean' }).notNull().default(false),
  description: text('description').default(''),
});

export const classrooms = sqliteTable('classrooms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  capacity: integer('capacity').notNull().default(28),
  condition: text('condition').notNull().default('Baik'),
  notes: text('notes').default(''),
});

export const facilities = sqliteTable('facilities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  quantity: integer('quantity').notNull().default(1),
  condition: text('condition').notNull().default('Baik'),
  notes: text('notes').default(''),
});

export const guestbookEntries = sqliteTable('guestbook_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  visitorName: text('visitor_name').notNull(),
  institution: text('institution').notNull(),
  purpose: text('purpose').notNull(),
  personToMeet: text('person_to_meet').notNull(),
  phone: text('phone').default(''),
  visitDate: text('visit_date').notNull(),
  notes: text('notes').default(''),
  createdAt: text('created_at').notNull(),
});

export const officialTravels = sqliteTable('official_travels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  teacherId: integer('teacher_id')
    .notNull()
    .references(() => teachers.id, { onDelete: 'cascade' }),
  destination: text('destination').notNull(),
  purpose: text('purpose').notNull(),
  letterNumber: text('letter_number').default(''),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  status: text('status').notNull().default('Diajukan'), // Diajukan | Disetujui | Selesai
  notes: text('notes').default(''),
  createdAt: text('created_at').notNull(),
});

// ============================================================================
// 3. CLASSES, SUBJECTS & KURIKULUM MERDEKA
// ============================================================================

export const classes = sqliteTable('classes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  academicYearId: integer('academic_year_id')
    .notNull()
    .references(() => academicYears.id, { onDelete: 'cascade' }),
  semesterId: integer('semester_id')
    .notNull()
    .references(() => semesters.id, { onDelete: 'cascade' }),
  gradeLevel: integer('grade_level').notNull(), // 1..6 for SD/MI
  fase: text('fase').notNull(), // A (1-2) | B (3-4) | C (5-6)
  name: text('name').notNull(), // e.g. 1 A, 4 A, 6 A
  homeroomTeacherId: integer('homeroom_teacher_id').references(() => teachers.id, {
    onDelete: 'set null',
  }),
  classroomId: integer('classroom_id').references(() => classrooms.id, {
    onDelete: 'set null',
  }),
  capacity: integer('capacity').notNull().default(28),
  dapodikRombelId: text('dapodik_rombel_id'),
});

export const subjects = sqliteTable('subjects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull().default('Wajib'), // Wajib | Pilihan | Muatan Lokal
  gradeLevel: integer('grade_level').notNull(),
  fase: text('fase').notNull(),
  kkm: integer('kkm').notNull().default(75),
  weeklyHours: integer('weekly_hours').notNull().default(4),
  sortOrder: integer('sort_order').notNull().default(1),
  teacherId: integer('teacher_id').references(() => teachers.id, { onDelete: 'set null' }),
  dapodikMapelId: text('dapodik_mapel_id'),
  dapodikPembelajaranId: text('dapodik_pembelajaran_id'),
});

export const learningOutcomes = sqliteTable('learning_outcomes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subjectId: integer('subject_id')
    .notNull()
    .references(() => subjects.id, { onDelete: 'cascade' }),
  fase: text('fase').notNull(),
  code: text('code').notNull(),
  element: text('element').notNull(),
  description: text('description').notNull(),
});

export const learningObjectives = sqliteTable('learning_objectives', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subjectId: integer('subject_id')
    .notNull()
    .references(() => subjects.id, { onDelete: 'cascade' }),
  semesterId: integer('semester_id')
    .notNull()
    .references(() => semesters.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  scopeMaterial: text('scope_material').notNull(), // Lingkup Materi
  description: text('description').notNull(),
  atpOrder: integer('atp_order').notNull().default(1),
  kktpThreshold: integer('kktp_threshold').notNull().default(75),
});

export const rpmPlans = sqliteTable('rpm_plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subjectId: integer('subject_id')
    .notNull()
    .references(() => subjects.id, { onDelete: 'cascade' }),
  classId: integer('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  semesterId: integer('semester_id')
    .notNull()
    .references(() => semesters.id, { onDelete: 'cascade' }),
  cpText: text('cp_text').notNull(),
  scopeMaterial: text('scope_material').notNull(),
  tpIdsJson: text('tp_ids_json').notNull().default('[]'),
  dimensionsJson: text('dimensions_json').notNull().default('[]'),
  studentCharacteristics: text('student_characteristics').default(''),
  identificationJson: text('identification_json').notNull().default('{}'),
  designJson: text('design_json').notNull().default('{}'),
  experienceJson: text('experience_json').notNull().default('{}'),
  assessmentJson: text('assessment_json').notNull().default('{}'),
  status: text('status').notNull().default('Draft'), // Draft | Disetujui
  createdByUserId: integer('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const schedules = sqliteTable('schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classId: integer('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  semesterId: integer('semester_id')
    .notNull()
    .references(() => semesters.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(), // 1=Senin .. 6=Sabtu
  periodNumber: integer('period_number').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  subjectId: integer('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
  teacherId: integer('teacher_id').references(() => teachers.id, { onDelete: 'set null' }),
  activityLabel: text('activity_label').default(''),
});

export const bellConfigs = sqliteTable('bell_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  periodNumber: integer('period_number').notNull().unique(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  label: text('label').notNull(),
  isBreak: integer('is_break', { mode: 'boolean' }).notNull().default(false),
});

// ============================================================================
// 4. STUDENTS & HISTORICAL RECORDS
// ============================================================================

export const students = sqliteTable(
  'students',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    dapodikStudentId: text('dapodik_student_id'),
    nisn: text('nisn').notNull(),
    nis: text('nis').notNull(),
    fullName: text('full_name').notNull(),
    nickname: text('nickname').default(''),
    nik: text('nik').default(''),
    gender: text('gender').notNull().default('L'), // L | P
    birthPlace: text('birth_place').notNull(),
    birthDate: text('birth_date').notNull(),
    religion: text('religion').notNull().default('Islam'),
    childOrder: integer('child_order'),
    siblingCount: integer('sibling_count'),
    photoPath: text('photo_path').default(''),
    address: text('address').default(''),
    rtRw: text('rt_rw').default(''),
    village: text('village').default(''),
    district: text('district').default(''),
    regency: text('regency').default(''),
    province: text('province').default(''),
    postalCode: text('postal_code').default(''),
    phone: text('phone').default(''),
    email: text('email').default(''),
    previousSchool: text('previous_school').default(''),
    enrollmentDate: text('enrollment_date').notNull(),
    status: text('status').notNull().default('Aktif'), // Aktif | Mutasi | Lulus | Keluar
    fatherName: text('father_name').default(''),
    fatherNik: text('father_nik').default(''),
    fatherJob: text('father_job').default(''),
    fatherEducation: text('father_education').default(''),
    fatherPhone: text('father_phone').default(''),
    motherName: text('mother_name').default(''),
    motherNik: text('mother_nik').default(''),
    motherJob: text('mother_job').default(''),
    motherEducation: text('mother_education').default(''),
    motherPhone: text('mother_phone').default(''),
    parentPhone: text('parent_phone').default(''),
    guardianName: text('guardian_name').default(''),
    guardianRelation: text('guardian_relation').default(''),
    guardianJob: text('guardian_job').default(''),
    guardianPhone: text('guardian_phone').default(''),
    guardianAddress: text('guardian_address').default(''),
    waliAsuhTeacherId: integer('wali_asuh_teacher_id').references(() => teachers.id, {
      onDelete: 'set null',
    }),
    waliAsuhName: text('wali_asuh_name').default(''),
    waliAsramaName: text('wali_asrama_name').default(''),
    dormitoryRoom: text('dormitory_room').default(''),
    keasramaanNotes: text('keasramaan_notes').default(''),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('student_nisn_idx').on(table.nisn),
    index('student_name_idx').on(table.fullName),
  ]
);

export const classStudents = sqliteTable(
  'class_students',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    semesterId: integer('semester_id')
      .notNull()
      .references(() => semesters.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('Aktif'),
    enrolledAt: text('enrolled_at').notNull(),
    dapodikAnggotaRombelId: text('dapodik_anggota_rombel_id'),
  },
  (table) => [uniqueIndex('class_student_sem_idx').on(table.studentId, table.semesterId)]
);

export const studentStatusHistory = sqliteTable('student_status_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id')
    .notNull()
    .references(() => students.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status').notNull(),
  toStatus: text('to_status').notNull(),
  reason: text('reason').notNull(),
  effectiveDate: text('effective_date').notNull(),
  createdAt: text('created_at').notNull(),
});

export const studentAffairsRecords = sqliteTable('student_affairs_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id')
    .notNull()
    .references(() => students.id, { onDelete: 'cascade' }),
  semesterId: integer('semester_id')
    .notNull()
    .references(() => semesters.id, { onDelete: 'cascade' }),
  recordType: text('record_type').notNull(), // Prestasi | Pelanggaran | Konseling | UKS | Izin
  title: text('title').notNull(),
  description: text('description').notNull(),
  points: integer('points').notNull().default(0),
  date: text('date').notNull(),
  recordedByUserId: integer('recorded_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  isRestricted: integer('is_restricted', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

// ============================================================================
// 5. TEACHER ASSIGNMENTS, ATTENDANCE & JOURNALS
// ============================================================================

export const teacherAssignments = sqliteTable('teacher_assignments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  teacherId: integer('teacher_id')
    .notNull()
    .references(() => teachers.id, { onDelete: 'cascade' }),
  classId: integer('class_id').references(() => classes.id, { onDelete: 'set null' }),
  semesterId: integer('semester_id')
    .notNull()
    .references(() => semesters.id, { onDelete: 'cascade' }),
  assignmentType: text('assignment_type').notNull(), // Wali Kelas | Guru Kelas | Guru Mapel | Tugas Tambahan
  weeklyHours: integer('weekly_hours').notNull().default(24),
  notes: text('notes').default(''),
});

export const teacherAttendance = sqliteTable(
  'teacher_attendance',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    teacherId: integer('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    semesterId: integer('semester_id')
      .notNull()
      .references(() => semesters.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    status: text('status').notNull(), // Hadir | Sakit | Izin | Alpa | Dinas Luar
    checkInTime: text('check_in_time').default(''),
    notes: text('notes').default(''),
  },
  (table) => [uniqueIndex('teacher_att_date_idx').on(table.teacherId, table.date)]
);

export const teacherJournals = sqliteTable('teacher_journals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  teacherId: integer('teacher_id')
    .notNull()
    .references(() => teachers.id, { onDelete: 'cascade' }),
  classId: integer('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  subjectId: integer('subject_id')
    .notNull()
    .references(() => subjects.id, { onDelete: 'cascade' }),
  semesterId: integer('semester_id')
    .notNull()
    .references(() => semesters.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  lessonHour: text('lesson_hour').notNull(), // e.g., 1-2
  material: text('material').notNull(),
  objectiveSummary: text('objective_summary').notNull(),
  activities: text('activities').notNull(),
  completionStatus: text('completion_status').notNull().default('Tuntas'), // Tuntas | Sebagian | Tertunda
  notes: text('notes').default(''),
  createdAt: text('created_at').notNull(),
});

// ============================================================================
// 6. ASSESSMENTS, ATTENDANCE & REPORT CARDS
// ============================================================================

export const assessmentWeights = sqliteTable(
  'assessment_weights',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    semesterId: integer('semester_id')
      .notNull()
      .references(() => semesters.id, { onDelete: 'cascade' }),
    weightLm: integer('weight_lm').notNull().default(40),
    weightSts: integer('weight_sts').notNull().default(30),
    weightSas: integer('weight_sas').notNull().default(30),
    kktpMin: integer('kktp_min').notNull().default(75),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('weight_subj_cls_sem_idx').on(table.subjectId, table.classId, table.semesterId),
  ]
);

export const formativeAssessments = sqliteTable(
  'formative_assessments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    learningObjectiveId: integer('learning_objective_id')
      .notNull()
      .references(() => learningObjectives.id, { onDelete: 'cascade' }),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    semesterId: integer('semester_id')
      .notNull()
      .references(() => semesters.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('Tercapai'), // Tercapai | Perlu Pendalaman | Perlu Bimbingan
    score: real('score'),
    notes: text('notes').default(''),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('formative_stu_tp_sem_idx').on(
      table.studentId,
      table.learningObjectiveId,
      table.semesterId
    ),
  ]
);

export const summativeScores = sqliteTable(
  'summative_scores',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    subjectId: integer('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    semesterId: integer('semester_id')
      .notNull()
      .references(() => semesters.id, { onDelete: 'cascade' }),
    lm1: real('lm1'),
    lm2: real('lm2'),
    lm3: real('lm3'),
    lm4: real('lm4'),
    sts: real('sts'),
    sas: real('sas'),
    midtermScore: real('midterm_score'),
    finalScore: real('final_score'),
    teacherNote: text('teacher_note').default(''),
    remedialScore: real('remedial_score'),
    enrichmentNote: text('enrichment_note').default(''),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('summative_stu_subj_sem_idx').on(
      table.studentId,
      table.subjectId,
      table.semesterId
    ),
  ]
);

export const cocurricularProjects = sqliteTable('cocurricular_projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classId: integer('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  semesterId: integer('semester_id')
    .notNull()
    .references(() => semesters.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  title: text('title').notNull(),
  dimensionsJson: text('dimensions_json').notNull(),
  description: text('description').default(''),
});

export const cocurricularScores = sqliteTable(
  'cocurricular_scores',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projectId: integer('project_id')
      .notNull()
      .references(() => cocurricularProjects.id, { onDelete: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    predicate: text('predicate').notNull().default('Baik'), // Sangat Baik | Baik | Cukup | Perlu Bimbingan
    description: text('description').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('cocu_proj_stu_idx').on(table.projectId, table.studentId)]
);

export const extracurriculars = sqliteTable('extracurriculars', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  instructorName: text('instructor_name').notNull(),
  scheduleDay: text('schedule_day').notNull().default('Sabtu'),
  learningObjectivesJson: text('learning_objectives_json').notNull().default('[]'),
});

export const extracurricularScores = sqliteTable(
  'extracurricular_scores',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    extracurricularId: integer('extracurricular_id')
      .notNull()
      .references(() => extracurriculars.id, { onDelete: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    semesterId: integer('semester_id')
      .notNull()
      .references(() => semesters.id, { onDelete: 'cascade' }),
    predicate: text('predicate').notNull().default('Baik'), // Sangat Baik | Baik | Cukup | Kurang
    description: text('description').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('ekstra_stu_sem_idx').on(
      table.extracurricularId,
      table.studentId,
      table.semesterId
    ),
  ]
);

export const studentAttendance = sqliteTable(
  'student_attendance',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    semesterId: integer('semester_id')
      .notNull()
      .references(() => semesters.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    status: text('status').notNull(), // H | S | I | A
    notes: text('notes').default(''),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('stu_att_date_idx').on(table.studentId, table.date)]
);

export const homeroomNotes = sqliteTable(
  'homeroom_notes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    classId: integer('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    semesterId: integer('semester_id')
      .notNull()
      .references(() => semesters.id, { onDelete: 'cascade' }),
    note: text('note').notNull().default(''),
    promotionDecision: text('promotion_decision').default(''),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('homeroom_note_stu_sem_idx').on(table.studentId, table.semesterId)]
);

export const keasramaanIndicators = sqliteTable('keasramaan_indicators', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  category: text('category').notNull(), // A. Kepemimpinan | B. Ketaatan Ibadah
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(1),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const keasramaanScores = sqliteTable(
  'keasramaan_scores',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    indicatorId: integer('indicator_id')
      .notNull()
      .references(() => keasramaanIndicators.id, { onDelete: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    semesterId: integer('semester_id')
      .notNull()
      .references(() => semesters.id, { onDelete: 'cascade' }),
    predicate: text('predicate').notNull().default('B'), // A | B | C
    achievedDescription: text('achieved_description').notNull().default(''),
    guidanceDescription: text('guidance_description').notNull().default(''),
    waliAsramaName: text('wali_asrama_name').default(''),
    waliAsramaNip: text('wali_asrama_nip').default(''),
    waliAsuhName: text('wali_asuh_name').default(''),
    waliAsuhNip: text('wali_asuh_nip').default(''),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('keasramaan_ind_stu_sem_idx').on(
      table.indicatorId,
      table.studentId,
      table.semesterId
    ),
  ]
);

// ============================================================================
// 7. NOTIFICATIONS, INTEGRATIONS & BACKUPS
// ============================================================================

export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  message: text('message').notNull(),
  category: text('category').notNull().default('Akademik'), // Akademik | Dapodik | Presensi | Sistem
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  linkHref: text('link_href').default('/dashboard'),
  createdAt: text('created_at').notNull(),
});

export const dapodikConfig = sqliteTable('dapodik_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  webServiceUrl: text('web_service_url').notNull().default('http://localhost:5774'),
  npsn: text('npsn').notNull(),
  apiToken: text('api_token').default(''),
  mode: text('mode').notNull().default('WebService'), // WebService | Sandbox
  connectionStatus: text('connection_status').notNull().default('Belum Terhubung'),
  lastSyncAt: text('last_sync_at'),
  updatedAt: text('updated_at').notNull(),
});

export const dapodikExternalMappings = sqliteTable(
  'dapodik_external_mappings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entityType: text('entity_type').notNull(), // student | teacher | class | subject
    localId: integer('local_id').notNull(),
    externalId: text('external_id').notNull(),
    lastSyncedAt: text('last_synced_at').notNull(),
  },
  (table) => [uniqueIndex('dapodik_map_local_idx').on(table.entityType, table.localId)]
);

export const dapodikSyncLogs = sqliteTable('dapodik_sync_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  syncType: text('sync_type').notNull(),
  direction: text('direction').notNull(), // Import | Export
  status: text('status').notNull(), // Berhasil | Gagal | Sebagian
  recordsProcessed: integer('records_processed').notNull().default(0),
  recordsCreated: integer('records_created').notNull().default(0),
  recordsUpdated: integer('records_updated').notNull().default(0),
  errorsJson: text('errors_json').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
});

export const dapodikSubmissionLogs = sqliteTable('dapodik_submission_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classId: integer('class_id')
    .notNull()
    .references(() => classes.id, { onDelete: 'cascade' }),
  subjectId: integer('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
  semesterId: integer('semester_id')
    .notNull()
    .references(() => semesters.id, { onDelete: 'cascade' }),
  submissionPhase: text('submission_phase').notNull(), // MATEV | NILAI_AKHIR
  isDryRun: integer('is_dry_run', { mode: 'boolean' }).notNull().default(true),
  status: text('status').notNull(), // Berhasil | Gagal | Validasi Terlewat
  payloadSummaryJson: text('payload_summary_json').notNull().default('{}'),
  responseMessage: text('response_message').notNull(),
  createdAt: text('created_at').notNull(),
});

export const eraporImportLogs = sqliteTable('erapor_import_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateVersion: text('template_version').notNull(),
  fileName: text('file_name').notNull(),
  totalRows: integer('total_rows').notNull().default(0),
  successRows: integer('success_rows').notNull().default(0),
  errorRows: integer('error_rows').notNull().default(0),
  errorsJson: text('errors_json').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
});

export const dapodikSubjects = sqliteTable('dapodik_subjects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mataPelajaranId: text('mata_pelajaran_id').notNull().unique(),
  nama: text('nama').notNull(),
  jurusanId: text('jurusan_id').default(''),
  pilihanSekolah: integer('pilihan_sekolah', { mode: 'boolean' }).notNull().default(false),
  pilihanEvaluasi: integer('pilihan_evaluasi', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull(),
});

export const backups = sqliteTable('backups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fileName: text('file_name').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  checksum: text('checksum').notNull(),
  notes: text('notes').default(''),
  createdByUserId: integer('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: text('created_at').notNull(),
});
