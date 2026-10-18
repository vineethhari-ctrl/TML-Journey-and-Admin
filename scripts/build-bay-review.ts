/**
 * Review workbook for the BA who sent the "Workshop Bay Operations Master Definition Workbook" (received 18 Oct 2026):
 *   npm run bay-review   →   build/TML_Bay_Operations_Masters_Review_v1.xlsx
 * The file is NOT called final. It shows (1) that the portal's own import accepts it, (2) questions about the content,
 * (3) where it overlaps with draft masters we already have, (4) the rules we understood from it, for the BA to confirm.
 * Static review content only: the BA's rows are not copied here. No portal / UI columns.
 */
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { RECEIVED_BA_MASTERS, RECEIVED_SOURCE } from '../src/data/receivedBaMasters';
import { WORKSHOP_MODULES } from '../src/data/masterCatalogue';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.join(root, 'build');
fs.mkdirSync(outDir, { recursive: true });

const NAVY = 'FF002244';
const YELLOW = 'FFFEF08A';
const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const headerRow = (ws: ExcelJS.Worksheet, heads: string[], yellowFrom: number) => {
  const r = ws.addRow(heads);
  r.height = 34;
  r.eachCell((c, col) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = fill(col >= yellowFrom ? 'FFB45309' : NAVY);
    c.alignment = { wrapText: true, vertical: 'middle' };
  });
};
const titleOf = (code: string) => WORKSHOP_MODULES.find((m) => m.code === code)?.title ?? code;

const wb = new ExcelJS.Workbook();

// ---------------------------------------------------------------- How to read
const help = wb.addWorksheet('How to read');
help.columns = [{ width: 130 }];
const rows = [
  ['TML Service Transformation: review of the Bay Operations masters'],
  [],
  [`Your file: ${RECEIVED_SOURCE}.`],
  ['Thank you for sending it. It gives us the first masters for JC Tracking and Appointment. We have NOT treated it as final: this review asks you to confirm or correct a few points first.'],
  [],
  ['The sheets'],
  ["   1. Import check: the portal's own import accepted your file with no errors and no warnings (10 masters, 50 fields, 52 rows)."],
  ['   2. Questions: points in the content that we could not decide ourselves. Each says where we looked (sheet and row ID of your file).'],
  ['   3. Overlaps: masters we already have as drafts, which look like the same thing as yours. Please tell us which one to keep.'],
  ['   4. Rules we understood: what your file seems to say as a rule. Please say whether we read it correctly.'],
  [],
  ['What to fill: only the yellow cells. Pick from the dropdown where there is one, and use Remarks for anything else.'],
  ['Nothing in your file has been changed.'],
];
rows.forEach((r) => help.addRow(r));
help.getCell('A1').font = { bold: true, size: 14, color: { argb: NAVY } };
help.getCell('A6').font = { bold: true };
help.getCell('A12').font = { bold: true, color: { argb: 'FFB45309' } };
help.eachRow((r) => (r.alignment = { wrapText: true, vertical: 'top' }));

// ---------------------------------------------------------------- Import check
const imp = wb.addWorksheet('Import check', { views: [{ state: 'frozen', ySplit: 1 }] });
imp.columns = [{ width: 36 }, { width: 24 }, { width: 16 }, { width: 10 }, { width: 10 }, { width: 70 }, { width: 38 }];
headerRow(imp, ['Master (your file)', 'Module', 'Owner', 'Fields', 'Rows', 'What it holds', 'Portal import result'], 99);
RECEIVED_BA_MASTERS.forEach((m) => {
  const r = imp.addRow([m.name, titleOf(m.moduleCode), m.owner === 'TML_ADMIN' ? 'TML Admin' : 'Dealer Admin', m.fields, m.rows, m.about, 'Accepted: no errors, no warnings']);
  r.getCell(7).fill = fill('FFD1FAE5');
  r.alignment = { vertical: 'top', wrapText: true };
});
const tot = imp.addRow(['Total', '', '', RECEIVED_BA_MASTERS.reduce((n, m) => n + m.fields, 0), RECEIVED_BA_MASTERS.reduce((n, m) => n + m.rows, 0), '', '']);
tot.font = { bold: true };

