/**
 * No-code business rules for any master ("Rules" tab).
 *
 * A rule is plain data stored with the master (MasterConfig.rules), picked from a fixed list of rule types and filled in
 * on screen or in the BA workbook "Rules" sheet. The same checks run on every save, Ctrl+S, inline copy / new row,
 * Excel upload and BA workbook import. Nothing here calls a server or any AI: it is ordinary, deterministic code.
 */
import type { MasterConfig, MasterFieldDef } from '../data/masterCatalogue';
import { masterValidationSchema } from './masterValidationSchema';

type Rec = Record<string, any>;

export type MasterRuleType = 'required_if' | 'unique' | 'not_greater' | 'allowed_if' | 'exists_in' | 'range' | 'pattern';

export interface MasterRule {
  id: string;
  type: MasterRuleType;
  enabled: boolean;
  /** error = the row cannot be saved; warning = saved, but the user is told. */
  severity: 'error' | 'warning';
  /** Optional wording shown to users instead of the generated sentence. */
  message?: string;
  /** Field the rule is about (required_if: the field that becomes required; not_greater: the smaller one). */
  field?: string;
  /** unique: the combination that must not repeat. */
  fields?: string[];
  /** Condition (required_if / allowed_if): when this field has one of these values. Empty whenValues = "is filled". */
  whenField?: string;
  whenValues?: string[];
  /** not_greater: the field that must be greater than or equal to `field`. */
  otherField?: string;
  /** allowed_if: values `field` may take while the condition holds. */
  values?: string[];
  /** range */
  min?: number;
  max?: number;
  /** pattern (regular expression, whole value) */
  pattern?: string;
  /** exists_in: the value must exist in this master's field (active rows). */
  refMaster?: string;
  refField?: string;
}

export interface RuleTypeInfo {
  type: MasterRuleType;
  title: string;
  /** One line for business users. */
  hint: string;
  example: string;
}

export const RULE_TYPES: RuleTypeInfo[] = [
  { type: 'required_if', title: 'Required when…', hint: 'A field must be filled when another field has a certain value.', example: 'Plant Name is required when Role is Plant.' },
  { type: 'unique', title: 'No duplicates', hint: 'No two active rows may have the same values in these fields.', example: 'PPL + Complaint Code must be unique.' },
  { type: 'not_greater', title: 'From ≤ To', hint: 'One number or date must not be greater than another.', example: 'From Km must not be greater than To Km.' },
  { type: 'allowed_if', title: 'Allowed values depend on another field', hint: 'While a condition holds, a field may only take some values.', example: 'When BU is EV, Powertrain may only be EV.' },
  { type: 'exists_in', title: 'Must exist in another master', hint: 'The value must be an active value of a field in another master.', example: 'Dealer Code must exist in the Dealer Registry.' },
  { type: 'range', title: 'Number between', hint: 'A number must be within a minimum and / or maximum.', example: 'Warranty Months between 0 and 120.' },
  { type: 'pattern', title: 'Format', hint: 'A text must follow a fixed pattern.', example: 'Dealer Code: 3 capitals, a hyphen and 3 digits.' },
];

export const PATTERN_PRESETS: Array<[string, string]> = [
  ['^[A-Z0-9_-]+$', 'Capitals, digits, - and _ only'],
  ['^[A-Z]{3}-\\d{3}$', '3 capitals, hyphen, 3 digits (ABC-123)'],
  ['^\\d+$', 'Digits only'],
  ['^[A-Z0-9]{17}$', 'VIN / Chassis (17 capitals or digits)'],
  ['^[6-9]\\d{9}$', 'Indian mobile number (10 digits)'],
  ['^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', 'E-mail address'],
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === '';
const norm = (v: unknown) => (typeof v === 'boolean' ? (v ? 'y' : 'n') : String(v ?? '').trim().toLowerCase());
const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = String(v ?? '').trim();
  return t !== '' && /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};
const isoDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}/.test(String(v ?? '').trim());

/** A row counts as active unless its Status is Inactive or its Active flag is N / false. */
export function isActiveRow(r: Rec): boolean {
  if (r.status !== undefined && norm(r.status) === 'inactive') return false;
  if (r.active !== undefined && ['n', 'no', 'false', 'inactive'].includes(norm(r.active))) return false;
  return true;
}

const labelOf = (master: MasterConfig, key?: string) => master.fields.find((f) => f.key === key)?.label ?? key ?? '?';
const list = (vals: string[] = []) => vals.map((v) => `"${v}"`).join(' or ');
const whenText = (master: MasterConfig, r: MasterRule) =>
  r.whenValues?.length ? `${labelOf(master, r.whenField)} is ${list(r.whenValues)}` : `${labelOf(master, r.whenField)} is filled`;

