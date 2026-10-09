import { describe, it, expect } from 'vitest';
import { EQC_PPL_LIST, EQC_SPEC } from '../confirmedEqcSpec';
import { BODYSHOP_PARTS } from '../confirmedBodyshopSpec';
import { CONFIRMED_BA_MASTERS } from '../confirmedBaMasters';

describe('confirmed eQC and Bodyshop specifications', () => {
  it('eQC: 9 masters, 90 fields, 14 PPLs, every duplicate-check key is a real field', () => {
    expect(Object.keys(EQC_SPEC)).toHaveLength(9);
    expect(Object.values(EQC_SPEC).reduce((n, m) => n + m.fields.length, 0)).toBe(90);
    expect(EQC_PPL_LIST).toHaveLength(14);
    Object.values(EQC_SPEC).forEach((m) => m.keys.forEach((k) => expect(m.fields.map((f) => f[0])).toContain(k)));
  });
  it('Bodyshop: 2 masters in 3 parts, BU is PV and EV only', () => {
    expect(new Set(BODYSHOP_PARTS.map((p) => p.master)).size).toBe(2);
    expect(BODYSHOP_PARTS).toHaveLength(3);
    const bu = BODYSHOP_PARTS.flatMap((p) => p.fields).find((f) => f.name === 'BU');
    expect(bu?.values).toEqual(['PV', 'EV']);
  });
  it('matches the list of confirmed masters (11)', () => {
    expect(CONFIRMED_BA_MASTERS).toHaveLength(Object.keys(EQC_SPEC).length + new Set(BODYSHOP_PARTS.map((p) => p.master)).size);
  });
});
