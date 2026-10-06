import type { MasterConfig } from './masterCatalogue';
import { STATUS_FIELD } from './lovMaster';

/**
 * Claims masters (Goodwill, Warranty / AMC / EW authorisation), built from the BA workbook "Claims Masters List".
 * The Claims dropdown lists live in the Common LOV Master as CLAIM_* lists (src/data/commonLov.ts).
 * Not masters, as the BA remarks say: Division-wise CCM/ACCM mapping and KAM users are handled in User Management.
 * User names in the BA sheet are replaced with test users because this repository is public.
 */

const base = {
  owner: 'TML_ADMIN' as const,
  logicalGroup: 'Parts, Claims & Support' as const,
  moduleCode: 'claim' as const,
  moduleName: 'Auth. Request Approval & Service Claims',
};

export const GOODWILL_CATEGORIES = ['Red', 'Amber', 'Green'];
export const GUIDELINE_REQUEST_TYPES = ['AMC', 'Extended Warranty'];

export function buildClaimMasters(): MasterConfig[] {
  return [
    {
      ...base,
      id: 'claim_goodwill_category',
      name: 'Goodwill Request Category Mapping',
      category: 'Claim Rules',
      description:
        'Issue Description → Issue Type and Request Category (Red / Amber / Green) of a Goodwill Request (BA sheet "Goodwill Req Catagory Mapping"). One row per Issue Description.',
      fields: [
        { key: 'issueDescription', label: 'Issue Description', type: 'select', lovCode: 'CLAIM_ISSUE_DESCRIPTION', options: ['Thermal Incident', 'Engine Failure'], mandatory: true, description: 'Values come from the Common LOV Master list CLAIM_ISSUE_DESCRIPTION.' },
        { key: 'issueType', label: 'Issue Type', type: 'text', mandatory: true },
        { key: 'requestCategory', label: 'Request Category', type: 'select', options: GOODWILL_CATEGORIES, mandatory: true },
        STATUS_FIELD,
      ],
      records: [
        { id: 'GWC-01', issueDescription: 'Thermal Incident', issueType: 'Catastrophic Situation', requestCategory: 'Red', status: 'Active' },
        { id: 'GWC-02', issueDescription: 'Engine Failure', issueType: 'Minor Product Failure', requestCategory: 'Amber', status: 'Active' },
      ],
    },
    {
      ...base,
      id: 'claim_warranty_approval_matrix',
      name: 'AMC / Warranty Authorization Approval Matrix',
      category: 'Claim Rules',
      description:
        'Who approves an Authorization Request, level by level (BA sheet "Warranty Approval Matrix" and BA answers). A level with Can Approve = Y approves amounts up to and including its limit; a blank limit means no upper limit. Otherwise the request moves to the next level. After the Reminder hours the pending approver gets a notification and an email only; nothing is escalated automatically.',
      fields: [
        { key: 'level', label: 'Level', type: 'number', mandatory: true, validation: { min: 1, max: 9 } },
        { key: 'persona', label: 'Persona', type: 'text', mandatory: true },
        { key: 'canApprove', label: 'Can Approve', type: 'select', options: ['Y', 'N'], mandatory: true },
        { key: 'approvesUpTo', label: 'Approves Up To (₹)', type: 'number', defaultValue: '', validation: { min: 1, max: 100000000 }, description: 'Inclusive. Blank with Can Approve = Y means no upper limit.' },
        { key: 'actions', label: 'Action / Authority', type: 'text', mandatory: true, description: 'Comma-separated actions available to this persona.' },
        { key: 'forwardTo', label: 'Forwards To', type: 'text', defaultValue: '', description: 'Persona of the next level, for amounts this level cannot approve.' },
        { key: 'reminderHours', label: 'Reminder (Hrs)', type: 'number', mandatory: true, validation: { min: 1, max: 720 } },
        { key: 'reminderVia', label: 'Reminder Via', type: 'text', mandatory: true, defaultValue: 'Notification + Email', description: 'BA: a notification and an email only — no automatic escalation.' },
        STATUS_FIELD,
      ],
      records: [
        { id: 'WAM-01', level: 1, persona: 'Claim Manager', canApprove: 'Y', approvesUpTo: 20000, actions: 'Approve, Send to CCM/ACCM', forwardTo: 'CCM/ACCM', reminderHours: 24, reminderVia: 'Notification + Email', status: 'Active' },
        { id: 'WAM-02', level: 2, persona: 'CCM/ACCM', canApprove: 'N', approvesUpTo: null, actions: 'Send to SHQ Lead 1, Send Back for Correction', forwardTo: 'SHQ Lead 1', reminderHours: 24, reminderVia: 'Notification + Email', status: 'Active' },
        { id: 'WAM-03', level: 3, persona: 'SHQ Lead 1', canApprove: 'Y', approvesUpTo: null, actions: 'Approve', forwardTo: '', reminderHours: 24, reminderVia: 'Notification + Email', status: 'Active' },
      ],
    },
    {
      ...base,
      id: 'claim_service_guideline',
      name: 'AMC / EW Service Guideline File Master',
      category: 'Claim Documents',
      description:
        'Guideline file the Claim Manager downloads before submitting an AMC or Extended Warranty Authorization Request. The BA workbook lists this master as pending — add one active file per request type and BU.',
      fields: [
        { key: 'requestType', label: 'Request Type', type: 'select', options: GUIDELINE_REQUEST_TYPES, mandatory: true },
        { key: 'bu', label: 'BU', type: 'select', options: ['PV', 'EV', 'CV'], lovCode: 'COMMON_BU', mandatory: true },
        { key: 'fileName', label: 'Guideline File', type: 'text', mandatory: true, description: 'File name or link of the PDF.' },
        { key: 'version', label: 'Version', type: 'text', mandatory: true },
        { key: 'effectiveFrom', label: 'Effective From', type: 'date', mandatory: true },
        STATUS_FIELD,
      ],
      records: [],
    },
    {
      ...base,
      id: 'claim_shq_users',
      name: 'Goodwill SHQ Approver Users Master',
      category: 'Claim Users',
      description: 'SHQ users who approve Goodwill Requests on behalf of the Goodwill Committee (BA sheet "List of SHQ users").',
      fields: [
        { key: 'bu', label: 'BU', type: 'select', options: ['PV', 'EV', 'CV'], lovCode: 'COMMON_BU', mandatory: true },
        { key: 'userName', label: 'User Name', type: 'text', mandatory: true },
        { key: 'crmUserId', label: 'CRM User ID', type: 'text', defaultValue: '' },
        STATUS_FIELD,
      ],
      records: [{ id: 'SHQ-01', bu: 'EV', userName: 'Test User SHQ', crmUserId: 'TU_000201', status: 'Active' }],
    },
  ];
}
