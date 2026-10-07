import { test, expect, type Locator, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Records the TML Admin Portal training video by driving the real application: a visible cursor, key badges
 * (Ctrl+B …) and captions. The captions are also written to training/output/narration.md as a script to read aloud.
 * Run: npm run training-video   →   training/output/TML-Admin-Portal-Training.webm
 */
const OUT = path.resolve('training/output');
const sample = (name: string) => ({ name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: fs.readFileSync(`public/downloads/${name}`) });

interface Line { chapter: string; at: number; text: string }

const OVERLAY = `
(() => {
  const setup = () => {
  if (window.__trainingReady) return;
  window.__trainingReady = true;
  const style = document.createElement('style');
  style.textContent = \`
    #__cap{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:1000px;z-index:2147483646;background:rgba(0,34,68,.94);color:#fff;
      font:600 21px/1.35 Inter,Segoe UI,Arial,sans-serif;padding:12px 22px;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.35);text-align:center;transition:opacity .25s;pointer-events:none}
    #__cap small{display:block;font:700 12px Inter,Arial;letter-spacing:.08em;color:#8fd0ff;margin-bottom:3px;text-transform:uppercase}
    #__cur{position:fixed;width:22px;height:22px;border:3px solid #ff7a00;border-radius:50%;background:rgba(255,122,0,.18);z-index:2147483647;pointer-events:none;
      transform:translate(-50%,-50%);transition:transform .08s}
    #__cur.down{transform:translate(-50%,-50%) scale(.7);background:rgba(255,122,0,.5)}
    #__key{position:fixed;top:20px;right:24px;z-index:2147483646;background:#fff;color:#002244;border:2px solid #002244;border-radius:10px;padding:8px 16px;
      font:800 22px Inter,Arial;box-shadow:0 4px 14px rgba(0,0,0,.3);display:none;pointer-events:none}
    #__card{position:fixed;inset:0;z-index:2147483645;background:linear-gradient(135deg,#002244,#0b4f8a);color:#fff;display:none;flex-direction:column;align-items:center;justify-content:center;
      font-family:Inter,Segoe UI,Arial,sans-serif;text-align:center;padding:60px}
    #__card h1{font-size:46px;font-weight:900;margin:0 0 14px}#__card p{font-size:23px;max-width:900px;line-height:1.5;margin:6px 0;opacity:.95}
    #__card .n{font-size:15px;letter-spacing:.2em;text-transform:uppercase;color:#8fd0ff;font-weight:800;margin-bottom:14px}
  \`;
  document.head.appendChild(style);
  const cap = Object.assign(document.createElement('div'), { id: '__cap' }); cap.style.opacity = '0';
  const cur = Object.assign(document.createElement('div'), { id: '__cur' });
  const key = Object.assign(document.createElement('div'), { id: '__key' });
  const card = Object.assign(document.createElement('div'), { id: '__card' });
  document.body.append(cap, cur, key, card);
  document.addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
  document.addEventListener('mousedown', () => cur.classList.add('down'), true);
  document.addEventListener('mouseup', () => cur.classList.remove('down'), true);
  window.__caption = (chapter, text) => { cap.innerHTML = text ? '<small>' + chapter + '</small>' + text : ''; cap.style.opacity = text ? '1' : '0'; };
  window.__key = (t) => { key.textContent = t; key.style.display = t ? 'block' : 'none'; };
  window.__card = (html) => { card.innerHTML = html || ''; card.style.display = html ? 'flex' : 'none'; };
  };
  if (document.body) setup(); else document.addEventListener('DOMContentLoaded', setup);
})();`;

test('record the training video', async ({ browser }, testInfo) => {
  testInfo.setTimeout(20 * 60_000);
  fs.mkdirSync(OUT, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } });
  const page = await context.newPage();
  await page.addInitScript(OVERLAY);
  const t0 = Date.now();
  const lines: Line[] = [];
  let chapter = '';
  const FAST = !!process.env.FAST; // dry run: same steps, almost no waiting (to check the script quickly)
  const sleep = (ms: number) => page.waitForTimeout(FAST ? Math.min(ms, 40) : ms);

  // ---- helpers ------------------------------------------------------------------------------------------------
  const say = async (text: string, ms?: number) => {
    lines.push({ chapter, at: (Date.now() - t0) / 1000, text });
    await page.evaluate(([c, t]) => (window as any).__caption(c, t), [chapter, text]);
    await sleep(ms ?? Math.max(2600, text.length * 55));
  };
  const hush = () => page.evaluate(() => (window as any).__caption('', ''));
  const card = async (num: string, title: string, lead: string[], ms = 4500) => {
    lines.push({ chapter: title, at: (Date.now() - t0) / 1000, text: `[${num}] ${title}. ${lead.join(' ')}` });
    await page.evaluate(([n, t, l]) => (window as any).__card(`<div class="n">${n}</div><h1>${t}</h1>${(l as string[]).map((x) => `<p>${x}</p>`).join('')}`), [num, title, lead] as const);
    await sleep(ms);
    await page.evaluate(() => (window as any).__card(''));
    await sleep(300);
  };
  const open = async (hash: string) => {
    await page.goto(hash);
    await page.waitForLoadState('domcontentloaded');
    await sleep(900);
  };
  const point = async (loc: Locator) => {
    await loc.first().scrollIntoViewIfNeeded();
    const box = await loc.first().boundingBox();
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 22 });
    await sleep(350);
  };
  const click = async (loc: Locator) => {
    await point(loc);
    await loc.first().click();
    await sleep(700);
  };
  const type = async (loc: Locator, text: string) => {
    await point(loc);
    await loc.first().click();
    await loc.first().fill('');
    await loc.first().pressSequentially(text, { delay: FAST ? 3 : 70 });
    await sleep(500);
  };
  const keys = async (combo: string, label = combo.replace('Control', 'Ctrl').replace('+', ' + ').replace(/\b[a-z]\b/g, (m) => m.toUpperCase())) => {
    await page.evaluate((t) => (window as any).__key(t), label);
    await sleep(900);
    await page.keyboard.press(combo);
    await sleep(1100);
    await page.evaluate(() => (window as any).__key(''));
  };
  const toastSeen = async (re: RegExp) => { await expect(page.getByText(re).first()).toBeVisible({ timeout: 8000 }); };

  // ============================================================ Title
  await page.goto('/#/dashboard');
  await sleep(1200);
  chapter = 'Introduction';
  await card('TML Service Transformation', 'Admin Portal & TML Journey', ['Training: masters, lists of values, Excel upload, rules, employees, roles and skills', 'About 10 minutes · all data shown is test data'], 5000);

  // ============================================================ 1 Where things are
  chapter = '1 · Finding your way';
  await say('This is the Service Transformation portal. The left menu has the TML Journey screens and the Administration screens.');
  await point(page.locator('aside').getByRole('button', { name: /Masters Maintenance/ }));
  await say('Administration is where you maintain masters, upload Excel files, manage employees and roles. Press Ctrl + K any time to search for a screen.');
  await page.evaluate(() => (window as any).__key('Ctrl + K'));
  await sleep(700);
  await page.keyboard.press('Control+k');
  await sleep(500);
  await page.keyboard.type('upload', { delay: FAST ? 5 : 120 });
  await sleep(1800);
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as any).__key(''));
  await sleep(500);
  await say('The BA Guide in the menu explains everything in this video, step by step, with practice files.');
  await point(page.locator('aside').getByRole('button', { name: /BA Guide: Masters/ }));
  await hush();

  // ============================================================ 2 Common masters and lists of values
  await card('Part 1', 'Masters & Lists of Values', ['A master is a table of reference data: dealers, skills, statuses, dropdown lists…', 'Dropdown lists of every module live in one place: the List of Values screen']);
  chapter = '2 · Masters & Lists of Values';
  await open('/#/admin/masters');
  await say('Masters Maintenance holds all reference data, grouped by module. Masters used by several modules sit under Common Masters.');
  await click(page.locator('aside').getByRole('button', { name: /Common Masters/ }));
  const lov = page.getByTestId('lov-explorer');
  await expect(lov).toBeVisible();
  await say('This is the List of Values screen. Every dropdown in the application is a list here. On the left are the lists, on the right the values of the selected list.');
  await type(lov.getByPlaceholder('Find type, field or value'), 'closure');
  await click(lov.getByTestId('lov-type-list').getByRole('button', { name: /THD_CLOSURE_ACTION/ }));
  await say('The list name is the module and the field: THD_CLOSURE_ACTION. Each value has an order, a display value and an automatic code.');
  const values = lov.getByTestId('lov-values').getByRole('textbox', { name: 'Display Value' });
  await values.first().click();
  await say('To add values quickly, click in a row and press Ctrl + B. It copies the row.', 1800);
  await keys('Control+b');
  await say('The copy is red: "Duplicate record cannot exist". An unchanged copy can never be saved. Press Esc to remove it.');
  await keys('Escape', 'Esc');
  await click(lov.getByRole('button', { name: 'New Value' }));
  await page.keyboard.type('Closed by Plant', { delay: FAST ? 3 : 80 });
  await say('Type the new value. The code is created automatically. Save with Ctrl + S.', 2200);
  await keys('Control+s');
  await toastSeen(/saved \(4 values\)/);
  await say('Saved. To retire a value, untick Active. Values are never deleted, so old records keep showing them.');
  await click(lov.getByRole('button', { name: 'New LOV Type' }));
  await say('To create a new list, press New LOV Type, choose the module and type the field name. The list name is proposed for you.');
  const head = lov.getByTestId('lov-type-header');
  await head.getByLabel('Module').selectOption('JC');
  await type(head.getByLabel('Field Name (on screen)'), 'Vehicle Wash Type');
  await sleep(800);
  await click(lov.getByTestId('lov-values').getByRole('button', { name: 'Remove value' }));
  await click(lov.getByRole('button', { name: 'Add several' }));
  await type(lov.getByLabel(/one per line/), 'Basic wash\nFoam wash\nInterior detailing');
  await click(lov.getByRole('button', { name: 'Add to list' }));
  await say('Add several values at once, one per line, for example pasted from Excel. Then Ctrl + S.', 2400);
  await keys('Control+s');
  await toastSeen(/JC_VEHICLE_WASH_TYPE saved/);
  await say('The new list exists immediately. No developer and no deployment is needed.');
  await click(lov.getByRole('button', { name: /Table \/ Excel view/ }));
  await say('Table / Excel view shows the same data as a plain table, for Excel export and import.');
  await hush();

  // ============================================================ 3 Generic masters: add row, copy, esc
  await card('Part 2', 'Working in any master', ['Same behaviour everywhere: + Add Row, Ctrl+B, Ctrl+S, Esc', '15 new generic masters: departments, designations, skills, shifts, service types…']);
  chapter = '3 · Working in any master';
  await open('/#/admin/masters?open=common');
  await click(page.getByRole('button', { name: /^PPL & PL \(Product Line\) Master/ }));
  const rows = page.locator('tbody tr[data-record-row]');
  await expect(rows.first()).toBeVisible();
  await say('This is the PPL and PL master, the vehicle lines. Every master works the same way.');
  await click(page.getByRole('button', { name: /\+ Add Row/ }));
  await say('+ Add Row puts a blank row at the top, so you see exactly what must be entered. Press Esc to cancel it.');
  await keys('Escape', 'Esc');
  await rows.first().focus();
  await point(rows.first());
  await say('To add a similar row, click a row and press Ctrl + B.', 1800);
  await keys('Control+b');
  const copy = page.getByTestId('copy-row');
  await say('A copy appears below. Type over the values that differ. While it is identical to the original, it is red and cannot be saved.');
  await type(copy.getByLabel('PPL Code'), 'PPL-DEMO-01');
  await type(copy.getByLabel(/^PL \(Variant/), 'Demo variant for training');
  await say('Changed. Now press Ctrl + S to save.', 1800);
  await keys('Control+s');
  await toastSeen(/row\(s\) added/);
  await say('Saved, right below the row it was copied from.');
  await hush();

  // ============================================================ 4 Rules
  await card('Part 3', 'Rules without coding', ['The TML Admin builds checks on screen', 'Required when, No duplicates, From ≤ To, Allowed values, Must exist in another master, Number between, Format']);
  chapter = '4 · Rules';
  await click(page.getByRole('button', { name: /^Rules \(/ }));
  const panel = page.getByTestId('rules-panel');
  await say('Every master has a Rules button. Rules are checks, built by picking a type and filling in the blanks.');
  await click(panel.getByRole('button', { name: 'Add rule' }));
  const form = panel.getByTestId('rule-form');
  await say('Choose the kind of rule. Here: No duplicates. The PPL Code must be unique.');
  await click(form.getByRole('radio', { name: /No duplicates/ }));
  await click(form.getByRole('checkbox', { name: 'PPL Code' }));
  await say('The rule is shown as a plain sentence. Choose Error to refuse the row, or Warning to save and tell the user.');
  await click(form.getByRole('button', { name: 'Save rule' }));
  await say('The rule is active at once, for saving, new rows, copies and Excel uploads.');
  await rows.first().focus();
  await keys('Control+b');
  await type(copy.getByLabel(/^PL \(Variant/), 'Same code again');
  await keys('Control+s');
  await say('A copy that reuses an existing PPL Code is refused, with the rule as the reason.');
  await keys('Escape', 'Esc');
  await hush();

  // ============================================================ 5 Upload a Master
  await card('Part 4', 'Upload a Master', ['Drop any Excel file; the page tells you what will happen', 'Nothing is saved until you press Import']);
  chapter = '5 · Upload a Master';
  await open('/#/admin/upload-master');
  await say('Upload a Master is one page for every Excel file. An existing master must be in its own template. Any other table becomes a new master.');
  const input = page.getByLabel('Master Excel file');
  await say('First, a file with wrong column headings.', 1800);
  await input.setInputFiles(sample('Sample_Upload_2_LOV_WrongColumns.xlsx'));
  await expect(page.getByTestId('header-problems')).toBeVisible();
  await point(page.getByTestId('header-problems'));
  await say('It is refused. The page lists the missing and extra columns and links to the correct template. Nothing is imported.');
  await say('Now the correct file.', 1500);
  await input.setInputFiles(sample('Sample_Upload_1_LOV_Correct.xlsx'));
  await expect(page.getByText('Ready to import')).toBeVisible();
  await point(page.getByTestId('sheet-result'));
  await say('Ready to import: 3 new rows. A row with an existing id would change that row. Empty cells keep their value.');
  await click(page.getByRole('button', { name: 'Import', exact: true }));
  await expect(page.getByTestId('upload-done')).toBeVisible();
  await say('Imported. Uploading the same file again is refused as a duplicate.');
  await input.setInputFiles(sample('Sample_Upload_1_LOV_Correct.xlsx'));
  await expect(page.getByTestId('row-issues')).toBeVisible();
  await point(page.getByTestId('row-issues'));
  await say('"Duplicate record cannot exist", with the Excel row number.');
  await say('A completely new table: the page creates a new master from its columns.', 2200);
  await input.setInputFiles(sample('Sample_Upload_3_NewMaster.xlsx'));
  await expect(page.getByTestId('sheet-result')).toContainText('New master');
  await page.getByLabel('Module').selectOption('spd');
  await type(page.getByLabel('Master name'), 'Tyre Brand Upload');
  await say('Choose the module and the name, then Import. No coding or deployment.');
  await click(page.getByRole('button', { name: 'Import', exact: true }));
  await expect(page.getByTestId('upload-done')).toBeVisible();
  await page.mouse.wheel(0, 900);
  await sleep(800);
  await say('At the bottom: templates of every existing master, the BA workbook templates and practice files.');
  await hush();

  // ============================================================ 6 Employees
  await card('Part 5', 'Employees, skills & roles', ['Employee / Users now covers the whole workforce', 'Designation, shift, skills, certificates, availability and the roles they hold']);
  chapter = '6 · Employee / Users';
  await open('/#/admin/users');
  await say('Employee / Users keeps all its old tabs. The list now shows designation, expertise and a skills badge. "Gap" means a required skill or certificate is missing.');
  await type(page.getByPlaceholder('Search user, ID, email...'), 'Priya Shinde');
  await click(page.getByTitle('View user details'));
  await say('Click the eye icon to open the employee. Employment shows designation, shift and status.');
  await click(page.getByTestId('drawer-tab-employment'));
  await say('For a Service Advisor you must choose the expertise: Mechanical, Bodyshop, or Both.');
  await point(page.getByTestId('expertise'));
  await click(page.getByTestId('expertise').getByRole('radio', { name: /^Bodyshop/ }));
  await click(page.getByRole('button', { name: 'Save profile' }));
  await say('The expertise decides which job cards the advisor handles and which skill is required.');
  await click(page.getByTestId('drawer-tab-roleviews'));
  await say('Role and Views shows everything this role sees: screens, cards, worklist tabs, columns and permissions.');
  await page.getByTestId('role-views-tab').evaluate((el) => el.scrollIntoView());
  await sleep(1500);
  await click(page.getByTestId('drawer-tab-skills'));
  await say('Skills and Certificates: skill levels L1 to L4, certificate expiry, and the gaps against the role. Add or remove here.');
  await point(page.getByTestId('gap-summary'));
  await page.keyboard.press('Escape');
  await sleep(700);
  await click(page.getByRole('button', { name: /Skills & Certificates/ }).first());
  await expect(page.getByTestId('skills-matrix')).toBeVisible();
  await say('The Skills and Certificates tab shows everyone against every skill, with gaps highlighted, certificates to renew, and Export to Excel.');
  await page.mouse.wheel(0, 700);
  await sleep(1500);
  await click(page.getByRole('button', { name: /^Availability/ }));
  await expect(page.getByTestId('availability-panel')).toBeVisible();
  await say('Availability shows who is on duty by skill and shift, and the Service Advisors by expertise.');
  await point(page.getByTestId('advisor-expertise'));
  await page.getByLabel('Skill needed').selectOption({ label: 'Suspension, Steering & Brakes' });
  await say('"Who can do this?" finds available people for a skill, level and shift, for example to allocate a bay.');
  await point(page.getByTestId('finder'));
  await hush();

  // ============================================================ 7 Roles
  chapter = '7 · Roles & Position Types';
  await open('/#/admin/roles');
  await click(page.getByRole('button', { name: /Roles & Position Types/ }));
  const cat = page.getByTestId('role-catalogue');
  await say('Roles and Access keeps the permissions matrix. Roles and Position Types now lists every role in the application.');
  await click(cat.getByTestId('role-list').getByRole('button', { name: /^Service Advisor/ }));
  await say('For each role: how many people hold it, the screens, cards and tabs it sees, its permissions, and the skills and certificates it needs.');
  await cat.getByTestId('role-detail').evaluate((el) => el.scrollIntoView());
  await sleep(1500);
  await click(cat.getByTestId('role-list').getByRole('button', { name: /^Paint Specialist/ }));
  await say('Workshop roles that work in the dealer apps show their required skills and certificates, here Paint Technology.');
  await hush();

  // ============================================================ 8 BA guide
  chapter = '8 · BA Guide';
  await open('/#/admin/masters-guide');
  await say('The BA Guide explains every step, with downloads and practice files. Use the buttons at the top to jump to a section.');
  await click(page.getByRole('navigation', { name: 'Guide contents' }).getByRole('button', { name: /Easiest: Upload a Master/ }));
  await sleep(1500);
  await click(page.getByRole('navigation', { name: 'Guide contents' }).getByRole('button', { name: /Rules \(no coding\)/ }));
  await sleep(1500);
  await hush();

  // ============================================================ Outro
  chapter = 'Summary';
  await card('Remember', 'Five things to remember', ['1 · Ctrl + B copies a row · Ctrl + S saves · Esc cancels', '2 · An unchanged copy is a duplicate and is never saved', '3 · Upload a Master: existing template, or any table for a new master', '4 · Rules are set on screen, no coding', '5 · Everything here is test data in this prototype'], 8000);

  // ---- finish -------------------------------------------------------------------------------------------------
  const video = page.video()!;
  await context.close();
  await video.saveAs(path.join(OUT, 'TML-Admin-Portal-Training.webm'));
  await video.delete();

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  let md = '# Training video — narration script\n\nRead each line while the video shows it. Times are from the start of the video.\n';
  let last = '';
  lines.forEach((l) => {
    if (l.chapter !== last) {
      md += `\n## ${l.chapter}\n\n`;
      last = l.chapter;
    }
    md += `- **${fmt(l.at)}** — ${l.text}\n`;
  });
  fs.writeFileSync(path.join(OUT, 'narration.md'), md);
  fs.writeFileSync(path.join(OUT, 'chapters.json'), JSON.stringify(lines, null, 2));
  expect(lines.length).toBeGreaterThan(40);
});
