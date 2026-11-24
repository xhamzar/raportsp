import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDb, getDbPath, getSqlite, resetDbConnection } from '@/lib/server/db';
import { backups } from '@/lib/server/db/schema';
import { desc } from 'drizzle-orm';

export function getBackupDir(): string {
  const dir = path.resolve(process.cwd(), './data/backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function createDatabaseBackup(params: {
  userId: number | null;
  notes?: string;
}) {
  const sqlite = getSqlite();
  const backupDir = getBackupDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `sekolahkita-backup-${stamp}.db`;
  const targetPath = path.join(backupDir, fileName);

  await sqlite.backup(targetPath);

  const fileBuf = fs.readFileSync(targetPath);
  const checksum = crypto.createHash('sha256').update(fileBuf).digest('hex');
  const sizeBytes = fileBuf.length;

  const db = getDb();
  const [record] = await db
    .insert(backups)
    .values({
      fileName,
      sizeBytes,
      checksum,
      notes: params.notes || 'Cadangan manual database SQLite',
      createdByUserId: params.userId,
      createdAt: new Date().toISOString(),
    })
    .returning();

  return record;
}

export async function listBackups() {
  const db = getDb();
  return db.select().from(backups).orderBy(desc(backups.createdAt));
}

export function resolveSafeBackupFile(fileName: string): string | null {
  const backupDir = getBackupDir();
  const cleanName = path.basename(fileName);
  const resolved = path.resolve(backupDir, cleanName);
  if (!resolved.startsWith(backupDir + path.sep)) return null;
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}

export async function restoreDatabaseFromBackup(fileName: string): Promise<{ ok: boolean; message: string }> {
  const sourcePath = resolveSafeBackupFile(fileName);
  if (!sourcePath) {
    return { ok: false, message: 'Berkas cadangan tidak ditemukan atau tidak valid.' };
  }

  // Validate SQLite header magic bytes ("SQLite format 3\0")
  const headerBuf = Buffer.alloc(16);
  const fd = fs.openSync(sourcePath, 'r');
  fs.readSync(fd, headerBuf, 0, 16, 0);
  fs.closeSync(fd);
  if (!headerBuf.toString('utf8', 0, 15).startsWith('SQLite format 3')) {
    return { ok: false, message: 'Berkas bukan format SQLite yang valid.' };
  }

  const dbPath = getDbPath();
  resetDbConnection();
  fs.copyFileSync(sourcePath, dbPath);
  // Remove stale WAL/SHM if present
  for (const suffix of ['-wal', '-shm']) {
    if (fs.existsSync(dbPath + suffix)) {
      fs.unlinkSync(dbPath + suffix);
    }
  }
  getSqlite(); // Re-open cleanly
  return { ok: true, message: `Database berhasil dipulihkan dari ${path.basename(sourcePath)}.` };
}
