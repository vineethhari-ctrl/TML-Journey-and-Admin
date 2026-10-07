import { test, expect } from '@playwright/test';

/**
 * Employee / Users and Roles & Access keep everything they had; they gain employee profile tabs (Employment,
 * Role & Views, Skills & Certificates), a Skills & Certificates matrix, Availability, and the Role Catalogue.
 */
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
});

test('existing Employee / Users tabs are still there, with the new ones beside them', async ({ page }) => {
  await page.goto('/#/admin/users');
  for (const name of [/Users/, /Employees/, /Pending/, /Suspended/, /Proficiency & LMS/, /Skills & Certificates/, /Availability/]) {
    await expect(page.getByRole('button', { name }).first()).toBeVisible();
  }
  // The list now shows designation / expertise and a skills badge
  await expect(page.locator('th', { hasText: 'Designation / Expertise' })).toBeVisible();
  await expect(page.getByTestId('designation-cell').first()).toBeVisible();
  // LMS tab still works
  await page.getByRole('button', { name: /Proficiency & LMS/ }).click();
  await expect(page.getByText('Progression Status')).toBeVisible();
});

test('employee profile: employment, role & views, skills and certificates; Service Advisor expertise is Mechanical / Bodyshop / Both', async ({ page }) => {
  await page.goto('/#/admin/users');
  await page.getByPlaceholder('Search user, ID, email...').fill('Priya Shinde'); // a Service Advisor
  await page.getByTitle('View user details').first().click();
  const drawerTab = (n: string) => page.getByTestId(`drawer-tab-${{ Employment: 'employment', 'Skills & Certificates': 'skills', 'Role & Views': 'roleviews' }[n]}`);
  await drawerTab('Employment').click();
  const expertise = page.getByTestId('expertise');
  await expect(expertise).toBeVisible();
  for (const x of ['Mechanical', 'Bodyshop', 'Both']) await expect(expertise.getByRole('radio', { name: new RegExp(`^${x}`) })).toBeVisible();
  await expertise.getByRole('radio', { name: /^Bodyshop/ }).check();
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Employee profile saved.')).toBeVisible();

  // Bodyshop expertise needs the Bodyshop advisory skill; it is shown as a gap until added
  await drawerTab('Skills & Certificates').click();
  await expect(page.getByTestId('skills-table')).toBeVisible();
  await expect(page.getByTestId('certs-table')).toBeVisible();
  await expect(page.getByTestId('gap-summary')).toBeVisible();

  await drawerTab('Role & Views').click();
  const views = page.getByTestId('role-views-tab');
  await expect(views).toContainText('Service Advisor');
  await expect(views).toContainText('Screens');
  await expect(views).toContainText('Worklist tabs');
});

test('skills matrix and availability', async ({ page }) => {
  await page.goto('/#/admin/users');
  await page.getByRole('button', { name: /Skills & Certificates/ }).first().click();
  const matrix = page.getByTestId('skills-matrix');
  await expect(matrix).toBeVisible();
  expect(await matrix.getByTestId('matrix-row').count()).toBeGreaterThan(10);
  await expect(page.getByTestId('cert-alerts')).toBeVisible();
  await page.getByLabel('Only people with gaps').check().catch(async () => page.getByText('Only people with gaps').click());
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export to Excel/ }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^TML_Skills_Matrix_/);

  await page.getByRole('button', { name: /^Availability/ }).click();
  await expect(page.getByTestId('availability-panel')).toBeVisible();
  const exp = page.getByTestId('advisor-expertise');
  for (const x of ['Mechanical', 'Bodyshop', 'Both']) await expect(exp).toContainText(x);
  await expect(page.getByTestId('availability-grid')).toContainText('Engine & Powertrain Repair');
  await page.getByLabel('Skill needed').selectOption({ label: 'HV Battery & Safety Isolation' });
  await expect(page.getByTestId('finder-results')).toBeVisible();
});

test('Roles & Position Types lists every role with its views and requirements; existing Roles & Access tabs remain', async ({ page }) => {
  await page.goto('/#/admin/roles');
  await expect(page.getByRole('button', { name: 'Permissions Matrix' })).toBeVisible();
  await page.getByRole('button', { name: /Roles & Position Types/ }).click();
  const cat = page.getByTestId('role-catalogue');
  await expect(cat).toBeVisible();
  for (const r of ['Super Administrator', 'Service Advisor', 'Receptionist', 'Security Guard', 'Driver', 'DGM', 'Dealer Admin', 'Technician', 'Master Technician', 'Quality Inspector', 'Paint Specialist', 'SPD Store Officer', 'Claims Manager', 'Read Only']) {
    await expect(cat.getByTestId('role-list').getByRole('button', { name: new RegExp(`^${r}`) }).first()).toBeVisible();
  }
  await cat.getByTestId('role-list').getByRole('button', { name: /^Service Advisor/ }).click();
  const d = cat.getByTestId('role-detail');
  await expect(d).toContainText('Expertise of the Service Advisors');
  await expect(d).toContainText('Mechanical:');
  await expect(d).toContainText('Bodyshop:');
  await expect(d).toContainText('Both:');
  await expect(d).toContainText('Worklist tabs');
  await expect(d).toContainText('Skill: Customer Handling');
  await cat.getByTestId('role-list').getByRole('button', { name: /^Paint Specialist/ }).click();
  await expect(d).toContainText('works in the dealer apps');
  await expect(d).toContainText('Certificate: Paint Technology Certified');
  const [dl] = await Promise.all([page.waitForEvent('download'), cat.getByRole('button', { name: /Export to Excel/ }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^TML_Role_Catalogue_/);
});
