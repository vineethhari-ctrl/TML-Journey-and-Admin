/**
 * Bay governance rules (pure functions — no React, no storage).
 *
 *  1. TML Admin sets a bay allocation per dealer + division + BU + bay type.
 *  2. Bays added within the allocation go live immediately. Bays beyond it are
 *     sent to the TML Network Manager for approval (in-app inbox + email with a deep link).
 *  3. Bay status (Active ⇄ Inactive) can be changed by Dealer Admin and TML Admin (L1/L2).
 *     A dealer's change needs TML Admin approval; a TML Admin's change applies immediately.
 *     Both rules are policy switches because the BU hasn't finalised them.
 *  4. There are no "inactive from / to" dates: a bay is Active or Inactive until changed.
 *  5. A bay can be saved as a Draft and sent later ("Send for Approval"); only Draft and
 *     Rejected bays can be sent. Sending applies rule 2 (auto-approve within the allocation).
 */

export type BU = 'PV' | 'EV';
export type BayType = 'Mechanical' | 'Electrical' | 'EV' | 'Fleet' | 'Speedo' | 'AC' | 'BodyShop';
export type BayStatus = 'Active' | 'Inactive';
export type BayApprovalStatus = 'Draft' | 'Approved' | 'Pending Approval' | 'Rejected';
export const APPROVAL_STATUSES: BayApprovalStatus[] = ['Draft', 'Approved', 'Pending Approval', 'Rejected'];
export type Region = 'South' | 'North' | 'West' | 'East';

export const BUS: BU[] = ['PV', 'EV'];
export const BAY_TYPES: BayType[] = ['Mechanical', 'Electrical', 'EV', 'Fleet', 'Speedo', 'AC', 'BodyShop'];
export const FLOORS = ['Ground', 'Floor 1', 'Floor 2', 'Basement'] as const;
export const LIFTS = ['No Lift', '2 post lift', '4 post lift'] as const;
export const STATUS_REASONS = [
  'Preventive maintenance',
  'Equipment breakdown',
  'Renovation / civil work',
  'Manpower shortage',
  'Safety / compliance issue',
  'Bay restored after repair',
  'Other',
];

export interface Bay {
  id: string;
  no: number;
  region: Region;
  dealerCode: string;
  dealerName: string;
  division: string;
  bu: BU;
  bayName: string;
  bayType: BayType;
  bayStatus: BayStatus;
  approvalStatus: BayApprovalStatus;
  floor: (typeof FLOORS)[number];
  liftAvailability: (typeof LIFTS)[number];
  specialEquipments: string[];
  techSupervisor: string;
  tech1: string;
  tech2: string;
  /** Open approval request for this bay (an add or a status change). */
  pendingRequestId?: string;
  /** Reason recorded with the last status change. */
  statusReason?: string;
}

export interface BayAllocation {
  id: string;
  dealerCode: string;
  division: string;
  bu: BU;
  bayType: BayType;
  allocated: number;
  updatedBy: string;
  updatedAt: string;
}

export type ActorRole = 'DEALER_ADMIN' | 'TML_ADMIN';
export interface Actor {
  name: string;
  role: ActorRole;
  email?: string;
}

export type ApproverRole = 'TML Network Manager' | 'TML Admin (L1/L2 Support)';

export interface BayRequest {
  id: string;
  kind: 'ADD_BAY' | 'STATUS_CHANGE';
  bayId: string;
  bayName: string;
  dealerCode: string;
  dealerName: string;
  division: string;
  bu: BU;
  bayType: BayType;
  fromStatus?: BayStatus;
  toStatus?: BayStatus;
  reason: string;
  allocation?: { allocated: number; used: number };
  approverRole: ApproverRole;
  requestedBy: Actor;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedBy?: Actor;
  decidedAt?: string;
  decisionNote?: string;
}

export interface EmailMessage {
  id: string;
  requestId: string;
  to: string;
  subject: string;
  body: string;
  link: string;
  sentAt: string;
}

