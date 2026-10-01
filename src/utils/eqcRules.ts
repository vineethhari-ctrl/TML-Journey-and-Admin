/**
 * Electronic Quality Check (EQC) rules — pure functions over the EQC master records.
 *
 *  - Blank PPL = the row applies to every PPL. A PPL-specific row wins over a blank-PPL row.
 *  - Blank Km range = every odometer reading; a one-sided range is open on the other side.
 *  - Inactive rows (active = 'N') are ignored everywhere.
 */

type Rec = Record<string, any>;

export const EQC_MASTER_IDS = {
  mandate: 'eqc_gc_mandate',
  steps: 'eqc_gc_steps',
  ptd: 'eqc_ptd_risk',
  did: 'eqc_did_thresholds',
  general: 'eqc_general_checklist',
  schedule: 'eqc_schedule_checklist',
} as const;

const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === '';
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
const isActive = (r: Rec) => norm(r.active || 'Y') !== 'n';
const yes = (v: unknown) => norm(v) === 'y';

/** True when the row's PPL is blank (all PPLs) or equals the vehicle's PPL. */
export const pplMatches = (rulePpl: unknown, ppl: string) => blank(rulePpl) || norm(rulePpl) === norm(ppl);

/** Active rows for a key, with the PPL-specific ones if any exist, otherwise the all-PPL ones. */
function mostSpecific(rows: Rec[], ppl: string, sameKey: (r: Rec) => boolean): { rows: Rec[]; scope: 'PPL' | 'ALL' } {
  const candidates = rows.filter((r) => isActive(r) && sameKey(r));
  const specific = candidates.filter((r) => !blank(r.ppl) && norm(r.ppl) === norm(ppl));
  if (specific.length) return { rows: specific, scope: 'PPL' };
  return { rows: candidates.filter((r) => blank(r.ppl)), scope: 'ALL' };
}

// ---------------------------------------------------------------------------
// 1. Guided Check & Road Test mandate
// ---------------------------------------------------------------------------

export interface GcMandate {
  gcApplicable: boolean;
  gcMandatory: boolean;
  /** GC was mandatory but the "mandatory till" date has passed. */
  mandateExpired: boolean;
  gcMandatoryTill?: string;
  roadTestMandatory: boolean;
  scope: 'PPL' | 'ALL';
  ruleId: string;
}

export function resolveGcMandate(rows: Rec[], q: { ppl: string; complaintCode: string; date: string }): GcMandate | null {
  const { rows: hit, scope } = mostSpecific(rows, q.ppl, (r) => norm(r.complaintCode) === norm(q.complaintCode));
  const r = hit[0];
  if (!r) return null;
  const applicable = yes(r.gcApplicable);
  const till = blank(r.gcMandatoryTill) ? undefined : String(r.gcMandatoryTill);
  const expired = applicable && yes(r.gcMandatory) && !!till && q.date > till;
  return {
    gcApplicable: applicable,
    gcMandatory: applicable && yes(r.gcMandatory) && !expired,
    mandateExpired: expired,
    gcMandatoryTill: till,
    roadTestMandatory: yes(r.roadTestMandatory),
    scope,
    ruleId: String(r.id),
  };
}

// ---------------------------------------------------------------------------
// 2. Guided Check steps
// ---------------------------------------------------------------------------

export interface GcStep {
  stepNo: number;
  text: string;
  images: string[];
  ruleId: string;
}

export function resolveGcSteps(rows: Rec[], q: { ppl: string; complaintCode: string }): { steps: GcStep[]; scope: 'PPL' | 'ALL' } {
  const { rows: hit, scope } = mostSpecific(rows, q.ppl, (r) => norm(r.complaintCode) === norm(q.complaintCode));
  const steps = hit
    .map((r) => ({
      stepNo: Number(r.stepNo) || 0,
      text: String(r.gcStep ?? ''),
      images: [r.gcImage1, r.gcImage2].filter((x) => !blank(x)).map(String),
      ruleId: String(r.id),
    }))
    .sort((a, b) => a.stepNo - b.stepNo);
  return { steps, scope };
}

// ---------------------------------------------------------------------------
// 3. PTD risk
// ---------------------------------------------------------------------------

export type PtdRisk = 'Red' | 'Orange' | 'On Track';

export const thresholdMinutes = (r: Rec) => (Number(r.thresholdHrs) || 0) * 60 + (Number(r.thresholdMins) || 0);

/** Colour for the time left before the Promised Time of Delivery (negative = already late → Red). */
export function evaluatePtdRisk(rows: Rec[], minutesLeft: number): { risk: PtdRisk; thresholdMinutes?: number } {
  const active = rows.filter(isActive);
  const limit = (color: string) => {
    const r = active.find((x) => norm(x.colorCode) === color);
    return r ? thresholdMinutes(r) : undefined;
  };
  const red = limit('red');
  const orange = limit('orange');
  if (minutesLeft < 0 || (red !== undefined && minutesLeft <= red)) return { risk: 'Red', thresholdMinutes: red };
  if (orange !== undefined && minutesLeft <= orange) return { risk: 'Orange', thresholdMinutes: orange };
  return { risk: 'On Track' };
}

