import { describe, it, expect } from 'vitest';
import { MASTER_COLLECTIONS } from '../../data/masterCatalogue';
import { CLAIM_LOV, CLAIM_MASTER_IDS, claimHealthCheck, claimPendingItems, findClaimConflict, goodwillCategory, routeWarrantyRequest } from '../claimRules';
import { COMMON_LOV_ID } from '../../data/commonLov';
import { findCommonLovConflict, lovValues } from '../commonLov';
import { validateMasterRecordRules } from '../recordRules';

const rows = (id: string) => MASTER_COLLECTIONS.find((m) => m.id === id)!.records;
const all = () => Object.fromEntries([...Object.values(CLAIM_MASTER_IDS), COMMON_LOV_ID].map((id) => [id, rows(id)]));
const lov = rows(COMMON_LOV_ID);
const matrix = rows(CLAIM_MASTER_IDS.approvalMatrix);

describe('Claims masters match the BA workbook "Claims Masters List"', () => {
  it.each([
    [CLAIM_LOV.budgetPurpose, ['Approved Yearly Budget', 'Special Budget']],
    [CLAIM_LOV.specialGoodwill, ['IUPR', 'Thrive']],
    [CLAIM_LOV.issueDescription, ['Thermal Incident', 'Engine Failure']],
    [CLAIM_LOV.complaintType, ['Transmission', 'Clutch']],
  ])('%s', (code, values) => {
    expect(lovValues(lov, code)).toEqual(values);
  });

  it('maps each issue description to its type and category', () => {
    expect(goodwillCategory(rows(CLAIM_MASTER_IDS.goodwillCategory), 'thermal incident')).toEqual({ issueType: 'Catastrophic Situation', category: 'Red' });
    expect(goodwillCategory(rows(CLAIM_MASTER_IDS.goodwillCategory), 'Engine Failure')).toEqual({ issueType: 'Minor Product Failure', category: 'Amber' });
    expect(goodwillCategory(rows(CLAIM_MASTER_IDS.goodwillCategory), 'Flood')).toBeNull();
  });

  it('has the three approval levels (BA answer: SHQ Lead 1 approves above ₹20,000) with 24 h reminders, and test SHQ users only', () => {
    expect(matrix.map((m) => [m.level, m.persona, m.canApprove, m.approvesUpTo, m.reminderHours, m.reminderVia])).toEqual([
      [1, 'Claim Manager', 'Y', 20000, 24, 'Notification + Email'],
      [2, 'CCM/ACCM', 'N', null, 24, 'Notification + Email'],
      [3, 'SHQ Lead 1', 'Y', null, 24, 'Notification + Email'],
    ]);
    expect(rows(CLAIM_MASTER_IDS.shqUsers).every((u) => u.userName.startsWith('Test User'))).toBe(true);
  });

  it('is consistent, with only the guideline files pending from business', () => {
    expect(claimHealthCheck(all())).toEqual([]);
    expect(claimPendingItems(all())).toEqual(['No AMC Service Guideline file uploaded yet.', 'No Extended Warranty Service Guideline file uploaded yet.']);
  });
});

describe('Authorization request routing', () => {
  it('Claim Manager approves up to and including ₹20,000', () => {
    for (const amount of [1, 19999, 20000]) {
      const r = routeWarrantyRequest(matrix, amount);
      expect(r.approver).toBe('Claim Manager');
      expect(r.steps).toHaveLength(1);
    }
  });

  it('above ₹20,000 goes through CCM/ACCM to SHQ Lead 1, who approves any amount', () => {
    for (const amount of [20001, 5000000]) {
      const r = routeWarrantyRequest(matrix, amount);
      expect(r.approver).toBe('SHQ Lead 1');
      expect(r.steps.map((s) => [s.persona, s.canApprove])).toEqual([
        ['Claim Manager', false],
        ['CCM/ACCM', false],
        ['SHQ Lead 1', true],
      ]);
      expect(r.gap).toBeUndefined();
    }
  });

  it('reports a gap when the top level cannot approve', () => {
    const noShq = matrix.filter((m) => m.persona !== 'SHQ Lead 1');
    expect(routeWarrantyRequest(noShq, 25000).gap).toMatch(/"SHQ Lead 1" is not in the approval matrix/);
    expect(claimPendingItems({ ...all(), [CLAIM_MASTER_IDS.approvalMatrix]: noShq })[0]).toMatch(/above ₹20,000 go to "SHQ Lead 1"/);
  });

  it('ignores inactive levels', () => {
    const shqOff = matrix.map((m) => (m.persona === 'SHQ Lead 1' ? { ...m, status: 'Inactive' } : m));
    expect(routeWarrantyRequest(shqOff, 25000).approver).toBeNull();
  });
});

