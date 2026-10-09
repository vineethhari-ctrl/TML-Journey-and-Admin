/**
 * The specification workbook for the masters the BA has CONFIRMED (eQC, Bodyshop). Test data only.
 *   npm run ba-spec   →   build/TML_eQC_Bodyshop_Master_Spec.xlsx
 * For the Solution Architect and the BAs: every master and field as confirmed, plus the yellow cells to confirm (in CRM? business
 * control? where does each field come from?) and the open questions found while reading the BA's files.
 */
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { EQC_PPL_LIST, EQC_SAMPLE, EQC_SPEC, type EqcFieldDef } from '../src/data/confirmedEqcSpec';
import { BODYSHOP_PARTS } from '../src/data/confirmedBodyshopSpec';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.join(root, 'build');
fs.mkdirSync(outDir, { recursive: true });

const NAVY = 'FF002244';
const YELLOW = 'FFFEF08A';
const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const wb = new ExcelJS.Workbook();

const headRow = (ws: ExcelJS.Worksheet, heads: string[], inputCols: number[] = []) => {
  const r = ws.addRow(heads);
  r.height = 32;
  r.eachCell((c, col) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = fill(inputCols.includes(col) ? 'FFB45309' : NAVY);
    c.alignment = { wrapText: true, vertical: 'middle' };
  });
  return r;
};
const sheet = (name: string, widths: number[], heads: string[], inputCols: number[] = []) => {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = widths.map((w) => ({ width: w }));
  headRow(ws, heads, inputCols);
  return ws;
};
const body = (ws: ExcelJS.Worksheet, values: (string | number)[], inputCols: number[] = []) => {
  const r = ws.addRow(values);
  r.alignment = { vertical: 'top', wrapText: true };
  inputCols.forEach((c) => (r.getCell(c).fill = fill(YELLOW)));
  return r;
};

// ------------------------------------------------------------------ how to fill
const help = wb.addWorksheet('How to fill');
help.columns = [{ width: 130 }];
[
  ['TML Service Transformation · eQC and Bodyshop masters: confirmed specification'],
  ['Built from the BA\'s own files: "eQC Master Management Portal v11" (HTML) and "Bodyshop_Master.xlsx". Test data only.'],
  [],
  ['What is in this workbook'],
  ['  Masters      the 11 confirmed masters, with the two yes/no questions per master (yellow) and a result that fills itself.'],
  ['  Fields       every field of every master as confirmed: type, dropdown values, required, part of the duplicate check. Yellow = where does the field come from (CRM or ST).'],
  ['  Dropdown lists   every dropdown in these masters with its values. Yellow = does the list come from CRM or is it kept in ST.'],
  ['  Behaviour    what the BA\'s eQC portal does (duplicate check, All PPLs, history …). Yellow = confirm that the system must do the same.'],
  ['  Open questions   things found while reading the files that need an answer before anything is built. Yellow = answer.'],
  [],
  ['The two questions per master'],
  ['  Q1  Is this master already in CRM?  (Yes / No).  Yes = CRM stays the source.  No = new for Service Transformation, kept in the ST Portal.'],
  ['  Q2  Does Business want to switch records on / off inside ST?  (Yes / No).  Example: only some PPL models available in a screen.'],
  ['  Result  New ST master  |  CRM master, used as it is  |  CRM master + business control.'],
  [],
  ['Fill only the yellow cells. Everything else comes from the BA\'s files.'],
].forEach((r) => help.addRow(r));
help.getCell('A1').font = { bold: true, size: 14, color: { argb: NAVY } };
['A4', 'A11'].forEach((a) => (help.getCell(a).font = { bold: true }));

