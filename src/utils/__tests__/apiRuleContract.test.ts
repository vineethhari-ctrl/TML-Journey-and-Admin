/**
 * The worked examples of the rule endpoints in public/api-docs/openapi.yaml, proven against the real rules:
 * /rules/thd/auto-trigger, /rules/claims/route and /rules/claims/goodwill-category.
 * If a rule changes, this fails until the contract's example is updated too.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { MASTER_COLLECTIONS } from '../../data/masterCatalogue';
import { THD_MASTER_IDS, evaluateAutoThd } from '../thdRules';
import { CLAIM_MASTER_IDS, goodwillCategory, routeWarrantyRequest } from '../claimRules';

const rows = (id: string) => MASTER_COLLECTIONS.find((m) => m.id === id)!.records;
const contract = fs.readFileSync(path.resolve(__dirname, '../../../public/api-docs/openapi.yaml'), 'utf8');
const nexonE32 = [{ id: 'C1', ppl: 'Nexon', complaintCode: 'E32', aggregate: 'Electricals', critical: 'Y', status: 'Active' }];

/** The shape of the API response for /rules/thd/auto-trigger (the rule row projected to the documented fields). */
function thdResponse(event: Parameters<typeof evaluateAutoThd>[2]) {
  const r = evaluateAutoThd(rows(THD_MASTER_IDS.triggers), nexonE32, event);
  return {
    fired: r.fired.map((f) => ({
      ruleNo: f.rule.ruleNo,
      scenarioCode: f.rule.scenarioCode,
      businessCondition: f.rule.businessCondition,
      triggerPoint: f.rule.triggerPoint,
      thdTag: f.rule.thdTag,
      assignedTo: f.rule.assignedTo,
      escalationComplaint: f.rule.escalationComplaint,
      reason: f.reason,
    })),
    pending: r.pending.map((p) => ({ ruleNo: p.rule.ruleNo, scenarioCode: p.rule.scenarioCode, reason: p.reason })),
  };
}

describe('POST /rules/thd/auto-trigger (contract example)', () => {
  it('a critical complaint at job card creation fires rule 2', () => {
    expect(thdResponse({ ppl: 'Nexon', complaintCodes: ['E32'] })).toEqual({
      fired: [
        {
          ruleNo: 2,
          scenarioCode: 'CRITICAL_AT_JC_CREATION',
          businessCondition: 'A Critical Complaint (PPL-CC list) is added in the Job Card.',
          triggerPoint: 'Job Card Creation',
          thdTag: 'Critical / Escalation',
          assignedTo: 'DET',
          escalationComplaint: 'Yes/No',
          reason: 'Critical complaint E32 in the Job Card.',
        },
      ],
      pending: [],
    });
  });

  it('a critical complaint added later is reported as pending until business gives the Time Window', () => {
    expect(thdResponse({ ppl: 'Nexon', complaintCodes: ['E32'], hoursSinceCriticalAddedLater: 5 })).toEqual({
      fired: [],
      pending: [{ ruleNo: 3, scenarioCode: 'CRITICAL_AFTER_JC_CREATION', reason: 'Would apply, but the Time Window is still pending from business.' }],
    });
  });
});

describe('POST /rules/claims/route (contract example)', () => {
  const matrix = rows(CLAIM_MASTER_IDS.approvalMatrix);

  it('20,001 goes past Claim Manager and CCM/ACCM to SHQ Lead 1', () => {
    expect(routeWarrantyRequest(matrix, 20001)).toEqual({
      steps: [
        { level: 1, persona: 'Claim Manager', canApprove: false, reminderHours: 24 },
        { level: 2, persona: 'CCM/ACCM', canApprove: false, reminderHours: 24 },
        { level: 3, persona: 'SHQ Lead 1', canApprove: true, reminderHours: 24 },
      ],
      approver: 'SHQ Lead 1',
    });
  });

  it('the limit is inclusive: 20,000 is approved by the Claim Manager', () => {
    expect(routeWarrantyRequest(matrix, 20000).approver).toBe('Claim Manager');
  });
});

describe('POST /rules/claims/goodwill-category (contract example)', () => {
  it('maps Thermal Incident, and reports an unknown description as not mapped', () => {
    const mapping = rows(CLAIM_MASTER_IDS.goodwillCategory);
    expect(goodwillCategory(mapping, 'Thermal Incident')).toEqual({ issueType: 'Catastrophic Situation', category: 'Red' });
    expect(goodwillCategory(mapping, 'Flood')).toBeNull();
  });
});

describe('the contract documents exactly these examples', () => {
  it.each([
    'CRITICAL_AT_JC_CREATION',
    'Critical complaint E32 in the Job Card.',
    'Would apply, but the Time Window is still pending from business.',
    'SHQ Lead 1',
    'Catastrophic Situation',
    '/rules/thd/auto-trigger:',
    '/rules/claims/route:',
    '/rules/claims/goodwill-category:',
  ])('openapi.yaml contains "%s"', (text) => {
    expect(contract).toContain(text);
  });
});
