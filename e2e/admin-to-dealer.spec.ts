import { test, expect, Page, Locator } from '@playwright/test';

/**
 * End-to-end: configuration made in the Admin portal (Masters Maintenance /
 * Rules Engine Studio) must show up and behave correctly on the dealer-facing
 * screens (Vehicle Journey page and the Dealer App Preview simulator).
 *
 * Each test runs in a fresh browser context, so localStorage starts empty.
 */

const DEMO_JOURNEY = '/#/journey/JC20260930001234';

/** Form controls in the admin screens sit right after their <label>. */
const fieldAfterLabel = (scope: Page | Locator, label: string) =>
  scope.locator('label', { hasText: label }).first().locator('xpath=following-sibling::*[1]');

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
});

test('a custom master field with value mapping appears on the dealer Vehicle Journey page', async ({ page }) => {
  await page.goto('/#/admin/masters');
  await page.getByRole('button', { name: /JC Creation- Mechanical/ }).first().click();

  // Admin: add a dropdown parameter to the default master, exposed to the dealer app
  await page.getByRole('button', { name: '+ Add Custom Parameter' }).click();
  await page.getByPlaceholder('e.g. Failure Root Cause / Approval Date').fill('Service Package');
  await fieldAfterLabel(page, 'Data Type').selectOption('select');
  await page.getByPlaceholder('Option A, Option B, Option C').fill('BASIC, PREMIUM');
  await page.getByPlaceholder('Must match one of the dropdown options above').fill('PREMIUM');
  await expect(page.getByRole('checkbox', { name: 'Expose to Dealer App' })).toBeChecked();
  await page.getByPlaceholder('Raw Code (e.g. Y, GOLD)').first().fill('PREMIUM');
  await page.getByPlaceholder('Dealer Display (e.g. Active Protection)').first().fill('Premium Care Plan');
  await page.getByRole('button', { name: 'Add Field to Schema' }).click();
  await expect(page.getByText(/Added custom parameter "Service Package"/)).toBeVisible();

  // Dealer: the field is rendered with its mapped display value and raw code
  await page.goto(DEMO_JOURNEY);
  const card = page.locator('[data-master-field="service_package"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Service Package');
  await expect(card).toContainText('Premium Care Plan');
  await expect(card).toContainText('Raw: PREMIUM');

  // Persists across a reload (same browser)
  await page.reload();
  await expect(page.locator('[data-master-field="service_package"]')).toContainText('Premium Care Plan');
});

test('a Rules Engine field with required + range validation is enforced on the dealer page', async ({ page }) => {
  await page.goto('/#/admin/masters');
  await page.getByRole('button', { name: /Rules Engine Studio/ }).first().click();

  // Admin: create a numeric, mandatory rule with a 0–500000 range for the Vehicle Journey screen
  await page.getByRole('button', { name: '+ Add New Rule' }).click();
  await fieldAfterLabel(page, 'Internal Key').fill('odometer_reading');
  await fieldAfterLabel(page, 'Admin Display Label').fill('Odometer Reading');
  await fieldAfterLabel(page, 'Dealer Display Label').fill('Odometer (km)');
  await fieldAfterLabel(page, 'Widget Type').selectOption('number');
  await fieldAfterLabel(page, 'Target Dealer Module').selectOption('vehicle_journey');
  await page.getByRole('checkbox', { name: /Strictly Mandatory/ }).check();
  await fieldAfterLabel(page, 'Min Value').fill('0');
  await fieldAfterLabel(page, 'Max Value').fill('500000');
  await page.getByRole('button', { name: /Save & Deploy to Dealer App/ }).first().click();

  // Dealer: the field appears on the Vehicle Journey page and validates input
  await page.goto(DEMO_JOURNEY);
  await page.getByRole('button', { name: /Rules Engine Dynamic Fields/ }).click();
  const field = page.locator('[data-field-key="odometer_reading"]').first();
  await expect(field).toBeVisible();
  await expect(field).toContainText('Odometer (km)');
  const input = field.locator('input');

  await expect(field).toContainText(/required/i); // empty mandatory field

  await input.fill('600000');
  await expect(field).toContainText(/cannot exceed 500000/);

  await input.fill('25000');
  await expect(field.locator('.text-rose-600')).toHaveCount(0);
});

test('Dealer App Preview applies show/hide logic per vehicle and blocks publishing with errors', async ({ page }) => {
  await page.goto('/#/admin/masters');
  await page.getByRole('button', { name: /Dealer App Preview/ }).first().click();

  const evField = page.locator('[data-field-key="ev_battery_health_soh"]');
  const claimField = page.locator('[data-field-key="insurance_claim_number"]');

  // EV vehicle: EV battery fields visible
  await page.getByRole('button', { name: /Tata Nexon EV Max/ }).click();
  await expect(evField.first()).toBeVisible();

  // Diesel bodyshop-claim vehicle: EV fields hidden, insurance claim field shown
  await page.getByRole('button', { name: /Tata Safari 2\.0L/ }).click();
  await expect(evField).toHaveCount(0);
  await expect(claimField.first()).toBeVisible();

  // Faulty data: errors shown and publishing is refused
  await page.getByRole('button', { name: /Nexon EV Max/ }).click();
  await page.getByRole('button', { name: /Inject Validation Errors/ }).click();
  await expect(page.getByText(/ERRORS DETECTED/)).toBeVisible();
  await page.getByRole('button', { name: /Publish to Live Dealers/ }).click();
  await expect(page.getByText(/Fix \d+ validation error\(s\)/)).toBeVisible();

  // Clean data: ready to deploy and publishing succeeds
  await page.getByRole('button', { name: /Reset Baseline/ }).click();
  await expect(page.getByText('READY TO DEPLOY')).toBeVisible();
  await page.getByRole('button', { name: /Publish to Live Dealers/ }).click();
  await expect(page.getByText(/published live to PAN-India dealer application/)).toBeVisible();
});
