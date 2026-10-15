/** Renders the diagrams of the backend design documents to PNG (build/backend-doc/). Part of `npm run backend-doc`.
 *  diagrams.html → d1–d4 (part 2, masters); diagrams_platform.html → p1–p4 (part 3, platform). */
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from '@playwright/test';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.resolve(here, '../../build/backend-doc');
fs.mkdirSync(out, { recursive: true });
const pages: [string, string[]][] = [
  ['diagrams.html', ['d1', 'd2', 'd3', 'd4']],
  ['diagrams_platform.html', ['p1', 'p2', 'p3', 'p4']],
];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1260, height: 1000 }, deviceScaleFactor: 2 });
for (const [file, ids] of pages) {
  await page.goto('file://' + path.join(here, file));
  for (const id of ids) await page.locator('#' + id).screenshot({ path: path.join(out, `${id}.png`) });
}
await browser.close();
console.log('diagrams written to build/backend-doc');
