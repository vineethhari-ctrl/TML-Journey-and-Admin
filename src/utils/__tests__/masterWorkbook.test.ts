import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildTemplateWorkbook,
  buildPracticeWorkbook,
  buildMasterWorkbook,
  parseMasterWorkbook,
  applyMasterImport,
  workbookToArrayBuffer,
  readWorkbook,
  validateMasterDefinition,
  slugifyMasterId,
  slugifyFieldKey,
  moduleNameFor,
  MASTER_COLUMNS,
  FIELD_COLUMNS,
} from '../masterWorkbook';
import { MASTER_COLLECTIONS } from '../../data/masterCatalogue';

/** Round-trips through real .xlsx bytes, like a file the BA saved in Excel. */
const roundTrip = (wb: XLSX.WorkBook) => readWorkbook(new Uint8Array(workbookToArrayBuffer(wb)));

const workbook = (masters: any[][], fields: any[][], recordSheets: Record<string, any[][]> = {}) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...MASTER_COLUMNS], ...masters]), 'Masters');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...FIELD_COLUMNS], ...fields]), 'Fields');
  Object.entries(recordSheets).forEach(([name, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name));
  return roundTrip(wb);
};

const fieldRow = (masterId: string, key: string, label: string, type: string, extra: Partial<Record<(typeof FIELD_COLUMNS)[number], any>> = {}) =>
  FIELD_COLUMNS.map((c) => (c === 'Master ID' ? masterId : c === 'Field Key' ? key : c === 'Field Label' ? label : c === 'Type' ? type : extra[c] ?? ''));

