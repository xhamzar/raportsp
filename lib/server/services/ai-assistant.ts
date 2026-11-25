import { inArray } from 'drizzle-orm';
import { getDb } from '@/lib/server/db';
import { aiConfigs } from '@/lib/server/db/schema';
import type { AuthenticatedUser } from '@/lib/server/auth/session';
import {
  DEFAULT_AI_MODEL,
  decryptApiKey,
  maskApiKey,
  resolveProviderEndpoint,
} from './ai-keys';

export interface AiConfigSummary {
  hasApiKey: boolean;
  maskedKey: string;
  model: string;
  baseUrl: string;
  updatedAt: string | null;
}

export interface ResolvedAiCredentials {
  source: 'personal' | 'school';
  apiKey: string;
  model: string;
  baseUrl: string;
}

export function canUseSchoolAiKey(user: AuthenticatedUser): boolean {
  return (
    user.roleCode === 'SUPER_ADMIN' ||
    user.roleCode === 'ADMIN_SEKOLAH' ||
    user.roleCode === 'KEPALA_SEKOLAH' ||
    user.permissions.includes('sekolah:update')
  );
}

export function formatConfigSummary(
  row:
    | {
        apiKeyEnc: string;
        model: string;
        baseUrl: string;
        updatedAt: string;
      }
    | undefined
): AiConfigSummary {
  if (!row) {
    return {
      hasApiKey: false,
      maskedKey: '',
      model: DEFAULT_AI_MODEL,
      baseUrl: '',
      updatedAt: null,
    };
  }
  const decrypted = decryptApiKey(row.apiKeyEnc);
  return {
    hasApiKey: Boolean(decrypted),
    maskedKey: decrypted ? maskApiKey(decrypted) : '',
    model: row.model || DEFAULT_AI_MODEL,
    baseUrl: row.baseUrl || '',
    updatedAt: row.updatedAt || null,
  };
}

export async function getUserAndSchoolAiConfigs(user: AuthenticatedUser): Promise<{
  personal: AiConfigSummary;
  school?: AiConfigSummary;
  canManageSchoolKey: boolean;
  canReadSchoolKey: boolean;
  canUseSchoolKey: boolean;
  effectiveConfigured: boolean;
  effectiveSource: 'personal' | 'school' | null;
  effectiveModel: string | null;
}> {
  const canReadSchoolKey = user.permissions.includes('sekolah:read');
  const canManageSchoolKey = user.permissions.includes('sekolah:update');
  const schoolEligible = canUseSchoolAiKey(user);

  const db = getDb();
  const ownerKeys = [`user:${user.id}`];
  if (canReadSchoolKey || canManageSchoolKey || schoolEligible) {
    ownerKeys.push('school');
  }

  const rows = await db
    .select()
    .from(aiConfigs)
    .where(inArray(aiConfigs.ownerKey, ownerKeys));

  const byKey = new Map(rows.map((r) => [r.ownerKey, r]));
  const personal = formatConfigSummary(byKey.get(`user:${user.id}`));
  const schoolSummary =
    canReadSchoolKey || canManageSchoolKey ? formatConfigSummary(byKey.get('school')) : undefined;
  const schoolInternalSummary = schoolEligible
    ? formatConfigSummary(byKey.get('school'))
    : undefined;

  let effectiveSource: 'personal' | 'school' | null = null;
  let effectiveModel: string | null = null;

  if (personal.hasApiKey) {
    effectiveSource = 'personal';
    effectiveModel = personal.model;
  } else if (schoolEligible && schoolInternalSummary?.hasApiKey) {
    effectiveSource = 'school';
    effectiveModel = schoolInternalSummary.model;
  }

  return {
    personal,
    ...(schoolSummary ? { school: schoolSummary } : {}),
    canManageSchoolKey,
    canReadSchoolKey,
    canUseSchoolKey: schoolEligible,
    effectiveConfigured: Boolean(effectiveSource),
    effectiveSource,
    effectiveModel,
  };
}

export async function resolveEffectiveAiCredentialsForUser(
  user: AuthenticatedUser
): Promise<ResolvedAiCredentials | null> {
  const db = getDb();
  const schoolEligible = canUseSchoolAiKey(user);
  const ownerKeys = schoolEligible ? [`user:${user.id}`, 'school'] : [`user:${user.id}`];

  const rows = await db
    .select()
    .from(aiConfigs)
    .where(inArray(aiConfigs.ownerKey, ownerKeys));

  const byKey = new Map(rows.map((r) => [r.ownerKey, r]));
  const personalRow = byKey.get(`user:${user.id}`);
  if (personalRow) {
    const personalKey = decryptApiKey(personalRow.apiKeyEnc);
    if (personalKey) {
      return {
        source: 'personal',
        apiKey: personalKey,
        model: personalRow.model || DEFAULT_AI_MODEL,
        baseUrl: personalRow.baseUrl || '',
      };
    }
  }

  if (schoolEligible) {
    const schoolRow = byKey.get('school');
    if (schoolRow) {
      const schoolKey = decryptApiKey(schoolRow.apiKeyEnc);
      if (schoolKey) {
        return {
          source: 'school',
          apiKey: schoolKey,
          model: schoolRow.model || DEFAULT_AI_MODEL,
          baseUrl: schoolRow.baseUrl || '',
        };
      }
    }
  }

  return null;
}

