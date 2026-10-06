import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
});

test('Fleet flag: TML admin uploads chassis numbers, Journey shows Fleet / Individual, privilege can be granted', async ({ page }) => {
  await page.goto('/#/journey/JC20260930001234');
  await page.locator('header select').selectOption('superAdmin');
  const badge = page.getByTestId('customer-category').first();
  await expect(badge).toHaveAttribute('data-category', 'INDIVIDUAL');

  await page.goto('/#/admin/fleet');
  await expect(page.getByTestId('fleet-assumptions')).toContainText('BA has not given more detail');
  await expect(page.getByTestId('fleet-count')).toHaveText('4');
  await expect(page.getByTestId('fleet-today')).toHaveText('3'); // one seeded row has expired

  const csv = 'Chassis No,Fleet Account,Valid From,Valid To,Active (Y/N),Remarks\nMAT624009K1234567,Test E2E Fleet,01-01-2026,,Y,\nBADCHASSIS,X,,,Y,\n';
  await page.getByTestId('fleet-file').setInputFiles({ name: 'fleet.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  const preview = page.getByTestId('fleet-preview');
  await expect(preview).toContainText('1 row(s) ready, 1 row(s) with errors will be skipped');
  await expect(preview).toContainText('17 letters');
  await preview.getByRole('button', { name: 'Save 1 vehicle(s)' }).click();
  await expect(page.getByTestId('fleet-count')).toHaveText('5');

  await page.getByLabel('Chassis No to check').fill('mat624009k1234567');
  await expect(page.getByTestId('fleet-check-result')).toContainText('Fleet (Test E2E Fleet)');

  await page.goto('/#/journey/JC20260930001234');
  await expect(badge).toHaveAttribute('data-category', 'FLEET');
  await expect(badge).toContainText('Test E2E Fleet');

  // Deactivating makes it Individual again; the change is audited
  await page.goto('/#/admin/fleet');
  await page.locator('tr[data-chassis="MAT624009K1234567"]').getByRole('button', { name: 'Deactivate' }).click();
  await page.goto('/#/journey/JC20260930001234');
  await expect(badge).toHaveAttribute('data-category', 'INDIVIDUAL');
  await page.goto('/#/admin/audit');
  await expect(page.locator('table').first()).toContainText('Fleet Vehicle Deactivated');

  // Dealer Admin: view only until the TML admin grants the privilege
  await page.goto('/#/admin/fleet');
  await page.locator('header select').selectOption('dealerAdmin');
  await expect(page.getByTestId('fleet-no-privilege')).toBeVisible();
  await expect(page.getByTestId('fleet-privilege')).toHaveCount(0);
  await page.locator('header select').selectOption('superAdmin');
  await page.getByTestId('fleet-privilege').getByLabel('Dealer Admin').check();
  await page.locator('header select').selectOption('dealerAdmin');
  await expect(page.getByTestId('fleet-upload')).toBeVisible();
});

test('ID chain: Appointment → Visit → SR → Pre-JC → JC with MRs and customer updates; any ID finds the JC', async ({ page }) => {
  await page.goto('/#/journey/JC20260930001234');
  await page.locator('header select').selectOption('superAdmin');
  await expect(page.getByTestId('id-chain-strip')).toContainText('APT-2026-99120');
  await page.getByTestId('id-chain-strip').click();

  const chain = page.getByTestId('id-chain');
  for (const kind of ['APPOINTMENT', 'VISIT', 'SR', 'PRE_JC', 'JC']) {
    await expect(chain.getByTestId(`id-link-${kind}`)).toHaveAttribute('data-status', 'CREATED');
  }
  await expect(chain.getByTestId('id-chain-check')).toHaveText(/Chain consistent/);
  await expect(chain.getByTestId('id-chain-mrs')).toContainText('MR-');
  await expect(chain.getByTestId('id-chain-updates')).toContainText('Job card opened');
  await expect(chain.getByTestId('id-chain-assumptions')).toBeVisible();

  const srId = (await chain.getByTestId('id-link-SR').locator('.font-mono').innerText()).trim();
  expect(srId).toMatch(/^SR-/);

  await page.goto('/#/journey');
  const box = page.getByPlaceholder(/Appointment \/ SR \/ MR ID/);
  await box.fill(srId);
  await expect(page.getByText('Detected: Appointment / Visit / SR / Pre-JC / MR ID')).toBeVisible();
  await box.press('Enter');
  const table = page.locator('table').filter({ hasText: 'JC Number' }).first();
  await expect(table.locator('tbody tr')).toHaveCount(1);
  await expect(table).toContainText('JC20260930001234');
});
