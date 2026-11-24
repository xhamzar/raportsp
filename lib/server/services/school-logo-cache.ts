import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb } from '@/lib/server/db';
import { schools } from '@/lib/server/db/schema';

export interface CachedLogo {
  buffer: Buffer;
  contentType: string;
  cachedAt: number;
}

const LOGO_CACHE_TTL_MS = 60_000;
const globalCache = globalThis as unknown as {
  __sekolahkitaLogoCache?: CachedLogo | null;
};

export function invalidateSchoolLogoCache() {
  globalCache.__sekolahkitaLogoCache = null;
}

function detectContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/jpeg';
}

export async function getCachedSchoolLogo(): Promise<{ buffer: Buffer; contentType: string }> {
  const now = Date.now();
  const cached = globalCache.__sekolahkitaLogoCache;
  if (cached && now - cached.cachedAt < LOGO_CACHE_TTL_MS) {
    return { buffer: cached.buffer, contentType: cached.contentType };
  }

  let relativeLogo = '/images/school-crest.jpg';
  try {
    const db = getDb();
    const [school] = await db.select({ logoUrl: schools.logoUrl }).from(schools).limit(1);
    if (school?.logoUrl && school.logoUrl.startsWith('/images/')) {
      relativeLogo = school.logoUrl;
    }
  } catch {
    // Fallback to default crest
  }

  const publicDir = path.resolve(process.cwd(), 'public');
  const candidatePath = path.resolve(publicDir, relativeLogo.replace(/^\/+/, ''));
  const fallbackPath = path.resolve(publicDir, 'images/school-crest.jpg');

  const safePath = candidatePath.startsWith(publicDir + path.sep) ? candidatePath : fallbackPath;

  let buffer: Buffer;
  let finalPath = safePath;
  try {
    buffer = await fs.readFile(safePath);
  } catch {
    finalPath = fallbackPath;
    buffer = await fs.readFile(fallbackPath);
  }

  const contentType = detectContentType(finalPath);
  globalCache.__sekolahkitaLogoCache = {
    buffer,
    contentType,
    cachedAt: now,
  };

  return { buffer, contentType };
}
