/**
 * Parses app timestamps like "2026-09-30 14:45:20" as local time.
 * `new Date("YYYY-MM-DD HH:MM:SS")` is not ISO and yields Invalid Date in Safari.
 */
export function parseDateTime(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(value.trim());
  if (!m) return new Date(value);
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
}
