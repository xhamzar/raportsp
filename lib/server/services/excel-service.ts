import ExcelJS from 'exceljs';

export interface ParsedStudentRow {
  rowNumber: number;
  nisn: string;
  nis: string;
  fullName: string;
  gender: 'L' | 'P';
  birthPlace: string;
  birthDate: string;
  religion: string;
  address: string;
  fatherName: string;
  motherName: string;
  parentPhone: string;
  className: string;
}

export interface StudentImportPreview {
  validRows: ParsedStudentRow[];
  errors: Array<{ rowNumber: number; message: string }>;
  duplicatesInFile: Array<{ rowNumber: number; nisn: string }>;
}

export async function generateStudentTemplateWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Template Murid');

  sheet.columns = [
    { header: 'NISN (10 Digit)', key: 'nisn', width: 16 },
    { header: 'NIS', key: 'nis', width: 14 },
    { header: 'Nama Lengkap', key: 'fullName', width: 28 },
    { header: 'JK (L/P)', key: 'gender', width: 10 },
    { header: 'Tempat Lahir', key: 'birthPlace', width: 18 },
    { header: 'Tanggal Lahir (YYYY-MM-DD)', key: 'birthDate', width: 24 },
    { header: 'Agama', key: 'religion', width: 14 },
    { header: 'Alamat', key: 'address', width: 32 },
    { header: 'Nama Ayah', key: 'fatherName', width: 22 },
    { header: 'Nama Ibu', key: 'motherName', width: 22 },
    { header: 'No HP Orang Tua', key: 'parentPhone', width: 18 },
    { header: 'Kelas (cth: 4 A)', key: 'className', width: 16 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F2942' },
  };

  sheet.addRow({
    nisn: '0165009001',
    nis: '242504099',
    fullName: 'Contoh Murid Baru',
    gender: 'L',
    birthPlace: 'Jakarta',
    birthDate: '2016-04-15',
    religion: 'Islam',
    address: 'Jl. Merdeka No. 10',
    fatherName: 'Budi Santoso',
    motherName: 'Siti Aminah',
    parentPhone: '081234567890',
    className: '4 A',
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function parseStudentImportExcel(buffer: Buffer): Promise<StudentImportPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];

  const validRows: ParsedStudentRow[] = [];
  const errors: Array<{ rowNumber: number; message: string }> = [];
  const duplicatesInFile: Array<{ rowNumber: number; nisn: string }> = [];
  const seenNisn = new Set<string>();

  if (!sheet) {
    return {
      validRows: [],
      errors: [{ rowNumber: 0, message: 'Worksheet Excel tidak ditemukan.' }],
      duplicatesInFile: [],
    };
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cellText = (col: number) => String(row.getCell(col).text || row.getCell(col).value || '').trim();

    const nisn = cellText(1).replace(/\D/g, '');
    const nis = cellText(2);
    const fullName = cellText(3);
    const rawGender = cellText(4).toUpperCase();
    const birthPlace = cellText(5) || 'Jakarta';
    const rawDate = cellText(6);
    const religion = cellText(7) || 'Islam';
    const address = cellText(8);
    const fatherName = cellText(9);
    const motherName = cellText(10);
    const parentPhone = cellText(11);
    const className = cellText(12);

    if (!nisn && !fullName) return;

    if (!/^\d{10}$/.test(nisn)) {
      errors.push({ rowNumber, message: `NISN "${cellText(1)}" harus tepat 10 digit angka.` });
      return;
    }
    if (!fullName || fullName.length < 2) {
      errors.push({ rowNumber, message: 'Nama lengkap murid tidak boleh kosong.' });
      return;
    }
    if (rawGender !== 'L' && rawGender !== 'P') {
      errors.push({ rowNumber, message: `Jenis kelamin "${rawGender}" harus L atau P.` });
      return;
    }
    if (seenNisn.has(nisn)) {
      duplicatesInFile.push({ rowNumber, nisn });
      return;
    }
    seenNisn.add(nisn);

    const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : '2016-01-01';

    validRows.push({
      rowNumber,
      nisn,
      nis: nis || nisn.slice(-6),
      fullName,
      gender: rawGender,
      birthPlace,
      birthDate,
      religion,
      address,
      fatherName,
      motherName,
      parentPhone,
      className,
    });
  });

  return { validRows, errors, duplicatesInFile };
}

