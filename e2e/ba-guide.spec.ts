import { test, expect } from '@playwright/test';
import * as fs from 'fs';

/**
 * The in-app BA guide: reachable from the sidebar, its downloads work, and its
 * "10-minute practice" can be followed end-to-end with the downloaded file.
 */

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
});

test('BA guide is reachable, every download works, and the practice exercise succeeds', async ({ page }) => {
  await page.goto('/#/dashboard');
  await page.getByRole('button', { name: /BA Guide: Masters/ }).click();
  await expect(page.getByRole('heading', { name: /Adding Masters Without a Deployment/ })).toBeVisible();

  // Every file downloads and is a real .xlsx file (zip signature "PK")
  const files = ['TML_Smart_Excel_Template.xlsx', 'TML_Master_Definition_Template.xlsx', 'TML_Master_Practice_Workbook.xlsx', 'TML_Existing_Masters_Catalogue.xlsx'];
  const saved: Record<string, string> = {};
  for (const name of files) {
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: new RegExp(name.replace(/\./g, '\\.')) }).click();
    const d = await download;
    expect(d.suggestedFilename()).toBe(name);
    const p = await d.path();
    expect(fs.readFileSync(p!).subarray(0, 2).toString()).toBe('PK');
    saved[name] = p!;
  }

  // The picture of a good sheet is shown, and the Smart template imports cleanly as 2 masters
  await expect(page.getByTestId('smart-excel-picture')).toBeVisible();
  await page.getByRole('button', { name: 'Open Smart Excel Import' }).click();
  await page.getByLabel('BA Excel file').setInputFiles({
    name: 'TML_Smart_Excel_Template.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: fs.readFileSync(saved['TML_Smart_Excel_Template.xlsx']),
  });
  await expect(page.getByTestId('smart-import-notes')).toContainText('"README - How to fill" is a guide sheet');
  await expect(page.getByTestId('smart-draft')).toHaveCount(2);
  await expect(page.getByTestId('smart-draft').filter({ hasText: 'ready' })).toHaveCount(2);
  await page.keyboard.press('Escape');
  await page.goto('/#/admin/masters-guide');

  // Practice: open the import dialog from the guide and import the practice workbook
  await page.getByRole('button', { name: 'Open Import BA Workbook' }).click();
  await page.getByLabel('Master workbook file').setInputFiles({
    name: 'TML_Master_Practice_Workbook.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: fs.readFileSync(saved['TML_Master_Practice_Workbook.xlsx']),
  });
  await expect(page.getByText('SKIPPED', { exact: true })).toBeVisible();
  await page.getByLabel(/Update existing masters/).check();
  await page.getByRole('button', { name: /Import 2 Master\(s\)/ }).click();
  await expect(page.getByText(/Imported 1 new and 1 updated master/)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'MH01ZZ0001' })).toBeVisible();
});

test('guide is linked from the palette and blocked for roles without masters access', async ({ page }) => {
  await page.goto('/#/dashboard');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('guide');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/admin\/masters-guide$/);

  await page.locator('header select').selectOption('driver');
  await expect(page.getByText('Access Restricted')).toBeVisible();
});

test('guide covers Upload a Master, Lists of Values, Rules and shortcuts, with working practice files and links', async ({ page }) => {
  await page.goto('/#/admin/masters-guide');
  const nav = page.getByRole('navigation', { name: 'Guide contents' });
  for (const label of ['★ Easiest: Upload a Master', 'Common Masters & Lists of Values', 'Rules (no coding)', 'Shortcuts']) {
    await expect(nav.getByRole('button', { name: label })).toBeVisible();
  }
  await expect(page.locator('#upload')).toContainText('Nothing is saved until you press Import');
  await expect(page.locator('#upload')).toContainText('keep its id');
  await expect(page.locator('#common')).toContainText('BU is PV or EV');
  await expect(page.locator('#rules')).toContainText('No duplicates');
  await expect(page.locator('#rules')).toContainText('Allowed values depend on another field');
  await expect(page.locator('#shortcuts')).toContainText('Ctrl+B');
  await expect(page.locator('#shortcuts')).toContainText('Esc');

  // Practice files download as real .xlsx files
  for (const name of ['Sample_Upload_1_LOV_Correct.xlsx', 'Sample_Upload_2_LOV_WrongColumns.xlsx', 'Sample_Upload_3_NewMaster.xlsx']) {
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: new RegExp(name.replace(/\./g, '\\.')) }).click();
    const d = await download;
    expect(d.suggestedFilename()).toBe(name);
    expect(fs.readFileSync((await d.path())!).subarray(0, 2).toString()).toBe('PK');
  }

  // The header button opens the Upload page
  await page.getByRole('button', { name: 'Open Upload a Master' }).click();
  await expect(page).toHaveURL(/#\/admin\/upload-master$/);
  await expect(page.getByRole('heading', { name: 'Upload a Master' })).toBeVisible();
});
