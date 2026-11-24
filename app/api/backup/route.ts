import fs from 'node:fs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureSeeded } from '@/lib/server/db/seed';
import {
  createDatabaseBackup,
  listBackups,
  resolveSafeBackupFile,
  restoreDatabaseFromBackup,
} from '@/lib/server/services/backup-service';
import { hasUserPermission, logAudit, requireApiAuth } from '@/lib/server/auth/session';

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const downloadFile = searchParams.get('download');

  const auth = await requireApiAuth(req, 'backup', downloadFile ? 'export' : 'read');
  if ('error' in auth) return auth.error;

  if (downloadFile) {
    const safePath = resolveSafeBackupFile(downloadFile);
    if (!safePath) {
      return NextResponse.json({ error: 'Berkas cadangan tidak ditemukan.' }, { status: 404 });
    }
    const buf = fs.readFileSync(safePath);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${downloadFile.replace(/[^a-zA-Z0-9._-]/g, '')}"`,
      },
    });
  }

  const list = await listBackups();
  return NextResponse.json({ backups: list });
}

const backupActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    notes: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal('restore'),
    fileName: z.string().trim().min(5),
    confirmed: z.literal(true),
  }),
]);

export async function POST(req: NextRequest) {
  await ensureSeeded();
  const auth = await requireApiAuth(req, 'backup');
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = backupActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Permintaan cadangan/pemulihan database tidak valid.' },
      { status: 400 }
    );
  }

  if (parsed.data.action === 'create') {
    if (!hasUserPermission(auth.user, 'backup', 'create')) {
      return NextResponse.json(
        { error: 'Akses ditolak: Anda tidak memiliki izin membuat snapshot cadangan database.' },
        { status: 403 }
      );
    }
    const record = await createDatabaseBackup({
      userId: auth.user.id,
      notes: parsed.data.notes,
    });
    await logAudit({
      userId: auth.user.id,
      actorName: auth.user.fullName,
      action: 'CREATE_BACKUP',
      entityType: 'backup',
      entityId: record.id,
      details: `Membuat cadangan database ${record.fileName} (${record.sizeBytes} bytes).`,
    });
    return NextResponse.json({ ok: true, backup: record }, { status: 201 });
  }

  if (!hasUserPermission(auth.user, 'backup', 'approve')) {
    return NextResponse.json(
      { error: 'Akses ditolak: Anda tidak memiliki izin Setujui untuk memulihkan database.' },
      { status: 403 }
    );
  }

  const result = await restoreDatabaseFromBackup(parsed.data.fileName);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }
  await logAudit({
    userId: auth.user.id,
    actorName: auth.user.fullName,
    action: 'RESTORE_BACKUP',
    entityType: 'backup',
    details: result.message,
  });
  return NextResponse.json(result);
}
