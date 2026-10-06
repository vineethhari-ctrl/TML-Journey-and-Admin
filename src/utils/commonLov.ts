/**
 * Reading and checking the Common LOV Master (src/data/commonLov.ts). Only Active rows are offered in dropdowns.
 */
import type { MasterConfig, MasterFieldDef } from '../data/masterCatalogue';
import { DUPLICATE_RECORD_MESSAGE } from './recordDuplicates';
import { COMMON_LOV_ID, LIC_PATTERN, LOV_CODE_PATTERN, LOV_DEFINITIONS, licFor } from '../data/commonLov';

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
const LIC = new RegExp(LIC_PATTERN);

/** Field rules for one Common LOV row (run on save and on Excel import). */
export const COMMON_LOV_RECORD_RULES: Record<string, (r: Rec) => Record<string, string>> = {
  [COMMON_LOV_ID]: (r) => {
    const e: Record<string, string> = {};
    const c = code(r.lovCode);
    if (c && !PATTERN.test(c)) e.lovCode = 'Use <MODULE>_<FIELD> in capitals, e.g. THD_COMPLAINT_TYPE.';
    else if (c && !blank(r.module) && !c.startsWith(`${code(r.module)}_`)) e.lovCode = `A ${code(r.module)} list must start with ${code(r.module)}_ (e.g. ${code(r.module)}_FIELD).`;
    if (!blank(r.lic) && !LIC.test(String(r.lic).trim())) e.lic = 'Capitals, digits and _ only, e.g. WORK_IN_PROCESS.';
    if (!blank(r.parentValue) && blank(r.parentLovCode)) e.parentLovCode = 'Name the Parent LOV Code for this Parent Value.';
    if (!blank(r.parentLovCode) && blank(r.parentValue)) e.parentValue = 'Choose which Parent Value shows this value.';
    if (!blank(r.parentLovCode) && code(r.parentLovCode) === c) e.parentLovCode = 'A list cannot depend on itself.';
    return e;
  },
};

/** An active row (other than `record`) with the same list + value or Code (LIC) (same parent value for dependent lists). */
export function findCommonLovConflict(masterId: string, record: Rec, others: Rec[]): string | null {
  if (masterId !== COMMON_LOV_ID || !isActive(record)) return null;
  const scope = (r: Rec) => `${code(r.lovCode)}|${norm(r.parentValue)}`;
  const peers = others.filter((o) => o.id !== record.id && isActive(o) && scope(o) === scope(record));
  const under = blank(record.parentValue) ? '' : ` under "${record.parentValue}"`;
  const sameValue = peers.find((o) => norm(o.value) === norm(record.value));
  if (sameValue) return `${DUPLICATE_RECORD_MESSAGE}: "${record.value}" is already in ${code(record.lovCode)}${under} (${sameValue.id}).`;
  const sameLic = blank(record.lic) ? undefined : peers.find((o) => code(o.lic) === code(record.lic));
  return sameLic ? `${DUPLICATE_RECORD_MESSAGE}: Code ${code(record.lic)} is already used in ${code(record.lovCode)}${under} (${sameLic.id}).` : null;
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

// ---------------------------------------------------------------------------
// List of Values screen (Siebel-style): edit one LOV Type and its values, then save
// ---------------------------------------------------------------------------

export interface LovTypeHeader {
  code: string;
  module: string;
  fieldName: string;
  /** Parent LOV Type for dependent dropdowns ('' when none). */
  parentCode: string;
}

/** Key in the error map for problems with the LOV Type itself. */
export const LOV_TYPE_ERRORS = '__type';

/**
 * Replace the rows of one LOV Type with the edited values. Order follows the row position (per parent value), a blank
 * Code (LIC) is proposed from the Display Value, and new rows get the next `<TYPE>-NN` id. Returns per-row errors
 * (keyed by row id, LOV_TYPE_ERRORS for the type); nothing should be saved while there are errors.
 */
export function applyLovTypeDraft(
  all: Rec[],
  originalCode: string | null,
  header: LovTypeHeader,
  draft: Rec[],
): { records: Rec[]; errors: Record<string, Record<string, string>> } {
  const errors: Record<string, Record<string, string>> = {};
  const typeCode = code(header.code);
  const parentCode = code(header.parentCode);
  const typeErrors: Record<string, string> = {};
  if (!PATTERN.test(typeCode)) typeErrors.code = 'Use <MODULE>_<FIELD> in capitals, e.g. THD_COMPLAINT_TYPE.';
  else if (!typeCode.startsWith(`${code(header.module)}_`)) typeErrors.code = `A ${code(header.module)} list must start with ${code(header.module)}_.`;
  if (blank(header.fieldName)) typeErrors.fieldName = 'Enter the Field Name users see on the screen.';
  if (code(originalCode) !== typeCode && all.some((r) => code(r.lovCode) === typeCode)) typeErrors.code = `${typeCode} already exists.`;
  if (parentCode && parentCode === typeCode) typeErrors.parentCode = 'A list cannot depend on itself.';
  if (!draft.length) typeErrors.values = 'Add at least one value.';
  if (Object.keys(typeErrors).length) errors[LOV_TYPE_ERRORS] = typeErrors;

  const kept = all.filter((r) => code(r.lovCode) !== code(originalCode ?? typeCode));
  const usedIds = new Set(all.map((r) => String(r.id)));
  let next = Math.max(0, ...all.filter((r) => code(r.lovCode) === typeCode).map((r) => Number(String(r.id).split('-').at(-1)) || 0));
  const position: Record<string, number> = {};
  const rows = draft.map((d) => {
    const parentValue = parentCode ? String(d.parentValue ?? '').trim() : '';
    position[parentValue] = (position[parentValue] ?? 0) + 1;
    let id = String(d.id ?? '');
    if (!id || d._new) {
      do id = `${typeCode}-${String(++next).padStart(2, '0')}`;
      while (usedIds.has(id));
      usedIds.add(id);
    }
    const value = String(d.value ?? '').trim();
    return {
      _key: String(d.id ?? id),
      id,
      lovCode: typeCode,
      module: code(header.module),
      fieldName: String(header.fieldName).trim(),
      value,
      lic: blank(d.lic) ? licFor(value) : code(d.lic),
      order: position[parentValue],
      parentLovCode: parentCode,
      parentValue,
      description: String(d.description ?? '').trim(),
      status: isActive(d) ? 'Active' : 'Inactive',
    };
  });
  const parentValues = parentCode ? lovValues(all, parentCode).map(norm) : [];
  rows.forEach((r, i) => {
    const e: Record<string, string> = {};
    if (blank(r.value)) e.value = 'Enter the Display Value.';
    Object.assign(e, COMMON_LOV_RECORD_RULES[COMMON_LOV_ID](r));
    delete e.lovCode;
    if (parentCode && isActive(r) && !parentValues.includes(norm(r.parentValue))) e.parentValue = `Choose an active value of ${parentCode}.`;
    const clash = !blank(r.value) && findCommonLovConflict(COMMON_LOV_ID, r, rows.slice(0, i));
    if (clash) e[clash.includes(': Code ') ? 'lic' : 'value'] = clash.replace(/ \([^)]*\)\.$/, '.');
    if (Object.keys(e).length) errors[r._key] = e;
  });
  return { records: [...kept, ...rows.map(({ _key, ...r }) => r)], errors };
}
