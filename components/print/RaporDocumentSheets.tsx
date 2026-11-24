'use client';

import React from 'react';
import type { RankedStudentEntry, TeacherTppSummaryRow } from '@/lib/server/services/print-metrics';

export interface PrintSchoolInfo {
  name: string;
  npsn: string;
  address: string;
  district: string;
  regency: string;
  province: string;
  principalName: string;
  principalNip: string;
  logoUrl?: string | null;
  enableKeasramaan?: boolean;
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
  academicYear,
  student,
  pageBreak,
}: {
  school: PrintSchoolInfo;
  academicYear: string;
  student: PrintStudentBiodata;
  pageBreak?: boolean;
}) {
  return (
    <article
      className={`bg-white text-slate-900 border border-slate-300 shadow-sm mx-auto max-w-[210mm] min-h-[275mm] p-10 flex flex-col justify-between print:border-0 print:shadow-none print:p-6 ${
        pageBreak ? 'rapor-page-break' : ''
      }`}
    >
      <div className="border-4 border-double border-slate-900 p-8 sm:p-12 flex-1 flex flex-col items-center justify-between text-center">
        <div className="space-y-2 pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700">
            KEMENTERIAN PENDIDIKAN DASAR DAN MENENGAH
          </p>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-600">
            REPUBLIK INDONESIA
          </p>
          <div className="pt-4">
            <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900">
              RAPOR PESERTA DIDIK
            </h1>
            <p className="text-sm font-semibold uppercase text-slate-700 mt-1">
              KURIKULUM MERDEKA · PENDIDIKAN DASAR
            </p>
          </div>
        </div>

        <div className="my-8 flex flex-col items-center gap-4">
          <img
            src="/api/school/logo"
            alt="Lambang Sekolah"
            referrerPolicy="no-referrer"
            className="w-32 h-32 object-cover rounded-lg border border-slate-300"
          />
          <div>
            <p className="text-base font-bold uppercase text-slate-900">{school.name}</p>
            <p className="text-xs font-mono text-slate-700">NPSN: {school.npsn}</p>
          </div>
        </div>

        <div className="w-full max-w-md space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1.5">
              Nama Peserta Didik:
            </p>
            <div className="border-2 border-slate-900 py-3 px-4">
              <p className="text-base font-bold uppercase tracking-wide text-slate-900">
                {student.fullName}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1.5">
              NIS / NISN:
            </p>
            <div className="border-2 border-slate-900 py-2.5 px-4">
              <p className="text-sm font-mono font-bold tabular-nums text-slate-900">
                {student.nis} / {student.nisn}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-8 space-y-1">
          <p className="text-xs font-bold uppercase text-slate-900">{school.name}</p>
          <p className="text-xs text-slate-700">
            {school.address}, Kec. {school.district}, {school.regency}
          </p>
          <p className="text-xs text-slate-700">{school.province}</p>
          <p className="text-xs font-semibold font-mono pt-2 text-slate-800">
            TAHUN AJARAN {academicYear}
          </p>
        </div>
      </div>
    </article>
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

export function RaporAkademikSheet({
  school,
  academicYear,
  semester,
  cls,
  rep,
  availableDecisions,
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
  const decisions =
    rep.availableDecisions || availableDecisions || ['Naik Kelas', 'Tinggal Kelas'];

  return (
    <article
      className={`bg-white text-slate-900 border border-slate-300 shadow-sm mx-auto max-w-[210mm] p-8 sm:p-10 print:border-0 print:shadow-none print:p-0 ${
        pageBreak ? 'rapor-page-break' : ''
      }`}
    >
      <KopSekolah school={school} title="LAPORAN HASIL BELAJAR PESERTA DIDIK (RAPOR)" />

      <div className="grid grid-cols-1 sm:grid-cols-[7.5rem_auto_1fr_7.5rem_auto_auto] gap-x-2 gap-y-1 text-xs my-4">
        <span className="text-slate-600">Nama Murid</span>
        <span>:</span>
        <span className="font-semibold uppercase">{rep.student.fullName}</span>
        <span className="text-slate-600">Kelas</span>
        <span>:</span>
        <span className="font-semibold">{cls.name}</span>

        <span className="text-slate-600">NIS / NISN</span>
        <span>:</span>
        <span className="font-mono tabular-nums">
          {rep.student.nis} / {rep.student.nisn}
        </span>
        <span className="text-slate-600">Fase</span>
        <span>:</span>
        <span className="font-semibold">{cls.fase}</span>

        <span className="text-slate-600">Sekolah</span>
        <span>:</span>
        <span>{school.name}</span>
        <span className="text-slate-600">Semester</span>
        <span>:</span>
        <span>{semester.name}</span>

        <span className="text-slate-600">Alamat Murid</span>
        <span>:</span>
        <span>{rep.student.address || school.regency}</span>
        <span className="text-slate-600">Tahun Ajaran</span>
        <span>:</span>
        <span className="font-mono tabular-nums">{academicYear}</span>
      </div>

      <h3 className="text-xs font-bold uppercase text-slate-900 mb-2">
        A. Nilai dan Capaian Kompetensi Intrakurikuler
      </h3>
      <table className="rapor-table w-full border-collapse border border-slate-800 text-xs mb-5">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-800 py-2 px-2 text-center w-10">No</th>
            <th className="border border-slate-800 py-2 px-2.5 text-left w-44">Mata Pelajaran</th>
            <th className="border border-slate-800 py-2 px-2 text-center w-20">Nilai Akhir</th>
            <th className="border border-slate-800 py-2 px-2.5 text-left">Capaian Kompetensi</th>
          </tr>
        </thead>
        <tbody>
          {subjectGroups.map((group) => (
            <React.Fragment key={group.title}>
              <tr className="bg-slate-50">
                <td
                  colSpan={4}
                  className="border border-slate-800 py-1.5 px-2.5 font-bold text-slate-900"
                >
                  {group.title}
                </td>
              </tr>
              {group.items.map((g, gIdx) => (
                <tr key={g.subjectId} className={gIdx === 0 ? 'first-data-row' : undefined}>
                  <td className="border border-slate-800 py-2 px-2 text-center font-mono tabular-nums align-top">
                    {g.no}
                  </td>
                  <td className="border border-slate-800 py-2 px-2.5 font-medium align-top">
                    {g.subjectName}
                  </td>
                  <td className="border border-slate-800 py-2 px-2 text-center font-mono tabular-nums font-bold align-top">
                    {g.finalScore !== null ? g.finalScore : '-'}
                  </td>
                  <td className="border border-slate-800 py-2 px-2.5 leading-relaxed align-top">
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

      {rep.cocurriculars.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase text-slate-900 mb-2">
            B. Capaian Kokurikuler (8 Dimensi Profil Lulusan)
          </h3>
          <table className="rapor-table w-full border-collapse border border-slate-800 text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-800 py-1.5 px-2.5 text-left w-52">
                  Projek / Kegiatan
                </th>
                <th className="border border-slate-800 py-1.5 px-2 text-center w-24">Predikat</th>
                <th className="border border-slate-800 py-1.5 px-2.5 text-left">
                  Deskripsi Capaian
                </th>
              </tr>
            </thead>
            <tbody>
              {rep.cocurriculars.map((c, cIdx) => (
                <tr key={c.code} className={cIdx === 0 ? 'first-data-row' : undefined}>
                  <td className="border border-slate-800 py-2 px-2.5 font-medium align-top">
                    {c.title}
                  </td>
                  <td className="border border-slate-800 py-2 px-2 text-center font-semibold align-top">
                    {c.predicate}
                  </td>
                  <td className="border border-slate-800 py-2 px-2.5 leading-relaxed align-top">
                    <div className="text-justify">{c.description}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-5">
        <h3 className="text-xs font-bold uppercase text-slate-900 mb-2">
          C. Kegiatan Ekstrakurikuler
        </h3>
        <table className="rapor-table w-full border-collapse border border-slate-800 text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-800 py-1.5 px-2 text-center w-10">No</th>
              <th className="border border-slate-800 py-1.5 px-2.5 text-left w-44">Ekstrakurikuler</th>
              <th className="border border-slate-800 py-1.5 px-2 text-center w-24">Predikat</th>
              <th className="border border-slate-800 py-1.5 px-2.5 text-left">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {rep.extracurriculars.length === 0 ? (
              <tr className="first-data-row">
                <td className="border border-slate-800 py-2 px-2 text-center">1</td>
                <td className="border border-slate-800 py-2 px-2.5">-</td>
                <td className="border border-slate-800 py-2 px-2 text-center">-</td>
                <td className="border border-slate-800 py-2 px-2.5">
                  Belum ada keikutsertaan ekstrakurikuler tercatat.
                </td>
              </tr>
            ) : (
              rep.extracurriculars.map((e, i) => (
                <tr key={e.name} className={i === 0 ? 'first-data-row' : undefined}>
                  <td className="border border-slate-800 py-2 px-2 text-center font-mono">
                    {i + 1}
                  </td>
                  <td className="border border-slate-800 py-2 px-2.5 font-medium">{e.name}</td>
                  <td className="border border-slate-800 py-2 px-2 text-center font-semibold">
                    {e.predicate}
                  </td>
                  <td className="border border-slate-800 py-2 px-2.5 text-justify">
                    {e.description}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mb-4">
        <div className="sm:col-span-5">
          <h3 className="text-xs font-bold uppercase text-slate-900 mb-1.5">D. Ketidakhadiran</h3>
          <table className="w-full border-collapse border border-slate-800 text-xs">
            <tbody>
              <tr>
                <td className="border border-slate-800 py-1.5 px-2.5">Sakit</td>
                <td className="border border-slate-800 py-1.5 px-2.5 font-mono tabular-nums text-right">
                  {rep.attendance.sakit} hari
                </td>
              </tr>
              <tr>
                <td className="border border-slate-800 py-1.5 px-2.5">Izin</td>
                <td className="border border-slate-800 py-1.5 px-2.5 font-mono tabular-nums text-right">
                  {rep.attendance.izin} hari
                </td>
              </tr>
              <tr>
                <td className="border border-slate-800 py-1.5 px-2.5">Tanpa Keterangan</td>
                <td className="border border-slate-800 py-1.5 px-2.5 font-mono tabular-nums text-right">
                  {rep.attendance.alpa} hari
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="sm:col-span-7">
          <h3 className="text-xs font-bold uppercase text-slate-900 mb-1.5">
            E. Catatan Wali Kelas
          </h3>
          <div className="border border-slate-800 p-3 text-xs leading-relaxed min-h-[82px] text-justify">
            {rep.homeroomNote}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mb-5">
        <div className="sm:col-span-8">
          <h3 className="text-xs font-bold uppercase text-slate-900 mb-1.5">
            F. Tanggapan Orang Tua / Wali Murid
          </h3>
          <div className="border border-slate-800 p-3 text-xs min-h-[72px]" />
        </div>
        <div className="sm:col-span-4">
          <h3 className="text-xs font-bold uppercase text-slate-900 mb-1.5">Keputusan</h3>
          <div className="border border-slate-800 p-3 text-xs min-h-[72px] space-y-1.5">
            <p className="text-[11px] text-slate-700">
              Berdasarkan pencapaian kompetensi, peserta didik ditetapkan:
            </p>
            <div className="space-y-1 pt-0.5">
              {decisions.map((dec) => {
                const isActive = rep.promotionDecision.toLowerCase() === dec.toLowerCase();
                return (
                  <p key={dec} className="font-medium flex items-center gap-1.5">
                    <span className="font-mono text-sm leading-none">
                      {isActive ? '☑' : '☐'}
                    </span>
                    <span>{dec}</span>
                  </p>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="rapor-signature-block pt-3 text-xs space-y-6">
        <div className="grid grid-cols-2 gap-8">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p>Orang Tua / Wali Murid</p>
            <div className="h-16" />
            <p className="font-semibold border-b border-slate-700 inline-block min-w-[160px]">
              {rep.student.fatherName || rep.student.motherName || '..............................'}
            </p>
          </div>
          <div className="text-center">
            <p>
              {school.regency}, {semester.reportDate}
            </p>
            <p>Wali Kelas {cls.name}</p>
            <div className="h-16" />
            <p className="font-semibold underline">{cls.homeroomTeacherName || 'Wali Kelas'}</p>
            <p className="font-mono text-[11px]">NIP {cls.homeroomTeacherNip || '-'}</p>
          </div>
        </div>
        <div className="text-center">
          <p>Mengetahui,</p>
          <p>Kepala Sekolah</p>
          <div className="h-16" />
          <p className="font-semibold underline">{school.principalName}</p>
          <p className="font-mono text-[11px]">NIP {school.principalNip || '-'}</p>
        </div>
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
      className={`bg-white text-slate-900 border border-slate-300 shadow-sm mx-auto max-w-[210mm] p-8 sm:p-10 print:border-0 print:shadow-none print:p-0 ${
        pageBreak ? 'rapor-page-break' : ''
      }`}
    >
      <KopSekolah school={school} title="LAPORAN CAPAIAN PEMBINAAN KEASRAMAAN" />

      <div className="grid grid-cols-1 sm:grid-cols-[7.5rem_auto_1fr_7.5rem_auto_auto] gap-x-2 gap-y-1 text-xs my-4">
        <span className="text-slate-600">Nama Murid</span>
        <span>:</span>
        <span className="font-semibold uppercase">{rep.student.fullName}</span>
        <span className="text-slate-600">Kelas</span>
        <span>:</span>
        <span className="font-semibold">{cls.name}</span>

        <span className="text-slate-600">NIS / NISN</span>
        <span>:</span>
        <span className="font-mono tabular-nums">
          {rep.student.nis} / {rep.student.nisn}
        </span>
        <span className="text-slate-600">Fase</span>
        <span>:</span>
        <span className="font-semibold">{cls.fase}</span>

        <span className="text-slate-600">Sekolah</span>
        <span>:</span>
        <span>{school.name}</span>
        <span className="text-slate-600">Semester</span>
        <span>:</span>
        <span>{semester.name}</span>

        <span className="text-slate-600">Alamat Murid</span>
        <span>:</span>
        <span>{rep.student.address || school.regency}</span>
        <span className="text-slate-600">Tahun Ajaran</span>
        <span>:</span>
        <span className="font-mono tabular-nums">{academicYear}</span>
      </div>

      <h3 className="text-xs font-bold uppercase text-slate-900 mb-2">
        A. Capaian Indikator Pembinaan Keasramaan
      </h3>
      <table className="rapor-table w-full border-collapse border border-slate-800 text-xs mb-5">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-800 py-2 px-2 text-center w-10">No</th>
            <th className="border border-slate-800 py-2 px-2.5 text-left w-48">
              Indikator Pembinaan
            </th>
            <th className="border border-slate-800 py-2 px-2 text-center w-20">Predikat</th>
            <th className="border border-slate-800 py-2 px-2.5 text-left">Deskripsi Capaian</th>
          </tr>
        </thead>
        <tbody>
          {keasGroups.length === 0 ? (
            <tr>
              <td colSpan={4} className="border border-slate-800 py-3 px-3 text-center text-slate-500">
                Belum ada indikator keasramaan aktif untuk semester ini.
              </td>
            </tr>
          ) : (
            keasGroups.map((grp) => (
              <React.Fragment key={grp.title}>
                <tr className="bg-slate-50">
                  <td
                    colSpan={4}
                    className="border border-slate-800 py-1.5 px-2.5 font-bold text-slate-900"
                  >
                    {grp.title}
                  </td>
                </tr>
                {grp.items.map((item, iIdx) => (
                  <tr key={item.indicatorId} className={iIdx === 0 ? 'first-data-row' : undefined}>
                    <td className="border border-slate-800 py-2 px-2 text-center font-mono tabular-nums align-top">
                      {iIdx + 1}
                    </td>
                    <td className="border border-slate-800 py-2 px-2.5 font-medium align-top">
                      {item.name}
                    </td>
                    <td className="border border-slate-800 py-2 px-2 text-center font-bold align-top">
                      {item.predicate}
                    </td>
                    <td className="border border-slate-800 py-2 px-2.5 leading-relaxed align-top">
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

      <div className="max-w-xs mb-6">
        <h3 className="text-xs font-bold uppercase text-slate-900 mb-1.5">
          B. Ketidakhadiran Kegiatan Asrama
        </h3>
        <table className="w-full border-collapse border border-slate-800 text-xs">
          <tbody>
            <tr>
              <td className="border border-slate-800 py-1.5 px-2.5">Sakit</td>
              <td className="border border-slate-800 py-1.5 px-2.5 font-mono tabular-nums text-right">
                {rep.attendance.sakit} hari
              </td>
            </tr>
            <tr>
              <td className="border border-slate-800 py-1.5 px-2.5">Izin</td>
              <td className="border border-slate-800 py-1.5 px-2.5 font-mono tabular-nums text-right">
                {rep.attendance.izin} hari
              </td>
            </tr>
            <tr>
              <td className="border border-slate-800 py-1.5 px-2.5">Tanpa Keterangan</td>
              <td className="border border-slate-800 py-1.5 px-2.5 font-mono tabular-nums text-right">
                {rep.attendance.alpa} hari
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rapor-signature-block pt-4 text-xs space-y-6">
        <div className="grid grid-cols-2 gap-8">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p>Wali Asrama</p>
            <div className="h-16" />
            <p className="font-semibold underline">
              {rep.keasramaanSigners?.waliAsramaName || 'Pembina Asrama'}
            </p>
          </div>
          <div className="text-center">
            <p>
              {school.regency}, {semester.reportDate}
            </p>
            <p>Wali Asuh</p>
            <div className="h-16" />
            <p className="font-semibold underline">
              {rep.keasramaanSigners?.waliAsuhName || 'Wali Asuh'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div className="text-center">
            <p>Mengetahui,</p>
            <p>Orang Tua / Wali Murid</p>
            <div className="h-16" />
            <p className="font-semibold border-b border-slate-700 inline-block min-w-[160px]">
              {rep.student.fatherName || rep.student.motherName || '..............................'}
            </p>
          </div>
          <div className="text-center">
            <p>Mengetahui,</p>
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
  journals: Array<{
    id: number;
    date: string;
    lessonHour: string;
    className: string;
    subjectName: string;
    teacherName: string;
    material: string;
    activities: string;
    completionStatus: string;
  }>;
}) {
  return (
    <article className="bg-white text-slate-900 border border-slate-300 shadow-sm mx-auto max-w-[210mm] p-8 sm:p-10 print:border-0 print:shadow-none print:p-0">
      <KopSekolah
        school={school}
        title="REKAPITULASI JURNAL MENGAJAR GURU"
        subtitle={`Tahun Ajaran ${academicYear} · ${semester.name}${cls ? ` · Kelas ${cls.name}` : ''} · Periode ${monthLabel}`}
      />

      <table className="rapor-table w-full border-collapse border border-slate-800 text-xs my-5">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-800 py-2 px-2 text-center w-9">No</th>
            <th className="border border-slate-800 py-2 px-2 text-left w-24">Tanggal / Jam</th>
            <th className="border border-slate-800 py-2 px-2 text-left w-28">Mapel & Kelas</th>
            <th className="border border-slate-800 py-2 px-2 text-left w-32">Guru</th>
            <th className="border border-slate-800 py-2 px-2 text-left">Materi & Aktivitas</th>
            <th className="border border-slate-800 py-2 px-2 text-center w-20">Status</th>
          </tr>
        </thead>
        <tbody>
          {journals.length === 0 ? (
            <tr>
              <td colSpan={6} className="border border-slate-800 py-4 text-center text-slate-500">
                Belum ada catatan jurnal mengajar pada filter yang dipilih.
              </td>
            </tr>
          ) : (
            journals.map((j, idx) => (
              <tr key={j.id} className={idx === 0 ? 'first-data-row' : undefined}>
                <td className="border border-slate-800 py-2 px-2 text-center font-mono tabular-nums align-top">
                  {idx + 1}
                </td>
                <td className="border border-slate-800 py-2 px-2 font-mono tabular-nums align-top">
                  <div>{j.date}</div>
                  <div className="text-[11px] text-slate-600">Jam {j.lessonHour}</div>
                </td>
                <td className="border border-slate-800 py-2 px-2 align-top">
                  <div className="font-semibold">{j.subjectName}</div>
                  <div className="text-[11px] text-slate-600">Kelas {j.className}</div>
                </td>
                <td className="border border-slate-800 py-2 px-2 align-top">{j.teacherName}</td>
                <td className="border border-slate-800 py-2 px-2 align-top">
                  <p className="font-semibold">{j.material}</p>
                  <p className="text-[11px] text-slate-700 mt-0.5 text-justify">{j.activities}</p>
                </td>
                <td className="border border-slate-800 py-2 px-2 text-center font-medium align-top">
                  {j.completionStatus}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="rapor-signature-block grid grid-cols-2 gap-8 pt-4 text-xs">
        <div className="text-center">
          <p>Mengetahui,</p>
          <p>Kepala Sekolah</p>
          <div className="h-16" />
          <p className="font-semibold underline">{school.principalName}</p>
          <p className="font-mono text-[11px]">NIP {school.principalNip || '-'}</p>
        </div>
        <div className="text-center">
          <p>
            {school.regency}, {semester.reportDate}
          </p>
          <p>Wali Kelas / Koordinator Kurikulum</p>
          <div className="h-16" />
          <p className="font-semibold underline">{cls?.homeroomTeacherName || 'Koordinator Kurikulum'}</p>
          <p className="font-mono text-[11px]">NIP {cls?.homeroomTeacherNip || '-'}</p>
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
    <article className="bg-white text-slate-900 border border-slate-300 shadow-sm mx-auto max-w-[210mm] p-8 sm:p-10 print:border-0 print:shadow-none print:p-0">
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
        title="REKAPITULASI PRESENSI KEHADIRAN GURU & PTK"
        subtitle={`Tahun Ajaran ${academicYear} · ${semester.name} · Periode ${monthLabel} · Hari Efektif: ${effectiveWorkDays} Hari`}
      />

      <table className="rapor-table w-full border-collapse border border-slate-800 text-xs my-5">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-800 py-2 px-1.5 text-center w-8">No</th>
            <th className="border border-slate-800 py-2 px-2 text-left">Nama Guru / NIP</th>
            <th className="border border-slate-800 py-2 px-1.5 text-center w-16">Status</th>
            <th className="border border-slate-800 py-2 px-1.5 text-center w-11">H</th>
            <th className="border border-slate-800 py-2 px-1.5 text-center w-11">DL</th>
            <th className="border border-slate-800 py-2 px-1.5 text-center w-11">S</th>
            <th className="border border-slate-800 py-2 px-1.5 text-center w-11">I</th>
            <th className="border border-slate-800 py-2 px-1.5 text-center w-11">A</th>
            <th className="border border-slate-800 py-2 px-2 text-right w-16">Hadir %</th>
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
                <div className="text-[11px] font-mono text-slate-600">NIP {r.nip}</div>
              </td>
              <td className="border border-slate-800 py-1.5 px-1.5 text-center">
                {r.employmentStatus}
              </td>
              <td className="border border-slate-800 py-1.5 px-1.5 text-center font-mono tabular-nums">
                {r.hadir}
              </td>
              <td className="border border-slate-800 py-1.5 px-1.5 text-center font-mono tabular-nums">
                {r.dinasLuar}
              </td>
              <td className="border border-slate-800 py-1.5 px-1.5 text-center font-mono tabular-nums">
                {r.sakit}
              </td>
              <td className="border border-slate-800 py-1.5 px-1.5 text-center font-mono tabular-nums">
                {r.izin}
              </td>
              <td className="border border-slate-800 py-1.5 px-1.5 text-center font-mono tabular-nums">
                {r.alpa}
              </td>
              <td className="border border-slate-800 py-1.5 px-2 text-right font-mono tabular-nums font-bold">
                {r.attendancePercent.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rapor-signature-block flex justify-end pt-4 text-xs">
        <div className="text-center min-w-[220px]">
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
