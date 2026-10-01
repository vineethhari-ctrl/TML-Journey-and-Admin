import { describe, it, expect } from 'vitest';
import { MASTER_COLLECTIONS } from '../../data/masterCatalogue';
import {
  EQC_MASTER_IDS,
  applicableChecklist,
  checkDidValue,
  eqcHealthCheck,
  evaluatePtdRisk,
  findEqcConflict,
  groupBySection,
  parseExpectedRange,
  resolveGcMandate,
  resolveGcSteps,
  validateEqcRecord,
} from '../eqcRules';
import { masterValidationSchema } from '../masterValidationSchema';

const seed = (id: string) => MASTER_COLLECTIONS.find((m) => m.id === id)!.records;
const allSeeds = () => Object.fromEntries(Object.values(EQC_MASTER_IDS).map((id) => [id, seed(id)]));

describe('EQC — Guided Check & Road Test mandate', () => {
  const rows = seed(EQC_MASTER_IDS.mandate);

  it('a blank-PPL rule applies to every PPL', () => {
    expect(resolveGcMandate(rows, { ppl: 'Harrier', complaintCode: 'BRK-VIB-02', date: '2026-10-01' })).toMatchObject({
      gcApplicable: true,
      gcMandatory: true,
      roadTestMandatory: true,
      scope: 'ALL',
    });
  });

  it('a PPL-specific rule overrides the all-PPL rule', () => {
    expect(resolveGcMandate(rows, { ppl: 'Nexon EV', complaintCode: 'BAT-SOC-03', date: '2026-10-01' })).toMatchObject({ gcMandatory: true, scope: 'PPL', ruleId: 'GCM-02' });
    expect(resolveGcMandate(rows, { ppl: 'Tiago EV', complaintCode: 'bat-soc-03', date: '2026-10-01' })).toMatchObject({ gcMandatory: false, scope: 'ALL', ruleId: 'GCM-03' });
  });

  it('GC stops being mandatory after "GC Mandatory Till" but stays applicable', () => {
    const before = resolveGcMandate(rows, { ppl: 'Altroz', complaintCode: 'ENG-NOIS-01', date: '2026-12-31' })!;
    const after = resolveGcMandate(rows, { ppl: 'Altroz', complaintCode: 'ENG-NOIS-01', date: '2027-01-01' })!;
    expect(before.gcMandatory).toBe(true);
    expect(after).toMatchObject({ gcApplicable: true, gcMandatory: false, mandateExpired: true });
  });

  it('no rule → null; inactive rules are ignored', () => {
    expect(resolveGcMandate(rows, { ppl: 'Nexon', complaintCode: 'XYZ-01', date: '2026-10-01' })).toBeNull();
    const off = rows.map((r) => (r.id === 'GCM-01' ? { ...r, active: 'N' } : r));
    expect(resolveGcMandate(off, { ppl: 'Nexon', complaintCode: 'BRK-VIB-02', date: '2026-10-01' })).toBeNull();
  });
});

describe('EQC — GC steps', () => {
  it('returns steps in order, PPL-specific steps replacing the all-PPL ones', () => {
    const rows = seed(EQC_MASTER_IDS.steps);
    const ev = resolveGcSteps(rows, { ppl: 'Nexon EV', complaintCode: 'BAT-SOC-03' });
    expect(ev.scope).toBe('PPL');
    expect(ev.steps.map((s) => s.stepNo)).toEqual([1, 2]);
    expect(ev.steps[0].images).toHaveLength(2);
    const other = resolveGcSteps(rows, { ppl: 'Punch', complaintCode: 'BAT-SOC-03' });
    expect(other).toMatchObject({ scope: 'ALL', steps: [{ stepNo: 1, text: expect.stringMatching(/12V/) }] });
    const shuffled = [...seed(EQC_MASTER_IDS.steps)].reverse();
    expect(resolveGcSteps(shuffled, { ppl: 'Safari', complaintCode: 'BRK-VIB-02' }).steps.map((s) => s.stepNo)).toEqual([1, 2, 3]);
  });
});

