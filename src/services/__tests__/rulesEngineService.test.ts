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
