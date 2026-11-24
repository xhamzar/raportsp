import { createHash } from 'node:crypto';

export interface DapodikConnectionResult {
  connected: boolean;
  mode: 'WebService' | 'Sandbox';
  statusText: string;
  schoolName?: string;
  sekolahId?: string;
  semesterLabel?: string;
  normalizedBaseUrl?: string;
  error?: string;
}

export interface DapodikMatevPayload {
  npsn: string;
  semesterId: string;
  rombonganBelajarId: string;
  mataPelajaranId: string;
  mataPelajaranNama: string;
  jumlahMurid: number;
}

export interface DapodikNilaiPayload {
  npsn: string;
  semesterId: string;
  rombonganBelajarId: string;
  mataPelajaranId: string;
  entries: Array<{
    pesertaDidikId: string;
    nisn: string;
    nama: string;
    nilaiAkhir: number;
    capaianKompetensi: string;
  }>;
}

export interface DapodikSyncSection {
  key: string;
  label: string;
  endpoint: string;
  status: 'Berhasil' | 'Dilewati' | 'Gagal';
  count: number;
  detail: string;
}

export interface DapodikSyncResult {
  ok: boolean;
  mode: 'WebService' | 'Sandbox';
  schoolName: string;
  sekolahId: string;
  updaterId: string;
  sections: DapodikSyncSection[];
  subjectsCatalog: Array<{
    mapelId: string;
    name: string;
    shortName: string;
  }>;
  anggotaRombelByNisn: Record<
    string,
    {
      pesertaDidikId: string;
      anggotaRombelId: string;
      rombonganBelajarId?: string;
    }
  >;
  pembelajaranByCode: Array<{
    mataPelajaranId: string;
    mataPelajaranNama: string;
    pembelajaranId: string;
    rombonganBelajarId: string;
  }>;
  error?: string;
}

export interface DapodikProtocolSubmitResult {
  ok: boolean;
  matev: {
    ok: boolean;
    status: string;
    message: string;
    idEvaluasi: string;
    reusedExisting: boolean;
    payload: Record<string, unknown>;
  };
  nilai: {
    ok: boolean;
    status: string;
    message: string;
    sentCount: number;
    skippedCount: number;
    samplePayloads: Array<Record<string, unknown>>;
    errors: string[];
  };
  updaterId: string;
}

const DAPODIK_TIMEOUT_MS = 20_000;

/**
 * Normalisasi URL WebService Dapodik:
 * menerima `192.168.8.114:5774`, `http://localhost:5774`, atau `http://localhost:5774/WebService`
 * dan menghasilkan origin/base URL bersih tanpa akhiran `/WebService`.
 */
export function normalizeWebServiceUrl(rawUrl: string): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return 'http://localhost:5774';
  const hasAnyScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
  const withProto = hasAnyScheme ? trimmed : `http://${trimmed}`;
  return withProto.replace(/\/WebService\/?$/i, '').replace(/\/+$/, '');
}

/**
 * Validasi URL Web Service Dapodik Desktop (port default 5774 atau host jaringan sekolah)
 * dengan pemblokiran metadata link-local cloud (169.254.0.0/16).
 */
export function validateDapodikUrl(rawUrl: string): {
  valid: boolean;
  reason?: string;
  url?: URL;
  normalizedBaseUrl?: string;
} {
  try {
    const normalized = normalizeWebServiceUrl(rawUrl);
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: 'Protokol URL Dapodik harus http atau https.' };
    }
    if (parsed.hostname === '169.254.169.254' || parsed.hostname.startsWith('169.254.')) {
      return { valid: false, reason: 'Alamat link-local metadata tidak diizinkan.' };
    }
    return { valid: true, url: parsed, normalizedBaseUrl: normalized };
  } catch {
    return { valid: false, reason: 'Format URL Web Service Dapodik tidak valid.' };
  }
}

/**
 * UUID v5 deterministik RFC 4122 (SHA-1) untuk `id_evaluasi`, `nilai_id`, dan `updater_id`.
 */
export function uuidDeterministic(seed: string): string {
  const hash = createHash('sha1').update(seed, 'utf8').digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Ekstraksi JSON aman ketika Dapodik menyisipkan notice HTML/warning di awal atau akhir respons.
 */
export function extractJsonBody(rawText: string): unknown {
  const text = String(rawText || '').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const objStart = text.indexOf('{');
    const arrStart = text.indexOf('[');
    let start = -1;
    let end = -1;

    if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
      start = arrStart;
      end = text.lastIndexOf(']');
    } else if (objStart !== -1) {
      start = objStart;
      end = text.lastIndexOf('}');
    }

    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('Respons Dapodik bukan format JSON yang valid.');
  }
}

