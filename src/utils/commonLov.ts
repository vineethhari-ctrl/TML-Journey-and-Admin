/**
 * Reading and checking the Common LOV Master (src/data/commonLov.ts). Only Active rows are offered in dropdowns.
 */
import type { MasterConfig, MasterFieldDef } from '../data/masterCatalogue';
import { COMMON_LOV_ID, LOV_CODE_PATTERN, LOV_DEFINITIONS } from '../data/commonLov';

type Rec = Record<string, any>;

const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === '';
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
const code = (v: unknown) => String(v ?? '').trim().toUpperCase();
const isActive = (r: Rec) => norm(r.status || 'Active') === 'active';
const byOrder = (a: Rec, b: Rec) => (Number(a.order) || 0) - (Number(b.order) || 0);

/** Rows of one list (all statuses), e.g. lovRows(rows, 'THD_PROGRESS'). */
export const lovRows = (rows: Rec[], lovCode: string): Rec[] => rows.filter((r) => code(r.lovCode) === code(lovCode));

/** Active values of a list in order; for a dependent list pass the chosen parent value. */
export function lovValues(rows: Rec[], lovCode: string, parentValue?: string): string[] {
  return lovRows(rows, lovCode)
    .filter((r) => isActive(r) && (parentValue === undefined || norm(r.parentValue) === norm(parentValue)))
    .sort(byOrder)
    .map((r) => String(r.value));
}

/** Common LOV rows from the masters in the app. */
export const commonLovRecords = (masters: MasterConfig[]): Rec[] => masters.find((m) => m.id === COMMON_LOV_ID)?.records ?? [];

/** Master fields with a `lovCode` take their dropdown options from the Common LOV Master. */
export function resolveLovFields(masters: MasterConfig[]): MasterConfig[] {
  const rows = commonLovRecords(masters);
  if (!rows.length) return masters;
  const resolveField = (f: MasterFieldDef): MasterFieldDef => (f.lovCode ? { ...f, type: 'select', options: lovValues(rows, f.lovCode) } : f);
  return masters.map((m) => (m.fields.some((f) => f.lovCode) ? { ...m, fields: m.fields.map(resolveField) } : m));
}

export interface LovSummary {
  code: string;
  module: string;
  fieldName: string;
  active: number;
  inactive: number;
  values: string[];
  parentCode: string;
  usedIn: string[];
}

/** One line per list: what it is, how many values, and which master fields / screens use it. */
export function lovCatalogue(rows: Rec[], masters: MasterConfig[] = []): LovSummary[] {
  const codes = [...new Set(rows.map((r) => code(r.lovCode)).filter(Boolean))].sort();
  return codes.map((c) => {
    const list = lovRows(rows, c);
    const first = list[0] ?? {};
    const usedByFields = masters.flatMap((m) => m.fields.filter((f) => code(f.lovCode) === c).map((f) => `${m.name} → ${f.label}`));
    const known = LOV_DEFINITIONS.find((d) => d.code === c)?.usedIn;
    return {
      code: c,
      module: String(first.module ?? ''),
      fieldName: String(first.fieldName ?? ''),
      active: list.filter(isActive).length,
      inactive: list.filter((r) => !isActive(r)).length,
      values: lovValues(rows, c),
      parentCode: code(list.find((r) => !blank(r.parentLovCode))?.parentLovCode ?? ''),
      usedIn: [...(known ? [known] : []), ...usedByFields],
    };
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const PATTERN = new RegExp(LOV_CODE_PATTERN);

/** Field rules for one Common LOV row (run on save and on Excel import). */
export const COMMON_LOV_RECORD_RULES: Record<string, (r: Rec) => Record<string, string>> = {
  [COMMON_LOV_ID]: (r) => {
    const e: Record<string, string> = {};
    const c = code(r.lovCode);
    if (c && !PATTERN.test(c)) e.lovCode = 'Use <MODULE>_<FIELD> in capitals, e.g. THD_COMPLAINT_TYPE.';
    else if (c && !blank(r.module) && !c.startsWith(`${code(r.module)}_`)) e.lovCode = `A ${code(r.module)} list must start with ${code(r.module)}_ (e.g. ${code(r.module)}_FIELD).`;
    if (!blank(r.parentValue) && blank(r.parentLovCode)) e.parentLovCode = 'Name the Parent LOV Code for this Parent Value.';
    if (!blank(r.parentLovCode) && blank(r.parentValue)) e.parentValue = 'Choose which Parent Value shows this value.';
    if (!blank(r.parentLovCode) && code(r.parentLovCode) === c) e.parentLovCode = 'A list cannot depend on itself.';
    return e;
  },
};

/** An active row (other than `record`) with the same list + value (and same parent value for dependent lists). */
export function findCommonLovConflict(masterId: string, record: Rec, others: Rec[]): string | null {
  if (masterId !== COMMON_LOV_ID || !isActive(record)) return null;
  const key = (r: Rec) => [code(r.lovCode), norm(r.parentValue), norm(r.value)].join('|');
  const clash = others.find((o) => o.id !== record.id && isActive(o) && key(o) === key(record));
  return clash ? `"${record.value}" is already in ${code(record.lovCode)}${blank(record.parentValue) ? '' : ` under "${record.parentValue}"`} (${clash.id}).` : null;
}

/** Problems across the whole Common LOV Master. */
export function commonLovHealthCheck(rows: Rec[], masters: MasterConfig[] = []): string[] {
  const issues: string[] = [];
  rows.forEach((r, i) => {
    Object.values(COMMON_LOV_RECORD_RULES[COMMON_LOV_ID](r)).forEach((e) => issues.push(`${r.id}: ${e}`));
    const clash = findCommonLovConflict(COMMON_LOV_ID, r, rows.slice(0, i));
    if (clash) issues.push(`${r.id}: ${clash}`);
  });
  // Same list, same field name and module on every row
  const byCode = new Map<string, Rec[]>();
  rows.forEach((r) => byCode.set(code(r.lovCode), [...(byCode.get(code(r.lovCode)) ?? []), r]));
  byCode.forEach((list, c) => {
    if (new Set(list.map((r) => norm(r.fieldName))).size > 1) issues.push(`${c}: rows have different Field Names — use one name per list.`);
    if (new Set(list.map((r) => code(r.module))).size > 1) issues.push(`${c}: rows have different Modules — use one module per list.`);
    if (!list.some(isActive)) issues.push(`${c}: no active value.`);
  });
  // Dependent lists: the parent list and value must exist and be active
  rows.filter((r) => isActive(r) && !blank(r.parentLovCode)).forEach((r) => {
    const parent = code(r.parentLovCode);
    if (!byCode.has(parent)) issues.push(`${r.id}: Parent LOV ${parent} does not exist.`);
    else if (!lovValues(rows, parent).some((v) => norm(v) === norm(r.parentValue)))
      issues.push(`${r.id}: "${r.parentValue}" is not an active value of ${parent}.`);
  });
  // Every master field that points to a list must find it
  masters.forEach((m) =>
    m.fields
      .filter((f) => f.lovCode && !byCode.has(code(f.lovCode)))
      .forEach((f) => issues.push(`${m.name} → ${f.label}: list ${code(f.lovCode)} is not in the Common LOV Master.`)),
  );
  return issues;
}
