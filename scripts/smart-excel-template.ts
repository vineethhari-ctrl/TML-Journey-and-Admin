/**
 * Builds TML_Smart_Excel_Template.xlsx — a visual, colour-coded template for BAs preparing
 * masters for "Smart Excel Import". Used by scripts/generate-master-templates.ts (npm run templates).
 *
 * Sheets:
 *   README - How to fill        the 6 rules, a picture of a good sheet, and Wrong vs Right examples
 *                               (Smart Import skips sheets whose name starts with README / How to / Guide)
 *   Example - Inventory Capture a filled, correct example: two side-by-side tables, a repeated PV/EV header
 *   Your Master                 an empty, ready-to-fill table with dropdowns
 */
import ExcelJS from 'exceljs';

const NAVY = 'FF0B2A5B';
const WHITE = 'FFFFFFFF';
const GREY = 'FFF1F5F9';
const RULES = [
  { n: '①', color: 'FF2563EB', light: 'FFDBEAFE', title: 'One table per master. Column names go in the FIRST row of the table.' },
  { n: '②', color: 'FFEA580C', light: 'FFFFEDD5', title: 'Two tables on one sheet? Leave ONE completely empty column between them.' },
  { n: '③', color: 'FF7C3AED', light: 'FFEDE9FE', title: 'A PV block and an EV block below it? You may repeat the header row. It is skipped automatically.' },
  { n: '④', color: 'FF059669', light: 'FFD1FAE5', title: 'Y / N for yes-no columns, real numbers for counts and sequences, real dates (or YYYY-MM-DD).' },
  { n: '⑤', color: 'FFDC2626', light: 'FFFEE2E2', title: 'Fill EVERY cell. Never leave a blank meaning "same as above"; repeat the value.' },
  { n: '⑥', color: 'FF0D9488', light: 'FFCCFBF1', title: 'Put limits in the header, e.g. "No. of Images Required (Max 2)". The limit is then enforced.' },
];
const RED_FILL = 'FFFECACA';
const GREEN_FILL = 'FFBBF7D0';

const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

/** Writes a small grid at (row, col); the first row is styled as a header. Returns the next free row. */
function grid(ws: ExcelJS.Worksheet, row: number, col: number, rows: (string | number | null)[][], headerArgb: string, bodyFill?: (r: number, c: number) => string | undefined) {
  rows.forEach((values, r) => {
    values.forEach((v, c) => {
      const cell = ws.getCell(row + r, col + c);
      cell.value = v as ExcelJS.CellValue;
      cell.border = thin;
      cell.alignment = { vertical: 'middle', wrapText: true };
      if (r === 0) {
        cell.fill = fill(headerArgb);
        cell.font = { bold: true, color: { argb: WHITE } };
      } else {
        const f = bodyFill?.(r, c);
        if (f) cell.fill = fill(f);
      }
    });
  });
  return row + rows.length;
}

