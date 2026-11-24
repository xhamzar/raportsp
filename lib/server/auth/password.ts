import crypto from 'node:crypto';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  const secret = process.env.SESSION_SECRET || getRuntimeFallbackSecret();
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

const globalForSecret = globalThis as unknown as { __runtimeSessionSecret?: string };

function getRuntimeFallbackSecret(): string {
  if (!globalForSecret.__runtimeSessionSecret) {
    globalForSecret.__runtimeSessionSecret = crypto.randomBytes(32).toString('hex');
  }
  return globalForSecret.__runtimeSessionSecret;
}
