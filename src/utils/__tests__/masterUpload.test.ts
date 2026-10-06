import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { MASTER_COLLECTIONS } from '../../data/masterCatalogue';
import { analyseUpload, buildMasterTemplate, uploadIsClean } from '../masterUpload';
import { buildTemplateWorkbook } from '../masterWorkbook';

const masters = MASTER_COLLECTIONS;
const lov = masters.find((m) => m.id === 'common_lov')!;
const ppl = masters.find((m) => m.id === 'ppl_master')!;
const book = (sheet: string, aoa: unknown[][]) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheet);
  return wb;
};
const labels = lov.fields.map((f) => f.label);
const lovRow = (over: Record<string, string | number> = {}) => {
  const base: Record<string, string | number> = { 'LOV Type (Parameter)': 'THD_ABC', Module: 'THD', 'Field Name': 'ABC', 'Display Value': '1', 'Code (LIC)': '', Order: 1, 'Parent LOV Code': '', 'Parent Value': '', Description: '', Status: 'Active' };
  const row = { ...base, ...over };
  return lov.fields.map((f) => row[f.label] ?? '');
};

describe('upload a master', () => {
  it('existing master, own template: rows are added', () => {
    const a = analyseUpload(book('common_lov', [labels, lovRow(), lovRow({ 'Display Value': '2', Order: 2 })]), masters);
    expect(a.mode).toBe('sheets');
    expect(a.sheets[0]).toMatchObject({ kind: 'existing', matchedBy: 'sheet name', add: 2, update: 0, ok: true });
    expect(uploadIsClean(a)).toBe(true);
    expect(a.sheets[0].updated!.records).toHaveLength(lov.records.length + 2);
  });

  it('is recognised by its columns even when the sheet has another name', () => {
    const a = analyseUpload(book('Sheet1', [labels, lovRow()]), masters);
    expect(a.sheets[0]).toMatchObject({ kind: 'existing', matchedBy: 'columns', ok: true });
    expect(a.sheets[0].master!.id).toBe('common_lov');
  });

  it('a missing, extra or renamed column is an error and nothing is imported', () => {
    const wrong = labels.filter((l) => l !== 'Order').concat('Remarks');
    const a = analyseUpload(book('common_lov', [wrong, lovRow()]), masters);
    expect(a.sheets[0].ok).toBe(false);
    expect(a.sheets[0].headerProblems.join(' ')).toMatch(/Missing column: Order/);
    expect(a.sheets[0].headerProblems.join(' ')).toMatch(/not in the .* template: Remarks/);
    expect(a.sheets[0].updated).toBeUndefined();
    expect(uploadIsClean(a)).toBe(false);
  });

  it('a sheet named after a master but with other columns is an error, not a new master', () => {
    const a = analyseUpload(book('common_lov', [['Name', 'Colour'], ['a', 'b']]), masters);
    expect(a.sheets[0]).toMatchObject({ kind: 'existing', ok: false });
  });

  it('refuses duplicate rows and bad values, with the Excel row number', () => {
    const existing = lov.records[0];
    const dup = lovRow({ 'LOV Type (Parameter)': existing.lovCode, Module: existing.module, 'Field Name': existing.fieldName, 'Display Value': existing.value, Order: 9 });
    const a = analyseUpload(book('common_lov', [labels, lovRow(), dup, lovRow({ 'LOV Type (Parameter)': 'bad name', 'Display Value': '3' })]), masters);
    const s = a.sheets[0];
    expect(s.ok).toBe(false);
    expect(s.issues.find((i) => i.row === 3)!.message).toMatch(/Duplicate record cannot exist/);
    expect(s.issues.some((i) => i.row === 4)).toBe(true);
    expect(s.updated).toBeUndefined();
  });

  it('updates rows by id and leaves blank cells alone; identical rows count as unchanged', () => {
    const r = ppl.records[0];
    const header = ['id', ...ppl.fields.map((f) => f.label)];
    const same = ['id', ...ppl.fields.map((f) => f.key)].map((k) => (k === 'id' ? r.id : String(r[k] ?? '')));
    const edited = same.map((v, i) => (header[i] === 'PL (Variant / Sub-Line)' ? `${v} X` : v));
    const wb1 = book('ppl_master', [header, same]);
    expect(analyseUpload(wb1, masters).sheets[0]).toMatchObject({ ok: true, add: 0, update: 0, unchanged: 1 });
    const a = analyseUpload(book('ppl_master', [header, edited]), masters);
    expect(a.sheets[0]).toMatchObject({ ok: true, update: 1 });
    expect(a.sheets[0].updated!.records.find((x) => x.id === r.id)!.plName).toBe(`${r.plName} X`);
  });

  it('any other table is a new master with its columns as fields', () => {
    const a = analyseUpload(book('Tyre Brands', [['Brand', 'Warranty Months'], ['MRF', 36], ['CEAT', 24]]), masters);
    expect(a.sheets[0].kind).toBe('new');
    expect(a.sheets[0].detected!.columns.map((c) => c.label)).toEqual(['Brand', 'Warranty Months']);
    expect(a.sheets[0].detected!.records).toHaveLength(2);
  });

  it('a BA definition workbook is handled as definitions', () => {
    const a = analyseUpload(buildTemplateWorkbook(), masters);
    expect(a.mode).toBe('definition');
    expect(a.definition).toBeDefined();
  });

  it('the template of a master has the screen labels; with data it starts with id', () => {
    const empty = XLSX.utils.sheet_to_json<string[]>(buildMasterTemplate(lov, false).Sheets[lov.id], { header: 1 });
    expect(empty).toEqual([labels]);
    const withData = XLSX.utils.sheet_to_json<string[]>(buildMasterTemplate(lov, true).Sheets[lov.id], { header: 1 });
    expect(withData[0]).toEqual(['id', ...labels]);
    expect(withData).toHaveLength(lov.records.length + 1);
    // …and it uploads back as "no change"
    const back = analyseUpload(buildMasterTemplate(lov, true), masters);
    expect(back.sheets[0]).toMatchObject({ ok: true, add: 0, update: 0, unchanged: lov.records.length });
  });
});
