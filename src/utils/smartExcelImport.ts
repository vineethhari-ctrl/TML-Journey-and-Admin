/**
 * Smart Excel Import — turns a BA's own Excel (any layout) into master definitions.
 *
 *  - Each sheet is split into tables at fully-blank columns (side-by-side tables, as in the
 *    Bodyshop workbook) and the first row with 2+ text cells is the header.
 *  - Repeated header rows (e.g. an EV block below a PV block) and blank rows are skipped.
 *  - Column types are inferred: Y/N → Y/N dropdown, numbers → number (a "(Max 2)" header sets
 *    the limit), dates → date, a few repeated values → dropdown, anything else → text.
 *    A column with no blanks is mandatory.
 *  - Gaps are reported, never fixed silently: blank cells in mostly-filled columns,
 *    mixed types, values above a "(Max N)" limit, duplicate rows.
 *  - An index sheet ("Master Name" / "Status") is read as notes, not imported; guide sheets
 *    ("README…", "How to…", "Instructions", "Guide") are skipped.
 */
import type { WorkBook } from 'xlsx';
import * as XLSX from 'xlsx';
import { LogicalModuleGroup, MasterConfig, MasterFieldDef, ModuleCode } from '../data/masterCatalogue';
import { createMasterConfig, slugifyFieldKey, slugifyMasterId } from './masterWorkbook';

type Cell = string | number | boolean | Date | null;

export interface DetectedColumn {
  label: string;
  key: string;
  type: MasterFieldDef['type'];
  options?: string[];
  mandatory: boolean;
  max?: number;
  filled: number;
}

export interface DetectedMaster {
  sheet: string;
  /** e.g. "A1:F19" */
  range: string;
  name: string;
  id: string;
  columns: DetectedColumn[];
  records: Array<Record<string, any>>;
  /** Excel row number of each record (for messages). */
  rowNumbers: number[];
  issues: string[];
  skippedRows: number[];
}

export interface SmartImportResult {
  masters: DetectedMaster[];
  notes: string[];
}

