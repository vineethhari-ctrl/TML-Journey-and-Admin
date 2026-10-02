import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { detectMasters, readRawWorkbook, masterIdFor, guessPlacement, toMasterConfig, fieldsFor } from '../smartExcelImport';
import { validateMasterDefinition } from '../masterWorkbook';
import { masterValidationSchema } from '../masterValidationSchema';

/** A workbook shaped like the BA files: index sheet, side-by-side tables, repeated PV/EV header, gaps. */
function baWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Master Name', 'Status'], ['Inventory Capture Master', 'Closed']]), 'Master List');
  const left = [
    ['Section', 'Roles', 'Sequence Priority', 'Active', 'Service Type', 'BU'],
    ['Documents', 'DSvAdv, Driver', 1, 'Y', 'All', 'PV'],
    ['Accident Details', 'DSvAdv', 2, 'Y', 'Accident', 'PV'],
    ['Internal', 'DSvAdv', 3, 'Y', 'All', 'PV'],
    [null, null, null, null, null, null],
    ['Section', 'Roles', 'Sequence Priority', 'Active', 'Service Type', 'BU'],
    ['Documents', 'DSvAdv, Driver', 1, 'Y', 'All', 'EV'],
    ['Accident Details', 'DSvAdv', 2, 'Y', 'Accident', 'EV'],
    ['Internal', 'DSvAdv', 3, 'Yes', 'All', 'EV'],
  ];
  const right = [
    ['Section', 'Checkpoint', 'Role', 'Mandatory', 'No. of Image Required(Max 2)', 'Effective From', 'Remark'],
    ['Internal', 'Horn Working', 'DSvAdv', 'Y', 2, new Date(2026, 9, 1), 'ok'],
    ['Internal', 'Steering Wheel', 'DSvAdv', 'Y', 3, new Date(2026, 9, 1), 'x'],
    [null, "Owner's Manual", 'Driver', 'Y', 1, new Date(2026, 9, 2), 'y'],
    ['Internal', 'Horn Working', 'DSvAdv', 'Y', 2, new Date(2026, 9, 1), 'ok'],
  ];
  const rows = Array.from({ length: Math.max(left.length, right.length) }, (_, i) => [...(left[i] ?? Array(6).fill(null)), null, ...(right[i] ?? [])]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), 'Inventory Capture Master');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), 'Notes');
  return XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array', cellDates: true });
}

describe('Smart Excel Import — detection', () => {
  const res = detectMasters(baWorkbook());

  it('reads the index sheet as notes and skips empty sheets', () => {
    expect(res.notes).toContain('Index sheet "Master List": Master Name = Inventory Capture Master, Status = Closed');
    expect(res.notes).toContain('Sheet "Notes" is empty — skipped.');
  });

  it('splits side-by-side tables at the blank column and skips the repeated header', () => {
    expect(res.masters.map((m) => [m.name, m.range, m.records.length])).toEqual([
      ['Inventory Capture Master — Part 1', 'A1:F9', 6],
      ['Inventory Capture Master — Part 2', 'H1:N5', 4],
    ]);
    expect(res.masters[0].skippedRows).toEqual([6]);
    expect(res.masters.map((m) => m.id)).toEqual(['inventory_capture_part_1_master', 'inventory_capture_part_2_master']);
    expect(masterIdFor('Ins. Doc Collection-Customer')).toBe('ins_doc_collection_custo_master');
    expect(masterIdFor('Master')).toBe('imported_master');
  });

  it('infers column types, dropdown options and mandatory flags', () => {
    const [left, right] = res.masters;
    const t = (m: typeof left) => Object.fromEntries(m.columns.map((c) => [c.label, [c.type, c.mandatory, c.options ?? c.max ?? null]]));
    expect(t(left)).toEqual({
      Section: ['select', true, ['Documents', 'Accident Details', 'Internal']],
      Roles: ['select', true, ['DSvAdv, Driver', 'DSvAdv']],
      'Sequence Priority': ['number', true, null],
      Active: ['select', true, ['Y', 'N']],
      'Service Type': ['select', true, ['All', 'Accident']],
      BU: ['select', true, ['PV', 'EV']],
    });
    expect(left.records[5]).toMatchObject({ section: 'Internal', active: 'Y', bu: 'EV' }); // "Yes" normalised to Y
    expect(t(right)).toMatchObject({
      Section: ['text', false, null],
      Mandatory: ['select', true, ['Y', 'N']],
      'No. of Image Required(Max 2)': ['number', true, 2],
      'Effective From': ['date', true, null],
    });
    expect(right.records[0]).toMatchObject({ checkpoint: 'Horn Working', no_of_image_required_max_2: 2, effective_from: '2026-10-01' });
  });

  it('reports gaps with Excel row numbers instead of guessing', () => {
    expect(res.masters[0].issues).toEqual(['Row(s) 6 repeat the header and were skipped (e.g. a second PV/EV block).']);
    expect(res.masters[1].issues).toEqual([
      '"Section" is blank in row(s) 4.',
      '"No. of Image Required(Max 2)" is above the maximum 2 in row(s) 3.',
      'Row 5 duplicates row 2.',
    ]);
  });
});

