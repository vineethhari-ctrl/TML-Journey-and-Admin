import { describe, it, expect, beforeEach } from 'vitest';
import { rulesEngineService as svc, CustomFieldRuleDefinition } from '../rulesEngineService';

const baseRule = (over: Partial<CustomFieldRuleDefinition> = {}): CustomFieldRuleDefinition => ({
  id: 'R1',
  key: 'test_field',
  label: 'Test Field',
  widgetType: 'text',
  targetModule: 'general',
  version: 1,
  lastUpdated: '',
  updatedBy: 'test',
  active: true,
  validation: {},
  uiLogic: {},
  ...over,
});

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeEach(() => svc.resetToDefaults());

describe('condition evaluation', () => {
  it('handles equals / in / contains case-insensitively', () => {
    expect(svc.evaluateSingleCondition({ field: 'f', operator: 'equals', value: 'ev' }, { f: 'EV' })).toBe(true);
    expect(svc.evaluateSingleCondition({ field: 'f', operator: 'in', value: ['EV', 'CNG'] }, { f: 'cng' })).toBe(true);
    expect(svc.evaluateSingleCondition({ field: 'f', operator: 'contains', value: 'nexon' }, { f: 'Tata Nexon EV' })).toBe(true);
  });

  it('numeric comparisons never match an empty value', () => {
    expect(svc.evaluateSingleCondition({ field: 'odo', operator: 'lessThan', value: 1000 }, { odo: '' })).toBe(false);
    expect(svc.evaluateSingleCondition({ field: 'odo', operator: 'lessThan', value: 1000 }, {})).toBe(false);
    expect(svc.evaluateSingleCondition({ field: 'odo', operator: 'lessThan', value: 1000 }, { odo: 500 })).toBe(true);
  });

  it('evaluates nested AND / OR groups', () => {
    const cond = {
      logicalOperator: 'AND' as const,
      conditions: [
        { field: 'fuel', operator: 'equals' as const, value: 'EV' },
        {
          logicalOperator: 'OR' as const,
          conditions: [
            { field: 'soh', operator: 'lessThan' as const, value: 80 },
            { field: 'claim', operator: 'isTrue' as const },
          ],
        },
      ],
    };
    expect(svc.evaluateCompoundCondition(cond, { fuel: 'EV', soh: 70 })).toBe(true);
    expect(svc.evaluateCompoundCondition(cond, { fuel: 'EV', soh: 95, claim: 'Y' })).toBe(true);
    expect(svc.evaluateCompoundCondition(cond, { fuel: 'EV', soh: 95 })).toBe(false);
    expect(svc.evaluateCompoundCondition(cond, { fuel: 'DIESEL', soh: 70 })).toBe(false);
  });
});

describe('field validation', () => {
  it('a date rule with max "today" accepts today (timezone-safe)', () => {
    const rule = baseRule({ widgetType: 'date', validation: { dateRange: { maxDate: 'today' } } });
    expect(svc.validateField(rule, localToday(), {}).isValid).toBe(true);
  });

  it('a date rule with min "today" rejects yesterday', () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const ymd = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    const rule = baseRule({ widgetType: 'date', validation: { dateRange: { minDate: 'today' } } });
    expect(svc.validateField(rule, ymd, {}).isValid).toBe(false);
  });

  it('applies regex, range and required rules; hidden fields are never invalid', () => {
    const rule = baseRule({
      widgetType: 'number',
      validation: { required: true, range: { min: 0, max: 100 } },
      uiLogic: { visibleIf: { field: 'fuel', operator: 'equals', value: 'EV' } },
    });
    expect(svc.validateField(rule, 120, { fuel: 'EV' }).isValid).toBe(false);
    expect(svc.validateField(rule, '', { fuel: 'EV' }).isValid).toBe(false);
    expect(svc.validateField(rule, 50, { fuel: 'EV' }).isValid).toBe(true);
    expect(svc.validateField(rule, '', { fuel: 'DIESEL' }).isValid).toBe(true);

    const regexRule = baseRule({ validation: { regex: { pattern: '^[0-9]{16}$', message: '16 digits' } } });
    expect(svc.validateField(regexRule, '123', {}).errors).toEqual(['16 digits']);
  });
});

