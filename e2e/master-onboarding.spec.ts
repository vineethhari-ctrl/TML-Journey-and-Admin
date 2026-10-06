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
  await f2.getByLabel('Options (comma separated)').fill('PV, EV');
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
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('menuitem', { name: /Import BA Workbook/ }).click();

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

  // Existing master gained the field, with the value for PPL-01 (PPL is a Common Master)
  await page.getByRole('button', { name: /^Common Masters/ }).first().click();
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
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('menuitem', { name: /Import BA Workbook/ }).click();
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

test('List of Values screen (Siebel style): pick a type, add / reorder / retire values, create a new type', async ({ page }) => {
  await page.goto('/#/admin/masters?open=common');
  const lov = page.getByTestId('lov-explorer');
  await expect(lov.getByRole('button', { name: 'All lists OK' })).toBeVisible();
  const types = lov.getByTestId('lov-type-list');

  // Find a type and open it
  await lov.getByPlaceholder('Find type, field or value').fill('closure');
  await types.getByRole('button', { name: /THD_CLOSURE_ACTION/ }).click();
  const grid = lov.getByTestId('lov-values');
  await expect(grid.getByRole('textbox', { name: 'Display Value' })).toHaveCount(3);

  // New value, code proposed from the display value; move it to the top; retire another
  await lov.getByRole('button', { name: 'New Value' }).click();
  await grid.getByRole('textbox', { name: 'Display Value' }).last().fill('Closed by Plant');
  await grid.getByRole('button', { name: 'Move Closed by Plant up' }).click();
  await grid.getByRole('checkbox', { name: 'Closed With Early Warning active' }).uncheck();
  await lov.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('THD_CLOSURE_ACTION saved (4 values).')).toBeVisible();
  const values = grid.getByRole('textbox', { name: 'Display Value' });
  await expect(values.nth(2)).toHaveValue('Closed by Plant');
  await expect(grid.getByRole('textbox', { name: 'Code (LIC)' }).nth(2)).toHaveValue('CLOSED_BY_PLANT');

  // A duplicate is refused with the cell highlighted
  await lov.getByRole('button', { name: 'New Value' }).click();
  await values.last().fill('closed');
  await lov.getByRole('button', { name: 'Save' }).click();
  await expect(grid.getByText(/"closed" is already in THD_CLOSURE_ACTION/)).toBeVisible();
  await lov.getByRole('button', { name: 'Undo changes' }).click();

  // New LOV Type: Parameter proposed as <MODULE>_<FIELD>, values pasted one per line
  await lov.getByPlaceholder('Find type, field or value').fill('');
  page.once('dialog', (d) => d.accept());
  await lov.getByRole('button', { name: 'New LOV Type' }).click();
  const head = lov.getByTestId('lov-type-header');
  await head.getByLabel('Module').selectOption('THD');
  await head.getByLabel('Field Name (on screen)').fill('ABC');
  await expect(head.getByLabel('LOV Type (Parameter)')).toHaveValue('THD_ABC');
  await grid.getByRole('button', { name: 'Remove value' }).click();
  await lov.getByRole('button', { name: 'Add several' }).click();
  await lov.getByLabel(/one per line/).fill('1\n2\n3');
  await lov.getByRole('button', { name: 'Add to list' }).click();
  await lov.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('THD_ABC saved (3 values).')).toBeVisible();
  await expect(types.getByRole('button', { name: /THD_ABC/ })).toBeVisible();

  // Dependent list: filter by parent value
  await types.getByRole('button', { name: /THD_PROGRESS_SUB_STATUS/ }).click();
  await lov.getByLabel('Show values for').selectOption('Pending for parts');
  await expect(grid.getByRole('textbox', { name: 'Display Value' })).toHaveCount(2);

  // The generic table stays available for Excel import / export
  await lov.getByRole('button', { name: /Table \/ Excel view/ }).click();
  await page.getByRole('button', { name: /Back to the List of Values screen/ }).click();
  await expect(lov).toBeVisible();
});

test('Ctrl+B duplicates a row in the List of Values screen; saving it unchanged is refused as a duplicate', async ({ page }) => {
  await page.goto('/#/admin/masters?open=common');
  const lov = page.getByTestId('lov-explorer');
  await lov.getByTestId('lov-type-list').getByRole('button', { name: /THD_CLOSURE_ACTION/ }).click();
  const values = lov.getByTestId('lov-values').getByRole('textbox', { name: 'Display Value' });
  await expect(values).toHaveCount(3);

  await values.first().click();
  await page.keyboard.press('Control+b');
  await expect(values).toHaveCount(4);
  await expect(values.nth(1)).toBeFocused();
  await expect(values.nth(1)).toHaveValue('Closed');

  // Saved as is → refused
  await lov.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/Duplicate record cannot exist\. Change the copied row/)).toBeVisible();

  // Type over the copy → saved
  await values.nth(1).fill('Closed by Dealer');
  await lov.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('THD_CLOSURE_ACTION saved (4 values).')).toBeVisible();
});

test('Ctrl+B duplicates a row in any master table; saving it unchanged shows "Duplicate record cannot exist"', async ({ page }) => {
  await page.goto('/#/admin/masters?open=common');
  await page.getByRole('button', { name: /Table \/ Excel view/ }).click();
  const rows = page.locator('tbody tr[data-record-row]');
  const before = await rows.count();

  await rows.first().focus();
  await page.keyboard.press('Control+b');
  await expect(page.getByText('Add New Master Row')).toBeVisible();
  await page.getByRole('button', { name: 'Insert Row' }).click();
  await expect(page.getByTestId('duplicate-error')).toHaveText('Duplicate record cannot exist');

  // Change a value → saves as a new row
  await page.getByLabel(/^Display Value/).fill('Brand new value');
  await page.getByLabel(/^Code \(LIC\)/).fill('BRAND_NEW_VALUE');
  await page.getByRole('button', { name: 'Insert Row' }).click();
  await expect(rows).toHaveCount(before + 1);
});
