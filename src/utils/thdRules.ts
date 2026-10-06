/**
 * THD (Technical Help Desk) rules — pure functions over the THD master records.
 *
 *  - Only rows with Status = Active are used.
 *  - A critical complaint applies to its PPL only (BA: mapped per PPL as in the CRM master). A row without a PPL
 *    never raises a case; it is reported as pending until its PPL is mapped.
 *  - An auto-trigger rule whose Time Window is blank (X / Y still pending from business) never fires;
 *    it is reported as pending instead.
 */

import { COMMON_LOV_ID } from '../data/commonLov';
import { lovValues } from './commonLov';

type Rec = Record<string, any>;

export const THD_MASTER_IDS = {
  triggers: 'thd_auto_trigger_rules',
  critical: 'thd_critical_complaints',
  kmsRange: 'thd_kms_range',
  vehicleAge: 'thd_vehicle_age',
  users: 'thd_users',
} as const;

/** THD dropdown lists in the Common LOV Master (src/data/commonLov.ts). */
export const THD_LOV = {
  progress: 'THD_PROGRESS',
  subStatus: 'THD_PROGRESS_SUB_STATUS',
  complaintType: 'THD_COMPLAINT_TYPE',
  shortDescription: 'THD_COMPLAINT_SHORT_DESC',
  actionTaken: 'THD_ACTION_TAKEN',
  delayReason: 'THD_DELAY_REASON',
  closureAction: 'THD_CLOSURE_ACTION',
  attachmentType: 'THD_ATTACHMENT_TYPE',
} as const;

const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === '';
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
export const isActive = (r: Rec) => norm(r.status || 'Active') === 'active';
const list = (text: unknown) => String(text ?? '').split(',').map((s) => s.trim()).filter(Boolean);


/** Active sub-statuses for a progress, in order (`lov` = Common LOV Master rows). */
export const subStatusesFor = (lov: Rec[], progress: string): string[] => lovValues(lov, THD_LOV.subStatus, progress);

/** The active critical-complaint row for this PPL + code, or null. */
export function criticalComplaint(rows: Rec[], q: { ppl: string; complaintCode: string }): Rec | null {
  return (
    rows.find(
      (r) => isActive(r) && norm(r.critical) === 'y' && !blank(r.ppl) && norm(r.ppl) === norm(q.ppl) && norm(r.complaintCode) === norm(q.complaintCode),
    ) ?? null
  );
}

/** Active critical complaints that cannot fire yet because no PPL is mapped. */
export const criticalWithoutPpl = (rows: Rec[]): Rec[] => rows.filter((r) => isActive(r) && norm(r.critical) === 'y' && blank(r.ppl));

/** Labels of the active filter ranges that contain `value` (e.g. km or vehicle age). */
export const rangesContaining = (rows: Rec[], value: number, from: string, to: string): string[] =>
  rows.filter((r) => isActive(r) && value >= Number(r[from]) && value <= Number(r[to])).map((r) => String(r.label));

// ---------------------------------------------------------------------------
// Auto-THD trigger rules
// ---------------------------------------------------------------------------

/** What the dealer system knows about the job card / THD case when it checks the rules. */
export interface ThdEvent {
  ppl: string;
  complaintCodes: string[];
  /** Aggregates of the complaint codes in this job card (for the repeat rule). */
  aggregates?: string[];
  previousJobCard?: { daysSinceClosure: number; aggregates: string[] };
  /** Hours since a critical complaint was added after JC creation (undefined = not added later). */
  hoursSinceCriticalAddedLater?: number;
  jobCardOpenHours?: number;
  delayReason?: string;
  qiMarkedThdRequired?: boolean;
  openEscalation?: boolean;
  criticalDtcReceived?: boolean;
  /** Hours an existing THD case has been unattended by DET. */
  thdUnattendedHours?: number;
}

export interface ThdTriggerResult {
  rule: Rec;
  reason: string;
}

/** The rule's window in hours, or null when it is still pending from business. */
export const windowHours = (rule: Rec): number | null =>
  blank(rule.windowValue) ? null : Number(rule.windowValue) * (norm(rule.windowUnit) === 'days' ? 24 : 1);

