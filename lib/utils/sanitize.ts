const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

export function escHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(/[&<>"'`]/g, (ch) => HTML_ESCAPE_MAP[ch] || ch);
}

/**
 * Mengubah teks menjadi huruf kapital SEBELUM melakukan HTML-escaping
 * agar entitas HTML seperti `&amp;` tidak berubah menjadi `&AMP;`.
 */
export function formatUpperSafe(input: unknown): string {
  if (input === null || input === undefined) return '';
  return escHtml(String(input).toUpperCase());
}

export function sanitizeFilename(name: string, fallback = 'berkas'): string {
  const baseName = String(name || '').split(/[\\/]/).pop() || '';
  const cleaned = baseName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^[._]+|[._]+$/g, '');
  return cleaned.slice(0, 100) || fallback;
}
