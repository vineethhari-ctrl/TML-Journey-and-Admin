import type { MasterConfig, MasterFieldDef } from './masterCatalogue';
import { STATUS_FIELD } from './lovMaster';

/**
 * THD (Technical Help Desk) masters, built from the BA workbooks
 * "THD Masters List" and "Conditions 4" (auto-THD trigger rules). The THD dropdown lists (progress, sub-status, closure
 * lists, attachment type) live in the Common LOV Master as THD_* lists (src/data/commonLov.ts).
 * User names in the BA sheet are replaced with test users because this repository is public.
 */

const STATUS = STATUS_FIELD;

const base = {
  owner: 'TML_ADMIN' as const,
  logicalGroup: 'Parts, Claims & Support' as const,
  moduleCode: 'thd' as const,
  moduleName: 'THD',
};

export const THD_USER_ROLES = ['Tech Executive L1', 'RTSM', 'COC L2', 'Plant', 'Product Reliability'];

export const THD_SCENARIOS = [
  'REPEAT_COMPLAINT',
  'CRITICAL_AT_JC_CREATION',
  'CRITICAL_AFTER_JC_CREATION',
  'DELAY_REASON',
  'QI_THD_REQUIRED',
  'OPEN_ESCALATION',
  'CRITICAL_DTC',
  'THD_UNATTENDED',
];

export const THD_TRIGGER_POINTS = ['Job Card Creation', 'Open Job Card', 'Job Card Closure', 'THD Age'];

const range = (key: string, label: string, max: number): MasterFieldDef => ({ key, label, type: 'number', mandatory: true, validation: { min: 0, max } });

