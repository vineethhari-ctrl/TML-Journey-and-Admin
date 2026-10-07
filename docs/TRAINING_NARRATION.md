# Training video — narration script

Read each line while the video shows it. Times are from the start of the video.

## Admin Portal & TML Journey

- **00:02** — [TML Service Transformation] Admin Portal & TML Journey. Training: masters, lists of values, Excel upload, rules, employees, roles and skills About 10 minutes · all data shown is test data

## 1 · Finding your way

- **00:07** — This is the Service Transformation portal. The left menu has the TML Journey screens and the Administration screens.
- **00:14** — Administration is where you maintain masters, upload Excel files, manage employees and roles. Press Ctrl + K any time to search for a screen.
- **00:27** — The BA Guide in the menu explains everything in this video, step by step, with practice files.

## Masters & Lists of Values

- **00:33** — [Part 1] Masters & Lists of Values. A master is a table of reference data: dealers, skills, statuses, dropdown lists… Dropdown lists of every module live in one place: the List of Values screen

## 2 · Masters & Lists of Values

- **00:39** — Masters Maintenance holds all reference data, grouped by module. Masters used by several modules sit under Common Masters.
- **00:47** — This is the List of Values screen. Every dropdown in the application is a list here. On the left are the lists, on the right the values of the selected list.
- **00:59** — The list name is the module and the field: THD_CLOSURE_ACTION. Each value has an order, a display value and an automatic code.
- **01:06** — To add values quickly, click in a row and press Ctrl + B. It copies the row.
- **01:10** — The copy is red: "Duplicate record cannot exist". An unchanged copy can never be saved. Press Esc to remove it.
- **01:22** — Type the new value. The code is created automatically. Save with Ctrl + S.
- **01:26** — Saved. To retire a value, untick Active. Values are never deleted, so old records keep showing them.
- **01:33** — To create a new list, press New LOV Type, choose the module and type the field name. The list name is proposed for you.
- **01:53** — Add several values at once, one per line, for example pasted from Excel. Then Ctrl + S.
- **01:58** — The new list exists immediately. No developer and no deployment is needed.
- **02:04** — Table / Excel view shows the same data as a plain table, for Excel export and import.

## Working in any master

- **02:09** — [Part 2] Working in any master. Same behaviour everywhere: + Add Row, Ctrl+B, Ctrl+S, Esc 15 new generic masters: departments, designations, skills, shifts, service types…

## 3 · Working in any master

- **02:17** — This is the PPL and PL master, the vehicle lines. Every master works the same way.
- **02:23** — + Add Row puts a blank row at the top, so you see exactly what must be entered. Press Esc to cancel it.
- **02:31** — To add a similar row, click a row and press Ctrl + B.
- **02:35** — A copy appears below. Type over the values that differ. While it is identical to the original, it is red and cannot be saved.
- **02:50** — Changed. Now press Ctrl + S to save.
- **02:54** — Saved, right below the row it was copied from.

## Rules without coding

- **02:56** — [Part 3] Rules without coding. The TML Admin builds checks on screen Required when, No duplicates, From ≤ To, Allowed values, Must exist in another master, Number between, Format

## 4 · Rules

- **03:03** — Every master has a Rules button. Rules are checks, built by picking a type and filling in the blanks.
- **03:10** — Choose the kind of rule. Here: No duplicates. The PPL Code must be unique.
- **03:17** — The rule is shown as a plain sentence. Choose Error to refuse the row, or Warning to save and tell the user.
- **03:25** — The rule is active at once, for saving, new rows, copies and Excel uploads.
- **03:37** — A copy that reuses an existing PPL Code is refused, with the rule as the reason.

## Upload a Master

- **03:43** — [Part 4] Upload a Master. Drop any Excel file; the page tells you what will happen Nothing is saved until you press Import

## 5 · Upload a Master

- **03:49** — Upload a Master is one page for every Excel file. An existing master must be in its own template. Any other table becomes a new master.
- **03:56** — First, a file with wrong column headings.
- **03:59** — It is refused. The page lists the missing and extra columns and links to the correct template. Nothing is imported.
- **04:05** — Now the correct file.
- **04:08** — Ready to import: 3 new rows. A row with an existing id would change that row. Empty cells keep their value.
- **04:15** — Imported. Uploading the same file again is refused as a duplicate.
- **04:20** — "Duplicate record cannot exist", with the Excel row number.
- **04:23** — A completely new table: the page creates a new master from its columns.
- **04:28** — Choose the module and the name, then Import. No coding or deployment.
- **04:34** — At the bottom: templates of every existing master, the BA workbook templates and practice files.

## Employees, skills & roles

- **04:40** — [Part 5] Employees, skills & roles. Employee / Users now covers the whole workforce Designation, shift, skills, certificates, availability and the roles they hold

## 6 · Employee / Users

- **04:45** — Employee / Users keeps all its old tabs. The list now shows designation, expertise and a skills badge. "Gap" means a required skill or certificate is missing.
- **04:58** — Click the eye icon to open the employee. Employment shows designation, shift and status.
- **05:05** — For a Service Advisor you must choose the expertise: Mechanical, Bodyshop, or Both.
- **05:17** — The expertise decides which job cards the advisor handles and which skill is required.
- **05:24** — Role and Views shows everything this role sees: screens, cards, worklist tabs, columns and permissions.
- **05:34** — Skills and Certificates: skill levels L1 to L4, certificate expiry, and the gaps against the role. Add or remove here.
- **05:44** — The Skills and Certificates tab shows everyone against every skill, with gaps highlighted, certificates to renew, and Export to Excel.
- **05:55** — Availability shows who is on duty by skill and shift, and the Service Advisors by expertise.
- **06:01** — "Who can do this?" finds available people for a skill, level and shift, for example to allocate a bay.

## 7 · Roles & Position Types

- **06:10** — Roles and Access keeps the permissions matrix. Roles and Position Types now lists every role in the application.
- **06:17** — For each role: how many people hold it, the screens, cards and tabs it sees, its permissions, and the skills and certificates it needs.
- **06:28** — Workshop roles that work in the dealer apps show their required skills and certificates, here Paint Technology.

## 8 · BA Guide

- **06:35** — The BA Guide explains every step, with downloads and practice files. Use the buttons at the top to jump to a section.

## Five things to remember

- **06:47** — [Remember] Five things to remember. 1 · Ctrl + B copies a row · Ctrl + S saves · Esc cancels 2 · An unchanged copy is a duplicate and is never saved 3 · Upload a Master: existing template, or any table for a new master 4 · Rules are set on screen, no coding 5 · Everything here is test data in this prototype

---
How to make a new video after the application changes: `npm run training-video` (records the real application with
captions, writes `training/output/TML-Admin-Portal-Training.webm` and a fresh `narration.md`); `FAST=1 npm run
training-video` is a quick dry run to check the script. Convert to MP4 with any video tool if needed.
