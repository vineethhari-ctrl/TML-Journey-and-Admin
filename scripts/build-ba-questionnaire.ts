/**
 * The simple sheet for the BA leads (test data only):
 *   npm run ba-questionnaire   →   build/TML_BA_Master_Questionnaire_v2.xlsx
 * One row per master and TWO yes/no questions. The answer sheet works out the class (new ST master / CRM as it is / CRM + business control).
 * The masters the BA has confirmed (eQC, Bodyshop) are listed as the BA confirmed them; the other modules are the earlier draft list, for their BAs to correct. No portal / UI columns.
 */
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { MASTER_COLLECTIONS } from '../src/data/masterCatalogue';
import { draftClassification } from '../src/data/masterClassification';
import { CONFIRMED_BA_MASTERS } from '../src/data/confirmedBaMasters';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.join(root, 'build');
fs.mkdirSync(outDir, { recursive: true });

const guess = (id: string) => {
  const d = draftClassification({ id });
  return { B: 'New for ST: probably not in CRM', C: 'In CRM, and Business wants control (said in the 8 Oct mail)', A: 'Probably already in CRM', TBC: 'Not sure: may already be in CRM' }[d.masterClass];
};

const wb = new ExcelJS.Workbook();
const help = wb.addWorksheet('How to fill');
help.columns = [{ width: 120 }];
[
  ['TML Service Transformation: master list, 2 questions per master'],
  [],
  ['For every master in the sheet "Masters", answer the two yellow questions. Nothing else is needed.'],
  [],
  ['Question 1: Is this master already in CRM?   (Yes / No)'],
  ['   Yes = the data already lives in CRM, and CRM stays the source.   No = it is new for Service Transformation and will be kept in the ST Portal.'],
  [],
  ['Question 2: Does Business want to switch records on or off in ST?   (Yes / No)'],
  ['   Example: CRM has many PL / PPL models, but Business wants only some of them available in specific ST screens. Answer only if Q1 is Yes.'],
  [],
  ['The last column fills itself in with the result: "New ST master", "CRM master, used as it is" or "CRM master + business control".'],
  ['"Our guess" is only a starting point. Please correct it.'],
  ['Green = the BA has confirmed this master (eQC and Bodyshop files). Orange = still waiting for the BA: this is the earlier draft list, so please add masters that are missing and strike out the ones you do not need.'],
  [],
  ['Test data only. Nothing in this file is real Tata Motors data.'],
].forEach((r) => help.addRow(r));
help.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF002244' } };
help.getCell('A5').font = { bold: true };
help.getCell('A8').font = { bold: true };

const ws = wb.addWorksheet('Masters', { views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }] });
const heads = ['Module', 'Master', 'Status of the master list', 'Our guess', 'Q1. Already in CRM?', 'Q2. Business wants to switch records on / off in ST?', 'How will ST read it from CRM?', 'Remarks', 'Result (fills itself)'];
ws.columns = [{ width: 22 }, { width: 46 }, { width: 30 }, { width: 40 }, { width: 18 }, { width: 28 }, { width: 22 }, { width: 36 }, { width: 38 }];
const header = ws.addRow(heads);
header.height = 34;
header.eachCell((c, col) => {
  c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col >= 5 && col <= 8 ? 'FFB45309' : 'FF002244' } };
  c.alignment = { wrapText: true, vertical: 'middle' };
});

interface Line { module: string; master: string; status: string; guessText: string }
const lines: Line[] = [];
// 1. The masters the BA has confirmed, exactly as confirmed (eQC, Bodyshop)
CONFIRMED_BA_MASTERS.forEach((c) => lines.push({ module: c.module, master: c.name, status: 'Confirmed by BA', guessText: 'New for ST: probably not in CRM' }));
// 2. Everything the other BAs have not shared yet: the earlier draft list, for them to correct
const confirmedIds = new Set(CONFIRMED_BA_MASTERS.flatMap((c) => c.portalMasterIds));
const confirmedModules = new Set(CONFIRMED_BA_MASTERS.flatMap((c) => c.moduleCodes));
MASTER_COLLECTIONS.filter((m) => !confirmedIds.has(m.id) && !confirmedModules.has(m.moduleCode))
  .sort((a, b) => a.moduleName.localeCompare(b.moduleName) || a.name.localeCompare(b.name))
  .forEach((m) => lines.push({ module: m.moduleName, master: m.name, status: 'Waiting for BA', guessText: guess(m.id) }));

const COLOUR: Record<string, string> = { 'Confirmed by BA': 'FFD1FAE5', 'Waiting for BA': 'FFFFEDD5' };
lines.forEach((l) => {
  const row = ws.addRow([l.module, l.master, l.status, l.guessText, '', '', '', '', '']);
  const r = row.number;
  row.getCell(9).value = { formula: `IF(E${r}="","",IF(E${r}="No","New ST master",IF(F${r}="Yes","CRM master + business control","CRM master, used as it is")))`, result: '' };
  row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOUR[l.status] } };
  row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
  for (const col of [5, 6, 7, 8]) row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
  row.getCell(5).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] };
  row.getCell(6).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] };
  row.getCell(7).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Solar,API,Not sure"'] };
  row.alignment = { vertical: 'top', wrapText: true };
});
ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: heads.length } };

const targets = [path.join(outDir, 'TML_BA_Master_Questionnaire_v2.xlsx')];
if (fs.existsSync(path.join(outDir, 'master-pack'))) targets.push(path.join(outDir, 'master-pack', 'TML_BA_Master_Questionnaire_v2.xlsx'));
await Promise.all(targets.map((t) => wb.xlsx.writeFile(t)));
console.log(`questionnaire written: ${lines.length} rows, ${CONFIRMED_BA_MASTERS.length} confirmed by BA, ${lines.length - CONFIRMED_BA_MASTERS.length} waiting for their BAs`);
