/**
 * BA Master Definition Workbook
 *
 * One Excel workbook can define any number of masters — their metadata, their
 * fields (with validation and dealer-app exposure) and their records — so the
 * BA team can prepare masters offline and load them into the Admin portal
 * without a code change or deployment.
 *
 * Sheets:
 *   README        – instructions (ignored on import)
 *   Masters       – one row per master
 *   Fields        – one row per field, linked to a master by Master ID
 *   <master_id>   – one sheet per master holding its records (header = field key or label)
 */
import * as XLSX from 'xlsx';
import {
  LOGICAL_MODULES,
  LogicalModuleGroup,
  MasterConfig,
  MasterFieldDef,
  ModuleCode,
  WORKSHOP_MODULES,
  DealerTargetModule,
} from '../data/masterCatalogue';
import { masterValidationSchema } from './masterValidationSchema';
import { mergeImportedRecords } from './recordMerge';
import { RULES_SHEET, RULE_COLUMNS, RULE_TYPES, evaluateRules, ruleFromRow, ruleToRow, sameRule } from './masterRules';

export const MASTERS_SHEET = 'Masters';
export const FIELDS_SHEET = 'Fields';
export const README_SHEET = 'README';

export const FIELD_TYPES: MasterFieldDef['type'][] = ['text', 'number', 'select', 'boolean', 'date'];
export const OWNERS: MasterConfig['owner'][] = ['TML_ADMIN', 'DEALER_ADMIN'];
export const DEALER_TARGETS: DealerTargetModule[] = ['vehicle_journey', 'job_card', 'reception', 'workshop_floor', 'general'];
export const MODULE_CODES = WORKSHOP_MODULES.map((m) => m.code);
export const LOGICAL_GROUPS = LOGICAL_MODULES.map((g) => g.id);

/** Masters rendered by dedicated consoles; their rows can't be managed through generic imports. */
export const PROTECTED_MASTER_IDS = [
  'bay_management_interactive',
  'holiday_calendar_master',
  'time_slot_quotas_master',
  'dealer_details_registry',
  'bodyshop_facility_master',
];

const MASTER_ID_RE = /^[a-z][a-z0-9_]{2,30}$/;
const FIELD_KEY_RE = /^[a-z][a-zA-Z0-9_]{0,48}$/;

export const MASTER_COLUMNS = ['Master ID', 'Master Name', 'Module Code', 'Logical Group', 'Owner', 'Category', 'Description'] as const;
export const FIELD_COLUMNS = [
  'Master ID',
  'Field Key',
  'Field Label',
  'Type',
  'Mandatory',
  'Options',
  'Min',
  'Max',
  'Min Date',
  'Max Date',
  'Pattern',
  'Pattern Error Message',
  'Show in Dealer App',
  'Dealer Target Module',
  'Dealer Label',
  'Value Mapping',
  'Description',
] as const;

export interface WorkbookIssue {
  severity: 'error' | 'warning';
  sheet: string;
  row?: number; // 1-based Excel row number (header is row 1)
  message: string;
}

export interface MasterImportSummary {
  id: string;
  name: string;
  action: 'create' | 'update' | 'skip';
  fieldCount: number;
  newFieldCount: number;
  recordCount: number;
}

export interface ParsedMasterWorkbook {
  /** Final master configs to save (created or updated); empty when there are errors. */
  masters: MasterConfig[];
  summary: MasterImportSummary[];
  issues: WorkbookIssue[];
  hasErrors: boolean;
}

export type ExistingMasterMode = 'skip' | 'update';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function slugifyMasterId(name: string): string {
  let id = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!/^[a-z]/.test(id)) id = `m_${id}`;
  if (!id.endsWith('_master')) id = `${id}_master`;
  return id.slice(0, 31).replace(/_+$/, '');
}

export function slugifyFieldKey(label: string): string {
  const key = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return /^[a-z]/.test(key) ? key.slice(0, 49) : `f_${key}`.slice(0, 49);
}

