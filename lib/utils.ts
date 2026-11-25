import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const INDO_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export function formatIndoDate(value?: string | null): string {
  if (!value) return '-';
  const trimmed = value.trim();
  if (!trimmed) return '-';
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(trimmed);
  if (!match) return trimmed;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!INDO_MONTHS[monthIdx] || !Number.isFinite(day) || day < 1 || day > 31) {
    return trimmed;
  }
  return `${day} ${INDO_MONTHS[monthIdx]} ${year}`;
}

export function formatIndoDateTime(value?: string | null): string {
  if (!value) return '-';
  const trimmed = value.trim();
  if (!trimmed) return '-';
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/.exec(trimmed);
  if (!match) return trimmed;
  const year = match[1];
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!INDO_MONTHS[monthIdx] || !Number.isFinite(day) || day < 1 || day > 31) {
    return trimmed;
  }
  const datePart = `${day} ${INDO_MONTHS[monthIdx]} ${year}`;
  if (match[4] && match[5]) {
    return `${datePart}, ${match[4]}:${match[5]}`;
  }
  return datePart;
}

export function formatIndoDateRange(startDate?: string | null, endDate?: string | null): string {
  if (!startDate && !endDate) return '-';
  if (!endDate || startDate === endDate) return formatIndoDate(startDate);
  if (!startDate) return formatIndoDate(endDate);
  return `${formatIndoDate(startDate)} s.d. ${formatIndoDate(endDate)}`;
}

export function formatIndoMonthYear(yyyyMm?: string | null): string {
  if (!yyyyMm || !/^\d{4}-\d{2}$/.test(yyyyMm)) return yyyyMm || 'Bulan Aktif';
  const [y, m] = yyyyMm.split('-');
  const monthIdx = Number(m) - 1;
  return `${INDO_MONTHS[monthIdx] || m} ${y}`;
}

export function formatIndoEndOfMonthDate(yyyyMm?: string | null): string {
  if (!yyyyMm || !/^\d{4}-\d{2}$/.test(yyyyMm)) return '';
  const [y, m] = yyyyMm.split('-');
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  return formatIndoDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
}

