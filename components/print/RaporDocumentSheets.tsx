'use client';

import React from 'react';
import type { RankedStudentEntry, TeacherTppSummaryRow } from '@/lib/server/services/print-metrics';

export interface PrintSchoolInfo {
  name: string;
  npsn: string;
  jenjang?: string;
  address: string;
  village?: string;
  district: string;
  regency: string;
  province: string;
  postalCode?: string | null;
  website?: string | null;
  email?: string | null;
  principalName: string;
  principalNip: string;
  logoUrl?: string | null;
  enableKeasramaan?: boolean;
}

export interface DailyCalendarDay {
  day: number;
  date: string;
  isWeekend: boolean;
  holidayType: 'weekend' | 'national' | 'semester' | null;
}

export interface TeacherDailyMatrixRow {
  teacherId: number;
  fullName: string;
  nip: string;
  gender: string;
  education: string;
  specialization: string;
  employmentStatus: string;
  dailyStatuses: Record<number, string>;
  counts: {
    hadir: number;
    izin: number;
    sakit: number;
    dinasLuar: number;
    cuti: number;
    alpa: number;
  };
}

export interface JournalPrintRow {
  id: number;
  date: string;
  lessonHour: string;
  className: string;
  subjectName: string;
  teacherName: string;
  material: string;
  objectiveSummary?: string;
  activities: string;
  completionStatus: string;
  notes?: string;
  attendanceSummary?: string;
}

export interface PrintClassInfo {
  id: number;
  name: string;
  gradeLevel: number;
  fase: string;
  homeroomTeacherName: string | null;
  homeroomTeacherNip: string | null;
}

export interface PrintStudentBiodata {
  id: number;
  nisn: string;
  nis: string;
  fullName: string;
  gender: string;
  birthPlace: string;
  birthDate: string;
  religion: string;
  address: string | null;
  rtRw?: string | null;
  village?: string | null;
  district?: string | null;
  regency?: string | null;
  province?: string | null;
  postalCode?: string | null;
  photoUrl?: string | null;
  phone?: string | null;
  previousSchool?: string | null;
  enrollmentDate?: string;
  fatherName: string | null;
  fatherJob?: string | null;
  motherName: string | null;
  motherJob?: string | null;
  parentPhone?: string | null;
  guardianName?: string | null;
  guardianRelation?: string | null;
  guardianPhone?: string | null;
}

export interface SubjectGradeItem {
  no: number;
  subjectId: number;
  subjectName: string;
  category: string;
  finalScore: number | null;
  competencyDescription: string;
  achievedParagraph?: string;
  needsGuidanceParagraph?: string;
}

export interface KeasramaanGradeItem {
  no: number;
  indicatorId: number;
  category: string;
  name: string;
  predicate: string;
  achievedNote: string;
  guidanceNote: string;
  notes: string;
}

export interface ReportCardData {
  student: {
    id: number;
    nisn: string;
    nis: string;
    fullName: string;
    gender: string;
    birthPlace: string;
    birthDate: string;
    religion: string;
    address: string;
    fatherName: string;
    motherName: string;
  };
  subjectGrades: SubjectGradeItem[];
  cocurriculars: Array<{
    code: string;
    title: string;
    predicate: string;
    description: string;
  }>;
  extracurriculars: Array<{
    name: string;
    predicate: string;
    description: string;
  }>;
  attendance: { hadir: number; sakit: number; izin: number; alpa: number };
  homeroomNote: string;
  promotionDecision: string;
  availableDecisions?: string[];
  keasramaan?: KeasramaanGradeItem[];
  keasramaanSigners?: {
    waliAsramaName: string;
    waliAsuhName: string;
  };
}

function groupSubjects(grades: SubjectGradeItem[]) {
  const wajib = grades.filter((g) => g.category === 'Wajib');
  const mulok = grades.filter((g) => g.category === 'Muatan Lokal');
  const pilihan = grades.filter(
    (g) => g.category !== 'Wajib' && g.category !== 'Muatan Lokal'
  );
  const groups: Array<{ title: string; items: SubjectGradeItem[] }> = [];
  if (wajib.length > 0) groups.push({ title: 'A. Mata Pelajaran Wajib', items: wajib });
  if (mulok.length > 0) groups.push({ title: 'B. Muatan Lokal', items: mulok });
  if (pilihan.length > 0) groups.push({ title: 'C. Mata Pelajaran Pilihan', items: pilihan });
  return groups;
}

function groupKeasramaan(items: KeasramaanGradeItem[]) {
  const categories = Array.from(new Set(items.map((i) => i.category)));
  return categories.map((cat) => ({
    title: cat,
    items: items.filter((i) => i.category === cat),
  }));
}