export function buildThdMasters(ppls: string[]): MasterConfig[] {
  return [
    {
      ...base,
      id: 'thd_auto_trigger_rules',
      name: 'THD Auto-Trigger Rules',
      category: 'THD Rules',
      description:
        'When the system raises a THD case automatically (BA sheet "Conditions 4"). A blank Time Window means the value is still pending from business; that rule cannot fire until it is filled.',
      fields: [
        { key: 'ruleNo', label: 'Rule No.', type: 'number', mandatory: true, validation: { min: 1, max: 99 } },
        { key: 'scenarioCode', label: 'Scenario', type: 'select', options: THD_SCENARIOS, mandatory: true, description: 'What the system checks. Fixed list — each one is coded in the rules engine.' },
        { key: 'businessCondition', label: 'Business Condition', type: 'text', mandatory: true },
        { key: 'triggerPoint', label: 'Trigger Point', type: 'select', options: THD_TRIGGER_POINTS, mandatory: true },
        { key: 'windowValue', label: 'Time Window', type: 'number', defaultValue: '', validation: { min: 1, max: 999 }, description: 'e.g. 30 (days) for repeat visits, 24 (hours) for an unattended THD. Blank = pending from business.' },
        { key: 'windowUnit', label: 'Window Unit', type: 'select', options: ['Hours', 'Days'], defaultValue: '' },
        { key: 'triggerValues', label: 'Trigger Values', type: 'text', defaultValue: '', description: 'Comma-separated values the rule looks for, e.g. the Job Card delay reasons.' },
        { key: 'escalationComplaint', label: 'Escalation Complaint', type: 'select', options: ['Yes', 'No', 'Yes/No', 'NA'], mandatory: true },
        { key: 'thdTag', label: 'THD Tag', type: 'text', mandatory: true },
        { key: 'assignedTo', label: 'Assigned To', type: 'select', options: ['DET', 'Tech Executive L1'], mandatory: true },
        STATUS,
      ],
      records: [
        { id: 'THDR-01', ruleNo: 1, scenarioCode: 'REPEAT_COMPLAINT', businessCondition: 'Vehicle returns within 30 days of the previous Job Card closure and a complaint code in the new Job Card has the same Aggregate as one in the previous Job Card.', triggerPoint: 'Job Card Creation', windowValue: 30, windowUnit: 'Days', triggerValues: '', escalationComplaint: 'Yes/No', thdTag: 'Repeat Complaint / Escalation', assignedTo: 'DET', status: 'Active' },
        { id: 'THDR-02', ruleNo: 2, scenarioCode: 'CRITICAL_AT_JC_CREATION', businessCondition: 'A Critical Complaint (PPL-CC list) is added in the Job Card.', triggerPoint: 'Job Card Creation', windowValue: null, windowUnit: '', triggerValues: '', escalationComplaint: 'Yes/No', thdTag: 'Critical / Escalation', assignedTo: 'DET', status: 'Active' },
        { id: 'THDR-03', ruleNo: 3, scenarioCode: 'CRITICAL_AFTER_JC_CREATION', businessCondition: 'A Critical Complaint is added after the Job Card was created; the case is raised "X" hours after it was added.', triggerPoint: 'Open Job Card', windowValue: null, windowUnit: 'Hours', triggerValues: '', escalationComplaint: 'No', thdTag: 'Critical', assignedTo: 'DET', status: 'Active' },
        { id: 'THDR-04', ruleNo: 4, scenarioCode: 'DELAY_REASON', businessCondition: 'Job Card stays Open for more than "Y" hours with one of these delay reasons recorded.', triggerPoint: 'Job Card Closure', windowValue: null, windowUnit: 'Hours', triggerValues: 'Delayed Diagnosis, Under Investigation', escalationComplaint: 'No', thdTag: 'Delayed', assignedTo: 'DET', status: 'Active' },
        { id: 'THDR-05', ruleNo: 5, scenarioCode: 'QI_THD_REQUIRED', businessCondition: 'Quality Inspector marks "THD Required" in Pre-Quality Inspection while the Job Card is Open.', triggerPoint: 'Job Card Creation', windowValue: null, windowUnit: '', triggerValues: '', escalationComplaint: 'No', thdTag: 'Quality Inspection', assignedTo: 'DET', status: 'Active' },
        { id: 'THDR-06', ruleNo: 6, scenarioCode: 'OPEN_ESCALATION', businessCondition: 'An open escalated complaint exists against the chassis at Job Card creation.', triggerPoint: 'Job Card Creation', windowValue: null, windowUnit: '', triggerValues: '', escalationComplaint: 'Yes', thdTag: 'Escalated', assignedTo: 'DET', status: 'Active' },
        { id: 'THDR-07', ruleNo: 7, scenarioCode: 'CRITICAL_DTC', businessCondition: 'A critical DTC is received from the Connected Cloud platform for the vehicle.', triggerPoint: 'Job Card Creation', windowValue: null, windowUnit: '', triggerValues: '', escalationComplaint: 'NA', thdTag: 'DTC', assignedTo: 'DET', status: 'Active' },
        { id: 'THDR-08', ruleNo: 8, scenarioCode: 'THD_UNATTENDED', businessCondition: 'A THD case stays unattended by DET for more than 24 hours from creation; an auto request goes to Tech Executive L1 (Excel "Tech Executive/CC"; CC = Command Centre, handled as Tech Executive L1).', triggerPoint: 'THD Age', windowValue: 24, windowUnit: 'Hours', triggerValues: '', escalationComplaint: 'Yes/No', thdTag: 'Any tag', assignedTo: 'Tech Executive L1', status: 'Active' },
      ],
    },
    {
      ...base,
      id: 'thd_critical_complaints',
      name: 'THD Critical Complaints Master',
      category: 'THD Rules',
      description:
        'Complaint codes that automatically raise a THD case when added to a Job Card, mapped per PPL as in the CRM complaint master. A row without a PPL does not raise a case until its PPL is filled.',
      fields: [
        { key: 'ppl', label: 'PPL', type: 'select', options: ppls, defaultValue: '', description: 'One row per PPL + Complaint Code, as in the CRM complaint master. Needed to raise a case; a row without a PPL is listed as pending.' },
        { key: 'complaintCode', label: 'Complaint Code', type: 'text', mandatory: true },
        { key: 'complaintDescription', label: 'Complaint Description', type: 'text', mandatory: true },
        { key: 'aggregate', label: 'Aggregate', type: 'text', mandatory: true },
        { key: 'complaintType', label: 'Complaint Type', type: 'text', mandatory: true, defaultValue: 'Complaint' },
        { key: 'critical', label: 'Critical Complaint', type: 'select', options: ['Y', 'N'], mandatory: true },
        STATUS,
      ],
      records: [{ id: 'THDC-01', ppl: '', complaintCode: 'E32', complaintDescription: 'DIGITAL CLOCK NOT WORKING', aggregate: 'Electricals', complaintType: 'Complaint', critical: 'Y', status: 'Active' }],
    },
    {
      ...base,
      id: 'thd_kms_range',
      name: 'THD Kms Range Filter Master',
      category: 'THD Search Filters',
      description: 'Km ranges offered when searching THD cases (BA sheet "Kms Range"). From and To are inclusive.',
      fields: [{ key: 'label', label: 'Kms Range', type: 'text', mandatory: true }, range('fromKm', 'From Km', 999999), range('toKm', 'To Km', 999999), STATUS],
      records: [
        { id: 'KMR-01', label: '0 - 1,000', fromKm: 0, toKm: 1000, status: 'Active' },
        { id: 'KMR-02', label: '1,001 - 10,000', fromKm: 1001, toKm: 10000, status: 'Active' },
      ],
    },
    {
      ...base,
      id: 'thd_vehicle_age',
      name: 'THD Vehicle Age Filter Master',
      category: 'THD Search Filters',
      description: 'Vehicle age ranges (years) offered when searching THD cases (BA sheet "Vehicle Age"). From and To are inclusive.',
      fields: [{ key: 'label', label: 'Age (In Years)', type: 'text', mandatory: true }, range('fromYears', 'From (Years)', 50), range('toYears', 'To (Years)', 50), STATUS],
      records: [
        { id: 'AGE-01', label: '0 - 1', fromYears: 0, toYears: 1, status: 'Active' },
        { id: 'AGE-02', label: '0 - 5', fromYears: 0, toYears: 5, status: 'Active' },
      ],
    },
    {
      ...base,
      id: 'thd_users',
      name: 'THD Assignment Users Master',
      category: 'THD Users',
      description:
        'Users a THD request can be assigned to. One master for the five BA sheets (Tech Executive L1, RTSM, COC L2, Plant, Product Reliability) — the Role column says which list.',
      fields: [
        { key: 'role', label: 'Role', type: 'select', options: THD_USER_ROLES, mandatory: true },
        { key: 'bu', label: 'BU', type: 'select', options: ['PV', 'EV'], lovCode: 'COMMON_BU', mandatory: true },
        { key: 'userName', label: 'User Name', type: 'text', mandatory: true },
        { key: 'plantName', label: 'Plant Name', type: 'text', defaultValue: '', description: 'Required for Plant users.' },
        { key: 'zone', label: 'Zone', type: 'text', defaultValue: '' },
        { key: 'region', label: 'Region', type: 'text', defaultValue: '' },
        { key: 'crmUserId', label: 'CRM User ID', type: 'text', defaultValue: '' },
        { key: 'aggregate', label: 'Aggregate', type: 'text', defaultValue: '', description: 'COC L2 and Plant users can be limited to one aggregate.' },
        STATUS,
      ],
      records: [
        { id: 'THDU-01', role: 'Tech Executive L1', bu: 'PV', userName: 'Test User TE1', plantName: '', zone: '', region: 'West 1', crmUserId: 'TU_000101', aggregate: '', status: 'Active' },
        { id: 'THDU-02', role: 'RTSM', bu: 'PV', userName: 'Test User RTSM', plantName: '', zone: '', region: 'West 1', crmUserId: 'TU_000102', aggregate: '', status: 'Active' },
        { id: 'THDU-03', role: 'COC L2', bu: 'PV', userName: 'Test User COC', plantName: '', zone: 'West', region: 'West 1', crmUserId: 'TU_000103', aggregate: '', status: 'Active' },
        { id: 'THDU-04', role: 'Plant', bu: 'PV', userName: 'Test User Plant', plantName: 'Pune', zone: 'West', region: 'West 1', crmUserId: 'TU_000104', aggregate: '', status: 'Active' },
        { id: 'THDU-05', role: 'Product Reliability', bu: 'PV', userName: 'Test User PRT', plantName: '', zone: 'West', region: 'West 1', crmUserId: '', aggregate: '', status: 'Active' },
      ],
    },
  ];
}
