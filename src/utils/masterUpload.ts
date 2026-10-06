/**
 * "Upload a Master": one place where business users drop any Excel file.
 *
 *   - A BA definition workbook (Masters + Fields sheets)  → new masters in the module named in the sheet
 *   - A sheet in an EXISTING master's own template        → rows added / updated; any difference in the columns is an
 *                                                           error and nothing is imported
 *   - Any other table                                     → detected as a NEW master (columns → fields), placed in a
 *                                                           module chosen on screen
 *
 * Everything is checked first; nothing is saved while any sheet has an error.
 */
import * as XLSX from 'xlsx';
import type { MasterConfig, MasterFieldDef } from '../data/masterCatalogue';
import { FIELDS_SHEET, MASTERS_SHEET, parseMasterWorkbook, type ParsedMasterWorkbook } from './masterWorkbook';
import { GUIDE_SHEET, detectMasters, type DetectedMaster } from './smartExcelImport';
import { masterValidationSchema } from './masterValidationSchema';
import { checkCopies } from './recordCopies';
import { nextRecordId } from './recordDuplicates';

type Rec = Record<string, any>;

export interface UploadIssue {
  /** Excel row number (header = row 1); undefined for whole-sheet problems. */
  row?: number;
  message: string;
}

export interface SheetOutcome {
  sheet: string;
  kind: 'existing' | 'new' | 'skipped';
  /** Existing master this sheet was matched to. */
  master?: MasterConfig;
  matchedBy?: 'sheet name' | 'columns';
  /** Column differences against the master's template (any one is an error). */
  headerProblems: string[];
  issues: UploadIssue[];
  add: number;
  update: number;
  unchanged: number;
  /** The master with the rows applied (only when there are no problems). */
  updated?: MasterConfig;
  /** New master detected from the columns. */
  detected?: DetectedMaster;
  note?: string;
  ok: boolean;
}

export interface UploadAnalysis {
  mode: 'definition' | 'sheets';
  definition?: ParsedMasterWorkbook;
  sheets: SheetOutcome[];
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());

/** Column headers that carry meaning (blank and auto-named columns are ignored). */
const realHeaders = (headers: string[]) => headers.filter((h) => h !== '' && !/^__EMPTY/.test(h));

export interface HeaderComparison {
  /** Template columns (labels) the file does not have. */
  missing: string[];
  /** File columns that are not in the template. */
  extra: string[];
  duplicated: string[];
  matched: number;
  ratio: number;
  /** Column header → field key ('id' for the id column). */
  keyOf: Map<string, string>;
}

export function compareHeaders(master: MasterConfig, headers: string[]): HeaderComparison {
  const used = realHeaders(headers);
  const keyOf = new Map<string, string>();
  const matchedFields = new Set<string>();
  const seen = new Map<string, number>();
  const extra: string[] = [];
  used.forEach((h) => {
    seen.set(norm(h), (seen.get(norm(h)) ?? 0) + 1);
    if (norm(h) === 'id') return void keyOf.set(h, 'id');
    const f = master.fields.find((x) => norm(x.key) === norm(h) || norm(x.label) === norm(h));
    if (f && !matchedFields.has(f.key)) {
      keyOf.set(h, f.key);
      matchedFields.add(f.key);
    } else extra.push(h);
  });
  const missing = master.fields.filter((f) => !matchedFields.has(f.key)).map((f) => f.label);
  const duplicated = [...seen].filter(([, n]) => n > 1).map(([k]) => used.find((h) => norm(h) === k)!);
  const total = Math.max(master.fields.length, used.filter((h) => norm(h) !== 'id').length) || 1;
  return { missing, extra, duplicated, matched: matchedFields.size, ratio: matchedFields.size / total, keyOf };
}

export function headerProblemsOf(master: MasterConfig, c: HeaderComparison): string[] {
  const out: string[] = [];
  if (c.missing.length) out.push(`Missing column${c.missing.length > 1 ? 's' : ''}: ${c.missing.join(', ')}`);
  if (c.extra.length) out.push(`Column${c.extra.length > 1 ? 's' : ''} not in the ${master.name} template: ${c.extra.join(', ')}`);
  if (c.duplicated.length) out.push(`Column${c.duplicated.length > 1 ? 's' : ''} appear${c.duplicated.length > 1 ? '' : 's'} twice: ${c.duplicated.join(', ')}`);
  return out;
}