describe('Claims validation', () => {
  it('a level that cannot approve must forward', () => {
    const rule = (r: Record<string, unknown>) => validateMasterRecordRules(CLAIM_MASTER_IDS.approvalMatrix, r);
    expect(rule({ canApprove: 'N', approvesUpTo: null, forwardTo: '' })).toHaveProperty('forwardTo');
    expect(rule({ canApprove: 'N', approvesUpTo: 5000, forwardTo: 'X' })).toHaveProperty('approvesUpTo');
    expect(rule({ canApprove: 'Y', approvesUpTo: 5000, forwardTo: '' })).toHaveProperty('forwardTo');
    expect(rule({ canApprove: 'Y', approvesUpTo: null, forwardTo: '' })).toEqual({});
  });

  it('rejects duplicates', () => {
    expect(findCommonLovConflict(COMMON_LOV_ID, { id: 'N', lovCode: CLAIM_LOV.specialGoodwill, value: 'iupr', status: 'Active' }, lov)).toMatch(/CLAIM_SPECIAL_GOODWILL-01/);
    expect(findClaimConflict(CLAIM_MASTER_IDS.goodwillCategory, { id: 'N', issueDescription: 'Engine Failure', status: 'Active' }, rows(CLAIM_MASTER_IDS.goodwillCategory))).toMatch(/GWC-02/);
  });

  it('health check catches unmapped issues, orphan mappings and falling limits', () => {
    const data = all();
    data[COMMON_LOV_ID] = [...lov, { id: 'CLAIM_ISSUE_DESCRIPTION-03', lovCode: CLAIM_LOV.issueDescription, module: 'CLAIM', fieldName: 'Issue Description', value: 'Flood Damage', status: 'Active', order: 3 }];
    data[CLAIM_MASTER_IDS.goodwillCategory] = [...data[CLAIM_MASTER_IDS.goodwillCategory], { id: 'GWC-03', issueDescription: 'Fire', issueType: 'X', requestCategory: 'Red', status: 'Active' }];
    data[CLAIM_MASTER_IDS.approvalMatrix] = matrix.map((m) => (m.persona === 'SHQ Lead 1' ? { ...m, approvesUpTo: 10000, forwardTo: 'SHQ Lead 2' } : m));
    const issues = claimHealthCheck(data);
    expect(issues.some((i) => i.includes('"Flood Damage" has no Request Category'))).toBe(true);
    expect(issues.some((i) => i.includes('"Fire" is not an active Issue Description'))).toBe(true);
    expect(issues.some((i) => i.includes('limits must increase'))).toBe(true);
  });

  it('health check flags approver levels hidden behind an unlimited approver', () => {
    const data = all();
    data[CLAIM_MASTER_IDS.approvalMatrix] = [...matrix, { id: 'WAM-04', level: 4, persona: 'SHQ Lead 2', canApprove: 'Y', approvesUpTo: null, actions: 'Approve', forwardTo: '', reminderHours: 24, reminderVia: 'Notification + Email', status: 'Active' }];
    expect(claimHealthCheck(data).some((i) => i.includes('SHQ Lead 1 has no upper limit'))).toBe(true);
  });
});
