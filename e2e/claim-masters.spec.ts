import { test, expect } from '@playwright/test';

test('Claims masters: approval routing by amount and goodwill category from the BA mapping', async ({ page }) => {
  await page.goto('/#/admin/masters');
  await page.getByRole('button', { name: /^Auth\. Request Approval/ }).first().click();
  await page.getByRole('button', { name: /^AMC \/ Warranty Authorization Approval Matrix/ }).click();

  const tester = page.getByTestId('claim-rule-tester');
  await expect(tester.getByTestId('claim-health')).toHaveText('Configuration OK');
  await expect(tester.getByTestId('claim-pending')).toHaveText('2 item(s) pending from business');

  // ₹20,000 → Claim Manager approves (limit is inclusive)
  await tester.getByLabel('Request amount (₹)').fill('20000');
  await expect(tester.getByTestId('claim-route')).toContainText('Claim Manager');
  await expect(tester.getByTestId('claim-route')).toContainText('Approves');
  await expect(tester.getByTestId('claim-gap')).toHaveCount(0);

  // ₹20,001 → Claim Manager and CCM/ACCM forward; SHQ Lead 1 approves
  await tester.getByLabel('Request amount (₹)').fill('20001');
  await expect(tester.getByTestId('claim-route').locator('li')).toHaveCount(3);
  await expect(tester.getByTestId('claim-route').locator('li').last()).toContainText('SHQ Lead 1');
  await expect(tester.getByTestId('claim-route').locator('li').last()).toContainText('Approves');
  await expect(tester.getByTestId('claim-gap')).toHaveCount(0);

  // Goodwill category
  await tester.getByLabel('Issue Description').selectOption('Thermal Incident');
  await expect(tester.getByTestId('claim-category')).toContainText('Red · Catastrophic Situation');
  await tester.getByLabel('Issue Description').selectOption('Engine Failure');
  await expect(tester.getByTestId('claim-category')).toContainText('Amber · Minor Product Failure');

  // The empty guideline master opens without errors
  await page.getByRole('button', { name: /^AMC \/ EW Service Guideline File Master/ }).click();
  await expect(tester).toBeVisible();
});