const isBlank = (v: Cell | undefined) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const text = (v: Cell | undefined) => (isBlank(v) ? '' : v instanceof Date ? isoDate(v) : String(v).trim());
const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const YN: Record<string, 'Y' | 'N'> = { y: 'Y', yes: 'Y', n: 'N', no: 'N' };
const ynOf = (v: Cell) => YN[text(v).toLowerCase()];
const numberOf = (v: Cell): number | undefined => {
  if (typeof v === 'number') return v;
  const t = text(v);
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : undefined;
};
const dateOf = (v: Cell): string | undefined => {
  if (v instanceof Date && !isNaN(v.getTime())) return isoDate(v);
  const t = text(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : undefined;
};
const col = (c: number) => XLSX.utils.encode_col(c);

/** Like slugifyMasterId, but shortens the name part so the "_master" suffix survives the 31-char limit. */
export function masterIdFor(name: string): string {
  const base = slugifyMasterId(name)
    .replace(/(^|_)master(?=_|$)/g, '')
    .replace(/^_+/, '')
    .slice(0, 24)
    .replace(/_+$/, '');
  return `${base || 'imported'}_master`;
}

export function readRawWorkbook(data: ArrayBuffer | Uint8Array): WorkBook {
  return XLSX.read(data, { type: 'array', cellDates: true });
}

/** Columns that are blank in every row split the sheet into side-by-side tables. */
function columnBlocks(grid: Cell[][]): Array<[number, number]> {
  const width = Math.max(0, ...grid.map((r) => r.length));
  const used = Array.from({ length: width }, (_, c) => grid.some((r) => !isBlank(r[c])));
  const blocks: Array<[number, number]> = [];
  let start = -1;
  used.forEach((u, c) => {
    if (u && start < 0) start = c;
    if (!u && start >= 0) {
      blocks.push([start, c - 1]);
      start = -1;
    }
  });
  if (start >= 0) blocks.push([start, width - 1]);
  return blocks;
}

function inferColumn(label: string, values: Cell[]): DetectedColumn {
  const present = values.filter((v) => !isBlank(v));
  const key = slugifyFieldKey(label) || 'field';
  const base = { label, key, filled: present.length, mandatory: present.length > 0 && present.length === values.length };
  const maxMatch = label.match(/max\.?\s*(\d+)/i);
  const max = maxMatch ? Number(maxMatch[1]) : undefined;

  if (present.length === 0) return { ...base, type: 'text' };
  if (present.every((v) => ynOf(v))) return { ...base, type: 'select', options: ['Y', 'N'] };
  if (present.every((v) => numberOf(v) !== undefined)) return { ...base, type: 'number', max };
  if (present.every((v) => dateOf(v) !== undefined)) return { ...base, type: 'date' };

  const distinct = [...new Set(present.map(text))];
  // A short list of values that repeat looks like a dropdown (BU, Role, Service Type, Status…)
  if (distinct.length >= 2 && distinct.length <= 8 && present.length >= distinct.length * 2 && distinct.every((d) => d.length <= 40)) {
    return { ...base, type: 'select', options: distinct };
  }
  return { ...base, type: 'text' };
}

function convert(v: Cell, c: DetectedColumn): any {
  if (isBlank(v)) return c.type === 'number' ? null : '';
  if (c.type === 'number') return numberOf(v) ?? text(v);
  if (c.type === 'date') return dateOf(v) ?? text(v);
  if (c.type === 'select' && c.options?.[0] === 'Y' && c.options.length === 2) return ynOf(v) ?? text(v);
  return text(v);
}

const looksLikeIndex = (headers: string[]) =>
  headers.length <= 3 && headers.some((h) => /master\s*name/i.test(h)) && headers.some((h) => /status/i.test(h));

function uniqueKeys(cols: DetectedColumn[]) {
  const seen = new Map<string, number>();
  cols.forEach((c) => {
    if (c.key === 'id') c.key = 'record_id';
    const n = (seen.get(c.key) ?? 0) + 1;
    seen.set(c.key, n);
    if (n > 1) {
      c.key = `${c.key}_${n}`;
      c.label = `${c.label} (${n})`;
    }
  });
}

/** Help sheets in a BA workbook ("README", "How to fill", "Instructions", "Guide") are never imported. */
export const GUIDE_SHEET = /^(readme|how to|instructions?|guide)\b/i;

/** Finds the tables in every sheet and turns each into a draft master. */
export function detectMasters(wb: WorkBook): SmartImportResult {
  const masters: DetectedMaster[] = [];
  const notes: string[] = [];

  for (const sheet of wb.SheetNames) {
    if (GUIDE_SHEET.test(sheet.trim())) {
      notes.push(`Sheet "${sheet}" is a guide sheet — skipped.`);
      continue;
    }
    const grid = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[sheet], { header: 1, defval: null, raw: true, blankrows: true });
    const blocks = columnBlocks(grid);
    if (blocks.length === 0) {
      notes.push(`Sheet "${sheet}" is empty — skipped.`);
      continue;
    }

    blocks.forEach(([c0, c1], b) => {
      const rows = grid.map((r) => Array.from({ length: c1 - c0 + 1 }, (_, i) => (r[c0 + i] ?? null) as Cell));
      const headerIdx = rows.findIndex((r) => r.filter((v) => !isBlank(v)).length >= 2 && r.every((v) => isBlank(v) || (typeof v === 'string' && numberOf(v) === undefined)));
      if (headerIdx < 0) {
        notes.push(`Sheet "${sheet}" columns ${col(c0)}–${col(c1)}: no header row found — skipped.`);
        return;
      }
      const header = rows[headerIdx];
      // Columns without a header are dropped (their values can't be named)
      const keep = header.map((h, i) => (isBlank(h) ? -1 : i)).filter((i) => i >= 0);
      const labels = keep.map((i) => text(header[i]));
      const headerSig = labels.map((l) => l.toLowerCase()).join('|');

      if (looksLikeIndex(labels)) {
        rows.slice(headerIdx + 1).forEach((r) => {
          const vals = keep.map((i) => text(r[i]));
          if (vals.some(Boolean)) notes.push(`Index sheet "${sheet}": ${labels.map((l, j) => `${l} = ${vals[j] || '—'}`).join(', ')}`);
        });
        return;
      }

      const dataRows: Cell[][] = [];
      const rowNumbers: number[] = [];
      const skippedRows: number[] = [];
      rows.slice(headerIdx + 1).forEach((r, j) => {
        const excelRow = headerIdx + j + 2;
        const vals = keep.map((i) => r[i]);
        if (vals.every((v) => isBlank(v))) return;
        if (vals.map((v) => text(v).toLowerCase()).join('|') === headerSig) {
          skippedRows.push(excelRow);
          return;
        }
        dataRows.push(vals);
        rowNumbers.push(excelRow);
      });
      if (dataRows.length === 0) {
        notes.push(`Sheet "${sheet}" columns ${col(c0)}–${col(c1)}: header only, no data rows — skipped.`);
        return;
      }

      const columns = labels.map((label, j) => inferColumn(label, dataRows.map((r) => r[j])));
      uniqueKeys(columns);

      const name = blocks.length > 1 ? `${sheet} — Part ${b + 1}` : sheet;
      const prefix = (masterIdFor(name).replace(/_master$/, '').replace(/_/g, '').slice(0, 3) || 'rec').toUpperCase();
      const records = dataRows.map((r, i) => {
        const rec: Record<string, any> = { id: `${prefix}-${String(i + 1).padStart(3, '0')}` };
        columns.forEach((c, j) => (rec[c.key] = convert(r[j], c)));
        return rec;
      });

      masters.push({
        sheet,
        range: `${col(c0)}${headerIdx + 1}:${col(c1)}${rowNumbers[rowNumbers.length - 1]}`,
        name,
        id: masterIdFor(name),
        columns,
        records,
        rowNumbers,
        skippedRows,
        issues: findGaps(columns, dataRows, rowNumbers, skippedRows),
      });
    });
  }
  return { masters, notes };
}

