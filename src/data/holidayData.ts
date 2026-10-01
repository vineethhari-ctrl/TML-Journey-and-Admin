import { DEFAULT_PATTERN, DivisionCalendar, DateEntry } from '../utils/holidayCalendar';
import { DEALER_DIVISIONS } from './bayData';

/** One calendar per dealer + division; key = "DLR1001|Main Workshop". */
export const calendarKey = (dealerCode: string, division: string) => `${dealerCode}|${division}`;

const entry = (date: string, isHoliday: boolean, name: string, remark = '', hours?: [string, string]): DateEntry => ({
  date,
  isHoliday,
  name,
  remark,
  ...(hours ? { open: hours[0], close: hours[1] } : {}),
});

const SAMPLE_DATES: DateEntry[] = [
  entry('2026-09-17', false, 'Vishwakarma Jayanti', 'Workshop puja — half day', ['09:00', '13:00']),
  entry('2026-09-28', true, 'Anant Chaturdashi / Ganesh Visarjan'),
  entry('2026-10-02', true, 'Gandhi Jayanti', 'National holiday'),
  entry('2026-10-20', true, 'Dussehra'),
  entry('2026-11-08', true, 'Diwali'),
  entry('2026-11-09', false, 'Diwali Padwa', 'Half day', ['09:00', '14:00']),
];

export function createSeedCalendars(): Record<string, DivisionCalendar> {
  const out: Record<string, DivisionCalendar> = {};
  Object.entries(DEALER_DIVISIONS).forEach(([code, divisions]) => {
    divisions.forEach((division) => {
      out[calendarKey(code, division)] = {
        pattern: DEFAULT_PATTERN.map((p) => ({ ...p })),
        dates: Object.fromEntries(SAMPLE_DATES.map((d) => [d.date, { ...d }])),
      };
    });
  });
  return out;
}
