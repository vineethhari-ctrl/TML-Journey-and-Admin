/**
 * The simple sheet for the BA leads (test data only):
 *   npm run ba-questionnaire   →   build/TML_BA_Master_Questionnaire.xlsx
 * One row per master and TWO yes/no questions. The answer sheet works out the class (new ST master / CRM as it is / CRM + business control).
 * The masters the BA has confirmed (eQC, Bodyshop) are listed as the BA confirmed them, with whether the portal has them yet.
 */
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { MASTER_COLLECTIONS } from '../src/data/masterCatalogue';
import { draftClassification } from '../src/data/masterClassification';
import { CONFIRMED_BA_MASTERS, baStatusOf } from '../src/data/confirmedBaMasters';

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
  ['Green = the BA has confirmed this master (eQC and Bodyshop files). Orange = still waiting for the BA. Grey = only in the prototype, not in the BA\'s confirmed file.'],
  [],
  ['Test data only. Nothing in this file is real Tata Motors data.'],
].forEach((r) => help.addRow(r));
help.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF002244' } };
help.getCell('A5').font = { bold: true };
help.getCell('A8').font = { bold: true };

const ws = wb.addWorksheet('Masters', { views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }] });
const heads = ['Module', 'Master', 'Status of the master list', 'In the portal today?', 'Our guess', 'Q1. Already in CRM?', 'Q2. Business wants to switch records on / off in ST?', 'How will ST read it from CRM?', 'Remarks', 'Result (fills itself)'];
ws.columns = [{ width: 22 }, { width: 46 }, { width: 30 }, { width: 40 }, { width: 40 }, { width: 18 }, { width: 28 }, { width: 22 }, { width: 36 }, { width: 38 }];
const header = ws.addRow(heads);
header.height = 34;
header.eachCell((c, col) => {
  c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col >= 6 && col <= 9 ? 'FFB45309' : 'FF002244' } };
  c.alignment = { wrapText: true, vertical: 'middle' };
});

interface Line { module: string; master: string; status: string; inPortal: string; guessText: string }
const byId = new Map(MASTER_COLLECTIONS.map((m) => [m.id, m]));
const lines: Line[] = [];
// 1. The masters the BA has confirmed, exactly as confirmed
CONFIRMED_BA_MASTERS.forEach((c) => {
  const have = c.portalMasterIds.map((id) => byId.get(id)?.name).filter(Boolean) as string[];
  lines.push({ module: c.module, master: c.name, status: 'Confirmed by BA', inPortal: have.length ? `Yes: ${have.join(' + ')}` : 'Not yet: to be added to the portal', guessText: 'New for ST: probably not in CRM' });
});
// 2. Masters of the prototype that are not in the BA's confirmed file, then everything the BAs have not shared yet
const confirmedIds = new Set(CONFIRMED_BA_MASTERS.flatMap((c) => c.portalMasterIds));
const rest = MASTER_COLLECTIONS.filter((m) => !confirmedIds.has(m.id)).sort((a, b) => baStatusOf(a).localeCompare(baStatusOf(b)) || a.moduleName.localeCompare(b.moduleName) || a.name.localeCompare(b.name));
rest.forEach((m) => lines.push({ module: m.moduleName, master: m.name, status: baStatusOf(m), inPortal: 'Yes (prototype master)', guessText: guess(m.id) }));

const COLOUR: Record<string, string> = { 'Confirmed by BA': 'FFD1FAE5', 'Waiting for BA': 'FFFFEDD5', 'In the prototype only (not in the BA file)': 'FFE5E7EB' };
lines.forEach((l) => {
  const row = ws.addRow([l.module, l.master, l.status, l.inPortal, l.guessText, '', '', '', '', '']);
  const r = row.number;
  row.getCell(10).value = { formula: `IF(F${r}="","",IF(F${r}="No","New ST master",IF(G${r}="Yes","CRM master + business control","CRM master, used as it is")))`, result: '' };
  row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOUR[l.status] } };
  row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: l.inPortal.startsWith('Not yet') ? 'FFFECACA' : 'FFFFFFFF' } };
  row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
  for (const col of [6, 7, 8, 9]) row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
  row.getCell(6).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] };
  row.getCell(7).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] };
  row.getCell(8).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Solar,API,Not sure"'] };
  row.alignment = { vertical: 'top', wrapText: true };
});
ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: heads.length } };

const targets = [path.join(outDir, 'TML_BA_Master_Questionnaire.xlsx')];
if (fs.existsSync(path.join(outDir, 'master-pack'))) targets.push(path.join(outDir, 'master-pack', 'TML_BA_Master_Questionnaire.xlsx'));
await Promise.all(targets.map((t) => wb.xlsx.writeFile(t)));
console.log(`questionnaire written: ${lines.length} rows, ${CONFIRMED_BA_MASTERS.length} confirmed by BA, ${CONFIRMED_BA_MASTERS.filter((c) => !c.portalMasterIds.length).length} of them not in the portal yet`);