describe('template workbook', () => {
  it('contains README, Masters, Fields and an example records sheet', () => {
    const wb = buildTemplateWorkbook();
    expect(wb.SheetNames).toEqual(['README', 'Masters', 'Fields', 'tyre_brand_master']);
  });

  it('imports cleanly as-is (the example is valid)', () => {
    const parsed = parseMasterWorkbook(roundTrip(buildTemplateWorkbook()), MASTER_COLLECTIONS);
    expect(parsed.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(parsed.summary).toEqual([
      expect.objectContaining({ id: 'tyre_brand_master', action: 'create', fieldCount: 6, recordCount: 2 }),
    ]);
    const m = parsed.masters[0];
    expect(m.moduleName).toBe(moduleNameFor('bodyshop'));
    expect(m.records[0]).toMatchObject({ id: 'TYR-001', brand_code: 'MRF', warranty_months: 60, active: true, effective_from: '2026-04-01' });
    expect(m.fields.find((f) => f.key === 'segment')).toMatchObject({
      options: ['PV', 'EV'],
      displayInDealerApp: true,
      dealerTargetModule: 'job_card',
      valueMapping: { PV: 'Passenger Vehicle', EV: 'Electric Vehicle' },
    });
  });

  it('exporting existing masters and re-importing them (update mode) changes nothing', () => {
    const sample = MASTER_COLLECTIONS.filter((m) => !m.isInteractiveSpecial).slice(0, 3);
    const parsed = parseMasterWorkbook(roundTrip(buildMasterWorkbook(sample)), MASTER_COLLECTIONS, 'update');
    expect(parsed.hasErrors).toBe(false);
    parsed.masters.forEach((m) => {
      const orig = sample.find((o) => o.id === m.id)!;
      expect(m.fields).toHaveLength(orig.fields.length);
      expect(m.records).toHaveLength(orig.records.length);
    });
  });
});

describe('parseMasterWorkbook validation', () => {
  it('reports precise errors with sheet and row', () => {
    const wb = workbook(
      [['Bad ID!', 'Broken', 'not_a_module', 'Vehicle Data', 'SOMEONE', '', '']],
      [fieldRow('bad id!', 'grade', 'Grade', 'select', { Options: 'ONLY_ONE' })]
    );
    const parsed = parseMasterWorkbook(wb, MASTER_COLLECTIONS);
    expect(parsed.hasErrors).toBe(true);
    expect(parsed.masters).toEqual([]);
    const text = parsed.issues.map((i) => `${i.sheet}:${i.row}:${i.message}`).join('\n');
    expect(text).toMatch(/Masters:2:.*Master ID/);
    expect(text).toMatch(/Module code "not_a_module"/);
    expect(text).toMatch(/Owner "SOMEONE"/);
    expect(text).toMatch(/Fields:2:.*at least 2 options/);
  });

  it('validates record values against field types and rules', () => {
    const wb = workbook(
      [['paint_code_master', 'Paint Codes', 'bodyshop', 'Service Operations', 'TML_ADMIN', '', '']],
      [
        fieldRow('paint_code_master', 'code', 'Code', 'text', { Mandatory: 'Y', Pattern: '^[A-Z]{2}[0-9]{2}$' }),
        fieldRow('paint_code_master', 'litres', 'Litres', 'number', { Min: 0, Max: 20 }),
      ],
      { paint_code_master: [['id', 'Code', 'Litres'], ['P1', 'AB12', '5'], ['P2', 'bad', '50'], ['P1', 'CD34', '1']] }
    );
    const parsed = parseMasterWorkbook(wb, MASTER_COLLECTIONS);
    const errs = parsed.issues.filter((i) => i.severity === 'error');
    expect(errs.map((e) => e.row)).toEqual([3, 3, 4]);
    expect(errs.map((e) => e.message).join(' ')).toMatch(/does not match|greater than 20|appears more than once/);
  });

  it('skips existing masters by default and lists them as warnings', () => {
    const ppl = MASTER_COLLECTIONS[0];
    const wb = workbook([[ppl.id, ppl.name, ppl.moduleCode, ppl.logicalGroup, ppl.owner, '', '']], [fieldRow(ppl.id, 'new_flag', 'New Flag', 'boolean')]);
    const parsed = parseMasterWorkbook(wb, MASTER_COLLECTIONS);
    expect(parsed.hasErrors).toBe(false);
    expect(parsed.summary[0].action).toBe('skip');
    expect(parsed.masters).toEqual([]);
    expect(parsed.issues[0].severity).toBe('warning');
  });

  it('update mode adds missing fields and upserts records without touching existing fields', () => {
    const ppl = MASTER_COLLECTIONS[0];
    const existingId = String(ppl.records[0].id);
    const firstKey = ppl.fields[0].key;
    const wb = workbook(
      [[ppl.id, ppl.name, ppl.moduleCode, ppl.logicalGroup, ppl.owner, '', '']],
      [fieldRow(ppl.id, 'ev_ready', 'EV Ready', 'boolean'), fieldRow(ppl.id, firstKey, 'Renamed!', 'number')],
      {
        [ppl.id]: [
          ['id', 'ev_ready', 'bu', 'pplCode', 'pplName', 'plName'],
          [existingId, 'Y', '', '', '', ''], // partial row for an existing record: only the new field
          ['', 'N', 'EV', 'PPL-NEW', 'Curvv', 'Curvv EV 55'], // new record: all mandatory fields
        ],
      }
    );
    const parsed = parseMasterWorkbook(wb, MASTER_COLLECTIONS, 'update');
    expect(parsed.hasErrors).toBe(false);
    const m = parsed.masters[0];
    expect(m.fields).toHaveLength(ppl.fields.length + 1);
    expect(m.fields[0]).toEqual(ppl.fields[0]); // existing definition untouched
    expect(m.records.find((r) => r.id === existingId)).toMatchObject({ ev_ready: true, [firstKey]: ppl.records[0][firstKey] });
    expect(m.records).toHaveLength(ppl.records.length + 1); // blank id row got a new, non-clashing id
    expect(new Set(m.records.map((r) => r.id)).size).toBe(m.records.length);
    expect(parsed.issues.some((i) => /left unchanged/.test(i.message))).toBe(true);
  });

  it('update mode still requires all mandatory fields for brand-new records', () => {
    const ppl = MASTER_COLLECTIONS[0];
    const wb = workbook([[ppl.id, ppl.name, ppl.moduleCode, ppl.logicalGroup, ppl.owner, '', '']], [], {
      [ppl.id]: [['id', 'pplName'], ['NEW-1', 'Only a name']],
    });
    const parsed = parseMasterWorkbook(wb, MASTER_COLLECTIONS, 'update');
    expect(parsed.hasErrors).toBe(true);
    expect(parsed.issues.map((i) => i.message).join(' ')).toMatch(/BU is required/);
  });

  it('refuses to import into console-managed masters', () => {
    const wb = workbook(
      [['bay_management_interactive', 'Bays', 'jc_tracking', 'Dealer Network', 'DEALER_ADMIN', '', '']],
      [fieldRow('bay_management_interactive', 'extra', 'Extra', 'text')]
    );
    const parsed = parseMasterWorkbook(wb, MASTER_COLLECTIONS, 'update');
    expect(parsed.hasErrors).toBe(true);
  });

  it('flags missing sheets and orphan field rows', () => {
    const noSheets = parseMasterWorkbook(XLSX.utils.book_new(), []);
    expect(noSheets.issues.map((i) => i.message).join(' ')).toMatch(/"Masters" is missing.*|"Fields" is missing/);
    const orphan = workbook([['abc_master', 'ABC', 'spd', 'Vehicle Data', 'TML_ADMIN', '', '']], [
      fieldRow('abc_master', 'x', 'X', 'text'),
      fieldRow('ghost_master', 'y', 'Y', 'text'),
    ]);
    expect(parseMasterWorkbook(orphan, []).issues.map((i) => i.message).join(' ')).toMatch(/ghost_master/);
  });
});

describe('applyMasterImport', () => {
  it('replaces updated masters in place and appends new ones', () => {
    const [a, b] = MASTER_COLLECTIONS;
    const out = applyMasterImport([a, b], [{ ...b, name: 'B2' }, { ...a, id: 'new_master', name: 'New' }]);
    expect(out.map((m) => m.id)).toEqual([a.id, b.id, 'new_master']);
    expect(out[1].name).toBe('B2');
  });
});

describe('definition helpers', () => {
  it('slugify produces valid ids and keys', () => {
    expect(slugifyMasterId('Tyre Brand')).toBe('tyre_brand_master');
    expect(slugifyMasterId('2W Accessory List')).toBe('m_2w_accessory_list_master');
    expect(slugifyMasterId('A'.repeat(60)).length).toBeLessThanOrEqual(31);
    expect(slugifyFieldKey('Warranty (Months)')).toBe('warranty_months');
  });

  it('validateMasterDefinition rejects taken ids and duplicate field keys', () => {
    const errs = validateMasterDefinition(
      {
        id: MASTER_COLLECTIONS[0].id,
        name: 'X',
        moduleCode: 'spd',
        logicalGroup: 'Vehicle Data',
        owner: 'TML_ADMIN',
        fields: [
          { key: 'a', label: 'A', type: 'text' },
          { key: 'a', label: 'A again', type: 'text' },
        ],
      },
      MASTER_COLLECTIONS.map((m) => m.id)
    );
    expect(errs.join(' ')).toMatch(/already exists/);
    expect(errs.join(' ')).toMatch(/used more than once/);
  });
});

describe('practice workbook', () => {
  it('creates one master and adds a missed field to ppl_master in update mode', () => {
    const parsed = parseMasterWorkbook(roundTrip(buildPracticeWorkbook()), MASTER_COLLECTIONS, 'update');
    expect(parsed.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(parsed.summary.map((s) => [s.id, s.action, s.newFieldCount, s.recordCount])).toEqual([
      ['courtesy_car_master', 'create', 3, 3],
      ['ppl_master', 'update', 1, 2],
    ]);
    const ppl = parsed.masters.find((m) => m.id === 'ppl_master')!;
    expect(ppl.records.find((r) => r.id === 'PPL-01')).toMatchObject({ adas_level: 'L2', pplName: 'Nexon' });
  });

  it('in the default "skip" mode only the new master is imported', () => {
    const parsed = parseMasterWorkbook(roundTrip(buildPracticeWorkbook()), MASTER_COLLECTIONS, 'skip');
    expect(parsed.masters.map((m) => m.id)).toEqual(['courtesy_car_master']);
  });
});

describe('downloadable BA files (docs/templates and public/downloads)', () => {
  it.each(['docs/templates', 'public/downloads'])('%s: every file is present and imports without errors', async (dir) => {
    const fs = await import('fs');
    const path = await import('path');
    const read = (name: string) => readWorkbook(new Uint8Array(fs.readFileSync(path.resolve(process.cwd(), dir, name))));
    expect(parseMasterWorkbook(read('TML_Master_Definition_Template.xlsx'), MASTER_COLLECTIONS).hasErrors).toBe(false);
    expect(parseMasterWorkbook(read('TML_Master_Practice_Workbook.xlsx'), MASTER_COLLECTIONS, 'update').hasErrors).toBe(false);
    const catalogue = parseMasterWorkbook(read('TML_Existing_Masters_Catalogue.xlsx'), MASTER_COLLECTIONS, 'update');
    expect(catalogue.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
});
