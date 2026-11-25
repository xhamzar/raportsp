import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/server/db/seed';
import { getDb } from '@/lib/server/db';
import { aiConfigs } from '@/lib/server/db/schema';
import { hasUserPermission, logAudit, requireApiAuth } from '@/lib/server/auth/session';
import { getUserAndSchoolAiConfigs } from '@/lib/server/services/ai-assistant';
import {
  DEFAULT_AI_MODEL,
  decryptApiKey,
  encryptApiKey,
  validateAiBaseUrl,
} from '@/lib/server/services/ai-keys';

const upsertSchema = z.object({
  scope: z.enum(['personal', 'school']),
  apiKey: z.string().trim().max(500).optional().default(''),
  model: z.string().trim().min(1, 'Nama model wajib diisi.').max(120),
  baseUrl: z.string().trim().max(300).optional().default(''),
});

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req);
  if ('error' in auth) return auth.error;

  const summary = await getUserAndSchoolAiConfigs(auth.user);
  return NextResponse.json(summary);
}

export async function PUT(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req);
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Data konfigurasi Kunci API tidak valid.' },
      { status: 400 }
    );
  }

  const { scope, apiKey, model, baseUrl } = parsed.data;
  if (scope === 'school' && !hasUserPermission(auth.user, 'sekolah', 'update')) {
    return NextResponse.json(
      { error: 'Akses ditolak: hanya Admin atau Kepala Sekolah yang dapat mengubah Kunci API sekolah.' },
      { status: 403 }
    );
  }

  const urlCheck = validateAiBaseUrl(baseUrl);
  if (!urlCheck.valid) {
    return NextResponse.json({ error: urlCheck.error }, { status: 400 });
  }

  const ownerKey = scope === 'school' ? 'school' : `user:${auth.user.id}`;
  const db = getDb();
  const [existing] = await db
    .select()
    .from(aiConfigs)
    .where(eq(aiConfigs.ownerKey, ownerKey))
    .limit(1);

  let nextApiKeyEnc = '';
  if (apiKey) {
    nextApiKeyEnc = encryptApiKey(apiKey);
  } else if (existing?.apiKeyEnc && decryptApiKey(existing.apiKeyEnc)) {
    nextApiKeyEnc = existing.apiKeyEnc;
  } else {
    return NextResponse.json(
      { error: 'Masukkan Kunci API terlebih dahulu.' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const cleanModel = model.trim() || DEFAULT_AI_MODEL;

  if (existing) {
    await db
      .update(aiConfigs)
      .set({
        apiKeyEnc: nextApiKeyEnc,
        model: cleanModel,
        baseUrl: urlCheck.normalized,
        updatedAt: now,
      })
      .where(eq(aiConfigs.ownerKey, ownerKey));
  } else {
    await db.insert(aiConfigs).values({
      ownerKey,
      scope: scope === 'school' ? 'school' : 'user',
      userId: scope === 'school' ? null : auth.user.id,
      apiKeyEnc: nextApiKeyEnc,
      model: cleanModel,
      baseUrl: urlCheck.normalized,
      updatedAt: now,
    });
  }

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'UPDATE_AI_API_CONFIG',
    entityType: 'ai_config',
    entityId: ownerKey,
    details: `Menyimpan konfigurasi Kunci API ${scope === 'school' ? 'sekolah' : 'pribadi'} (model: ${cleanModel}).`,
  });

  const summary = await getUserAndSchoolAiConfigs(auth.user);
  return NextResponse.json({
    ok: true,
    message:
      scope === 'school'
        ? 'Kunci API sekolah berhasil disimpan.'
        : 'Kunci API pribadi Anda berhasil disimpan.',
    ...summary,
  });
}

export async function DELETE(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req);
  if ('error' in auth) return auth.error;

  const scopeParam = req.nextUrl.searchParams.get('scope');
  if (scopeParam !== 'personal' && scopeParam !== 'school') {
    return NextResponse.json({ error: 'Parameter scope tidak valid.' }, { status: 400 });
  }

  if (scopeParam === 'school' && !hasUserPermission(auth.user, 'sekolah', 'update')) {
    return NextResponse.json(
      { error: 'Akses ditolak: hanya Admin atau Kepala Sekolah yang dapat menghapus Kunci API sekolah.' },
      { status: 403 }
    );
  }

  const ownerKey = scopeParam === 'school' ? 'school' : `user:${auth.user.id}`;
  const db = getDb();
  await db.delete(aiConfigs).where(eq(aiConfigs.ownerKey, ownerKey));

  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'DELETE_AI_API_CONFIG',
    entityType: 'ai_config',
    entityId: ownerKey,
    details: `Menghapus Kunci API ${scopeParam === 'school' ? 'sekolah' : 'pribadi'}.`,
  });

  const summary = await getUserAndSchoolAiConfigs(auth.user);
  return NextResponse.json({
    ok: true,
    message:
      scopeParam === 'school'
        ? 'Kunci API sekolah berhasil dihapus.'
        : 'Kunci API pribadi Anda berhasil dihapus.',
    ...summary,
  });
}
