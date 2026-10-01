import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PATTERN,
  DivisionCalendar,
  bulkSetHoliday,
  effectiveHours,
  holidaysInMonth,
  monthDates,
  monthLabel,
  setDateEntry,
  weekdayOf,
} from '../holidayCalendar';

const cal = (): DivisionCalendar => ({ pattern: DEFAULT_PATTERN.map((p) => ({ ...p })), dates: {} });
const TODAY = '2026-10-10';

describe('holiday calendar', () => {
  it('knows weekdays and month lengths without timezone drift', () => {
    expect(weekdayOf('2026-10-01')).toBe('Thursday');
    expect(weekdayOf('2026-10-04')).toBe('Sunday');
    expect(monthDates('2026-02')).toHaveLength(28);
    expect(monthDates('2028-02')).toHaveLength(29);
    expect(monthDates('2026-10')[30]).toBe('2026-10-31');
    expect(monthLabel('2026-09')).toBe('SEPTEMBER 2026');
  });

  it('computes effective hours: holiday → hours override → weekly pattern', () => {
    let c = cal();
    expect(effectiveHours('2026-10-05', c)).toEqual({ kind: 'open', label: '09:00–19:00' });
    expect(effectiveHours('2026-10-04', c)).toEqual({ kind: 'weekoff', label: 'Closed — Week Off' });
    c = setDateEntry(c, '2026-10-12', { open: '09:00', close: '14:00' }, TODAY);
    expect(effectiveHours('2026-10-12', c)).toEqual({ kind: 'override', label: '09:00–14:00 (override)' });
    c = setDateEntry(c, '2026-10-20', { isHoliday: true, name: 'Dussehra' }, TODAY);
    expect(effectiveHours('2026-10-20', c).label).toBe('Closed — Dussehra');
  });

  it('locks past dates and drops empty overrides', () => {
    const c = cal();
    expect(setDateEntry(c, '2026-10-09', { isHoliday: true }, TODAY)).toBe(c);
    const on = setDateEntry(c, '2026-10-15', { isHoliday: true, name: 'X' }, TODAY);
    const off = setDateEntry(on, '2026-10-15', { isHoliday: false, name: '' }, TODAY);
    expect(off.dates['2026-10-15']).toBeUndefined();
  });

  it('bulk-sets every chosen weekday in the month, skipping past dates and keeping names', () => {
    const named = setDateEntry(cal(), '2026-10-24', { name: 'Fourth Saturday' }, TODAY);
    const { calendar, count } = bulkSetHoliday(named, '2026-10', 'Saturday', 'Saturday holiday', TODAY);
    // Saturdays: 3, 10, 17, 24, 31 → 3 is past
    expect(count).toBe(4);
    expect(calendar.dates['2026-10-03']).toBeUndefined();
    expect(calendar.dates['2026-10-24']).toMatchObject({ isHoliday: true, name: 'Fourth Saturday' });
    expect(holidaysInMonth(calendar, '2026-10').map((d) => d.date)).toEqual(['2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31']);
  });
});