// ------------------------------------------------------------------ masters
const masters = sheet('Masters', [12, 44, 36, 8, 52, 14, 18, 28, 20, 36, 38], ['Module', 'Master', 'Source file', 'Fields', 'Duplicate check (record is a duplicate when these are the same)', 'Rows in file', 'Q1. Already in CRM?', 'Q2. Business wants to switch records on / off in ST?', 'How will ST read it from CRM?', 'Remarks', 'Result (fills itself)'], [7, 8, 9, 10]);
const addMasterRow = (v: (string | number)[]) => {
  const r = body(masters, [...v, '', '', '', '', ''], [7, 8, 9, 10]);
  r.getCell(11).value = { formula: `IF(G${r.number}="","",IF(G${r.number}="No","New ST master",IF(H${r.number}="Yes","CRM master + business control","CRM master, used as it is")))`, result: '' };
  r.getCell(11).fill = fill('FFE0F2FE');
  r.getCell(7).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] };
  r.getCell(8).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] };
  r.getCell(9).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Solar,API,Not sure"'] };
};
const EQC_SRC = 'eQC Master Management Portal v11 (HTML)';
Object.values(EQC_SPEC).forEach((m) => {
  const key = m.name === 'Bodyshop Checklist' ? 'Section + Sub-Section + All PPLs + PPL' : m.keys.join(' + ');
  addMasterRow(['eQC', m.name === 'Bodyshop Checklist' ? 'Bodyshop Checklist (eQC)' : m.name, EQC_SRC, m.fields.length, key, 'sample only']);
});
const bsMasters = [...new Set(BODYSHOP_PARTS.map((p) => p.master))];
bsMasters.forEach((name) => {
  const parts = BODYSHOP_PARTS.filter((p) => p.master === name);
  const rows = parts.reduce((n, p) => n + p.rows, 0);
  addMasterRow(['Bodyshop', name, 'Bodyshop_Master.xlsx (status Closed)', parts.reduce((n, p) => n + p.fields.length, 0), 'Not stated in the file: BA to define (see Open questions)', parts.length > 1 ? `${rows} (${parts.map((p) => `${p.rows} ${p.part.toLowerCase()}`).join(' + ')})` : rows]);
});

