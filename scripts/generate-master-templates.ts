/**
 * Regenerates the BA Excel files in docs/templates:
 *   npm run templates
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildTemplateWorkbook, buildMasterWorkbook, workbookToArrayBuffer, PROTECTED_MASTER_IDS } from '../src/utils/masterWorkbook';
import { MASTER_COLLECTIONS } from '../src/data/masterCatalogue';

const outDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../docs/templates');
fs.mkdirSync(outDir, { recursive: true });

const write = (name: string, buf: ArrayBuffer) => {
  fs.writeFileSync(path.join(outDir, name), Buffer.from(buf));
  console.log(`wrote docs/templates/${name}`);
};

write('TML_Master_Definition_Template.xlsx', workbookToArrayBuffer(buildTemplateWorkbook()));
write(
  'TML_Existing_Masters_Catalogue.xlsx',
  workbookToArrayBuffer(buildMasterWorkbook(MASTER_COLLECTIONS.filter((m) => !PROTECTED_MASTER_IDS.includes(m.id))))
);
