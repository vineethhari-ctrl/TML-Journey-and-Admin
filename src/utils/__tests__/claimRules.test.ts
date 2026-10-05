import { describe, it, expect } from 'vitest';
import { MASTER_COLLECTIONS } from '../../data/masterCatalogue';
import { CLAIM_MASTER_IDS, claimHealthCheck, claimPendingItems, findClaimConflict, goodwillCategory, routeWarrantyRequest } from '../claimRules';
import { dropdownValues } from '../thdRules';
import { validateMasterRecordRules } from '../recordRules';

const rows = (id: string) => MASTER_COLLECTIONS.find((m) => m.id === id)!.records;
const all = () => Object.fromEntries(Object.values(CLAIM_MASTER_IDS).map((id) => [id, rows(id)]));
const matrix = rows(CLAIM_MASTER_IDS.approvalMatrix);

describe('Claims masters match the BA workbook "Claims Masters List"', () => {
  it.each([
    [CLAIM_MASTER_IDS.budgetPurpose, ['Approved Yearly Budget', 'Special Budget']],
    [CLAIM_MASTER_IDS.specialGoodwill, ['IUPR', 'Thrive']],
    [CLAIM_MASTER_IDS.issueDescription, ['Thermal Incident', 'Engine Failure']],
    [CLAIM_MASTER_IDS.complaintType, ['Transmission', 'Clutch']],
  ])('%s', (id, values) => {
    expect(dropdownValues(rows(id))).toEqual(values);
  });

  it('maps each issue description to its type and category', () => {
    expect(goodwillCategory(rows(CLAIM_MASTER_IDS.goodwillCategory), 'thermal incident')).toEqual({ issueType: 'Catastrophic Situation', category: 'Red' });
    expect(goodwillCategory(rows(CLAIM_MASTER_IDS.goodwillCategory), 'Engine Failure')).toEqual({ issueType: 'Minor Product Failure', category: 'Amber' });
    expect(goodwillCategory(rows(CLAIM_MASTER_IDS.goodwillCategory), 'Flood')).toBeNull();
  });

  it('has the two approval levels with 24 h reminders, and test SHQ users only', () => {
    expect(matrix.map((m) => [m.level, m.persona, m.approvesBelow, m.reminderHours])).toEqual([
      [1, 'Claim Manager', 20000, 24],
      [2, 'CCM/ACCM', null, 24],
    ]);
    expect(rows(CLAIM_MASTER_IDS.shqUsers).every((u) => u.userName.startsWith('Test User'))).toBe(true);
  });

  it('is consistent, with the SHQ Lead 1 level and the guideline files pending from business', () => {
    expect(claimHealthCheck(all())).toEqual([]);
    const pending = claimPendingItems(all());
    expect(pending).toHaveLength(3);
    expect(pending[0]).toMatch(/₹20,000 and above go to "SHQ Lead 1"/);
  });
});

describe('Warranty Authorization routing', () => {
  it('Claim Manager approves below ₹20,000', () => {
    const r = routeWarrantyRequest(matrix, 19999);
    expect(r.approver).toBe('Claim Manager');
    expect(r.steps).toHaveLength(1);
  });

  it('₹20,000 and above passes CCM/ACCM and has no approver until SHQ Lead 1 is added', () => {
    const r = routeWarrantyRequest(matrix, 20000);
    expect(r.approver).toBeNull();
    expect(r.steps.map((s) => s.persona)).toEqual(['Claim Manager', 'CCM/ACCM']);
    expect(r.gap).toMatch(/"SHQ Lead 1" is not in the approval matrix/);
  });

  it('routes to a new top level once it is added', () => {
    const withShq = [...matrix, { id: 'WAM-03', level: 3, persona: 'SHQ Lead 1', approvesBelow: 500000, actions: 'Approve', forwardTo: '', reminderHours: 48, status: 'Active' }];
    expect(routeWarrantyRequest(withShq, 250000).approver).toBe('SHQ Lead 1');
    expect(claimPendingItems({ ...all(), [CLAIM_MASTER_IDS.approvalMatrix]: withShq }).some((p) => p.includes('Approval matrix'))).toBe(false);
  });
});

describe('Claims validation', () => {
  it('a level that cannot approve must forward', () => {
    expect(validateMasterRecordRules(CLAIM_MASTER_IDS.approvalMatrix, { approvesBelow: null, forwardTo: '' })).toHaveProperty('forwardTo');
    expect(validateMasterRecordRules(CLAIM_MASTER_IDS.approvalMatrix, { approvesBelow: 5000, forwardTo: '' })).toEqual({});
  });

  it('rejects duplicates', () => {
    expect(findClaimConflict(CLAIM_MASTER_IDS.specialGoodwill, { id: 'N', value: 'iupr', status: 'Active' }, rows(CLAIM_MASTER_IDS.specialGoodwill))).toMatch(/SPC-01/);
    expect(findClaimConflict(CLAIM_MASTER_IDS.goodwillCategory, { id: 'N', issueDescription: 'Engine Failure', status: 'Active' }, rows(CLAIM_MASTER_IDS.goodwillCategory))).toMatch(/GWC-02/);
  });

  it('health check catches unmapped issues, orphan mappings and falling limits', () => {
    const data = all();
    data[CLAIM_MASTER_IDS.issueDescription] = [...data[CLAIM_MASTER_IDS.issueDescription], { id: 'ISD-03', value: 'Flood Damage', status: 'Active', order: 3 }];
    data[CLAIM_MASTER_IDS.goodwillCategory] = [...data[CLAIM_MASTER_IDS.goodwillCategory], { id: 'GWC-03', issueDescription: 'Fire', issueType: 'X', requestCategory: 'Red', status: 'Active' }];
    data[CLAIM_MASTER_IDS.approvalMatrix] = [...matrix, { id: 'WAM-03', level: 3, persona: 'SHQ Lead 1', approvesBelow: 10000, actions: 'Approve', forwardTo: '', reminderHours: 24, status: 'Active' }];
    const issues = claimHealthCheck(data);
    expect(issues.some((i) => i.includes('"Flood Damage" has no Request Category'))).toBe(true);
    expect(issues.some((i) => i.includes('"Fire" is not an active Issue Description'))).toBe(true);
    expect(issues.some((i) => i.includes('limits must increase'))).toBe(true);
  });
});
