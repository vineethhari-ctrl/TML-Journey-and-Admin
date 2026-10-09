/** Renders the four diagrams of the masters backend design document to PNG (build/backend-doc/). Part of `npm run backend-doc`. */
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from '@playwright/test';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.resolve(here, '../../build/backend-doc');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1260, height: 1000 }, deviceScaleFactor: 2 });
await page.goto('file://' + path.join(here, 'diagrams.html'));
for (const id of ['d1', 'd2', 'd3', 'd4']) await page.locator('#' + id).screenshot({ path: path.join(out, `${id}.png`) });
await browser.close();
console.log('diagrams written to build/backend-doc');
