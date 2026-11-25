import crypto from 'node:crypto';
import net from 'node:net';
import { getServerSecret } from '@/lib/server/auth/password';

export const DEFAULT_AI_MODEL = 'gemini-2.5-flash';

function getEncryptionKey(): Buffer {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET || getServerSecret();
  return crypto
    .createHmac('sha256', secret)
    .update('sekolahkita-ai-key-aes256gcm-v1')
    .digest();
}

export function encryptApiKey(plainKey: string): string {
  const trimmed = plainKey.trim();
  if (!trimmed) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptApiKey(stored: string | null | undefined): string | null {
  if (!stored || !stored.startsWith('v1:')) return null;
  const parts = stored.split(':');
  if (parts.length !== 4) return null;
  const [, ivHex, tagHex, cipherHex] = parts;
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(cipherHex, 'hex');
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return decrypted.trim() || null;
  } catch {
    return null;
  }
}

export function maskApiKey(plainKey: string | null | undefined): string {
  const trimmed = (plainKey || '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) {
    return `••••${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

function isPrivateOrBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isBlockedHost(rawHostname: string): boolean {
  const hostname = rawHostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) return true;

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal'
  ) {
    return true;
  }

  const ipType = net.isIP(hostname);
  if (ipType === 4) {
    return isPrivateOrBlockedIpv4(hostname);
  }
  if (ipType === 6) {
    if (hostname === '::1' || hostname === '::') return true;
    if (hostname.startsWith('fe80:') || hostname.startsWith('fc') || hostname.startsWith('fd')) {
      return true;
    }
    if (hostname.startsWith('::ffff:')) {
      const mapped = hostname.slice(7);
      if (net.isIPv4(mapped)) return isPrivateOrBlockedIpv4(mapped);
      return true;
    }
    return false;
  }

  // Block single-label internal service hostnames (e.g. "redis", "metadata", "db")
  if (!hostname.includes('.')) {
    return true;
  }

  return false;
}

export function validateAiBaseUrl(
  rawUrl: string | null | undefined
): { valid: true; normalized: string } | { valid: false; error: string } {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { valid: true, normalized: '' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      error: 'Format Base URL tidak valid. Contoh: https://generativelanguage.googleapis.com',
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: 'Base URL wajib menggunakan protokol HTTPS (https://).',
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: 'Base URL tidak boleh menyertakan kredensial di dalam URL.',
    };
  }

  if (parsed.search || parsed.hash) {
    return {
      valid: false,
      error: 'Base URL tidak boleh menyertakan parameter query atau fragment.',
    };
  }

  if (isBlockedHost(parsed.hostname)) {
    return {
      valid: false,
      error: 'Alamat host lokal atau jaringan privat tidak diizinkan pada Base URL.',
    };
  }

  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  const normalized = cleanPath ? `${parsed.origin}${cleanPath}` : parsed.origin;
  return { valid: true, normalized };
}

export type AiProviderMode = 'gemini-native' | 'openai-compat';

export function resolveProviderEndpoint(params: {
  model?: string | null;
  baseUrl?: string | null;
}): { mode: AiProviderMode; endpointUrl: string; model: string } {
  const model = (params.model || '').trim() || DEFAULT_AI_MODEL;
  const urlCheck = validateAiBaseUrl(params.baseUrl);
  if (!urlCheck.valid) {
    throw new Error(urlCheck.error);
  }

  const normalized = urlCheck.normalized;
  if (!normalized) {
    return {
      mode: 'gemini-native',
      endpointUrl: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent`,
      model,
    };
  }

  const parsed = new URL(normalized);
  const host = parsed.hostname.toLowerCase();
  const pathLower = parsed.pathname.toLowerCase();

  if (host === 'generativelanguage.googleapis.com' && !pathLower.includes('/openai')) {
    if (pathLower.includes(':generatecontent')) {
      return { mode: 'gemini-native', endpointUrl: normalized, model };
    }
    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    if (!cleanPath) {
      return {
        mode: 'gemini-native',
        endpointUrl: `${parsed.origin}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        model,
      };
    }
    return {
      mode: 'gemini-native',
      endpointUrl: `${normalized}/models/${encodeURIComponent(model)}:generateContent`,
      model,
    };
  }

  if (pathLower.endsWith('/chat/completions')) {
    return { mode: 'openai-compat', endpointUrl: normalized, model };
  }

  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  if (!cleanPath) {
    return {
      mode: 'openai-compat',
      endpointUrl: `${parsed.origin}/v1/chat/completions`,
      model,
    };
  }

  return {
    mode: 'openai-compat',
    endpointUrl: `${normalized}/chat/completions`,
    model,
  };
}
