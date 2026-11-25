import fs from 'node:fs';
import path from 'node:path';
import { getDbPath } from '@/lib/server/db';
import { detectImageFormat } from '@/lib/server/services/student-photo';

export const MAX_SCHOOL_ASSET_BYTES = 2 * 1024 * 1024; // 2 MB

export type SchoolAssetType = 'signature' | 'stamp';

export function getSchoolAssetUploadDir(): string {
  return path.resolve(path.dirname(getDbPath()), 'uploads', 'school');
}

export function resolveSchoolAssetPath(fileName: string | null | undefined): string | null {
  if (!fileName || typeof fileName !== 'string') return null;
  const trimmed = fileName.trim();
  if (!trimmed) return null;

  const baseName = path.basename(trimmed);
  if (baseName !== trimmed || baseName === '.' || baseName === '..') {
    return null;
  }

  const baseDir = getSchoolAssetUploadDir();
  const resolved = path.resolve(baseDir, baseName);
  if (!resolved.startsWith(baseDir + path.sep)) {
    return null;
  }

  return resolved;
}

export function saveSchoolAssetFile(
  assetType: SchoolAssetType,
  buffer: Buffer,
  previousPath?: string | null
): { fileName: string; contentType: string } {
  if (assetType !== 'signature' && assetType !== 'stamp') {
    throw new Error('Jenis aset sekolah tidak valid.');
  }
  if (buffer.byteLength === 0) {
    throw new Error('Berkas gambar kosong.');
  }
  if (buffer.byteLength > MAX_SCHOOL_ASSET_BYTES) {
    throw new Error('Ukuran gambar melebihi batas maksimum 2 MB.');
  }

  const detected = detectImageFormat(buffer);
  if (!detected) {
    throw new Error('Format gambar tidak valid. Gunakan file PNG, JPG, atau WebP.');
  }

  const uploadDir = getSchoolAssetUploadDir();
  fs.mkdirSync(uploadDir, { recursive: true });

  const fileName = `${assetType}-${Date.now()}.${detected.ext}`;
  const targetPath = path.resolve(uploadDir, fileName);
  if (!targetPath.startsWith(uploadDir + path.sep)) {
    throw new Error('Jalur berkas unggahan tidak valid.');
  }

  fs.writeFileSync(targetPath, buffer);

  if (previousPath && previousPath !== fileName) {
    deleteSchoolAssetFile(previousPath);
  }

  return { fileName, contentType: detected.contentType };
}

export function readSchoolAssetFile(
  fileName: string | null | undefined
): { buffer: Buffer; contentType: string } | null {
  const resolved = resolveSchoolAssetPath(fileName);
  if (!resolved || !fs.existsSync(resolved)) {
    return null;
  }

  const buffer = fs.readFileSync(resolved);
  const detected = detectImageFormat(buffer);
  if (!detected) return null;

  return { buffer, contentType: detected.contentType };
}

export function deleteSchoolAssetFile(fileName: string | null | undefined): boolean {
  const resolved = resolveSchoolAssetPath(fileName);
  if (!resolved || !fs.existsSync(resolved)) {
    return false;
  }

  fs.unlinkSync(resolved);
  return true;
}