export const moduleNameFor = (code: ModuleCode) => WORKSHOP_MODULES.find((m) => m.code === code)?.title || code;

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());
const yes = (v: unknown) => ['y', 'yes', 'true', '1'].includes(str(v).toLowerCase());
const splitList = (v: unknown) =>
  str(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function parseValueMapping(v: unknown): Record<string, string> | undefined {
  const pairs = str(v)
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);
  const out: Record<string, string> = {};
  for (const p of pairs) {
    const idx = p.indexOf('=');
    if (idx > 0) out[p.slice(0, idx).trim()] = p.slice(idx + 1).trim();
  }
  return Object.keys(out).length ? out : undefined;
}

const formatValueMapping = (m?: Record<string, string>) =>
  m ? Object.entries(m).map(([k, v]) => `${k}=${v}`).join('; ') : '';

function sheetRows(wb: XLSX.WorkBook, name: string): Array<Record<string, any>> | null {
  const sheet = wb.Sheets[name];
  if (!sheet) return null;
  return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
}

/** Rows that are entirely blank are ignored (BAs often leave gaps). */
const isBlankRow = (r: Record<string, any>) => Object.values(r).every((v) => str(v) === '');

// ---------------------------------------------------------------------------
// Definition validation (shared with the "Create New Master" form)
// ---------------------------------------------------------------------------

export interface MasterDefinitionInput {
  id: string;
  name: string;
  moduleCode: string;
  logicalGroup: string;
  owner: string;
  category?: string;
  description?: string;
  fields: MasterFieldDef[];
}

/** Returns human-readable problems with a master definition (empty = valid). */
export function validateMasterDefinition(def: MasterDefinitionInput, takenIds: Iterable<string> = []): string[] {
  const errors: string[] = [];
  const taken = new Set(Array.from(takenIds, (t) => t.toLowerCase()));

  if (!def.name.trim()) errors.push('Master name is required.');
  if (!MASTER_ID_RE.test(def.id)) {
    errors.push(`Master ID "${def.id}" must be 3–31 characters: lowercase letters, digits and underscores, starting with a letter.`);
  } else if (taken.has(def.id.toLowerCase())) {
    errors.push(`Master ID "${def.id}" already exists.`);
  }
  if (!MODULE_CODES.includes(def.moduleCode as ModuleCode)) {
    errors.push(`Module code "${def.moduleCode}" is not valid. Use one of: ${MODULE_CODES.join(', ')}.`);
  }
  if (!LOGICAL_GROUPS.includes(def.logicalGroup as LogicalModuleGroup)) {
    errors.push(`Logical group "${def.logicalGroup}" is not valid. Use one of: ${LOGICAL_GROUPS.join(', ')}.`);
  }
  if (!OWNERS.includes(def.owner as MasterConfig['owner'])) {
    errors.push(`Owner "${def.owner}" is not valid. Use TML_ADMIN or DEALER_ADMIN.`);
  }
  if (def.fields.length === 0) errors.push('A master needs at least one field.');

  const seenKeys = new Set<string>();
  def.fields.forEach((f, i) => {
    const where = `Field ${i + 1}${f.label ? ` ("${f.label}")` : ''}`;
    errors.push(...validateFieldDefinition(f).map((e) => `${where}: ${e}`));
    if (seenKeys.has(f.key)) errors.push(`${where}: key "${f.key}" is used more than once.`);
    seenKeys.add(f.key);
  });
  return errors;
}

export function validateFieldDefinition(f: MasterFieldDef): string[] {
  const errors: string[] = [];
  if (!f.label.trim()) errors.push('label is required.');
  if (!FIELD_KEY_RE.test(f.key)) errors.push(`key "${f.key}" must start with a letter and use only letters, digits and underscores.`);
  if (f.key === 'id') errors.push('"id" is reserved for the record identifier.');
  if (!FIELD_TYPES.includes(f.type)) errors.push(`type "${f.type}" must be one of ${FIELD_TYPES.join(', ')}.`);
  if (f.type === 'select') {
    const opts = f.options || [];
    if (opts.length < 2) errors.push('dropdown fields need at least 2 options.');
    if (new Set(opts).size !== opts.length) errors.push('dropdown options must be unique.');
  }
  const v = f.validation;
  if (v?.min !== undefined && v?.max !== undefined && v.min > v.max) errors.push('Min cannot be greater than Max.');
  if (v?.minDate && v?.maxDate && v.minDate > v.maxDate) errors.push('Min Date cannot be after Max Date.');
  if (v?.pattern) {
    try {
      new RegExp(v.pattern);
    } catch {
      errors.push(`pattern "${v.pattern}" is not a valid regular expression.`);
    }
  }
  if (f.dealerTargetModule && !DEALER_TARGETS.includes(f.dealerTargetModule)) {
    errors.push(`dealer target "${f.dealerTargetModule}" must be one of ${DEALER_TARGETS.join(', ')}.`);
  }
  return errors;
}