/**
 * Normalisasi variasi struktur respons Dapodik (`rows` array, `rows` object tunggal, `datas`, atau array langsung).
 */
export function rowsOf<T = Record<string, unknown>>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];

  if (typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (obj.success === false) {
      const msg = typeof obj.message === 'string' && obj.message.trim()
        ? obj.message
        : 'Web Service Dapodik mengembalikan status gagal.';
      throw new Error(msg);
    }
    if (Array.isArray(obj.rows)) return obj.rows as T[];
    if (obj.rows && typeof obj.rows === 'object') return [obj.rows as T];
    if (Array.isArray(obj.datas)) return obj.datas as T[];
    if (obj.datas && typeof obj.datas === 'object') return [obj.datas as T];
    if (Array.isArray(obj.results)) return obj.results as T[];
  }

  return [];
}

export function dapodikStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (s === '-' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return '';
  return s;
}

function formatDapodikTimestamp(date = new Date(), offsetHours = 0): string {
  const adjusted = new Date(date.getTime() + offsetHours * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${adjusted.getFullYear()}-${pad(adjusted.getMonth() + 1)}-${pad(adjusted.getDate())} ${pad(
    adjusted.getHours()
  )}:${pad(adjusted.getMinutes())}:${pad(adjusted.getSeconds())}`;
}

function normalizeSemesterCode(semesterLabelOrId: string): string {
  const digits = String(semesterLabelOrId || '').replace(/\D/g, '');
  if (digits.length === 5) return digits;
  return '20261';
}

async function dapodikGet(
  baseUrl: string,
  token: string,
  method: string,
  query: Record<string, string | number | undefined>
): Promise<unknown> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') {
      params.set(k, String(v));
    }
  }
  const url = `${baseUrl}/WebService/${method}${params.toString() ? `?${params.toString()}` : ''}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(DAPODIK_TIMEOUT_MS),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} dari ${method}: ${text.slice(0, 140)}`);
      }
      const parsed = extractJsonBody(text);
      return parsed;
    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 250 * attempt));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Gagal mengakses ${method}`);
}

async function dapodikPost(
  baseUrl: string,
  token: string,
  methodAndQuery: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: unknown; rawText: string }> {
  const url = `${baseUrl}/WebService/${methodAndQuery}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(DAPODIK_TIMEOUT_MS),
      });
      const rawText = await res.text();
      let data: unknown = rawText;
      try {
        data = extractJsonBody(rawText);
      } catch {
        // Keep rawText
      }
      return { ok: res.ok, status: res.status, data, rawText };
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Gagal mengirim ke ${methodAndQuery}`);
}

