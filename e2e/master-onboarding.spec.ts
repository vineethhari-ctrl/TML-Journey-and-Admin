import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';

/**
 * End-to-end: masters missed during requirements can be added on the fly —
 * either one at a time with "Create New Master", or many at once from the BA
 * workbook — and are immediately usable (records, dealer app), with no deployment.
 */

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
});

test('"Create New Master" defines a master that is immediately usable and exposed to dealers', async ({ page }) => {
  await page.goto('/#/admin/masters');
  await page.getByRole('button', { name: 'Create New Master' }).click();

  const form = page.getByRole('form', { name: 'Create new master' });
  await form.getByLabel('Master Name').fill('Tyre Brand');
  await expect(form.getByLabel('Master ID')).toHaveValue('tyre_brand_master');
  await form.getByLabel('Logical Group').selectOption('Parts, Claims & Support');
  await form.getByLabel('Service Module').selectOption('bodyshop');

  // Field 1: mandatory text
  await form.getByLabel('Field Label').first().fill('Brand Name');
  await form.getByLabel('Field 1 mandatory').check();

  // Field 2: dropdown exposed to the dealer Vehicle Journey screen
  await form.getByRole('button', { name: 'Add Field' }).click();
  const f2 = page.getByTestId('cm-field-1');
  await f2.getByLabel('Field Label').fill('Tyre Segment');
  await f2.getByLabel('Type').selectOption('select');
  await f2.getByLabel('Options (comma separated)').fill('PV, EV, CV');
  await f2.getByRole('checkbox', { name: 'Show in Dealer App' }).check();
  await f2.getByLabel('Dealer screen').selectOption('vehicle_journey');

  await form.getByRole('button', { name: 'Create Master' }).click();
  await expect(page.getByText(/Master "Tyre Brand" created/)).toBeVisible();

  // The new master opens in the workspace; add a record through the normal editor
  await expect(page.getByRole('button', { name: /^Tyre Brand\s*0$/ })).toBeVisible();
  await page.getByRole('button', { name: /\+ Add Row/ }).click();
  await page.getByPlaceholder('Enter Brand Name').fill('MRF Tyres');
  await page.getByRole('button', { name: 'Insert Row' }).click();
  await expect(page.getByRole('cell', { name: 'MRF Tyres' })).toBeVisible();

  // Survives a reload and shows up on the dealer journey page
  await page.goto('/#/journey/JC20260930001234');
  await expect(page.locator('[data-master-field="tyre_segment"]')).toContainText('Tyre Segment');

  // Audit trail records the creation
  await page.goto('/#/admin/audit?search=tyre_brand_master');
  await expect(page.locator('tbody').getByText('Master Created').first()).toBeVisible();
});

test('"Create New Master" blocks invalid definitions with clear messages', async ({ page }) => {
  await page.goto('/#/admin/masters');
  await page.getByRole('button', { name: 'Create New Master' }).click();
  const form = page.getByRole('form', { name: 'Create new master' });
  await form.getByLabel('Master Name').fill('PPL Duplicate');
  await form.getByLabel('Master ID').fill('ppl_master'); // already exists
  await form.getByLabel('Field Label').first().fill('Grade');
  await form.getByLabel('Type').first().selectOption('select');
  await form.getByLabel('Options (comma separated)').fill('A'); // only one option
  await form.getByRole('button', { name: 'Create Master' }).click();
  const alert = form.getByRole('alert');
  await expect(alert).toContainText('already exists');
  await expect(alert).toContainText('at least 2 options');
});

