/**
 * Non-operational hours & holiday calendar rules (pure functions).
 *
 *  - Each division has a weekly operating pattern (open/close or Week Off per weekday).
 *  - A specific date can override it: mark it a holiday (with a name/remark) or set its own hours.
 *  - Effective hours for a date = date override → weekly pattern.
 *  - Past dates are locked.
 */

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface DayPattern {
  day: Weekday;
  isWeekOff: boolean;
  open: string;
  close: string;
}

export interface DateEntry {
  date: string; // YYYY-MM-DD
  isHoliday: boolean;
  name: string;
  remark: string;
  /** Hours override for a working day (e.g. a half day). */
  open?: string;
  close?: string;
}

export interface DivisionCalendar {
  pattern: DayPattern[];
  dates: Record<string, DateEntry>;
}

export type EffectiveKind = 'open' | 'weekoff' | 'holiday' | 'override';
export interface EffectiveHours {
  kind: EffectiveKind;
  label: string;
}

export const DEFAULT_PATTERN: DayPattern[] = WEEKDAYS.map((day) => ({
  day,
  isWeekOff: day === 'Sunday',
  open: '09:00',
  close: '19:00',
}));

const pad = (n: number) => String(n).padStart(2, '0');
export const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Parses YYYY-MM-DD as a local calendar date (no timezone shift). */
const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function weekdayOf(iso: string): Weekday {
  // getDay(): 0 = Sunday … 6 = Saturday
  return WEEKDAYS[(parse(iso).getDay() + 6) % 7];
}

/** Every date of a month given as YYYY-MM. */
export function monthDates(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return [];
  const days = new Date(y, m, 0).getDate();
  return Array.from({ length: days }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`);
}

export const isPast = (iso: string, today: string) => iso < today;

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
}

export function effectiveHours(iso: string, cal: DivisionCalendar): EffectiveHours {
  const entry = cal.dates[iso];
  if (entry?.isHoliday) return { kind: 'holiday', label: `Closed — ${entry.name || 'Holiday'}` };
  if (entry?.open && entry?.close) return { kind: 'override', label: `${entry.open}–${entry.close} (override)` };
  const p = cal.pattern.find((d) => d.day === weekdayOf(iso));
  if (!p || p.isWeekOff) return { kind: 'weekoff', label: 'Closed — Week Off' };
  return { kind: 'open', label: `${p.open}–${p.close}` };
}

const isEmpty = (e: DateEntry) => !e.isHoliday && !e.name.trim() && !e.remark.trim() && !e.open && !e.close;

/** Updates one date (past dates are locked). Clearing every field removes the override. */
export function setDateEntry(cal: DivisionCalendar, iso: string, patch: Partial<DateEntry>, today: string): DivisionCalendar {
  if (isPast(iso, today)) return cal;
  const current: DateEntry = cal.dates[iso] ?? { date: iso, isHoliday: false, name: '', remark: '' };
  const next = { ...current, ...patch, date: iso };
  const dates = { ...cal.dates };
  if (isEmpty(next)) delete dates[iso];
  else dates[iso] = next;
  return { ...cal, dates };
}

/** "Bulk set to holiday: every <weekday> in the loaded month" — skips past dates. */
export function bulkSetHoliday(
  cal: DivisionCalendar,
  month: string,
  weekday: Weekday,
  name: string,
  today: string
): { calendar: DivisionCalendar; count: number } {
  let calendar = cal;
  let count = 0;
  for (const iso of monthDates(month)) {
    if (weekdayOf(iso) !== weekday || isPast(iso, today)) continue;
    const entry = calendar.dates[iso];
    calendar = setDateEntry(calendar, iso, { isHoliday: true, name: entry?.name || name }, today);
    count++;
  }
  return { calendar, count };
}

export function holidaysInMonth(cal: DivisionCalendar, month: string): DateEntry[] {
  return Object.values(cal.dates)
    .filter((e) => e.isHoliday && e.date.startsWith(`${month}-`))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}
