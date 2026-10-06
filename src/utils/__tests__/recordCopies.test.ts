import { describe, it, expect } from 'vitest';
import { MASTER_COLLECTIONS } from '../../data/masterCatalogue';
import { checkCopies, insertCopies } from '../recordCopies';

const ppl = MASTER_COLLECTIONS.find((m) => m.id === 'ppl_master')!;
const src = ppl.records[0];
const copy = (over: Record<string, unknown> = {}) => ({ ...src, id: 'PPL-NEW', _after: src.id, ...over });

describe('copied rows (Ctrl+B)', () => {
  it('an untouched copy is a duplicate and cannot be saved', () => {
    const r = checkCopies(ppl, [copy()]);
    expect(r.errors['PPL-NEW'][0]).toMatch(/^Duplicate record cannot exist/);
    expect(r.duplicates['PPL-NEW']).toHaveLength(1);
  });
  it('a copy with a changed value passes; two identical copies clash with each other', () => {
    expect(checkCopies(ppl, [copy({ pplCode: 'PPL-X', plName: 'X' })]).errors).toEqual({});
    const two = checkCopies(ppl, [copy({ pplCode: 'PPL-X', plName: 'X' }), copy({ id: 'PPL-NEW2', pplCode: 'PPL-X', plName: 'X' })]);
    expect(Object.keys(two.errors)).toEqual(['PPL-NEW2']);
  });
  it('reports field problems and a taken id', () => {
    const r = checkCopies(ppl, [copy({ id: src.id, pplCode: 'PPL-X', plName: '' })]);
    expect(r.errors[src.id].length).toBeGreaterThan(1);
  });
  it('inserts each copy right after the row it was copied from', () => {
    const rows = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const copies = [{ id: 'N1', _after: 'B' }, { id: 'N2', _after: 'A' }];
    expect(insertCopies(rows, copies, [{ id: 'N1' }, { id: 'N2' }]).map((r) => r.id)).toEqual(['A', 'N2', 'B', 'N1', 'C']);
  });
});