export interface BayPolicy {
  /** Dealer Admin may request Active ⇄ Inactive changes (BU may later remove this). */
  dealerCanChangeStatus: boolean;
  /** Dealer Admin status changes need TML Admin approval. */
  dealerStatusChangeNeedsApproval: boolean;
}

export interface BayState {
  bays: Bay[];
  allocations: BayAllocation[];
  requests: BayRequest[];
  emails: EmailMessage[];
  policy: BayPolicy;
}

export const DEFAULT_POLICY: BayPolicy = { dealerCanChangeStatus: true, dealerStatusChangeNeedsApproval: true };

export const APPROVER_EMAIL: Record<ApproverRole, string> = {
  'TML Network Manager': 'network.manager@tatamotors.com',
  'TML Admin (L1/L2 Support)': 'tml.admin.support@tatamotors.com',
};

export interface Result<T = undefined> {
  ok: boolean;
  error?: string;
  state: BayState;
  value?: T;
  request?: BayRequest;
  email?: EmailMessage;
}

const fail = (state: BayState, error: string): Result<any> => ({ ok: false, error, state });

let seq = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}${(++seq).toString(36).toUpperCase()}`;

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------

export interface AllocationKey {
  dealerCode: string;
  division: string;
  bu: BU;
  bayType: BayType;
}

const sameKey = (a: AllocationKey, b: AllocationKey) =>
  a.dealerCode === b.dealerCode &&
  a.division.trim().toLowerCase() === b.division.trim().toLowerCase() &&
  a.bu === b.bu &&
  a.bayType === b.bayType;

/** Approved bays count against the allocation whether Active or Inactive (they physically exist). */
export function allocationUsage(state: BayState, key: AllocationKey): { allocated: number; used: number; remaining: number; defined: boolean } {
  const alloc = state.allocations.find((a) => sameKey(a, key));
  const used = state.bays.filter((b) => b.approvalStatus === 'Approved' && sameKey(b, key)).length;
  const allocated = alloc?.allocated ?? 0;
  return { allocated, used, remaining: Math.max(0, allocated - used), defined: !!alloc };
}

export function setAllocation(state: BayState, key: AllocationKey, allocated: number, actor: Actor, now: string): Result<BayAllocation> {
  if (actor.role !== 'TML_ADMIN') return fail(state, 'Only TML Admin can set bay allocations.');
  if (!key.division.trim()) return fail(state, 'Division is required.');
  if (!Number.isInteger(allocated) || allocated < 0 || allocated > 500) {
    return fail(state, 'Allocated bays must be a whole number between 0 and 500.');
  }
  const existing = state.allocations.find((a) => sameKey(a, key));
  const allocation: BayAllocation = {
    id: existing?.id ?? newId('ALLOC'),
    ...key,
    division: key.division.trim(),
    allocated,
    updatedBy: actor.name,
    updatedAt: now,
  };
  const allocations = existing
    ? state.allocations.map((a) => (a.id === existing.id ? allocation : a))
    : [...state.allocations, allocation];
  return { ok: true, state: { ...state, allocations }, value: allocation };
}

// ---------------------------------------------------------------------------
// Email (simulated until the backend exists)
// ---------------------------------------------------------------------------

export function approvalLink(appBaseUrl: string, requestId: string): string {
  return `${appBaseUrl.replace(/#.*$/, '')}#/admin/bay-approvals?request=${encodeURIComponent(requestId)}`;
}

export function buildApprovalEmail(req: BayRequest, appBaseUrl: string, now: string): EmailMessage {
  const link = approvalLink(appBaseUrl, req.id);
  const what =
    req.kind === 'ADD_BAY'
      ? `add an additional ${req.bayType} bay "${req.bayName}" beyond the TML allocation` +
        (req.allocation ? ` (allocated ${req.allocation.allocated}, already approved ${req.allocation.used})` : '')
      : `change bay "${req.bayName}" from ${req.fromStatus} to ${req.toStatus}`;
  return {
    id: newId('MAIL'),
    requestId: req.id,
    to: APPROVER_EMAIL[req.approverRole],
    subject: `[Action required] Bay ${req.kind === 'ADD_BAY' ? 'addition' : 'status change'} – ${req.dealerName} (${req.dealerCode}) – ${req.id}`,
    body: [
      `Dear ${req.approverRole},`,
      '',
      `${req.requestedBy.name} (Dealer Admin, ${req.dealerName}) has requested to ${what}.`,
      '',
      `Dealer: ${req.dealerCode} – ${req.dealerName}`,
      `Division / BU: ${req.division} / ${req.bu}`,
      `Bay type: ${req.bayType}`,
      `Reason: ${req.reason}`,
      '',
      `Review and approve or reject it here: ${link}`,
      '',
      'This is an automated message from Tata Motors Service Transformation.',
    ].join('\n'),
    link,
    sentAt: now,
  };
}

function openRequest(state: BayState, req: BayRequest, appBaseUrl: string, now: string) {
  const email = buildApprovalEmail(req, appBaseUrl, now);
  return { state: { ...state, requests: [req, ...state.requests], emails: [email, ...state.emails] }, request: req, email };
}

// ---------------------------------------------------------------------------
// Add bay
// ---------------------------------------------------------------------------

export interface NewBayInput {
  dealerCode: string;
  dealerName: string;
  region: Region;
  division: string;
  bu: BU;
  bayType: BayType;
  bayName: string;
  floor: Bay['floor'];
  liftAvailability: Bay['liftAvailability'];
  techSupervisor?: string;
  tech1?: string;
  tech2?: string;
  specialEquipments?: string[];
  /** Mandatory when a dealer adds beyond the allocation. */
  justification?: string;
  /** Save without submitting; the bay stays Inactive and doesn't use the allocation. */
  asDraft?: boolean;
}

export const nextBayNo = (bays: Bay[]) => bays.reduce((max, b) => Math.max(max, b.no), 0) + 1;

export function addBay(state: BayState, input: NewBayInput, actor: Actor, appBaseUrl: string, now: string): Result<Bay> {
  const name = input.bayName.trim();
  if (!name) return fail(state, 'Bay name is required.');
  if (!input.division.trim()) return fail(state, 'Division is required.');
  const duplicate = state.bays.some(
    (b) => b.dealerCode === input.dealerCode && b.bayName.trim().toLowerCase() === name.toLowerCase() && b.approvalStatus !== 'Rejected'
  );
  if (duplicate) return fail(state, `A bay named "${name}" already exists for ${input.dealerCode}.`);

  const key: AllocationKey = { dealerCode: input.dealerCode, division: input.division.trim(), bu: input.bu, bayType: input.bayType };
  const usage = allocationUsage(state, key);
  const withinAllocation = usage.used < usage.allocated;
  const asDraft = !!input.asDraft;
  const needsApproval = !asDraft && actor.role === 'DEALER_ADMIN' && !withinAllocation;
  if (needsApproval && !input.justification?.trim()) {
    return fail(state, 'This bay is beyond the TML allocation — please give a justification for the TML Network Manager.');
  }

  const no = nextBayNo(state.bays);
  const bay: Bay = {
    id: `BAY-${String(no).padStart(2, '0')}`,
    no,
    region: input.region,
    dealerCode: input.dealerCode,
    dealerName: input.dealerName,
    division: input.division.trim(),
    bu: input.bu,
    bayName: name,
    bayType: input.bayType,
    // A bay awaiting approval can't be used for bookings yet
    bayStatus: needsApproval || asDraft ? 'Inactive' : 'Active',
    approvalStatus: asDraft ? 'Draft' : needsApproval ? 'Pending Approval' : 'Approved',
    floor: input.floor,
    liftAvailability: input.liftAvailability,
    specialEquipments: input.specialEquipments ?? [],
    techSupervisor: input.techSupervisor?.trim() ?? '',
    tech1: input.tech1?.trim() ?? '',
    tech2: input.tech2?.trim() ?? '',
  };

  if (!needsApproval) {
    return { ok: true, state: { ...state, bays: [bay, ...state.bays] }, value: bay };
  }

  const req: BayRequest = {
    id: newId('BREQ'),
    kind: 'ADD_BAY',
    bayId: bay.id,
    bayName: bay.bayName,
    dealerCode: bay.dealerCode,
    dealerName: bay.dealerName,
    division: bay.division,
    bu: bay.bu,
    bayType: bay.bayType,
    reason: input.justification!.trim(),
    allocation: { allocated: usage.allocated, used: usage.used },
    approverRole: 'TML Network Manager',
    requestedBy: actor,
    requestedAt: now,
    status: 'PENDING',
  };
  const withBay = { ...state, bays: [{ ...bay, pendingRequestId: req.id }, ...state.bays] };
  const opened = openRequest(withBay, req, appBaseUrl, now);
  return { ok: true, ...opened, value: { ...bay, pendingRequestId: req.id } };
}

/**
 * "Send for Approval" for a Draft or Rejected bay. Within the TML allocation (or when TML Admin
 * sends it) the bay is approved and goes live; beyond it, it goes to the TML Network Manager.
 */
export function submitBay(
  state: BayState,
  bayId: string,
  justification: string,
  actor: Actor,
  appBaseUrl: string,
  now: string
): Result<'APPROVED' | 'PENDING_APPROVAL'> {
  const bay = state.bays.find((b) => b.id === bayId);
  if (!bay) return fail(state, 'Bay not found.');
  if (bay.approvalStatus !== 'Draft' && bay.approvalStatus !== 'Rejected') {
    return fail(state, `${bay.bayName}: only Draft and Rejected bays can be sent for approval.`);
  }
  if (bay.pendingRequestId) return fail(state, `${bay.bayName} already has a request awaiting approval.`);
  const usage = allocationUsage(state, bay);
  if (actor.role === 'TML_ADMIN' || usage.used < usage.allocated) {
    const bays = state.bays.map((b) =>
      b.id === bayId ? { ...b, approvalStatus: 'Approved' as const, bayStatus: 'Active' as const, pendingRequestId: undefined } : b
    );
    return { ok: true, state: { ...state, bays }, value: 'APPROVED' };
  }
  if (!justification.trim()) {
    return fail(state, `${bay.bayName} is beyond the TML allocation — please give a justification for the TML Network Manager.`);
  }
  const res = resubmitBay(state, bayId, justification, actor, appBaseUrl, now, true);
  return res.ok ? { ...res, value: 'PENDING_APPROVAL' } : (res as Result<any>);
}

/** Re-sends a rejected bay to the TML Network Manager with a new justification. */
export function resubmitBay(
  state: BayState,
  bayId: string,
  justification: string,
  actor: Actor,
  appBaseUrl: string,
  now: string,
  allowDraft = false
): Result {
  const bay = state.bays.find((b) => b.id === bayId);
  if (!bay) return fail(state, 'Bay not found.');
  if (bay.approvalStatus !== 'Rejected' && !(allowDraft && bay.approvalStatus === 'Draft')) {
    return fail(state, 'Only rejected bays can be resubmitted.');
  }
  if (!justification.trim()) return fail(state, 'A justification is required.');
  const usage = allocationUsage(state, bay);
  const req: BayRequest = {
    id: newId('BREQ'),
    kind: 'ADD_BAY',
    bayId: bay.id,
    bayName: bay.bayName,
    dealerCode: bay.dealerCode,
    dealerName: bay.dealerName,
    division: bay.division,
    bu: bay.bu,
    bayType: bay.bayType,
    reason: justification.trim(),
    allocation: { allocated: usage.allocated, used: usage.used },
    approverRole: 'TML Network Manager',
    requestedBy: actor,
    requestedAt: now,
    status: 'PENDING',
  };
  const updated = {
    ...state,
    bays: state.bays.map((b) => (b.id === bayId ? { ...b, approvalStatus: 'Pending Approval' as const, pendingRequestId: req.id } : b)),
  };
  return { ok: true, ...openRequest(updated, req, appBaseUrl, now) };
}

// ---------------------------------------------------------------------------
// Status change (Active ⇄ Inactive)
// ---------------------------------------------------------------------------

export function changeBayStatus(
  state: BayState,
  bayId: string,
  toStatus: BayStatus,
  reason: string,
  actor: Actor,
  appBaseUrl: string,
  now: string
): Result<'APPLIED' | 'PENDING_APPROVAL'> {
  const bay = state.bays.find((b) => b.id === bayId);
  if (!bay) return fail(state, 'Bay not found.');
  if (bay.approvalStatus !== 'Approved') return fail(state, 'Only approved bays can be activated or inactivated.');
  if (bay.pendingRequestId) return fail(state, 'This bay already has a request awaiting approval.');
  if (bay.bayStatus === toStatus) return fail(state, `Bay is already ${toStatus}.`);
  if (!reason.trim()) return fail(state, 'Please select or enter a reason.');

  if (actor.role === 'DEALER_ADMIN') {
    if (!state.policy.dealerCanChangeStatus) {
      return fail(state, 'Bay status changes are handled by TML Admin. Please contact TML Admin (L1/L2 Support).');
    }
    if (state.policy.dealerStatusChangeNeedsApproval) {
      const req: BayRequest = {
        id: newId('BREQ'),
        kind: 'STATUS_CHANGE',
        bayId: bay.id,
        bayName: bay.bayName,
        dealerCode: bay.dealerCode,
        dealerName: bay.dealerName,
        division: bay.division,
        bu: bay.bu,
        bayType: bay.bayType,
        fromStatus: bay.bayStatus,
        toStatus,
        reason: reason.trim(),
        approverRole: 'TML Admin (L1/L2 Support)',
        requestedBy: actor,
        requestedAt: now,
        status: 'PENDING',
      };
      const updated = { ...state, bays: state.bays.map((b) => (b.id === bayId ? { ...b, pendingRequestId: req.id } : b)) };
      return { ok: true, ...openRequest(updated, req, appBaseUrl, now), value: 'PENDING_APPROVAL' };
    }
  }

  const bays = state.bays.map((b) => (b.id === bayId ? { ...b, bayStatus: toStatus, statusReason: reason.trim() } : b));
  return { ok: true, state: { ...state, bays }, value: 'APPLIED' };
}

// ---------------------------------------------------------------------------
// Approve / reject
// ---------------------------------------------------------------------------

export function decideRequest(
  state: BayState,
  requestId: string,
  decision: 'APPROVED' | 'REJECTED',
  note: string,
  approver: Actor,
  now: string
): Result<BayRequest> {
  const req = state.requests.find((r) => r.id === requestId);
  if (!req) return fail(state, 'Request not found.');
  if (req.status !== 'PENDING') return fail(state, `This request was already ${req.status.toLowerCase()}.`);
  if (approver.role !== 'TML_ADMIN') return fail(state, 'Only TML users can approve or reject bay requests.');
  if (decision === 'REJECTED' && !note.trim()) return fail(state, 'Please give a reason for rejecting.');

  const decided: BayRequest = { ...req, status: decision, decidedBy: approver, decidedAt: now, decisionNote: note.trim() || undefined };
  const bays = state.bays.map((b) => {
    if (b.id !== req.bayId) return b;
    const cleared = { ...b, pendingRequestId: undefined };
    if (req.kind === 'ADD_BAY') {
      return decision === 'APPROVED'
        ? { ...cleared, approvalStatus: 'Approved' as const, bayStatus: 'Active' as const }
        : { ...cleared, approvalStatus: 'Rejected' as const, bayStatus: 'Inactive' as const };
    }
    return decision === 'APPROVED' ? { ...cleared, bayStatus: req.toStatus!, statusReason: req.reason } : cleared;
  });
  return {
    ok: true,
    state: { ...state, bays, requests: state.requests.map((r) => (r.id === requestId ? decided : r)) },
    value: decided,
  };
}
