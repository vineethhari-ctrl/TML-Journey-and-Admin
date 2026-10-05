import { test, expect } from '@playwright/test';

test('THD masters: rule tester raises cases from the BA rules and cascades progress sub-statuses', async ({ page }) => {
  await page.goto('/#/admin/masters');
  await page.getByRole('button', { name: /^THD Technical Help Desk/ }).first().click();
  await page.getByRole('button', { name: /^THD Auto-Trigger Rules/ }).click();

  const tester = page.getByTestId('thd-rule-tester');
  await expect(tester).toBeVisible();
  await expect(tester.getByTestId('thd-health')).toHaveText('Configuration OK');
  // X, Y and the PPL of critical complaint E32 are pending from business
  await expect(tester.getByTestId('thd-pending')).toHaveText('3 item(s) pending from business');
  await expect(tester).toContainText('E32 is in the Critical Complaints master but has no PPL yet');
  await expect(tester.getByTestId('thd-fired')).toContainText('No THD case is raised.');

  // Unattended for more than 24 h → rule 8 goes to Tech Executive L1
  await tester.getByLabel('THD unattended for (hours)').fill('25');
  await expect(tester.getByTestId('thd-fired')).toContainText('Tech Executive L1');

  // Delay reason without Y → shown as pending, not raised
  await tester.getByLabel('JC open for (hours)').fill('50');
  await tester.getByLabel('JC delay reason').selectOption('Under Investigation');
  await expect(tester.getByTestId('thd-fired')).toContainText('Rule 4');
  await expect(tester.getByTestId('thd-fired')).toContainText('pending from business');

  // Progress → sub-status cascade
  await tester.getByLabel('Progress', { exact: true }).selectOption('Pending for parts');
  await expect(tester.getByLabel('Progress sub-status').locator('option')).toHaveText(['Order status', 'Part receipt status']);
});
