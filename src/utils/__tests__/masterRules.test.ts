import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import type { MasterConfig } from '../../data/masterCatalogue';
import { MASTER_COLLECTIONS } from '../../data/masterCatalogue';
import { checkRecord, describeRule, evaluateRules, ruleFromRow, ruleReport, validateRuleDefinition, type MasterRule } from '../masterRules';
import { parseMasterWorkbook } from '../masterWorkbook';
import { checkCopies } from '../recordCopies';

const rule = (r: Partial<MasterRule>): MasterRule => ({ id: 'R1', type: 'unique', enabled: true, severity: 'error', ...r }) as MasterRule;
const master = (rules: MasterRule[], records: Record<string, any>[] = []): MasterConfig =>
  ({
    id: 'tyre_master',
    name: 'Tyre Master',
    owner: 'TML_ADMIN',
    category: 'x',
    logicalGroup: 'Vehicle Data',
    moduleCode: 'spd',
    moduleName: 'SPD',
    description: '',
    fields: [
      { key: 'code', label: 'Code', type: 'text', mandatory: true },
      { key: 'role', label: 'Role', type: 'select', options: ['Plant', 'RTSM'] },
      { key: 'plant', label: 'Plant Name', type: 'text' },
      { key: 'fromKm', label: 'From Km', type: 'number' },
      { key: 'toKm', label: 'To Km', type: 'number' },
      { key: 'bu', label: 'BU', type: 'select', options: ['PV', 'EV'] },
      { key: 'fuel', label: 'Powertrain', type: 'select', options: ['Petrol', 'Diesel', 'EV'] },
      { key: 'dealer', label: 'Dealer Code', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
    ],
    records,
    rules,
  }) as MasterConfig;
const fails = (m: MasterConfig, rec: Record<string, any>, others: Record<string, any>[] = []) => evaluateRules(m, rec, { others, masters: MASTER_COLLECTIONS }).map((v) => v.message);

describe('no-code master rules', () => {
  it('Required when…', () => {
    const m = master([rule({ type: 'required_if', field: 'plant', whenField: 'role', whenValues: ['Plant'] })]);
    expect(fails(m, { code: 'A', role: 'Plant', plant: '' })).toEqual(['Plant Name is required when Role is "Plant".']);
    expect(fails(m, { code: 'A', role: 'RTSM', plant: '' })).toEqual([]);
    expect(fails(m, { code: 'A', role: 'plant', plant: 'Pune' })).toEqual([]);
  });

  it('No duplicates: only among active rows, ignoring case and spaces', () => {
    const m = master([rule({ type: 'unique', fields: ['code', 'bu'] })]);
    const others = [{ id: '1', code: 'A1', bu: 'PV', status: 'Active' }, { id: '2', code: 'B1', bu: 'PV', status: 'Inactive' }];
    expect(fails(m, { id: '3', code: ' a1 ', bu: 'pv' }, others)).toHaveLength(1);
    expect(fails(m, { id: '3', code: 'A1', bu: 'EV' }, others)).toEqual([]);
    expect(fails(m, { id: '3', code: 'B1', bu: 'PV' }, others)).toEqual([]);
    expect(fails(m, { id: '1', code: 'A1', bu: 'PV' }, others)).toEqual([]); // itself
  });

  it('From ≤ To for numbers and dates', () => {
    const m = master([rule({ type: 'not_greater', field: 'fromKm', otherField: 'toKm' })]);
    expect(fails(m, { fromKm: 5000, toKm: 1000 })).toHaveLength(1);
    expect(fails(m, { fromKm: '900', toKm: '1000' })).toEqual([]);
    expect(fails(m, { fromKm: '', toKm: 1000 })).toEqual([]);
    const d = master([rule({ type: 'not_greater', field: 'code', otherField: 'plant' })]);
    expect(fails(d, { code: '2026-05-01', plant: '2026-04-01' })).toHaveLength(1);
  });

  it('Allowed values depend on another field', () => {
    const m = master([rule({ type: 'allowed_if', field: 'fuel', whenField: 'bu', whenValues: ['EV'], values: ['EV'] })]);
    expect(fails(m, { bu: 'EV', fuel: 'Petrol' })).toEqual(['When BU is "EV", Powertrain may only be "EV".']);
    expect(fails(m, { bu: 'EV', fuel: 'EV' })).toEqual([]);
    expect(fails(m, { bu: 'PV', fuel: 'Petrol' })).toEqual([]);
  });

  it('Must exist in another master (active rows only)', () => {
    const m = master([rule({ type: 'exists_in', field: 'dealer', refMaster: 'dealer_details_registry', refField: 'dealerCode' })]);
    const real = MASTER_COLLECTIONS.find((x) => x.id === 'dealer_details_registry')!.records[0].dealerCode;
    expect(fails(m, { dealer: real })).toEqual([]);
    expect(fails(m, { dealer: 'NOPE-999' })[0]).toMatch(/Dealer Code must exist in .* → Dealer Code/);
  });

  it('Number between and Format', () => {
    const m = master([
      rule({ id: 'R1', type: 'range', field: 'fromKm', min: 0, max: 100 }),
      rule({ id: 'R2', type: 'pattern', field: 'code', pattern: '^[A-Z]{3}-\\d{3}$' }),
    ]);
    expect(fails(m, { fromKm: 150, code: 'ABC-123' })).toEqual(['From Km must be between 0 and 100.']);
    expect(fails(m, { fromKm: 50, code: 'abc123' })[0]).toMatch(/format "3 capitals, hyphen, 3 digits/);
  });

  it('disabled rules are skipped; a custom message replaces the sentence; warnings do not block', () => {
    const m = master([
      rule({ id: 'R1', type: 'range', field: 'fromKm', max: 10, enabled: false }),
      rule({ id: 'R2', type: 'range', field: 'toKm', max: 10, severity: 'warning', message: 'Unusually high' }),
    ]);
    const res = checkRecord(m, { code: 'A', fromKm: 50, toKm: 50 });
    expect(res.isValid).toBe(true);
    expect(res.warnings).toEqual(['Unusually high']);
  });

  it('errors block saving copies / new rows; field errors come first', () => {
    const m = master([rule({ type: 'unique', fields: ['code'] })], [{ id: 'X1', code: 'A' }]);
    expect(checkCopies(m, [{ id: 'X2', code: 'a', _after: null }]).errors.X2.join(' ')).toMatch(/Code must be unique/);
    expect(checkRecord(m, { code: '' }).errors).toHaveProperty('code');
  });

  it('checks a rule definition before it is saved', () => {
    const m = master([]);
    expect(validateRuleDefinition(rule({ type: 'required_if', field: 'plant' }), m)).toContain('Choose the condition field.');
    expect(validateRuleDefinition(rule({ type: 'not_greater', field: 'fromKm', otherField: 'fromKm' }), m)).toContain('Choose two different fields.');
    expect(validateRuleDefinition(rule({ type: 'range', field: 'fromKm', min: 5, max: 1 }), m)).toContain('Minimum must not be greater than maximum.');
    expect(validateRuleDefinition(rule({ type: 'pattern', field: 'code', pattern: '([' }), m)).toContain('The format is not valid.');
    expect(validateRuleDefinition(rule({ type: 'unique', fields: ['nope'] }), m)[0]).toMatch(/not a field/);
    expect(validateRuleDefinition(rule({ type: 'exists_in', field: 'dealer', refMaster: 'nope' }), m)[0]).toMatch(/does not exist/);
  });

  it('reads a rule from a workbook row by title and labels', () => {
    const m = master([]);
    const { rule: r, errors } = ruleFromRow({ 'Rule Type': 'Required when…', Field: 'Plant Name', 'When Field': 'Role', 'When Values': 'Plant', Severity: 'warning' }, m, MASTER_COLLECTIONS);
    expect(errors).toEqual([]);
    expect(r).toMatchObject({ type: 'required_if', field: 'plant', whenField: 'role', whenValues: ['Plant'], severity: 'warning' });
    expect(ruleFromRow({ 'Rule Type': 'magic' }, m, []).errors[0]).toMatch(/not one of/);
    expect(describeRule(r!, m)).toBe('Plant Name is required when Role is "Plant".');
  });

  it('reports which saved rows break each rule', () => {
    const m = master([rule({ type: 'not_greater', field: 'fromKm', otherField: 'toKm' })], [{ id: 'A', fromKm: 1, toKm: 2 }, { id: 'B', fromKm: 9, toKm: 2 }]);
    expect(ruleReport(m)[0].failing.map((f) => f.id)).toEqual(['B']);
  });

  it('a BA workbook Rules sheet defines rules and checks the rows that come with it', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Master ID', 'Master Name', 'Module Code', 'Logical Group', 'Owner'], ['loaner_cars', 'Loaner Cars', 'reception', 'Service Operations', 'TML_ADMIN']]), 'Masters');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Master ID', 'Field Key', 'Field Label', 'Type', 'Mandatory', 'Options'],
        ['loaner_cars', 'reg', 'Registration', 'text', 'Y', ''],
        ['loaner_cars', 'fuel', 'Fuel', 'select', 'N', 'Petrol, EV'],
      ]),
      'Fields'
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Master ID', 'Rule Type', 'Fields (No duplicates)'], ['loaner_cars', 'unique', 'Registration']]), 'Rules');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['id', 'reg', 'fuel'], ['L1', 'MH01', 'EV'], ['L2', 'mh01', 'Petrol']]), 'loaner_cars');
    const parsed = parseMasterWorkbook(wb, MASTER_COLLECTIONS);
    expect(parsed.hasErrors).toBe(true);
    expect(parsed.issues.find((i) => i.sheet === 'loaner_cars')!.message).toMatch(/Registration must be unique/);
  });
});
