import { test, expect, Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
});

const asRole = async (page: Page, role: string, route = '/#/workshop') => {
  await page.goto(route);
  await page.locator('header select').selectOption(role);
};

test('Service Advisor: landing tab, More (n), tab and column preferences persist, DPDP masking and vehicle renders', async ({ page }) => {
  await asRole(page, 'serviceAdvisor');
  const tabs = page.getByTestId('workshop-tabs');

  // TASK-01: SA preset lands on My Assignment; the 3 hidden tabs sit under More (3) with their counts
  await expect(page.getByTestId('grid-title')).toContainText('My Assignment · 3 vehicles');
  await tabs.getByRole('button', { name: /More \(3\)/ }).click();
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
  await expect(page.getByTestId('grid-title')).toContainText("Today's Gate-In · 3 vehicles");

  // TASK-03: lean gate-in columns; Phone No. comes from the hidden pool and the choice persists
  const grid = page.getByTestId('worklist-grid');
  await expect(grid.locator('thead th')).toHaveText(['Vehicle No.', 'Model', 'Assigned SA', 'Status', 'Waiting Time (HH:MM)', 'Action']);
  await page.getByRole('button', { name: 'Columns displayed' }).click();
  await page.getByTestId('column-customizer').getByLabel('Phone No.', { exact: true }).check();
  await page.reload();
  await expect(grid.locator('thead th')).toHaveText(['Vehicle No.', 'Model', 'Assigned SA', 'Status', 'Waiting Time (HH:MM)', 'Phone No.', 'Action']);

  // TASK-02: phone masked, CTI call does not reveal it; reveal is allowed for SA and audited
  const firstPhone = grid.getByTestId('masked-phone-value').first();
  await expect(firstPhone).toHaveText('******3540');
  await grid.getByRole('button', { name: 'Call customer of MH12TS0001' }).click();
  await expect(page.getByText('Calling the customer of MH12TS0001 through CTI')).toBeVisible();
  await expect(firstPhone).toHaveText('******3540');
  await grid.getByRole('button', { name: 'Show mobile number' }).first().click();
  await expect(firstPhone).toHaveText('+91 90000 13540');

  // Filter bar: Walk-In switch, BU and phone search (matches the full number, shows it masked)
  await page.getByRole('button', { name: 'Walk-In' }).click();
  await expect(page.getByTestId('grid-title')).toContainText("Today's Gate-In · 2 vehicles");
  await page.getByRole('button', { name: 'EV', exact: true }).click();
  await expect(page.getByTestId('grid-title')).toContainText('· 1 vehicles');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByLabel('Phone No.').fill('44120');
  await expect(grid.locator('tbody tr')).toHaveCount(1);
  await expect(grid.getByTestId('masked-phone-value')).toHaveText('******4120');
  await page.getByLabel('Phone No.').fill('');
  await page.getByRole('button', { name: 'Appointments' }).click();

  // Reset to Default restores the lean preset
  await page.getByRole('button', { name: 'Columns displayed' }).click();
  await page.getByTestId('column-customizer').getByRole('button', { name: 'Reset to Default' }).click();
  await expect(grid.locator('thead th')).toHaveCount(6);

  // Names on My Assignment: full for the assigned SA
  await tabs.getByRole('tab', { name: /My Assignment/ }).click();
  await expect(grid.getByTestId('masked-name').first()).toHaveText('Test Customer Alpha');

  // MR Details grid has its own lean columns (the user hid that tab, so it is under More)
  await tabs.getByRole('button', { name: /More \(\d\)/ }).click();
  await page.getByRole('menuitem', { name: /MR Details/ }).click();
  await expect(grid.locator('thead th')).toHaveText(['Action', 'Request ID', 'JC No.', 'Vehicle No.', 'Status', 'Stage Ageing DD:HH:MM', 'Assigned To']);
  await tabs.getByRole('tab', { name: /Gate-In/ }).click();

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

test('Receptionist: only allowed tabs, names masked, no reveal, masked export; supervisor reveal shows in the DPDP access log', async ({ page }) => {
  await asRole(page, 'receptionist');
  const tabs = page.getByTestId('workshop-tabs');
  await expect(page.getByTestId('dpdp-status')).toContainText('PII masked for your role');
  await expect(tabs.getByRole('tab')).toHaveCount(3);
  await expect(tabs.getByRole('button', { name: /More/ })).toHaveCount(0);

  const grid = page.getByTestId('worklist-grid');
  await page.getByRole('button', { name: 'Columns displayed' }).click();
  await page.getByTestId('column-customizer').getByLabel('Customer Name', { exact: true }).check();
  await page.mouse.click(5, 5);
  await expect(grid.getByTestId('masked-name').first()).toHaveText('T*** C*** A***');
  await expect(grid.getByRole('button', { name: 'Show customer name' })).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  let text = '';
  for await (const chunk of await (await download).createReadStream()) text += chunk;
  expect(text).toContain('T*** C*** A***');
  expect(text).not.toContain('Test Customer Alpha');

  // Super admin reveals → UNMASK_PII in the DPDP access log, without the value
  await page.locator('header select').selectOption('superAdmin');
  await page.getByRole('button', { name: 'Columns displayed' }).click();
  await page.getByTestId('column-customizer').getByLabel('Customer Name', { exact: true }).check();
  await page.mouse.click(5, 5);
  await grid.getByRole('button', { name: 'Show customer name' }).first().click();
  await expect(grid.getByTestId('masked-name').first()).toContainText('Test Customer Alpha');
  await page.goto('/#/admin/audit');
  await page.getByRole('button', { name: 'DPDP access log' }).click();
  const row = page.locator('tr', { hasText: 'UNMASK_PII' }).first();
  await expect(row).toContainText('MH12TS0001');
  await expect(row).not.toContainText('Test Customer Alpha');
});

test('Admin sets which tabs and default columns a role gets', async ({ page }) => {
  await asRole(page, 'superAdmin', '/#/admin/workshop-policy');
  const policy = page.getByTestId('workshop-policy');
  // Service Advisor: tabs hidden by default are still listed (allowed, not visible by default)
  await expect(policy.getByLabel('Allow THD')).toBeChecked();
  await expect(policy.getByLabel('Show THD by default')).not.toBeChecked();
  await page.getByLabel('Role').selectOption('receptionist');
  await policy.getByLabel('Allow Pre Inspection').uncheck();
  await policy.getByLabel('Allow THD').check();
  await policy.getByLabel("Today's Total Gate-In: Customer Name").check();
  await page.getByRole('button', { name: 'Save for this role' }).click();
  await expect(page.getByText('Saved default views for Receptionist')).toBeVisible();

  await page.goto('/#/workshop');
  await page.locator('header select').selectOption('receptionist');
  const tabs = page.getByTestId('workshop-tabs');
  await expect(tabs.getByRole('tab', { name: /THD/ })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: /Pre Inspection/ })).toHaveCount(0);
  await expect(page.getByTestId('worklist-grid').locator('thead th')).toContainText(['Customer Name']);

  // Restore the built-in default
  await page.locator('header select').selectOption('superAdmin');
  await page.goto('/#/admin/workshop-policy');
  await page.getByLabel('Role').selectOption('receptionist');
  await page.getByRole('button', { name: 'Restore built-in default' }).click();
  await expect(policy.getByLabel('Allow Pre Inspection')).toBeChecked();
});

test('Journey search masks customer mobile numbers', async ({ page }) => {
  await page.goto('/#/journey');
  await expect(page.getByTestId('masked-phone-value').first()).toHaveText(/^\*{6}\d{4}$/);
});
