import { test, expect } from '@playwright/test';

/**
 * Electronic Quality Check masters: a BA tests the rules for a vehicle,
 * then adds a PPL-specific rule and sees it take effect immediately.
 */

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
});

test('EQC rule tester resolves GC mandate, steps, PTD risk, DID and checklists for a vehicle', async ({ page }) => {
  // Reachable from the sidebar on any page
  await page.goto('/#/dashboard');
  await page.getByRole('button', { name: /EQC Masters/ }).first().click();
  await expect(page).toHaveURL(/open=eqc/);
  const tester = page.getByTestId('eqc-rule-tester');
  await expect(tester).toBeVisible();
  await expect(page.getByRole('button', { name: /Guided Check & Road Test Mandate Master/ })).toBeVisible();
  await expect(page.getByTestId('eqc-health')).toHaveText('Configuration OK');

  await tester.getByLabel('BU').selectOption('EV');
  await tester.getByLabel('PPL').selectOption('Nexon EV');
  await tester.getByLabel('Complaint Code').fill('BAT-SOC-03');
  await tester.getByLabel('Job date').fill('2026-10-01');
  await expect(page.getByTestId('eqc-result-mandate')).toContainText('GC mandatory: Yes');
  await expect(page.getByTestId('eqc-result-mandate')).toContainText('Nexon EV-specific rule');
  await expect(page.getByTestId('eqc-result-steps')).toContainText('Read HV battery SOC');

  // Another EV falls back to the all-PPL rule
  await tester.getByLabel('PPL').selectOption('Tiago EV');
  await expect(page.getByTestId('eqc-result-mandate')).toContainText('GC mandatory: No');
  await expect(page.getByTestId('eqc-result-mandate')).toContainText('All-PPL rule');

  await tester.getByLabel('PTD hours left').fill('0');
  await tester.getByLabel('PTD minutes left').fill('30');
  await expect(page.getByTestId('eqc-result-ptd')).toHaveText('Red');
  await tester.getByLabel('PTD hours left').fill('1');
  await expect(page.getByTestId('eqc-result-ptd')).toHaveText('Orange');

  await tester.getByLabel('DID parameter').selectOption('HV Battery SOC');
  await tester.getByLabel('Scanned value').fill('22');
  await expect(page.getByTestId('eqc-result-did')).toContainText('NOT OK'); // Tiago EV needs >=25

  await tester.getByLabel('Odometer (Km)').fill('20000');
  await expect(page.getByTestId('eqc-result-general')).toContainText('HV connector seals');
  await expect(page.getByTestId('eqc-result-schedule')).toContainText('Battery pack mounting bolts torque');
});

test('BA adds a PPL-specific GC rule; duplicates and invalid combinations are blocked', async ({ page }) => {
  await page.goto('/#/admin/masters?open=eqc');
  const addRule = async (values: Record<string, string>) => {
    await page.getByRole('button', { name: '+ Add Row' }).click();
    for (const [label, value] of Object.entries(values)) {
      const field = page.locator(`#rec-field-${label}`);
      if ((await field.evaluate((el) => el.tagName)) === 'SELECT') await field.selectOption(value);
      else await field.fill(value);
    }
    await page.getByRole('button', { name: 'Insert Row' }).click();
  };

  // GC Mandatory without GC Applicable is rejected
  await addRule({ ppl: 'Harrier', complaintCode: 'AC-COOL-04', gcApplicable: 'N', gcMandatory: 'Y', roadTestMandatory: 'Y', active: 'Y' });
  await expect(page.getByText('GC can only be mandatory when GC Applicable is Y.')).toBeVisible();
  await page.locator('#rec-field-gcApplicable').selectOption('Y');
  await page.getByRole('button', { name: 'Insert Row' }).click();
  await expect(page.getByRole('button', { name: 'Insert Row' })).toHaveCount(0);

  const tester = page.getByTestId('eqc-rule-tester');
  await tester.getByLabel('PPL').selectOption('Harrier');
  await tester.getByLabel('Complaint Code').fill('AC-COOL-04');
  await expect(page.getByTestId('eqc-result-mandate')).toContainText('GC mandatory: Yes');
  await expect(page.getByTestId('eqc-result-mandate')).toContainText('Harrier-specific rule');
  await expect(page.getByTestId('eqc-result-steps')).toContainText('vent outlet temperature'); // all-PPL steps

  // The same PPL + complaint again is a duplicate
  await addRule({ ppl: 'Harrier', complaintCode: 'AC-COOL-04', gcApplicable: 'Y', gcMandatory: 'N', roadTestMandatory: 'N', active: 'Y' });
  await expect(page.getByText(/A rule for Harrier \+ AC-COOL-04 already exists/)).toBeVisible();
});

test('sidebar "EQC Masters" brings the EQC group back after browsing another group', async ({ page }) => {
  await page.goto('/#/admin/masters?open=eqc');
  await expect(page.getByTestId('eqc-rule-tester')).toBeVisible();
  await page.getByRole('button', { name: /Vehicle & Product Data/ }).click();
  await expect(page.getByTestId('eqc-rule-tester')).toHaveCount(0);
  await page.locator('aside').getByRole('button', { name: /EQC Masters/ }).click();
  await expect(page.getByTestId('eqc-rule-tester')).toBeVisible();
});

test('Bodyshop masters from the BA Excel: preview per role/job, Excel gaps flagged, fixing a gap clears it', async ({ page }) => {
  await page.goto('/#/dashboard');
  await page.locator('aside').getByRole('button', { name: /Bodyshop Masters/ }).click();
  const preview = page.getByTestId('bodyshop-preview');
  await expect(preview).toBeVisible();

  // Accident job, DSvAdv: Documents first (insurance copy + police report), Internal (3) before External (4)
  const capture = page.getByTestId('bodyshop-capture');
  await expect(capture.locator('[data-section="Documents"]')).toContainText('Police Complaint Report');
  const order = await capture.locator('[data-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-section')));
  expect(order.slice(0, 4)).toEqual(['Documents', 'Accident Details', 'Internal', 'External']);
  await expect(capture.locator('[data-section="Internal"]')).toContainText('Horn Working');
  await expect(page.getByTestId('bodyshop-docs')).toContainText('Police Complaint Report');
  await expect(page.getByTestId('bodyshop-docs')).not.toContainText('Insurance Copy'); // inactive in the Excel

  // General job hides accident-only items
  await preview.getByLabel('Job type').selectOption('General');
  await expect(capture.locator('[data-section="Accident Details"]')).toHaveCount(0);
  await expect(capture.locator('[data-section="Documents"]')).not.toContainText('Police Complaint Report');

  // Gaps from the Excel are listed
  const issues = page.getByTestId('bodyshop-issues');
  await expect(issues).toContainText('Section "Internal-Accessories" is not in the Sections master');
  await expect(issues).toContainText("BSC-10 (Owner's Manual): Section is blank");

  // BA fixes Owner's Manual in the Checkpoints master → that gap disappears
  await page.getByRole('button', { name: /Inventory Capture Master — Checkpoints/ }).click();
  await page.locator('tr', { hasText: "Owner's Manual" }).getByTitle('Edit Row').click();
  await page.locator('#rec-field-section').fill('Accessories');
  await page.locator('#rec-field-serviceType').selectOption('All');
  await page.getByRole('button', { name: 'Update Row' }).click();
  await expect(issues).not.toContainText("BSC-10 (Owner's Manual)");
  await preview.getByLabel('Role').selectOption('Driver');
  await expect(capture.locator('[data-section="Accessories"]')).toContainText("Owner's Manual");
});