describe('Smart Excel Import — creating masters', () => {
  const [left, right] = detectMasters(baWorkbook()).masters;
  const place = { ...guessPlacement('Bodyshop_Master_1.xlsx', left.sheet), owner: 'TML_ADMIN' };

  it('guesses module and group from file / sheet names', () => {
    expect(guessPlacement('Bodyshop_Master_1.xlsx', 'Inventory Capture Master')).toEqual({ moduleCode: 'bodyshop', logicalGroup: 'Bodyshop' });
    expect(guessPlacement('EQC masters.xlsx', 'PTD Risk')).toEqual({ moduleCode: 'eqc', logicalGroup: 'Electronic Quality Check' });
    expect(guessPlacement('misc.xlsx', 'Sheet1')).toEqual({ moduleCode: 'jc_creation', logicalGroup: 'Service Operations' });
  });

  it('produces a valid master whose records pass validation', () => {
    const config = toMasterConfig(left, { ...place, id: left.id, name: 'Inventory Sections' }, 'Bodyshop_Master_1.xlsx');
    expect(validateMasterDefinition({ ...config, fields: config.fields }, [])).toEqual([]);
    config.records.forEach((r) => expect(masterValidationSchema.validateRecord(config.fields, r).isValid).toBe(true));
    expect(config.description).toContain('sheet "Inventory Capture Master" (A1:F9)');
  });

  it('rows breaking an inferred rule (Max 2) are caught before import', () => {
    const fields = fieldsFor(right.columns);
    const bad = right.records.filter((r) => !masterValidationSchema.validateRecord(fields, r).isValid);
    expect(bad.map((r) => r.checkpoint)).toEqual(['Steering Wheel']);
  });
});

describe('Smart Excel Template (public/downloads)', () => {
  it('imports cleanly: guide sheet skipped, empty "Your Master" skipped, the example becomes 2 masters', async () => {
    const fs = await import('fs');
    for (const dir of ['public/downloads', 'docs/templates']) {
      const res = detectMasters(readRawWorkbook(fs.readFileSync(`${dir}/TML_Smart_Excel_Template.xlsx`)));
      expect(res.notes).toEqual([
        'Sheet "README - How to fill" is a guide sheet — skipped.',
        'Sheet "Your Master" columns A–F: header only, no data rows — skipped.',
      ]);
      expect(res.masters.map((m) => [m.name, m.records.length, m.issues])).toEqual([
        ['Example - Inventory Capture — Part 1', 8, ['Row(s) 6 repeat the header and were skipped (e.g. a second PV/EV block).']],
        ['Example - Inventory Capture — Part 2', 5, []],
      ]);
      expect(res.masters[1].columns.find((c) => c.label === 'No. of Images Required (Max 2)')).toMatchObject({ type: 'number', max: 2 });
    }
  });
});
