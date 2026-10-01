import { describe, it, expect } from 'vitest';
import { MASTER_COLLECTIONS } from '../../data/masterCatalogue';
import { BS_MASTER_IDS, bodyshopHealthCheck, insuranceDocumentsToCollect, resolveInventoryCapture } from '../bodyshopRules';
import { masterValidationSchema } from '../masterValidationSchema';

const master = (id: string) => MASTER_COLLECTIONS.find((m) => m.id === id)!;
const sections = master(BS_MASTER_IDS.sections).records;
const checkpoints = master(BS_MASTER_IDS.checkpoints).records;
const docs = master(BS_MASTER_IDS.insuranceDocs).records;
const names = (q: Parameters<typeof resolveInventoryCapture>[2], cps = checkpoints) =>
  resolveInventoryCapture(sections, cps, q).map((s) => [s.section, s.items.map((i) => i.label)]);

describe('Bodyshop masters match the BA workbook (Bodyshop_Master_1.xlsx)', () => {
  it('Sections: 7 per BU with the Excel roles, priorities and service types', () => {
    expect(sections).toHaveLength(14);
    for (const bu of ['PV', 'EV']) {
      expect(sections.filter((s) => s.bu === bu).map((s) => [s.section, s.roles, s.sequencePriority, s.serviceType])).toEqual([
        ['Documents', 'DSvAdv, Driver', 1, 'All'],
        ['Accident Details', 'DSvAdv', 2, 'Accident'],
        ['External', 'DSvAdv, Driver', 4, 'All'],
        ['Internal', 'DSvAdv', 3, 'All'],
        ['Inventory', 'DSvAdv', 5, 'All'],
        ['Accessories', 'DSvAdv, Driver', 6, 'All'],
        ['Tyre & Battery', 'DSvAdv, Driver', 7, 'All'],
      ]);
    }
  });

  it('Checkpoints: the 11 Excel rows, blanks kept', () => {
    expect(checkpoints.map((c) => c.checkpoint || c.subSection1)).toEqual([
      'Cabin', 'Instrument Cluster', 'Seats & Belt', 'Steering Wheel Condition', 'Horn Working', 'Steering Controls Working',
      'Insurance Copy', 'Police Complaint Report', 'Battery Information', "Owner's Manual", 'Pen Drive',
    ]);
    expect(checkpoints.find((c) => c.checkpoint === 'Horn Working')).toMatchObject({ acceptableValues: 'OK, NOT OK, NA', mediaType: 'Image', imagesRequired: 2, mediaApplicableOn: 'All' });
    expect(checkpoints.find((c) => c.subSection1 === 'Cabin')).toMatchObject({ checkpoint: '', mediaType: 'Image', imagesRequired: 2, mediaApplicableOn: 'Not OK' });
    expect(checkpoints.find((c) => c.checkpoint === 'Pen Drive')).toMatchObject({ section: '', subSection1: '', role: 'Driver', acceptableValues: 'Count' });
  });

  it('Insurance documents: the 2 Excel rows', () => {
    expect(docs.map((d) => [d.documentCategory, d.mandatoryFlag, d.documentType, d.imagesRequired, d.sequence, d.active])).toEqual([
      ['Insurance Copy', 'N', 'PDF/Image', null, 2, 'N'],
      ['Police Complaint Report', 'N', 'Image', 2, 1, 'Y'],
    ]);
  });
});

describe('Inventory capture resolution', () => {
  it('orders sections by Sequence Priority (Internal 3 before External 4) and hides Accident-only sections on general jobs', () => {
    expect(names({ bu: 'PV', job: 'General', role: 'DSvAdv' }).map(([s]) => s)).toEqual(['Documents', 'Internal', 'External', 'Inventory', 'Accessories', 'Tyre & Battery']);
    expect(names({ bu: 'PV', job: 'Accident', role: 'DSvAdv' }).map(([s]) => s)).toEqual([
      'Documents', 'Accident Details', 'Internal', 'External', 'Inventory', 'Accessories', 'Tyre & Battery',
    ]);
  });

  it('filters checkpoints by role and service type; blank checkpoint = sub-section level capture', () => {
    const accident = names({ bu: 'PV', job: 'Accident', role: 'DSvAdv' });
    expect(accident.find(([s]) => s === 'Documents')![1]).toEqual(['Insurance Copy', 'Police Complaint Report']);
    expect(accident.find(([s]) => s === 'Internal')![1]).toEqual(['Cabin', 'Instrument Cluster', 'Seats & Belt', 'Steering Wheel Condition', 'Horn Working', 'Steering Controls Working']);
    expect(names({ bu: 'PV', job: 'General', role: 'DSvAdv' }).find(([s]) => s === 'Documents')![1]).toEqual([]);
    // Driver is not a role on Internal / Inventory sections
    expect(names({ bu: 'EV', job: 'General', role: 'Driver' }).map(([s]) => s)).toEqual(['Documents', 'External', 'Accessories', 'Tyre & Battery']);
  });

  it('once the BA fills the blank Section, the Driver inventory items appear', () => {
    const fixed = checkpoints.map((c) => (c.id === 'BSC-10' || c.id === 'BSC-11' ? { ...c, section: 'Accessories', subSection1: 'Inventory Categories', serviceType: 'All' } : c));
    expect(names({ bu: 'PV', job: 'General', role: 'Driver' }, fixed).find(([s]) => s === 'Accessories')![1]).toEqual(["Owner's Manual", 'Pen Drive']);
  });

  it('collects active insurance documents in sequence order', () => {
    expect(insuranceDocumentsToCollect(docs).map((d) => d.documentCategory)).toEqual(['Police Complaint Report']);
  });
});