function extractErrorMessage(payload: unknown, fallbackStatus: number): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (record.error && typeof record.error === 'object') {
      const errObj = record.error as Record<string, unknown>;
      if (typeof errObj.message === 'string' && errObj.message.trim()) {
        return errObj.message.trim();
      }
    }
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error.trim();
    }
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim();
    }
  }
  return `Penyedia AI mengembalikan status HTTP ${fallbackStatus}. Periksa Kunci API, Model, atau Base URL Anda.`;
}

function extractOpenAiContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: unknown }).text || '');
        }
        return '';
      })
      .join('')
      .trim();
  }
  return '';
}

function extractGeminiContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = (
    payload as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    }
  ).candidates;
  const parts = candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim();
}

export async function generateEducationalDraft(params: {
  taskType: 'tp' | 'rpm' | 'deskripsi_capaian' | 'remedial';
  subjectName: string;
  gradeLevel: number;
  fase: string;
  topic: string;
  cpText?: string;
  dimensions?: string[];
  scoreBand?: string;
  credentials: ResolvedAiCredentials;
}): Promise<{ text: string; model: string; providerMode: string; source: 'personal' | 'school' }> {
  const { mode, endpointUrl, model } = resolveProviderEndpoint({
    model: params.credentials.model,
    baseUrl: params.credentials.baseUrl,
  });

  const systemInstruction =
    'Anda adalah asisten pedagogis Kurikulum Merdeka Indonesia untuk jenjang Sekolah Dasar (SD/MI). Selalu gunakan Bahasa Indonesia baku yang komunikatif, jelas, dan siap disunting oleh guru. Jangan menyertakan data pribadi murid.';

  let prompt = '';
  if (params.taskType === 'tp') {
    prompt = `Susun 3 draf Tujuan Pembelajaran (TP) dan indikator ketercapaian untuk mata pelajaran ${params.subjectName} Kelas ${params.gradeLevel} (Fase ${params.fase}) dengan lingkup materi "${params.topic}". ${params.cpText ? `Acuan CP: ${params.cpText}` : ''}`;
  } else if (params.taskType === 'rpm') {
    prompt = `Buat draf Rencana Pembelajaran Mendalam (RPM) ringkas dan terstruktur untuk mata pelajaran ${params.subjectName} Kelas ${params.gradeLevel} (Fase ${params.fase}), topik "${params.topic}". Dimensi Profil Lulusan: ${(params.dimensions || ['Penalaran Kritis', 'Kolaborasi']).join(', ')}. Susun menjadi bagian: 1) Identifikasi, 2) Desain Pembelajaran, 3) Pengalaman Belajar (Memahami, Mengaplikasi, Merefleksi), dan 4) Asesmen Pembelajaran.`;
  } else if (params.taskType === 'remedial') {
    prompt = `Berikan saran strategi pembelajaran remedial dan pengayaan singkat untuk topik "${params.topic}" pada mata pelajaran ${params.subjectName} Kelas ${params.gradeLevel} (Fase ${params.fase}).`;
  } else {
    prompt = `Susun 2 variasi draf kalimat deskripsi capaian kompetensi rapor Kurikulum Merdeka (tanpa menyebut nama asli murid, gunakan kata "Ananda") untuk mata pelajaran ${params.subjectName} Kelas ${params.gradeLevel} topik "${params.topic}" dengan kategori capaian "${params.scoreBand || 'Baik'}".`;
  }

  let res: Response;
  try {
    if (mode === 'gemini-native') {
      res = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': params.credentials.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
          },
        }),
        signal: AbortSignal.timeout(45_000),
      });
    } else {
      res = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.credentials.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt },
          ],
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(45_000),
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Koneksi gagal';
    throw new Error(`Gagal menghubungi endpoint AI (${msg}). Periksa Base URL dan koneksi jaringan.`);
  }

  const rawBody = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(extractErrorMessage(rawBody, res.status));
  }

  const text =
    mode === 'gemini-native' ? extractGeminiContent(rawBody) : extractOpenAiContent(rawBody);

  if (!text) {
    throw new Error('Model AI tidak mengembalikan teks draf. Silakan coba kembali.');
  }

  return {
    text,
    model,
    providerMode: mode,
    source: params.credentials.source,
  };
}
