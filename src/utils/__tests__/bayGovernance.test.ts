import { describe, it, expect } from 'vitest';
import {
  addBay,
  allocationUsage,
  changeBayStatus,
  decideRequest,
  resubmitBay,
  setAllocation,
  approvalLink,
  Actor,
  BayState,
  NewBayInput,
} from '../bayGovernance';
import { createSeedBayState } from '../../data/bayData';

const URL = 'https://example.github.io/app/';
const NOW = '2026-10-01 10:00';
const dealer: Actor = { name: 'K. Venkatesh', role: 'DEALER_ADMIN' };
const tml: Actor = { name: 'Network Manager', role: 'TML_ADMIN' };
const seed = (): BayState => createSeedBayState(URL);

const mechanical = (over: Partial<NewBayInput> = {}): NewBayInput => ({
  dealerCode: 'DLR1001',
  dealerName: 'Sample Motors Hyderabad',
  region: 'South',
  division: 'Main Workshop',
  bu: 'PV',
  bayType: 'Mechanical',
  bayName: 'Mechanical Bay 03',
  floor: 'Ground',
  liftAvailability: '2 post lift',
  ...over,
});

describe('allocation', () => {
  it('counts approved bays (active or inactive) against dealer + division + BU + type', () => {
    expect(allocationUsage(seed(), { dealerCode: 'DLR1001', division: 'Main Workshop', bu: 'PV', bayType: 'Mechanical' })).toEqual({
      allocated: 4,
      used: 2,
      remaining: 2,
      defined: true,
    });
    // Pending / rejected bays don't use the allocation
    expect(allocationUsage(seed(), { dealerCode: 'DLR1001', division: 'Main Workshop', bu: 'PV', bayType: 'Electrical' }).used).toBe(0);
  });

  it('only TML Admin can set allocations, with sane numbers', () => {
    const key = { dealerCode: 'DLR1002', division: 'Main Workshop', bu: 'PV' as const, bayType: 'AC' as const };
    expect(setAllocation(seed(), key, 3, dealer, NOW).ok).toBe(false);
    expect(setAllocation(seed(), key, -1, tml, NOW).ok).toBe(false);
    expect(setAllocation(seed(), key, 2.5, tml, NOW).ok).toBe(false);
    const res = setAllocation(seed(), key, 3, tml, NOW);
    expect(res.ok).toBe(true);
    expect(allocationUsage(res.state, key).allocated).toBe(3);
    // Upsert, not duplicate
    const again = setAllocation(res.state, key, 5, tml, NOW);
    expect(again.state.allocations.filter((a) => a.dealerCode === 'DLR1002')).toHaveLength(1);
  });
});

describe('adding bays', () => {
  it('within the allocation: dealer bay goes live immediately, no request', () => {
    const res = addBay(seed(), mechanical(), dealer, URL, NOW);
    expect(res.ok).toBe(true);
    expect(res.value).toMatchObject({ approvalStatus: 'Approved', bayStatus: 'Active' });
    expect(res.request).toBeUndefined();
  });

  it('beyond the allocation: needs a justification, then goes to the TML Network Manager with an email', () => {
    let s = seed();
    s = addBay(s, mechanical({ bayName: 'M3' }), dealer, URL, NOW).state;
    s = addBay(s, mechanical({ bayName: 'M4' }), dealer, URL, NOW).state; // 4 of 4 used
    expect(addBay(s, mechanical({ bayName: 'M5' }), dealer, URL, NOW).error).toMatch(/justification/);

    const res = addBay(s, mechanical({ bayName: 'M5', justification: 'Extra demand' }), dealer, URL, NOW);
    expect(res.value).toMatchObject({ approvalStatus: 'Pending Approval', bayStatus: 'Inactive' });
    expect(res.request).toMatchObject({ kind: 'ADD_BAY', approverRole: 'TML Network Manager', status: 'PENDING', allocation: { allocated: 4, used: 4 } });
    expect(res.email).toMatchObject({ to: 'network.manager@tatamotors.com' });
    expect(res.email!.link).toBe(`${URL}#/admin/bay-approvals?request=${res.request!.id}`);
    expect(res.email!.body).toContain(res.email!.link);
  });

  it('no allocation defined counts as 0 allocated', () => {
    const res = addBay(seed(), mechanical({ bayType: 'AC', bu: 'CV', bayName: 'CV AC', justification: 'x' }), dealer, URL, NOW);
    expect(res.request?.allocation).toEqual({ allocated: 0, used: 0 });
  });

  it('TML Admin can add directly even beyond the allocation', () => {
    const res = addBay(seed(), mechanical({ bayType: 'Electrical', bayName: 'E2' }), tml, URL, NOW);
    expect(res.value?.approvalStatus).toBe('Approved');
    expect(res.request).toBeUndefined();
  });

  it('rejects duplicate names and missing fields; generates unique ids', () => {
    expect(addBay(seed(), mechanical({ bayName: 'Mechanical Bay 01' }), dealer, URL, NOW).error).toMatch(/already exists/);
    expect(addBay(seed(), mechanical({ bayName: '  ' }), dealer, URL, NOW).ok).toBe(false);
    expect(addBay(seed(), mechanical({ division: '' }), dealer, URL, NOW).ok).toBe(false);
    const a = addBay(seed(), mechanical({ bayName: 'X1' }), dealer, URL, NOW);
    const b = addBay(a.state, mechanical({ bayName: 'X2' }), dealer, URL, NOW);
    expect(new Set(b.state.bays.map((x) => x.id)).size).toBe(b.state.bays.length);
  });
});