function readme(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet('README - How to fill', { properties: { tabColor: { argb: NAVY } }, views: [{ showGridLines: false }] });
  ws.columns = [{ width: 4 }, ...Array.from({ length: 14 }, () => ({ width: 15 }))];

  ws.mergeCells('B1:O1');
  const title = ws.getCell('B1');
  title.value = 'TML Smart Excel Template — how to prepare a master';
  title.font = { bold: true, size: 18, color: { argb: WHITE } };
  title.fill = fill(NAVY);
  title.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 34;
  ws.mergeCells('B2:O2');
  ws.getCell('B2').value = 'Fill the "Your Master" sheet (one sheet per master), then upload: Admin Portal → Masters Maintenance → Import ▾ → Smart Excel Import.';
  ws.getCell('B2').font = { italic: true, color: { argb: 'FF475569' } };

  // The 6 rules
  let r = 4;
  ws.getCell(r, 2).value = 'THE 6 RULES';
  ws.getCell(r, 2).font = { bold: true, size: 13, color: { argb: NAVY } };
  r++;
  RULES.forEach((rule) => {
    const badge = ws.getCell(r, 2);
    badge.value = rule.n;
    badge.fill = fill(rule.color);
    badge.font = { bold: true, size: 14, color: { argb: WHITE } };
    badge.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(r, 3, r, 15);
    const text = ws.getCell(r, 3);
    text.value = rule.title;
    text.fill = fill(rule.light);
    text.font = { size: 12 };
    text.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(r).height = 24;
    r++;
  });

  // Picture of a good sheet
  r += 1;
  ws.getCell(r, 2).value = 'PICTURE: WHAT A GOOD SHEET LOOKS LIKE';
  ws.getCell(r, 2).font = { bold: true, size: 13, color: { argb: NAVY } };
  r++;
  const top = r;
  grid(
    ws,
    top,
    2,
    [
      ['Section', 'BU', 'Active'],
      ['Documents', 'PV', 'Y'],
      ['Internal', 'PV', 'Y'],
      ['Section', 'BU', 'Active'],
      ['Documents', 'EV', 'Y'],
      ['Internal', 'EV', 'N'],
    ],
    RULES[0].color,
    (row) => (row === 3 ? RULES[2].light : undefined)
  );
  for (let i = 0; i < 6; i++) ws.getCell(top + i, 5).fill = fill('FFE2E8F0');
  ws.getCell(top, 5).value = '← empty →';
  ws.getCell(top, 5).font = { bold: true, color: { argb: RULES[1].color } };
  ws.getCell(top, 5).alignment = { horizontal: 'center' };
  grid(
    ws,
    top,
    6,
    [
      ['Section', 'Checkpoint', 'Mandatory', 'No. of Images (Max 2)'],
      ['Internal', 'Horn Working', 'Y', 2],
      ['Internal', 'Wiper Working', 'Y', 1],
      ['Documents', 'Insurance Copy', 'N', 1],
    ],
    RULES[0].color,
    (row, c) => (c === 2 ? RULES[3].light : c === 3 ? RULES[5].light : undefined)
  );
  const notes: [number, number, string, number][] = [
    [top, 11, '① column names in the first row', 0],
    [top + 1, 11, '② one empty column between the two tables', 1],
    [top + 3, 11, '③ repeated header for the EV block: OK', 2],
    [top + 4, 11, '④ Y / N and real numbers', 3],
    [top + 5, 11, '⑥ the limit is in the header', 5],
  ];
  notes.forEach(([nr, nc, text, i]) => {
    ws.mergeCells(nr, nc, nr, nc + 3);
    const c = ws.getCell(nr, nc);
    c.value = text;
    c.font = { bold: true, color: { argb: RULES[i].color } };
  });
  r = top + 7;

  // Wrong vs Right
  ws.getCell(r, 2).value = 'COMMON MISTAKES: ✗ WRONG  vs  ✓ RIGHT';
  ws.getCell(r, 2).font = { bold: true, size: 13, color: { argb: NAVY } };
  r += 1;
  const pair = (label: string, wrong: (string | number | null)[][], right: (string | number | null)[][], bad: (row: number, c: number) => boolean) => {
    ws.mergeCells(r, 2, r, 15);
    ws.getCell(r, 2).value = label;
    ws.getCell(r, 2).font = { bold: true, size: 12 };
    ws.getCell(r, 2).fill = fill(GREY);
    r++;
    ws.getCell(r, 2).value = '✗ Wrong';
    ws.getCell(r, 2).font = { bold: true, color: { argb: 'FFDC2626' } };
    ws.getCell(r, 7).value = '✓ Right';
    ws.getCell(r, 7).font = { bold: true, color: { argb: 'FF059669' } };
    r++;
    const end1 = grid(ws, r, 2, wrong, 'FF64748B', (row, c) => (bad(row, c) ? RED_FILL : undefined));
    const end2 = grid(ws, r, 7, right, 'FF64748B', (row, c) => (bad(row, c) ? GREEN_FILL : undefined));
    r = Math.max(end1, end2) + 1;
  };
  pair(
    '⑤ A blank cell meaning "same as above"',
    [['Section', 'Checkpoint'], ['Internal', 'Horn Working'], [null, 'Wiper Working'], [null, 'Seat Belt']],
    [['Section', 'Checkpoint'], ['Internal', 'Horn Working'], ['Internal', 'Wiper Working'], ['Internal', 'Seat Belt']],
    (row, c) => c === 0 && row > 1
  );
  pair(
    '④ Different spellings for yes / no',
    [['Checkpoint', 'Mandatory'], ['Horn Working', 'Yes'], ['Wiper Working', 'y'], ['Seat Belt', 'Mandatory']],
    [['Checkpoint', 'Mandatory'], ['Horn Working', 'Y'], ['Wiper Working', 'Y'], ['Seat Belt', 'Y']],
    (row, c) => c === 1 && row > 0
  );
  pair(
    '④ Numbers written as words',
    [['Checkpoint', 'No. of Images (Max 2)'], ['Horn Working', 'two'], ['Seat Belt', 'one']],
    [['Checkpoint', 'No. of Images (Max 2)'], ['Horn Working', 2], ['Seat Belt', 1]],
    (row, c) => c === 1 && row > 0
  );
  pair(
    '⑥ The limit only in an e-mail, and a value above it',
    [['Checkpoint', 'No. of Images'], ['Horn Working', 3]],
    [['Checkpoint', 'No. of Images (Max 2)'], ['Horn Working', 2]],
    (row, c) => c === 1
  );
  ws.mergeCells(r, 2, r, 15);
  ws.getCell(r, 2).value =
    '② Two tables touching each other (no empty column) are read as ONE table. ③ A different header below a table starts a mess; put a new master on its own sheet.';
  ws.getCell(r, 2).font = { italic: true, color: { argb: 'FF475569' } };
  r += 2;
  ws.mergeCells(r, 2, r, 15);
  ws.getCell(r, 2).value =
    'After upload, Smart Excel Import lists every gap with its Excel row number (blank cells, mixed numbers and text, values above a limit, duplicate rows). Nothing is guessed.';
  ws.getCell(r, 2).fill = fill('FFFEF3C7');
  ws.getCell(r, 2).alignment = { wrapText: true, vertical: 'middle', indent: 1 };
  ws.getRow(r).height = 32;
}