// ---------------------------------------------------------------- Questions
interface Q { master: string; where: string; found: string; why: string; suggest: string }
const QUESTIONS: Q[] = [
  { master: 'Technician Skill Level / Bay Skill Eligibility', where: 'technician_skill_level_master TSL-001; bay_skill_eligibility_master BSE-003',
    found: 'Grade L0 has "Can act as primary = N", but the Speedo bay row allows L0 as primary ("Allow L0 primary = Y", primary skills L0, L1, L2).',
    why: 'The two rules disagree, so the system cannot tell whether an L0 technician may be primary in a Speedo bay.',
    suggest: 'The bay rule wins: L0 may be primary only in Speedo.' },
  { master: 'Bay Type LOV / Bay Skill Eligibility / Appointment Slot Bay', where: 'bay_type_lov_master BTY-006 (Washing)',
    found: 'Washing is a bay type, but has no row in Bay Skill Eligibility and none in Appointment Slot Bay.',
    why: 'We do not know whether Washing has no skill limits and is never booked online, or whether the rows are missing.',
    suggest: 'Add Washing rows: no grade limit, not offered online.' },
  { master: 'Bay Type LOV', where: 'bay_type_lov_master (all 7 rows)',
    found: 'There is no EV bay type and no Fleet bay type. Our draft bays use "EV" for the EV high-voltage bay, and our division summary counts fleet bays.',
    why: 'Bay types become a fixed list, so every bay in a workshop must fit one of the 7 types.',
    suggest: 'Add EV (and Fleet if it is a bay type), or tell us which of the 7 an EV bay belongs to.' },
  { master: 'Service Job Skill Matrix', where: 'service_skill_matrix_master SMM-001 to SMM-008',
    found: 'Four combinations of service type and severity are missing: Free Service + Major, Running Repair + None, Aggregate Overhaul + None, Aggregate Overhaul + Minor.',
    why: 'For a missing combination the system has no answer for any grade.',
    suggest: 'Missing means "not applicable" (the combination cannot happen).' },
  { master: 'Service Job Skill Matrix', where: 'l0_competency, l1_competency (value "Needs Guide")',
    found: '"Needs Guide" is used for L0 and L1 in several rows.',
    why: 'We need to know what the system must do: block, warn, or require a higher-grade technician to be assigned with them.',
    suggest: 'Allow, but a higher-grade technician must also be assigned to the job.' },
  { master: 'Service Job Skill Matrix', where: 'job_service_type (Free Service, Paid Service, Running Repair, Aggregate Overhaul)',
    found: 'These four service types are not the same list as our draft Service Type Master (codes such as FREE_1).',
    why: 'Two lists of service types will not match each other.',
    suggest: 'Your four are a grouping of the service types: we add a "group" to each service type.' },
  { master: 'Bay Lift Type / Bay Equipment LOV', where: 'bay_lift_type_master BLT-001, BLT-002; bay_equipment_lov_master BEQ-001, BEQ-002',
    found: '"2-Post Lift" and "4-Post Lift" appear in both masters.',
    why: 'The same value is kept in two places and can drift apart.',
    suggest: 'Keep lifts only in Bay Lift Type and take them out of Bay Equipment.' },
  { master: 'Appointment Slot Bay', where: 'appointment_slot_bay_master ASB-001 to ASB-006',
    found: 'In every row, default online exposure plus fleet / walk-in reserve is exactly 100 (for example 80 + 20). The minimum online exposure is lower than or equal to the default.',
    why: 'If the reserve is always 100 minus the default, one field is enough and the other can be calculated, which avoids mistakes.',
    suggest: 'Yes: keep the default and the minimum, and calculate the reserve.' },
  { master: 'Appointment Slot Bay', where: 'min_online_exposure_pct',
    found: 'We read the minimum as the lowest share a dealer may offer online. Please confirm, and tell us who may change the default: TML only, or the dealer within the minimum.',
    why: 'This decides who can edit the percentages.',
    suggest: 'The dealer may set any value from the minimum up to 100.' },
  { master: 'Appointment Slot Bay', where: 'ASB-006 (Bodyshop: considered = N, default 0, reserve 100)',
    found: 'Bodyshop is never offered online and is fully reserved.',
    why: 'Confirms that bodyshop work is never booked in the online app.',
    suggest: 'Correct.' },
  { master: 'Workshop Shift Timing', where: 'Masters sheet: Owner = DEALER_ADMIN (the other nine masters are TML_ADMIN)',
    found: 'Shift timing is the only master owned by the dealer.',
    why: 'If every dealer keeps its own shifts, the 3 rows in your file are only TML defaults.',
    suggest: 'Each dealer maintains its own shifts; the 3 rows are the starting list.' },
  { master: 'Workshop Shift Timing', where: 'workshop_shift_timing_master WST-001 to WST-003',
    found: 'There is no shift code and no weekly off. Our draft Shift Master (and the employee records that use it) have a code such as GEN and a weekly off. Tea and lunch break minutes are given.',
    why: 'Employees refer to a shift by its code. We also need to know if break minutes are taken off the bookable hours of a bay.',
    suggest: 'Add a shift code; breaks are taken off the bookable hours.' },
  { master: 'Holiday Type & Exception', where: 'holiday_type_exception_master HTE-003 (Weekly Off, Sunday), allows_bay_exception',
    found: 'Weekly Off (Sunday) is listed as a holiday category, but weekly offs are set per weekday for each division in the holiday calendar.',
    why: 'We need to know if this category is for working on a Sunday (an exception), or is a duplicate of the weekly off setting. We also read "allows bay exception = Y" as "a bay may stay open on such a day".',
    suggest: 'It is for a division that works on a Sunday; the bay exception reading is correct.' },
  { master: 'Technician Skill Level', where: 'technician_skill_level_master (L0, L1, L2)',
    found: 'Your grades are L0 to L2. Our draft Skill Level (Proficiency) Master and the employee records use L1 to L4, where L1 is Trainee, L2 Technician, L3 Senior Technician and L4 Master Technician.',
    why: 'The same label means different things (your L1 = Standard Technician, ours L1 = Trainee).',
    suggest: 'Your L0, L1, L2 are the workshop grades; ours are a separate proficiency scale: please say how they map.' },
  { master: 'Bay Skill Eligibility', where: 'bay_skill_eligibility_master (max_technicians 2, max_supervisors 1 in every row)',
    found: 'The maximums are the same for every bay type, and match the bay form we have today (technician 1, technician 2, one supervisor).',
    why: 'We need to confirm that "2 technicians" means one primary and one secondary, and that all bay types really have the same maximum.',
    suggest: '2 = one primary and one secondary; same for all bay types.' },
];
const qs = wb.addWorksheet('Questions', { views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }] });
qs.columns = [{ width: 5 }, { width: 30 }, { width: 38 }, { width: 62 }, { width: 50 }, { width: 44 }, { width: 22 }, { width: 40 }];
headerRow(qs, ['#', 'Master', 'Where we looked (sheet and row ID of your file)', 'What we found', 'Why it matters', 'Our suggestion', 'Your answer', 'Remarks'], 7);
QUESTIONS.forEach((q, i) => {
  const r = qs.addRow([i + 1, q.master, q.where, q.found, q.why, q.suggest, '', '']);
  r.getCell(7).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Agree with the suggestion,Different (see Remarks),Need to discuss"'] };
  for (const col of [7, 8]) r.getCell(col).fill = fill(YELLOW);
  r.alignment = { vertical: 'top', wrapText: true };
});
qs.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } };

// ---------------------------------------------------------------- Overlaps
interface Ov { mine: string; existing: string; same: string; differs: string; proposal: string }
const OVERLAPS: Ov[] = [
  { mine: 'Bay Type LOV Master', existing: 'Bay Management Master (bay type list)',
    same: 'Mechanical, Electrical, Speedo, AC, Bodyshop.',
    differs: 'Yours adds Wheel Alignment and Washing and has no EV or Fleet. Names differ: "AC Bay" / "AC", "Bodyshop" / "BodyShop".',
    proposal: 'Your list becomes the bay type list for the bay form; we move the bays to it once you answer the EV and Fleet question.' },
  { mine: 'Bay Equipment LOV Master', existing: 'Bay Management Master (special equipment on a bay)',
    same: 'Nut Runner, EV Charger.',
    differs: 'Ours also has "Oil Dispensing Unit" (yours: "Oil Dispenser Unit") and "Brake rivet machine" (yours: "Brake Lathe Machine"); yours adds TDS Diagnostic Tool and 2 lifts.',
    proposal: 'Your list becomes the list of equipment to choose from. Please confirm the two names that differ are the same equipment.' },
  { mine: 'Bay Lift Type Master', existing: 'Bay Management Master (lift availability)',
    same: 'No Lift, 2-post lift, 4-post lift.',
    differs: 'Spelling only: "2 post lift" / "2-Post Lift".',
    proposal: 'Use your list.' },
  { mine: 'Floor Level Master', existing: 'Bay Management Master (floor)',
    same: 'Ground, first, second floor, basement.',
    differs: 'Ours: "Ground", "Floor 1", "Floor 2", "Basement". Yours: "Ground Floor", "First Floor", "Second Floor", "Basement" with a floor code.',
    proposal: 'Use your list (it has a code).' },
  { mine: 'Technician Skill Level Master', existing: 'Skill Level (Proficiency) Master, and the skill choice in Bay Technician Roster',
    same: 'Both grade technicians.',
    differs: 'Yours: L0 to L2 (L1 = Standard Technician). Ours: L1 to L4 (L1 = Trainee). The roster uses L0, L1, L2 and "Diagnostic Master".',
    proposal: 'Two different scales: please tell us how they map (question 14). Then we keep both or merge them.' },
  { mine: 'Service Job Skill Matrix Master', existing: 'Service Type Master',
    same: 'Both list types of service.',
    differs: 'Yours has 4 service types with a severity. Ours has about 12 service types with codes (FREE_1 and so on) and a job type.',
    proposal: 'Yours is a grouping on top of ours (question 6). We add the group to the service type.' },
  { mine: 'Bay Skill Eligibility Master', existing: 'Bay - Technician & Supervisor Roster',
    same: 'Both say who works in a bay.',
    differs: 'Ours is a list of technicians per bay (names, grade, type). Yours is a rule: which grades may work in which bay type, and how many.',
    proposal: 'Keep both: the roster is checked against your rule.' },
  { mine: 'Appointment Slot Bay Master', existing: 'Time Slot Quotas & Hourly Capacity',
    same: 'Both limit how much can be booked.',
    differs: 'Ours: capacity, buffer and dedicated bays per hour. Yours: online share and fleet / walk-in reserve per bay type.',
    proposal: 'Keep both, but confirm they do not both limit the same booking. Which one wins if they disagree?' },
  { mine: 'Workshop Shift Timing Master', existing: 'Shift Master',
    same: 'General shift 09:00 to 18:00 / 09:00 to 19:00 and more shifts.',
    differs: 'Ours: shift code, weekly off, "Early", "Late", "Night". Yours: tea and lunch breaks, "Morning", "Evening". Times differ (General ends 18:00 / 19:00).',
    proposal: 'Merge into one shift master: your breaks plus our shift code and weekly off (question 12).' },
  { mine: 'Holiday Type & Exception Master', existing: 'Non-Operational Hours & Holiday Calendar',
    same: 'Both are about holidays.',
    differs: 'Ours is the dated calendar, with a type: National Holiday, Festival Closure, State Holiday, Quarterly Maintenance. Yours is the list of categories, with duration and exception.',
    proposal: 'Not a duplicate: your list becomes the list of types for our calendar. Please confirm the five categories replace our four types.' },
];
const ov = wb.addWorksheet('Overlaps', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
ov.columns = [{ width: 34 }, { width: 40 }, { width: 38 }, { width: 62 }, { width: 56 }, { width: 28 }, { width: 40 }];
headerRow(ov, ['Master in your file', 'Draft master we already have', 'What is the same', 'What differs', 'Our proposal', 'Your decision', 'Remarks'], 6);
OVERLAPS.forEach((o) => {
  const r = ov.addRow([o.mine, o.existing, o.same, o.differs, o.proposal, '', '']);
  r.getCell(6).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Use the master in my file,Keep the draft master,Merge both,Need to discuss"'] };
  for (const col of [6, 7]) r.getCell(col).fill = fill(YELLOW);
  r.alignment = { vertical: 'top', wrapText: true };
});
ov.addRow([]);
ov.addRow(['Note: the draft masters on our side were created as demonstration masters before any BA list was received. None of them is final.']).font = { italic: true };

// ---------------------------------------------------------------- Rules we understood
const RULES: [string, string, string][] = [
  ['Bay Skill Eligibility', 'A technician can be primary in a bay only if their grade is in the "allowed primary skills" of the bay type, and secondary only if it is in the "allowed secondary skills".', 'bay_skill_eligibility_master'],
  ['Bay Skill Eligibility', 'A bay has at most the "max technicians" and "max supervisors" of its bay type (today 2 and 1 for every type).', 'bay_skill_eligibility_master'],
  ['Technician Skill Level', 'A grade with "Can act as primary = N" cannot be primary technician, except where the bay rule allows it (L0 in Speedo only).', 'technician_skill_level_master, bay_skill_eligibility_master'],
  ['Service Job Skill Matrix', 'For a job (service type and severity), each grade is Can Do, Needs Guide or Cannot Do. Cannot Do blocks the assignment; Needs Guide needs a higher-grade technician as well.', 'service_skill_matrix_master'],
  ['Appointment Slot Bay', 'Only bay types with "considered for online app = Y" are offered in the online app. For those, the share offered online is the default exposure, never lower than the minimum; the rest is kept for fleet and walk-in.', 'appointment_slot_bay_master'],
  ['Holiday Type & Exception', 'On a holiday of a category with "allows bay exception = Y", a dealer may keep selected bays open; "Partial Open" means open for half the day; a National Holiday never allows an exception.', 'holiday_type_exception_master'],
];
const ru = wb.addWorksheet('Rules we understood', { views: [{ state: 'frozen', ySplit: 1 }] });
ru.columns = [{ width: 5 }, { width: 30 }, { width: 100 }, { width: 38 }, { width: 22 }, { width: 44 }];
headerRow(ru, ['#', 'From master', 'The rule as we read it', 'Where in your file', 'Did we read it correctly?', 'Remarks (what is different)'], 5);
RULES.forEach(([m, text, where], i) => {
  const r = ru.addRow([i + 1, m, text, where, '', '']);
  r.getCell(5).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] };
  for (const col of [5, 6]) r.getCell(col).fill = fill(YELLOW);
  r.alignment = { vertical: 'top', wrapText: true };
});

const target = path.join(outDir, 'TML_Bay_Operations_Masters_Review_v1.xlsx');
await wb.xlsx.writeFile(target);
console.log(`review written: ${RECEIVED_BA_MASTERS.length} masters, ${QUESTIONS.length} questions, ${OVERLAPS.length} overlaps, ${RULES.length} rules → ${path.relative(root, target)}`);