/** Builds a MasterConfig from a validated definition. */
export function createMasterConfig(def: MasterDefinitionInput, records: Array<Record<string, any>> = []): MasterConfig {
  return {
    id: def.id,
    name: def.name.trim(),
    owner: def.owner as MasterConfig['owner'],
    category: def.category?.trim() || 'Custom Master',
    logicalGroup: def.logicalGroup as LogicalModuleGroup,
    moduleCode: def.moduleCode as ModuleCode,
    moduleName: moduleNameFor(def.moduleCode as ModuleCode),
    description: def.description?.trim() || '',
    fields: def.fields.map((f) => ({ ...f, isCustom: true })),
    records,
  };
}

// ---------------------------------------------------------------------------
// Build (template + export)
// ---------------------------------------------------------------------------

const README_LINES = [
  ['TML Master Definition Workbook'],
  [''],
  ['Use this workbook to define new masters (or add missing fields/records to existing ones) and load them'],
  ['in the Admin portal: Masters Maintenance → "Import BA Workbook". No code change or deployment needed.'],
  [''],
  ['SHEET "Masters" — one row per master'],
  ['  Master ID      lowercase_with_underscores, 3–31 chars, unique (e.g. tyre_brand_master). Also the name of its records sheet.'],
  ['  Master Name    Display name shown in the portal'],
  [`  Module Code    One of: ${MODULE_CODES.join(', ')}`],
  [`  Logical Group  One of: ${LOGICAL_GROUPS.join(' | ')}`],
  ['  Owner          TML_ADMIN (OEM-governed) or DEALER_ADMIN (dealer-editable)'],
  ['  Category / Description  Free text'],
  [''],
  ['SHEET "Fields" — one row per field; Master ID links it to the master'],
  ['  Field Key      lowercase key, e.g. brand_name (letters, digits, underscores; "id" is reserved)'],
  [`  Type           ${FIELD_TYPES.join(' | ')}`],
  ['  Mandatory      Y / N'],
  ['  Options        Dropdown values, comma separated (Type = select), e.g. MRF, CEAT, Apollo'],
  ['  Min / Max      Numeric limits (Type = number)'],
  ['  Min/Max Date   YYYY-MM-DD (Type = date)'],
  ['  Pattern        Optional regular expression for text, e.g. ^[A-Z]{3}-[0-9]{4}$'],
  ['  Show in Dealer App  Y / N — expose the field on dealer screens'],
  [`  Dealer Target Module  ${DEALER_TARGETS.join(' | ')}`],
  ['  Dealer Label   Optional label shown to dealers'],
  ['  Value Mapping  Optional "CODE=Dealer text; CODE2=Other text"'],
  [''],
  ['SHEET "Rules" (optional) — business rules, one row per rule; checked on every save and upload, no coding'],
  [`  Rule Type      ${RULE_TYPES.map((t) => t.type).join(' | ')}`],
  ...RULE_TYPES.map((t) => [`    ${t.type.padEnd(12)} ${t.hint} e.g. ${t.example}`]),
  ['  Field / When Field / Other Field   field key or label; Fields (No duplicates) and value lists are comma separated'],
  ['  When Values    condition values (blank = "is filled"); Allowed Values: values allowed while the condition holds'],
  ['  Min / Max      for "range"; Format: a pattern for "pattern"; Other Master / Other Master Field: for "exists_in"'],
  ['  Severity       error (row refused) or warning (saved, user warned); Message: optional own wording; Enabled: Y / N'],
  [''],
  ['RECORDS — one sheet per master, named exactly as its Master ID'],
  ['  Row 1 = column headers: "id" plus each Field Key (the Field Label also works).'],
  ['  "id" is optional; blank ids are generated. Booleans: Y/N. Dates: YYYY-MM-DD.'],
  ['  For an existing record, blank cells are left unchanged — you only need id + the columns you are filling in.'],
  [''],
  ['Adding things you missed later: add the new master/field/rows to a workbook and import it again with'],
  ['"Update existing masters" selected. Existing fields are never changed or removed by an import;'],
  ['records are matched by id (existing ids are updated, new ids are added).'],
];

