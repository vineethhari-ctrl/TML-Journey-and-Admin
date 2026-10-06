import { describe, it, expect } from 'vitest';
import { MASTER_COLLECTIONS } from '../../data/masterCatalogue';
import {
  THD_LOV,
  THD_MASTER_IDS,
  criticalComplaint,
  criticalWithoutPpl,
  evaluateAutoThd,
  findThdConflict,
  pendingTriggerRules,
  rangesContaining,
  subStatusesFor,
  thdHealthCheck,
  windowHours,
} from '../thdRules';
import { validateMasterRecordRules } from '../recordRules';
import { COMMON_LOV_ID } from '../../data/commonLov';
import { lovRows, lovValues } from '../commonLov';

const rows = (id: string) => MASTER_COLLECTIONS.find((m) => m.id === id)!.records;
const all = () => Object.fromEntries([...Object.values(THD_MASTER_IDS), COMMON_LOV_ID].map((id) => [id, rows(id)]));
const lov = rows(COMMON_LOV_ID);
const triggers = rows(THD_MASTER_IDS.triggers);
const critical = rows(THD_MASTER_IDS.critical);
const fired = (e: Parameters<typeof evaluateAutoThd>[2]) => evaluateAutoThd(triggers, critical, e).fired.map((f) => f.rule.ruleNo);
const nexonE32 = [{ id: 'C1', ppl: 'Nexon', complaintCode: 'E32', aggregate: 'Electricals', critical: 'Y', status: 'Active' }];