const rowList = (rows: number[]) => (rows.length > 6 ? `${rows.slice(0, 6).join(', ')} … (${rows.length} rows)` : rows.join(', '));

function findGaps(columns: DetectedColumn[], rows: Cell[][], rowNumbers: number[], skipped: number[]): string[] {
  const issues: string[] = [];
  if (skipped.length) issues.push(`Row(s) ${rowList(skipped)} repeat the header and were skipped (e.g. a second PV/EV block).`);
  columns.forEach((c, j) => {
    const blanks = rows.map((r, i) => (isBlank(r[j]) ? rowNumbers[i] : 0)).filter(Boolean);
    if (c.filled === 0) issues.push(`"${c.label}" is empty in every row.`);
    else if (blanks.length && c.filled / rows.length >= 0.6) issues.push(`"${c.label}" is blank in row(s) ${rowList(blanks)}.`);
    if (c.type === 'text') {
      const nums = rows.map((r, i) => (!isBlank(r[j]) && numberOf(r[j]) !== undefined ? rowNumbers[i] : 0)).filter(Boolean);
      if (nums.length && nums.length < c.filled && nums.length >= c.filled / 2) issues.push(`"${c.label}" mixes numbers and text (numbers in row(s) ${rowList(nums)}).`);
    }
    if (c.type === 'number' && c.max !== undefined) {
      const over = rows.map((r, i) => ((numberOf(r[j]) ?? 0) > c.max! ? rowNumbers[i] : 0)).filter(Boolean);
      if (over.length) issues.push(`"${c.label}" is above the maximum ${c.max} in row(s) ${rowList(over)}.`);
    }
  });
  const seen = new Map<string, number>();
  rows.forEach((r, i) => {
    const sig = r.map(text).join('|').toLowerCase();
    if (seen.has(sig)) issues.push(`Row ${rowNumbers[i]} duplicates row ${seen.get(sig)}.`);
    else seen.set(sig, rowNumbers[i]);
  });
  return issues;
}

