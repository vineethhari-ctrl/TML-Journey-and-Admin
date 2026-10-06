import { describe, it, expect } from 'vitest';
import { MASTER_COLLECTIONS } from '../../data/masterCatalogue';
import { COMMON_LOV_ID, LOV_DEFINITIONS } from '../../data/commonLov';
import { LOV_TYPE_ERRORS, applyLovTypeDraft, commonLovHealthCheck, commonLovRecords, findCommonLovConflict, lovCatalogue, lovRows, lovValues, resolveLovFields } from '../commonLov';
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
    const rows = lov.map((r) => (r.lovCode === 'COMMON_BU' && r.value === 'EV' ? { ...r, status: 'Inactive' } : r));
    const masters = resolveLovFields(MASTER_COLLECTIONS.map((m) => (m.id === COMMON_LOV_ID ? { ...m, records: rows } : m)));
    expect(masters.find((m) => m.id === 'ppl_master')!.fields.find((f) => f.key === 'bu')!.options).toEqual(['PV']);
    const broken = MASTER_COLLECTIONS.map((m) => (m.id === 'ppl_master' ? { ...m, fields: m.fields.map((f) => (f.key === 'bu' ? { ...f, lovCode: 'COMMON_NOPE' } : f)) } : m));
    expect(commonLovHealthCheck(lov, broken).some((i) => i.includes('COMMON_NOPE is not in the Common LOV Master'))).toBe(true);
  });

  it('lists every list with its owner, values and users', () => {
    const bu = lovCatalogue(lov, MASTER_COLLECTIONS).find((l) => l.code === 'COMMON_BU')!;
    expect(bu).toMatchObject({ module: 'COMMON', active: 2, values: ['PV', 'EV'] });
    expect(bu.usedIn.some((u) => u.includes('PPL'))).toBe(true);
    expect(lovCatalogue(lov).find((l) => l.code === 'THD_PROGRESS_SUB_STATUS')!.parentCode).toBe('THD_PROGRESS');
  });

  it('has PV and EV as the only BUs, separate values (no "PV + EV", no CV)', () => {
    expect(lovValues(lov, 'COMMON_BU')).toEqual(['PV', 'EV']);
    MASTER_COLLECTIONS.forEach((m) => {
      m.fields.filter((f) => f.key === 'bu').forEach((f) => expect(f.lovCode, `${m.id}.bu`).toBe('COMMON_BU'));
      m.records.forEach((r) => expect(['', 'PV', 'EV'], `${m.id} ${r.id}`).toContain(String(r.bu ?? '')));
    });
  });

  it('gives every value a Code (LIC), unique in its list', () => {
    expect(lov.every((r) => /^[A-Z0-9][A-Z0-9_]*$/.test(r.lic))).toBe(true);
    expect(lovRows(lov, 'THD_PROGRESS').map((r) => r.lic)).toContain('WORK_IN_PROCESS');
    expect(findCommonLovConflict(COMMON_LOV_ID, row({ lovCode: 'THD_PROGRESS', value: 'WIP', lic: 'work_in_process' }), lov)).toMatch(/Code WORK_IN_PROCESS/);
  });
});

describe('List of Values screen: saving one LOV Type', () => {
  const header = { code: 'THD_ABC', module: 'THD', fieldName: 'ABC', parentCode: '' };

  it('creates a new type: ids, order by position, codes proposed', () => {
    const { records, errors } = applyLovTypeDraft(lov, null, header, ['1', '2', '3'].map((v, i) => ({ id: `NEW-${i}`, _new: true, value: v, status: 'Active' })));
    expect(errors).toEqual({});
    expect(lovRows(records, 'THD_ABC').map((r) => [r.id, r.value, r.order, r.lic])).toEqual([
      ['THD_ABC-01', '1', 1, '1'],
      ['THD_ABC-02', '2', 2, '2'],
      ['THD_ABC-03', '3', 3, '3'],
    ]);
    expect(records).toHaveLength(lov.length + 3);
    expect(commonLovHealthCheck(records)).toEqual([]);
  });

  it('reorders, retires and renames the values of an existing type', () => {
    const draft = lovRows(lov, 'THD_CLOSURE_ACTION').reverse().map((r, i) => (i === 0 ? { ...r, status: 'Inactive' } : i === 1 ? { ...r, value: 'Closed + Feedback' } : r));
    const { records, errors } = applyLovTypeDraft(lov, 'THD_CLOSURE_ACTION', { ...header, code: 'THD_CLOSURE_ACTION', fieldName: 'Closure Action' }, draft);
    expect(errors).toEqual({});
    expect(lovValues(records, 'THD_CLOSURE_ACTION')).toEqual(['Closed + Feedback', 'Closed']);
    expect(lovRows(records, 'THD_CLOSURE_ACTION').find((r) => r.value === 'Closed + Feedback')!.lic).toBe('CLOSED_WITH_FEEDBACK');
  });

  it('numbers dependent values within each parent value', () => {
    const draft = [
      { id: 'NEW-1', _new: true, value: 'A1', parentValue: 'Work in process', status: 'Active' },
      { id: 'NEW-2', _new: true, value: 'B1', parentValue: 'Under Diagnosis', status: 'Active' },
      { id: 'NEW-3', _new: true, value: 'A2', parentValue: 'Work in process', status: 'Active' },
    ];
    const { records, errors } = applyLovTypeDraft(lov, null, { ...header, parentCode: 'THD_PROGRESS' }, draft);
    expect(errors).toEqual({});
    expect(lovValues(records, 'THD_ABC', 'Work in process')).toEqual(['A1', 'A2']);
    expect(lovRows(records, 'THD_ABC').find((r) => r.value === 'B1')!.order).toBe(1);
  });

  it('reports what to fix and keeps nothing half-saved', () => {
    const draft = [
      { id: 'NEW-1', _new: true, value: 'Same', status: 'Active' },
      { id: 'NEW-2', _new: true, value: ' same ', status: 'Active' },
      { id: 'NEW-3', _new: true, value: '', status: 'Active' },
    ];
    const { errors } = applyLovTypeDraft(lov, null, { code: 'CLAIM_ABC', module: 'THD', fieldName: '', parentCode: '' }, draft);
    expect(errors[LOV_TYPE_ERRORS]).toMatchObject({ code: expect.stringMatching(/start with THD_/), fieldName: expect.any(String) });
    expect(errors['NEW-2'].value).toMatch(/already in/);
    expect(errors['NEW-3'].value).toMatch(/Display Value/);
    expect(applyLovTypeDraft(lov, null, { ...header, code: 'THD_PROGRESS' }, draft.slice(0, 1)).errors[LOV_TYPE_ERRORS].code).toMatch(/already exists/);
    expect(applyLovTypeDraft(lov, null, { ...header, parentCode: 'THD_PROGRESS' }, [{ id: 'N', _new: true, value: 'X', parentValue: 'Nope' }]).errors.N.parentValue).toMatch(/THD_PROGRESS/);
  });
});
