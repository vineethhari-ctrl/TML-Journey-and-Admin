import { describe, it, expect } from 'vitest';
import { parseDateTime } from '../dateUtil';

describe('parseDateTime', () => {
  it('parses "YYYY-MM-DD HH:MM:SS" as local time', () => {
    const d = parseDateTime('2026-09-30 14:45:20');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([
      2026, 8, 30, 14, 45, 20,
    ]);
  });

  it('parses a date-only string as local midnight (not UTC)', () => {
    const d = parseDateTime('2026-09-30');
    expect(d.getDate()).toBe(30);
    expect(d.getHours()).toBe(0);
  });

  it('sorts app timestamps chronologically', () => {
    const ts = ['2026-09-30 14:00', '2026-09-29 18:00', '2026-09-30 09:05'];
    const sorted = [...ts].sort((a, b) => parseDateTime(a).getTime() - parseDateTime(b).getTime());
    expect(sorted).toEqual(['2026-09-29 18:00', '2026-09-30 09:05', '2026-09-30 14:00']);
  });
});