/** The rule in one plain sentence (used in the Rules tab, errors and the BA workbook). */
export function describeRule(r: MasterRule, master: MasterConfig, masters: MasterConfig[] = []): string {
  switch (r.type) {
    case 'required_if':
      return `${labelOf(master, r.field)} is required when ${whenText(master, r)}.`;
    case 'unique':
      return `${(r.fields ?? []).map((k) => labelOf(master, k)).join(' + ')} must be unique among active rows.`;
    case 'not_greater':
      return `${labelOf(master, r.field)} must not be greater than ${labelOf(master, r.otherField)}.`;
    case 'allowed_if':
      return `When ${whenText(master, r)}, ${labelOf(master, r.field)} may only be ${list(r.values)}.`;
    case 'exists_in': {
      const ref = masters.find((m) => m.id === r.refMaster);
      return `${labelOf(master, r.field)} must exist in ${ref?.name ?? r.refMaster} → ${ref ? labelOf(ref, r.refField) : r.refField}.`;
    }
    case 'range': {
      const lo = r.min !== undefined && r.min !== null && String(r.min) !== '';
      const hi = r.max !== undefined && r.max !== null && String(r.max) !== '';
      const what = labelOf(master, r.field);
      if (lo && hi) return `${what} must be between ${r.min} and ${r.max}.`;
      return lo ? `${what} must be at least ${r.min}.` : `${what} must be at most ${r.max}.`;
    }
    case 'pattern': {
      const preset = PATTERN_PRESETS.find(([p]) => p === r.pattern)?.[1];
      return `${labelOf(master, r.field)} must match the format ${preset ? `"${preset}"` : r.pattern}.`;
    }
  }
}

// ---------------------------------------------------------------------------
// Rule definitions: checked before a rule is saved (screen or BA workbook)
// ---------------------------------------------------------------------------

export function validateRuleDefinition(r: MasterRule, master: MasterConfig, masters: MasterConfig[] = []): string[] {
  const errs: string[] = [];
  const has = (k?: string) => !!k && master.fields.some((f) => f.key === k);
  const need = (k: string | undefined, what: string) => {
    if (!k) errs.push(`Choose the ${what}.`);
    else if (!has(k)) errs.push(`"${k}" is not a field of ${master.name}.`);
  };
  if (!RULE_TYPES.some((t) => t.type === r.type)) return [`Unknown rule type "${r.type}".`];
  if (!['error', 'warning'].includes(r.severity)) errs.push('Severity must be error or warning.');
  switch (r.type) {
    case 'required_if':
      need(r.field, 'field that becomes required');
      need(r.whenField, 'condition field');
      if (r.field && r.field === r.whenField) errs.push('The condition must use a different field.');
      break;
    case 'unique':
      if (!r.fields?.length) errs.push('Choose at least one field.');
      (r.fields ?? []).forEach((k) => need(k, 'field'));
      break;
    case 'not_greater':
      need(r.field, 'smaller field');
      need(r.otherField, 'larger field');
      if (r.field && r.field === r.otherField) errs.push('Choose two different fields.');
      break;
    case 'allowed_if':
      need(r.field, 'field whose values are limited');
      need(r.whenField, 'condition field');
      if (!r.values?.length) errs.push('List the allowed values.');
      if (r.field && r.field === r.whenField) errs.push('The condition must use a different field.');
      break;
    case 'exists_in': {
      need(r.field, 'field');
      const ref = masters.find((m) => m.id === r.refMaster);
      if (!r.refMaster) errs.push('Choose the other master.');
      else if (!ref) errs.push(`Master "${r.refMaster}" does not exist.`);
      else if (!r.refField || !ref.fields.some((f) => f.key === r.refField)) errs.push(`Choose a field of ${ref.name}.`);
      break;
    }
    case 'range': {
      need(r.field, 'field');
      const lo = num(r.min);
      const hi = num(r.max);
      if (lo === null && hi === null) errs.push('Enter a minimum, a maximum or both.');
      if (lo !== null && hi !== null && lo > hi) errs.push('Minimum must not be greater than maximum.');
      break;
    }
    case 'pattern':
      need(r.field, 'field');
      if (!r.pattern) errs.push('Choose or type a format.');
      else
        try {
          new RegExp(r.pattern);
        } catch {
          errs.push('The format is not valid.');
        }
      break;
  }
  return errs;
}

// ---------------------------------------------------------------------------
// Checking a record
// ---------------------------------------------------------------------------

export interface RuleViolation {
  ruleId: string;
  severity: 'error' | 'warning';
  /** Field to highlight. */
  field: string;
  message: string;
}

