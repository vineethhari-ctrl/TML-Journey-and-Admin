import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
});

test('Service Advisor: landing tab, More (n), tab and column preferences persist, DPDP masking and vehicle renders', async ({ page }) => {
  await page.goto('/#/workshop');
  await page.locator('header select').selectOption('serviceAdvisor');
  const tabs = page.getByTestId('workshop-tabs');

  // TASK-01: SA preset lands on My Assignment; 3 hidden + 1 extra tab collapse into More (4) with badges kept
  await expect(page.getByTestId('grid-title')).toContainText('My Assignment · 3 vehicles');
  await tabs.getByRole('button', { name: /More \(4\)/ }).click();
  await expect(page.getByRole('menuitem', { name: /THD.*\(hidden\).*1/ })).toBeVisible();
  await page.keyboard.press('Escape');

  // Customise: a minimum of 2 visible tabs is enforced; the landing tab is saved
  await tabs.getByRole('button', { name: 'Customise tabs' }).click();
  const customizer = page.getByTestId('tab-customizer');
  for (const name of ['Pre Inspection', 'Pending Estimate Approvals', 'My Active Job Cards', 'MR Details']) await customizer.getByLabel(name, { exact: true }).uncheck();
  const gateIn = customizer.getByLabel("Today's Total Gate-In", { exact: true });
  await gateIn.click();
  await expect(customizer.getByRole('alert')).toContainText('At least 2 tabs must stay visible');
  await expect(gateIn).toBeChecked();
  await customizer.getByRole('button', { name: "Open Today's Total Gate-In first" }).click();
  await page.reload();
  await expect(page.getByTestId('grid-title')).toContainText("Today's Total Gate-In · 5 vehicles");

  // TASK-03: lean gate-in columns, customer columns in the hidden pool; choice persists
  const grid = page.getByTestId('worklist-grid');
  await expect(grid.locator('thead th')).toHaveText(['Vehicle No', 'Model', 'Assigned SA', 'Status', 'Waiting Time', 'Action']);
  await page.getByRole('button', { name: 'Choose columns' }).click();
  await page.getByTestId('column-customizer').getByLabel('Mobile', { exact: true }).check();
  await page.reload();
  await expect(grid.locator('thead th')).toHaveText(['Vehicle No', 'Model', 'Assigned SA', 'Status', 'Waiting Time', 'Mobile', 'Action']);

  // TASK-02: phone masked, CTI call does not reveal it; reveal is allowed for SA and audited
  const firstPhone = grid.getByTestId('masked-phone-value').first();
  await expect(firstPhone).toHaveText('******3540');
  await grid.getByRole('button', { name: 'Call customer of MH12TS0001' }).click();
  await expect(page.getByText('Calling the customer of MH12TS0001 through CTI')).toBeVisible();
  await expect(firstPhone).toHaveText('******3540');
  await grid.getByRole('button', { name: 'Show mobile number' }).first().click();
  await expect(firstPhone).toHaveText('+91 90000 13540');

  // Reset to Default restores the lean preset
  await page.getByRole('button', { name: 'Choose columns' }).click();
  await page.getByTestId('column-customizer').getByRole('button', { name: 'Reset to Default' }).click();
  await expect(grid.locator('thead th')).toHaveCount(6);

  // Names on My Assignment: full for the assigned SA (all rows are theirs)
  await tabs.getByRole('tab', { name: /My Assignment/ }).click();
  await expect(grid.getByTestId('masked-name').first()).toHaveText('Test Customer Alpha');

  // TASK-04: exact colour render, hero-shade fallback, generic silhouette without a VC
  await grid.getByRole('button', { name: /MH12TS0001/ }).first().click();
  const card = page.getByTestId('vehicle-info-card');
  await expect(card.getByTestId('vehicle-render-card')).toHaveAttribute('data-state', 'image');
  await expect(card.locator('img')).toHaveAttribute('src', /nexon\/xz-lux\/daytona-grey_front_three_quarter\.webp$/);
  await expect(card).toContainText('XZ+ Lux · Daytona Grey');
  await grid.getByRole('button', { name: /MH12TS0002/ }).first().click();
  await expect(card.locator('img')).toHaveAttribute('src', /flame-red_front_three_quarter\.webp$/);
  await expect(card.getByTestId('vehicle-render-card')).toHaveAttribute('data-state', 'image');
  await grid.getByRole('button', { name: /MH12TS0005/ }).first().click();
  await expect(card.getByTestId('vehicle-render-card')).toHaveAttribute('data-state', 'silhouette');

  // A re-render (role switch) must not drop loaded images back to the loading wireframe
  await grid.getByRole('button', { name: /MH12TS0001/ }).first().click();
  await expect(card.getByTestId('vehicle-render-card')).toHaveAttribute('data-state', 'image');
  await page.locator('header select').selectOption('dgm');
  await expect(card.getByTestId('vehicle-render-card')).toHaveAttribute('data-state', 'image');
  await expect(page.getByTestId('vehicle-render-thumb').first()).toHaveAttribute('data-state', 'image');
});

test('Receptionist: names masked to initials, no reveal button, export masked; reveal is audited for a supervisor', async ({ page }) => {
  await page.goto('/#/workshop');
  await page.locator('header select').selectOption('receptionist');
  await expect(page.getByTestId('dpdp-status')).toContainText('PII masked for your role');
  await page.getByTestId('workshop-tabs').getByRole('tab', { name: /My Assignment/ }).click();
  const grid = page.getByTestId('worklist-grid');
  await expect(grid.getByTestId('masked-name').first()).toHaveText('T*** C*** A***');
  await expect(grid.getByRole('button', { name: 'Show customer name' })).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const csv = await (await download).createReadStream();
  let text = '';
  for await (const chunk of csv) text += chunk;
  expect(text).toContain('T*** C*** A***');
  expect(text).toContain('******3540');
  expect(text).not.toContain('Test Customer Alpha');

  // Super admin reveals → UNMASK_PII row in the audit log, without the value
  await page.locator('header select').selectOption('superAdmin');
  await page.getByTestId('workshop-tabs').getByRole('tab', { name: /My Assignment/ }).click();
  await grid.getByRole('button', { name: 'Show customer name' }).first().click();
  await expect(grid.getByTestId('masked-name').first()).toContainText('Test Customer Alpha');
  await page.goto('/#/admin/audit');
  const row = page.locator('tr', { hasText: 'UNMASK_PII' }).first();
  await expect(row).toContainText('MH12TS0001');
  await expect(row).not.toContainText('Test Customer Alpha');
});

test('Journey search masks customer mobile numbers', async ({ page }) => {
  await page.goto('/#/journey');
  const phones = page.getByTestId('masked-phone-value');
  await expect(phones.first()).toHaveText(/^\*{6}\d{4}$/);
});