// ------------------------------------------------------------------ fields
const REQUIRED: Record<string, string[]> = {
  general: ['Checklist Item'], scheduled: ['Section', 'Sub-Section'], bodyshop: ['Section', 'Sub-Section'], washing: ['Check Description'],
  washingJob: ['Job Code Value'], guided: ['PPL', 'Complaint Code'], exception: ['VC Number'], did: ['Parameter Name'], ptd: ['Color Code'],
};
const TYPE: Record<EqcFieldDef[1], string> = { text: 'Text', number: 'Number', bool: 'Yes / No', date: 'Date', select: 'Dropdown', ppl: 'Dropdown (PPL list)', fixed: 'Fixed value' };
const behaviour = (f: EqcFieldDef, all: EqcFieldDef[]) => {
  const [name, type, opt] = f;
  const has = (n: string) => all.some((x) => x[0] === n);
  if (type === 'ppl') {
    return has('All PPLs')
      ? 'Pick one PPL (vehicle model) from the list. This field is greyed out while the tick box "All PPLs" (the field just above it) is ticked: the row then applies to every PPL.'
      : 'Pick one PPL (vehicle model) from the list. This master has no "All PPLs" tick box, so a PPL is always required.';
  }
  if (name === 'Range Start KM' || name === 'Range End KM') return 'A KM number. Greyed out while the tick box "All KM Ranges" is ticked: the row then applies to every KM range.';
  if (name === 'All PPLs') return 'Tick box (the on / off switch for the PPL field below). Ticked by default on a new row = applies to every PPL. Untick it to choose one PPL.';
  if (name === 'All KM Ranges') return 'Tick box (the on / off switch for the KM range fields). Ticked by default on a new row = applies to every KM range. Untick it to enter a start and end KM.';
  if (name === 'Active') return 'Ticked by default. Records are never deleted, only deactivated (a reason is asked).';
  if (type === 'fixed') return `Fixed value "${opt}"; cannot be edited.`;
  if (name === 'Exception Till') return 'Blank = Permanent.';
  if (type === 'select') return 'First value is the default.';
  return '';
};
const hint = (f: EqcFieldDef) => {
  const n = f[0];
  if (f[1] === 'ppl') return 'Looks like CRM (PL / PPL)';
  if (n === 'Complaint Code') return 'Looks like CRM (complaint codes)';
  if (n === 'VC Number') return 'Looks like CRM / vehicle data';
  if (n === 'Fuel Type') return 'Looks like CRM (fuel types)';
  if (n === 'BU') return 'Common list (PV, EV)';
  return 'New for ST';
};
const fields = sheet('Fields', [10, 40, 16, 6, 36, 22, 44, 11, 14, 60, 26, 30, 30], ['Module', 'Master', 'Part', '#', 'Field', 'Type', 'Dropdown values', 'Required?', 'In duplicate check?', 'Behaviour / note', 'Our guess: where does it come from?', 'Field comes from (CRM / ST)', 'Remarks'], [12, 13]);
Object.entries(EQC_SPEC).forEach(([id, m]) => {
  const master = m.name === 'Bodyshop Checklist' ? 'Bodyshop Checklist (eQC)' : m.name;
  m.fields.forEach((f, i) => {
    const opt = Array.isArray(f[2]) ? f[2].join(', ') : '';
    const row = body(fields, ['eQC', master, '', i + 1, f[0], TYPE[f[1]], f[1] === 'ppl' ? `${EQC_PPL_LIST.length} PPLs: ${EQC_PPL_LIST.join(', ')}` : opt, REQUIRED[id]?.includes(f[0]) ? 'Yes' : f[1] === 'ppl' ? (m.fields.some((x) => x[0] === 'All PPLs') ? 'Yes (unless "All PPLs" is ticked)' : 'Yes') : '', m.keys.includes(f[0]) ? 'Yes' : '', behaviour(f, m.fields), hint(f), '', ''], [12, 13]);
    row.getCell(12).dataValidation = { type: 'list', allowBlank: true, formulae: ['"CRM,ST"'] };
  });
});
BODYSHOP_PARTS.forEach((p) =>
  p.fields.forEach((f, i) => {
    const row = body(fields, ['Bodyshop', p.master, p.part, i + 1, f.name, f.type, (f.values ?? []).join(', '), 'BA to fill', 'BA to fill', f.note ?? '', f.name === 'Role' || f.name === 'Roles' ? 'Looks like roles (Roles & Access)' : f.name === 'BU' ? 'Common list (PV, EV)' : 'New for ST', '', ''], [12, 13]);
    row.getCell(12).dataValidation = { type: 'list', allowBlank: true, formulae: ['"CRM,ST"'] };
  })
);
fields.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 13 } };

// ------------------------------------------------------------------ dropdown lists
const lists = sheet('Dropdown lists', [30, 56, 80, 24, 30], ['List', 'Used in', 'Values', 'List comes from (CRM / ST)', 'Remarks'], [4, 5]);
const found = new Map<string, { used: Set<string>; values: string }>();
Object.values(EQC_SPEC).forEach((m) =>
  m.fields.forEach((f) => {
    if (f[1] !== 'select' || !Array.isArray(f[2])) return;
    const e = found.get(f[0]) ?? { used: new Set<string>(), values: f[2].join(', ') };
    e.used.add(m.name);
    found.set(f[0], e);
  })
);
body(lists, ['PPL list', 'General, Scheduled, Bodyshop (eQC), Guided Check, DID Threshold: field PPL', EQC_PPL_LIST.join(', '), '', 'The file has a fixed list of 14. The real source is the CRM PL / PPL master.'], [4, 5]);
found.forEach((e, name) => body(lists, [name, [...e.used].join(', '), e.values, '', ''], [4, 5]));
const bsLists = new Map<string, { used: Set<string>; values: string[] }>();
BODYSHOP_PARTS.forEach((p) => p.fields.filter((f) => f.values && f.type !== 'Yes / No').forEach((f) => {
  const e = bsLists.get(f.name) ?? { used: new Set<string>(), values: f.values! };
  e.used.add(`${p.master} (${p.part})`);
  bsLists.set(f.name, e);
}));
bsLists.forEach((e, name) => body(lists, [`${name} (Bodyshop)`, [...e.used].join(', '), e.values.join(', '), '', ''], [4, 5]));
body(lists, ['Yes / No flags', 'Active, Mandatory and similar flags', 'Y, N (Bodyshop) · ticked / not ticked (eQC)', '', 'The two files write it differently: confirm one way.'], [4, 5]);

