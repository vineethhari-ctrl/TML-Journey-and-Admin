import type { MasterConfig } from './masterCatalogue';

/**
 * Common LOV Master: every dropdown list (List of Values) of every module in ONE master, one row per value.
 *
 *   Parameter (LOV Code)  = <MODULE>_<FIELD>, e.g. THD_COMPLAINT_TYPE — what a screen / master field refers to
 *   Module                = who owns the list (COMMON = shared by several modules)
 *   Field Name            = the label users see on the screen, e.g. "Type of Complaint"
 *   Value, Order, Status  = the dropdown entries, their order, Active / Inactive
 *   Parent LOV / Value    = dependent dropdowns: THD_PROGRESS_SUB_STATUS values belong to a THD_PROGRESS value
 *
 * A master field uses a list by setting `lovCode` (e.g. { type: 'select', lovCode: 'CLAIM_ISSUE_DESCRIPTION' }); its
 * options then always come from here, so a list is maintained once for every screen that uses it.
 */

export const COMMON_LOV_ID = 'common_lov';

/** Module prefixes of LOV codes (Module column). */
export const LOV_MODULES: Array<[string, string]> = [
  ['COMMON', 'Shared by several modules'],
  ['APPOINTMENT', 'Appointment Reminder'],
  ['PND', 'Pickup & Drop'],
  ['RECEPTION', 'Receptionist'],
  ['SECURITY', 'Security Guard'],
  ['JC', 'JC Creation - Mechanical'],
  ['BODYSHOP', 'JC Creation - Bodyshop'],
  ['JCT', 'JC Tracking'],
  ['EQC', 'eQC / Washing'],
  ['THD', 'THD'],
  ['SPD', 'SPD'],
  ['CLAIM', 'Auth. Request Approval & Service Claims'],
  ['JOURNEY', 'Customer Journey'],
  ['IRA', 'IRA'],
  ['ADMIN', 'Admin Portal'],
];

export const LOV_CODE_PATTERN = '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$';

export interface LovDefinition {
  code: string;
  module: string;
  fieldName: string;
  /** Where the list is used (shown in the LOV catalogue). */
  usedIn: string;
  values: string[];
  parentCode?: string;
  /** For dependent lists: each value's parent value, same order as `values`. */
  parentValues?: string[];
}

const SUB_STATUS: Array<[string, string[]]> = [
  ['Under Diagnosis', ['U/I DET', 'U/I COC', 'U/I Vendor', 'U/I Plant Team']],
  ['Work in process', ['WIP DET', 'WIP W/S Team', 'WIP Vendor']],
  ['Pending for parts', ['Order status', 'Part receipt status']],
  ['Pending for vendor support', ['Vendor details', 'Request raised', 'Status']],
  ['Pending for commercial decision', ['Pending for approval', 'Approval received']],
  ['Pending for Vehicle availability', ['Expected date', 'Status as on date']],
];

/** Lists transcribed from the BA workbooks (THD Masters List, Claims Masters List) plus shared lists. */
export const LOV_DEFINITIONS: LovDefinition[] = [
  { code: 'COMMON_BU', module: 'COMMON', fieldName: 'BU', usedIn: 'Every BU field of every module (PV and EV are separate values; a row for both BUs is entered once per BU)', values: ['PV', 'EV', 'CV'] },
  {
    code: 'THD_PROGRESS',
    module: 'THD',
    fieldName: 'Progress',
    usedIn: 'THD case progress (BA sheet "Progress LOV")',
    values: SUB_STATUS.map(([p]) => p),
  },
  {
    code: 'THD_PROGRESS_SUB_STATUS',
    module: 'THD',
    fieldName: 'Progress Sub Status',
    usedIn: 'THD case, shown after a Progress is chosen (BA sheet "Progress Sub Status")',
    values: SUB_STATUS.flatMap(([, subs]) => subs),
    parentCode: 'THD_PROGRESS',
    parentValues: SUB_STATUS.flatMap(([p, subs]) => subs.map(() => p)),
  },
  { code: 'THD_COMPLAINT_TYPE', module: 'THD', fieldName: 'Type of Complaint', usedIn: 'THD request closure', values: ['Technical Query', 'Technical Support'] },
  {
    code: 'THD_COMPLAINT_SHORT_DESC',
    module: 'THD',
    fieldName: 'Complaint Short Description',
    usedIn: 'THD request closure',
    values: [
      'Abnormal noise',
      'Warning lamps ON',
      'Oil leakage',
      'Coolant leakage',
      'Engine overheating',
      'Smell – burning, fuel, foul odor from outside, etc.',
      'Smoke issues',
      'Oil-Coolant mix',
      'Gear shifting issues',
      'AC cooling issues',
      'Jerking / vibration / misfiring',
      'Steering hard',
      'Vehicle pulling',
      'Starting problem',
      'Tyre wear / cut',
      'Damaged / broken / cracked / soiled',
      'Part missing / fallen-off',
      'Uneven gaps / flushness issues',
      'Paint / rust issues',
      'Not working / functioning issues / system malfunction',
      'Crash / airbag related issues',
      'Thermal issues',
      'Brake ineffective',
      'Poor pick-up',
      'Infotainment system issues',
      'Water entry in cabin',
    ],
  },
  {
    code: 'THD_ACTION_TAKEN',
    module: 'THD',
    fieldName: 'Action Taken',
    usedIn: 'THD request closure',
    values: [
      'Issue concluded and proceeded as per Field Investigation',
      'Suggested checks based on observations',
      'Known issue – suggested part replacement',
      'Updated software / parameterization',
      'Suggested part replacement based on observation',
      'Vehicle ready for delivery',
      'Vehicle not available; is with Customer',
    ],
  },
  {
    code: 'THD_DELAY_REASON',
    module: 'THD',
    fieldName: 'Reason for Delay',
    usedIn: 'THD request closure',
    values: [
      'Diagnosis and investigation',
      'Work content',
      'Non-availability of spare parts',
      'Non-availability of vehicle',
      'Dealer response',
      'Plant / ERC / vendor intervention',
      'Software / server / TDS Tool issue',
      'Solution not available',
      'Pending for Commercial Decision / Customer Approval',
      'Dealer not responding',
    ],
  },
  { code: 'THD_CLOSURE_ACTION', module: 'THD', fieldName: 'Closure Action', usedIn: 'THD request closure', values: ['Closed', 'Closed With Feedback', 'Closed With Early Warning'] },
  { code: 'THD_ATTACHMENT_TYPE', module: 'THD', fieldName: 'Attachment Type', usedIn: 'THD case attachments', values: ['DIR Report'] },
  { code: 'CLAIM_BUDGET_PURPOSE', module: 'CLAIM', fieldName: 'Allocation Purpose', usedIn: 'Yearly goodwill budget allocation', values: ['Approved Yearly Budget', 'Special Budget'] },
  { code: 'CLAIM_SPECIAL_GOODWILL', module: 'CLAIM', fieldName: 'Special Claim', usedIn: 'Identification tag on a Goodwill Authorization Request', values: ['IUPR', 'Thrive'] },
  { code: 'CLAIM_ISSUE_DESCRIPTION', module: 'CLAIM', fieldName: 'Issue Description', usedIn: 'Goodwill Request; Goodwill Request Category Mapping', values: ['Thermal Incident', 'Engine Failure'] },
  { code: 'CLAIM_COMPLAINT_TYPE', module: 'CLAIM', fieldName: 'Complaint Type', usedIn: 'AMC / Extended Warranty Authorization Request', values: ['Transmission', 'Clutch'] },
];