describe('EQC — PTD risk', () => {
  const rows = seed(EQC_MASTER_IDS.ptd); // Orange 2h00, Red 0h45
  it.each([
    [180, 'On Track'],
    [121, 'On Track'],
    [120, 'Orange'],
    [46, 'Orange'],
    [45, 'Red'],
    [0, 'Red'],
    [-10, 'Red'],
  ])('%i minutes left → %s', (mins, risk) => {
    expect(evaluatePtdRisk(rows, mins).risk).toBe(risk);
  });
  it('ignores inactive thresholds', () => {
    expect(evaluatePtdRisk(rows.map((r) => ({ ...r, active: 'N' })), 10).risk).toBe('On Track');
  });
});

describe('EQC — DID thresholds', () => {
  it('parses ranges, limits and single values', () => {
    expect(parseExpectedRange('11.8-14.5')).toEqual({ min: 11.8, max: 14.5 });
    expect(parseExpectedRange(' >= 20 ')).toEqual({ min: 20 });
    expect(parseExpectedRange('<4.2')).toEqual({ max: 4.2, maxExclusive: true });
    expect(parseExpectedRange('-5--1')).toEqual({ min: -5, max: -1 });
    expect(parseExpectedRange('12')).toEqual({ min: 12, max: 12 });
    expect(parseExpectedRange('14-12')).toBeNull();
    expect(parseExpectedRange('ok')).toBeNull();
  });

  it('checks a scanned value against the most specific threshold', () => {
    const rows = seed(EQC_MASTER_IDS.did);
    expect(checkDidValue(rows, { parameterName: 'HV Battery SOC', ppl: 'Nexon EV', value: 20 })).toMatchObject({ status: 'OK', scope: 'PPL' });
    expect(checkDidValue(rows, { parameterName: 'HV Battery SOC', ppl: 'Tiago EV', value: 20 })).toMatchObject({ status: 'NOT OK', expected: '>=25' });
    expect(checkDidValue(rows, { parameterName: 'HV Battery SOC', ppl: 'Punch EV', value: 20 }).status).toBe('NO RULE');
    expect(checkDidValue(rows, { parameterName: '12v battery voltage', ppl: 'Harrier', value: 11.9 })).toMatchObject({ status: 'NOT OK', scope: 'ALL' });
  });

  it('the catalogue pattern accepts what the parser accepts', () => {
    const field = MASTER_COLLECTIONS.find((m) => m.id === EQC_MASTER_IDS.did)!.fields.find((f) => f.key === 'expectedValue')!;
    ['11.8-14.5', '>=20', '<= 4.2', '>0', '12', '-5 - -1'].forEach((v) => expect(masterValidationSchema.validateField(field, v).isValid).toBe(true));
    ['abc', '1-2-3', '=>5'].forEach((v) => expect(masterValidationSchema.validateField(field, v).isValid).toBe(false));
  });
});

describe('EQC — checklists', () => {
  it('blank PPL / Km range apply to every vehicle; Km ranges are inclusive; BU must match', () => {
    const rows = seed(EQC_MASTER_IDS.general);
    const ids = (q: { bu: string; ppl: string; km: number }) => applicableChecklist(rows, q).map((r) => r.id);
    expect(ids({ bu: 'PV', ppl: 'Nexon', km: 10000 })).toEqual(['GCL-01', 'GCL-02']);
    expect(ids({ bu: 'PV', ppl: 'Altroz', km: 40000 })).toEqual(['GCL-01', 'GCL-02', 'GCL-03', 'GCL-04']);
    expect(ids({ bu: 'PV', ppl: 'Altroz', km: 80001 })).toEqual(['GCL-01', 'GCL-02', 'GCL-04']);
    expect(ids({ bu: 'EV', ppl: 'Nexon EV', km: 5 })).toEqual(['GCL-05', 'GCL-06']); // GCL-07 inactive, PV
  });

  it('schedule checklist honours one-sided Km ranges and groups by section', () => {
    const rows = seed(EQC_MASTER_IDS.schedule);
    const low = groupBySection(applicableChecklist(rows, { bu: 'PV', ppl: 'Nexon', km: 5000 }));
    expect(low.map((g) => g.section)).toEqual(['Engine Compartment', 'Electricals']);
    const high = groupBySection(applicableChecklist(rows, { bu: 'PV', ppl: 'Harrier', km: 35000 }));
    expect(high.map((g) => [g.section, g.items.length])).toEqual([
      ['Engine Compartment', 2],
      ['Brakes', 1],
      ['Underbody', 1],
    ]);
  });
});

