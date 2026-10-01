import { test, expect, Page } from '@playwright/test';

/**
 * Bay governance across roles:
 *  - dealer adds a bay beyond the TML allocation → email with deep link → TML Network Manager approves
 *  - dealer requests inactivation → bell notification → TML Admin rejects with a note
 */

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
});

const openBayConsole = async (page: Page) => {
  await page.goto('/#/admin/masters?open=bays');
  await expect(page.getByText(/Bay governance — acting as/)).toBeVisible();
};
const bayRow = (page: Page, id: string) => page.locator(`[data-bay-id="${id}"]`);

test('additional bay beyond allocation: dealer request → email link → Network Manager approves → bay goes live', async ({ page }) => {
  await openBayConsole(page);
  await page.getByRole('button', { name: 'Dealer Admin', exact: true }).click();

  await page.getByRole('button', { name: /New Bay/ }).click();
  const form = page.getByRole('form', { name: 'Add bay' });
  await form.getByLabel(/Bay Name/).fill('Fleet Service Bay 03');
  await form.getByLabel('BU').selectOption('CV');
  await form.getByLabel('Bay Type').selectOption('Fleet');
  // Allocation CV/Fleet = 2, 1 used → first one is within allocation
  await expect(form.getByTestId('allocation-check')).toContainText('1 of 2 used');
  await form.getByLabel('BU').selectOption('PV');
  await expect(form.getByTestId('allocation-check')).toContainText('0 of 0 used');
  await form.getByLabel(/Justification/).fill('Second shift for corporate fleet contract');
  await form.getByRole('button', { name: 'Send for Approval' }).click();

  const email = page.getByTestId('email-preview');
  await expect(email).toContainText('network.manager@tatamotors.com');
  await expect(email).toContainText('Fleet Service Bay 03');
  const link = (await email.locator('pre').innerText()).match(/https?:\/\/\S+#\/admin\/bay-approvals\?request=\S+/)![0];

  // Approver opens the email link (fresh navigation, as from an email client)
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Bay Approvals' })).toBeVisible();
  const card = page.locator(`[data-request-id="${link.split('request=')[1]}"]`);
  await expect(card).toContainText('ADDITIONAL BAY');
  await expect(card).toContainText('0 allocated');
  await card.getByRole('button', { name: 'Approve' }).click();
  // Arrived via the email link, so the decided request stays in view with its outcome
  await expect(card).toContainText('APPROVED by');
  await expect(page.getByRole('button', { name: /^Pending \(/ })).toHaveText('Pending (1)'); // only the seeded request left

  // Back in the console the bay is live
  await openBayConsole(page);
  const row = page.locator('[data-bay-id]', { hasText: 'Fleet Service Bay 03' });
  await expect(row).toContainText('Active');
  await expect(row).toContainText('Approved');
});

test('dealer inactivation → bell notification → TML Admin rejects with a note → bay stays active', async ({ page }) => {
  // Log in as the Dealer Admin role
  await page.goto('/#/dashboard');
  await page.locator('header select').selectOption('dealerAdmin');
  await expect(page.getByRole('button', { name: /Bay Approvals/ })).toHaveCount(0); // not visible to dealers
  await openBayConsole(page);
  await expect(page.getByRole('button', { name: 'TML Admin', exact: true })).toBeDisabled();

  await bayRow(page, 'BAY-06').getByRole('button', { name: /Inactivate/ }).click();
  await page.getByLabel(/Reason/).selectOption('Manpower shortage');
  await page.getByRole('button', { name: 'Send for Approval' }).click();
  await expect(page.getByTestId('email-preview')).toContainText('tml.admin.support@tatamotors.com');
  await page.getByRole('button', { name: /Done/ }).click();
  await expect(bayRow(page, 'BAY-06')).toContainText('Status change pending');

  // Switch to the TML side and use the notification bell
  await page.locator('header select').selectOption('superAdmin');
  await page.getByTitle('Notifications').click();
  await page.getByText('Bay status change awaiting approval').first().click();
  await expect(page).toHaveURL(/#\/admin\/bay-approvals\?request=/);

  const card = page.locator('[data-request-id]', { hasText: 'Speedo Express Bay 01' });
  await card.getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByText('Please give a reason for rejecting.')).toBeVisible();
  await card.getByLabel(/Decision note/).fill('Bay needed for festive season load');
  await card.getByRole('button', { name: 'Reject' }).click();

  await openBayConsole(page);
  await expect(bayRow(page, 'BAY-06')).toContainText('Active');
  await expect(page.getByTestId('bay-requests')).toContainText('Bay needed for festive season load');
});

test('TML Admin sets an allocation and the dealer can then add within it', async ({ page }) => {
  await openBayConsole(page);
  await page.getByRole('button', { name: 'TML Admin', exact: true }).click();
  const alloc = page.getByTestId('bay-allocations');
  await alloc.getByLabel('New allocation BU').selectOption('PV');
  await alloc.getByLabel('New allocation bay type').selectOption('Electrical');
  await alloc.getByLabel('New allocation count').fill('2');
  await alloc.getByRole('button', { name: '+ Set allocation' }).click();
  await expect(alloc.locator('tbody tr', { hasText: 'Electrical' }).first()).toContainText('2');

  await page.getByRole('button', { name: 'Dealer Admin', exact: true }).click();
  await page.getByRole('button', { name: /New Bay/ }).click();
  const form = page.getByRole('form', { name: 'Add bay' });
  await form.getByLabel(/Bay Name/).fill('Electrical Bay 02');
  await form.getByLabel('Bay Type').selectOption('Electrical');
  await expect(form.getByTestId('allocation-check')).toContainText('0 of 2 used');
  await form.getByRole('button', { name: 'Add Bay' }).click();
  await expect(page.locator('[data-bay-id]', { hasText: 'Electrical Bay 02' })).toContainText('Active');
});
