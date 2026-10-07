import { describe, it, expect } from 'vitest';
import { MASTER_COLLECTIONS } from '../masterCatalogue';
import { buildGenericMasters } from '../genericMasters';
import { checkRecord, validateRuleDefinition } from '../../utils/masterRules';
import { commonLovHealthCheck, commonLovRecords } from '../../utils/commonLov';

const generic = buildGenericMasters();

describe('generic masters', () => {
  it('has the 15 masters, all in Common Masters', () => {
    expect(generic).toHaveLength(15);
    generic.forEach((m) => expect(m).toMatchObject({ moduleCode: 'common', logicalGroup: 'Common Masters' }));
  });

  it.each(generic.map((m) => [m.id, m] as const))('%s: every row passes its fields and rules; its rules are well-formed', (_id, m) => {
    expect(m.records.length).toBeGreaterThan(0);
    m.records.forEach((r) => {
      const res = checkRecord(m, r, { others: m.records, masters: MASTER_COLLECTIONS });
      expect(res.errors, `${m.id} ${r.id}`).toEqual({});
    });
    (m.rules ?? []).forEach((rule) => expect(validateRuleDefinition(rule, m, MASTER_COLLECTIONS), rule.id).toEqual([]));
  });

  it('fields that name a list find it in the Common LOV Master', () => {
    expect(commonLovHealthCheck(commonLovRecords(MASTER_COLLECTIONS), MASTER_COLLECTIONS)).toEqual([]);
  });

  it('rules refuse a bad row (duplicate code, designation in an unknown department)', () => {
    const dep = generic.find((m) => m.id === 'department_master')!;
    expect(checkRecord(dep, { ...dep.records[0], id: 'X' }, { others: dep.records }).isValid).toBe(false);
    const dsg = generic.find((m) => m.id === 'designation_master')!;
    const bad = { ...dsg.records[0], id: 'Y', designationCode: 'NEW-1', designationName: 'New', department: 'Service' };
    const masters = MASTER_COLLECTIONS.map((m) => (m.id === 'department_master' ? { ...m, records: m.records.filter((r) => r.departmentName !== 'Service') } : m));
    expect(checkRecord(dsg, bad, { others: dsg.records, masters }).isValid).toBe(false);
    expect(checkRecord(dsg, bad, { others: dsg.records, masters: MASTER_COLLECTIONS }).isValid).toBe(true);
  });
});
