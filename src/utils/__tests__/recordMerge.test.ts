import { describe, it, expect } from 'vitest';
import { mergeImportedRecords } from '../recordMerge';

const existing = [
  { id: 'A', name: 'Alpha', qty: 1 },
  { id: 'B', name: 'Beta', qty: 2 },
];

describe('mergeImportedRecords', () => {
  it('replace: imported rows become the whole set', () => {
    expect(mergeImportedRecords(existing, [{ id: 'Z', name: 'Zed' }], 'replace')).toEqual([{ id: 'Z', name: 'Zed' }]);
  });

  it('append: imported rows are added in front', () => {
    const out = mergeImportedRecords(existing, [{ id: 'C', name: 'Gamma' }], 'append');
    expect(out.map((r) => r.id)).toEqual(['C', 'A', 'B']);
  });

  it('upsert: updates matching ids (case-insensitive) and adds new ones', () => {
    const out = mergeImportedRecords(existing, [{ id: 'b', qty: 9 }, { id: 'C', name: 'Gamma' }], 'upsert');
    expect(out.map((r) => r.id)).toEqual(['C', 'A', 'B']);
    expect(out.find((r) => r.id === 'B')).toMatchObject({ name: 'Beta', qty: 9 });
  });

  it('upsert: rows without an id never overwrite an existing record', () => {
    const withBlankId = [...existing, { name: 'No id row' }];
    const out = mergeImportedRecords(withBlankId, [{ name: 'Imported, no id' }], 'upsert');
    expect(out).toHaveLength(4);
    expect(out.some((r) => r.name === 'No id row')).toBe(true);
    expect(out.some((r) => r.name === 'Imported, no id')).toBe(true);
  });

  it('does not mutate its inputs', () => {
    const snapshot = JSON.stringify(existing);
    mergeImportedRecords(existing, [{ id: 'A', name: 'changed' }], 'upsert');
    expect(JSON.stringify(existing)).toBe(snapshot);
  });
});