describe('Bodyshop validation', () => {
  it('flags every gap in the Excel', () => {
    expect(bodyshopHealthCheck(sections, checkpoints, docs)).toEqual([
      'Checkpoints BSC-09 (Battery Information): Section "Internal-Accessories" is not in the Sections master, so it is never shown.',
      'Checkpoints BSC-09 (Battery Information): Mandatory / Active is blank.',
      'Checkpoints BSC-09 (Battery Information): Service Type is blank.',
      'Checkpoints BSC-09 (Battery Information): Choose when the photo / video is taken (All or Not OK).',
      "Checkpoints BSC-10 (Owner's Manual): Section is blank.",
      "Checkpoints BSC-10 (Owner's Manual): Service Type is blank.",
      'Checkpoints BSC-11 (Pen Drive): Section is blank.',
      'Checkpoints BSC-11 (Pen Drive): Sub-Section Level 1 is blank.',
      'Checkpoints BSC-11 (Pen Drive): Service Type is blank.',
      'Checkpoints: Sub-Section "Steering Controls" has different sequence numbers (4, 5, (blank)).',
      'Sections: "Accident Details" has no active checkpoints yet.',
      'Sections: "External" has no active checkpoints yet.',
      'Sections: "Inventory" has no active checkpoints yet.',
      'Sections: "Accessories" has no active checkpoints yet.',
      'Sections: "Tyre & Battery" has no active checkpoints yet.',
      '"Insurance Copy" is captured in the Documents section (BSC-07) but is inactive in Insurance Document Collection (BSD-01) — keep one source.',
    ]);
  });

  it('flags a checkpoint role that its section does not allow', () => {
    const cps = [{ id: 'X', section: 'Internal', subSection1: 'Cabin', role: 'Driver', mandatory: 'Y', active: 'Y', serviceType: 'All' }];
    expect(bodyshopHealthCheck(sections, cps, [])).toContain('Checkpoints X (Cabin): role Driver is not in the Roles of section "Internal" (DSvAdv), so nobody sees it.');
  });

  it('cross-field rules run on save / import', () => {
    const cpFields = master(BS_MASTER_IDS.checkpoints).fields;
    const row = { section: 'Internal', subSection1: 'Cabin', role: 'DSvAdv', mandatory: 'Y', active: 'Y', serviceType: 'All', imagesRequired: 2, mediaType: '' };
    expect(masterValidationSchema.validateRecord(cpFields, row, BS_MASTER_IDS.checkpoints).errors).toHaveProperty('mediaType');
    expect(masterValidationSchema.validateRecord(cpFields, { ...row, imagesRequired: 3, mediaType: 'Image', mediaApplicableOn: 'All' }).errors).toHaveProperty('imagesRequired'); // max 2
    expect(masterValidationSchema.validateRecord(cpFields, { ...row, mediaType: 'Image', mediaApplicableOn: 'All' }, BS_MASTER_IDS.checkpoints).isValid).toBe(true);

    const docFields = master(BS_MASTER_IDS.insuranceDocs).fields;
    const doc = { documentCategory: 'RC Copy', mandatoryFlag: 'Y', documentType: 'PDF/Image', sequence: 3, active: 'Y' };
    expect(masterValidationSchema.validateRecord(docFields, doc, BS_MASTER_IDS.insuranceDocs).errors).toHaveProperty('imagesRequired');
    expect(masterValidationSchema.validateRecord(docFields, { ...doc, documentType: 'PDF' }, BS_MASTER_IDS.insuranceDocs).isValid).toBe(true);

    const secFields = master(BS_MASTER_IDS.sections).fields;
    const sec = { bu: 'PV', section: 'Glass', sequencePriority: 8, active: 'Y', serviceType: 'All' };
    expect(masterValidationSchema.validateRecord(secFields, { ...sec, roles: 'DSvAdv, Driver' }).isValid).toBe(true);
    expect(masterValidationSchema.validateRecord(secFields, { ...sec, roles: 'Surveyor' }).isValid).toBe(false);
  });
});
