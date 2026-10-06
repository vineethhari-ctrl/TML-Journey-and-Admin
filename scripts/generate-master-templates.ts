/**
 * Regenerates the BA Excel files in docs/templates:
 *   npm run templates
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildTemplateWorkbook, buildPracticeWorkbook, buildMasterWorkbook, workbookToArrayBuffer, PROTECTED_MASTER_IDS } from '../src/utils/masterWorkbook';
import { MASTER_COLLECTIONS } from '../src/data/masterCatalogue';
import { buildSmartExcelTemplate } from './smart-excel-template';
import * as XLSX from 'xlsx';
import { buildMasterTemplate } from '../src/utils/masterUpload';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// docs/templates: for the repo; public/downloads: served by the app at <site>/downloads/<file>
const outDirs = ['docs/templates', 'public/downloads'];
outDirs.forEach((d) => fs.mkdirSync(path.join(root, d), { recursive: true }));

const write = (name: string, buf: ArrayBuffer) => {
  outDirs.forEach((d) => {
    fs.writeFileSync(path.join(root, d, name), Buffer.from(buf));
    console.log(`wrote ${d}/${name}`);
  });
};

write('TML_Master_Definition_Template.xlsx', workbookToArrayBuffer(buildTemplateWorkbook()));
write('TML_Master_Practice_Workbook.xlsx', workbookToArrayBuffer(buildPracticeWorkbook()));
write(
  'TML_Existing_Masters_Catalogue.xlsx',
  workbookToArrayBuffer(buildMasterWorkbook(MASTER_COLLECTIONS.filter((m) => !PROTECTED_MASTER_IDS.includes(m.id))))
);

// Practice files for "Upload a Master" (test data): a correct List of Values file, the same file with wrong columns, and a new master
{
  const lov = MASTER_COLLECTIONS.find((m) => m.id === 'common_lov')!;
  const labels = lov.fields.map((f) => f.label);
  const row = (o: Record<string, string | number>) => lov.fields.map((f) => o[f.label] ?? '');
  const good = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    good,
    XLSX.utils.aoa_to_sheet([
      labels,
      row({ 'LOV Type (Parameter)': 'THD_ABC', Module: 'THD', 'Field Name': 'ABC', 'Display Value': '1', Order: 1, Status: 'Active' }),
      row({ 'LOV Type (Parameter)': 'THD_ABC', Module: 'THD', 'Field Name': 'ABC', 'Display Value': '2', Order: 2, Status: 'Active' }),
      row({ 'LOV Type (Parameter)': 'THD_ABC', Module: 'THD', 'Field Name': 'ABC', 'Display Value': '3', Order: 3, Status: 'Active' }),
    ]),
    'common_lov'
  );
  write('Sample_Upload_1_LOV_Correct.xlsx', workbookToArrayBuffer(good));
  const bad = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(bad, XLSX.utils.aoa_to_sheet([['List Name', 'Value', 'Sequence'], ['THD_ABC', '1', 1], ['THD_ABC', '2', 2]]), 'common_lov');
  write('Sample_Upload_2_LOV_WrongColumns.xlsx', workbookToArrayBuffer(bad));
  const fresh = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    fresh,
    XLSX.utils.aoa_to_sheet([['Brand', 'Warranty Months', 'Approved'], ['Test Tyres A', 36, 'Y'], ['Test Tyres B', 24, 'Y'], ['Test Tyres C', 12, 'N']]),
    'Tyre Brands'
  );
  write('Sample_Upload_3_NewMaster.xlsx', workbookToArrayBuffer(fresh));
  void buildMasterTemplate;
}

// Visual, colour-coded template for "Smart Excel Import" (styles need ExcelJS; SheetJS CE can't write them)
buildSmartExcelTemplate().then((buf) => write('TML_Smart_Excel_Template.xlsx', buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer));