describe('rule management', () => {
  it('saving a new rule updates the list with a new array (so the UI re-renders)', () => {
    const before = svc.getAllRules();
    const key = svc.suggestUniqueKey();
    expect(svc.saveRule(baseRule({ id: 'NEW', key })).success).toBe(true);
    const after = svc.getAllRules();
    expect(after).not.toBe(before);
    expect(after.some((r) => r.key === key)).toBe(true);
  });

  it('rejects a key already used by another rule instead of overwriting it', () => {
    const [first, second] = svc.getAllRules();
    const res = svc.saveRule({ ...second, key: first.key });
    expect(res.success).toBe(false);
    expect(svc.getAllRules().find((r) => r.id === first.id)?.label).toBe(first.label);
  });

  it('rejects an invalid regex pattern', () => {
    const res = svc.saveRule(baseRule({ id: 'BAD', key: 'bad_regex', validation: { regex: { pattern: '([a-z', message: 'x' } } }));
    expect(res.success).toBe(false);
  });

  it('suggestUniqueKey never returns a key that exists', () => {
    const keys = new Set(svc.getAllRules().map((r) => r.key));
    expect(keys.has(svc.suggestUniqueKey())).toBe(false);
  });

  it('cannot delete the active release', () => {
    const active = svc.getActiveApiVersion().version;
    expect(svc.deleteVersion(active).success).toBe(false);
  });
});

