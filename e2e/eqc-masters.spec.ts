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
  await page.goto('/#/admin/masters?open=eqc');
  const tester = page.getByTestId('eqc-rule-tester');
  await expect(tester).toBeVisible();
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
