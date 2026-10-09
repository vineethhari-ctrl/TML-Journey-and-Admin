import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { MASTER_COLLECTIONS, type MasterConfig } from '../../data/masterCatalogue';
import { analyseUpload, uploadIsClean } from '../masterUpload';
import { buildChangesWorkbook, buildPublished, diffMasters, hasLocalChanges, parsePublished } from '../masterPublish';

const base = MASTER_COLLECTIONS;
const ppl = base.find((m) => m.id === 'ppl_master')!;
const clone = (ms: MasterConfig[]) => JSON.parse(JSON.stringify(ms)) as MasterConfig[];
const withPpl = (ms: MasterConfig[], f: (m: MasterConfig) => MasterConfig) => ms.map((m) => (m.id === 'ppl_master' ? f(m) : m));

describe('published masters file', () => {
  it('round-trips and is recognised', () => {
    const p = buildPublished(base, 3, 'Vineeth Hari (test)', 'note', new Date('2026-10-09T10:00:00Z'));
    const back = parsePublished(JSON.stringify(p));
    expect(back?.version).toBe(3);
    expect(back?.masters.length).toBe(base.length);
    expect(back?.publishedAt).toBe('2026-10-09T10:00:00.000Z');
  });
  it('rejects a web page, bad json, an empty list and a wrong version', () => {
    expect(parsePublished('<!doctype html><html></html>')).toBeUndefined();
    expect(parsePublished('')).toBeUndefined();
    expect(parsePublished(JSON.stringify({ version: 1, masters: [] }))).toBeUndefined();
    expect(parsePublished(JSON.stringify({ version: 0, masters: [{ id: 'a', name: 'A', fields: [], records: [] }] }))).toBeUndefined();
    expect(parsePublished(JSON.stringify({ version: 1, masters: [{ id: 'a' }] }))).toBeUndefined();
  });
});

describe('what a user changed', () => {
  it('finds nothing when nothing changed', () => {
    expect(diffMasters(base, clone(base))).toEqual([]);
    expect(hasLocalChanges(base, clone(base))).toBe(false);
  });
  it('finds added, changed and removed rows, new masters and definition changes', () => {
    const first = ppl.records[0];
    const key = ppl.fields[1].key;
    const cur = withPpl(clone(base), (m) => ({
      ...m,
      records: [{ ...m.records[0], [key]: 'CHANGED' }, ...m.records.slice(2), { id: 'PPL-NEW-1', [key]: 'New row' }],
    }));
    const d = diffMasters(base, cur);
    expect(d).toHaveLength(1);
    expect(d[0].added.map((r) => r.id)).toEqual(['PPL-NEW-1']);
    expect(d[0].changed.map((r) => r.id)).toEqual([first.id]);
    expect(d[0].removedIds).toEqual([ppl.records[1].id]);
    expect(d[0].definitionChanged).toBe(false);

    const renamed = withPpl(clone(base), (m) => ({ ...m, fields: m.fields.map((f, i) => (i === 0 ? { ...f, label: f.label + ' X' } : f)) }));
    expect(diffMasters(base, renamed)[0].definitionChanged).toBe(true);

    const extra: MasterConfig = { ...clone([ppl])[0], id: 'zz_new', name: 'ZZ New', records: [{ id: 'Z1', [key]: 'a' }] };
    const added = diffMasters(base, [...clone(base), extra]);
    expect(added[0].isNew).toBe(true);
  });
});

describe('the "send changes" Excel works with Upload a Master', () => {
  it('is accepted, with the added row as an add and the edited row as an update', () => {
    const key = ppl.fields[1].key;
    const cur = withPpl(clone(base), (m) => ({ ...m, records: [{ ...m.records[0], [key]: 'EDITED BY BA' }, ...m.records.slice(1), { id: 'PPL-NEW-9', ...Object.fromEntries(m.fields.map((f) => [f.key, f.type === 'number' ? 1 : f.options?.[0] ?? 'new'])) }] }));
    const wb = buildChangesWorkbook(diffMasters(base, cur), 'BA Test', new Date('2026-10-09'));
    expect(wb.SheetNames[0]).toBe('README');
    const roundTrip = XLSX.read(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), { type: 'array' });
    const a = analyseUpload(roundTrip, base);
    const sheet = a.sheets.find((s) => s.master?.id === 'ppl_master')!;
    expect(sheet.kind).toBe('existing');
    expect(sheet.update).toBeGreaterThanOrEqual(1);
    expect(sheet.add).toBe(1);
    expect(sheet.issues).toEqual([]);
    expect(sheet.headerProblems).toEqual([]);
    expect(uploadIsClean(a)).toBe(true);
  });
});