export function buildMasterWorkbook(masters: MasterConfig[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(README_LINES), README_SHEET);

  const masterRows = masters.map((m) => [m.id, m.name, m.moduleCode, m.logicalGroup, m.owner, m.category, m.description]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...MASTER_COLUMNS], ...masterRows]), MASTERS_SHEET);

  const fieldRows = masters.flatMap((m) =>
    m.fields.map((f) => [
      m.id,
      f.key,
      f.label,
      f.type,
      f.mandatory ? 'Y' : 'N',
      (f.options || []).join(', '),
      f.validation?.min ?? '',
      f.validation?.max ?? '',
      f.validation?.minDate ?? '',
      f.validation?.maxDate ?? '',
      f.validation?.pattern ?? '',
      f.validation?.customErrorMessage ?? '',
      f.displayInDealerApp ? 'Y' : 'N',
      f.dealerTargetModule ?? '',
      f.dealerDisplayLabel ?? '',
      formatValueMapping(f.valueMapping),
      f.description ?? '',
    ])
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...FIELD_COLUMNS], ...fieldRows]), FIELDS_SHEET);

  const ruleRows = masters.flatMap((m) => (m.rules ?? []).map((r) => ruleToRow(m.id, r)));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...RULE_COLUMNS], ...ruleRows]), RULES_SHEET);

  masters.forEach((m) => {
    const header = ['id', ...m.fields.map((f) => f.key)];
    const rows = m.records.map((r) =>
      header.map((k) => {
        const v = r[k];
        if (typeof v === 'boolean') return v ? 'Y' : 'N';
        return v ?? '';
      })
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), m.id.slice(0, 31));
  });
  return wb;
}

/** A ready-to-fill template with one worked example master. */
export function buildTemplateWorkbook(): XLSX.WorkBook {
  const example: MasterConfig = createMasterConfig(
    {
      id: 'tyre_brand_master',
      name: 'Tyre Brand Master',
      moduleCode: 'bodyshop',
      logicalGroup: 'Parts, Claims & Support',
      owner: 'TML_ADMIN',
      category: 'Tyres & Wheels',
      description: 'Approved tyre brands and warranty periods (EXAMPLE — replace with your own masters)',
      fields: [
        { key: 'brand_code', label: 'Brand Code', type: 'text', mandatory: true, validation: { pattern: '^[A-Z]{3}$', customErrorMessage: 'Use a 3-letter code, e.g. MRF' } },
        { key: 'brand_name', label: 'Brand Name', type: 'text', mandatory: true },
        { key: 'segment', label: 'Segment', type: 'select', mandatory: true, options: ['PV', 'EV'], displayInDealerApp: true, dealerTargetModule: 'job_card', dealerDisplayLabel: 'Vehicle Segment', valueMapping: { PV: 'Passenger Vehicle', EV: 'Electric Vehicle' } },
        { key: 'warranty_months', label: 'Warranty (Months)', type: 'number', validation: { min: 0, max: 120 } },
        { key: 'effective_from', label: 'Effective From', type: 'date' },
        { key: 'active', label: 'Active', type: 'boolean' },
      ],
    },
    [
      { id: 'TYR-001', brand_code: 'MRF', brand_name: 'MRF Tyres', segment: 'PV', warranty_months: 60, effective_from: '2026-04-01', active: true },
      { id: 'TYR-002', brand_code: 'APL', brand_name: 'Apollo Tyres', segment: 'EV', warranty_months: 48, effective_from: '2026-04-01', active: true },
    ]
  );
  example.rules = [
    { id: 'RULE-EX1', type: 'unique', enabled: true, severity: 'error', fields: ['brand_code'] },
    { id: 'RULE-EX2', type: 'required_if', enabled: true, severity: 'error', field: 'effective_from', whenField: 'active', whenValues: ['Y'] },
    { id: 'RULE-EX3', type: 'range', enabled: true, severity: 'warning', field: 'warranty_months', min: 12, max: 72, message: 'Warranty is usually 12 to 72 months — please double-check.' },
  ];
  return buildMasterWorkbook([example]);
}