/** Builds a workbook the way a BA would fill it in Excel. */
function baWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Master ID', 'Master Name', 'Module Code', 'Logical Group', 'Owner', 'Category', 'Description'],
      ['courtesy_car_master', 'Courtesy Car Master', 'reception', 'Service Operations', 'DEALER_ADMIN', 'Mobility', 'Loaner cars'],
      ['ppl_master', 'PPL & PL (Product Line) Master', 'jc_creation', 'Vehicle Data', 'TML_ADMIN', '', ''],
    ]),
    'Masters'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Master ID', 'Field Key', 'Field Label', 'Type', 'Mandatory', 'Options', 'Min', 'Max', 'Min Date', 'Max Date', 'Pattern', 'Pattern Error Message', 'Show in Dealer App', 'Dealer Target Module', 'Dealer Label', 'Value Mapping', 'Description'],
      ['courtesy_car_master', 'reg_no', 'Registration No', 'text', 'Y', '', '', '', '', '', '', '', 'N', '', '', '', ''],
      ['courtesy_car_master', 'fuel', 'Fuel', 'select', 'Y', 'EV, Petrol', '', '', '', '', '', '', 'N', '', '', '', ''],
      ['courtesy_car_master', 'max_days', 'Max Days', 'number', 'N', '', '1', '7', '', '', '', '', 'N', '', '', '', ''],
      // A field that was missed in an existing master
      ['ppl_master', 'adas_level', 'ADAS Level', 'select', 'N', 'L0, L1, L2', '', '', '', '', '', '', 'N', '', '', '', ''],
    ]),
    'Fields'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['id', 'Registration No', 'Fuel', 'Max Days'],
      ['CC-1', 'MH01ZZ0001', 'EV', '3'],
      ['CC-2', 'MH01ZZ0002', 'Petrol', '5'],
    ]),
    'courtesy_car_master'
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['id', 'adas_level'], ['PPL-01', 'L2']]), 'ppl_master');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}

test('BA workbook import creates new masters and fills a missed field in an existing one', async ({ page }) => {
  await page.goto('/#/admin/masters');
  await page.getByRole('button', { name: 'Import BA Workbook' }).click();

  // Template download works
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Template' }).click();
  expect((await download).suggestedFilename()).toBe('TML_Master_Definition_Template.xlsx');

  await page.getByLabel('Master workbook file').setInputFiles({
    name: 'BA_Reception_Masters.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: baWorkbook(),
  });

  // Default "skip existing": the new master is created, ppl_master skipped
  await expect(page.getByRole('cell', { name: /Courtesy Car Master/ })).toBeVisible();
  await expect(page.getByText('SKIPPED', { exact: true })).toBeVisible();

  // Switch to update mode to also add the missed ADAS field to the PPL master
  await page.getByLabel(/Update existing masters/).check();
  await expect(page.getByText('UPDATE', { exact: true })).toBeVisible();
  await expect(page.getByText(/Ready: 2 master\(s\) will be imported/)).toBeVisible();
  await page.getByRole('button', { name: /Import 2 Master\(s\)/ }).click();
  await expect(page.getByText(/Imported 1 new and 1 updated master/)).toBeVisible();

  // New master is open with its rows
  await expect(page.getByRole('cell', { name: 'MH01ZZ0001' })).toBeVisible();

  // Existing master gained the field, with the value for PPL-01
  await page.getByRole('button', { name: /Vehicle & Pr/ }).first().click();
  await page.getByRole('button', { name: /^PPL & PL \(Product Line\) Master/ }).click();
  await expect(page.locator('thead').getByText('ADAS Level')).toBeVisible();
  await expect(page.locator('tbody tr', { hasText: 'PPL-NEXON-EV' })).toContainText('L2');
});

test('BA workbook with mistakes is rejected with row-level errors and nothing is imported', async ({ page }) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Master ID', 'Master Name', 'Module Code', 'Logical Group', 'Owner'],
      ['loaner_master', 'Loaner', 'reception', 'Service Operations', 'DEALER_ADMIN'],
    ]),
    'Masters'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Master ID', 'Field Key', 'Field Label', 'Type', 'Mandatory', 'Min', 'Max'],
      ['loaner_master', 'days', 'Days', 'number', 'Y', '1', '7'],
    ]),
    'Fields'
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['id', 'days'], ['L1', '30']]), 'loaner_master');

  await page.goto('/#/admin/masters');
  await page.getByRole('button', { name: 'Import BA Workbook' }).click();
  await page.getByLabel('Master workbook file').setInputFiles({
    name: 'bad.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer,
  });
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('loaner_master row 2');
  await expect(alert).toContainText('cannot be greater than 7');
  await expect(page.getByRole('button', { name: /^Import \d+ Master/ })).toBeDisabled();
});