describe('approval decisions', () => {
  it('approving an added bay activates it; rejecting requires a reason and keeps it inactive', () => {
    const s = seed(); // BAY-03 is pending via BREQ-SEED-01
    expect(decideRequest(s, 'BREQ-SEED-01', 'APPROVED', '', dealer, NOW).ok).toBe(false); // dealers can't approve
    const approved = decideRequest(s, 'BREQ-SEED-01', 'APPROVED', '', tml, NOW);
    expect(approved.state.bays.find((b) => b.id === 'BAY-03')).toMatchObject({ approvalStatus: 'Approved', bayStatus: 'Active', pendingRequestId: undefined });
    expect(decideRequest(approved.state, 'BREQ-SEED-01', 'REJECTED', 'x', tml, NOW).error).toMatch(/already approved/);

    expect(decideRequest(s, 'BREQ-SEED-01', 'REJECTED', '', tml, NOW).error).toMatch(/reason/);
    const rejected = decideRequest(s, 'BREQ-SEED-01', 'REJECTED', 'Not in network plan', tml, NOW);
    expect(rejected.state.bays.find((b) => b.id === 'BAY-03')).toMatchObject({ approvalStatus: 'Rejected', bayStatus: 'Inactive' });
    expect(rejected.value).toMatchObject({ status: 'REJECTED', decisionNote: 'Not in network plan', decidedBy: tml });
  });

  it('a rejected bay can be resubmitted with a new justification', () => {
    const res = resubmitBay(seed(), 'BAY-08', 'Paint booth upgraded', dealer, URL, NOW);
    expect(res.ok).toBe(true);
    expect(res.state.bays.find((b) => b.id === 'BAY-08')?.approvalStatus).toBe('Pending Approval');
    expect(res.request?.kind).toBe('ADD_BAY');
    expect(resubmitBay(seed(), 'BAY-01', 'x', dealer, URL, NOW).ok).toBe(false);
  });
});

describe('bay status changes', () => {
  it('dealer change needs TML Admin approval (default policy) and is applied only on approval', () => {
    const req = changeBayStatus(seed(), 'BAY-01', 'Inactive', 'Equipment breakdown', dealer, URL, NOW);
    expect(req.value).toBe('PENDING_APPROVAL');
    expect(req.request).toMatchObject({ kind: 'STATUS_CHANGE', approverRole: 'TML Admin (L1/L2 Support)', fromStatus: 'Active', toStatus: 'Inactive' });
    expect(req.email?.to).toBe('tml.admin.support@tatamotors.com');
    expect(req.state.bays.find((b) => b.id === 'BAY-01')?.bayStatus).toBe('Active');
    // A second request on the same bay is blocked while one is open
    expect(changeBayStatus(req.state, 'BAY-01', 'Inactive', 'x', dealer, URL, NOW).error).toMatch(/already has a request/);

    const done = decideRequest(req.state, req.request!.id, 'APPROVED', '', tml, NOW);
    expect(done.state.bays.find((b) => b.id === 'BAY-01')).toMatchObject({ bayStatus: 'Inactive', statusReason: 'Equipment breakdown' });
  });

  it('rejecting a status change leaves the bay as it was', () => {
    const req = changeBayStatus(seed(), 'BAY-01', 'Inactive', 'x', dealer, URL, NOW);
    const done = decideRequest(req.state, req.request!.id, 'REJECTED', 'Bay needed this week', tml, NOW);
    expect(done.state.bays.find((b) => b.id === 'BAY-01')).toMatchObject({ bayStatus: 'Active', pendingRequestId: undefined });
  });

  it('TML Admin changes apply immediately', () => {
    const res = changeBayStatus(seed(), 'BAY-01', 'Inactive', 'Preventive maintenance', tml, URL, NOW);
    expect(res.value).toBe('APPLIED');
    expect(res.state.bays.find((b) => b.id === 'BAY-01')?.bayStatus).toBe('Inactive');
    expect(res.request).toBeUndefined();
  });

  it('policy switches: no approval needed, or dealer not allowed at all', () => {
    const noApproval = { ...seed(), policy: { dealerCanChangeStatus: true, dealerStatusChangeNeedsApproval: false } };
    expect(changeBayStatus(noApproval, 'BAY-01', 'Inactive', 'x', dealer, URL, NOW).value).toBe('APPLIED');
    const tmlOnly = { ...seed(), policy: { dealerCanChangeStatus: false, dealerStatusChangeNeedsApproval: true } };
    expect(changeBayStatus(tmlOnly, 'BAY-01', 'Inactive', 'x', dealer, URL, NOW).error).toMatch(/TML Admin/);
    expect(changeBayStatus(tmlOnly, 'BAY-01', 'Inactive', 'x', tml, URL, NOW).value).toBe('APPLIED');
  });

  it('validates: reason required, bay must be approved, no no-op changes', () => {
    expect(changeBayStatus(seed(), 'BAY-01', 'Inactive', '', tml, URL, NOW).ok).toBe(false);
    expect(changeBayStatus(seed(), 'BAY-01', 'Active', 'x', tml, URL, NOW).error).toMatch(/already Active/);
    expect(changeBayStatus(seed(), 'BAY-08', 'Active', 'x', tml, URL, NOW).error).toMatch(/approved/);
  });
});

describe('approval link', () => {
  it('strips any existing hash and deep-links to the request', () => {
    expect(approvalLink('https://x.io/app/#/admin/masters', 'BREQ-1')).toBe('https://x.io/app/#/admin/bay-approvals?request=BREQ-1');
  });
});