export const formatMinutes = (m: number) => `${Math.floor(Math.abs(m) / 60)}h ${String(Math.abs(m) % 60).padStart(2, '0')}m`;

// ---------------------------------------------------------------------------
// 4. DID parameter thresholds
// ---------------------------------------------------------------------------

export interface ExpectedRange {
  min?: number;
  max?: number;
  minExclusive?: boolean;
  maxExclusive?: boolean;
}

/** Parses "11.8-14.5", ">=20", "<=4.2", ">0", "<5" or "12". Returns null when the text isn't a valid range. */
export function parseExpectedRange(text: string): ExpectedRange | null {
  const t = String(text ?? '').trim();
  const num = '(-?\\d+(?:\\.\\d+)?)';
  let m = t.match(new RegExp(`^${num}\\s*-\\s*${num}$`));
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a <= b ? { min: a, max: b } : null;
  }
  m = t.match(new RegExp(`^(>=|<=|>|<)\\s*${num}$`));
  if (m) {
    const v = Number(m[2]);
    if (m[1] === '>=') return { min: v };
    if (m[1] === '>') return { min: v, minExclusive: true };
    if (m[1] === '<=') return { max: v };
    return { max: v, maxExclusive: true };
  }
  m = t.match(new RegExp(`^${num}$`));
  return m ? { min: Number(m[1]), max: Number(m[1]) } : null;
}

export function inRange(range: ExpectedRange, value: number): boolean {
  if (range.min !== undefined && (range.minExclusive ? value <= range.min : value < range.min)) return false;
  if (range.max !== undefined && (range.maxExclusive ? value >= range.max : value > range.max)) return false;
  return true;
}

export type DidStatus = 'OK' | 'NOT OK' | 'NO RULE';

export function checkDidValue(
  rows: Rec[],
  q: { parameterName: string; ppl: string; value: number }
): { status: DidStatus; expected?: string; unit?: string; scope?: 'PPL' | 'ALL'; ruleId?: string } {
  const { rows: hit, scope } = mostSpecific(rows, q.ppl, (r) => norm(r.parameterName) === norm(q.parameterName));
  const r = hit[0];
  const range = r ? parseExpectedRange(r.expectedValue) : null;
  if (!r || !range) return { status: 'NO RULE' };
  return { status: inRange(range, q.value) ? 'OK' : 'NOT OK', expected: String(r.expectedValue), unit: r.unit, scope, ruleId: String(r.id) };
}

/** Distinct DID parameter names (for pickers). */
export const didParameters = (rows: Rec[]) => [...new Set(rows.filter(isActive).map((r) => String(r.parameterName)))].sort();

// ---------------------------------------------------------------------------
// 5 & 6. General and Schedule checklists
// ---------------------------------------------------------------------------

export interface NotOkCapture {
  photo: boolean;
  audio: boolean;
  video: boolean;
  text: boolean;
}

export const notOkCapture = (r: Rec): NotOkCapture => ({
  photo: yes(r.notOkPhoto),
  audio: yes(r.notOkAudio),
  video: yes(r.notOkVideo),
  text: yes(r.notOkText),
});

export function kmMatches(r: Rec, km: number): boolean {
  if (!blank(r.rangeStartKm) && km < Number(r.rangeStartKm)) return false;
  if (!blank(r.rangeEndKm) && km > Number(r.rangeEndKm)) return false;
  return true;
}

/** Checklist rows that apply to a vehicle: same BU, PPL blank or equal, odometer inside the Km range. */
export function applicableChecklist(rows: Rec[], q: { bu: string; ppl: string; km: number }): Rec[] {
  return rows.filter((r) => isActive(r) && norm(r.bu) === norm(q.bu) && pplMatches(r.ppl, q.ppl) && kmMatches(r, q.km));
}

/** Schedule checklist grouped by Section (in first-seen order). */
export function groupBySection(rows: Rec[]): Array<{ section: string; items: Rec[] }> {
  const groups = new Map<string, Rec[]>();
  rows.forEach((r) => {
    const key = String(r.section ?? '');
    groups.set(key, [...(groups.get(key) ?? []), r]);
  });
  return [...groups].map(([section, items]) => ({ section, items }));
}

// ---------------------------------------------------------------------------
// Validation — single record (cross-field) and whole master (cross-record)
// ---------------------------------------------------------------------------

const rangeErrors = (r: Rec): Record<string, string> =>
  !blank(r.rangeStartKm) && !blank(r.rangeEndKm) && Number(r.rangeStartKm) > Number(r.rangeEndKm)
    ? { rangeEndKm: 'Range End Km must be greater than or equal to Range Start Km.' }
    : {};

const NOT_OK_KEYS = ['notOkPhoto', 'notOkAudio', 'notOkVideo', 'notOkText'];