// ------------------------------------------------------------------ behaviour
const beh = sheet('Behaviour', [6, 90, 22, 40], ['#', 'What the BA\'s eQC portal does (the system must do the same)', 'Confirm (Yes / No)', 'Remarks'], [3, 4]);
[
  'A new record is added in the table row itself (no popup); Save or Cancel. Only one row can be open at a time.',
  'Edit a record in the same row. Copy creates a new record from an existing one (the copy is recorded as "Added from Copy" with the source record).',
  'Duplicate check: a record is refused with "Duplicate record already exists" when the key fields (see Masters) are the same as another record, ignoring capital letters and spaces.',
  'Required fields are listed on the Fields sheet; an empty one is refused ("Required").',
  'Where a master has an "All PPLs" tick box (General, Scheduled, Bodyshop Checklist, DID Threshold): ticked (the default) = the row applies to every PPL and the PPL field is greyed out; not ticked = one PPL must be picked from the list (a name that is not on the list is refused). Guided Check & Road Test has no tick box: its PPL is always required.',
  'Where a master has an "All KM Ranges" tick box (General, Scheduled): ticked (the default) = every KM range, the start / end KM fields are greyed out; not ticked = enter a start and an end KM.',
  'Records are never deleted: Deactivate / Activate asks for a reason, which is kept.',
  'Every record has an audit history: date and time, user, action (Added, Modified, Activated, Deactivated, Imported), each changed field with the old and the new value, and the reason.',
  'Search across all fields, and a filter for Active / Inactive.',
  'Export to Excel per master; Import from Excel into a chosen master.',
  'Import adds every row of the file without the duplicate check or the required check (the BA\'s page does not check imported rows). The system should check them: confirm.',
  'PV and EV only for BU (no CV).',
].forEach((t, i) => body(beh, [i + 1, t, '', ''], [3, 4]));
beh.getColumn(3).eachCell({ includeEmpty: false }, (c, r) => { if (r > 1) c.dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] }; });

