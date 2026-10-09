/**
 * Builds the "masters pack" for the Solution Architect and the BA leads (test data only):
 *   npm run master-pack      → build/master-pack/  (zip it: see the last line the script prints)
 * It contains every master with its fields, rules and rows, the draft classification (CRM / ST / business control), the list
 * of values, and the settings and provisions of the portal, as Excel / CSV / JSON plus the design documents.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { MASTER_COLLECTIONS, type MasterConfig } from '../src/data/masterCatalogue';
import { CLASS_LABEL, draftClassification, proposedIntegration, proposedSystemOfRecord } from '../src/data/masterClassification';
import { INITIAL_CONFIGURATION, INITIAL_ROLES } from '../src/data/mockDataGenerator';
import { ROLE_CATALOGUE } from '../src/data/roleCatalogue';
import { DEFAULT_WORKSHOP_POLICY } from '../src/data/workshopPolicy';
import { PLATFORM_PERMISSIONS } from '../src/utils/roleAccess';
import { viewsForRole } from '../src/utils/roleViews';
import { buildMasterWorkbook, PROTECTED_MASTER_IDS, workbookToArrayBuffer } from '../src/utils/masterWorkbook';
import { RULE_COLUMNS, ruleToRow } from '../src/utils/masterRules';
import { buildPublished } from '../src/utils/masterPublish';
import { baStatusOf } from '../src/data/confirmedBaMasters';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'build', 'master-pack');
fs.rmSync(out, { recursive: true, force: true });
['masters_csv', 'docs', 'backend'].forEach((d) => fs.mkdirSync(path.join(out, d), { recursive: true }));

const all = MASTER_COLLECTIONS; // every master, including the special ones (dealer registry, bays, calendars …)
const masters = all.filter((m) => !PROTECTED_MASTER_IDS.includes(m.id)); // those a BA workbook can define or update
const today = new Date().toISOString().slice(0, 10);
type Cell = string | number | boolean;
const sheet = (wb: XLSX.WorkBook, name: string, rows: Cell[][], widths: number[] = []) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = widths.map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
};
const yn = (b: unknown) => (b ? 'Y' : 'N');

// ------------------------------------------------------------------ the list of values
const lov = all.find((m) => m.id === 'common_lov')!;
const keyOf = (label: string) => lov.fields.find((f) => f.label === label)?.key ?? label;
const [kType, kModule, kField, kValue, kStatus] = ['LOV Type (Parameter)', 'Module', 'Field Name', 'Display Value', 'Status'].map(keyOf);
const lovTypes = [...new Set(lov.records.map((r) => String(r[kType])))].sort();
const usedBy = (type: string) => all.flatMap((m) => m.fields.filter((f) => f.lovCode === type).map((f) => `${m.name} › ${f.label}`));

// ------------------------------------------------------------------ the analysis workbook
const wb = XLSX.utils.book_new();
sheet(wb, 'README', [
  ['TML Service Transformation · Masters pack'],
  [`Built ${today} from the portal as it is today. TEST DATA ONLY: nothing here is real Tata Motors data.`],
  [],
  ['Sheet', 'What it holds'],
  ['Classification', 'Every master with a PROPOSED class: A CRM as-is, B new ST master, C CRM + business control. BA leads confirm or correct; the columns whose heading starts with CONFIRMED are for you. The simpler 2-question version is TML_BA_Master_Questionnaire.xlsx.'],
  ['Master Fields', 'Every field of every master: type, mandatory, dropdown list used, value mapping.'],
  ['LOV Types', 'Every list of values (dropdown) with its values, and which master fields use it. Source (CRM / ST) is for the BA to fill.'],
  ['Rules', 'Every business rule set on a master (no-code rules).'],
  ['System Configuration', 'Session, security, notification and journey settings with their defaults.'],
  ['Roles & Permissions', 'The Roles & Access matrix: module permissions per role.'],
  ['Role Catalogue', 'All roles: group, designation, screens / cards / tabs seen, required skills and certificates.'],
  ['Platform Permissions', 'The permission codes of each portal role.'],
  ['Workshop Policy', 'Default landing cards, worklist tabs and columns per role.'],
  ['Provisions', 'What the system provides around masters (behaviour, controls) and where each one is enforced.'],
  ['Backend Mapping', 'Which database table holds which master concept (docs/backend/schema.sql), and what is still to be added.'],
  [],
  ['Other files in this pack: TML_All_Masters_BA_Workbook.xlsx (all masters with rows, importable with Upload a Master), masters_csv/ (one CSV per master),'],
  ['masters_all.json (the "publish" format), docs/ (rules, upload, common masters, employee management), backend/ (PostgreSQL schema + tests, strategy note).'],
], [28, 140]);

sheet(wb, 'Classification', [
  ['Master ID', 'Master', 'Module', 'Group', 'BA status', 'Maintained by (today)', 'Proposed class', 'Proposed system of record', 'Proposed integration', 'Basis of the proposal',
   'Records', 'Fields', 'Rules', 'Dealer-specific?', 'Lists used', 'CONFIRMED CLASS (BA)', 'CONFIRMED System of record', 'Business control needed? (none / enable-disable / configure)', 'Control scope (ST functions)', 'Approver of control changes', 'Change frequency', 'BA lead / remarks', 'Can a BA workbook define / update it?'],
  ...all.map((m: MasterConfig) => {
    const d = draftClassification(m);
    return [
      m.id, m.name, m.moduleName, m.logicalGroup, baStatusOf(m), m.owner === 'TML_ADMIN' ? 'TML Admin' : 'Dealer Admin', CLASS_LABEL[d.masterClass], proposedSystemOfRecord(d.masterClass), proposedIntegration(d.masterClass), d.basis,
      m.records.length, m.fields.length, (m.rules ?? []).length, m.owner === 'DEALER_ADMIN' ? 'Y' : 'N', [...new Set(m.fields.map((f) => f.lovCode).filter(Boolean) as string[])].join(', '),
      '', '', d.controlHint ?? '', '', '', '', '', PROTECTED_MASTER_IDS.includes(m.id) ? 'N (special screen: use the portal)' : 'Y',
    ];
  }),
], [26, 40, 20, 20, 30, 16, 40, 28, 22, 70, 9, 8, 7, 10, 40, 22, 22, 44, 28, 22, 16, 30, 30]);

sheet(wb, 'Master Fields', [
  ['Master ID', 'Master', 'Field key', 'Field label', 'Type', 'Mandatory', 'Dropdown list (LOV type)', 'Options (fixed list)', 'Pattern / limits', 'Shown in dealer app', 'Description', 'SOURCE of field (CRM / ST) — BA to fill'],
  ...all.flatMap((m) =>
    m.fields.map((f) => [m.id, m.name, f.key, f.label, f.type, yn(f.mandatory), f.lovCode ?? '', f.lovCode ? '(from list)' : (f.options ?? []).join(', '),
      [f.validation?.pattern, f.validation?.min !== undefined ? `min ${f.validation.min}` : '', f.validation?.max !== undefined ? `max ${f.validation.max}` : ''].filter(Boolean).join(' · '), yn(f.displayInDealerApp), f.description ?? '', ''])
  ),
], [26, 36, 22, 28, 9, 9, 28, 40, 26, 10, 50, 30]);

sheet(wb, 'LOV Types', [
  ['LOV type', 'Module', 'Field name', 'Number of values', 'Active values', 'Values', 'Used by (master › field)', 'SOURCE (CRM / ST) — BA to fill', 'Remarks'],
  ...lovTypes.map((t) => {
    const rows = lov.records.filter((r) => String(r[kType]) === t);
    const active = rows.filter((r) => String(r[kStatus] ?? 'Active').toLowerCase() === 'active');
    return [t, String(rows[0]?.[kModule] ?? ''), String(rows[0]?.[kField] ?? ''), rows.length, active.length, rows.map((r) => r[kValue]).join(' | '), usedBy(t).join('; '), '', ''];
  }),
], [34, 10, 28, 10, 10, 90, 60, 24, 30]);

sheet(wb, 'Rules', [[...RULE_COLUMNS], ...all.flatMap((m) => (m.rules ?? []).map((r) => ruleToRow(m.id, r)))], [26, 22, 20, 20, 20, 20, 20, 20, 20, 40]);

const cfgGroup = (k: string) => (/session|idle|concurrent|forceLogout/i.test(k) ? 'Session' : /login|lock|password|device/i.test(k) ? 'Security' : /notif|alert|enabled/i.test(k) ? 'Notification' : 'Journey');
sheet(wb, 'System Configuration', [['Group', 'Setting', 'Default value'], ...Object.entries(INITIAL_CONFIGURATION).map(([k, v]) => [cfgGroup(k), k, String(v)])], [16, 38, 18]);

sheet(wb, 'Roles & Permissions', [
  ['Role', 'Description', 'Status', 'Module', 'View', 'Create', 'Edit', 'Approve', 'Delete', 'Export'],
  ...INITIAL_ROLES.flatMap((r) => r.permissions.map((p) => [r.name, r.description, r.status, p.module, yn(p.view), yn(p.create), yn(p.edit), yn(p.approve), yn(p.delete), yn(p.export)])),
], [26, 50, 10, 30, 6, 7, 6, 8, 7, 7]);

sheet(wb, 'Role Catalogue', [
  ['Role', 'Group', 'Side', 'Description', 'Works in', 'Designation', 'Portal screens', 'Landing cards', 'Worklist tabs', 'Required skills', 'Required certificates'],
  ...ROLE_CATALOGUE.map((r) => {
    const v = viewsForRole(r, DEFAULT_WORKSHOP_POLICY);
    return [r.name, r.group, r.side, r.description, r.modules.join(', '), r.designation ?? '', v.screens.map((s) => s.label).join('; '), v.cards.map((c) => c.label).join('; '), v.tabs.map((t) => t.label).join('; '), r.requiredSkills.join(', '), r.requiredCerts.join(', ')];
  }),
], [26, 18, 8, 50, 30, 22, 60, 50, 50, 24, 24]);

sheet(wb, 'Platform Permissions', [['Portal role', 'Permission code'], ...Object.entries(PLATFORM_PERMISSIONS).flatMap(([role, codes]) => codes.map((c) => [role, c]))], [20, 40]);

const flatten = (v: unknown, p: string[] = []): Array<[string, string]> =>
  v && typeof v === 'object' ? Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => flatten(x, [...p, k])) : [[p.join(' › '), Array.isArray(v) ? (v as unknown[]).join(', ') : String(v)]];
sheet(wb, 'Workshop Policy', [['Setting (role › area › item)', 'Default'], ...flatten(DEFAULT_WORKSHOP_POLICY)], [90, 30]);

sheet(wb, 'Provisions', [
  ['Area', 'What the system provides', 'Enforced where', 'Notes'],
  ['Masters are data', 'A master is a definition (fields, types, dropdown lists, rules) plus rows. New masters need no coding or deployment.', 'Portal + database (master_definition, master_field, master_record)', 'Created on screen, from a BA workbook or from any Excel table (Upload a Master).'],
  ['Common List of Values', 'One screen and one table for every dropdown. LOV type = MODULE_FIELD, one row per value, optional parent list / value, order, status.', 'Portal + database', 'Values are never deleted, only made Inactive, so old records keep showing them.'],
  ['Duplicate protection', '"Duplicate record cannot exist": an identical row cannot be saved, copied or uploaded.', 'Portal screens and Upload a Master; database unique rules to be added', 'Ctrl+B copies a row, Ctrl+S saves, Esc removes an unsaved row.'],
  ['No-code rules', 'Seven rule types: required when, no duplicates, from ≤ to, allowed values, must exist in another master, number range, format. Error refuses, warning informs.', 'Rules engine (portal); master_rule table', 'Rules apply to screen edits, copies and Excel uploads.'],
  ['Upload a Master', 'Existing master: its own template only, else refused with the column differences. Other table: becomes a new master. Preview before import; rows with an id update, rows without are added, blank cells keep old values.', 'Portal; import_job table', 'No AI is used at any point.'],
  ['Master ownership', 'Each master is maintained by TML Admin or Dealer Admin. Dealer-specific masters hold one dealer per record.', 'Portal + database (owner, dealer_code)', 'Draft CRM / ST classification: see the Classification sheet.'],
  ['Change history and audit', 'Every master edit is stored with before / after and user. Audit log is append-only.', 'Portal + database (master_record_history, master_definition_history, audit_log)', ''],
  ['Roles and access', '21 roles with views, module permissions and portal permission codes.', 'Portal today (simulated); real sign-in (SSO) and server checks to come with the backend', 'The prototype has no real login yet.'],
  ['Employees and skills', 'Designation, shift, skills with level L1–L4, certificates with expiry, Service Advisor expertise (Mechanical / Bodyshop / Both).', 'Portal + database (employee_profile, employee_skill, employee_certification)', ''],
  ['Sharing masters (stop-gap)', 'Publish all masters as one file; BAs send only their changed rows as Excel.', 'Portal (browser storage); a shared database replaces this', 'Test data only.'],
  ['Not yet provided', 'CRM sync, business control layer (enable / disable per ST function), shared multi-user editing, SSO.', 'To be built with the backend', 'See backend/MASTER_DATA_STRATEGY.md.'],
], [26, 90, 56, 54]);

sheet(wb, 'Backend Mapping', [
  ['Master concept', 'Table in docs/backend/schema.sql', 'Status'],
  ['Master definition (name, owner, module, group)', 'master_definition (+ master_definition_history)', 'Exists'],
  ['Field definition', 'master_field', 'Exists'],
  ['Rules', 'master_rule', 'Exists'],
  ['Rows of a master', 'master_record (jsonb data, row version, history in master_record_history)', 'Exists'],
  ['Excel imports', 'import_job', 'Exists'],
  ['Audit trail', 'audit_log (append-only)', 'Exists'],
  ['Dealers / divisions', 'dealer, division', 'Exists'],
  ['Users, roles, permissions', 'app_user, app_role, role_permission, user_role', 'Exists'],
  ['Employee profile, skills, certificates', 'employee_profile, employee_skill, employee_certification', 'Exists'],
  ['Source system, sync mode, control mode of a master', 'columns on master_definition', 'TO ADD'],
  ['CRM key and last sync of a record; CRM part vs ST part of a record', 'columns / split on master_record', 'TO ADD'],
  ['Business control (enable / disable / configure per ST function)', 'master_control (generic, any master) + control_scope', 'TO ADD'],
  ['CRM sync runs, staging and errors', 'master_sync_run, master_sync_item', 'TO ADD'],
  ['Source flag of a list of values and of its values', 'columns on LOV type / master_record of common_lov', 'TO ADD'],
], [56, 78, 12]);

fs.writeFileSync(path.join(out, 'TML_Masters_Pack.xlsx'), Buffer.from(workbookToArrayBuffer(wb)));

// ------------------------------------------------------------------ the masters themselves
fs.writeFileSync(path.join(out, 'TML_All_Masters_BA_Workbook.xlsx'), Buffer.from(workbookToArrayBuffer(buildMasterWorkbook(masters))));
fs.writeFileSync(path.join(out, 'masters_all.json'), JSON.stringify(buildPublished(all, 1, 'Masters pack (test data)', `Built ${today}`), null, 1));
all.forEach((m) => {
  const header = ['id', ...m.fields.map((f) => f.label)];
  const rows = m.records.map((r) => [r.id, ...m.fields.map((f) => (typeof r[f.key] === 'boolean' ? (r[f.key] ? 'Y' : 'N') : r[f.key] ?? ''))]);
  fs.writeFileSync(path.join(out, 'masters_csv', `${m.id}.csv`), '﻿' + XLSX.utils.sheet_to_csv(XLSX.utils.aoa_to_sheet([header, ...rows])));
});

// ------------------------------------------------------------------ documents
const copy = (from: string, to: string) => fs.existsSync(path.join(root, from)) && fs.copyFileSync(path.join(root, from), path.join(out, to));
['COMMON_MASTERS.md', 'MASTER_RULES.md', 'UPLOAD_A_MASTER.md', 'EMPLOYEE_MANAGEMENT.md'].forEach((f) => copy(`docs/${f}`, `docs/${f}`));
['schema.sql', 'schema_test.sql', 'README.md', 'MASTER_DATA_STRATEGY.md'].forEach((f) => copy(`docs/backend/${f}`, `backend/${f}`));

fs.writeFileSync(
  path.join(out, '00_READ_ME_FIRST.txt'),
  `TML Service Transformation - Masters pack (built ${today})
TEST DATA ONLY. Nothing in this pack is real Tata Motors data.

START HERE
  1. TML_Masters_Pack.xlsx          Classification (draft, to be confirmed), fields, lists of values, rules, settings, roles, provisions, backend mapping.
  2. backend/MASTER_DATA_STRATEGY.md  The CRM / ST / business-control approach and the backend design points.
  3. backend/schema.sql              The PostgreSQL design of today (tested), with schema_test.sql.

ALL MASTERS WITH THEIR ROWS
  TML_All_Masters_BA_Workbook.xlsx   Every master: definition, fields, rules and one sheet of rows per master. It is in the BA workbook
                                     format, so it can be loaded with Upload a Master.
  masters_csv/                       One CSV per master (id column + field labels).
  masters_all.json                   The same masters in the "publish" format used by the portal.

DOCUMENTS
  docs/                              Common masters, no-code rules, Upload a Master, employee management.

HOW THE CLASSIFICATION WORKS
  A  CRM master, used as it is (CRM is the System of Record; ST reads it through Solar or API)
  B  New ST master (maintained in the ST Portal)
  C  CRM master + business control (Business enables / disables / configures records inside ST without touching CRM)
  Every class is a PROPOSAL except PL / PPL (stated in the mail of 8 Oct). BA leads: use TML_BA_Master_Questionnaire.xlsx (two yes/no questions per master).

ABOUT EXCEL
  Excel is used here to DEFINE and LOAD masters: fields, lists, rules and rows. The checks themselves (duplicates, rules, access, audit,
  CRM sync) run in the portal and the database, not in Excel macros, so that everyone gets the same behaviour and a full history.
`
);
console.log(`master pack written to build/master-pack (${all.length} masters, ${masters.length} importable by BA workbook, ${lovTypes.length} list types)`);
console.log('zip it with: cd build && python3 -m zipfile -c TML_Masters_Pack.zip master-pack');
