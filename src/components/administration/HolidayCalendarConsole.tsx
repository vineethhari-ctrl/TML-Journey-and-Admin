import React, { useState } from 'react';
import { CalendarDays, Lock, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  DivisionCalendar,
  WEEKDAYS,
  Weekday,
  bulkSetHoliday,
  effectiveHours,
  holidaysInMonth,
  isPast,
  isValidTime,
  monthDates,
  monthLabel,
  setDateEntry,
  weekdayOf,
} from '../../utils/holidayCalendar';

export interface CalendarScope {
  key: string;
  label: string;
}

interface Props {
  scopes: CalendarScope[];
  calendars: Record<string, DivisionCalendar>;
  onChange: (key: string, calendar: DivisionCalendar) => void;
  /** YYYY-MM-DD; dates before it are locked. Injectable for tests. */
  today: string;
}

const card = 'rounded-xl border border-slate-200 bg-white shadow-xs';
const input = 'px-2 py-1 rounded-md border border-slate-200 bg-white text-xs focus:border-blue-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400';
const short = (d: Weekday) => d.slice(0, 3);

export const HolidayCalendarConsole: React.FC<Props> = ({ scopes, calendars, onChange, today }) => {
  const { logAudit, showToast } = useApp();

  // Scope is edited in a draft and applied with "Load Calendar"
  const [draftScope, setDraftScope] = useState(scopes[0]?.key ?? '');
  const [draftMonth, setDraftMonth] = useState(today.slice(0, 7));
  const [scope, setScope] = useState({ key: scopes[0]?.key ?? '', month: today.slice(0, 7) });
  const [bulkDay, setBulkDay] = useState<Weekday | ''>('');

  const scopeLabel = scopes.find((s) => s.key === scope.key)?.label ?? scope.key;
  const cal = calendars[scope.key];
  if (!cal) return null;

  const update = (next: DivisionCalendar) => onChange(scope.key, next);
  const dates = monthDates(scope.month);
  const holidayCount = holidaysInMonth(cal, scope.month).length;

  const setPattern = (day: Weekday, patch: Partial<DivisionCalendar['pattern'][number]>) =>
    update({ ...cal, pattern: cal.pattern.map((p) => (p.day === day ? { ...p, ...patch } : p)) });

  return (
    <div className="space-y-4" data-testid="holiday-calendar">
      {/* Scope */}
      <form
        aria-label="Calendar scope"
        className={`${card} p-4`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!/^\d{4}-\d{2}$/.test(draftMonth)) {
            showToast('Please pick a month', 'error');
            return;
          }
          setScope({ key: draftScope, month: draftMonth });
        }}
      >
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Scope</div>
        <div className="flex flex-wrap items-end gap-3 text-xs">
          <div className="min-w-[240px]">
            <label htmlFor="hc-division" className="block text-[11px] font-semibold text-slate-600 mb-1">Division *</label>
            <select id="hc-division" className={`${input} w-full py-1.5`} value={draftScope} onChange={(e) => setDraftScope(e.target.value)}>
              {scopes.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="hc-month" className="block text-[11px] font-semibold text-slate-600 mb-1">Month *</label>
            <input id="hc-month" type="month" className={`${input} py-1.5`} value={draftMonth} onChange={(e) => setDraftMonth(e.target.value)} />
          </div>
          <button type="submit" className="px-4 py-1.5 rounded-lg bg-[#0b2a5b] text-white font-bold hover:bg-blue-900 cursor-pointer">
            Load Calendar
          </button>
          <div className="flex flex-wrap items-center gap-3 ml-auto text-[11px] text-slate-600">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-rose-200 border border-rose-300" /> Holiday</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-amber-100 border border-amber-300" /> Weekend (per weekly pattern)</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-slate-200 border border-slate-300" /> Past date (locked)</span>
          </div>
        </div>
      </form>

      {/* Weekly pattern */}
      <div className={`${card} p-4 space-y-3`}>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Weekly Operating Pattern</h3>
          <p className="text-[11px] text-slate-500">
            Applies to every date in <strong>{scopeLabel}</strong> unless a specific date below overrides it.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {cal.pattern.map((p) => (
            <div
              key={p.day}
              data-day={p.day}
              className={`rounded-xl border p-3 space-y-2 text-xs ${p.isWeekOff ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}
            >
              <div className="font-bold text-slate-900">{short(p.day)}</div>
              <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  aria-label={`${p.day} week off`}
                  checked={p.isWeekOff}
                  onChange={(e) => {
                    setPattern(p.day, { isWeekOff: e.target.checked });
                    logAudit('Weekly Pattern Updated', 'Holiday Calendar', `${scopeLabel} – ${p.day}`, p.isWeekOff ? 'Week Off' : 'Working', e.target.checked ? 'Week Off' : 'Working');
                  }}
                />
                Week Off
              </label>
              {(['open', 'close'] as const).map((k) => (
                <div key={k} className="flex items-center justify-between gap-1">
                  <span className="text-[11px] text-slate-500 capitalize">{k}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="HH:MM"
                    aria-label={`${p.day} ${k}`}
                    disabled={p.isWeekOff}
                    className={`${input} w-16 text-center font-mono`}
                    value={p[k]}
                    onChange={(e) => setPattern(p.day, { [k]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Date-specific overrides */}
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-blue-700" /> Date-Specific Holidays &amp; Overrides — {monthLabel(scope.month)}
          </h3>
          <span className="text-[11px] font-semibold text-slate-600" data-testid="holiday-count">
            {holidayCount} holiday(s) set this month
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-3 py-2">Day</th>
                <th className="px-3 py-2">Effective Hours (computed)</th>
                <th className="px-3 py-2">Holiday?</th>
                <th className="px-3 py-2">Holiday Name</th>
                <th className="px-3 py-2">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dates.map((iso) => {
                const entry = cal.dates[iso];
                const locked = isPast(iso, today);
                const eff = effectiveHours(iso, cal);
                const day = weekdayOf(iso);
                const rowCls = locked
                  ? 'bg-slate-50 text-slate-400'
                  : eff.kind === 'holiday'
                  ? 'bg-rose-50'
                  : eff.kind === 'weekoff'
                  ? 'bg-amber-50/60'
                  : '';
                const set = (patch: Parameters<typeof setDateEntry>[2]) => update(setDateEntry(cal, iso, patch, today));
                return (
                  <tr key={iso} data-date={iso} className={`group ${rowCls}`}>
                    <td className="px-4 py-1.5 font-mono font-semibold">
                      <span className="inline-flex items-center gap-1">
                        {iso}
                        {locked && <Lock className="h-3 w-3" aria-label="Locked" />}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">{short(day)}</span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`font-mono ${
                          eff.kind === 'holiday' || eff.kind === 'weekoff' ? 'text-rose-700 font-semibold' : eff.kind === 'override' ? 'text-blue-800 font-semibold' : ''
                        }`}
                      >
                        {eff.label}
                      </span>
                      {!locked && eff.kind !== 'holiday' && (
                        entry?.open ? (
                          <span className="inline-flex items-center gap-1 ml-2">
                            {(['open', 'close'] as const).map((k) => (
                              <input
                                key={k}
                                type="text"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="HH:MM"
                                aria-label={`${iso} ${k} override`}
                                className={`${input} w-16 text-center font-mono`}
                                value={entry[k] ?? ''}
                                onChange={(e) => set({ [k]: e.target.value })}
                              />
                            ))}
                            <button
                              type="button"
                              title="Remove hours override"
                              onClick={() => set({ open: undefined, close: undefined })}
                              className="p-0.5 rounded hover:bg-slate-200 cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => set({ open: '09:00', close: '14:00' })}
                            className="ml-2 text-[10px] text-blue-700 font-semibold hover:underline cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            Override hours
                          </button>
                        )
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        aria-label={`${iso} holiday`}
                        disabled={locked}
                        checked={!!entry?.isHoliday}
                        onChange={(e) => {
                          set({ isHoliday: e.target.checked });
                          logAudit(
                            e.target.checked ? 'Holiday Added' : 'Holiday Removed',
                            'Holiday Calendar',
                            `${scopeLabel} – ${iso}`,
                            e.target.checked ? 'Working' : 'Holiday',
                            e.target.checked ? 'Holiday' : 'Working'
                          );
                        }}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        aria-label={`${iso} holiday name`}
                        disabled={locked}
                        className={`${input} w-44`}
                        placeholder="e.g. Diwali"
                        value={entry?.name ?? ''}
                        onChange={(e) => set({ name: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        aria-label={`${iso} remark`}
                        disabled={locked}
                        className={`${input} w-52`}
                        placeholder="Optional remark"
                        value={entry?.remark ?? ''}
                        onChange={(e) => set({ remark: e.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <form
          aria-label="Bulk set to holiday"
          className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50/60 text-xs"
          onSubmit={(e) => {
            e.preventDefault();
            if (!bulkDay) {
              showToast('Pick a weekday first', 'error');
              return;
            }
            const res = bulkSetHoliday(cal, scope.month, bulkDay, `${bulkDay} holiday`, today);
            if (res.count === 0) {
              showToast(`No upcoming ${bulkDay}s left in ${monthLabel(scope.month)}`, 'error');
              return;
            }
            update(res.calendar);
            logAudit('Bulk Holiday Set', 'Holiday Calendar', `${scopeLabel} – ${scope.month}`, 'None', `Every ${bulkDay} (${res.count} date(s))`);
            showToast(`Marked ${res.count} ${bulkDay}(s) as holiday`, 'success');
            setBulkDay('');
          }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bulk set to holiday</span>
          <select aria-label="Bulk weekday" className={`${input} py-1.5`} value={bulkDay} onChange={(e) => setBulkDay(e.target.value as Weekday | '')}>
            <option value="">Every…</option>
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>Every {d}</option>
            ))}
          </select>
          <span className="text-slate-500">in the loaded month</span>
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#0b2a5b] text-white font-bold hover:bg-blue-900 cursor-pointer">
            Apply
          </button>
          {cal.pattern.some((p) => !p.isWeekOff && (!isValidTime(p.open) || !isValidTime(p.close) || p.open >= p.close)) && (
            <span className="ml-auto text-rose-700 font-semibold">Check the weekly pattern: open time must be before close time.</span>
          )}
        </form>
      </div>
    </div>
  );
};