const sheetGrid = (wb: XLSX.WorkBook, name: string): string[][] =>
  XLSX.utils
    .sheet_to_json<any[]>(wb.Sheets[name], { header: 1, defval: '', raw: false, dateNF: 'yyyy-mm-dd', blankrows: false })
    .map((r) => r.map(str));

/** Applies the rows of one sheet to an existing master. Pure: returns the result, never mutates. */
function applyRows(master: MasterConfig, headers: string[], rows: string[][], cmp: HeaderComparison): Pick<SheetOutcome, 'issues' | 'add' | 'update' | 'unchanged' | 'updated'> {
  const issues: UploadIssue[] = [];
  const records = master.records.map((r) => ({ ...r }));
  const byId = new Map(records.map((r, i) => [String(r.id).toLowerCase(), i]));
  const seenIds = new Set<string>();
  const fresh: Array<{ rec: Rec; row: number }> = [];
  let update = 0;
  let unchanged = 0;

  rows.forEach((cells, i) => {
    const row = i + 2;
    const raw: Rec = {};
    headers.forEach((h, c) => {
      const key = cmp.keyOf.get(h);
      if (key) raw[key] = str(cells[c]);
    });
    if (Object.values(raw).every((v) => v === '')) return;
    const id = str(raw.id);
    if (id) {
      if (seenIds.has(id.toLowerCase())) return void issues.push({ row, message: `Record id "${id}" appears more than once in the file.` });
      seenIds.add(id.toLowerCase());
    }
    const at = id ? byId.get(id.toLowerCase()) : undefined;
    if (at !== undefined) {
      // Existing record: blank cells mean "leave as is"
      const base = records[at];
      const patch = Object.fromEntries(Object.entries(raw).filter(([k, v]) => k !== 'id' && v !== ''));
      const res = masterValidationSchema.validateRecord(master.fields, { ...base, ...patch }, master.id);
      if (!res.isValid) return void Object.values(res.errors).forEach((m) => issues.push({ row, message: String(m) }));
      const next = { ...base, ...Object.fromEntries(Object.keys(patch).map((k) => [k, res.sanitizedRecord[k]])) };
      if (master.fields.every((f) => str(next[f.key]) === str(base[f.key]))) unchanged++;
      else {
        records[at] = next;
        update++;
      }
    } else {
      fresh.push({ rec: { ...raw, id }, row });
    }
  });

  // New rows: ids, field rules, duplicates and clashing keys, against saved rows and the rows before them
  const taken: Rec[] = [...records];
  const copies = fresh.map(({ rec }) => {
    const id = rec.id || nextRecordId(master.id, [...taken]);
    const copy = { ...rec, id, _after: null };
    taken.push(copy);
    return copy;
  });
  const rowOf = new Map(copies.map((c, i) => [c.id, fresh[i].row]));
  const check = copies.length ? checkCopies({ ...master, records }, copies) : { sanitized: [], errors: {}, duplicates: {} };
  Object.entries(check.errors).forEach(([id, msgs]) => msgs.forEach((message) => issues.push({ row: rowOf.get(id), message })));

  issues.sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
  const updated = issues.length ? undefined : { ...master, records: [...records, ...check.sanitized] };
  return { issues, add: copies.length, update, unchanged, updated };
}