describe('EQC — validation', () => {
  it('cross-field rules', () => {
    expect(validateEqcRecord(EQC_MASTER_IDS.mandate, { gcApplicable: 'N', gcMandatory: 'Y' })).toHaveProperty('gcMandatory');
    expect(validateEqcRecord(EQC_MASTER_IDS.mandate, { gcApplicable: 'Y', gcMandatory: 'N', gcMandatoryTill: '2027-01-01' })).toHaveProperty('gcMandatoryTill');
    expect(validateEqcRecord(EQC_MASTER_IDS.general, { rangeStartKm: 5000, rangeEndKm: 1000, active: 'Y', notOkText: 'Y' })).toHaveProperty('rangeEndKm');
    expect(validateEqcRecord(EQC_MASTER_IDS.schedule, { active: 'Y', notOkPhoto: 'N', notOkAudio: 'N', notOkVideo: 'N', notOkText: 'N' })).toHaveProperty('notOkText');
    expect(validateEqcRecord(EQC_MASTER_IDS.ptd, { thresholdHrs: 0, thresholdMins: 0 })).toHaveProperty('thresholdMins');
  });

  it('validateRecord applies the master rules only when given the master id', () => {
    const fields = MASTER_COLLECTIONS.find((m) => m.id === EQC_MASTER_IDS.mandate)!.fields;
    const rec = { ppl: '', complaintCode: 'BRK-VIB-02', gcApplicable: 'N', gcMandatory: 'Y', roadTestMandatory: 'N', active: 'Y' };
    expect(masterValidationSchema.validateRecord(fields, rec).isValid).toBe(true);
    expect(masterValidationSchema.validateRecord(fields, rec, EQC_MASTER_IDS.mandate).errors).toHaveProperty('gcMandatory');
  });

  it('conflicts: duplicate keys and Red not lower than Orange', () => {
    const mandate = seed(EQC_MASTER_IDS.mandate);
    expect(findEqcConflict(EQC_MASTER_IDS.mandate, { id: 'NEW', ppl: '', complaintCode: 'brk-vib-02', active: 'Y' }, mandate)).toMatch(/GCM-01/);
    expect(findEqcConflict(EQC_MASTER_IDS.mandate, { id: 'NEW', ppl: 'Nexon', complaintCode: 'BRK-VIB-02', active: 'Y' }, mandate)).toBeNull();
    const ptd = seed(EQC_MASTER_IDS.ptd);
    expect(findEqcConflict(EQC_MASTER_IDS.ptd, { id: 'PTD-02', colorCode: 'Red', thresholdHrs: 3, thresholdMins: 0, active: 'Y' }, ptd)).toMatch(/lower than Orange/);
    expect(findEqcConflict(EQC_MASTER_IDS.ptd, { id: 'X', colorCode: 'Orange', thresholdHrs: 1, thresholdMins: 0, active: 'Y' }, ptd)).toMatch(/already exists/);
  });

  it('the seeded EQC masters are healthy; problems are reported', () => {
    expect(eqcHealthCheck(allSeeds())).toEqual([]);
    const broken = allSeeds();
    broken[EQC_MASTER_IDS.steps] = [];
    broken[EQC_MASTER_IDS.did] = [...broken[EQC_MASTER_IDS.did], { id: 'DID-99', parameterName: 'Battery SOC', expectedValue: '>=50', ppl: '', active: 'Y' }];
    const issues = eqcHealthCheck(broken);
    expect(issues.some((i) => /DID-99.*already exists/.test(i))).toBe(true);
    expect(issues.filter((i) => /no GC steps/.test(i)).length).toBe(5);
  });
});