export interface RuleContext {
  /** The other rows of the same master (for "No duplicates"). */
  others?: Rec[];
  /** All masters (for "Must exist in another master"). */
  masters?: MasterConfig[];
}

const conditionHolds = (r: MasterRule, rec: Rec) =>
  r.whenValues?.length ? r.whenValues.some((v) => norm(v) === norm(rec[r.whenField!])) : !blank(rec[r.whenField!]);

/** Violations of the master's enabled rules by one record. Blank values are left to "Mandatory" and "Required when". */
export function evaluateRules(master: MasterConfig, rec: Rec, ctx: RuleContext = {}): RuleViolation[] {
  const out: RuleViolation[] = [];
  const masters = ctx.masters ?? [];
  (master.rules ?? [])
    .filter((r) => r.enabled !== false)
    .forEach((r) => {
      const fail = (field: string) => out.push({ ruleId: r.id, severity: r.severity, field, message: r.message?.trim() || describeRule(r, master, masters) });
      const v = r.field ? rec[r.field] : undefined;
      switch (r.type) {
        case 'required_if':
          if (conditionHolds(r, rec) && blank(v)) fail(r.field!);
          break;
        case 'unique': {
          const keys = r.fields ?? [];
          if (!keys.length || !isActiveRow(rec) || keys.every((k) => blank(rec[k]))) break;
          const key = (x: Rec) => keys.map((k) => norm(x[k])).join('|');
          if ((ctx.others ?? []).some((o) => o.id !== rec.id && isActiveRow(o) && key(o) === key(rec))) fail(keys[keys.length - 1]);
          break;
        }
        case 'not_greater': {
          const b = rec[r.otherField!];
          if (blank(v) || blank(b)) break;
          const [x, y] = [num(v), num(b)];
          if (x !== null && y !== null ? x > y : isoDate(v) && isoDate(b) && String(v) > String(b)) fail(r.field!);
          break;
        }
        case 'allowed_if':
          if (!blank(v) && conditionHolds(r, rec) && !(r.values ?? []).some((a) => norm(a) === norm(v))) fail(r.field!);
          break;
        case 'exists_in': {
          if (blank(v)) break;
          const ref = masters.find((m) => m.id === r.refMaster);
          if (ref && !ref.records.some((x) => isActiveRow(x) && norm(x[r.refField!]) === norm(v))) fail(r.field!);
          break;
        }
        case 'range': {
          if (blank(v)) break;
          const x = num(v);
          const lo = num(r.min);
          const hi = num(r.max);
          if (x === null || (lo !== null && x < lo) || (hi !== null && x > hi)) fail(r.field!);
          break;
        }
        case 'pattern':
          if (!blank(v) && r.pattern) {
            try {
              if (!new RegExp(`^(?:${r.pattern.replace(/^\^|\$$/g, '')})$`).test(String(v).trim())) fail(r.field!);
            } catch {
              /* an invalid pattern is reported by validateRuleDefinition */
            }
          }
          break;
      }
    });
  return out;
}

export interface RecordCheck {
  isValid: boolean;
  /** Field errors, then rule errors (one message per field). */
  errors: Record<string, string>;
  warnings: string[];
  sanitizedRecord: Rec;
}

/**
 * The single check for a record of any master: field types and mandatory values, the built-in rules of that master,
 * then the master's own no-code rules. Rules run only when the fields themselves are valid.
 */
export function checkRecord(master: MasterConfig, rec: Rec, ctx: RuleContext = {}): RecordCheck {
  const base = masterValidationSchema.validateRecord(master.fields, rec, master.id);
  const errors = { ...base.errors };
  const warnings: string[] = [];
  if (base.isValid) {
    evaluateRules(master, base.sanitizedRecord, ctx).forEach((v) => {
      if (v.severity === 'warning') warnings.push(v.message);
      else if (!errors[v.field]) errors[v.field] = v.message;
      else errors[`${v.field}__${v.ruleId}`] = v.message;
    });
  }
  return { isValid: Object.keys(errors).length === 0, errors, warnings, sanitizedRecord: base.sanitizedRecord };
}

/** Rows that break each rule today ("Check current rows"). */
export function ruleReport(master: MasterConfig, masters: MasterConfig[] = []): Array<{ rule: MasterRule; failing: Array<{ id: string; message: string }> }> {
  return (master.rules ?? []).map((rule) => {
    const only = { ...master, rules: [{ ...rule, enabled: true }] };
    const failing = master.records
      .map((rec) => ({ rec, v: evaluateRules(only, rec, { others: master.records, masters }) }))
      .filter((x) => x.v.length)
      .map((x) => ({ id: String(x.rec.id), message: x.v[0].message }));
    return { rule, failing };
  });
}

