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
  // Frame marker: 12 black/white cells in the bottom-left corner that spell the number of the narration line now on
  // screen. make-voice.py reads it back from the video to place each voice line exactly; it is cropped from the final video.
  const bc = Object.assign(document.createElement('div'), { id: '__bc' });
  bc.style.cssText = 'position:fixed;left:0;bottom:0;width:96px;height:10px;display:flex;z-index:2147483647;pointer-events:none;background:#fff';
  for (let i = 0; i < 12; i++) { const c = document.createElement('div'); c.style.cssText = 'width:8px;height:10px;background:#fff'; bc.appendChild(c); }
  const paint = (n) => { for (let i = 0; i < 12; i++) bc.children[i].style.background = (n >> (11 - i)) & 1 ? '#000' : '#fff'; };
  window.__mark = (n) => { try { sessionStorage.setItem('__mk', String(n)); } catch (e) {} paint(n); };
  let saved = 0; try { saved = Number(sessionStorage.getItem('__mk') || 0); } catch (e) {}
  paint(saved);
  document.body.append(cap, cur, key, card, bc);
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
  // Length of each spoken line (seconds), made by training/make-voice.py from a first dry run. When present, every
  // screen waits until its voice line has finished, so the picture always matches what is being said.
  const voice: Record<string, number> = fs.existsSync(path.join(OUT, 'durations.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'durations.json'), 'utf8')) : {};
  const holdFor = (text: string, fallback: number) => (voice[text] !== undefined ? voice[text] * 1000 + 700 : fallback);
  // say(text): show the caption and wait for the voice. say(text, act): the action runs while the voice speaks.
  const say = async (text: string, act?: (() => Promise<void>) | number) => {
    lines.push({ chapter, at: (Date.now() - t0) / 1000, text });
    await page.evaluate((n) => (window as any).__mark(n), lines.length);
    // Captions cover parts of the screen; the voice says the same thing. Show them only with CAPTIONS=1.
    if (process.env.CAPTIONS) await page.evaluate(([c, t]) => (window as any).__caption(c, t), [chapter, text]);
    const wait = holdFor(text, typeof act === 'number' ? act : Math.max(2600, text.length * 55));
    const started = Date.now();
    if (typeof act === 'function') await act();
    const left = wait - (Date.now() - started);
    if (left > 0) await sleep(left);
  };
  const hush = () => page.evaluate(() => (window as any).__caption('', ''));
  const card = async (num: string, title: string, lead: string[], ms = 4500) => {
    const spoken = `[${num}] ${title}. ${lead.join(' ')}`;
    lines.push({ chapter: title, at: (Date.now() - t0) / 1000, text: spoken });
    await page.evaluate((n) => (window as any).__mark(n), lines.length);
    ms = Math.max(ms, holdFor(spoken, 0));
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
  await card('TML Service Transformation', 'Admin Portal & TML Journey', ['Training: masters, lists of values, Excel upload, rules, employees, roles and skills', 'About 12 minutes · all data shown is test data'], 5000);

  // ============================================================ 1 Where things are
  chapter = '1 · Finding your way';
  await say('Welcome. This is the Service Transformation portal. Everything you see in this video uses test data. We will go step by step, and the picture always matches what I am saying.');
  await say('On the left is the menu. The first group is TML Journey: the vehicle journey, journey search and the workshop worklist.');
  await point(page.locator('aside').getByText('Vehicle Journey').first());
  await say('Below it is Administration. This is the part this training is about: masters, Excel upload, common lists of values, employees and roles.', async () => {
    await point(page.locator('aside').getByRole('button', { name: /Masters Maintenance/ }));
  });
  await say('If you do not know where a screen is, press Control and K. A search box opens. Type a word, for example upload, and the portal jumps to that screen.', async () => {
    await page.evaluate(() => (window as any).__key('Ctrl + K'));
    await sleep(700);
    await page.keyboard.press('Control+k');
    await sleep(500);
    await page.keyboard.type('upload', { delay: FAST ? 5 : 120 });
    await sleep(1800);
    await page.keyboard.press('Escape');
    await page.evaluate(() => (window as any).__key(''));
  });
  await say('The BA Guide, near the bottom of Administration, explains everything in this video again, step by step, with practice Excel files you can download.', async () => {
    await point(page.locator('aside').getByRole('button', { name: /BA Guide: Masters/ }));
  });
  await hush();

  // ============================================================ 2 Masters
  await card('Part 1', 'What is a master?', ['A master is a table of reference data that every screen reuses', 'For example: vehicle lines, dealers, skills, shifts, service types, job card statuses', 'Change a master once, and the whole application follows']);
  chapter = '2 · Masters Maintenance';
  await open('/#/admin/masters');
  await say('This is Masters Maintenance, the home of all masters. At the top you can see the total: sixty six masters and more than five hundred records, kept in one place.', async () => {
    await point(page.getByText(/Total System Masters/));
  });
  await say('The governance buttons split masters by owner. OEM Central masters are maintained by Tata Motors. Dealership Floor masters are maintained by the dealer.', async () => {
    await point(page.getByRole('button', { name: /OEM Central \(/ }).first());
    await point(page.getByRole('button', { name: /Dealership Floor \(/ }).first());
  });
  await say('Masters can be seen by project module, or grouped by logical domain. Let us switch to the six logical domains.', async () => {
    await click(page.getByRole('tab', { name: /6 Logical Domains/ }));
  });
  await say('Common Masters is the first group. It holds the masters that every module shares, including the lists of values behind all dropdowns.', async () => {
    await point(page.getByRole('button', { name: /^Common/ }).first());
  });
  await open('/#/admin/masters?open=common');
  await say('Opening Common Masters shows its nineteen masters as buttons, each with its number of rows. The last one is the Common List of Values master. We will come to it in a moment.', async () => {
    await point(page.getByRole('button', { name: /^Department Master/ }));
  });
  await say('First, let us open one ordinary master: the Skill Master. It lists every skill a workshop employee can hold.', async () => {
    await click(page.getByRole('button', { name: /^Skill Master/ }));
  });
  const skillRows = page.locator('tbody tr[data-record-row]');
  await expect(skillRows.first()).toBeVisible();
  await say('Each row is one record: a code, a name, a category and a status. Active records appear in dropdowns. Inactive ones stay in the history but cannot be chosen any more.', async () => {
    await point(skillRows.first());
    await point(skillRows.nth(2));
  });
  await say('Above the table are the buttons for Import and Export. Export gives you this master as an Excel file in exactly its own template.', async () => {
    await point(page.getByRole('button', { name: /^Export/ }).first());
  });
  await open('/#/admin/masters?open=common');
  await click(page.getByRole('button', { name: /^Shift Master/ }));
  await expect(page.locator('tbody tr[data-record-row]').first()).toBeVisible();
  await say('Another example: the Shift Master. Four shifts with timings. The employee screen later in this video uses this master to decide who is available on which shift.', async () => {
    await point(page.locator('tbody tr[data-record-row]').first());
  });
  await hush();

  // ============================================================ 2b Lists of values
  await card('Part 2', 'Lists of Values', ['Every dropdown in the application is a list', 'One screen to maintain all of them, in any module', 'Add a value, retire a value, create a new list: no developer needed']);
  chapter = '3 · Lists of Values';
  await open('/#/admin/masters?open=common');
  const lov = page.getByTestId('lov-explorer');
  await click(page.getByRole('button', { name: /Common LOV Master/ }));
  await expect(lov).toBeVisible();
  await say('This is the List of Values screen. A list of values is simply the set of choices behind a dropdown, for example Fuel Type: Petrol, Diesel, Electric and CNG.');
  await say('On the left are all the lists, about one hundred and ninety five values in total. Each list name has the module first, then the field. So COMMON underscore FUEL TYPE is the Fuel Type dropdown shared by every module.', async () => {
    await point(lov.getByTestId('lov-type-list'));
  });
  await say('On the right are the values of the selected list. Let us search for a list. I type closure.', async () => {
    await type(lov.getByPlaceholder('Find type, field or value'), 'closure');
  });
  await click(lov.getByTestId('lov-type-list').getByRole('button', { name: /THD_CLOSURE_ACTION/ }));
  await say('This list is THD underscore CLOSURE ACTION, the closure actions of a Technical Help Desk case. Each value has an order number, a display value which users see, and a code that the system creates by itself.', async () => {
    await point(lov.getByTestId('lov-values'));
  });
  const values = lov.getByTestId('lov-values').getByRole('textbox', { name: 'Display Value' });
  await say('To add values quickly, click inside a value row, and press Control and B. This copies the row, so you only change what is different.', async () => {
    await values.first().click();
    await keys('Control+b');
  });
  await say('The copy appears in red, with the message: Duplicate record cannot exist. A copy that is identical to the original can never be saved. If you do not want it, press Escape and it disappears.', async () => {
    await point(lov.getByTestId('lov-values'));
    await keys('Escape', 'Esc');
  });
  await say('Now let me add a real value. I click New Value, and type: Closed by Plant.', async () => {
    await click(lov.getByRole('button', { name: 'New Value' }));
    await page.keyboard.type('Closed by Plant', { delay: FAST ? 3 : 80 });
  });
  await say('The code is created automatically. To save, press Control and S.', async () => {
    await keys('Control+s');
    await toastSeen(/saved \(4 values\)/);
  });
  await say('Saved: the list now has four values. To retire a value you untick Active. Values are never deleted, so old records keep showing them.');
  await say('Now, creating a completely new list. Click New LOV Type.', async () => {
    await click(lov.getByRole('button', { name: 'New LOV Type' }));
  });
  const head = lov.getByTestId('lov-type-header');
  await say('Choose the module, here Job Card, and type the field name as users will see it: Vehicle Wash Type. The technical list name is proposed for you.', async () => {
    await head.getByLabel('Module').selectOption('JC');
    await type(head.getByLabel('Field Name (on screen)'), 'Vehicle Wash Type');
    await sleep(800);
    await click(lov.getByTestId('lov-values').getByRole('button', { name: 'Remove value' }));
  });
  await say('Add several values at once. Type or paste one per line, for example from Excel: Basic wash, Foam wash, Interior detailing. Then click Add to list.', async () => {
    await click(lov.getByRole('button', { name: 'Add several' }));
    await type(lov.getByLabel(/one per line/), 'Basic wash\nFoam wash\nInterior detailing');
    await click(lov.getByRole('button', { name: 'Add to list' }));
  });
  await say('Press Control and S to save the new list.', async () => {
    await keys('Control+s');
    await toastSeen(/JC_VEHICLE_WASH_TYPE saved/);
  });
  await say('The new list exists immediately and can be used as a dropdown. No developer and no deployment was needed.');
  await say('Table slash Excel view shows the same lists as one plain table. It is useful for exporting everything to Excel, or for importing many values together.', async () => {
    await click(lov.getByRole('button', { name: /Table \/ Excel view/ }));
  });
  await hush();

  // ============================================================ 3 Generic masters: add row, copy, esc
  await card('Part 3', 'Working in any master', ['The same behaviour in every master', '+ Add Row for a blank row · Ctrl+B to copy a row · Ctrl+S to save · Esc to cancel']);
  chapter = '4 · Working in any master';
  await open('/#/admin/masters?open=common');
  await click(page.getByRole('button', { name: /^PPL & PL \(Product Line\) Master/ }));
  const rows = page.locator('tbody tr[data-record-row]');
  await expect(rows.first()).toBeVisible();
  await say('Everything you learned about lists of values works the same way in every master. Here is the PPL and PL master, the vehicle product lines of Tata Motors.', async () => {
    await point(rows.first());
  });
  await say('To add a completely new record, click Add Row. A blank row appears at the top, so you can see exactly which fields must be entered.', async () => {
    await click(page.getByRole('button', { name: /\+ Add Row/ }));
  });
  await say('If you change your mind, press Escape. The unsaved row is removed.', async () => {
    await keys('Escape', 'Esc');
  });
  await say('To add a record that looks like an existing one, click that row and press Control and B.', async () => {
    await rows.first().focus();
    await point(rows.first());
    await keys('Control+b');
  });
  const copy = page.getByTestId('copy-row');
  await say('A copy appears right below, marked in amber and red because it is still identical to the original. Type over the values that are different. I change the PPL code to PPL dash DEMO dash 01 and write a new description.', async () => {
    await type(copy.getByLabel('PPL Code'), 'PPL-DEMO-01');
    await type(copy.getByLabel(/^PL \(Variant/), 'Demo variant for training');
  });
  await say('Now it is different from every other row. Press Control and S to save it.', async () => {
    await keys('Control+s');
    await toastSeen(/row\(s\) added/);
  });
  await say('Saved, right below the row it was copied from. The same keys work in every master of the application.');
  await hush();

  // ============================================================ 4 Rules
  await card('Part 4', 'Rules without coding', ['The TML Admin builds checks on screen', 'Required when, No duplicates, From to To, Allowed values, Must exist in another master, Number between, Format']);
  chapter = '5 · Rules';
  await say('Every master can have rules. A rule is a check that the application applies whenever a row is saved. Rules are built by picking a kind of check and filling in the blanks. Nobody writes code.', async () => {
    await click(page.getByRole('button', { name: /^Rules \(/ }));
  });
  const panel = page.getByTestId('rules-panel');
  await say('Click Add rule to create one.', async () => {
    await click(panel.getByRole('button', { name: 'Add rule' }));
  });
  const form = panel.getByTestId('rule-form');
  await say('There are seven kinds of rule. I choose No duplicates: a value may appear only once.', async () => {
    await click(form.getByRole('radio', { name: /No duplicates/ }));
  });
  await say('Then I tick the field that must be unique. Here, the PPL Code.', async () => {
    await click(form.getByRole('checkbox', { name: 'PPL Code' }));
  });
  await say('The rule is shown below as a plain sentence, so everyone can read it. Error refuses the row. Warning lets the row be saved and tells the user. I click Save rule.', async () => {
    await point(form);
    await click(form.getByRole('button', { name: 'Save rule' }));
  });
  await say('The rule is active at once, for saving, for new rows, for copies and for Excel uploads. Let me prove it. I copy a row with Control and B, and keep the same PPL code.', async () => {
    await rows.first().focus();
    await keys('Control+b');
    await type(copy.getByLabel(/^PL \(Variant/), 'Same code again');
  });
  await say('I press Control and S. The application refuses to save, and gives the rule as the reason. Then I press Escape to remove the row.', async () => {
    await keys('Control+s');
    await sleep(2500);
    await keys('Escape', 'Esc');
  });
  await hush();

  // ============================================================ 5 Upload a Master
  await card('Part 5', 'Upload a Master', ['Drop any Excel file; the page tells you what will happen', 'Nothing is saved until you press Import']);
  chapter = '6 · Upload a Master';
  await open('/#/admin/upload-master');
  await say('This is Upload a Master. It is one page for every Excel file. If the file is for an existing master, it must use that master own template. If it is any other table, it becomes a brand new master.');
  const input = page.getByLabel('Master Excel file');
  await say('First I upload a file whose column headings are wrong, on purpose.', async () => {
    await input.setInputFiles(sample('Sample_Upload_2_LOV_WrongColumns.xlsx'));
    await expect(page.getByTestId('header-problems')).toBeVisible();
  });
  await say('It is refused. The page lists the missing columns and the extra columns, and has a link to the correct template. Nothing was imported.', async () => {
    await point(page.getByTestId('header-problems'));
  });
  await say('Now the correct file, in the right template.', async () => {
    await input.setInputFiles(sample('Sample_Upload_1_LOV_Correct.xlsx'));
    await expect(page.getByText('Ready to import')).toBeVisible();
  });
  await say('The page says Ready to import, and tells you what will happen: here, three new rows. If a row carries an id that already exists, that row is updated. Empty cells keep their old value. Now I click Import.', async () => {
    await point(page.getByTestId('sheet-result'));
    await click(page.getByRole('button', { name: 'Import', exact: true }));
    await expect(page.getByTestId('upload-done')).toBeVisible();
  });
  await say('Imported. What if the same file is uploaded again?', async () => {
    await input.setInputFiles(sample('Sample_Upload_1_LOV_Correct.xlsx'));
    await expect(page.getByTestId('row-issues')).toBeVisible();
  });
  await say('It is refused: Duplicate record cannot exist, together with the Excel row number, so the business user knows exactly which row to fix.', async () => {
    await point(page.getByTestId('row-issues'));
  });
  await say('Last, a completely new table, which is not an existing master. The page recognises it and offers to create a new master from its columns.', async () => {
    await input.setInputFiles(sample('Sample_Upload_3_NewMaster.xlsx'));
    await expect(page.getByTestId('sheet-result')).toContainText('New master');
  });
  await say('I choose the module and give the master a name, Tyre Brand Upload, and click Import. No coding and no deployment.', async () => {
    await page.getByLabel('Module').selectOption('spd');
    await type(page.getByLabel('Master name'), 'Tyre Brand Upload');
    await click(page.getByRole('button', { name: 'Import', exact: true }));
    await expect(page.getByTestId('upload-done')).toBeVisible();
  });
  await say('Scroll down on this page for the templates of every existing master, the BA workbook templates and the practice files used in this video.', async () => {
    await page.mouse.wheel(0, 900);
    await sleep(800);
  });
  await hush();

  // ============================================================ 6 Employees
  await card('Part 6', 'Employees, skills & roles', ['Employee / Users now covers the whole workforce', 'Designation, shift, skills, certificates, availability and the roles they hold']);
  chapter = '7 · Employee / Users';
  await open('/#/admin/users');
  await say('Employee and Users keeps all its earlier tabs. The list now also shows designation, expertise and a skills badge. A badge saying Gap means a required skill or certificate is missing.');
  await say('Let me find an employee. I search for Priya Shinde, a Service Advisor.', async () => {
    await type(page.getByPlaceholder('Search user, ID, email...'), 'Priya Shinde');
  });
  await say('I click the eye icon to open the employee.', async () => {
    await click(page.getByTitle('View user details'));
  });
  await say('The Employment tab shows the designation, employment type, shift and status.', async () => {
    await click(page.getByTestId('drawer-tab-employment'));
  });
  await say('For a Service Advisor you must choose the expertise: Mechanical, Bodyshop, or Both. I choose Bodyshop, and click Save profile.', async () => {
    await point(page.getByTestId('expertise'));
    await click(page.getByTestId('expertise').getByRole('radio', { name: /^Bodyshop/ }));
    await click(page.getByRole('button', { name: 'Save profile' }));
  });
  await say('The expertise decides which job cards this advisor can create and which skill is required for the role.');
  await say('The Role and Views tab shows everything this employee sees: the screens, the landing cards, the worklist tabs, the columns and the permissions.', async () => {
    await click(page.getByTestId('drawer-tab-roleviews'));
    await page.getByTestId('role-views-tab').evaluate((el) => el.scrollIntoView());
    await sleep(1500);
  });
  await say('The Skills and Certificates tab shows skill levels from L1 to L4, certificate expiry dates, and the gaps against the role. You can add or remove skills here.', async () => {
    await click(page.getByTestId('drawer-tab-skills'));
    await point(page.getByTestId('gap-summary'));
  });
  await page.keyboard.press('Escape');
  await sleep(700);
  await say('Back on the page, the Skills and Certificates tab shows everyone against every skill, with gaps highlighted, certificates to renew, and Export to Excel.', async () => {
    await click(page.getByRole('button', { name: /Skills & Certificates/ }).first());
    await expect(page.getByTestId('skills-matrix')).toBeVisible();
    await page.mouse.wheel(0, 700);
    await sleep(1500);
  });
  await say('The Availability tab shows who is on duty by skill and shift, and the Service Advisors by expertise.', async () => {
    await click(page.getByRole('button', { name: /^Availability/ }));
    await expect(page.getByTestId('availability-panel')).toBeVisible();
    await point(page.getByTestId('advisor-expertise'));
  });
  await say('Who can do this? Pick a skill, a level and a shift, and the screen lists available people. For example, to allocate a bay for suspension and brake work.', async () => {
    await page.getByLabel('Skill needed').selectOption({ label: 'Suspension, Steering & Brakes' });
    await point(page.getByTestId('finder'));
  });
  await hush();

  // ============================================================ 7 Roles
  chapter = '8 · Roles & Position Types';
  await open('/#/admin/roles');
  await say('Roles and Access keeps the permissions matrix as before. The new Roles and Position Types tab lists every role in the application.', async () => {
    await click(page.getByRole('button', { name: /Roles & Position Types/ }));
  });
  const cat = page.getByTestId('role-catalogue');
  await say('Select a role, for example Service Advisor. You see how many people hold it, the screens, cards and tabs it sees, its permissions, and the skills and certificates it needs.', async () => {
    await click(cat.getByTestId('role-list').getByRole('button', { name: /^Service Advisor/ }));
    await cat.getByTestId('role-detail').evaluate((el) => el.scrollIntoView());
    await sleep(1500);
  });
  await say('Workshop roles that work in the dealer apps show their required skills and certificates too. Here, the Paint Specialist needs Paint Technology.', async () => {
    await click(cat.getByTestId('role-list').getByRole('button', { name: /^Paint Specialist/ }));
  });
  await hush();

  // ============================================================ 8 BA guide
  chapter = '9 · BA Guide';
  await open('/#/admin/masters-guide');
  await say('Finally, the BA Guide. It explains every step of this video, with downloads and practice files. Use the buttons at the top to jump to a section.');
  await say('For example, the section Easiest: Upload a Master.', async () => {
    await click(page.getByRole('navigation', { name: 'Guide contents' }).getByRole('button', { name: /Easiest: Upload a Master/ }));
    await sleep(1500);
  });
  await say('And the section on Rules, without coding.', async () => {
    await click(page.getByRole('navigation', { name: 'Guide contents' }).getByRole('button', { name: /Rules \(no coding\)/ }));
    await sleep(1500);
  });
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
