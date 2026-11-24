import fs from 'node:fs';
import path from 'node:path';
import { getDbPath } from '@/lib/server/db';

export const MAX_STUDENT_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB

export type DetectedImageFormat = {
  ext: 'jpg' | 'png' | 'webp';
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
};

export function getStudentPhotoUploadDir(): string {
  return path.resolve(path.dirname(getDbPath()), 'uploads', 'students');
}

export function detectImageFormat(buffer: Buffer): DetectedImageFormat | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: 'png', contentType: 'image/png' };
  }

  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', contentType: 'image/webp' };
  }

  return null;
}

export function resolveStoredStudentPhotoPath(photoPath: string | null | undefined): string | null {
  if (!photoPath || typeof photoPath !== 'string') return null;
  const trimmed = photoPath.trim();
  if (!trimmed) return null;

  const baseName = path.basename(trimmed);
  if (baseName !== trimmed || baseName === '.' || baseName === '..') {
    return null;
  }

  const baseDir = getStudentPhotoUploadDir();
  const resolved = path.resolve(baseDir, baseName);
  if (!resolved.startsWith(baseDir + path.sep)) {
    return null;
  }

  return resolved;
}

export function saveStudentPhotoFile(
  studentId: number,
  buffer: Buffer,
  previousPhotoPath?: string | null
): { fileName: string; contentType: string } {
  if (!Number.isInteger(studentId) || studentId <= 0) {
    throw new Error('ID murid tidak valid.');
  }
  if (buffer.byteLength === 0) {
    throw new Error('Berkas foto kosong.');
  }
  if (buffer.byteLength > MAX_STUDENT_PHOTO_BYTES) {
    throw new Error('Ukuran foto melebihi batas maksimum 2 MB.');
  }

  const detected = detectImageFormat(buffer);
  if (!detected) {
    throw new Error('Format gambar tidak valid. Gunakan file JPG, PNG, atau WebP.');
  }

  const uploadDir = getStudentPhotoUploadDir();
  fs.mkdirSync(uploadDir, { recursive: true });

  const fileName = `${studentId}-${Date.now()}.${detected.ext}`;
  const targetPath = path.resolve(uploadDir, fileName);
  if (!targetPath.startsWith(uploadDir + path.sep)) {
    throw new Error('Jalur berkas unggahan tidak valid.');
  }

  fs.writeFileSync(targetPath, buffer);

  if (previousPhotoPath && previousPhotoPath !== fileName) {
    deleteStudentPhotoFile(previousPhotoPath);
  }

  return { fileName, contentType: detected.contentType };
}

export function readStudentPhotoFile(
  photoPath: string | null | undefined
): { buffer: Buffer; contentType: string } | null {
  const resolved = resolveStoredStudentPhotoPath(photoPath);
  if (!resolved || !fs.existsSync(resolved)) {
    return null;
  }

  const buffer = fs.readFileSync(resolved);
  const detected = detectImageFormat(buffer);
  if (!detected) return null;

  return { buffer, contentType: detected.contentType };
}

export function deleteStudentPhotoFile(photoPath: string | null | undefined): boolean {
  const resolved = resolveStoredStudentPhotoPath(photoPath);
  if (!resolved || !fs.existsSync(resolved)) {
    return false;
  }

  fs.unlinkSync(resolved);
  return true;
}