/** Masters replaced by the Common LOV Master (removed from saved browser data too). */
export const RETIRED_LOV_MASTER_IDS = [
  'thd_progress',
  'thd_progress_sub_status',
  'thd_complaint_type',
  'thd_complaint_short_desc',
  'thd_action_taken',
  'thd_delay_reason',
  'thd_closure_action',
  'thd_attachment_type',
  'claim_budget_purpose',
  'claim_special_goodwill',
  'claim_issue_description',
  'claim_complaint_type',
];

/** Where a shared master sits: the Common Masters group (owner stays as defined on each master). */
export const COMMON_PLACEMENT = {
  logicalGroup: 'Common Masters' as const,
  moduleCode: 'common' as const,
  moduleName: 'Common Masters',
};

export const COMMON_BASE = { owner: 'TML_ADMIN' as const, ...COMMON_PLACEMENT };

export function buildCommonLovMaster(): MasterConfig {
  return {
    ...COMMON_BASE,
    id: COMMON_LOV_ID,
    name: 'Common LOV Master (all dropdown lists)',
    category: 'Common Lists',
    description:
      'Every dropdown list of every module, one row per value. Parameter (LOV Code) = <MODULE>_<FIELD>, e.g. THD_COMPLAINT_TYPE; COMMON_ lists are shared by several modules. Dependent lists name their Parent LOV and Parent Value.',
    fields: [
      {
        key: 'lovCode',
        label: 'Parameter (LOV Code)',
        type: 'text',
        mandatory: true,
        validation: { pattern: LOV_CODE_PATTERN, customErrorMessage: 'Use <MODULE>_<FIELD> in capitals, e.g. THD_COMPLAINT_TYPE.' },
        description: 'What a screen or master field refers to: <MODULE>_<FIELD>, e.g. THD_COMPLAINT_TYPE.',
      },
      { key: 'module', label: 'Module', type: 'select', options: LOV_MODULES.map(([m]) => m), mandatory: true, description: 'Owner of the list; COMMON = used by several modules.' },
      { key: 'fieldName', label: 'Field Name', type: 'text', mandatory: true, description: 'Label of the dropdown on the screen, e.g. "Type of Complaint".' },
      { key: 'value', label: 'Value', type: 'text', mandatory: true },
      { key: 'order', label: 'Order', type: 'number', mandatory: true, validation: { min: 1, max: 999 }, description: 'Position in the dropdown.' },
      { key: 'parentLovCode', label: 'Parent LOV Code', type: 'text', defaultValue: '', description: 'Dependent dropdowns only: the list this value depends on.' },
      { key: 'parentValue', label: 'Parent Value', type: 'text', defaultValue: '', description: 'Dependent dropdowns only: the parent list value that shows this value.' },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], mandatory: true, defaultValue: 'Active' },
    ],
    records: LOV_DEFINITIONS.flatMap((d) =>
      d.values.map((value, i) => ({
        id: `${d.code}-${String(i + 1).padStart(2, '0')}`,
        lovCode: d.code,
        module: d.module,
        fieldName: d.fieldName,
        value,
        order: i + 1,
        parentLovCode: d.parentCode ?? '',
        parentValue: d.parentValues?.[i] ?? '',
        status: 'Active',
      })),
    ),
  };
}
