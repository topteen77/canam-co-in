/**
 * Indian Standard Time (IST) - Asia/Kolkata (UTC+5:30)
 * Use these helpers for consistent time/date display across the app.
 */
export const TIMEZONE_IST = 'Asia/Kolkata';

const defaultTimeOpts: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIMEZONE_IST,
};

const defaultDateOpts: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TIMEZONE_IST,
};

/**
 * Format a date/time value as time string in Indian Standard Time (e.g. "10:30 AM")
 * Strings without timezone (e.g. SQL "YYYY-MM-DD HH:mm:ss") are treated as UTC.
 */
export function formatTimeIST(
  value: string | number | Date | undefined | null,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (value == null || value === '') return '–';
  const date = typeof value === 'object' && value instanceof Date
    ? value
    : parseToDate(value as string | number);
  if (isNaN(date.getTime())) return '–';
  return date.toLocaleTimeString('en-IN', { ...defaultTimeOpts, ...options });
}

/**
 * Format a date/time value as date string in Indian Standard Time (e.g. "31 Jan 2025")
 * Strings without timezone are treated as UTC.
 */
export function formatDateIST(
  value: string | number | Date | undefined | null,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (value == null || value === '') return '–';
  const date = typeof value === 'object' && value instanceof Date
    ? value
    : parseToDate(value as string | number);
  if (isNaN(date.getTime())) return '–';
  return date.toLocaleDateString('en-IN', { ...defaultDateOpts, ...options });
}

/**
 * Format as full date and time in Indian Standard Time (e.g. "31 Jan 2025, 10:30 AM")
 * Strings without timezone are treated as UTC.
 */
export function formatDateTimeIST(
  value: string | number | Date | undefined | null,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (value == null || value === '') return '–';
  const date = typeof value === 'object' && value instanceof Date
    ? value
    : parseToDate(value as string | number);
  if (isNaN(date.getTime())) return '–';
  return date.toLocaleString('en-IN', {
    ...defaultDateOpts,
    ...defaultTimeOpts,
    ...options,
  });
}

/**
 * Parse a value that might be SQL datetime ("YYYY-MM-DD HH:mm:ss") or ISO string into a Date.
 * Assumes stored values are UTC; use with formatTimeIST/formatDateIST for IST display.
 */
export function parseToDate(value: string | number | Date | undefined | null): Date {
  if (value == null || value === '') return new Date(NaN);
  if (typeof value === 'object' && value instanceof Date) return value;
  let s = String(value).trim();
  if (!s) return new Date(NaN);
  if (s.indexOf('T') === -1) s = s.replace(' ', 'T');
  if (!s.endsWith('Z') && s.indexOf('+') === -1 && s.length >= 19) s = s.slice(0, 19) + 'Z';
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(NaN) : d;
}
