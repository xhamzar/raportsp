import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import { schools } from '@/lib/server/db/schema';
import {
  canUseSchoolAiKey,
  generateEducationalDraft,
  resolveEffectiveAiCredentialsForUser,
} from '@/lib/server/services/ai-assistant';
import { logAudit, requireApiAuth } from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'ai', 'read');
  if ('error' in auth) return auth.error;

  const db = getDb();
  const [school] = await db.select().from(schools).limit(1);
  const credentials = await resolveEffectiveAiCredentialsForUser(auth.user);

  return NextResponse.json({
    enabledInSchool: school?.enableAi ?? true,
    apiConfigured: Boolean(credentials),
    activeSource: credentials?.source ?? null,
    activeModel: credentials?.model ?? null,
    canUseSchoolKey: canUseSchoolAiKey(auth.user),
  });
}

const aiPromptSchema = z.object({
  taskType: z.enum(['tp', 'rpm', 'deskripsi_capaian', 'remedial']),
  subjectName: z.string().trim().min(2),
  gradeLevel: z.number().int().min(1).max(12),
  fase: z.string().trim().min(1),
  topic: z.string().trim().min(2, 'Topik/lingkup materi wajib diisi.'),
  cpText: z.string().optional(),
  dimensions: z.array(z.string()).optional(),
  scoreBand: z.string().optional(),
});

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'ai', 'create');
  if ('error' in auth) return auth.error;

  const db = getDb();
  const [school] = await db.select().from(schools).limit(1);
  if (!school?.enableAi) {
    return NextResponse.json(
      { error: 'Asisten AI dinonaktifkan pada pengaturan sekolah.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = aiPromptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Parameter draf AI tidak valid.' },
      { status: 400 }
    );
  }

  const credentials = await resolveEffectiveAiCredentialsForUser(auth.user);
  if (!credentials) {
    const canUseSchool = canUseSchoolAiKey(auth.user);
    return NextResponse.json(
      {
        error: canUseSchool
          ? 'Belum ada Kunci API. Fitur "Generate" belum dapat digunakan sebelum Kunci API diisi di Pengaturan → Kunci API atau Akun Saya.'
          : 'Belum ada Kunci API pribadi. Silakan isi Kunci API pribadi Anda di Pengaturan → Akun Saya atau tab Kunci API.',
      },
      { status: 400 }
    );
  }

  try {
    const result = await generateEducationalDraft({
      ...parsed.data,
      credentials,
    });
    await logAudit({
      userId: auth.user.id,
      actorName: auth.user.fullName,
      action: 'GENERATE_AI_DRAFT',
      entityType: 'ai_assistant',
      details: `Membuat draf ${parsed.data.taskType} untuk ${parsed.data.subjectName} kelas ${parsed.data.gradeLevel} (${result.source} · ${result.model}).`,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menghubungi layanan AI.';
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