// ------------------------------------------------------------------ open questions
const qs = sheet('Open questions', [6, 14, 36, 90, 56, 40], ['#', 'Module', 'Master', 'Question', 'Why it matters', 'Answer'], [6]);
[
  ['eQC', 'Guided Check & Road Test', '"Guided Steps" is one free-text field (e.g. "Verify concern; Visual inspection; VCI/DTC check"). Is that final, or should the steps be a separate master with one row per step and a sequence?', 'One text field cannot be reordered, reused or reported on. A separate master can.'],
  ['eQC', 'Guided Check & Road Test', 'Complaint Code is typed by hand (e.g. CC_01). Should it be picked from the CRM complaint-code master?', 'Typing allows wrong codes; picking keeps one source of truth.'],
  ['eQC', 'General, Scheduled, Bodyshop (eQC), Guided Check, DID Threshold', 'The PPL list (14 values) is fixed inside the file. Is the source the CRM PL / PPL master, and should Business be able to choose which PPLs appear here?', 'This is the PL / PPL example of business control in the architect\'s mail.'],
  ['eQC', 'DID Threshold Mapping', 'Fuel Type and VC Applicability are free text ("EV", "All"). Which values are allowed? Is Fuel Type a CRM list?', 'Free text creates spellings that never match.'],
  ['eQC', 'PTD Risk Configuration', '"BU / Service Type" is free text ("All"). Which values are allowed (PV, EV, All; which service types)? And do Green and Breached need thresholds, or only Orange and Red?', 'Needed to define the dropdown and to know whether all four colours must have a row.'],
  ['eQC', 'Washing Checklist', '"AI Validation Enabled" is a Yes / No flag. What happens when it is Yes, and who validates the photos? BU has said no AI may run in the application.', 'If it calls an AI service at run time, BU will not accept it. If it is only a flag for another system, say which.'],
  ['eQC', 'General, Scheduled, DID, Washing Job Code', 'Duplicate check keys: e.g. General = BU + Checklist Item + KM range + PPL. Is the same item allowed for different KM ranges or PPLs? For DID, are Fuel Type and VC Applicability part of the key?', 'The key decides what counts as a duplicate.'],
  ['eQC', 'Washing Job Code, DID, VCI / OBD Exceptions', 'Effective From / To dates: may two records with the same key have overlapping dates? What should happen at the end date?', 'The BA\'s page does not check overlaps.'],
  ['eQC', 'VCI / OBD Exceptions', '"Approved By" is free text. Should it be a user or role picked from the system?', 'Free text cannot be traced to a person.'],
  ['eQC', 'All', 'Import from Excel in the BA\'s page does not check duplicates or required fields. The system will check them. Confirm.', 'Wrong rows would otherwise get in unnoticed.'],
  ['Bodyshop', 'Inventory Capture + Insurance Document Collection', '"Insurance Copy" and "Police Complaint Report" appear in both masters (as sub-sections of the Documents section, and as insurance documents). Which master owns them?', 'The same document defined twice will drift apart.'],
  ['Bodyshop', 'Inventory Capture Master', 'Roles is typed as "DSvAdv, Driver". Should it be a multi-select from the roles of the system? Are DSvAdv and Driver the final codes?', 'Needed to link a section to roles in Roles & Access.'],
  ['Bodyshop', 'Inventory Capture Master', 'Acceptable Values is typed text ("OK, NOT OK, NA", "OK", "Count"). Which values are allowed, and is "Count" a different kind of checkpoint (a number to enter)?', 'A fixed list or a type is needed for the mobile app.'],
  ['Bodyshop', 'Inventory Capture Master', 'Some sub-section sequences and some checkpoint rows are blank. Are sequences mandatory? What decides the order when blank?', 'Order on the mobile screen.'],
  ['Bodyshop', 'Inventory Capture Master', 'Sections are listed once for PV and once for EV with the same content. Is a copy per BU needed, or should one row say "PV, EV"? The checkpoints table has no BU column: do they follow the BU of their section?', 'Avoids maintaining everything twice.'],
  ['Bodyshop', 'Inventory Capture Master', 'Service Type is on both tables (sections and checkpoints). Which one wins if they differ?', 'Needed to decide which checkpoints show for an accident job.'],
  ['Bodyshop', 'All', 'No duplicate-check key and no required fields are stated. Please give them (for example Section + BU + Service Type for sections).', 'The eQC masters have them; Bodyshop needs them too.'],
  ['Bodyshop', 'Insurance Document Collection - Customer', '"No. of Image Required" is blank for the PDF/Image row. What does PDF/Image mean for the count? Is Max 2 enforced?', 'Needed for the capture screen.'],
  ['Both', 'All', 'Who maintains these masters: TML Admin or Dealer Admin?', 'Decides who may edit them.'],
].forEach((q, i) => body(qs, [i + 1, q[0], q[1], q[2], q[3], ''], [6]));
qs.getColumn(6).eachCell({ includeEmpty: false }, (c, r) => { if (r > 1) c.fill = fill(YELLOW); });

const target = path.join(outDir, 'TML_eQC_Bodyshop_Master_Spec.xlsx');
await wb.xlsx.writeFile(target);
const nFields = Object.values(EQC_SPEC).reduce((n, m) => n + m.fields.length, 0) + BODYSHOP_PARTS.reduce((n, p) => n + p.fields.length, 0);
console.log(`spec written: ${Object.keys(EQC_SPEC).length + bsMasters.length} masters, ${nFields} fields, sample rows in file: ${Object.values(EQC_SAMPLE).flat().length}`);
