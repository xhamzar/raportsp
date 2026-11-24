import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  __sqlite?: Database.Database;
  __drizzle?: ReturnType<typeof drizzle<typeof schema>>;
};

export function getDbPath(): string {
  const configured = process.env.DATABASE_PATH || './data/sekolahkita.db';
  return path.resolve(process.cwd(), configured);
}

function ensureTables(sqlite: Database.Database) {
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      description TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS perm_module_action_idx ON permissions(module, action);

    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS role_perm_unique_idx ON role_permissions(role_id, permission_id);

    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dapodik_ptk_id TEXT,
      nuptk TEXT,
      nip TEXT,
      full_name TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT 'L',
      employment_status TEXT NOT NULL DEFAULT 'PNS',
      education TEXT NOT NULL DEFAULT 'S1 PGSD',
      specialization TEXT NOT NULL DEFAULT 'Guru Kelas SD',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nip TEXT,
      full_name TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT 'L',
      position TEXT NOT NULL,
      employment_status TEXT NOT NULL DEFAULT 'Honorer',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT,
      role_id INTEGER NOT NULL REFERENCES roles(id),
      teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      scope_mode TEXT NOT NULL DEFAULT 'ASSIGNED',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      user_agent TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS session_user_idx ON user_sessions(user_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT DEFAULT '',
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      npsn TEXT NOT NULL,
      jenjang TEXT NOT NULL DEFAULT 'Sekolah Dasar (SD)',
      naungan TEXT NOT NULL DEFAULT 'Kementerian Pendidikan Dasar dan Menengah',
      status TEXT NOT NULL DEFAULT 'Negeri',
      accreditation TEXT NOT NULL DEFAULT 'A',
      address TEXT NOT NULL,
      village TEXT NOT NULL,
      district TEXT NOT NULL,
      regency TEXT NOT NULL,
      province TEXT NOT NULL,
      postal_code TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      website TEXT DEFAULT '',
      principal_name TEXT NOT NULL,
      principal_nip TEXT DEFAULT '',
      logo_url TEXT DEFAULT '/images/school-crest.jpg',
      enable_keasramaan INTEGER NOT NULL DEFAULT 0,
      enable_ai INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS academic_years (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS semesters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      report_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS school_calendars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_holiday INTEGER NOT NULL DEFAULT 0,
      description TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS classrooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 28,
      condition TEXT NOT NULL DEFAULT 'Baik',
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS facilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      condition TEXT NOT NULL DEFAULT 'Baik',
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS guestbook_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_name TEXT NOT NULL,
      institution TEXT NOT NULL,
      purpose TEXT NOT NULL,
      person_to_meet TEXT NOT NULL,
      phone TEXT DEFAULT '',
      visit_date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS official_travels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      destination TEXT NOT NULL,
      purpose TEXT NOT NULL,
      letter_number TEXT DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Diajukan',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      grade_level INTEGER NOT NULL,
      fase TEXT NOT NULL,
      name TEXT NOT NULL,
      homeroom_teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      classroom_id INTEGER REFERENCES classrooms(id) ON DELETE SET NULL,
      capacity INTEGER NOT NULL DEFAULT 28,
      dapodik_rombel_id TEXT
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Wajib',
      grade_level INTEGER NOT NULL,
      fase TEXT NOT NULL,
      kkm INTEGER NOT NULL DEFAULT 75,
      weekly_hours INTEGER NOT NULL DEFAULT 4,
      sort_order INTEGER NOT NULL DEFAULT 1,
      teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      dapodik_mapel_id TEXT,
      dapodik_pembelajaran_id TEXT
    );

    CREATE TABLE IF NOT EXISTS learning_outcomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      fase TEXT NOT NULL,
      code TEXT NOT NULL,
      element TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learning_objectives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      scope_material TEXT NOT NULL,
      description TEXT NOT NULL,
      atp_order INTEGER NOT NULL DEFAULT 1,
      kktp_threshold INTEGER NOT NULL DEFAULT 75
    );

    CREATE TABLE IF NOT EXISTS rpm_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      cp_text TEXT NOT NULL,
      scope_material TEXT NOT NULL,
      tp_ids_json TEXT NOT NULL DEFAULT '[]',
      dimensions_json TEXT NOT NULL DEFAULT '[]',
      student_characteristics TEXT DEFAULT '',
      identification_json TEXT NOT NULL DEFAULT '{}',
      design_json TEXT NOT NULL DEFAULT '{}',
      experience_json TEXT NOT NULL DEFAULT '{}',
      assessment_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'Draft',
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      period_number INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
      teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      activity_label TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS bell_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_number INTEGER NOT NULL UNIQUE,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      label TEXT NOT NULL,
      is_break INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dapodik_student_id TEXT,
      nisn TEXT NOT NULL,
      nis TEXT NOT NULL,
      full_name TEXT NOT NULL,
      nickname TEXT DEFAULT '',
      nik TEXT DEFAULT '',
      gender TEXT NOT NULL DEFAULT 'L',
      birth_place TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      religion TEXT NOT NULL DEFAULT 'Islam',
      child_order INTEGER,
      sibling_count INTEGER,
      photo_path TEXT DEFAULT '',
      address TEXT DEFAULT '',
      rt_rw TEXT DEFAULT '',
      village TEXT DEFAULT '',
      district TEXT DEFAULT '',
      regency TEXT DEFAULT '',
      province TEXT DEFAULT '',
      postal_code TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      previous_school TEXT DEFAULT '',
      enrollment_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Aktif',
      father_name TEXT DEFAULT '',
      father_nik TEXT DEFAULT '',
      father_job TEXT DEFAULT '',
      father_education TEXT DEFAULT '',
      father_phone TEXT DEFAULT '',
      mother_name TEXT DEFAULT '',
      mother_nik TEXT DEFAULT '',
      mother_job TEXT DEFAULT '',
      mother_education TEXT DEFAULT '',
      mother_phone TEXT DEFAULT '',
      parent_phone TEXT DEFAULT '',
      guardian_name TEXT DEFAULT '',
      guardian_relation TEXT DEFAULT '',
      guardian_job TEXT DEFAULT '',
      guardian_phone TEXT DEFAULT '',
      guardian_address TEXT DEFAULT '',
      wali_asuh_teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      wali_asuh_name TEXT DEFAULT '',
      wali_asrama_name TEXT DEFAULT '',
      dormitory_room TEXT DEFAULT '',
      keasramaan_notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS student_nisn_idx ON students(nisn);
    CREATE INDEX IF NOT EXISTS student_name_idx ON students(full_name);

    CREATE TABLE IF NOT EXISTS class_students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'Aktif',
      enrolled_at TEXT NOT NULL,
      dapodik_anggota_rombel_id TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS class_student_sem_idx ON class_students(student_id, semester_id);

    CREATE TABLE IF NOT EXISTS student_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      reason TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS student_affairs_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      record_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      recorded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_restricted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teacher_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      assignment_type TEXT NOT NULL,
      weekly_hours INTEGER NOT NULL DEFAULT 24,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS teacher_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      check_in_time TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    );
    CREATE UNIQUE INDEX IF NOT EXISTS teacher_att_date_idx ON teacher_attendance(teacher_id, date);

    CREATE TABLE IF NOT EXISTS teacher_journals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      lesson_hour TEXT NOT NULL,
      material TEXT NOT NULL,
      objective_summary TEXT NOT NULL,
      activities TEXT NOT NULL,
      completion_status TEXT NOT NULL DEFAULT 'Tuntas',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assessment_weights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      weight_lm INTEGER NOT NULL DEFAULT 40,
      weight_sts INTEGER NOT NULL DEFAULT 30,
      weight_sas INTEGER NOT NULL DEFAULT 30,
      kktp_min INTEGER NOT NULL DEFAULT 75,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS weight_subj_cls_sem_idx ON assessment_weights(subject_id, class_id, semester_id);

    CREATE TABLE IF NOT EXISTS formative_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      learning_objective_id INTEGER NOT NULL REFERENCES learning_objectives(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'Tercapai',
      score REAL,
      notes TEXT DEFAULT '',
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS formative_stu_tp_sem_idx ON formative_assessments(student_id, learning_objective_id, semester_id);

    CREATE TABLE IF NOT EXISTS summative_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      lm1 REAL,
      lm2 REAL,
      lm3 REAL,
      lm4 REAL,
      sts REAL,
      sas REAL,
      midterm_score REAL,
      final_score REAL,
      teacher_note TEXT DEFAULT '',
      remedial_score REAL,
      enrichment_note TEXT DEFAULT '',
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS summative_stu_subj_sem_idx ON summative_scores(student_id, subject_id, semester_id);

    CREATE TABLE IF NOT EXISTS cocurricular_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      dimensions_json TEXT NOT NULL,
      description TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS cocurricular_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES cocurricular_projects(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      predicate TEXT NOT NULL DEFAULT 'Baik',
      description TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS cocu_proj_stu_idx ON cocurricular_scores(project_id, student_id);

    CREATE TABLE IF NOT EXISTS extracurriculars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      instructor_name TEXT NOT NULL,
      schedule_day TEXT NOT NULL DEFAULT 'Sabtu',
      learning_objectives_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS extracurricular_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      extracurricular_id INTEGER NOT NULL REFERENCES extracurriculars(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      predicate TEXT NOT NULL DEFAULT 'Baik',
      description TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ekstra_stu_sem_idx ON extracurricular_scores(extracurricular_id, student_id, semester_id);

    CREATE TABLE IF NOT EXISTS student_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT DEFAULT '',
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS stu_att_date_idx ON student_attendance(student_id, date);

    CREATE TABLE IF NOT EXISTS homeroom_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      note TEXT NOT NULL DEFAULT '',
      promotion_decision TEXT DEFAULT '',
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS homeroom_note_stu_sem_idx ON homeroom_notes(student_id, semester_id);

    CREATE TABLE IF NOT EXISTS keasramaan_indicators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS keasramaan_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indicator_id INTEGER NOT NULL REFERENCES keasramaan_indicators(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      predicate TEXT NOT NULL DEFAULT 'B',
      achieved_description TEXT NOT NULL DEFAULT '',
      guidance_description TEXT NOT NULL DEFAULT '',
      wali_asrama_name TEXT DEFAULT '',
      wali_asrama_nip TEXT DEFAULT '',
      wali_asuh_name TEXT DEFAULT '',
      wali_asuh_nip TEXT DEFAULT '',
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS keasramaan_ind_stu_sem_idx ON keasramaan_scores(indicator_id, student_id, semester_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Akademik',
      is_read INTEGER NOT NULL DEFAULT 0,
      link_href TEXT DEFAULT '/dashboard',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dapodik_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      web_service_url TEXT NOT NULL DEFAULT 'http://localhost:5774',
      npsn TEXT NOT NULL,
      api_token TEXT DEFAULT '',
      mode TEXT NOT NULL DEFAULT 'WebService',
      connection_status TEXT NOT NULL DEFAULT 'Belum Terhubung',
      last_sync_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dapodik_external_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      local_id INTEGER NOT NULL,
      external_id TEXT NOT NULL,
      last_synced_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS dapodik_map_local_idx ON dapodik_external_mappings(entity_type, local_id);

    CREATE TABLE IF NOT EXISTS dapodik_sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT NOT NULL,
      direction TEXT NOT NULL,
      status TEXT NOT NULL,
      records_processed INTEGER NOT NULL DEFAULT 0,
      records_created INTEGER NOT NULL DEFAULT 0,
      records_updated INTEGER NOT NULL DEFAULT 0,
      errors_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dapodik_submission_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
      semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
      submission_phase TEXT NOT NULL,
      is_dry_run INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL,
      payload_summary_json TEXT NOT NULL DEFAULT '{}',
      response_message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS erapor_import_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_version TEXT NOT NULL,
      file_name TEXT NOT NULL,
      total_rows INTEGER NOT NULL DEFAULT 0,
      success_rows INTEGER NOT NULL DEFAULT 0,
      error_rows INTEGER NOT NULL DEFAULT 0,
      errors_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_class_scopes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS user_class_scope_idx ON user_class_scopes(user_id, class_id);

    CREATE TABLE IF NOT EXISTS dapodik_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mata_pelajaran_id TEXT NOT NULL UNIQUE,
      nama TEXT NOT NULL,
      jurusan_id TEXT DEFAULT '',
      pilihan_sekolah INTEGER NOT NULL DEFAULT 0,
      pilihan_evaluasi INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_subject_scopes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS user_subject_scope_idx ON user_subject_scopes(user_id, subject_id);
  `);

  // Backward-compatible column migrations for existing databases
  const roleCols = sqlite.prepare('PRAGMA table_info(roles)').all() as Array<{ name: string }>;
  if (!roleCols.some((c) => c.name === 'is_system')) {
    sqlite.exec('ALTER TABLE roles ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0');
    sqlite.exec(`
      UPDATE roles
      SET is_system = 1
      WHERE code IN (
        'SUPER_ADMIN',
        'ADMIN_SEKOLAH',
        'KEPALA_SEKOLAH',
        'OPERATOR_SEKOLAH',
        'WALI_KELAS',
        'GURU',
        'WALI_ASUH',
        'BENDAHARA',
        'TATA_USAHA'
      )
    `);
  }

  const userCols = sqlite.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  if (!userCols.some((c) => c.name === 'scope_mode')) {
    sqlite.exec("ALTER TABLE users ADD COLUMN scope_mode TEXT NOT NULL DEFAULT 'ASSIGNED'");
    sqlite.exec(`
      UPDATE users
      SET scope_mode = 'ALL'
      WHERE role_id IN (
        SELECT id FROM roles
        WHERE code IN (
          'SUPER_ADMIN',
          'ADMIN_SEKOLAH',
          'KEPALA_SEKOLAH',
          'OPERATOR_SEKOLAH',
          'WALI_ASUH',
          'BENDAHARA',
          'TATA_USAHA'
        )
      )
    `);
  }

  const subjectCols = sqlite.prepare('PRAGMA table_info(subjects)').all() as Array<{ name: string }>;
  if (!subjectCols.some((c) => c.name === 'dapodik_mapel_id')) {
    sqlite.exec('ALTER TABLE subjects ADD COLUMN dapodik_mapel_id TEXT');
  }
  if (!subjectCols.some((c) => c.name === 'dapodik_pembelajaran_id')) {
    sqlite.exec('ALTER TABLE subjects ADD COLUMN dapodik_pembelajaran_id TEXT');
  }

  const csCols = sqlite.prepare('PRAGMA table_info(class_students)').all() as Array<{ name: string }>;
  if (!csCols.some((c) => c.name === 'dapodik_anggota_rombel_id')) {
    sqlite.exec('ALTER TABLE class_students ADD COLUMN dapodik_anggota_rombel_id TEXT');
  }

  const studentCols = sqlite.prepare('PRAGMA table_info(students)').all() as Array<{ name: string }>;
  const existingStudentCols = new Set(studentCols.map((c) => c.name));
  const studentMigrations: Array<[string, string]> = [
    ['nickname', "TEXT DEFAULT ''"],
    ['nik', "TEXT DEFAULT ''"],
    ['child_order', 'INTEGER'],
    ['sibling_count', 'INTEGER'],
    ['photo_path', "TEXT DEFAULT ''"],
    ['rt_rw', "TEXT DEFAULT ''"],
    ['village', "TEXT DEFAULT ''"],
    ['district', "TEXT DEFAULT ''"],
    ['regency', "TEXT DEFAULT ''"],
    ['province', "TEXT DEFAULT ''"],
    ['postal_code', "TEXT DEFAULT ''"],
    ['father_nik', "TEXT DEFAULT ''"],
    ['father_education', "TEXT DEFAULT ''"],
    ['father_phone', "TEXT DEFAULT ''"],
    ['mother_nik', "TEXT DEFAULT ''"],
    ['mother_education', "TEXT DEFAULT ''"],
    ['mother_phone', "TEXT DEFAULT ''"],
    ['guardian_relation', "TEXT DEFAULT ''"],
    ['guardian_job', "TEXT DEFAULT ''"],
    ['guardian_address', "TEXT DEFAULT ''"],
    ['wali_asuh_teacher_id', 'INTEGER REFERENCES teachers(id) ON DELETE SET NULL'],
    ['wali_asuh_name', "TEXT DEFAULT ''"],
    ['wali_asrama_name', "TEXT DEFAULT ''"],
    ['dormitory_room', "TEXT DEFAULT ''"],
    ['keasramaan_notes', "TEXT DEFAULT ''"],
  ];
  for (const [colName, colDef] of studentMigrations) {
    if (!existingStudentCols.has(colName)) {
      sqlite.exec(`ALTER TABLE students ADD COLUMN ${colName} ${colDef}`);
    }
  }
}

export function getSqlite(): Database.Database {
  if (!globalForDb.__sqlite) {
    const dbPath = getDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const sqlite = new Database(dbPath);
    ensureTables(sqlite);
    globalForDb.__sqlite = sqlite;
  }
  return globalForDb.__sqlite;
}

export function getDb() {
  if (!globalForDb.__drizzle) {
    globalForDb.__drizzle = drizzle(getSqlite(), { schema });
  }
  return globalForDb.__drizzle;
}

export function resetDbConnection() {
  if (globalForDb.__sqlite) {
    globalForDb.__sqlite.close();
  }
  globalForDb.__sqlite = undefined;
  globalForDb.__drizzle = undefined;
}
