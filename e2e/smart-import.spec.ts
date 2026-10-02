import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (err) => {
    throw new Error(`Uncaught page error: ${err.message}`);
  });
});

/** A BA-style workbook: index sheet, two side-by-side tables, a repeated EV header, a value above "(Max 2)". */
function baExcel(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Master Name', 'Status'], ['Glass Inspection Master', 'Open']]), 'Master List');
  const left = [
    ['Section', 'Roles', 'Sequence Priority', 'Active', 'BU'],
    ['Windshield', 'DSvAdv', 1, 'Y', 'PV'],
    ['Windows', 'DSvAdv, Driver', 2, 'Y', 'PV'],
    ['Section', 'Roles', 'Sequence Priority', 'Active', 'BU'],
    ['Windshield', 'DSvAdv', 1, 'Y', 'EV'],
    ['Windows', 'DSvAdv, Driver', 2, 'N', 'EV'],
  ];
  const right = [
    ['Section', 'Checkpoint', 'No. of Image Required(Max 2)'],
    ['Windshield', 'Chip or crack', 2],
    ['Windows', 'Power window working', 3],
  ];
  const rows = left.map((r, i) => [...r, null, ...(right[i] ?? [])]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Glass Inspection Master');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

test('BA uploads their own Excel: tables detected, gaps shown, problem fixed in preview, masters created', async ({ page }) => {
  await page.goto('/#/admin/masters?open=smart-import');
  const modal = page.getByTestId('smart-import');
  await expect(modal).toBeVisible();
  await modal.getByLabel('BA Excel file').setInputFiles({
    name: 'Bodyshop_Glass_Master.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: baExcel(),
  });

  await expect(page.getByTestId('smart-import-notes')).toContainText('Master Name = Glass Inspection Master, Status = Open');
  const drafts = page.getByTestId('smart-draft');
  await expect(drafts).toHaveCount(2);
  await expect(drafts.nth(0)).toContainText('A1:E6 · 4 rows · 5 columns');
  await expect(drafts.nth(0).getByTestId('smart-gaps')).toContainText('Row(s) 4 repeat the header');

  // Part 2 has a value above the "(Max 2)" limit → blocked until the BA decides
  await expect(drafts.nth(1)).toContainText('fix before import');
  const create = page.getByRole('button', { name: /Create 2 master/ });
  await expect(create).toBeDisabled();
  await drafts.nth(1).getByRole('button', { name: /Part 2/ }).click();
  await expect(drafts.nth(1).getByTestId('smart-gaps')).toContainText('above the maximum 2 in row(s) 3');
  await drafts.nth(1).getByLabel('Type of No. of Image Required(Max 2)').selectOption('text');
  await expect(drafts.nth(1)).toContainText('ready');

  // Rename and place
  await drafts.nth(0).getByRole('button', { name: /Part 1/ }).click();
  await drafts.nth(0).getByLabel('Master name').fill('Glass Inspection Sections');
  await expect(drafts.nth(0).getByLabel('Master ID')).toHaveValue('glass_inspection_section_master') // IDs are capped at 31 characters;
  await expect(drafts.nth(0).getByLabel('Group')).toHaveValue('Bodyshop');
  await create.click();

  // Opens the new master with the Excel rows
  await expect(page.getByRole('button', { name: /Glass Inspection Sections/ }).first()).toBeVisible();
  await expect(page.getByText('Windshield').first()).toBeVisible();
  await page.getByRole('button', { name: /Glass Inspection Master — Part 2/ }).click();
  await expect(page.getByText('Power window working').first()).toBeVisible();
});