function addDropdown(ws: ExcelJS.Worksheet, col: number, from: number, to: number, list: string[], prompt: string) {
  for (let r = from; r <= to; r++) {
    ws.getCell(r, col).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${list.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Pick from the list',
      error: `Allowed: ${list.join(', ')}`,
      showInputMessage: true,
      promptTitle: 'Choose a value',
      prompt,
    };
  }
}

function headerNotes(ws: ExcelJS.Worksheet, row: number, col: number, headers: Array<[string, number, string]>) {
  headers.forEach(([label, rule, note], i) => {
    const c = ws.getCell(row, col + i);
    c.value = label;
    c.fill = fill(RULES[rule].color);
    c.font = { bold: true, color: { argb: WHITE } };
    c.border = thin;
    c.alignment = { vertical: 'middle', wrapText: true };
    c.note = { texts: [{ text: `${RULES[rule].n} ${note}` }] };
  });
}

function example(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet('Example - Inventory Capture', { properties: { tabColor: { argb: 'FF059669' } }, views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [14, 16, 10, 8, 12, 6, 4, 14, 18, 26, 10, 18, 10, 8, 12, 16, 14, 12].map((width) => ({ width }));

  // Table 1: sections, PV then EV (header repeated)
  const left: Array<[string, number, string]> = [
    ['Section', 0, 'Column names in the first row.'],
    ['Roles', 0, 'Same spelling every time, e.g. "DSvAdv" or "DSvAdv, Driver".'],
    ['Sequence Priority', 3, 'A number: 1, 2, 3 …'],
    ['Active', 3, 'Y or N only (dropdown).'],
    ['Service Type', 0, 'All or Accident (dropdown).'],
    ['BU', 0, 'PV or EV (dropdown).'],
  ];
  headerNotes(ws, 1, 1, left);
  const sections = [
    ['Documents', 'DSvAdv, Driver', 1, 'Y', 'All'],
    ['Accident Details', 'DSvAdv', 2, 'Y', 'Accident'],
    ['Internal', 'DSvAdv', 3, 'Y', 'All'],
    ['External', 'DSvAdv, Driver', 4, 'Y', 'All'],
  ];
  const write = (row: number, col: number, values: (string | number)[]) =>
    values.forEach((v, i) => {
      const c = ws.getCell(row, col + i);
      c.value = v;
      c.border = thin;
    });
  sections.forEach((s, i) => write(2 + i, 1, [...s, 'PV']));
  headerNotes(ws, 6, 1, left.map(([l, , n]) => [l, 2, `Repeated header for the EV block: allowed and skipped on import. (${n})`]));
  sections.forEach((s, i) => write(7 + i, 1, [...s, 'EV']));
  addDropdown(ws, 4, 2, 60, ['Y', 'N'], 'Y or N');
  addDropdown(ws, 5, 2, 60, ['All', 'Accident'], 'All or Accident');
  addDropdown(ws, 6, 2, 60, ['PV', 'EV'], 'PV or EV');

  // Column G stays EMPTY — it separates the two tables
  ws.getCell(1, 7).note = { texts: [{ text: '② Keep this whole column EMPTY. It separates the two tables.' }] };

  // Table 2: checkpoints
  headerNotes(ws, 1, 8, [
    ['Section', 4, 'Must match a Section in the first table. Fill every row.'],
    ['Sub-Section', 4, 'Fill every row. Repeat the value instead of leaving it blank.'],
    ['Checkpoint', 0, 'What the advisor checks.'],
    ['Role', 0, 'DSvAdv or Driver (dropdown).'],
    ['Acceptable Values', 0, 'Comma separated, e.g. "OK, NOT OK, NA", or "Count".'],
    ['Mandatory', 3, 'Y or N only (dropdown).'],
    ['Active', 3, 'Y or N only (dropdown).'],
    ['Video/Image', 0, 'Image, Video or Video/Image (dropdown).'],
    ['No. of Images Required (Max 2)', 5, 'The "(Max 2)" in the header makes 2 the limit. Whole number 1 or 2.'],
    ['Applicable On', 0, 'All or Not OK (dropdown).'],
    ['Service Type', 0, 'All or Accident (dropdown).'],
  ]);
  const checkpoints: (string | number)[][] = [
    ['Internal', 'Steering Controls', 'Horn Working', 'DSvAdv', 'OK, NOT OK, NA', 'Y', 'Y', 'Image', 2, 'All', 'All'],
    ['Internal', 'Steering Controls', 'Steering Wheel Condition', 'DSvAdv', 'OK, NOT OK', 'Y', 'Y', 'Image', 1, 'Not OK', 'All'],
    ['Internal', 'Cabin', 'Seat Belt Working', 'DSvAdv', 'OK, NOT OK', 'Y', 'Y', 'Video/Image', 1, 'Not OK', 'All'],
    ['Documents', 'Insurance', 'Insurance Copy', 'DSvAdv', 'Received, Not Received', 'Y', 'Y', 'Image', 1, 'All', 'Accident'],
    ['External', 'Body Panels', 'Front Bumper', 'Driver', 'OK, Scratch, Dent', 'Y', 'Y', 'Image', 2, 'Not OK', 'All'],
  ];
  checkpoints.forEach((c, i) => write(2 + i, 8, c));
  addDropdown(ws, 11, 2, 60, ['DSvAdv', 'Driver'], 'DSvAdv or Driver');
  addDropdown(ws, 13, 2, 60, ['Y', 'N'], 'Y or N');
  addDropdown(ws, 14, 2, 60, ['Y', 'N'], 'Y or N');
  addDropdown(ws, 15, 2, 60, ['Image', 'Video', 'Video/Image'], 'Image, Video or Video/Image');
  for (let r = 2; r <= 60; r++) {
    ws.getCell(r, 16).dataValidation = { type: 'whole', operator: 'between', allowBlank: true, formulae: [1, 2], showErrorMessage: true, error: 'Whole number 1 or 2' };
  }
  addDropdown(ws, 17, 2, 60, ['All', 'Not OK'], 'All or Not OK');
  addDropdown(ws, 18, 2, 60, ['All', 'Accident'], 'All or Accident');
}

function yourMaster(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet('Your Master', { properties: { tabColor: { argb: 'FF7C3AED' } }, views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [12, 34, 8, 8, 12, 30].map((width) => ({ width }));
  headerNotes(ws, 1, 1, [
    ['Code', 0, 'Rename this sheet to your master\'s name. Rename, add or remove columns as you need; keep the names in row 1.'],
    ['Description', 4, 'Fill every row.'],
    ['BU', 0, 'PV / EV / CV (dropdown).'],
    ['Active', 3, 'Y or N only (dropdown).'],
    ['Sequence', 3, 'A number: 1, 2, 3 …'],
    ['Remarks', 0, 'Optional free text.'],
  ]);
  for (let r = 2; r <= 200; r++) for (let c = 1; c <= 6; c++) ws.getCell(r, c).border = thin;
  addDropdown(ws, 3, 2, 200, ['PV', 'EV', 'CV'], 'PV, EV or CV');
  addDropdown(ws, 4, 2, 200, ['Y', 'N'], 'Y or N');
  for (let r = 2; r <= 200; r++) {
    ws.getCell(r, 5).dataValidation = { type: 'whole', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [1], showErrorMessage: true, error: 'Whole number, 1 or more' };
  }
}

export async function buildSmartExcelTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TML Service Transformation';
  readme(wb);
  example(wb);
  yourMaster(wb);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
