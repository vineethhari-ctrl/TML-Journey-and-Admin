import { test, expect, type Page } from '@playwright/test';
import { MASTER_COLLECTIONS } from '../src/data/masterCatalogue';
import { buildPublished } from '../src/utils/masterPublish';

/**
 * Sharing masters without a backend: Publish (admin saves published-masters.json, everybody gets it after deployment) and
 * Send changes (a BA exports only the rows he or she changed). Test data only.
 */
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
});

const key = MASTER_COLLECTIONS.find((m) => m.id === 'ppl_master')!.fields[1].key;
const edited = (note: string) =>
  MASTER_COLLECTIONS.map((m) => (m.id === 'ppl_master' ? { ...m, records: m.records.map((r, i) => (i === 0 ? { ...r, [key]: note } : r)) } : m));
const servePublished = async (page: Page, version: number, note: string) =>
  page.route('**/published-masters.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(buildPublished(edited(note), version, 'Vineeth Hari (test)', note, new Date('2026-10-09T08:00:00Z'))) })
  );

test('Publish: needs the test-data confirmation, then saves published-masters.json', async ({ page }) => {
  await page.goto('/#/admin/masters?open=common');
  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('menuitem', { name: /Publish all masters/ }).click();
  const dialog = page.getByTestId('publish-dialog');
  await expect(dialog.getByTestId('publish-version')).toHaveText('v1');
  const save = dialog.getByRole('button', { name: /Save published-masters\.json/ });
  await expect(save).toBeDisabled();
  await dialog.getByRole('checkbox').check();
  await expect(save).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent('download'), save.click()]);
  expect(download.suggestedFilename()).toBe('published-masters.json');
});

test('Send my changes: says so when there are none', async ({ page }) => {
  await page.goto('/#/admin/masters?open=common');
  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('menuitem', { name: /Send my changes/ }).click();
  await expect(page.getByTestId('no-changes')).toBeVisible();
  await expect(page.getByRole('button', { name: /Save changes as Excel/ })).toBeDisabled();
});

test('a browser with no changes of its own switches to the published masters silently', async ({ page }) => {
  await servePublished(page, 2, 'Published by admin');
  await page.goto('/#/admin/masters?open=common');
  await expect(page.getByTestId('published-chip')).toContainText('Published masters v2');
  await expect(page.getByTestId('published-banner')).toHaveCount(0);
});

test('a browser with changes of its own is asked first, can send them, and can then load the published masters', async ({ page }) => {
  await page.addInitScript((masters) => localStorage.setItem('tml_master_configs_v2', JSON.stringify(masters)), edited('My own change'));
  await servePublished(page, 1, 'Published by admin');
  await page.goto('/#/admin/masters?open=common');
  const banner = page.getByTestId('published-banner');
  await expect(banner).toContainText('v1');

  await banner.getByRole('button', { name: 'Send my changes first' }).click();
  const table = page.getByTestId('changes-table');
  await expect(table).toContainText('PPL');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Save changes as Excel/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^TML_Master_Changes_\d{4}-\d{2}-\d{2}\.xlsx$/);

  await banner.getByRole('button', { name: 'Load published masters' }).click();
  await expect(page.getByTestId('published-chip')).toContainText('Published masters v1');
  await expect(page.getByTestId('published-banner')).toHaveCount(0);
});
