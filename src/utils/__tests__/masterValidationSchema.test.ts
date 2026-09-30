import { describe, it, expect } from 'vitest';
import { masterValidationSchema as v } from '../masterValidationSchema';
import { MasterFieldDef } from '../../data/masterCatalogue';

const num: MasterFieldDef = { key: 'frt', label: 'FRT Hours', type: 'number', validation: { min: 0, max: 10 } };
const date: MasterFieldDef = { key: 'd', label: 'Date', type: 'date', validation: { minDate: '2026-01-01' } };
const sel: MasterFieldDef = { key: 's', label: 'Severity', type: 'select', options: ['Low', 'High'], mandatory: true };
const bool: MasterFieldDef = { key: 'b', label: 'Active', type: 'boolean' };

describe('masterValidationSchema.validateField', () => {
  it('number: accepts numeric strings and converts them', () => {
    expect(v.validateField(num, '4.5')).toEqual({ isValid: true, sanitizedValue: 4.5 });
  });
  it('number: rejects text and out-of-range values', () => {
    expect(v.validateField(num, '4.5h').isValid).toBe(false);
    expect(v.validateField(num, '11').isValid).toBe(false);
    expect(v.validateField(num, '-1').isValid).toBe(false);
  });
  it('date: rejects impossible calendar dates and bad formats', () => {
    expect(v.validateField(date, '2026-02-30').isValid).toBe(false);
    expect(v.validateField(date, '30/09/2026').isValid).toBe(false);
    expect(v.validateField(date, '2028-02-29').isValid).toBe(true);
  });
  it('date: enforces minDate', () => {
    expect(v.validateField(date, '2025-12-31').isValid).toBe(false);
  });
  it('select: requires an allowed option and a value when mandatory', () => {
    expect(v.validateField(sel, 'High').isValid).toBe(true);
    expect(v.validateField(sel, 'Medium').isValid).toBe(false);
    expect(v.validateField(sel, '').isValid).toBe(false);
  });
  it('boolean: understands Y/N style values', () => {
    expect(v.validateField(bool, 'Y').sanitizedValue).toBe(true);
    expect(v.validateField(bool, 'no').sanitizedValue).toBe(false);
    expect(v.validateField(bool, 'maybe').isValid).toBe(false);
  });
});

describe('masterValidationSchema.validateRecord', () => {
  it('keeps the record id and returns every field error', () => {
    const res = v.validateRecord([num, sel], { id: 'X-1', frt: 'abc', s: 'Medium' });
    expect(res.isValid).toBe(false);
    expect(Object.keys(res.errors).sort()).toEqual(['frt', 's']);
    expect(res.sanitizedRecord.id).toBe('X-1');
  });
});

describe('masterValidationSchema.validateCustomFieldDefinition', () => {
  it('requires at least two unique dropdown options', () => {
    expect(v.validateCustomFieldDefinition({ label: 'x', key: 'x', type: 'select', optionsString: 'A' }).isValid).toBe(false);
    expect(v.validateCustomFieldDefinition({ label: 'x', key: 'x', type: 'select', optionsString: 'A, A' }).isValid).toBe(false);
    expect(v.validateCustomFieldDefinition({ label: 'x', key: 'x', type: 'select', optionsString: 'A, B' }).isValid).toBe(true);
  });
  it('rejects min > max for numbers', () => {
    expect(v.validateCustomFieldDefinition({ label: 'x', key: 'x', type: 'number', min: 5, max: 1 }).isValid).toBe(false);
  });
});