describe('THD masters match the BA workbook "THD Masters List"', () => {
  it.each([
    [THD_LOV.complaintType, 2, 'Technical Query'],
    [THD_LOV.shortDescription, 26, 'Abnormal noise'],
    [THD_LOV.actionTaken, 7, 'Issue concluded and proceeded as per Field Investigation'],
    [THD_LOV.delayReason, 10, 'Diagnosis and investigation'],
    [THD_LOV.closureAction, 3, 'Closed'],
    [THD_LOV.progress, 6, 'Under Diagnosis'],
    [THD_LOV.attachmentType, 1, 'DIR Report'],
  ])('%s has %i values starting with "%s"', (code, count, first) => {
    expect(lovValues(lov, code)).toHaveLength(count);
    expect(lovValues(lov, code)[0]).toBe(first);
  });

  it('keeps the last values of the longer lists', () => {
    expect(lovValues(lov, THD_LOV.shortDescription).at(-1)).toBe('Water entry in cabin');
    expect(lovValues(lov, THD_LOV.delayReason).at(-1)).toBe('Dealer not responding');
    expect(lovValues(lov, THD_LOV.closureAction)).toEqual(['Closed', 'Closed With Feedback', 'Closed With Early Warning']);
  });

  it('fills the merged Progress cells down: 16 sub-statuses, linked to their progress', () => {
    expect(lovRows(lov, THD_LOV.subStatus)).toHaveLength(16);
    expect(subStatusesFor(lov, 'Under Diagnosis')).toEqual(['U/I DET', 'U/I COC', 'U/I Vendor', 'U/I Plant Team']);
    expect(subStatusesFor(lov, 'Pending for Vehicle availability')).toEqual(['Expected date', 'Status as on date']);
  });

  it('has the critical complaint, the filter ranges and one user per BA user sheet', () => {
    // The BA sheet has no PPL yet: E32 is kept but cannot raise a case until its PPL is mapped from the CRM master
    expect(criticalWithoutPpl(critical).map((c) => c.complaintCode)).toEqual(['E32']);
    expect(criticalComplaint(critical, { ppl: 'Altroz', complaintCode: 'E32' })).toBeNull();
    expect(rangesContaining(rows(THD_MASTER_IDS.kmsRange), 5000, 'fromKm', 'toKm')).toEqual(['1,001 - 10,000']);
    expect(rangesContaining(rows(THD_MASTER_IDS.vehicleAge), 1, 'fromYears', 'toYears')).toEqual(['0 - 1', '0 - 5']);
    expect(rows(THD_MASTER_IDS.users).map((u) => u.role)).toEqual(['Tech Executive L1', 'RTSM', 'COC L2', 'Plant', 'Product Reliability']);
  });

  it('has the 8 rules of "Conditions 4", with X and Y still pending', () => {
    expect(triggers.map((t) => t.ruleNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(windowHours(triggers[0])).toBe(30 * 24);
    expect(windowHours(triggers[7])).toBe(24);
    expect(pendingTriggerRules(triggers).map((r) => r.ruleNo)).toEqual([3, 4]);
  });

  it('is consistent', () => {
    expect(thdHealthCheck(all())).toEqual([]);
  });
});

describe('auto-THD triggers', () => {
  it('raises rule 2 for a critical complaint of the vehicle PPL at JC creation', () => {
    const run = (ppl: string, code: string) => evaluateAutoThd(triggers, nexonE32, { ppl, complaintCodes: [code] }).fired.map((f) => f.rule.ruleNo);
    expect(run('Nexon', 'e32')).toEqual([2]);
    expect(run('Nexon', 'X99')).toEqual([]);
  });

  it('a critical complaint without a PPL never raises a case', () => {
    expect(fired({ ppl: 'Nexon', complaintCodes: ['E32'] })).toEqual([]);
  });

  it('a critical row only applies to its PPL', () => {
    const rows = [{ id: 'C1', ppl: 'Harrier', complaintCode: 'H1', aggregate: 'Brakes', critical: 'Y', status: 'Active' }];
    expect(evaluateAutoThd(triggers, rows, { ppl: 'Harrier', complaintCodes: ['H1'] }).fired).toHaveLength(1);
    expect(evaluateAutoThd(triggers, rows, { ppl: 'Nexon', complaintCodes: ['H1'] }).fired).toHaveLength(0);
  });

  it('repeat complaint: same aggregate within 30 days only', () => {
    const e = { ppl: 'Nexon', complaintCodes: [], aggregates: ['Electricals'] };
    expect(fired({ ...e, previousJobCard: { daysSinceClosure: 30, aggregates: ['electricals'] } })).toEqual([1]);
    expect(fired({ ...e, previousJobCard: { daysSinceClosure: 31, aggregates: ['Electricals'] } })).toEqual([]);
    expect(fired({ ...e, previousJobCard: { daysSinceClosure: 5, aggregates: ['Brakes'] } })).toEqual([]);
  });

  it('rules 3 and 4 are reported as pending until business gives X and Y', () => {
    const later = evaluateAutoThd(triggers, nexonE32, { ppl: 'Nexon', complaintCodes: ['E32'], hoursSinceCriticalAddedLater: 5 });
    expect(later.fired).toEqual([]);
    expect(later.pending.map((p) => p.rule.ruleNo)).toEqual([3]);
    const delay = evaluateAutoThd(triggers, critical, { ppl: 'Nexon', complaintCodes: [], jobCardOpenHours: 50, delayReason: 'under investigation' });
    expect(delay.pending.map((p) => p.rule.ruleNo)).toEqual([4]);
  });

  it('rule 4 fires once Y is set, only for the listed delay reasons', () => {
    const withY = triggers.map((t) => (t.ruleNo === 4 ? { ...t, windowValue: 48 } : t));
    const run = (hours: number, reason: string) => evaluateAutoThd(withY, critical, { ppl: 'Nexon', complaintCodes: [], jobCardOpenHours: hours, delayReason: reason }).fired.length;
    expect(run(49, 'Delayed Diagnosis')).toBe(1);
    expect(run(48, 'Delayed Diagnosis')).toBe(0);
    expect(run(49, 'Parts not available')).toBe(0);
  });

  it('flags, escalation, DTC and the 24-hour unattended rule', () => {
    expect(fired({ ppl: 'Nexon', complaintCodes: [], qiMarkedThdRequired: true, openEscalation: true, criticalDtcReceived: true })).toEqual([5, 6, 7]);
    expect(fired({ ppl: 'Nexon', complaintCodes: [], thdUnattendedHours: 25 })).toEqual([8]);
    expect(fired({ ppl: 'Nexon', complaintCodes: [], thdUnattendedHours: 24 })).toEqual([]);
  });

  it('ignores inactive rules', () => {
    const off = triggers.map((t) => ({ ...t, status: 'Inactive' }));
    expect(evaluateAutoThd(off, critical, { ppl: 'Nexon', complaintCodes: ['E32'], criticalDtcReceived: true }).fired).toEqual([]);
  });
});

describe('THD validation', () => {
  it('checks ranges, plant users and trigger windows on save', () => {
    expect(validateMasterRecordRules(THD_MASTER_IDS.kmsRange, { fromKm: 5000, toKm: 100 })).toHaveProperty('toKm');
    expect(validateMasterRecordRules(THD_MASTER_IDS.users, { role: 'Plant', plantName: '' })).toHaveProperty('plantName');
    expect(validateMasterRecordRules(THD_MASTER_IDS.users, { role: 'RTSM', plantName: '' })).toEqual({});
    expect(validateMasterRecordRules(THD_MASTER_IDS.triggers, { scenarioCode: 'DELAY_REASON', windowValue: 48, windowUnit: '', triggerValues: '' })).toEqual({
      windowUnit: expect.any(String),
      triggerValues: expect.any(String),
    });
  });

  it('health check finds a Progress without sub-statuses and a missing Tech Executive L1', () => {
    const data = all();
    data[COMMON_LOV_ID] = lov.map((r) => (r.lovCode === THD_LOV.subStatus && r.parentValue === 'Under Diagnosis' ? { ...r, status: 'Inactive' } : r));
    data[THD_MASTER_IDS.users] = data[THD_MASTER_IDS.users].filter((u) => u.role !== 'Tech Executive L1');
    const issues = thdHealthCheck(data);
    expect(issues.some((i) => i.includes('Progress "Under Diagnosis" has no active sub-status'))).toBe(true);
    expect(issues.some((i) => i.includes('no active Tech Executive L1 user'))).toBe(true);
  });
});