export async function exportStudentsExcel(
  rows: Array<{
    nisn: string;
    nis: string;
    fullName: string;
    gender: string;
    birthPlace: string;
    birthDate: string;
    religion: string;
    className: string;
    status: string;
    fatherName: string;
    motherName: string;
    parentPhone: string;
  }>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Daftar Murid');

  sheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'NISN', key: 'nisn', width: 15 },
    { header: 'NIS', key: 'nis', width: 12 },
    { header: 'Nama Lengkap', key: 'fullName', width: 28 },
    { header: 'JK', key: 'gender', width: 6 },
    { header: 'Tempat Lahir', key: 'birthPlace', width: 16 },
    { header: 'Tanggal Lahir', key: 'birthDate', width: 14 },
    { header: 'Agama', key: 'religion', width: 12 },
    { header: 'Rombel', key: 'className', width: 10 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Nama Ayah', key: 'fatherName', width: 20 },
    { header: 'Nama Ibu', key: 'motherName', width: 20 },
    { header: 'Telp Orang Tua', key: 'parentPhone', width: 16 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2942' } };

  rows.forEach((r, idx) => {
    sheet.addRow({ no: idx + 1, ...r });
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateSummativeTemplateWorkbook(params: {
  className: string;
  subjectName: string;
  students: Array<{ nisn: string; fullName: string; lm1?: number | null; lm2?: number | null; lm3?: number | null; sts?: number | null; sas?: number | null }>;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Nilai Sumatif');

  sheet.addRow([`Kelas: ${params.className}`, `Mata Pelajaran: ${params.subjectName}`]);
  sheet.getRow(1).font = { bold: true };

  const headerRow = sheet.addRow(['No', 'NISN', 'Nama Murid', 'LM 1', 'LM 2', 'LM 3', 'STS', 'SAS']);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2942' } };

  sheet.columns = [
    { width: 6 },
    { width: 16 },
    { width: 28 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
  ];

  params.students.forEach((s, idx) => {
    sheet.addRow([
      idx + 1,
      s.nisn,
      s.fullName,
      s.lm1 ?? '',
      s.lm2 ?? '',
      s.lm3 ?? '',
      s.sts ?? '',
      s.sas ?? '',
    ]);
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateLegerWorkbook(params: {
  schoolName: string;
  className: string;
  academicYear: string;
  semester: string;
  subjects: Array<{ id: number; code: string; name: string }>;
  rows: Array<{
    rank: number;
    nisn: string;
    fullName: string;
    subjectScores: Record<number, number | null>;
    average: number;
    cocurricularPredicate: string;
    extracurricularPredicate: string;
    h: number;
    s: number;
    i: number;
    a: number;
  }>;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Leger ${params.className}`);

  sheet.addRow([`LEGER NILAI AKHIR - ${params.schoolName}`]);
  sheet.addRow([`Kelas: ${params.className} | Tahun Ajaran: ${params.academicYear} | Semester: ${params.semester}`]);
  sheet.getRow(1).font = { bold: true, size: 13 };
  sheet.addRow([]);

  const headers = [
    'Peringkat',
    'NISN',
    'Nama Murid',
    ...params.subjects.map((s) => s.code),
    'Rata-rata',
    'Kokurikuler',
    'Ekstra',
    'Hadir',
    'Sakit',
    'Izin',
    'Alpa',
  ];
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2942' } };

  for (const r of params.rows) {
    sheet.addRow([
      r.rank,
      r.nisn,
      r.fullName,
      ...params.subjects.map((s) => r.subjectScores[s.id] ?? '-'),
      r.average,
      r.cocurricularPredicate,
      r.extracurricularPredicate,
      r.h,
      r.s,
      r.i,
      r.a,
    ]);
  }

  sheet.columns.forEach((col, i) => {
    col.width = i === 2 ? 28 : i === 1 ? 15 : 12;
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateAttendanceRecapWorkbook(params: {
  className: string;
  semester: string;
  rows: Array<{
    no: number;
    nisn: string;
    fullName: string;
    hadir: number;
    sakit: number;
    izin: number;
    alpa: number;
    percentage: number;
  }>;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Rekap Presensi');

  sheet.addRow([`Rekapitulasi Kehadiran Murid - Kelas ${params.className} (${params.semester})`]);
  sheet.getRow(1).font = { bold: true, size: 12 };
  const headerRow = sheet.addRow(['No', 'NISN', 'Nama Murid', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Persentase (%)']);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2942' } };

  for (const r of params.rows) {
    sheet.addRow([r.no, r.nisn, r.fullName, r.hadir, r.sakit, r.izin, r.alpa, `${r.percentage}%`]);
  }

  sheet.columns = [
    { width: 6 },
    { width: 16 },
    { width: 28 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 16 },
  ];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateCocurricularTemplateWorkbook(params: {
  className: string;
  projectTitle: string;
  dimensions: string[];
  students: Array<{
    nisn: string;
    fullName: string;
    dimensionScores: Record<string, string>;
  }>;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Nilai Kokurikuler');

  sheet.addRow([
    `Kelas: ${params.className}`,
    `Kegiatan Kokurikuler: ${params.projectTitle}`,
    'Isi predikat: Sangat Baik / Baik / Cukup / Perlu Bimbingan',
  ]);
  sheet.getRow(1).font = { bold: true };

  const headers = ['No', 'NISN', 'Nama Murid', ...params.dimensions];
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2942' } };

  sheet.columns = [
    { width: 6 },
    { width: 16 },
    { width: 28 },
    ...params.dimensions.map(() => ({ width: 22 })),
  ];

  params.students.forEach((s, idx) => {
    sheet.addRow([
      idx + 1,
      s.nisn,
      s.fullName,
      ...params.dimensions.map((d) => s.dimensionScores[d] || 'Baik'),
    ]);
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateExtracurricularTemplateWorkbook(params: {
  className: string;
  extracurricularName: string;
  objectives: string[];
  students: Array<{
    nisn: string;
    fullName: string;
    tpScores: Array<{ objective: string; predicate: string }>;
    predicate: string;
  }>;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Nilai Ekstrakurikuler');

  sheet.addRow([
    `Kelas: ${params.className}`,
    `Ekstrakurikuler: ${params.extracurricularName}`,
    'Isi nilai: Sangat Baik / Baik / Cukup / Kurang',
  ]);
  sheet.getRow(1).font = { bold: true };

  const tpColumns =
    params.objectives.length > 0 ? params.objectives : ['Predikat Umum'];
  const headers = ['No', 'NISN', 'Nama Murid', ...tpColumns];
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2942' } };

  sheet.columns = [
    { width: 6 },
    { width: 16 },
    { width: 28 },
    ...tpColumns.map(() => ({ width: 26 })),
  ];

  params.students.forEach((s, idx) => {
    const scoreMap = new Map(s.tpScores.map((t) => [t.objective, t.predicate]));
    const vals =
      params.objectives.length > 0
        ? params.objectives.map((obj) => scoreMap.get(obj) || (s.predicate !== '-' ? s.predicate : ''))
        : [s.predicate !== '-' ? s.predicate : ''];
    sheet.addRow([idx + 1, s.nisn, s.fullName, ...vals]);
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

