import type { MasterConfig } from './masterCatalogue';
import { STATUS_FIELD, lovMaster } from './lovMaster';

/**
 * Claims masters (Goodwill, Warranty / AMC / EW authorisation), built from the BA workbook "Claims Masters List".
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
    lovMaster(base, 'Claim Dropdown Lists', {
      id: 'claim_budget_purpose',
      prefix: 'BAP',
      name: 'Goodwill Budget Allocation Purpose Master',
      label: 'Allocation Purpose',
      sheet: 'Budget Allocation LOV',
      use: 'Selected during the yearly goodwill budget allocation',
      values: ['Approved Yearly Budget', 'Special Budget'],
    }),
    lovMaster(base, 'Claim Dropdown Lists', {
      id: 'claim_special_goodwill',
      prefix: 'SPC',
      name: 'Special Goodwill Claim Master',
      label: 'Special Claim',
      sheet: 'Special claim',
      use: 'Selected by the Claim Manager for special claim approvals',
      values: ['IUPR', 'Thrive'],
    }),
    lovMaster(base, 'Claim Dropdown Lists', {
      id: 'claim_issue_description',
      prefix: 'ISD',
      name: 'Goodwill Issue Description Master',
      label: 'Issue Description',
      sheet: 'Issue Description LOV',
      use: 'Selected by the Claim Manager in a Goodwill Request; decides the request category',
      values: ['Thermal Incident', 'Engine Failure'],
    }),
    {
      ...base,
      id: 'claim_goodwill_category',
      name: 'Goodwill Request Category Mapping',
      category: 'Claim Rules',
      description:
        'Issue Description → Issue Type and Request Category (Red / Amber / Green) of a Goodwill Request (BA sheet "Goodwill Req Catagory Mapping"). One row per Issue Description.',
      fields: [
        { key: 'issueDescription', label: 'Issue Description', type: 'text', mandatory: true, description: 'Must be an Active value of the Goodwill Issue Description Master.' },
        { key: 'issueType', label: 'Issue Type', type: 'text', mandatory: true },
        { key: 'requestCategory', label: 'Request Category', type: 'select', options: GOODWILL_CATEGORIES, mandatory: true },
        STATUS_FIELD,
      ],
      records: [
        { id: 'GWC-01', issueDescription: 'Thermal Incident', issueType: 'Catastrophic Situation', requestCategory: 'Red', status: 'Active' },
        { id: 'GWC-02', issueDescription: 'Engine Failure', issueType: 'Minor Product Failure', requestCategory: 'Amber', status: 'Active' },
      ],
    },
    lovMaster(base, 'Claim Dropdown Lists', {
      id: 'claim_complaint_type',
      prefix: 'CMT',
      name: 'AMC / EW Complaint Type Master',
      label: 'Complaint Type',
      sheet: 'Complaint Type LOV',
      use: 'Selected by the Claim Manager in an AMC or Extended Warranty Authorization Request',
      values: ['Transmission', 'Clutch'],
    }),
    {
      ...base,
      id: 'claim_warranty_approval_matrix',
      name: 'Warranty Authorization Approval Matrix',
      category: 'Claim Rules',
      description:
        'Who can approve a Warranty Authorization Request, by Level (BA sheet "Warranty Approval Matrix"). A level approves amounts below its "Approves Below (₹)"; blank = cannot approve and must forward. A reminder goes out after the Reminder hours.',
      fields: [
        { key: 'level', label: 'Level', type: 'number', mandatory: true, validation: { min: 1, max: 9 } },
        { key: 'persona', label: 'Persona', type: 'text', mandatory: true },
        { key: 'approvesBelow', label: 'Approves Below (₹)', type: 'number', defaultValue: '', validation: { min: 1, max: 100000000 }, description: 'Blank = this persona cannot approve.' },
        { key: 'actions', label: 'Action / Authority', type: 'text', mandatory: true, description: 'Comma-separated actions available to this persona.' },
        { key: 'forwardTo', label: 'Forwards To', type: 'text', defaultValue: '', description: 'Persona of the next level, when the amount is above this level.' },
        { key: 'reminderHours', label: 'Reminder (Hrs)', type: 'number', mandatory: true, validation: { min: 1, max: 720 } },
        STATUS_FIELD,
      ],
      records: [
        { id: 'WAM-01', level: 1, persona: 'Claim Manager', approvesBelow: 20000, actions: 'Approve, Send to CCM/ACCM', forwardTo: 'CCM/ACCM', reminderHours: 24, status: 'Active' },
        { id: 'WAM-02', level: 2, persona: 'CCM/ACCM', approvesBelow: null, actions: 'Send to SHQ Lead 1, Send Back for Correction', forwardTo: 'SHQ Lead 1', reminderHours: 24, status: 'Active' },
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
        { key: 'bu', label: 'BU', type: 'select', options: ['PV', 'EV'], mandatory: true },
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
        { key: 'bu', label: 'BU', type: 'select', options: ['PV', 'EV'], mandatory: true },
        { key: 'userName', label: 'User Name', type: 'text', mandatory: true },
        { key: 'crmUserId', label: 'CRM User ID', type: 'text', defaultValue: '' },
        STATUS_FIELD,
      ],
      records: [{ id: 'SHQ-01', bu: 'EV', userName: 'Test User SHQ', crmUserId: 'TU_000201', status: 'Active' }],
    },
  ];
}
