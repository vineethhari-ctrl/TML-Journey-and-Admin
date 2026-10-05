/**
 * Claims rules (Goodwill and Warranty / AMC / EW authorisation) — pure functions over the Claims master records.
 * Only rows with Status = Active are used.
 */

type Rec = Record<string, any>;

export const CLAIM_MASTER_IDS = {
  budgetPurpose: 'claim_budget_purpose',
  specialGoodwill: 'claim_special_goodwill',
  issueDescription: 'claim_issue_description',
  goodwillCategory: 'claim_goodwill_category',
  complaintType: 'claim_complaint_type',
  approvalMatrix: 'claim_warranty_approval_matrix',
  guideline: 'claim_service_guideline',
  shqUsers: 'claim_shq_users',
} as const;

const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === '';
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
const isActive = (r: Rec) => norm(r.status || 'Active') === 'active';
const values = (rows: Rec[]) => rows.filter(isActive).map((r) => norm(r.value));
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** Issue Type and Request Category of a Goodwill Request for an Issue Description, or null when unmapped. */
export function goodwillCategory(mapping: Rec[], issueDescription: string): { issueType: string; category: string } | null {
  const row = mapping.find((r) => isActive(r) && norm(r.issueDescription) === norm(issueDescription));
  return row ? { issueType: String(row.issueType), category: String(row.requestCategory) } : null;
}

export interface ApprovalStep {
  level: number;
  persona: string;
  canApprove: boolean;
  reminderHours: number;
}

/**
 * Route a Warranty Authorization Request of `amount` through the approval matrix.
 * Levels are visited in order until one can approve (amount below its limit). If none can, `gap` says who is missing.
 */
export function routeWarrantyRequest(matrix: Rec[], amount: number): { steps: ApprovalStep[]; approver: string | null; gap?: string } {
  const levels = matrix.filter(isActive).sort((a, b) => Number(a.level) - Number(b.level));
  const steps: ApprovalStep[] = [];
  for (const l of levels) {
    const canApprove = !blank(l.approvesBelow) && amount < Number(l.approvesBelow);
    steps.push({ level: Number(l.level), persona: String(l.persona), canApprove, reminderHours: Number(l.reminderHours) });
    if (canApprove) return { steps, approver: String(l.persona) };
  }
  const last = levels.at(-1);
  const next = last?.forwardTo ? `"${last.forwardTo}"` : 'a next level';
  return { steps, approver: null, gap: `No level can approve ${inr(amount)}: ${next} is not in the approval matrix yet.` };
}

/** Field-level business rules that look at more than one field of a record. */
export const CLAIM_RECORD_RULES: Record<string, (r: Rec) => Record<string, string>> = {
  [CLAIM_MASTER_IDS.approvalMatrix]: (r): Record<string, string> =>
    blank(r.approvesBelow) && blank(r.forwardTo) ? { forwardTo: 'A level that cannot approve must forward to the next persona.' } : {},
};

const LIST_IDS: string[] = [CLAIM_MASTER_IDS.budgetPurpose, CLAIM_MASTER_IDS.specialGoodwill, CLAIM_MASTER_IDS.issueDescription, CLAIM_MASTER_IDS.complaintType];
const KEYS: Record<string, { keys: string[]; what: (r: Rec) => string }> = {
  [CLAIM_MASTER_IDS.goodwillCategory]: { keys: ['issueDescription'], what: (r) => `A category for "${r.issueDescription}"` },
  [CLAIM_MASTER_IDS.approvalMatrix]: { keys: ['level'], what: (r) => `Level ${r.level}` },
  [CLAIM_MASTER_IDS.guideline]: { keys: ['requestType', 'bu'], what: (r) => `An active ${r.requestType} guideline for ${r.bu}` },
  [CLAIM_MASTER_IDS.shqUsers]: { keys: ['bu', 'userName'], what: (r) => `${r.userName} (${r.bu})` },
};

/** An active row (other than `record`) that clashes with it in the same master. */
export function findClaimConflict(masterId: string, record: Rec, others: Rec[]): string | null {
  if (!isActive(record)) return null;
  const spec = LIST_IDS.includes(masterId) ? { keys: ['value'], what: (r: Rec) => `"${r.value}"` } : KEYS[masterId];
  if (!spec) return null;
  const key = (r: Rec) => spec.keys.map((k) => norm(r[k])).join('|');
  const clash = others.find((o) => o.id !== record.id && isActive(o) && key(o) === key(record));
  return clash ? `${spec.what(record)} already exists in ${clash.id}.` : null;
}

/** Problems that make the Claims data wrong — fix before go-live. */
export function claimHealthCheck(records: Record<string, Rec[]>): string[] {
  const issues: string[] = [];
  Object.entries(records).forEach(([masterId, rows]) => {
    rows.forEach((r, i) => {
      Object.values(CLAIM_RECORD_RULES[masterId]?.(r) ?? {}).forEach((e) => issues.push(`${masterId} ${r.id}: ${e}`));
      const clash = findClaimConflict(masterId, r, rows.slice(0, i));
      if (clash) issues.push(`${masterId} ${r.id}: ${clash}`);
    });
  });
  const issuesList = values(records[CLAIM_MASTER_IDS.issueDescription] ?? []);
  const mapping = (records[CLAIM_MASTER_IDS.goodwillCategory] ?? []).filter(isActive);
  mapping.forEach((m) => {
    if (!issuesList.includes(norm(m.issueDescription)))
      issues.push(`${CLAIM_MASTER_IDS.goodwillCategory} ${m.id}: "${m.issueDescription}" is not an active Issue Description.`);
  });
  (records[CLAIM_MASTER_IDS.issueDescription] ?? []).filter(isActive).forEach((d) => {
    if (!mapping.some((m) => norm(m.issueDescription) === norm(d.value)))
      issues.push(`${CLAIM_MASTER_IDS.issueDescription} ${d.id}: "${d.value}" has no Request Category mapping.`);
  });
  const levels = (records[CLAIM_MASTER_IDS.approvalMatrix] ?? []).filter(isActive).sort((a, b) => Number(a.level) - Number(b.level));
  const limits = levels.filter((l) => !blank(l.approvesBelow)).map((l) => Number(l.approvesBelow));
  if (limits.some((v, i) => i > 0 && v <= limits[i - 1]))
    issues.push(`${CLAIM_MASTER_IDS.approvalMatrix}: approval limits must increase with each level.`);
  return issues;
}

/** Values the business still has to provide (shown separately from errors). */
export function claimPendingItems(records: Record<string, Rec[]>): string[] {
  const pending: string[] = [];
  const levels = (records[CLAIM_MASTER_IDS.approvalMatrix] ?? []).filter(isActive).sort((a, b) => Number(a.level) - Number(b.level));
  const top = levels.at(-1);
  if (top && blank(top.approvesBelow))
    pending.push(`Approval matrix: requests of ${inr(Math.max(...levels.map((l) => Number(l.approvesBelow) || 0)))} and above go to "${top.forwardTo || 'the next level'}", which is not in the matrix yet.`);
  const guides = (records[CLAIM_MASTER_IDS.guideline] ?? []).filter(isActive);
  ['AMC', 'Extended Warranty'].forEach((t) => {
    if (!guides.some((g) => norm(g.requestType) === norm(t))) pending.push(`No ${t} Service Guideline file uploaded yet.`);
  });
  return pending;
}