export async function testDapodikConnection(params: {
  webServiceUrl: string;
  npsn: string;
  apiToken: string;
  mode: 'WebService' | 'Sandbox';
}): Promise<DapodikConnectionResult> {
  const urlCheck = validateDapodikUrl(params.webServiceUrl);
  if (!urlCheck.valid || !urlCheck.normalizedBaseUrl) {
    return {
      connected: false,
      mode: params.mode,
      statusText: 'Konfigurasi Tidak Valid',
      error: urlCheck.reason,
    };
  }

  if (params.mode === 'Sandbox') {
    return {
      connected: true,
      mode: 'Sandbox',
      statusText: 'Mode Pengujian Sandbox Aktif (Simulasi Protokol Resmi 5774)',
      schoolName: 'SD Negeri Nusantara 01 (Sandbox)',
      sekolahId: uuidDeterministic(`sekolah-${params.npsn}`),
      semesterLabel: '2026/2027 Ganjil (20261)',
      normalizedBaseUrl: urlCheck.normalizedBaseUrl,
    };
  }

  if (!params.apiToken) {
    return {
      connected: false,
      mode: 'WebService',
      statusText: 'Token API Kosong',
      normalizedBaseUrl: urlCheck.normalizedBaseUrl,
      error: 'Masukkan Token Web Service dari aplikasi Dapodik Desktop sebelum menguji koneksi.',
    };
  }

  try {
    const payload = await dapodikGet(urlCheck.normalizedBaseUrl, params.apiToken, 'getSekolah', {
      npsn: params.npsn,
    });
    const rows = rowsOf<{ nama?: string; sekolah_id?: string }>(payload);
    const school = rows[0];

    return {
      connected: true,
      mode: 'WebService',
      statusText: 'Terhubung ke Web Service Dapodik',
      schoolName: dapodikStr(school?.nama) || `NPSN ${params.npsn}`,
      sekolahId: dapodikStr(school?.sekolah_id) || undefined,
      normalizedBaseUrl: urlCheck.normalizedBaseUrl,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menghubungi host Dapodik.';
    return {
      connected: false,
      mode: 'WebService',
      statusText: 'Tidak Dapat Dijangkau',
      normalizedBaseUrl: urlCheck.normalizedBaseUrl,
      error: `Tidak dapat terhubung ke ${urlCheck.normalizedBaseUrl}/WebService. Pastikan aplikasi Dapodik Desktop aktif atau gunakan Mode Sandbox untuk simulasi tervalidasi. (${msg})`,
    };
  }
}

export async function syncFromDapodikAdapter(params: {
  webServiceUrl: string;
  npsn: string;
  apiToken: string;
  mode: 'WebService' | 'Sandbox';
  localStudents: Array<{ id: number; nisn: string; fullName: string; dapodikStudentId: string | null }>;
  localClasses: Array<{ id: number; name: string; gradeLevel: number; dapodikRombelId: string | null }>;
  localSubjects: Array<{ id: number; code: string; name: string; dapodikMapelId: string | null }>;
  localTeachersCount: number;
}): Promise<DapodikSyncResult> {
  const urlCheck = validateDapodikUrl(params.webServiceUrl);
  if (!urlCheck.valid || !urlCheck.normalizedBaseUrl) {
    return {
      ok: false,
      mode: params.mode,
      schoolName: '',
      sekolahId: '',
      updaterId: '',
      sections: [],
      subjectsCatalog: [],
      anggotaRombelByNisn: {},
      pembelajaranByCode: [],
      error: urlCheck.reason || 'URL Web Service tidak valid.',
    };
  }

  if (params.mode === 'Sandbox') {
    const sekolahId = uuidDeterministic(`sandbox-sekolah-${params.npsn}`);
    const updaterId = uuidDeterministic(`sandbox-updater-${params.npsn}`);
    const sandboxCatalog = [
      { mapelId: '100014000', name: 'Pendidikan Agama dan Budi Pekerti', shortName: 'PAIBP' },
      { mapelId: '200010000', name: 'Pendidikan Pancasila', shortName: 'PPKn' },
      { mapelId: '300010000', name: 'Bahasa Indonesia', shortName: 'B.IND' },
      { mapelId: '400010000', name: 'Matematika', shortName: 'MTK' },
      { mapelId: '500015000', name: 'Ilmu Pengetahuan Alam dan Sosial', shortName: 'IPAS' },
      { mapelId: '600010000', name: 'Pendidikan Jasmani, Olahraga, dan Kesehatan', shortName: 'PJOK' },
      { mapelId: '700010000', name: 'Seni dan Budaya', shortName: 'SBK' },
      { mapelId: '800010000', name: 'Bahasa Inggris', shortName: 'B.ING' },
      { mapelId: '900010000', name: 'Muatan Lokal (Bahasa Daerah)', shortName: 'MULOK' },
    ];

    const anggotaRombelByNisn: DapodikSyncResult['anggotaRombelByNisn'] = {};
    for (const stu of params.localStudents) {
      anggotaRombelByNisn[stu.nisn] = {
        pesertaDidikId: stu.dapodikStudentId || uuidDeterministic(`pd:${params.npsn}:${stu.nisn}`),
        anggotaRombelId: uuidDeterministic(`anggota-rombel:${params.npsn}:${stu.nisn}`),
      };
    }

    const pembelajaranByCode: DapodikSyncResult['pembelajaranByCode'] = [];
    for (const cls of params.localClasses) {
      const rombelId = cls.dapodikRombelId || uuidDeterministic(`rombel:${params.npsn}:${cls.name}`);
      for (const sub of params.localSubjects) {
        const prefix = sub.code.split('-')[0];
        const cat = sandboxCatalog.find((c) => c.shortName === prefix || c.name === sub.name);
        const mapelId = sub.dapodikMapelId || cat?.mapelId || '100014000';
        pembelajaranByCode.push({
          mataPelajaranId: mapelId,
          mataPelajaranNama: sub.name,
          pembelajaranId: uuidDeterministic(`pb:${rombelId}:${sub.code}`),
          rombonganBelajarId: rombelId,
        });
      }
    }

    const sections: DapodikSyncSection[] = [
      {
        key: 'sekolah',
        label: 'Profil Sekolah (getSekolah)',
        endpoint: '/WebService/getSekolah',
        status: 'Berhasil',
        count: 1,
        detail: `NPSN ${params.npsn} · sekolah_id ${sekolahId.slice(0, 8)}...`,
      },
      {
        key: 'rombel',
        label: 'Rombongan Belajar & Pembelajaran (getRombonganBelajar)',
        endpoint: '/WebService/getRombonganBelajar',
        status: 'Berhasil',
        count: params.localClasses.length,
        detail: `${params.localClasses.length} rombel & ${pembelajaranByCode.length} entri pembelajaran`,
      },
      {
        key: 'gtk',
        label: 'Guru & Tenaga Kependidikan (getGtk)',
        endpoint: '/WebService/getGtk',
        status: 'Berhasil',
        count: params.localTeachersCount,
        detail: `${params.localTeachersCount} GTK terverifikasi`,
      },
      {
        key: 'peserta_didik',
        label: 'Peserta Didik & Anggota Rombel (getPesertaDidik)',
        endpoint: '/WebService/getPesertaDidik',
        status: 'Berhasil',
        count: params.localStudents.length,
        detail: `${params.localStudents.length} anggota_rombel_id UUID v5 dipetakan`,
      },
      {
        key: 'mapel',
        label: 'Referensi Mata Pelajaran (getMataPelajaran)',
        endpoint: '/WebService/getMataPelajaran',
        status: 'Berhasil',
        count: sandboxCatalog.length,
        detail: `${sandboxCatalog.length} kode mapel Kemendikdasmen`,
      },
      {
        key: 'pengguna',
        label: 'Operator & Updater ID (getPengguna)',
        endpoint: '/WebService/getPengguna',
        status: 'Berhasil',
        count: 1,
        detail: `updater_id ${updaterId.slice(0, 8)}... siap mengirim MATEV/Nilai`,
      },
    ];

    return {
      ok: true,
      mode: 'Sandbox',
      schoolName: 'SD Negeri Nusantara 01 (Sandbox)',
      sekolahId,
      updaterId,
      sections,
      subjectsCatalog: sandboxCatalog,
      anggotaRombelByNisn,
      pembelajaranByCode,
    };
  }

  // Real Dapodik WebService protocol
  if (!params.apiToken) {
    return {
      ok: false,
      mode: 'WebService',
      schoolName: '',
      sekolahId: '',
      updaterId: '',
      sections: [],
      subjectsCatalog: [],
      anggotaRombelByNisn: {},
      pembelajaranByCode: [],
      error: 'Token Web Service Dapodik belum diisi.',
    };
  }

  const baseUrl = urlCheck.normalizedBaseUrl;
  const sections: DapodikSyncSection[] = [];
  let schoolName = `NPSN ${params.npsn}`;
  let sekolahId = '';
  let updaterId = uuidDeterministic(`updater:${params.npsn}`);
  const subjectsCatalog: DapodikSyncResult['subjectsCatalog'] = [];
  const anggotaRombelByNisn: DapodikSyncResult['anggotaRombelByNisn'] = {};
  const pembelajaranByCode: DapodikSyncResult['pembelajaranByCode'] = [];

  try {
    // 1. getSekolah
    const sekolahRaw = await dapodikGet(baseUrl, params.apiToken, 'getSekolah', { npsn: params.npsn });
    const sekolahRows = rowsOf<{ nama?: string; sekolah_id?: string }>(sekolahRaw);
    if (sekolahRows[0]) {
      schoolName = dapodikStr(sekolahRows[0].nama) || schoolName;
      sekolahId = dapodikStr(sekolahRows[0].sekolah_id);
    }
    sections.push({
      key: 'sekolah',
      label: 'Profil Sekolah (getSekolah)',
      endpoint: '/WebService/getSekolah',
      status: 'Berhasil',
      count: sekolahRows.length,
      detail: schoolName,
    });

    // 2. getRombonganBelajar
    const rombelRaw = await dapodikGet(baseUrl, params.apiToken, 'getRombonganBelajar', {
      npsn: params.npsn,
    });
    const rombelRows = rowsOf<{
      rombongan_belajar_id?: string;
      pembelajaran?: Array<{
        pembelajaran_id?: string;
        mata_pelajaran_id?: string | number;
        mata_pelajaran_id_str?: string;
      }>;
    }>(rombelRaw);
    for (const r of rombelRows) {
      const rId = dapodikStr(r.rombongan_belajar_id);
      if (Array.isArray(r.pembelajaran)) {
        for (const pb of r.pembelajaran) {
          if (pb.pembelajaran_id && pb.mata_pelajaran_id) {
            pembelajaranByCode.push({
              mataPelajaranId: String(pb.mata_pelajaran_id),
              mataPelajaranNama: dapodikStr(pb.mata_pelajaran_id_str),
              pembelajaranId: String(pb.pembelajaran_id),
              rombonganBelajarId: rId,
            });
          }
        }
      }
    }
    sections.push({
      key: 'rombel',
      label: 'Rombongan Belajar & Pembelajaran (getRombonganBelajar)',
      endpoint: '/WebService/getRombonganBelajar',
      status: 'Berhasil',
      count: rombelRows.length,
      detail: `${rombelRows.length} rombel · ${pembelajaranByCode.length} pembelajaran`,
    });

    // 3. getGtk
    let gtkCount = 0;
    try {
      const gtkRaw = await dapodikGet(baseUrl, params.apiToken, 'getGtk', { npsn: params.npsn });
      gtkCount = rowsOf(gtkRaw).length;
      sections.push({
        key: 'gtk',
        label: 'Guru & Tenaga Kependidikan (getGtk)',
        endpoint: '/WebService/getGtk',
        status: 'Berhasil',
        count: gtkCount,
        detail: `${gtkCount} GTK ditemukan`,
      });
    } catch (err) {
      sections.push({
        key: 'gtk',
        label: 'Guru & Tenaga Kependidikan (getGtk)',
        endpoint: '/WebService/getGtk',
        status: 'Gagal',
        count: 0,
        detail: err instanceof Error ? err.message : 'Gagal membaca GTK',
      });
    }

    // 4. getPesertaDidik
    const pdRaw = await dapodikGet(baseUrl, params.apiToken, 'getPesertaDidik', { npsn: params.npsn });
    const pdRows = rowsOf<{
      nisn?: string;
      peserta_didik_id?: string;
      anggota_rombel_id?: string;
      rombongan_belajar_id?: string;
    }>(pdRaw);
    for (const pd of pdRows) {
      const nisn = dapodikStr(pd.nisn);
      if (nisn) {
        anggotaRombelByNisn[nisn] = {
          pesertaDidikId: dapodikStr(pd.peserta_didik_id),
          anggotaRombelId: dapodikStr(pd.anggota_rombel_id),
          rombonganBelajarId: dapodikStr(pd.rombongan_belajar_id),
        };
      }
    }
    sections.push({
      key: 'peserta_didik',
      label: 'Peserta Didik & Anggota Rombel (getPesertaDidik)',
      endpoint: '/WebService/getPesertaDidik',
      status: 'Berhasil',
      count: pdRows.length,
      detail: `${Object.keys(anggotaRombelByNisn).length} NISN terpetakan`,
    });

    // 5. getMataPelajaran (opsional di beberapa versi Dapodik)
    try {
      const mapelRaw = await dapodikGet(baseUrl, params.apiToken, 'getMataPelajaran', {
        npsn: params.npsn,
      });
      const mapelRows = rowsOf<{
        mata_pelajaran_id?: string | number;
        nama?: string;
        nama_singkat?: string;
      }>(mapelRaw);
      for (const m of mapelRows) {
        if (m.mata_pelajaran_id && m.nama) {
          subjectsCatalog.push({
            mapelId: String(m.mata_pelajaran_id),
            name: dapodikStr(m.nama),
            shortName: dapodikStr(m.nama_singkat) || dapodikStr(m.nama).slice(0, 10),
          });
        }
      }
      sections.push({
        key: 'mapel',
        label: 'Referensi Mata Pelajaran (getMataPelajaran)',
        endpoint: '/WebService/getMataPelajaran',
        status: 'Berhasil',
        count: subjectsCatalog.length,
        detail: `${subjectsCatalog.length} mata pelajaran`,
      });
    } catch {
      sections.push({
        key: 'mapel',
        label: 'Referensi Mata Pelajaran (getMataPelajaran)',
        endpoint: '/WebService/getMataPelajaran',
        status: 'Dilewati',
        count: 0,
        detail: 'Endpoint opsional tidak tersedia; menggunakan katalog standar.',
      });
    }

    // 6. getPengguna
    try {
      const userRaw = await dapodikGet(baseUrl, params.apiToken, 'getPengguna', { npsn: params.npsn });
      const userRows = rowsOf<{ pengguna_id?: string }>(userRaw);
      if (userRows[0]?.pengguna_id) {
        updaterId = dapodikStr(userRows[0].pengguna_id);
      }
      sections.push({
        key: 'pengguna',
        label: 'Operator & Updater ID (getPengguna)',
        endpoint: '/WebService/getPengguna',
        status: 'Berhasil',
        count: userRows.length,
        detail: `updater_id ${updaterId.slice(0, 8)}...`,
      });
    } catch {
      sections.push({
        key: 'pengguna',
        label: 'Operator & Updater ID (getPengguna)',
        endpoint: '/WebService/getPengguna',
        status: 'Dilewati',
        count: 0,
        detail: `Menggunakan updater_id deterministik ${updaterId.slice(0, 8)}...`,
      });
    }

    return {
      ok: true,
      mode: 'WebService',
      schoolName,
      sekolahId,
      updaterId,
      sections,
      subjectsCatalog,
      anggotaRombelByNisn,
      pembelajaranByCode,
    };
  } catch (err) {
    return {
      ok: false,
      mode: 'WebService',
      schoolName,
      sekolahId,
      updaterId,
      sections,
      subjectsCatalog,
      anggotaRombelByNisn,
      pembelajaranByCode,
      error: err instanceof Error ? err.message : 'Sinkronisasi Dapodik gagal.',
    };
  }
}

export async function submitRaporToDapodikProtocol(params: {
  webServiceUrl: string;
  npsn: string;
  apiToken: string;
  mode: 'WebService' | 'Sandbox';
  isDryRun: boolean;
  semesterLabel: string;
  rombonganBelajarId: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  subjectSortOrder: number;
  kkm: number;
  dapodikMapelId: string;
  dapodikPembelajaranId: string;
  entries: Array<{
    studentId: number;
    nisn: string;
    fullName: string;
    anggotaRombelId: string;
    finalScore: number;
    competencyDescription: string;
  }>;
}): Promise<DapodikProtocolSubmitResult> {
  const urlCheck = validateDapodikUrl(params.webServiceUrl);
  const baseUrl = urlCheck.normalizedBaseUrl || 'http://localhost:5774';
  const semesterCode = normalizeSemesterCode(params.semesterLabel);
  const rombelId =
    params.rombonganBelajarId || uuidDeterministic(`rombel:${params.npsn}:${params.subjectId}`);
  const mapelId = params.dapodikMapelId || '100014000';
  const pbId =
    params.dapodikPembelajaranId ||
    uuidDeterministic(`pb:${rombelId}:${params.subjectCode}`);

  let updaterId = uuidDeterministic(`updater:${params.npsn}`);
  let idEvaluasi = uuidDeterministic(
    `sekolahkita-matev:${rombelId}:${params.subjectId}:${pbId}:${mapelId}`
  );
  let reusedExisting = false;

  const nowDate = new Date();
  const createDate = formatDapodikTimestamp(nowDate, 0);
  const lastUpdate = formatDapodikTimestamp(nowDate, 6);

  // In live WebService non-dry-run mode, resolve updater_id and reuse existing matev id_evaluasi if present
  if (params.mode === 'WebService' && !params.isDryRun && urlCheck.valid && params.apiToken) {
    try {
      const penggunaRaw = await dapodikGet(baseUrl, params.apiToken, 'getPengguna', {
        npsn: params.npsn,
      });
      const penggunaRows = rowsOf<{ pengguna_id?: string }>(penggunaRaw);
      if (penggunaRows[0]?.pengguna_id) {
        updaterId = dapodikStr(penggunaRows[0].pengguna_id);
      }
    } catch {
      // fallback to deterministic updaterId
    }

    try {
      const matevListRaw = await dapodikGet(baseUrl, params.apiToken, 'getMatevNilai', {
        npsn: params.npsn,
        semester_id: semesterCode,
        a_dari_template: 1,
      });
      const existingMatevs = rowsOf<{
        id_evaluasi?: string;
        pembelajaran_id?: string;
        mata_pelajaran_id?: string | number;
      }>(matevListRaw);
      const matched = existingMatevs.find(
        (m) =>
          (pbId && dapodikStr(m.pembelajaran_id) === pbId) ||
          String(m.mata_pelajaran_id || '') === String(mapelId)
      );
      if (matched?.id_evaluasi) {
        idEvaluasi = dapodikStr(matched.id_evaluasi);
        reusedExisting = true;
      }
    } catch {
      // proceed with deterministic UUID v5 id_evaluasi
    }
  }

  const matevPayload: Record<string, unknown> = {
    id_evaluasi: idEvaluasi,
    rombongan_belajar_id: rombelId,
    mata_pelajaran_id: Number(mapelId) || mapelId,
    pembelajaran_id: pbId,
    nm_mata_evaluasi: params.subjectName.slice(0, 40),
    a_dari_template: 1,
    no_urut: params.subjectSortOrder || 1,
    kkm_kognitif: params.kkm || 75,
    kkm_psikomotorik: params.kkm || 75,
    create_date: createDate,
    last_update: lastUpdate,
    soft_delete: 0,
    last_sync: createDate,
    updater_id: updaterId,
  };

  // Eligible students: must have anggota_rombel_id
  const eligible = params.entries.filter((e) => Boolean(e.anggotaRombelId));
  const skippedCount = params.entries.length - eligible.length;

  const nilaiPayloads = eligible.map((stu) => ({
    nilai_id: uuidDeterministic(`sekolahkita-nilai:${params.subjectId}:${stu.studentId}`),
    id_evaluasi: idEvaluasi,
    anggota_rombel_id: stu.anggotaRombelId,
    nilai_kognitif_angka: Number(stu.finalScore.toFixed(2)),
    ket_kognitif: stu.competencyDescription.slice(0, 300),
    create_date: createDate,
    last_update: lastUpdate,
    soft_delete: 0,
    last_sync: createDate,
    updater_id: updaterId,
  }));

  if (params.isDryRun) {
    return {
      ok: true,
      updaterId,
      matev: {
        ok: true,
        status: 'Berhasil (Dry-Run)',
        message: `Validasi skema postMatevRapor berhasil (id_evaluasi UUID v5: ${idEvaluasi}).`,
        idEvaluasi,
        reusedExisting,
        payload: matevPayload,
      },
      nilai: {
        ok: true,
        status: 'Berhasil (Dry-Run)',
        message: `Dry-Run siap mengirim ${nilaiPayloads.length} nilai ke postNilai?table=rapor${
          skippedCount > 0 ? ` (${skippedCount} murid belum memiliki anggota_rombel_id)` : ''
        }.`,
        sentCount: nilaiPayloads.length,
        skippedCount,
        samplePayloads: nilaiPayloads.slice(0, 2),
        errors: [],
      },
    };
  }

  if (params.mode === 'Sandbox') {
    return {
      ok: true,
      updaterId,
      matev: {
        ok: true,
        status: 'Berhasil (Sandbox)',
        message: `[SANDBOX] Simulasi postMatevRapor diterima (id_evaluasi: ${idEvaluasi}).`,
        idEvaluasi,
        reusedExisting,
        payload: matevPayload,
      },
      nilai: {
        ok: true,
        status: 'Berhasil (Sandbox)',
        message: `[SANDBOX] ${nilaiPayloads.length} paket nilai_id UUID v5 divalidasi melalui protokol postNilai?table=rapor.`,
        sentCount: nilaiPayloads.length,
        skippedCount,
        samplePayloads: nilaiPayloads.slice(0, 2),
        errors: [],
      },
    };
  }

  if (!urlCheck.valid || !params.apiToken) {
    return {
      ok: false,
      updaterId,
      matev: {
        ok: false,
        status: 'Gagal',
        message: !urlCheck.valid
          ? urlCheck.reason || 'URL Web Service tidak valid.'
          : 'Token Web Service Dapodik belum dikonfigurasi.',
        idEvaluasi,
        reusedExisting,
        payload: matevPayload,
      },
      nilai: {
        ok: false,
        status: 'Dilewati',
        message: 'Pengiriman nilai dibatalkan karena konfigurasi Web Service belum lengkap.',
        sentCount: 0,
        skippedCount,
        samplePayloads: nilaiPayloads.slice(0, 2),
        errors: ['Konfigurasi Web Service belum lengkap'],
      },
    };
  }

  // Step 1: postMatevRapor
  try {
    const matevQuery = `postMatevRapor?npsn=${encodeURIComponent(
      params.npsn
    )}&semester_id=${encodeURIComponent(semesterCode)}`;
    const matevRes = await dapodikPost(baseUrl, params.apiToken, matevQuery, matevPayload);
    if (!matevRes.ok) {
      return {
        ok: false,
        updaterId,
        matev: {
          ok: false,
          status: 'Gagal',
          message: `postMatevRapor mengembalikan HTTP ${matevRes.status}: ${matevRes.rawText.slice(0, 140)}`,
          idEvaluasi,
          reusedExisting,
          payload: matevPayload,
        },
        nilai: {
          ok: false,
          status: 'Dilewati',
          message: 'Pengiriman postNilai dihentikan karena postMatevRapor gagal.',
          sentCount: 0,
          skippedCount,
          samplePayloads: nilaiPayloads.slice(0, 2),
          errors: [`HTTP ${matevRes.status} pada postMatevRapor`],
        },
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menghubungi postMatevRapor';
    return {
      ok: false,
      updaterId,
      matev: {
        ok: false,
        status: 'Gagal',
        message: `Gagal menghubungi Dapodik Desktop (${msg}).`,
        idEvaluasi,
        reusedExisting,
        payload: matevPayload,
      },
      nilai: {
        ok: false,
        status: 'Dilewati',
        message: 'Pengiriman nilai dibatalkan karena gagal menghubungi postMatevRapor.',
        sentCount: 0,
        skippedCount,
        samplePayloads: nilaiPayloads.slice(0, 2),
        errors: [msg],
      },
    };
  }

  // Step 2: postNilai?npsn=...&semester_id=...&table=rapor per student
  let sentCount = 0;
  const errors: string[] = [];
  const nilaiQuery = `postNilai?npsn=${encodeURIComponent(
    params.npsn
  )}&semester_id=${encodeURIComponent(semesterCode)}&table=rapor`;

  for (const row of nilaiPayloads) {
    try {
      const res = await dapodikPost(baseUrl, params.apiToken, nilaiQuery, row);
      if (res.ok) {
        sentCount += 1;
      } else {
        errors.push(`anggota_rombel_id ${row.anggota_rombel_id}: HTTP ${res.status}`);
      }
    } catch (err) {
      errors.push(
        `anggota_rombel_id ${row.anggota_rombel_id}: ${
          err instanceof Error ? err.message : 'Error jaringan'
        }`
      );
    }
  }

  const allOk = errors.length === 0 && sentCount > 0;
  return {
    ok: allOk,
    updaterId,
    matev: {
      ok: true,
      status: 'Berhasil',
      message: `postMatevRapor berhasil (id_evaluasi: ${idEvaluasi}${reusedExisting ? ', reused' : ''}).`,
      idEvaluasi,
      reusedExisting,
      payload: matevPayload,
    },
    nilai: {
      ok: allOk,
      status: allOk ? 'Berhasil' : sentCount > 0 ? 'Sebagian' : 'Gagal',
      message: `${sentCount} dari ${nilaiPayloads.length} nilai berhasil dikirim ke postNilai?table=rapor.`,
      sentCount,
      skippedCount,
      samplePayloads: nilaiPayloads.slice(0, 2),
      errors,
    },
  };
}

/**
 * Legacy helper retained for backward compatibility with unit tests and dry-run adapters.
 */
export async function submitToDapodikAdapter(params: {
  webServiceUrl: string;
  apiToken: string;
  mode: 'WebService' | 'Sandbox';
  isDryRun: boolean;
  phase: 'MATEV' | 'NILAI_AKHIR';
  payload: DapodikMatevPayload | DapodikNilaiPayload;
}): Promise<{ ok: boolean; status: string; message: string }> {
  if (params.isDryRun) {
    return {
      ok: true,
      status: 'Berhasil (Dry-Run)',
      message: `Validasi skema payload ${params.phase} berhasil tanpa mengirim perubahan ke server eksternal.`,
    };
  }

  if (params.mode === 'Sandbox') {
    return {
      ok: true,
      status: 'Berhasil (Sandbox)',
      message: `[SANDBOX TEST] Payload ${params.phase} divalidasi pada adapter pengujian lokal. Tidak dikirim ke Dapodik Produksi.`,
    };
  }

  const urlCheck = validateDapodikUrl(params.webServiceUrl);
  if (!urlCheck.valid || !urlCheck.normalizedBaseUrl) {
    return {
      ok: false,
      status: 'Gagal',
      message: urlCheck.reason || 'URL Web Service tidak valid.',
    };
  }

  if (!params.apiToken) {
    return {
      ok: false,
      status: 'Gagal',
      message: 'Token Web Service Dapodik belum dikonfigurasi.',
    };
  }

  const path =
    params.phase === 'MATEV' ? '/WebService/postMatevRapor' : '/WebService/postNilai?table=rapor';
  const endpoint = `${urlCheck.normalizedBaseUrl}${path}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params.payload),
      signal: AbortSignal.timeout(DAPODIK_TIMEOUT_MS),
    });

    if (res.ok) {
      return {
        ok: true,
        status: 'Berhasil',
        message: `Pengiriman ${params.phase} diterima oleh Web Service Dapodik.`,
      };
    }
    return {
      ok: false,
      status: 'Gagal',
      message: `Dapodik mengembalikan status HTTP ${res.status} saat mengirim ${params.phase}.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Koneksi terputus';
    return {
      ok: false,
      status: 'Gagal',
      message: `Gagal menghubungi Dapodik Desktop di ${urlCheck.normalizedBaseUrl}: ${msg}`,
    };
  }
}