/** Values to offer for a condition / allowed-values picker. */
export function fieldChoices(f?: MasterFieldDef): string[] {
  if (!f) return [];
  if (f.type === 'boolean') return ['Y', 'N'];
  return f.options ?? [];
}

let seq = 0;
export const newRuleId = () => `RULE-${Date.now().toString(36).toUpperCase()}${(++seq).toString(36).toUpperCase()}`;

// ---------------------------------------------------------------------------
// BA workbook "Rules" sheet: one row per rule
// ---------------------------------------------------------------------------

export const RULES_SHEET = 'Rules';
export const RULE_COLUMNS = [
  'Master ID',
  'Rule Type',
  'Field',
  'Fields (No duplicates)',
  'When Field',
  'When Values',
  'Other Field',
  'Allowed Values',
  'Min',
  'Max',
  'Format',
  'Other Master',
  'Other Master Field',
  'Severity',
  'Message',
  'Enabled',
] as const;

const cell = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());
const splitCsv = (v: unknown) => cell(v).split(',').map((s) => s.trim()).filter(Boolean);
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Rule → workbook row (field keys, comma-separated lists). */
export function ruleToRow(masterId: string, r: MasterRule): Array<string | number> {
  return [
    masterId,
    r.type,
    r.field ?? '',
    (r.fields ?? []).join(', '),
    r.whenField ?? '',
    (r.whenValues ?? []).join(', '),
    r.otherField ?? '',
    (r.values ?? []).join(', '),
    r.min ?? '',
    r.max ?? '',
    r.pattern ?? '',
    r.refMaster ?? '',
    r.refField ?? '',
    r.severity,
    r.message ?? '',
    r.enabled === false ? 'N' : 'Y',
  ];
}

/**
 * Workbook row → rule. Rule Type may be the code (required_if) or the title ("Required when…");
 * fields may be given by key or by label. Returns problems instead of throwing.
 */
export function ruleFromRow(row: Record<string, unknown>, master: MasterConfig, masters: MasterConfig[]): { rule?: MasterRule; errors: string[] } {
  const typeText = squash(cell(row['Rule Type']));
  const info = RULE_TYPES.find((t) => squash(t.type) === typeText || squash(t.title) === typeText);
  if (!info) return { errors: [`Rule Type "${cell(row['Rule Type'])}" is not one of: ${RULE_TYPES.map((t) => t.type).join(', ')}.`] };
  const keyOf = (v: string, m: MasterConfig = master) => (v ? m.fields.find((f) => squash(f.key) === squash(v) || squash(f.label) === squash(v))?.key ?? v : undefined);
  const ref = masters.find((m) => squash(m.id) === squash(cell(row['Other Master'])) || squash(m.name) === squash(cell(row['Other Master'])));
  const sev = squash(cell(row['Severity']));
  const numOrUndef = (v: unknown) => (cell(v) === '' ? undefined : Number(cell(v)));
  const rule: MasterRule = {
    id: newRuleId(),
    type: info.type,
    enabled: !['n', 'no', 'false'].includes(squash(cell(row['Enabled']))),
    severity: sev === 'warning' || sev === 'warn' ? 'warning' : 'error',
    message: cell(row['Message']) || undefined,
    field: keyOf(cell(row['Field'])),
    fields: splitCsv(row['Fields (No duplicates)']).map((f) => keyOf(f)!),
    whenField: keyOf(cell(row['When Field'])),
    whenValues: splitCsv(row['When Values']),
    otherField: keyOf(cell(row['Other Field'])),
    values: splitCsv(row['Allowed Values']),
    min: numOrUndef(row['Min']),
    max: numOrUndef(row['Max']),
    pattern: cell(row['Format']) || undefined,
    refMaster: ref?.id ?? (cell(row['Other Master']) || undefined),
    refField: ref ? keyOf(cell(row['Other Master Field']), ref) : cell(row['Other Master Field']) || undefined,
  };
  if ((rule.min !== undefined && Number.isNaN(rule.min)) || (rule.max !== undefined && Number.isNaN(rule.max))) return { errors: ['Min / Max must be numbers.'] };
  const errors = validateRuleDefinition(rule, master, masters);
  return errors.length ? { errors } : { rule, errors: [] };
}

/** Same rule (ignoring id, message, severity and on/off) — used to avoid adding a rule twice. */
export const sameRule = (a: MasterRule, b: MasterRule) => {
  const strip = ({ id: _i, message: _m, severity: _s, enabled: _e, ...rest }: MasterRule) => JSON.stringify(rest, Object.keys(rest).sort());
  return strip(a) === strip(b);
};