/**
 * Practice workbook for BA training: creates one new master AND adds a missed
 * field (with values) to an existing master — exercising both import modes.
 * Import it with "Update existing masters" selected.
 */
export function buildPracticeWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['PRACTICE WORKBOOK — import with "Update existing masters" selected'],
      [''],
      ['1. courtesy_car_master is a NEW master (3 fields, 3 records).'],
      ['2. ppl_master already exists: this file adds the missed field "ADAS Level" and fills it for PPL-01 and PPL-02.'],
      ['   Notice that the ppl_master sheet only has "id" and the new column — other values stay unchanged.'],
      ['3. Try breaking it on purpose (e.g. Max Days = 30, or Fuel = Hydrogen) to see how errors are reported.'],
    ]),
    README_SHEET
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [...MASTER_COLUMNS],
      ['courtesy_car_master', 'Courtesy Car Master', 'reception', 'Service Operations', 'DEALER_ADMIN', 'Customer Mobility', 'Loaner cars offered while the customer vehicle is in the workshop'],
      ['ppl_master', 'PPL & PL (Product Line) Master', 'jc_creation', 'Vehicle Data', 'TML_ADMIN', '', ''],
    ]),
    MASTERS_SHEET
  );
  const row = (vals: Partial<Record<(typeof FIELD_COLUMNS)[number], string | number>>) => FIELD_COLUMNS.map((c) => vals[c] ?? '');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [...FIELD_COLUMNS],
      row({ 'Master ID': 'courtesy_car_master', 'Field Key': 'reg_no', 'Field Label': 'Registration No', Type: 'text', Mandatory: 'Y', Pattern: '^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$', 'Pattern Error Message': 'Use a registration like MH01AB1234' }),
      row({ 'Master ID': 'courtesy_car_master', 'Field Key': 'fuel', 'Field Label': 'Fuel', Type: 'select', Mandatory: 'Y', Options: 'EV, Petrol, Diesel, CNG', 'Show in Dealer App': 'Y', 'Dealer Target Module': 'reception', 'Dealer Label': 'Courtesy Car Fuel' }),
      row({ 'Master ID': 'courtesy_car_master', 'Field Key': 'max_days', 'Field Label': 'Max Days', Type: 'number', Mandatory: 'N', Min: 1, Max: 7 }),
      row({ 'Master ID': 'ppl_master', 'Field Key': 'adas_level', 'Field Label': 'ADAS Level', Type: 'select', Mandatory: 'N', Options: 'L0, L1, L2', 'Show in Dealer App': 'Y', 'Dealer Target Module': 'vehicle_journey', 'Value Mapping': 'L0=No ADAS; L1=Level 1 ADAS; L2=Level 2 ADAS' }),
    ]),
    FIELDS_SHEET
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['id', 'Registration No', 'Fuel', 'Max Days'],
      ['CC-001', 'MH01ZZ0001', 'EV', 3],
      ['CC-002', 'MH01ZZ0002', 'Petrol', 5],
      ['CC-003', 'MH02ZZ0003', 'CNG', 2],
    ]),
    'courtesy_car_master'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['id', 'adas_level'],
      ['PPL-01', 'L2'],
      ['PPL-02', 'L1'],
    ]),
    'ppl_master'
  );
  return wb;
}

export function workbookToArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