function KopSekolah({
  school,
  title,
  subtitle,
}: {
  school: PrintSchoolInfo;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-4 pb-3 border-b-2 border-slate-900">
      <img
        src="/api/school/logo"
        alt="Logo Sekolah"
        referrerPolicy="no-referrer"
        className="w-16 h-16 object-cover rounded shrink-0"
      />
      <div className="flex-1 text-center">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{title}</p>
        <h2 className="text-base font-bold uppercase text-slate-900">{school.name}</h2>
        <p className="text-[11px] text-slate-700">
          {school.address}, Kec. {school.district}, {school.regency}, {school.province} · NPSN{' '}
          {school.npsn}
        </p>
        {subtitle && <p className="text-[11px] font-medium text-slate-600 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export function CoverRaporSheet({
  school,
  student,
  pageBreak,
}: {
  school: PrintSchoolInfo;
  academicYear?: string;
  student: PrintStudentBiodata;
  pageBreak?: boolean;
}) {
  const jenjangLabel = (school.jenjang || 'SEKOLAH DASAR (SD)').toUpperCase();

  return (
    <>
      {/* Halaman 1: Sampul Depan */}
      <article className="print-portrait bg-white text-black border border-slate-300 shadow-sm mx-auto max-w-[210mm] min-h-[275mm] px-12 py-14 flex flex-col items-center justify-between text-center print:border-0 print:shadow-none print:px-8 print:py-10 rapor-page-break">
        <div className="space-y-1.5 pt-4">
          <p className="text-xl font-bold uppercase tracking-[0.35em] text-black">LAPORAN</p>
          <p className="text-base font-bold uppercase text-black">HASIL BELAJAR MURID</p>
          <p className="text-base font-bold uppercase text-black">{school.name}</p>
        </div>

        <div className="my-10 flex items-center justify-center">
          <img
            src="/api/school/logo"
            alt="Lambang Sekolah"
            referrerPolicy="no-referrer"
            className="w-36 h-36 object-contain"
          />
        </div>

        <div className="w-full max-w-[430px] space-y-5">
          <div>
            <p className="text-xs text-black mb-1.5">Nama Murid</p>
            <div className="border border-black py-2.5 px-4">
              <p className="text-sm font-bold uppercase tracking-wide text-black">
                {student.fullName}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-black mb-1.5">NISN / NIS</p>
            <div className="border border-black py-2.5 px-4">
              <p className="text-sm font-bold tabular-nums text-black">
                {student.nisn} / {student.nis}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-10 pb-2 space-y-1">
          <p className="text-sm font-bold uppercase text-black">
            KEMENTERIAN PENDIDIKAN DASAR DAN MENENGAH
          </p>
          <p className="text-sm font-bold uppercase text-black">REPUBLIK INDONESIA</p>
        </div>
      </article>

      {/* Halaman 2: Identitas Satuan Pendidikan */}
      <article
        className={`print-portrait relative overflow-hidden bg-white text-black border border-slate-300 shadow-sm mx-auto max-w-[210mm] min-h-[275mm] px-12 py-14 print:border-0 print:shadow-none print:px-8 print:py-10 ${
          pageBreak ? 'rapor-page-break' : ''
        }`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-0 flex items-center justify-center opacity-[0.09]"
        >
          <img
            src="/api/school/logo"
            alt=""
            referrerPolicy="no-referrer"
            className="w-72 h-72 object-contain grayscale"
          />
        </div>

        <div className="relative z-10 text-center space-y-1.5 mb-12 pt-4">
          <p className="text-xl font-bold uppercase tracking-[0.35em] text-black">LAPORAN</p>
          <p className="text-base font-bold uppercase text-black">HASIL BELAJAR MURID</p>
          <p className="text-base font-normal uppercase text-black">{jenjangLabel}</p>
        </div>

        <table className="relative z-10 w-full max-w-[540px] mx-auto border-collapse text-xs text-black">
          <tbody>
            {[
              ['Nama Sekolah', school.name],
              ['NPSN', school.npsn],
              ['Alamat Sekolah', school.address],
              ['Kode Pos', school.postalCode || '—'],
              ['Desa / Kelurahan', school.village || '—'],
              ['Kecamatan', school.district || '—'],
              ['Kabupaten / Kota', school.regency || '—'],
              ['Provinsi', school.province || '—'],
              ['Website', school.website || '—'],
              ['E-mail', school.email || '—'],
            ].map(([label, value]) => (
              <tr key={label}>
                <td className="py-2 pr-4 w-48 font-bold align-top">{label}</td>
                <td className="py-2 pr-2 w-4 align-top">:</td>
                <td className="py-2 align-top">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </>
  );
}

export function BiodataMuridSheet({
  school,
  semester,
  cls,
  student,
  pageBreak,
}: {
  school: PrintSchoolInfo;
  semester: { name: string; reportDate: string };
  cls: PrintClassInfo;
  student: PrintStudentBiodata;
  pageBreak?: boolean;
}) {
  const addressParts = [
    student.address,
    student.rtRw ? `RT/RW ${student.rtRw}` : '',
    student.village ? `Kel. ${student.village}` : '',
    student.district ? `Kec. ${student.district}` : '',
    student.regency,
    student.province,
    student.postalCode,
  ].filter(Boolean);
  const formattedAddress = addressParts.length > 0 ? addressParts.join(', ') : '-';

  const guardianDisplay = student.guardianName
    ? student.guardianRelation
      ? `${student.guardianName} (${student.guardianRelation})`
      : student.guardianName
    : '-';

  const rows: Array<[string, string, string]> = [
    ['1.', 'Nama Lengkap Peserta Didik', student.fullName.toUpperCase()],
    ['2.', 'NIS / NISN', `${student.nis} / ${student.nisn}`],
    ['3.', 'Tempat, Tanggal Lahir', `${student.birthPlace}, ${student.birthDate}`],
    ['4.', 'Jenis Kelamin', student.gender === 'L' ? 'Laki-laki' : 'Perempuan'],
    ['5.', 'Agama', student.religion],
    ['6.', 'Kelas / Fase Saat Ini', `${cls.name} (Fase ${cls.fase})`],
    ['7.', 'Sekolah Asal / Sebelumnya', student.previousSchool || '-'],
    ['8.', 'Tanggal Diterima di Sekolah Ini', student.enrollmentDate || '-'],
    ['9.', 'Alamat Peserta Didik', formattedAddress],
    ['10.', 'Nomor Telepon / HP', student.phone || student.parentPhone || '-'],
    ['11.', 'Nama Ayah Kandung', student.fatherName || '-'],
    ['12.', 'Pekerjaan Ayah', student.fatherJob || '-'],
    ['13.', 'Nama Ibu Kandung', student.motherName || '-'],
    ['14.', 'Pekerjaan Ibu', student.motherJob || '-'],
    ['15.', 'Telepon Orang Tua', student.parentPhone || '-'],
    ['16.', 'Nama Wali Peserta Didik', guardianDisplay],
  ];

  return (
    <article
      className={`bg-white text-slate-900 border border-slate-300 shadow-sm mx-auto max-w-[210mm] p-8 sm:p-10 print:border-0 print:shadow-none print:p-0 ${
        pageBreak ? 'rapor-page-break' : ''
      }`}
    >
      <KopSekolah
        school={school}
        title="IDENTITAS PESERTA DIDIK (BIODATA)"
        subtitle={`Semester ${semester.name}`}
      />

      <h3 className="text-center text-sm font-bold uppercase tracking-wide text-slate-900 my-5">
        KETERANGAN TENTANG DIRI PESERTA DIDIK
      </h3>

      <table className="w-full text-xs border-collapse mb-8">
        <tbody>
          {rows.map(([no, label, value]) => (
            <tr key={no} className="border-b border-slate-200">
              <td className="py-2 pr-2 w-8 font-mono tabular-nums align-top text-slate-600">
                {no}
              </td>
              <td className="py-2 pr-3 w-56 align-top text-slate-700">{label}</td>
              <td className="py-2 pr-2 w-4 align-top">:</td>
              <td className="py-2 font-medium text-slate-900 align-top">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rapor-signature-block flex items-end justify-between gap-8 pt-4 text-xs">
        <div className="w-[3cm] h-[4cm] border border-slate-800 flex flex-col items-center justify-center text-center text-[11px] text-slate-500 overflow-hidden bg-slate-50">
          {student.photoUrl ? (
            <img
              src={student.photoUrl}
              alt={`Foto ${student.fullName}`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              <span>Pas Foto</span>
              <span>3 × 4 cm</span>
            </>
          )}
        </div>

        <div className="text-center min-w-[220px]">
          <p>
            {school.regency}, {semester.reportDate}
          </p>
          <p>Kepala Sekolah,</p>
          <div className="h-16" />
          <p className="font-semibold underline">{school.principalName}</p>
          <p className="font-mono text-[11px]">NIP {school.principalNip || '-'}</p>
        </div>
      </div>
    </article>
  );
}

export function PiagamPrestasiSheet({
  school,
  academicYear,
  semester,
  cls,
  entry,
  pageBreak,
}: {
  school: PrintSchoolInfo;
  academicYear: string;
  semester: { name: string; reportDate: string };
  cls: PrintClassInfo;
  entry: RankedStudentEntry;
  pageBreak?: boolean;
}) {
  return (
    <article
      className={`bg-white text-slate-900 border border-slate-300 shadow-sm mx-auto max-w-[210mm] p-8 sm:p-10 print:border-0 print:shadow-none print:p-0 ${
        pageBreak ? 'rapor-page-break' : ''
      }`}
    >
      <div className="border-4 border-double border-slate-900 p-8 sm:p-10 space-y-6">
        <KopSekolah school={school} title="PIAGAM PENGHARGAAN PRESTASI BELAJAR" />

        <div className="text-center space-y-2 py-2">
          <h3 className="text-2xl font-bold uppercase tracking-[0.18em] text-[#0F2942]">
            PIAGAM PRESTASI
          </h3>
          <p className="text-xs font-mono text-slate-600">
            Nomor: 421.2/{cls.gradeLevel}0{entry.rank}/{school.npsn}/{academicYear.replace('/', '-')}
          </p>
        </div>

        <div className="text-center space-y-4 text-sm leading-relaxed">
          <p>Kepala Sekolah {school.name} dengan ini memberikan penghargaan setinggi-tingginya kepada:</p>

          <div className="py-2 space-y-1">
            <p className="text-xl font-bold uppercase tracking-wide text-slate-900 underline decoration-slate-400 underline-offset-4">
              {entry.fullName}
            </p>
            <p className="text-xs font-mono tabular-nums text-slate-700">
              NIS {entry.nis} · NISN {entry.nisn} · Kelas {cls.name} (Fase {cls.fase})
            </p>
          </div>

          <div className="mx-auto max-w-md border border-slate-800 bg-slate-50 p-4 space-y-1">
            <p className="text-xs uppercase font-semibold text-slate-600">Capaian Akademik Otomatis</p>
            <p className="text-lg font-bold text-[#0F2942]">
              PERINGKAT KE-{entry.rank} DI KELAS {cls.name}
            </p>
            <p className="text-xs font-mono tabular-nums text-slate-800">
              Rata-rata Nilai Sumatif: <strong>{entry.averageScore.toFixed(2)}</strong> ({entry.subjectCount}{' '}
              Mapel) · {entry.achievementPredicate}
            </p>
            {entry.cocurricularNotes && (
              <p className="text-[11px] text-slate-600 pt-1">
                Kokurikuler: {entry.cocurricularNotes}
              </p>
            )}
          </div>

          <p className="text-xs text-slate-700">
            Atas ketekunan, kedisiplinan, dan prestasi belajar yang diraih selama {semester.name}{' '}
            Tahun Ajaran {academicYear}.
          </p>
        </div>

        <div className="rapor-signature-block grid grid-cols-2 gap-8 pt-6 text-xs">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p>Wali Kelas {cls.name}</p>
            <div className="h-16" />
            <p className="font-semibold underline">{cls.homeroomTeacherName || 'Wali Kelas'}</p>
            <p className="font-mono text-[11px]">NIP {cls.homeroomTeacherNip || '-'}</p>
          </div>
          <div className="text-center">
            <p>
              {school.regency}, {semester.reportDate}
            </p>
            <p>Kepala Sekolah</p>
            <div className="h-16" />
            <p className="font-semibold underline">{school.principalName}</p>
            <p className="font-mono text-[11px]">NIP {school.principalNip || '-'}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function formatIndoDate(isoDate: string): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const months = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  const mIdx = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (!months[mIdx] || !Number.isFinite(d)) return isoDate;
  return `${d} ${months[mIdx]} ${parts[0]}`;
}

function formatMonthTitle(yyyyMm: string): string {
  if (!yyyyMm || !/^\d{4}-\d{2}$/.test(yyyyMm)) return yyyyMm || 'Bulan Aktif';
  const [y, m] = yyyyMm.split('-');
  const months = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  return `${months[Number(m) - 1] || m} ${y}`;
}

function formatEndOfMonthDate(yyyyMm: string): string {
  if (!yyyyMm || !/^\d{4}-\d{2}$/.test(yyyyMm)) return '';
  const [y, m] = yyyyMm.split('-');
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  return formatIndoDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
}

function RaporIdentitasHeader({
  school,
  academicYear,
  semesterName,
  cls,
  student,
}: {
  school: PrintSchoolInfo;
  academicYear: string;
  semesterName: string;
  cls: PrintClassInfo;
  student: ReportCardData['student'];
}) {
  const fullSchoolAddress = [
    school.address,
    school.village ? `Desa ${school.village}` : '',
    school.district ? `Kecamatan ${school.district}` : '',
    school.regency,
    school.province,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <table className="w-full border-collapse text-xs text-black my-4">
      <tbody>
        <tr>
          <td className="py-0.5 pr-2 w-[96px] font-bold whitespace-nowrap align-top">
            Nama Murid
          </td>
          <td className="py-0.5 pr-1.5 w-3 align-top">:</td>
          <td className="py-0.5 pr-6 font-bold uppercase align-top">{student.fullName}</td>
          <td className="py-0.5 pr-2 w-[96px] font-bold whitespace-nowrap align-top">Kelas</td>
          <td className="py-0.5 pr-1.5 w-3 align-top">:</td>
          <td className="py-0.5 w-[110px] align-top">{cls.name}</td>
        </tr>
        <tr>
          <td className="py-0.5 pr-2 font-bold whitespace-nowrap align-top">NIS / NISN</td>
          <td className="py-0.5 pr-1.5 align-top">:</td>
          <td className="py-0.5 pr-6 tabular-nums align-top">
            {student.nis} / {student.nisn}
          </td>
          <td className="py-0.5 pr-2 font-bold whitespace-nowrap align-top">Fase</td>
          <td className="py-0.5 pr-1.5 align-top">:</td>
          <td className="py-0.5 align-top">{cls.fase}</td>
        </tr>
        <tr>
          <td className="py-0.5 pr-2 font-bold whitespace-nowrap align-top">Sekolah</td>
          <td className="py-0.5 pr-1.5 align-top">:</td>
          <td className="py-0.5 pr-6 uppercase align-top">{school.name}</td>
          <td className="py-0.5 pr-2 font-bold whitespace-nowrap align-top">Semester</td>
          <td className="py-0.5 pr-1.5 align-top">:</td>
          <td className="py-0.5 align-top">{semesterName}</td>
        </tr>
        <tr>
          <td className="py-0.5 pr-2 font-bold whitespace-nowrap align-top">Alamat</td>
          <td className="py-0.5 pr-1.5 align-top">:</td>
          <td className="py-0.5 pr-6 align-top leading-snug">
            {fullSchoolAddress || school.regency}
          </td>
          <td className="py-0.5 pr-2 font-bold whitespace-nowrap align-top">Tahun Ajaran</td>
          <td className="py-0.5 pr-1.5 align-top">:</td>
          <td className="py-0.5 tabular-nums align-top">{academicYear}</td>
        </tr>
      </tbody>
    </table>
  );
}

export function RaporAkademikSheet({
  school,
  academicYear,
  semester,
  cls,
  rep,
  pageBreak,
}: {
  school: PrintSchoolInfo;
  academicYear: string;
  semester: { name: string; reportDate: string };
  cls: PrintClassInfo;
  rep: ReportCardData;
  availableDecisions?: string[];
  pageBreak?: boolean;
}) {
  const subjectGroups = groupSubjects(rep.subjectGrades);

  return (
    <article
      className={`print-portrait bg-white text-black border border-slate-300 shadow-sm mx-auto max-w-[210mm] p-8 sm:p-10 print:border-0 print:shadow-none print:p-0 ${
        pageBreak ? 'rapor-page-break' : ''
      }`}
    >
      <div className="text-center mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-black">
          LAPORAN HASIL BELAJAR
        </h2>
        <p className="text-xs text-black mt-0.5">(RAPOR)</p>
      </div>

      <RaporIdentitasHeader
        school={school}
        academicYear={academicYear}
        semesterName={semester.name}
        cls={cls}
        student={rep.student}
      />

      {/* Tabel Nilai Intrakurikuler */}
      <table className="rapor-table w-full border-collapse border border-black text-xs mb-4">
        <thead>
          <tr>
            <th className="border border-black py-2 px-2 text-center font-bold w-10">No</th>
            <th className="border border-black py-2 px-2.5 text-center font-bold w-44">
              Mata Pelajaran
            </th>
            <th className="border border-black py-2 px-2 text-center font-bold w-20">
              Nilai Akhir
            </th>
            <th className="border border-black py-2 px-2.5 text-center font-bold">
              Capaian Kompetensi
            </th>
          </tr>
        </thead>
        <tbody>
          {subjectGroups.map((group) => (
            <React.Fragment key={group.title}>
              <tr>
                <td colSpan={4} className="border border-black py-1.5 px-2.5 font-bold text-black">
                  {group.title}
                </td>
              </tr>
              {group.items.map((g, gIdx) => (
                <tr key={g.subjectId} className={gIdx === 0 ? 'first-data-row' : undefined}>
                  <td className="border border-black py-2 px-2 text-center tabular-nums align-top">
                    {g.no}
                  </td>
                  <td className="border border-black py-2 px-2.5 align-top">{g.subjectName}</td>
                  <td className="border border-black py-2 px-2 text-center tabular-nums align-top">
                    {g.finalScore !== null ? g.finalScore : '-'}
                  </td>
                  <td className="border border-black py-2 px-2.5 leading-snug align-top">
                    <div className="space-y-1 text-justify">
                      <p>{g.achievedParagraph || g.competencyDescription}</p>
                      {g.needsGuidanceParagraph && <p>{g.needsGuidanceParagraph}</p>}
                    </div>
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* Kokurikuler (Box Penuh Satu Kolom Sesuai Contoh PDF) */}
      {rep.cocurriculars.length > 0 && (
        <table className="rapor-table w-full border-collapse border border-black text-xs mb-4">
          <thead>
            <tr>
              <th className="border border-black py-1.5 px-2.5 text-center font-bold">
                Kokurikuler
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="first-data-row">
              <td className="border border-black py-2.5 px-3 leading-snug text-justify space-y-1.5">
                {rep.cocurriculars.map((c) => (
                  <p key={c.code}>{c.description}</p>
                ))}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Ekstrakurikuler (3 Kolom: No | Ekstrakurikuler | Keterangan) */}
      <table className="rapor-table w-full border-collapse border border-black text-xs mb-4">
        <thead>
          <tr>
            <th className="border border-black py-1.5 px-2 text-center font-bold w-10">No</th>
            <th className="border border-black py-1.5 px-2.5 text-center font-bold w-44">
              Ekstrakurikuler
            </th>
            <th className="border border-black py-1.5 px-2.5 text-center font-bold">Keterangan</th>
          </tr>
        </thead>
        <tbody>
          {rep.extracurriculars.length === 0 ? (
            <tr className="first-data-row">
              <td className="border border-black py-2 px-2 text-center">1</td>
              <td className="border border-black py-2 px-2.5">-</td>
              <td className="border border-black py-2 px-2.5">
                Belum ada keikutsertaan ekstrakurikuler tercatat.
              </td>
            </tr>
          ) : (
            rep.extracurriculars.map((e, i) => (
              <tr key={e.name} className={i === 0 ? 'first-data-row' : undefined}>
                <td className="border border-black py-2 px-2 text-center tabular-nums align-top">
                  {i + 1}
                </td>
                <td className="border border-black py-2 px-2.5 align-top">{e.name}</td>
                <td className="border border-black py-2 px-2.5 text-justify align-top">
                  {e.description && e.description !== '-'
                    ? e.description
                    : `Predikat ${e.predicate} dalam kegiatan ${e.name.toLowerCase()}.`}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Ketidakhadiran & Catatan Wali Kelas Berdampingan */}
      <div className="grid grid-cols-12 gap-4 mb-4">
        <div className="col-span-5">
          <table className="w-full border-collapse border border-black text-xs">
            <thead>
              <tr>
                <th colSpan={2} className="border border-black py-1.5 px-2.5 text-center font-bold">
                  Ketidakhadiran
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black py-1.5 px-2.5">Sakit</td>
                <td className="border border-black py-1.5 px-2.5 text-center tabular-nums">
                  {rep.attendance.sakit} Hari
                </td>
              </tr>
              <tr>
                <td className="border border-black py-1.5 px-2.5">Izin</td>
                <td className="border border-black py-1.5 px-2.5 text-center tabular-nums">
                  {rep.attendance.izin} Hari
                </td>
              </tr>
              <tr>
                <td className="border border-black py-1.5 px-2.5">Tanpa Keterangan</td>
                <td className="border border-black py-1.5 px-2.5 text-center tabular-nums">
                  {rep.attendance.alpa} Hari
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="col-span-7 flex flex-col">
          <table className="w-full border-collapse border border-black text-xs flex-1">
            <thead>
              <tr>
                <th className="border border-black py-1.5 px-2.5 text-center font-bold">
                  Catatan Wali Kelas
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-2.5 text-xs leading-snug align-top min-h-[76px] h-[78px] text-justify">
                  {rep.homeroomNote || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Tanggapan Orang Tua / Wali */}
      <table className="w-full border-collapse border border-black text-xs mb-6">
        <thead>
          <tr>
            <th className="border border-black py-1.5 px-2.5 text-center font-bold">
              Tanggapan Orang Tua / Wali
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-3 h-[72px]" />
          </tr>
        </tbody>
      </table>

      {/* Tanda Tangan */}
      <div className="rapor-signature-block pt-2 text-xs space-y-6">
        <div className="grid grid-cols-2 gap-8">
          <div className="text-center">
            <p className="invisible">Tanggal</p>
            <p className="font-bold">Orang Tua / Wali Murid</p>
            <div className="h-20" />
            <p className="font-bold">____________________</p>
          </div>
          <div className="text-center">
            <p>
              {school.regency}, {semester.reportDate}
            </p>
            <p className="font-bold">Wali Kelas</p>
            <div className="h-20" />
            <p className="font-bold underline">{cls.homeroomTeacherName || 'Wali Kelas'}</p>
            <p className="text-[11px]">{cls.homeroomTeacherNip || '-'}</p>
          </div>
        </div>
        <div className="text-center">
          <p className="font-bold">Kepala Sekolah</p>
          <div className="h-20" />
          <p className="font-bold underline">{school.principalName}</p>
          <p className="text-[11px]">{school.principalNip || '-'}</p>
        </div>
      </div>

      {/* Footer Identitas Murid */}
      <div className="mt-8 pt-2 flex items-center justify-between text-[11px] text-slate-600">
        <span>
          {cls.name} | {rep.student.fullName} | {rep.student.nis}
        </span>
        <span>
          {school.name} · {academicYear}
        </span>
      </div>
    </article>
  );
}

export function RaporKeasramaanSheet({
  school,
  academicYear,
  semester,
  cls,
  rep,
  pageBreak,
}: {
  school: PrintSchoolInfo;
  academicYear: string;
  semester: { name: string; reportDate: string };
  cls: PrintClassInfo;
  rep: ReportCardData;
  pageBreak?: boolean;
}) {
  const keasGroups = groupKeasramaan(rep.keasramaan || []);

  return (
    <article
      className={`print-portrait relative overflow-hidden bg-white text-black border border-slate-300 shadow-sm mx-auto max-w-[210mm] p-8 sm:p-10 print:border-0 print:shadow-none print:p-0 ${
        pageBreak ? 'rapor-page-break' : ''
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 flex items-center justify-center opacity-[0.08]"
      >
        <img
          src="/api/school/logo"
          alt=""
          referrerPolicy="no-referrer"
          className="w-72 h-72 object-contain"
        />
      </div>

      <div className="relative z-10">
        <div className="text-center mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-black">
            LAPORAN KEGIATAN KEASRAMAAN
          </h2>
          <p className="text-xs text-black mt-0.5">(RAPOR)</p>
        </div>

        <RaporIdentitasHeader
          school={school}
          academicYear={academicYear}
          semesterName={semester.name}
          cls={cls}
          student={rep.student}
        />

        <table className="rapor-table w-full border-collapse border border-black text-xs mb-4">
          <thead>
            <tr>
              <th className="border border-black py-2 px-2 text-center font-bold w-10">No</th>
              <th className="border border-black py-2 px-2.5 text-center font-bold w-48">
                Indikator
              </th>
              <th className="border border-black py-2 px-2 text-center font-bold w-20">
                Predikat
              </th>
              <th className="border border-black py-2 px-2.5 text-center font-bold">Deskripsi</th>
            </tr>
          </thead>
          <tbody>
            {keasGroups.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-black py-3 px-3 text-center text-slate-600">
                  Belum ada indikator keasramaan aktif untuk semester ini.
                </td>
              </tr>
            ) : (
              keasGroups.map((grp) => (
                <React.Fragment key={grp.title}>
                  <tr>
                    <td
                      colSpan={4}
                      className="border border-black py-1.5 px-2.5 font-bold text-black"
                    >
                      {grp.title}
                    </td>
                  </tr>
                  {grp.items.map((item, iIdx) => (
                    <tr key={item.indicatorId} className={iIdx === 0 ? 'first-data-row' : undefined}>
                      <td className="border border-black py-2 px-2 text-center tabular-nums align-top">
                        {iIdx + 1}
                      </td>
                      <td className="border border-black py-2 px-2.5 align-top">{item.name}</td>
                      <td className="border border-black py-2 px-2 text-center align-top">
                        {item.predicate}
                      </td>
                      <td className="border border-black py-2 px-2.5 leading-snug align-top">
                        <div className="space-y-1 text-justify">
                          <p>{item.achievedNote}</p>
                          {item.guidanceNote && <p>{item.guidanceNote}</p>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>

        {/* Ketidakhadiran Lebar Penuh Sesuai Contoh PDF */}
        <table className="w-full border-collapse border border-black text-xs mb-6">
          <thead>
            <tr>
              <th colSpan={2} className="border border-black py-1.5 px-2.5 text-center font-bold">
                Ketidakhadiran
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black py-1.5 px-3 w-[65%]">Sakit</td>
              <td className="border border-black py-1.5 px-3 text-center tabular-nums">
                {rep.attendance.sakit} Hari
              </td>
            </tr>
            <tr>
              <td className="border border-black py-1.5 px-3">Izin</td>
              <td className="border border-black py-1.5 px-3 text-center tabular-nums">
                {rep.attendance.izin} Hari
              </td>
            </tr>
            <tr>
              <td className="border border-black py-1.5 px-3">Tanpa Keterangan</td>
              <td className="border border-black py-1.5 px-3 text-center tabular-nums">
                {rep.attendance.alpa} Hari
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rapor-signature-block pt-2 text-xs space-y-10">
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <p className="invisible">Tanggal</p>
              <p className="font-bold">Wali Asrama</p>
              <div className="h-20" />
              <p className="font-bold underline">
                {rep.keasramaanSigners?.waliAsramaName || 'Pembina Asrama'}
              </p>
              <p className="text-[11px]">-</p>
            </div>
            <div className="text-center">
              <p>
                {school.regency}, {semester.reportDate}
              </p>
              <p className="font-bold">Wali Asuh</p>
              <div className="h-20" />
              <p className="font-bold underline">
                {rep.keasramaanSigners?.waliAsuhName || 'Wali Asuh'}
              </p>
              <p className="text-[11px]">-</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <p className="font-bold">Orang Tua / Wali Murid</p>
              <div className="h-20" />
              <p className="font-bold">____________________</p>
            </div>
            <div className="text-center">
              <p className="font-bold">Kepala Sekolah</p>
              <div className="h-20" />
              <p className="font-bold underline">{school.principalName}</p>
              <p className="text-[11px]">{school.principalNip || '-'}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-2 flex items-center justify-between text-[11px] text-slate-600">
          <span>
            {cls.name} | {rep.student.fullName} | {rep.student.nis}
          </span>
          <span>
            {school.name} · {academicYear}
          </span>
        </div>
      </div>
    </article>
  );
}

export function JurnalMengajarPrintSheet({
  school,
  academicYear,
  semester,
  cls,
  monthLabel,
  journals,
}: {
  school: PrintSchoolInfo;
  academicYear: string;
  semester: { name: string; reportDate: string };
  cls: PrintClassInfo | null;
  monthLabel: string;
  journals: JournalPrintRow[];
}) {
  const uniqueTeachers = Array.from(new Set(journals.map((j) => j.teacherName).filter(Boolean)));
  const teacherDisplay =
    uniqueTeachers.length === 1
      ? uniqueTeachers[0]
      : cls?.homeroomTeacherName || uniqueTeachers[0] || 'Guru Kelas / Mapel';

  const dates = journals
    .map((j) => j.date)
    .filter(Boolean)
    .sort();
  const periodDisplay =
    dates.length > 0 ? `${dates[0]} s.d. ${dates[dates.length - 1]}` : monthLabel;
  const lastDateIndo =
    dates.length > 0 ? formatIndoDate(dates[dates.length - 1]) : semester.reportDate;

  return (
    <article className="print-landscape bg-white text-black border border-slate-300 shadow-sm mx-auto max-w-[297mm] p-8 print:border-0 print:shadow-none print:p-0 print:max-w-none">
      <div className="text-center mb-4">
        <h2 className="text-base font-bold uppercase tracking-wide text-black">JURNAL MENGAJAR</h2>
        <p className="text-xs font-semibold text-black mt-0.5">{school.name}</p>
        <p className="text-xs text-slate-700 mt-0.5">
          Tahun Ajaran {academicYear} - Semester {semester.name}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs mb-3 text-black">
        <span>
          <strong>Pendidik:</strong> {teacherDisplay}
        </span>
        <span>
          <strong>Periode:</strong> {periodDisplay}
        </span>
      </div>

      <table className="rapor-table w-full border-collapse border border-black text-[11px] mb-6">
        <thead>
          <tr className="bg-slate-200">
            <th className="border border-black py-2 px-2 text-center font-bold w-24">Tanggal</th>
            <th className="border border-black py-2 px-2 text-center font-bold w-14">Kelas</th>
            <th className="border border-black py-2 px-2 text-center font-bold w-32">
              Mata Pelajaran
            </th>
            <th className="border border-black py-2 px-1.5 text-center font-bold w-14">Jam</th>
            <th className="border border-black py-2 px-2 text-center font-bold w-36">Materi</th>
            <th className="border border-black py-2 px-2 text-center font-bold">
              Tujuan Pembelajaran
            </th>
            <th className="border border-black py-2 px-2 text-center font-bold w-24">
              Kehadiran (H/S/I/TK)
            </th>
            <th className="border border-black py-2 px-2 text-center font-bold w-48">Catatan</th>
          </tr>
        </thead>
        <tbody>
          {journals.length === 0 ? (
            <tr>
              <td colSpan={8} className="border border-black py-4 text-center text-slate-600">
                Belum ada catatan jurnal mengajar pada filter yang dipilih.
              </td>
            </tr>
          ) : (
            journals.map((j, idx) => (
              <tr key={j.id} className={idx === 0 ? 'first-data-row' : undefined}>
                <td className="border border-black py-1.5 px-2 text-center align-top">
                  {formatIndoDate(j.date)}
                </td>
                <td className="border border-black py-1.5 px-2 text-center align-top">
                  {j.className}
                </td>
                <td className="border border-black py-1.5 px-2 align-top">{j.subjectName}</td>
                <td className="border border-black py-1.5 px-1.5 text-center tabular-nums align-top">
                  {j.lessonHour}
                </td>
                <td className="border border-black py-1.5 px-2 align-top">{j.material}</td>
                <td className="border border-black py-1.5 px-2 align-top">
                  {j.objectiveSummary || j.activities}
                </td>
                <td className="border border-black py-1.5 px-2 text-center tabular-nums align-top">
                  {j.attendanceSummary || '0/0/0/0'}
                </td>
                <td className="border border-black py-1.5 px-2 align-top">
                  {j.notes || j.activities || j.completionStatus}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="rapor-signature-block grid grid-cols-2 gap-12 pt-4 text-xs">
        <div className="text-center">
          <p className="font-bold">Mengetahui</p>
          <p>Kepala Sekolah</p>
          <div className="h-20" />
          <p className="font-bold underline">{school.principalName}</p>
          <p className="text-[11px]">{school.principalNip || '-'}</p>
        </div>
        <div className="text-center">
          <p>
            {school.regency}, {lastDateIndo}
          </p>
          <p>Wali Kelas</p>
          <div className="h-20" />
          <p className="font-bold underline">{cls?.homeroomTeacherName || teacherDisplay}</p>
          <p className="text-[11px]">{cls?.homeroomTeacherNip || '-'}</p>
        </div>
      </div>
    </article>
  );
}

export function BukuTamuPrintSheet({
  school,
  semester,
  monthLabel,
  guests,
}: {
  school: PrintSchoolInfo;
  semester: { name: string; reportDate: string };
  monthLabel: string;
  guests: Array<{
    id: number;
    visitDate: string;
    visitorName: string;
    institution: string;
    purpose: string;
    personToMeet: string;
    phone: string | null;
  }>;
}) {
  return (
    <article className="print-portrait bg-white text-slate-900 border border-slate-300 shadow-sm mx-auto max-w-[210mm] p-8 sm:p-10 print:border-0 print:shadow-none print:p-0">
      <KopSekolah
        school={school}
        title="BUKU TAMU RESMI SEKOLAH"
        subtitle={`${semester.name} · Periode ${monthLabel}`}
      />

      <table className="rapor-table w-full border-collapse border border-slate-800 text-xs my-5">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-800 py-2 px-2 text-center w-9">No</th>
            <th className="border border-slate-800 py-2 px-2 text-left w-24">Tanggal</th>
            <th className="border border-slate-800 py-2 px-2 text-left w-36">Nama Tamu</th>
            <th className="border border-slate-800 py-2 px-2 text-left w-36">Instansi / Alamat</th>
            <th className="border border-slate-800 py-2 px-2 text-left">Keperluan</th>
            <th className="border border-slate-800 py-2 px-2 text-left w-28">Menemui</th>
          </tr>
        </thead>
        <tbody>
          {guests.length === 0 ? (
            <tr>
              <td colSpan={6} className="border border-slate-800 py-4 text-center text-slate-500">
                Belum ada catatan buku tamu pada periode yang dipilih.
              </td>
            </tr>
          ) : (
            guests.map((g, idx) => (
              <tr key={g.id} className={idx === 0 ? 'first-data-row' : undefined}>
                <td className="border border-slate-800 py-2 px-2 text-center font-mono tabular-nums align-top">
                  {idx + 1}
                </td>
                <td className="border border-slate-800 py-2 px-2 font-mono tabular-nums align-top">
                  {g.visitDate}
                </td>
                <td className="border border-slate-800 py-2 px-2 align-top">
                  <div className="font-semibold">{g.visitorName}</div>
                  {g.phone && (
                    <div className="text-[11px] font-mono text-slate-600">{g.phone}</div>
                  )}
                </td>
                <td className="border border-slate-800 py-2 px-2 align-top">{g.institution}</td>
                <td className="border border-slate-800 py-2 px-2 align-top text-justify">
                  {g.purpose}
                </td>
                <td className="border border-slate-800 py-2 px-2 align-top">{g.personToMeet}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="rapor-signature-block flex justify-end pt-4 text-xs">
        <div className="text-center min-w-[220px]">
          <p>
            {school.regency}, {semester.reportDate}
          </p>
          <p>Mengetahui, Kepala Sekolah</p>
          <div className="h-16" />
          <p className="font-semibold underline">{school.principalName}</p>
          <p className="font-mono text-[11px]">NIP {school.principalNip || '-'}</p>
        </div>
      </div>
    </article>
  );
}

export function PresensiGuruPrintSheet({
  school,
  academicYear,
  semester,
  resolvedMonth,
  learningDaysCount,
  dailyCalendar,
  dailyMatrixRows,
}: {
  school: PrintSchoolInfo;
  academicYear: string;
  semester: { name: string; reportDate: string };
  resolvedMonth: string;
  learningDaysCount: number;
  dailyCalendar: DailyCalendarDay[];
  dailyMatrixRows: TeacherDailyMatrixRow[];
}) {
  const monthTitle = formatMonthTitle(resolvedMonth);
  const endMonthDate = formatEndOfMonthDate(resolvedMonth) || semester.reportDate;

  const dayBg = (holidayType: DailyCalendarDay['holidayType']) => {
    if (holidayType === 'national') return 'bg-rose-100';
    if (holidayType === 'semester') return 'bg-amber-100';
    if (holidayType === 'weekend') return 'bg-slate-100';
    return '';
  };

  return (
    <article className="print-landscape bg-white text-black border border-slate-300 shadow-sm mx-auto max-w-[297mm] p-6 print:border-0 print:shadow-none print:p-0 print:max-w-none">
      <div className="text-center mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-black">KEADAAN PERSONIL</h2>
        <p className="text-xs font-semibold text-black">{school.name}</p>
        <p className="text-[11px] text-slate-700">
          Tahun Pelajaran {academicYear} - Semester {semester.name}
        </p>
        <p className="text-[11px] font-semibold text-black">
          Bulan {monthTitle} ({learningDaysCount} hari belajar)
        </p>
      </div>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse border border-black text-[8.5px] leading-tight">
          <thead>
            <tr>
              <th rowSpan={2} className="border border-black px-1 py-1 text-center font-bold w-6">
                NO
              </th>
              <th rowSpan={2} className="border border-black px-1.5 py-1 text-center font-bold min-w-[96px]">
                NAMA/NIP
              </th>
              <th rowSpan={2} className="border border-black px-0.5 py-1 text-center font-bold w-8">
                <div className="[writing-mode:vertical-rl] rotate-180 mx-auto whitespace-nowrap py-1 text-[7.5px]">
                  TEMPAT &amp; TANGGAL LAHIR
                </div>
              </th>
              <th rowSpan={2} className="border border-black px-0.5 py-1 text-center font-bold w-5">
                <div className="[writing-mode:vertical-rl] rotate-180 mx-auto whitespace-nowrap py-1 text-[7.5px]">
                  JENIS KELAMIN
                </div>
              </th>
              <th rowSpan={2} className="border border-black px-0.5 py-1 text-center font-bold w-6">
                <div className="[writing-mode:vertical-rl] rotate-180 mx-auto whitespace-nowrap py-1 text-[7.5px]">
                  IJAZAH/TAHUN
                </div>
              </th>
              <th rowSpan={2} className="border border-black px-0.5 py-1 text-center font-bold w-7">
                <div className="[writing-mode:vertical-rl] rotate-180 mx-auto whitespace-nowrap py-1 text-[7.5px]">
                  JABATAN
                </div>
              </th>
              <th rowSpan={2} className="border border-black px-0.5 py-1 text-center font-bold w-6">
                <div className="[writing-mode:vertical-rl] rotate-180 mx-auto whitespace-nowrap py-1 text-[7.5px]">
                  GOL GAJI TMT
                </div>
              </th>
              <th colSpan={2} className="border border-black px-1 py-1 text-center font-bold text-[7.5px]">
                TANGGAL MULAI
              </th>
              <th rowSpan={2} className="border border-black px-0.5 py-1 text-center font-bold w-7">
                <div className="[writing-mode:vertical-rl] rotate-180 mx-auto whitespace-nowrap py-1 text-[7.5px]">
                  STATUS KEPEGAWAIAN
                </div>
              </th>
              <th colSpan={2} className="border border-black px-1 py-1 text-center font-bold text-[7.5px]">
                TGL KENAIKAN
              </th>
              <th
                colSpan={dailyCalendar.length || 30}
                className="border border-black px-1 py-1 text-center font-bold text-[8px]"
              >
                TANGGAL DAFTAR HADIR
              </th>
              <th colSpan={6} className="border border-black px-1 py-1 text-center font-bold text-[8px]">
                JUMLAH
              </th>
            </tr>
            <tr>
              <th className="border border-black px-0.5 py-1 text-center font-bold w-5">
                <div className="[writing-mode:vertical-rl] rotate-180 mx-auto whitespace-nowrap text-[7px]">
                  DIANGKAT
                </div>
              </th>
              <th className="border border-black px-0.5 py-1 text-center font-bold w-5">
                <div className="[writing-mode:vertical-rl] rotate-180 mx-auto whitespace-nowrap text-[7px]">
                  KERJA DI SEKOLAH INI
                </div>
              </th>
              <th className="border border-black px-0.5 py-1 text-center font-bold w-5">
                <div className="[writing-mode:vertical-rl] rotate-180 mx-auto whitespace-nowrap text-[7px]">
                  GAJI BERKALA
                </div>
              </th>
              <th className="border border-black px-0.5 py-1 text-center font-bold w-5">
                <div className="[writing-mode:vertical-rl] rotate-180 mx-auto whitespace-nowrap text-[7px]">
                  PANGKAT
                </div>
              </th>
              {dailyCalendar.map((d) => (
                <th
                  key={d.day}
                  className={`border border-black px-0.5 py-1 text-center font-bold w-4 tabular-nums text-[7.5px] ${dayBg(
                    d.holidayType
                  )}`}
                >
                  {d.day}
                </th>
              ))}
              {['H', 'I', 'S', 'DL', 'CT', 'TK'].map((lbl) => (
                <th
                  key={lbl}
                  className="border border-black px-0.5 py-1 text-center font-bold w-4 text-[7.5px]"
                >
                  {lbl}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dailyMatrixRows.map((r, idx) => (
              <tr key={r.teacherId}>
                <td className="border border-black px-1 py-1 text-center tabular-nums">
                  {idx + 1}
                </td>
                <td className="border border-black px-1.5 py-1">
                  <div className="font-semibold">{r.fullName}</div>
                  <div className="text-[7.5px] text-slate-700">{r.nip}</div>
                </td>
                <td className="border border-black px-0.5 py-1 text-center">—</td>
                <td className="border border-black px-0.5 py-1 text-center">{r.gender}</td>
                <td className="border border-black px-0.5 py-1 text-center">—</td>
                <td className="border border-black px-0.5 py-1 text-center">Guru</td>
                <td className="border border-black px-0.5 py-1 text-center">—</td>
                <td className="border border-black px-0.5 py-1 text-center">—</td>
                <td className="border border-black px-0.5 py-1 text-center">—</td>
                <td className="border border-black px-0.5 py-1 text-center">
                  {r.employmentStatus}
                </td>
                <td className="border border-black px-0.5 py-1 text-center">—</td>
                <td className="border border-black px-0.5 py-1 text-center">—</td>
                {dailyCalendar.map((d) => (
                  <td
                    key={d.day}
                    className={`border border-black px-0.5 py-1 text-center font-bold ${dayBg(
                      d.holidayType
                    )}`}
                  >
                    {r.dailyStatuses[d.day] || ''}
                  </td>
                ))}
                <td className="border border-black px-0.5 py-1 text-center tabular-nums">
                  {r.counts.hadir || ''}
                </td>
                <td className="border border-black px-0.5 py-1 text-center tabular-nums">
                  {r.counts.izin || ''}
                </td>
                <td className="border border-black px-0.5 py-1 text-center tabular-nums">
                  {r.counts.sakit || ''}
                </td>
                <td className="border border-black px-0.5 py-1 text-center tabular-nums">
                  {r.counts.dinasLuar || ''}
                </td>
                <td className="border border-black px-0.5 py-1 text-center tabular-nums">
                  {r.counts.cuti || ''}
                </td>
                <td className="border border-black px-0.5 py-1 text-center tabular-nums">
                  {r.counts.alpa || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend Bar */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4 text-[10px] text-black">
        <div className="flex items-center gap-4">
          <span>
            <strong>Guru</strong> : Guru
          </span>
          <span>
            <strong>Ct</strong> : Cuti
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 border border-black bg-slate-100" />
            Libur akhir pekan
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 border border-black bg-rose-100" />
            Libur nasional
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 border border-black bg-amber-100" />
            Libur semester
          </span>
        </div>
      </div>

      <div className="rapor-signature-block flex justify-end pt-5 text-xs">
        <div className="text-left min-w-[200px]">
          <p>{endMonthDate}</p>
          <p>Kepala</p>
          <p>{school.name}</p>
          <div className="h-16" />
          <p className="font-bold">{school.principalName}</p>
          <p className="text-[11px]">NIP. {school.principalNip || '-'}</p>
        </div>
      </div>
    </article>
  );
}

export function LaporanTppPrintSheet({
  school,
  academicYear,
  semester,
  monthLabel,
  effectiveWorkDays,
  rows,
}: {
  school: PrintSchoolInfo;
  academicYear: string;
  semester: { name: string; reportDate: string };
  monthLabel: string;
  effectiveWorkDays: number;
  rows: TeacherTppSummaryRow[];
}) {
  return (
    <article className="bg-white text-slate-900 border border-slate-300 shadow-sm mx-auto max-w-[210mm] p-8 sm:p-10 print:border-0 print:shadow-none print:p-0">
      <KopSekolah
        school={school}
        title="LAPORAN DISIPLIN KERJA & TAMBAHAN PENGHASILAN PEGAWAI (TPP)"
        subtitle={`Tahun Ajaran ${academicYear} · ${semester.name} · Periode ${monthLabel} · Basis Hari Efektif: ${effectiveWorkDays} Hari`}
      />

      <p className="text-[11px] text-slate-700 my-3 leading-relaxed">
        Rekapitulasi otomatis tingkat kehadiran dan kedisiplinan jam masuk PTK (&le; 07:15 WIB) sebagai
        dasar perhitungan komponen disiplin Tambahan Penghasilan Pegawai (TPP).
      </p>

      <table className="rapor-table w-full border-collapse border border-slate-800 text-xs mb-5">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-800 py-2 px-1.5 text-center w-8">No</th>
            <th className="border border-slate-800 py-2 px-2 text-left">Nama PTK / NIP</th>
            <th className="border border-slate-800 py-2 px-1.5 text-center w-12">JP/Mg</th>
            <th className="border border-slate-800 py-2 px-1.5 text-center w-12">Tepat</th>
            <th className="border border-slate-800 py-2 px-1.5 text-center w-12">Telat</th>
            <th className="border border-slate-800 py-2 px-1.5 text-center w-12">S/I</th>
            <th className="border border-slate-800 py-2 px-1.5 text-center w-10">A</th>
            <th className="border border-slate-800 py-2 px-1.5 text-right w-16">Skor TPP</th>
            <th className="border border-slate-800 py-2 px-2 text-left w-36">Kategori Capaian</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.teacherId} className={idx === 0 ? 'first-data-row' : undefined}>
              <td className="border border-slate-800 py-1.5 px-1.5 text-center font-mono tabular-nums">
                {idx + 1}
              </td>
              <td className="border border-slate-800 py-1.5 px-2">
                <div className="font-semibold">{r.fullName}</div>
                <div className="text-[11px] font-mono text-slate-600">
                  {r.employmentStatus} · NIP {r.nip}
                </div>
              </td>
              <td className="border border-slate-800 py-1.5 px-1.5 text-center font-mono tabular-nums">
                {r.weeklyHours}
              </td>
              <td className="border border-slate-800 py-1.5 px-1.5 text-center font-mono tabular-nums">
                {r.tepatWaktu + r.dinasLuar}
              </td>
              <td className="border border-slate-800 py-1.5 px-1.5 text-center font-mono tabular-nums">
                {r.terlambat}
              </td>
              <td className="border border-slate-800 py-1.5 px-1.5 text-center font-mono tabular-nums">
                {r.sakit + r.izin}
              </td>
              <td className="border border-slate-800 py-1.5 px-1.5 text-center font-mono tabular-nums">
                {r.alpa}
              </td>
              <td className="border border-slate-800 py-1.5 px-1.5 text-right font-mono tabular-nums font-bold">
                {r.tppDisciplineScore.toFixed(1)}%
              </td>
              <td className="border border-slate-800 py-1.5 px-2 font-medium">{r.tppCategory}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rapor-signature-block grid grid-cols-2 gap-8 pt-4 text-xs">
        <div className="text-center">
          <p>Mengetahui,</p>
          <p>Bendahara / Operator Sekolah</p>
          <div className="h-16" />
          <p className="font-semibold border-b border-slate-700 inline-block min-w-[160px]">
            ..............................
          </p>
        </div>
        <div className="text-center">
          <p>
            {school.regency}, {semester.reportDate}
          </p>
          <p>Kepala Sekolah</p>
          <div className="h-16" />
          <p className="font-semibold underline">{school.principalName}</p>
          <p className="font-mono text-[11px]">NIP {school.principalNip || '-'}</p>
        </div>
      </div>
    </article>
  );
}