// ---------------------------------------------------------------------------
// From draft to master
// ---------------------------------------------------------------------------

export function fieldsFor(columns: DetectedColumn[]): MasterFieldDef[] {
  return columns.map((c) => ({
    key: c.key,
    label: c.label,
    type: c.type,
    ...(c.type === 'select' ? { options: c.options } : {}),
    ...(c.mandatory ? { mandatory: true } : { defaultValue: '' }),
    ...(c.type === 'number' && c.max !== undefined ? { validation: { max: c.max } } : {}),
  }));
}

/** Records re-shaped after a BA changed a column's type in the preview. */
export function recordsFor(d: DetectedMaster): Array<Record<string, any>> {
  return d.records.map((r) => {
    const out: Record<string, any> = { id: r.id };
    d.columns.forEach((c) => {
      const v = r[c.key];
      out[c.key] = c.type === 'number' ? (v === '' || v === null ? null : numberOf(v) ?? v) : v === null ? '' : String(v);
    });
    return out;
  });
}

const MODULE_HINTS: Array<[RegExp, ModuleCode]> = [
  [/eqc|quality/i, 'eqc'],
  [/body\s*shop|paint|denting|inventory capture|insurance/i, 'bodyshop'],
  [/claim|warranty/i, 'claim'],
  [/spd|spare|parts/i, 'spd'],
  [/thd|helpdesk/i, 'thd'],
  [/appointment|booking|slot/i, 'appointment'],
  [/receptionist|lounge/i, 'receptionist'],
  [/reception|pick\s*&?\s*drop|p&d|driver/i, 'reception'],
  [/security|gate/i, 'security'],
  [/job\s*card|jc\b|complaint/i, 'jc_creation'],
  [/ira\b|telematic|dtc/i, 'thd'],
  [/holiday/i, 'appointment'],
  [/bay/i, 'jc_tracking'],
  [/dealer|journey/i, 'customer_journey'],
];

const GROUP_FOR: Partial<Record<ModuleCode, LogicalModuleGroup>> = {
  eqc: 'Electronic Quality Check',
  bodyshop: 'Bodyshop',
  claim: 'Parts, Claims & Support',
  spd: 'Parts, Claims & Support',
  thd: 'Parts, Claims & Support',
  security: 'Parts, Claims & Support',
  dealer_network: 'Dealer Network',
  customer_journey: 'Dealer Network',
};

/** Best guess of module / group from the file and sheet names (the BA can change it). */
export function guessPlacement(fileName: string, sheet: string): { moduleCode: ModuleCode; logicalGroup: LogicalModuleGroup } {
  const hay = `${sheet} ${fileName}`;
  const moduleCode = MODULE_HINTS.find(([re]) => re.test(hay))?.[1] ?? 'jc_creation';
  return { moduleCode, logicalGroup: GROUP_FOR[moduleCode] ?? 'Service Operations' };
}

export interface DraftPlacement {
  id: string;
  name: string;
  moduleCode: string;
  logicalGroup: string;
  owner: string;
}

export function toMasterConfig(d: DetectedMaster, p: DraftPlacement, source: string): MasterConfig {
  return createMasterConfig(
    {
      id: p.id,
      name: p.name,
      moduleCode: p.moduleCode,
      logicalGroup: p.logicalGroup,
      owner: p.owner,
      category: 'Imported from BA Excel',
      description: `Imported from ${source}, sheet "${d.sheet}" (${d.range}).`,
      fields: fieldsFor(d.columns),
    },
    recordsFor(d)
  );
}
