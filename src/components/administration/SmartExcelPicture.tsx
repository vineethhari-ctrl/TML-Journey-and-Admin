import React from 'react';
import { Download } from 'lucide-react';

/** Colour + number per rule; the same colours are used in TML_Smart_Excel_Template.xlsx. */
export const SMART_RULES = [
  { n: 1, bg: 'bg-blue-600', soft: 'bg-blue-50', text: 'text-blue-700', title: 'Column names in the first row', detail: 'One table per master; row 1 of the table holds the column names.' },
  { n: 2, bg: 'bg-orange-600', soft: 'bg-orange-50', text: 'text-orange-700', title: 'One empty column between tables', detail: 'Two tables on one sheet? Keep a completely empty column between them.' },
  { n: 3, bg: 'bg-violet-600', soft: 'bg-violet-50', text: 'text-violet-700', title: 'Repeated header is OK', detail: 'A PV block and an EV block below it may repeat the header row.' },
  { n: 4, bg: 'bg-emerald-600', soft: 'bg-emerald-50', text: 'text-emerald-700', title: 'Y / N, numbers, dates', detail: 'Y or N for yes-no, real numbers for counts and sequences, real dates.' },
  { n: 5, bg: 'bg-rose-600', soft: 'bg-rose-50', text: 'text-rose-700', title: 'Fill every cell', detail: 'Never a blank meaning "same as above"; repeat the value.' },
  { n: 6, bg: 'bg-teal-600', soft: 'bg-teal-50', text: 'text-teal-700', title: 'Limits in the header', detail: 'e.g. "No. of Images (Max 2)"; the limit is then enforced.' },
] as const;

export const SMART_TEMPLATE_FILE = 'TML_Smart_Excel_Template.xlsx';
const templateUrl = `${import.meta.env.BASE_URL}downloads/${SMART_TEMPLATE_FILE}`;

const Badge: React.FC<{ n: number; className?: string }> = ({ n, className = '' }) => {
  const r = SMART_RULES[n - 1];
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ring-2 ring-white ${r.bg} ${className}`}>
      {n}
    </span>
  );
};

type Cell = { v?: string | number; head?: boolean; tone?: 'repeat' | 'gap' | 'yn' | 'limit'; badge?: number };
const toneCls: Record<NonNullable<Cell['tone']>, string> = {
  repeat: 'bg-violet-100 text-violet-900 font-semibold',
  gap: 'bg-slate-100',
  yn: 'bg-emerald-50',
  limit: 'bg-teal-50',
};

// A, B, C | D (empty) | E, F, G, H
const ROWS: Cell[][] = [
  [{ v: 'Section', head: true, badge: 1 }, { v: 'BU', head: true }, { v: 'Active', head: true }, { tone: 'gap', badge: 2 }, { v: 'Section', head: true }, { v: 'Checkpoint', head: true }, { v: 'Mandatory', head: true }, { v: 'No. of Images (Max 2)', head: true, badge: 6 }],
  [{ v: 'Documents' }, { v: 'PV' }, { v: 'Y', tone: 'yn', badge: 4 }, { tone: 'gap' }, { v: 'Internal' }, { v: 'Horn Working' }, { v: 'Y', tone: 'yn' }, { v: 2, tone: 'limit' }],
  [{ v: 'Internal' }, { v: 'PV' }, { v: 'Y', tone: 'yn' }, { tone: 'gap' }, { v: 'Internal', badge: 5 }, { v: 'Wiper Working' }, { v: 'Y', tone: 'yn' }, { v: 1, tone: 'limit' }],
  [{ v: 'Section', tone: 'repeat', badge: 3 }, { v: 'BU', tone: 'repeat' }, { v: 'Active', tone: 'repeat' }, { tone: 'gap' }, { v: 'Documents' }, { v: 'Insurance Copy' }, { v: 'N', tone: 'yn' }, { v: 1, tone: 'limit' }],
  [{ v: 'Documents' }, { v: 'EV' }, { v: 'Y', tone: 'yn' }, { tone: 'gap' }, {}, {}, {}, {}],
  [{ v: 'Internal' }, { v: 'EV' }, { v: 'N', tone: 'yn' }, { tone: 'gap' }, {}, {}, {}, {}],
];
const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** Annotated picture of a correctly laid-out BA sheet, with numbered rules. */
export const SmartExcelPicture: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div className="space-y-3" data-testid="smart-excel-picture">
    <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-xs">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-emerald-700 px-3 py-1.5 text-[11px] font-semibold text-white">
        <span className="rounded bg-white/20 px-1.5">X</span> Inventory Capture.xlsx
      </div>
      <table className="w-full min-w-[640px] border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-100 text-slate-500">
            <th className="w-7 border border-slate-200" />
            {COLS.map((c) => (
              <th key={c} className={`border border-slate-200 px-1 py-0.5 font-medium ${c === 'D' ? 'w-12 bg-orange-100 text-orange-700' : ''}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, r) => (
            <tr key={r}>
              <td className="border border-slate-200 bg-slate-100 text-center text-slate-500">{r + 1}</td>
              {row.map((cell, c) => (
                <td
                  key={c}
                  className={`relative border border-slate-200 px-1.5 py-1 whitespace-nowrap ${
                    cell.head ? 'bg-blue-600 font-bold text-white' : cell.tone ? toneCls[cell.tone] : ''
                  }`}
                >
                  {cell.v}
                  {cell.tone === 'gap' && r === 2 && <span className="block text-center text-[10px] font-bold text-orange-700">empty</span>}
                  {cell.badge && <Badge n={cell.badge} className="absolute right-0.5 -top-2 z-10" />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className={`grid gap-2 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
      {SMART_RULES.map((r) => (
        <div key={r.n} className={`flex items-start gap-2 rounded-lg p-2 ${r.soft}`}>
          <Badge n={r.n} />
          <div>
            <div className={`text-xs font-bold ${r.text}`}>{r.title}</div>
            {!compact && <div className="text-[11px] text-slate-600">{r.detail}</div>}
          </div>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
      <MiniTable title="✗ Wrong" tone="wrong" rows={[['Internal', 'Horn Working'], ['', 'Wiper Working'], ['Yes / y / Mandatory', 'two']]} />
      <MiniTable title="✓ Right" tone="right" rows={[['Internal', 'Horn Working'], ['Internal', 'Wiper Working'], ['Y', '2']]} />
    </div>

    <a
      href={templateUrl}
      download={SMART_TEMPLATE_FILE}
      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-600"
    >
      <Download className="h-3.5 w-3.5" /> Download the Smart Excel Template (colour-coded, with examples)
    </a>
  </div>
);

const MiniTable: React.FC<{ title: string; tone: 'wrong' | 'right'; rows: string[][] }> = ({ title, tone, rows }) => (
  <div className={`rounded-lg border p-2 ${tone === 'wrong' ? 'border-rose-200 bg-rose-50/60' : 'border-emerald-200 bg-emerald-50/60'}`}>
    <div className={`mb-1 font-bold ${tone === 'wrong' ? 'text-rose-700' : 'text-emerald-700'}`}>{title}</div>
    <table className="w-full border-collapse bg-white">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((v, j) => {
              const bad = (i === 1 && j === 0) || i === 2;
              return (
                <td
                  key={j}
                  className={`border border-slate-200 px-1.5 py-0.5 ${bad ? (tone === 'wrong' ? 'bg-rose-200' : 'bg-emerald-200') : ''}`}
                >
                  {v || <span className="italic text-rose-500">blank = "same as above"</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
