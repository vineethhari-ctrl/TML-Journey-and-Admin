import { test, expect, Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
});

const logout = async (page: Page) => {
  await page.locator('header').getByRole('button', { name: /Vikramaditya|Vineeth|Pooja/ }).click();
  await page.getByRole('button', { name: /Logout/ }).click();
};

test('Home cards: role default, user hides and reorders, survives reload, back to default after logout', async ({ page }) => {
  await page.goto('/#/home');
  await page.locator('header select').selectOption('serviceAdvisor');
  const cards = page.locator('[data-testid^="portal-card-"]');
  // SA default: JC Creation first, Security Guard hidden (11 of 12)
  await expect(cards).toHaveCount(11);
  await expect(cards.first()).toHaveAttribute('data-testid', 'portal-card-jc_creation');

  await page.getByRole('button', { name: 'Customise cards' }).click();
  const panel = page.getByTestId('card-customizer');
  await panel.getByLabel('SPD', { exact: true }).uncheck();
  await panel.getByRole('button', { name: 'Move JC Tracking up' }).click();
  await page.mouse.click(5, 5);
  await expect(cards).toHaveCount(10);
  await expect(cards.first()).toHaveAttribute('data-testid', 'portal-card-jc_tracking');
  await expect(page.getByTestId('portal-card-spd')).toHaveCount(0);

  // Kept while the session lasts
  await page.reload();
  await expect(cards).toHaveCount(10);
  await expect(page.getByTestId('home-toolbar')).toContainText('resets to the default view when you log out');

  // Worklist columns are personal too, and also reset at logout
  await page.goto('/#/workshop');
  await page.getByRole('button', { name: 'Columns displayed' }).click();
  await page.getByTestId('column-customizer').getByLabel('Visitor Type', { exact: true }).check();
  await page.mouse.click(5, 5);
  await expect(page.getByTestId('worklist-grid').locator('thead th')).toContainText(['Visitor Type']);

  await logout(page);
  await expect(page.getByText('back to the default view')).toBeVisible();
  await expect(page.getByTestId('worklist-grid').locator('thead th')).not.toContainText(['Visitor Type']);
  await page.goto('/#/home');
  await expect(cards).toHaveCount(11);
  await expect(cards.first()).toHaveAttribute('data-testid', 'portal-card-jc_creation');

  // Cards open the matching screen
  await page.getByTestId('portal-card-customer_journey').click();
  await expect(page).toHaveURL(/#\/journey$/);
});

test('TML admin sets default cards and Journey fields; dealers personalise but cannot change defaults', async ({ page }) => {
  await page.goto('/#/admin/workshop-policy');
  await page.locator('header select').selectOption('superAdmin');
  await expect(page.getByTestId('personalisation-setting')).toContainText('log back in, they see these defaults again');
  await expect(page.getByLabel('Keep personal layouts after logout')).toHaveCount(0);
  await page.getByLabel('Role').selectOption('securityGuard');
  await page.getByTestId('card-policy').getByLabel('Allow card Appointment Reminder').check();
  await page.getByLabel('TML Journey · Journey Search: Last Updated').check();
  await page.getByRole('button', { name: 'Save for this role' }).click();
  await expect(page.getByText('Saved default views for Security Guard')).toBeVisible();

  await page.goto('/#/home');
  await page.locator('header select').selectOption('securityGuard');
  await expect(page.locator('[data-testid^="portal-card-"]')).toHaveCount(3);
  await page.goto('/#/journey');
  await expect(page.getByTestId('journey-results').locator('thead th')).toContainText(['Last Updated']);

  // Dealer Admin personalises but cannot change the defaults
  await page.locator('header select').selectOption('dealerAdmin');
  await page.goto('/#/admin/workshop-policy');
  await expect(page.getByText('Access Restricted')).toBeVisible();
  await expect(page.locator('aside').getByRole('button', { name: 'Default Views' })).toHaveCount(0);
});

test('Journey Search: lean default columns and "Columns displayed"', async ({ page }) => {
  await page.goto('/#/journey');
  const head = page.getByTestId('journey-results').locator('thead th');
  await expect(head).toHaveText(['Vehicle', 'Customer', 'JC Number', 'Current Stage', 'Status', 'Action']);
  await page.getByRole('button', { name: 'Columns displayed' }).click();
  await page.getByTestId('column-customizer').getByLabel('Dealer & Workshop', { exact: true }).check();
  await page.getByTestId('column-customizer').getByLabel('Customer', { exact: true }).uncheck();
  await expect(head).toHaveText(['Vehicle', 'JC Number', 'Current Stage', 'Status', 'Dealer & Workshop', 'Action']);
  await page.getByTestId('column-customizer').getByRole('button', { name: 'Reset to Default' }).click();
  await expect(head).toHaveCount(6);
});
