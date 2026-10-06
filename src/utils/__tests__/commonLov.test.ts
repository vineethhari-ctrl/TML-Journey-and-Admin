import { describe, it, expect } from 'vitest';
import { MASTER_COLLECTIONS } from '../../data/masterCatalogue';
import { COMMON_LOV_ID, LOV_DEFINITIONS } from '../../data/commonLov';
import { commonLovHealthCheck, commonLovRecords, findCommonLovConflict, lovCatalogue, lovValues, resolveLovFields } from '../commonLov';
import { validateMasterRecordRules } from '../recordRules';

const lov = commonLovRecords(MASTER_COLLECTIONS);
const row = (over: Record<string, unknown>) => ({ id: 'N', lovCode: 'THD_ABC', module: 'THD', fieldName: 'ABC', value: '1', order: 1, parentLovCode: '', parentValue: '', status: 'Active', ...over });

describe('Common LOV Master', () => {
  it('holds every list once, one row per value, and is healthy', () => {
    expect(new Set(LOV_DEFINITIONS.map((d) => d.code)).size).toBe(LOV_DEFINITIONS.length);
    expect(lov).toHaveLength(LOV_DEFINITIONS.reduce((n, d) => n + d.values.length, 0));
    expect(commonLovHealthCheck(lov, MASTER_COLLECTIONS)).toEqual([]);
  });

  it('is a Common Master, next to the other shared masters', () => {
    const common = MASTER_COLLECTIONS.filter((m) => m.logicalGroup === 'Common Masters').map((m) => m.id);
    expect(common).toEqual(expect.arrayContaining([COMMON_LOV_ID, 'ppl_master', 'complaint_codes', 'dealer_details_registry']));
  });

  it('gives Active values in Order, and dependent values per parent', () => {
    const rows = [row({ id: 'a', value: '2', order: 2 }), row({ id: 'b', value: '1', order: 1 }), row({ id: 'c', value: '3', order: 3, status: 'Inactive' })];
    expect(lovValues(rows, 'THD_ABC')).toEqual(['1', '2']);
    expect(lovValues(lov, 'THD_PROGRESS_SUB_STATUS', 'Pending for parts')).toEqual(['Order status', 'Part receipt status']);
  });

  it('checks the Parameter name and parent fields on save', () => {
    expect(validateMasterRecordRules(COMMON_LOV_ID, row({}))).toEqual({});
    expect(validateMasterRecordRules(COMMON_LOV_ID, row({ lovCode: 'thd abc' }))).toHaveProperty('lovCode');
    expect(validateMasterRecordRules(COMMON_LOV_ID, row({ lovCode: 'CLAIM_ABC' }))).toHaveProperty('lovCode');
    expect(validateMasterRecordRules(COMMON_LOV_ID, row({ parentValue: 'X' }))).toHaveProperty('parentLovCode');
    expect(validateMasterRecordRules(COMMON_LOV_ID, row({ parentLovCode: 'THD_ABC', parentValue: 'X' }))).toHaveProperty('parentLovCode');
  });

  it('rejects a duplicate value in the same list, not in another list', () => {
    expect(findCommonLovConflict(COMMON_LOV_ID, row({ lovCode: 'THD_CLOSURE_ACTION', value: ' closed ' }), lov)).toMatch(/THD_CLOSURE_ACTION-01/);
    expect(findCommonLovConflict(COMMON_LOV_ID, row({ lovCode: 'THD_ABC', value: 'Closed' }), lov)).toBeNull();
    expect(findCommonLovConflict('other_master', row({ lovCode: 'THD_CLOSURE_ACTION', value: 'Closed' }), lov)).toBeNull();
  });

  it('fills master fields that name a list, and reports lists that are missing', () => {
    const rows = lov.map((r) => (r.lovCode === 'COMMON_BU' && r.value === 'CV' ? { ...r, status: 'Inactive' } : r));
    const masters = resolveLovFields(MASTER_COLLECTIONS.map((m) => (m.id === COMMON_LOV_ID ? { ...m, records: rows } : m)));
    expect(masters.find((m) => m.id === 'ppl_master')!.fields.find((f) => f.key === 'bu')!.options).toEqual(['PV', 'EV']);
    const broken = MASTER_COLLECTIONS.map((m) => (m.id === 'ppl_master' ? { ...m, fields: m.fields.map((f) => (f.key === 'bu' ? { ...f, lovCode: 'COMMON_NOPE' } : f)) } : m));
    expect(commonLovHealthCheck(lov, broken).some((i) => i.includes('COMMON_NOPE is not in the Common LOV Master'))).toBe(true);
  });

  it('lists every list with its owner, values and users', () => {
    const bu = lovCatalogue(lov, MASTER_COLLECTIONS).find((l) => l.code === 'COMMON_BU')!;
    expect(bu).toMatchObject({ module: 'COMMON', active: 3, values: ['PV', 'EV', 'CV'] });
    expect(bu.usedIn.some((u) => u.includes('PPL'))).toBe(true);
    expect(lovCatalogue(lov).find((l) => l.code === 'THD_PROGRESS_SUB_STATUS')!.parentCode).toBe('THD_PROGRESS');
  });

  it('has PV and EV as separate BU values, never a combined "PV + EV"', () => {
    expect(lovValues(lov, 'COMMON_BU')).toEqual(['PV', 'EV', 'CV']);
    MASTER_COLLECTIONS.forEach((m) => {
      m.fields.filter((f) => f.key === 'bu').forEach((f) => expect(f.lovCode, `${m.id}.bu`).toBe('COMMON_BU'));
      m.records.forEach((r) => expect(String(r.bu ?? ''), `${m.id} ${r.id}`).not.toMatch(/\+/));
    });
  });
});