/** Browser-only: saves a workbook as an .xlsx download. */
export function downloadWorkbook(wb: XLSX.WorkBook, fileName: string): void {
  const url = URL.createObjectURL(
    new Blob([workbookToArrayBuffer(wb)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readWorkbook(data: ArrayBuffer | Uint8Array): XLSX.WorkBook {
  return XLSX.read(data, { type: 'array', cellDates: true });
}

// ---------------------------------------------------------------------------
// Parse + validate
// ---------------------------------------------------------------------------

export function parseMasterWorkbook(
  wb: XLSX.WorkBook,
  existing: MasterConfig[],
  mode: ExistingMasterMode = 'skip'
): ParsedMasterWorkbook {
  const issues: WorkbookIssue[] = [];
  const err = (sheet: string, message: string, row?: number) => issues.push({ severity: 'error', sheet, row, message });
  const warn = (sheet: string, message: string, row?: number) => issues.push({ severity: 'warning', sheet, row, message });

  const masterRows = sheetRows(wb, MASTERS_SHEET);
  const fieldRows = sheetRows(wb, FIELDS_SHEET);
  if (!masterRows) err(MASTERS_SHEET, `Sheet "${MASTERS_SHEET}" is missing. Download the template to see the expected layout.`);
  if (!fieldRows) err(FIELDS_SHEET, `Sheet "${FIELDS_SHEET}" is missing. Download the template to see the expected layout.`);
  if (!masterRows || !fieldRows) return { masters: [], summary: [], issues, hasErrors: true };

  const existingById = new Map(existing.map((m) => [m.id.toLowerCase(), m]));

  // 1. Fields grouped by master
  const fieldsByMaster = new Map<string, MasterFieldDef[]>();
  fieldRows.forEach((r, i) => {
    if (isBlankRow(r)) return;
    const row = i + 2;
    const masterId = str(r['Master ID']).toLowerCase();
    if (!masterId) return err(FIELDS_SHEET, 'Master ID is empty.', row);
    const label = str(r['Field Label']);
    const type = str(r['Type']).toLowerCase() as MasterFieldDef['type'];
    const min = str(r['Min']);
    const max = str(r['Max']);
    const field: MasterFieldDef = {
      key: str(r['Field Key']) || slugifyFieldKey(label),
      label,
      type,
      mandatory: yes(r['Mandatory']),
      options: type === 'select' ? splitList(r['Options']) : undefined,
      displayInDealerApp: yes(r['Show in Dealer App']),
      dealerTargetModule: (str(r['Dealer Target Module']) || undefined) as DealerTargetModule | undefined,
      dealerDisplayLabel: str(r['Dealer Label']) || undefined,
      valueMapping: parseValueMapping(r['Value Mapping']),
      description: str(r['Description']) || undefined,
    };
    const validation: MasterFieldDef['validation'] = {};
    if (min !== '') validation.min = Number(min);
    if (max !== '') validation.max = Number(max);
    if (str(r['Min Date'])) validation.minDate = str(r['Min Date']);
    if (str(r['Max Date'])) validation.maxDate = str(r['Max Date']);
    if (str(r['Pattern'])) validation.pattern = str(r['Pattern']);
    if (str(r['Pattern Error Message'])) validation.customErrorMessage = str(r['Pattern Error Message']);
    if ((min !== '' && isNaN(validation.min!)) || (max !== '' && isNaN(validation.max!))) {
      err(FIELDS_SHEET, `Min/Max for "${label || field.key}" must be numbers.`, row);
    }
    if (Object.keys(validation).length) field.validation = validation;
    if (field.displayInDealerApp && !field.dealerTargetModule) field.dealerTargetModule = 'general';

    validateFieldDefinition(field).forEach((e) => err(FIELDS_SHEET, `${masterId} › ${label || field.key}: ${e}`, row));
    const list = fieldsByMaster.get(masterId) || [];
    if (list.some((f) => f.key === field.key)) err(FIELDS_SHEET, `${masterId}: field key "${field.key}" appears more than once.`, row);
    list.push(field);
    fieldsByMaster.set(masterId, list);
  });

  // 2. Masters
  const masters: MasterConfig[] = [];
  const summary: MasterImportSummary[] = [];
  const seenIds = new Set<string>();
  /** Ids of the rows that come from this workbook (rules are checked on these, not on rows saved earlier). */
  const fromFile = new Map<string, Set<string>>();

  masterRows.forEach((r, i) => {
    if (isBlankRow(r)) return;
    const row = i + 2;
    const id = str(r['Master ID']).toLowerCase();
    const name = str(r['Master Name']);
    if (seenIds.has(id)) return err(MASTERS_SHEET, `Master ID "${id}" appears more than once.`, row);
    seenIds.add(id);

    const fields = fieldsByMaster.get(id) || [];
    const current = existingById.get(id);

    if (current) {
      if (mode === 'skip') {
        warn(MASTERS_SHEET, `"${id}" already exists and was skipped. Choose "Update existing masters" to add fields/records to it.`, row);
        summary.push({ id, name: current.name, action: 'skip', fieldCount: current.fields.length, newFieldCount: 0, recordCount: 0 });
        return;
      }
      if (PROTECTED_MASTER_IDS.includes(id)) {
        return err(MASTERS_SHEET, `"${id}" is managed in its own console and can't be updated by import.`, row);
      }
      // Update: append fields that don't exist yet; never modify or remove existing ones
      const knownKeys = new Set(current.fields.map((f) => f.key));
      const newFields = fields.filter((f) => !knownKeys.has(f.key)).map((f) => ({ ...f, isCustom: true }));
      fields
        .filter((f) => knownKeys.has(f.key))
        .forEach((f) => warn(FIELDS_SHEET, `${id} › "${f.key}" already exists — its definition was left unchanged.`));
      const allFields = [...current.fields, ...newFields];
      const records = readRecords(wb, id, allFields, issues, current.records);
      const withDefaults = current.records.map((rec) => {
        const filled = { ...rec };
        newFields.forEach((f) => {
          if (filled[f.key] === undefined) filled[f.key] = f.type === 'boolean' ? false : '';
        });
        return filled;
      });
      masters.push({ ...current, fields: allFields, records: mergeImportedRecords(withDefaults, records, 'upsert') });
      fromFile.set(id, new Set(records.map((rec) => String(rec.id))));
      summary.push({ id, name: current.name, action: 'update', fieldCount: allFields.length, newFieldCount: newFields.length, recordCount: records.length });
      return;
    }

    const def: MasterDefinitionInput = {
      id,
      name,
      moduleCode: str(r['Module Code']).toLowerCase(),
      logicalGroup: str(r['Logical Group']),
      owner: str(r['Owner']).toUpperCase(),
      category: str(r['Category']),
      description: str(r['Description']),
      fields,
    };
    const defErrors = validateMasterDefinition({ ...def, fields: [] }).filter((e) => !e.startsWith('A master needs'));
    defErrors.forEach((e) => err(MASTERS_SHEET, `${id || '(no id)'}: ${e}`, row));
    if (fields.length === 0) err(FIELDS_SHEET, `${id}: no fields defined. Add at least one row for it in the "${FIELDS_SHEET}" sheet.`);
    const records = readRecords(wb, id, fields, issues);
    masters.push(createMasterConfig(def, records));
    fromFile.set(id, new Set(records.map((rec) => String(rec.id))));
    summary.push({ id, name, action: 'create', fieldCount: fields.length, newFieldCount: fields.length, recordCount: records.length });
  });

  fieldsByMaster.forEach((_, id) => {
    if (!seenIds.has(id)) err(FIELDS_SHEET, `Fields reference "${id}", which is not listed in the "${MASTERS_SHEET}" sheet.`);
  });
  if (seenIds.size === 0) err(MASTERS_SHEET, 'No masters found in the "Masters" sheet.');

  // 3. Rules (optional sheet): attached to the masters above, then checked against their rows
  const ruleRows = sheetRows(wb, Object.keys(wb.Sheets).find((n) => n.toLowerCase() === RULES_SHEET.toLowerCase()) ?? RULES_SHEET) ?? [];
  const allMasters = [...existing.filter((m) => !masters.some((x) => x.id === m.id)), ...masters];
  ruleRows.forEach((r, i) => {
    if (isBlankRow(r)) return;
    const row = i + 2;
    const id = str(r['Master ID']).toLowerCase();
    const at = masters.findIndex((m) => m.id === id);
    if (at < 0) {
      if (existingById.has(id) && mode === 'skip') return;
      return err(RULES_SHEET, `Master "${id}" is not in the "${MASTERS_SHEET}" sheet${existingById.has(id) ? ' (or was skipped)' : ''}.`, row);
    }
    const { rule, errors } = ruleFromRow(r, masters[at], allMasters);
    if (!rule) return errors.forEach((e) => err(RULES_SHEET, `${id}: ${e}`, row));
    const current = masters[at].rules ?? [];
    if (current.some((x) => sameRule(x, rule))) return warn(RULES_SHEET, `${id}: this rule already exists — left as it is.`, row);
    masters[at] = { ...masters[at], rules: [...current, rule] };
  });
  masters.forEach((m) => {
    if (!m.rules?.length) return;
    m.records.filter((rec) => fromFile.get(m.id)?.has(String(rec.id))).forEach((rec) =>
      evaluateRules(m, rec, { others: m.records, masters: allMasters }).forEach((v) =>
        (v.severity === 'error' ? err : warn)(m.id, `Row ${rec.id}: ${v.message}`)
      )
    );
  });

  const hasErrors = issues.some((i) => i.severity === 'error');
  return { masters: hasErrors ? [] : masters, summary, issues, hasErrors };
}

/** Reads and validates the records sheet for a master. Missing sheet = no records (allowed). */
function readRecords(
  wb: XLSX.WorkBook,
  masterId: string,
  fields: MasterFieldDef[],
  issues: WorkbookIssue[],
  existingRecords: Array<Record<string, any>> = []
): Array<Record<string, any>> {
  const existingById = new Map(existingRecords.map((rec) => [String(rec.id).toLowerCase(), rec]));
  const existingIds = existingRecords.map((rec) => String(rec.id));
  const sheetName = Object.keys(wb.Sheets).find((n) => n.toLowerCase() === masterId.slice(0, 31).toLowerCase());
  if (!sheetName) return [];
  const rows = sheetRows(wb, sheetName) || [];
  if (rows.length === 0) return [];

  // Map each column header to a field key (accepts the key or the label, case-insensitive)
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const headerToKey = new Map<string, string>();
  Object.keys(rows[0]).forEach((h) => {
    if (norm(h) === 'id') return headerToKey.set(h, 'id');
    const f = fields.find((x) => norm(x.key) === norm(h) || norm(x.label) === norm(h));
    if (f) headerToKey.set(h, f.key);
    else if (!/^__EMPTY/.test(h)) issues.push({ severity: 'warning', sheet: sheetName, message: `Column "${h}" doesn't match any field of ${masterId} and was ignored.` });
  });

  const prefix = masterId.replace(/_master$/, '').slice(0, 3).toUpperCase();
  const seen = new Set<string>();
  const taken = new Set(existingIds.map((x) => x.toLowerCase()));
  let counter = existingIds.length;
  // Blank ids get a generated one that can't collide with existing records (which an upsert would overwrite)
  const nextId = () => {
    let id = '';
    do id = `${prefix}-${String(++counter).padStart(3, '0')}`;
    while (taken.has(id.toLowerCase()) || seen.has(id.toLowerCase()));
    return id;
  };
  const out: Array<Record<string, any>> = [];
  rows.forEach((r, i) => {
    if (isBlankRow(r)) return;
    const row = i + 2;
    const raw: Record<string, any> = {};
    headerToKey.forEach((key, h) => (raw[key] = str(r[h])));
    raw.id = raw.id || nextId();
    if (seen.has(raw.id.toLowerCase())) {
      issues.push({ severity: 'error', sheet: sheetName, row, message: `Record id "${raw.id}" appears more than once.` });
      return;
    }
    seen.add(raw.id.toLowerCase());
    // A row matching an existing record may carry only some columns (e.g. a newly added field):
    // validate it merged with the stored record. New rows must satisfy every mandatory field.
    const base = existingById.get(String(raw.id).toLowerCase());
    if (base) {
      // Blank cells on an existing record mean "leave as is", not "clear the value"
      Object.keys(raw).forEach((k) => k !== 'id' && raw[k] === '' && delete raw[k]);
    }
    const res = masterValidationSchema.validateRecord(fields, base ? { ...base, ...raw } : raw, masterId);
    Object.values(res.errors).forEach((e) => issues.push({ severity: 'error', sheet: sheetName, row, message: e }));
    const sanitizedImported: Record<string, any> = { id: raw.id };
    Object.keys(raw).forEach((k) => (sanitizedImported[k] = res.sanitizedRecord[k]));
    out.push(base ? sanitizedImported : res.sanitizedRecord);
  });
  return out;
}

/** Saves parsed masters into the existing list (updates in place, new masters appended). */
export function applyMasterImport(existing: MasterConfig[], parsed: MasterConfig[]): MasterConfig[] {
  const byId = new Map(parsed.map((m) => [m.id, m]));
  const updated = existing.map((m) => byId.get(m.id) ?? m);
  const existingIds = new Set(existing.map((m) => m.id));
  return [...updated, ...parsed.filter((m) => !existingIds.has(m.id))];
}