/** Field-level business rules that look at more than one field of a record. */
export const EQC_RECORD_RULES: Record<string, (r: Rec) => Record<string, string>> = {
  [EQC_MASTER_IDS.mandate]: (r) => {
    const e: Record<string, string> = {};
    if (yes(r.gcMandatory) && !yes(r.gcApplicable)) e.gcMandatory = 'GC can only be mandatory when GC Applicable is Y.';
    if (!blank(r.gcMandatoryTill) && !yes(r.gcMandatory)) e.gcMandatoryTill = 'Set GC Mandatory Till only when GC Mandatory is Y.';
    return e;
  },
  [EQC_MASTER_IDS.did]: (r): Record<string, string> => (parseExpectedRange(r.expectedValue) ? {} : { expectedValue: 'Expected Value must be a valid range, limit or value (e.g. 11.8-14.5, >=20).' }),
  [EQC_MASTER_IDS.ptd]: (r): Record<string, string> => (thresholdMinutes(r) <= 0 ? { thresholdMins: 'Threshold must be more than 0 minutes.' } : {}),
  [EQC_MASTER_IDS.general]: (r) => {
    const e = rangeErrors(r);
    if (yes(r.active) && NOT_OK_KEYS.every((k) => !yes(r[k]))) e.notOkText = 'Choose at least one Not OK capture (Photo, Audio, Video or Text).';
    return e;
  },
  [EQC_MASTER_IDS.schedule]: (r) => {
    const e = rangeErrors(r);
    if (yes(r.active) && NOT_OK_KEYS.every((k) => !yes(r[k]))) e.notOkText = 'Choose at least one Not OK capture (Photo, Audio, Video or Text).';
    return e;
  },
};

export function validateEqcRecord(masterId: string, record: Rec): Record<string, string> {
  return EQC_RECORD_RULES[masterId]?.(record) ?? {};
}

const dupKey = (r: Rec, keys: string[]) => keys.map((k) => norm(r[k])).join('|');

/** Rows (other than `record`) that clash with it in the same master. */
export function findEqcConflict(masterId: string, record: Rec, others: Rec[]): string | null {
  const rest = others.filter((o) => o.id !== record.id && isActive(o));
  if (!isActive(record)) return null;
  const keyed = (keys: string[], what: string) => {
    const clash = rest.find((o) => dupKey(o, keys) === dupKey(record, keys));
    return clash ? `${what} already exists in ${clash.id}.` : null;
  };
  switch (masterId) {
    case EQC_MASTER_IDS.mandate:
      return keyed(['ppl', 'complaintCode'], `A rule for ${record.ppl || 'all PPLs'} + ${record.complaintCode}`);
    case EQC_MASTER_IDS.steps:
      return keyed(['ppl', 'complaintCode', 'stepNo'], `Step ${record.stepNo} for ${record.ppl || 'all PPLs'} + ${record.complaintCode}`);
    case EQC_MASTER_IDS.did:
      return keyed(['parameterName', 'ppl'], `A threshold for ${record.parameterName} (${record.ppl || 'all PPLs'})`);
    case EQC_MASTER_IDS.ptd: {
      const same = keyed(['colorCode'], `An active ${record.colorCode} threshold`);
      if (same) return same;
      const other = rest.find((o) => norm(o.colorCode) !== norm(record.colorCode));
      if (!other) return null;
      const red = norm(record.colorCode) === 'red' ? record : other;
      const orange = red === record ? other : record;
      return thresholdMinutes(red) < thresholdMinutes(orange)
        ? null
        : `Red threshold (${formatMinutes(thresholdMinutes(red))}) must be lower than Orange (${formatMinutes(thresholdMinutes(orange))}).`;
    }
    default:
      return null;
  }
}

/** Every problem across the EQC masters — catches data that arrived by bulk import too. */
export function eqcHealthCheck(records: Record<string, Rec[]>): string[] {
  const issues: string[] = [];
  Object.entries(records).forEach(([masterId, rows]) => {
    rows.forEach((r, i) => {
      Object.values(validateEqcRecord(masterId, r)).forEach((e) => issues.push(`${masterId} ${r.id}: ${e}`));
      // Report each clash once (against earlier rows only)
      const clash = findEqcConflict(masterId, r, rows.slice(0, i));
      if (clash) issues.push(`${masterId} ${r.id}: ${clash}`);
    });
  });
  const steps = records[EQC_MASTER_IDS.steps] ?? [];
  (records[EQC_MASTER_IDS.mandate] ?? [])
    .filter((m) => isActive(m) && yes(m.gcApplicable))
    .forEach((m) => {
      const has = steps.some((s) => isActive(s) && norm(s.complaintCode) === norm(m.complaintCode) && (blank(s.ppl) || norm(s.ppl) === norm(m.ppl)));
      if (!has) issues.push(`${EQC_MASTER_IDS.mandate} ${m.id}: GC is applicable for ${m.ppl || 'all PPLs'} + ${m.complaintCode} but no GC steps are defined.`);
    });
  return issues;
}