const NEEDS_WINDOW = new Set(['REPEAT_COMPLAINT', 'CRITICAL_AFTER_JC_CREATION', 'DELAY_REASON', 'THD_UNATTENDED']);

/** Active rules whose Time Window is still blank (X / Y pending from business). */
export const pendingTriggerRules = (rules: Rec[]): Rec[] =>
  rules.filter((r) => isActive(r) && NEEDS_WINDOW.has(String(r.scenarioCode)) && windowHours(r) === null);

/** Which auto-THD rules fire for this event, and which would apply but are still pending a value. */
export function evaluateAutoThd(rules: Rec[], criticalRows: Rec[], e: ThdEvent): { fired: ThdTriggerResult[]; pending: ThdTriggerResult[] } {
  const fired: ThdTriggerResult[] = [];
  const pending: ThdTriggerResult[] = [];
  const critical = e.complaintCodes.map((c) => criticalComplaint(criticalRows, { ppl: e.ppl, complaintCode: c })).filter(Boolean) as Rec[];
  const criticalText = critical.map((c) => c.complaintCode).join(', ');

  rules
    .filter(isActive)
    .sort((a, b) => (Number(a.ruleNo) || 0) - (Number(b.ruleNo) || 0))
    .forEach((rule) => {
      const hrs = windowHours(rule);
      const needsWindow = NEEDS_WINDOW.has(String(rule.scenarioCode));
      const check = (applies: boolean, met: (h: number) => boolean, reason: string) => {
        if (!applies) return;
        if (needsWindow && hrs === null) pending.push({ rule, reason: `Would apply, but the Time Window is still pending from business.` });
        else if (met(hrs ?? 0)) fired.push({ rule, reason });
      };
      switch (rule.scenarioCode) {
        case 'REPEAT_COMPLAINT': {
          const prev = e.previousJobCard;
          const same = prev ? (e.aggregates ?? []).filter((a) => prev.aggregates.some((p) => norm(p) === norm(a))) : [];
          check(!!prev && same.length > 0, (h) => prev!.daysSinceClosure * 24 <= h, `Repeat visit after ${prev?.daysSinceClosure} day(s) with the same aggregate (${same.join(', ')}).`);
          break;
        }
        case 'CRITICAL_AT_JC_CREATION':
          check(critical.length > 0 && e.hoursSinceCriticalAddedLater === undefined, () => true, `Critical complaint ${criticalText} in the Job Card.`);
          break;
        case 'CRITICAL_AFTER_JC_CREATION':
          check(critical.length > 0 && e.hoursSinceCriticalAddedLater !== undefined, (h) => e.hoursSinceCriticalAddedLater! >= h, `Critical complaint ${criticalText} added ${e.hoursSinceCriticalAddedLater} h after JC creation.`);
          break;
        case 'DELAY_REASON': {
          const reasons = list(rule.triggerValues);
          const match = !!e.delayReason && reasons.some((r) => norm(r) === norm(e.delayReason));
          check(match && e.jobCardOpenHours !== undefined, (h) => e.jobCardOpenHours! > h, `Job Card open ${e.jobCardOpenHours} h with delay reason "${e.delayReason}".`);
          break;
        }
        case 'QI_THD_REQUIRED':
          check(!!e.qiMarkedThdRequired, () => true, 'Quality Inspector marked THD Required.');
          break;
        case 'OPEN_ESCALATION':
          check(!!e.openEscalation, () => true, 'Open escalated complaint on this chassis.');
          break;
        case 'CRITICAL_DTC':
          check(!!e.criticalDtcReceived, () => true, 'Critical DTC received from the Connected Cloud platform.');
          break;
        case 'THD_UNATTENDED':
          check(e.thdUnattendedHours !== undefined, (h) => e.thdUnattendedHours! > h, `THD case unattended for ${e.thdUnattendedHours} h.`);
          break;
      }
    });
  return { fired, pending };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const rangeRule = (from: string, to: string, label: string) => (r: Rec): Record<string, string> =>
  !blank(r[from]) && !blank(r[to]) && Number(r[from]) > Number(r[to]) ? { [to]: `${label} To must be greater than or equal to From.` } : {};

/** Field-level business rules that look at more than one field of a record. */
export const THD_RECORD_RULES: Record<string, (r: Rec) => Record<string, string>> = {
  [THD_MASTER_IDS.kmsRange]: rangeRule('fromKm', 'toKm', 'Km'),
  [THD_MASTER_IDS.vehicleAge]: rangeRule('fromYears', 'toYears', 'Age'),
  [THD_MASTER_IDS.users]: (r): Record<string, string> => (norm(r.role) === 'plant' && blank(r.plantName) ? { plantName: 'Plant Name is required for Plant users.' } : {}),
  [THD_MASTER_IDS.triggers]: (r) => {
    const e: Record<string, string> = {};
    if (!blank(r.windowValue) && blank(r.windowUnit)) e.windowUnit = 'Choose Hours or Days for the Time Window.';
    if (r.scenarioCode === 'DELAY_REASON' && blank(r.triggerValues)) e.triggerValues = 'List the delay reasons that trigger this rule.';
    return e;
  },
};

const KEYS: Record<string, { keys: string[]; what: (r: Rec) => string }> = {
  [THD_MASTER_IDS.triggers]: { keys: ['ruleNo'], what: (r) => `Rule ${r.ruleNo}` },
  [THD_MASTER_IDS.critical]: { keys: ['ppl', 'complaintCode'], what: (r) => `${r.complaintCode} (${r.ppl || 'all PPLs'})` },
  [THD_MASTER_IDS.users]: { keys: ['role', 'bu', 'userName'], what: (r) => `${r.userName} as ${r.role} (${r.bu})` },
};

/** An active row (other than `record`) that clashes with it in the same master. */
export function findThdConflict(masterId: string, record: Rec, others: Rec[]): string | null {
  if (!isActive(record)) return null;
  const rest = others.filter((o) => o.id !== record.id && isActive(o));
  const spec = KEYS[masterId];
  if (!spec) return null;
  const key = (r: Rec) => spec.keys.map((k) => norm(r[k])).join('|');
  const clash = rest.find((o) => key(o) === key(record));
  return clash ? `${spec.what(record)} already exists in ${clash.id}.` : null;
}

/**
 * Every problem across the THD masters, including data that arrived by bulk import.
 * Pass the Common LOV Master rows under COMMON_LOV_ID to check the THD lists too.
 */
export function thdHealthCheck(records: Record<string, Rec[]>): string[] {
  const issues: string[] = [];
  const lov = records[COMMON_LOV_ID] ?? [];
  Object.entries(records).forEach(([masterId, rows]) => {
    if (masterId === COMMON_LOV_ID) return;
    rows.forEach((r, i) => {
      Object.values(THD_RECORD_RULES[masterId]?.(r) ?? {}).forEach((e) => issues.push(`${masterId} ${r.id}: ${e}`));
      const clash = findThdConflict(masterId, r, rows.slice(0, i));
      if (clash) issues.push(`${masterId} ${r.id}: ${clash}`);
    });
  });
  if (lov.length) {
    Object.values(THD_LOV).forEach((code) => {
      if (!lovValues(lov, code).length) issues.push(`${code}: THD list has no active value in the Common LOV Master.`);
    });
    lovValues(lov, THD_LOV.progress).forEach((p) => {
      if (!subStatusesFor(lov, p).length) issues.push(`${THD_LOV.progress}: Progress "${p}" has no active sub-status in ${THD_LOV.subStatus}.`);
    });
  }
  const users = records[THD_MASTER_IDS.users] ?? [];
  (records[THD_MASTER_IDS.triggers] ?? []).filter(isActive).forEach((t) => {
    const role = norm(t.assignedTo) === 'tech executive l1' ? 'tech executive l1' : null;
    if (role && !users.some((u) => isActive(u) && norm(u.role) === role))
      issues.push(`${THD_MASTER_IDS.triggers} ${t.id}: assigns to Tech Executive L1 but no active Tech Executive L1 user exists.`);
  });
  return issues;
}