describe('A/B testing module', () => {
  it('loads default seeded experiments', () => {
    const experiments = svc.getAllExperiments();
    expect(experiments.length).toBeGreaterThanOrEqual(2);
    const evExp = experiments.find((e) => e.id === 'EXP-EV-INSPECTION-V2');
    expect(evExp).toBeDefined();
    expect(evExp?.status).toBe('RUNNING');
    expect(evExp?.controlVersion).toBe('v1.1.0');
    expect(evExp?.variantVersion).toBe('v2.0.0-rc1');
  });

  it('validates experiment creation', () => {
    // Fails if control and variant are identical
    const failIdentical = svc.createExperiment({
      name: 'Identical Versions Test',
      controlVersion: 'v1.1.0',
      variantVersion: 'v1.1.0',
    });
    expect(failIdentical.success).toBe(false);

    // Fails if version does not exist
    const failNonExistent = svc.createExperiment({
      name: 'Nonexistent Test',
      controlVersion: 'v1.1.0',
      variantVersion: 'v9.9.9',
    });
    expect(failNonExistent.success).toBe(false);

    // Succeeds with valid releases
    const success = svc.createExperiment({
      id: 'EXP-TEST-PILOT',
      name: 'Valid Pilot Test',
      controlVersion: 'v1.0.0',
      variantVersion: 'v1.1.0',
      trafficSplitPercentB: 40,
    });
    expect(success.success).toBe(true);
    expect(svc.getExperimentById('EXP-TEST-PILOT')).toBeDefined();
  });

  it('supports start, pause, and delete lifecycle', () => {
    const created = svc.createExperiment({
      id: 'EXP-LIFECYCLE',
      name: 'Lifecycle Test',
      controlVersion: 'v1.0.0',
      variantVersion: 'v1.1.0',
      status: 'DRAFT',
    });
    expect(created.success).toBe(true);

    expect(svc.startExperiment('EXP-LIFECYCLE')).toBe(true);
    expect(svc.getExperimentById('EXP-LIFECYCLE')?.status).toBe('RUNNING');

    expect(svc.pauseExperiment('EXP-LIFECYCLE')).toBe(true);
    expect(svc.getExperimentById('EXP-LIFECYCLE')?.status).toBe('PAUSED');

    expect(svc.deleteExperiment('EXP-LIFECYCLE')).toBe(true);
    expect(svc.getExperimentById('EXP-LIFECYCLE')).toBeUndefined();
  });

  it('assigns variants deterministically for subject keys', () => {
    const exp = svc.getExperimentById('EXP-EV-INSPECTION-V2')!;
    const variant1 = svc.assignVariant(exp, 'DEALER-MUMBAI-01');
    const variant2 = svc.assignVariant(exp, 'DEALER-MUMBAI-01');
    expect(variant1).toBe(variant2);

    // 0% traffic to B always gives A
    const exp0 = { ...exp, trafficSplitPercentB: 0 };
    expect(svc.assignVariant(exp0, 'ANY-KEY-1')).toBe('A');
    expect(svc.assignVariant(exp0, 'ANY-KEY-2')).toBe('A');

    // 100% traffic to B always gives B
    const exp100 = { ...exp, trafficSplitPercentB: 100 };
    expect(svc.assignVariant(exp100, 'ANY-KEY-1')).toBe('B');
    expect(svc.assignVariant(exp100, 'ANY-KEY-2')).toBe('B');
  });

  it('matches context targeting criteria correctly', () => {
    // EXP-EV-INSPECTION-V2 targets EV in West / North on vehicle_journey
    const matchingContext = svc.getActiveExperimentForContext({
      targetModule: 'vehicle_journey',
      fuelType: 'EV',
      region: 'West',
      subjectKey: 'DLR-MUM-10',
    });
    expect(matchingContext).toBeDefined();
    expect(matchingContext?.experiment.id).toBe('EXP-EV-INSPECTION-V2');

    // Non-matching fuel type (Diesel) returns null
    const nonMatchingFuel = svc.getActiveExperimentForContext({
      targetModule: 'vehicle_journey',
      fuelType: 'Diesel',
      region: 'West',
    });
    expect(nonMatchingFuel).toBeNull();

    // Non-matching region (South) returns null
    const nonMatchingRegion = svc.getActiveExperimentForContext({
      targetModule: 'vehicle_journey',
      fuelType: 'EV',
      region: 'South',
    });
    expect(nonMatchingRegion).toBeNull();
  });

  it('resolves rules with A/B testing and supports forced variant overrides', () => {
    const resA = svc.resolveRulesWithABTesting({
      targetModule: 'workshop_floor',
      fuelType: 'EV',
      region: 'West',
      forceVariant: 'A',
    });
    expect(resA.resolvedVersion).toBe('v1.1.0');
    expect(resA.activeExperiment?.variant).toBe('A');

    const resB = svc.resolveRulesWithABTesting({
      targetModule: 'workshop_floor',
      fuelType: 'EV',
      region: 'West',
      forceVariant: 'B',
    });
    expect(resB.resolvedVersion).toBe('v2.0.0-rc1');
    expect(resB.activeExperiment?.variant).toBe('B');
    // v2.0.0-rc1 includes the new insulation resistance check
    expect(resB.rules.some((r) => r.key === 'ev_insulation_resistance_mohm')).toBe(true);
  });

  it('records metrics and calculates statistical variant analysis', () => {
    const expId = 'EXP-EV-INSPECTION-V2';
    const beforeAnalysis = svc.compareExperimentVariants(expId)!;
    const initialImpressionsB = beforeAnalysis.variantB.impressions;

    svc.recordExperimentMetric(expId, 'B', 'impression');
    svc.recordExperimentMetric(expId, 'B', 'submission', 35);
    svc.recordExperimentMetric(expId, 'B', 'error');

    const afterAnalysis = svc.compareExperimentVariants(expId)!;
    expect(afterAnalysis.variantB.impressions).toBe(initialImpressionsB + 1);
    expect(afterAnalysis.recommendedWinner).toBeDefined();
    expect(afterAnalysis.confidenceScore).toBeGreaterThan(0);
    expect(afterAnalysis.diffSummary.fieldsAdded.length).toBeGreaterThan(0);
  });

  it('concludes an experiment and promotes winner to ACTIVE production when requested', () => {
    const exp = svc.getExperimentById('EXP-EV-INSPECTION-V2')!;
    const previousActive = svc.getActiveApiVersion().version;
    expect(previousActive).toBe('v1.1.0');

    // Conclude with variant B winning and deploy
    const result = svc.concludeExperiment(exp.id, 'B', true, 'Pilot verified with 95% compliance.', 'TML-DIRECTOR');
    expect(result.success).toBe(true);

    const updatedExp = svc.getExperimentById(exp.id)!;
    expect(updatedExp.status).toBe('CONCLUDED');
    expect(updatedExp.winningVariant).toBe('B');

    // Production active version has been promoted to v2.0.0-rc1!
    expect(svc.getActiveApiVersion().version).toBe('v2.0.0-rc1');
  });
});
