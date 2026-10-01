/**
 * Regenerates the BA Excel files in docs/templates:
 *   npm run templates
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildTemplateWorkbook, buildPracticeWorkbook, buildMasterWorkbook, workbookToArrayBuffer, PROTECTED_MASTER_IDS } from '../src/utils/masterWorkbook';
import { MASTER_COLLECTIONS } from '../src/data/masterCatalogue';

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