export function analyseUpload(wb: XLSX.WorkBook, masters: MasterConfig[]): UploadAnalysis {
  // 1. A BA definition workbook creates / extends masters in the module named in its Masters sheet
  const lower = wb.SheetNames.map((n) => n.toLowerCase());
  if (lower.includes(MASTERS_SHEET.toLowerCase()) && lower.includes(FIELDS_SHEET.toLowerCase())) {
    return { mode: 'definition', definition: parseMasterWorkbook(wb, masters, 'update'), sheets: [] };
  }

  // 2. Otherwise every sheet is matched to an existing master (strictly), or detected as a new master
  const sheets: SheetOutcome[] = [];
  const unmatched: string[] = [];
  const base = { headerProblems: [], issues: [], add: 0, update: 0, unchanged: 0 };

  wb.SheetNames.forEach((sheet) => {
    if (GUIDE_SHEET.test(sheet.trim())) return void sheets.push({ ...base, sheet, kind: 'skipped', note: 'Guide sheet — skipped.', ok: true });
    const grid = sheetGrid(wb, sheet);
    if (grid.length === 0) return void sheets.push({ ...base, sheet, kind: 'skipped', note: 'Empty sheet — skipped.', ok: true });
    const headers = grid[0];
    const rows = grid.slice(1);
    const columns = realHeaders(headers);

    // By sheet name (the template sheet is named after the master), else by exactly matching columns
    const byName = masters.find((m) => [m.id, m.id.replace(/_master$/, ''), m.name].some((n) => norm(n) === norm(sheet)));
    const perfect = masters.filter((m) => {
      const c = compareHeaders(m, headers);
      return !c.missing.length && !c.extra.length && !c.duplicated.length && columns.length > 0;
    });
    let master = byName;
    let matchedBy: SheetOutcome['matchedBy'] = 'sheet name';
    if (!master && perfect.length === 1) {
      master = perfect[0];
      matchedBy = 'columns';
    }
    if (!master && perfect.length > 1) {
      return void sheets.push({
        ...base,
        sheet,
        kind: 'existing',
        headerProblems: [`These columns fit several masters (${perfect.map((m) => m.name).join(', ')}). Name the sheet after the master you mean.`],
        ok: false,
      });
    }
    if (!master) {
      // Close to one master's template but not the same → that is a format error, not a new master
      const best = masters
        .map((m) => ({ m, c: compareHeaders(m, headers) }))
        .filter(({ c }) => c.matched >= 2 && c.ratio >= 0.6)
        .sort((a, b) => b.c.ratio - a.c.ratio)[0];
      if (best) {
        master = best.m;
        matchedBy = 'columns';
      }
    }
    if (!master) {
      unmatched.push(sheet);
      return;
    }

    const cmp = compareHeaders(master, headers);
    const headerProblems = headerProblemsOf(master, cmp);
    if (headerProblems.length) {
      return void sheets.push({ ...base, sheet, kind: 'existing', master, matchedBy, headerProblems, ok: false });
    }
    const applied = applyRows(master, headers, rows, cmp);
    sheets.push({
      ...base,
      ...applied,
      sheet,
      kind: 'existing',
      master,
      matchedBy,
      ok: applied.issues.length === 0,
      note: rows.length === 0 ? 'The sheet has the right columns but no rows.' : undefined,
    });
  });

  // 3. Sheets that match no master are new masters: columns become fields
  if (unmatched.length) {
    const detected = detectMasters(wb);
    unmatched.forEach((sheet) => {
      const found = detected.masters.filter((d) => d.sheet === sheet);
      if (!found.length) return void sheets.push({ ...base, sheet, kind: 'skipped', note: 'No table found in this sheet — skipped.', ok: true });
      found.forEach((d) => sheets.push({ ...base, sheet, kind: 'new', detected: d, issues: d.issues.map((message) => ({ message })), ok: true }));
    });
  }
  // Keep the file's sheet order
  sheets.sort((a, b) => wb.SheetNames.indexOf(a.sheet) - wb.SheetNames.indexOf(b.sheet));
  return { mode: 'sheets', sheets };
}

/** True when nothing in the upload blocks the import. */
export const uploadIsClean = (a: UploadAnalysis): boolean =>
  a.mode === 'definition' ? !!a.definition && !a.definition.hasErrors && a.definition.masters.length > 0 : a.sheets.some((s) => s.kind !== 'skipped') && a.sheets.every((s) => s.ok);

/** The template of an existing master: header row of field labels, optionally with the current rows (and ids). */
export function buildMasterTemplate(master: MasterConfig, withData: boolean): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const header = [...(withData ? ['id'] : []), ...master.fields.map((f: MasterFieldDef) => f.label)];
  const rows = withData
    ? master.records.map((r) => [r.id, ...master.fields.map((f) => (typeof r[f.key] === 'boolean' ? (r[f.key] ? 'Y' : 'N') : r[f.key] ?? ''))])
    : [];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), master.id.slice(0, 31));
  return wb;
}
