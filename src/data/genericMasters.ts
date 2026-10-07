import type { MasterConfig, MasterFieldDef } from './masterCatalogue';
import type { MasterRule } from '../utils/masterRules';
import { COMMON_BASE } from './commonLov';
import { STATUS_FIELD } from './lovMaster';

/**
 * Generic masters: the reference data every module and the Employee Management screen depend on (organisation,
 * geography, people skills, service and job-card vocabulary, parts and tax, documents, notifications, escalation).
 * Dropdown-only lists (fuel type, gender, languages …) are in the Common LOV Master instead (src/data/commonLov.ts).
 * Test data only — this repository is public. Everything here can be changed on screen (rows, fields, rules) or by Excel upload.
 */

const STATUS = STATUS_FIELD;
const text = (key: string, label: string, mandatory = false, extra: Partial<MasterFieldDef> = {}): MasterFieldDef => ({ key, label, type: 'text', mandatory, ...extra });
const num = (key: string, label: string, min = 0, max = 9999, mandatory = false): MasterFieldDef => ({ key, label, type: 'number', mandatory, validation: { min, max } });
const sel = (key: string, label: string, options: string[], extra: Partial<MasterFieldDef> = {}): MasterFieldDef => ({ key, label, type: 'select', options, ...extra });
const code = (key: string, label: string, pattern: string, hint: string): MasterFieldDef =>
  text(key, label, true, { validation: { pattern, customErrorMessage: hint } });
const rule = (id: string, r: Partial<MasterRule>): MasterRule => ({ id, enabled: true, severity: 'error', type: 'unique', ...r }) as MasterRule;
const rows = <T extends Record<string, unknown>>(prefix: string, list: T[]) =>
  list.map((r, i) => ({ id: `${prefix}-${String(i + 1).padStart(2, '0')}`, status: 'Active', ...r }));

const ZONES = ['North', 'South', 'East', 'West'];
const DEPARTMENTS = ['Sales', 'Service', 'Spare Parts', 'Bodyshop', 'Quality', 'Customer Relations', 'Warranty & Claims', 'Administration', 'IT'];
const SKILL_CATEGORIES = ['Mechanical', 'Electrical', 'EV / High Voltage', 'Bodyshop', 'Paint', 'AC & Cooling', 'Diagnostics', 'Customer Handling', 'Parts & Inventory', 'Quality', 'Safety'];

export function buildGenericMasters(): MasterConfig[] {
  const m = (id: string, name: string, category: string, description: string, fields: MasterFieldDef[], records: Array<Record<string, any>>, rules: MasterRule[] = [], owner: MasterConfig['owner'] = 'TML_ADMIN'): MasterConfig => ({
    ...COMMON_BASE,
    owner,
    id,
    name,
    category,
    description,
    fields: [...fields, STATUS],
    records,
    rules,
  });

  return [
    // ---------------------------------------------------------------- Organisation & geography
    m(
      'zone_region_master',
      'Zone, Region & State Master',
      'Organisation',
      'TML sales & service hierarchy: Zone → Region → State, with the GST state code. Used by users, dealers, reports and escalations.',
      [
        sel('zone', 'Zone', ZONES, { mandatory: true, lovCode: 'COMMON_ZONE' }),
        text('region', 'Region', true),
        text('state', 'State', true),
        code('stateCode', 'State Code', '^[A-Z]{2}$', 'Two capitals, e.g. MH'),
        text('gstStateCode', 'GST State Code', false, { validation: { pattern: '^\\d{2}$', customErrorMessage: 'Two digits, e.g. 27' } }),
      ],
      rows('ZRS', [
        { zone: 'West', region: 'Mumbai', state: 'Maharashtra', stateCode: 'MH', gstStateCode: '27' },
        { zone: 'West', region: 'Pune', state: 'Maharashtra', stateCode: 'MH', gstStateCode: '27' },
        { zone: 'West', region: 'Ahmedabad', state: 'Gujarat', stateCode: 'GJ', gstStateCode: '24' },
        { zone: 'North', region: 'Delhi NCR', state: 'Delhi', stateCode: 'DL', gstStateCode: '07' },
        { zone: 'North', region: 'Lucknow', state: 'Uttar Pradesh', stateCode: 'UP', gstStateCode: '09' },
        { zone: 'North', region: 'Chandigarh', state: 'Punjab', stateCode: 'PB', gstStateCode: '03' },
        { zone: 'South', region: 'Bengaluru', state: 'Karnataka', stateCode: 'KA', gstStateCode: '29' },
        { zone: 'South', region: 'Chennai', state: 'Tamil Nadu', stateCode: 'TN', gstStateCode: '33' },
        { zone: 'South', region: 'Hyderabad', state: 'Telangana', stateCode: 'TS', gstStateCode: '36' },
        { zone: 'East', region: 'Kolkata', state: 'West Bengal', stateCode: 'WB', gstStateCode: '19' },
        { zone: 'East', region: 'Bhubaneswar', state: 'Odisha', stateCode: 'OD', gstStateCode: '21' },
      ]),
      [rule('RULE-ZRS1', { type: 'unique', fields: ['zone', 'region', 'state'] })]
    ),
    m(
      'department_master',
      'Department Master',
      'Organisation',
      'Departments of TML and of a dealership. Used on every employee and in role design.',
      [
        code('departmentCode', 'Department Code', '^[A-Z]{2,6}$', 'Capitals, 2 to 6 letters, e.g. SVC'),
        text('departmentName', 'Department Name', true),
        sel('appliesTo', 'Applies To', ['TML', 'Dealer', 'Both'], { mandatory: true }),
        text('headDesignation', 'Head Designation'),
      ],
      rows('DEP', [
        { departmentCode: 'SALES', departmentName: 'Sales', appliesTo: 'Both', headDesignation: 'Sales Manager' },
        { departmentCode: 'SVC', departmentName: 'Service', appliesTo: 'Both', headDesignation: 'Service Manager' },
        { departmentCode: 'PARTS', departmentName: 'Spare Parts', appliesTo: 'Both', headDesignation: 'Parts Manager' },
        { departmentCode: 'BODY', departmentName: 'Bodyshop', appliesTo: 'Dealer', headDesignation: 'Bodyshop Manager' },
        { departmentCode: 'QUAL', departmentName: 'Quality', appliesTo: 'Both', headDesignation: 'Quality Head' },
        { departmentCode: 'CRM', departmentName: 'Customer Relations', appliesTo: 'Both', headDesignation: 'CRM Head' },
        { departmentCode: 'WTY', departmentName: 'Warranty & Claims', appliesTo: 'Both', headDesignation: 'Warranty Manager' },
        { departmentCode: 'ADMIN', departmentName: 'Administration', appliesTo: 'Both', headDesignation: 'Administration Head' },
        { departmentCode: 'IT', departmentName: 'IT', appliesTo: 'TML', headDesignation: 'IT Head' },
      ]),
      [rule('RULE-DEP1', { type: 'unique', fields: ['departmentCode'] }), rule('RULE-DEP2', { type: 'unique', fields: ['departmentName'] })]
    ),
    m(
      'designation_master',
      'Designation & Grade Master',
      'Organisation',
      'Job titles with their department, grade and reporting level. Drives the employee profile and approval levels.',
      [
        code('designationCode', 'Designation Code', '^[A-Z0-9-]{3,12}$', 'Capitals, digits and hyphen, e.g. SA-01'),
        text('designationName', 'Designation', true),
        sel('department', 'Department', DEPARTMENTS, { mandatory: true }),
        sel('grade', 'Grade', ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'], { mandatory: true }),
        sel('level', 'Level', ['Floor', 'Supervisor', 'Manager', 'Head', 'Leadership'], { mandatory: true }),
        sel('appliesTo', 'Applies To', ['TML', 'Dealer', 'Both'], { mandatory: true }),
      ],
      rows('DSG', [
        { designationCode: 'TECH-01', designationName: 'Technician', department: 'Service', grade: 'G1', level: 'Floor', appliesTo: 'Dealer' },
        { designationCode: 'MTECH-01', designationName: 'Master Technician', department: 'Service', grade: 'G2', level: 'Supervisor', appliesTo: 'Dealer' },
        { designationCode: 'SA-01', designationName: 'Service Advisor', department: 'Service', grade: 'G2', level: 'Floor', appliesTo: 'Dealer' },
        { designationCode: 'FLR-01', designationName: 'Workshop Floor Manager', department: 'Service', grade: 'G3', level: 'Supervisor', appliesTo: 'Dealer' },
        { designationCode: 'SVM-01', designationName: 'Service Manager', department: 'Service', grade: 'G4', level: 'Manager', appliesTo: 'Dealer' },
        { designationCode: 'PRT-01', designationName: 'Parts Store Officer', department: 'Spare Parts', grade: 'G2', level: 'Floor', appliesTo: 'Dealer' },
        { designationCode: 'QI-01', designationName: 'Quality Inspector', department: 'Quality', grade: 'G2', level: 'Floor', appliesTo: 'Dealer' },
        { designationCode: 'PNT-01', designationName: 'Paint Specialist', department: 'Bodyshop', grade: 'G2', level: 'Floor', appliesTo: 'Dealer' },
        { designationCode: 'CLM-01', designationName: 'Claims Officer', department: 'Warranty & Claims', grade: 'G3', level: 'Floor', appliesTo: 'Both' },
        { designationCode: 'SEC-01', designationName: 'Security Guard', department: 'Administration', grade: 'G1', level: 'Floor', appliesTo: 'Dealer' },
        { designationCode: 'DRV-01', designationName: 'Pickup & Drop Driver', department: 'Service', grade: 'G1', level: 'Floor', appliesTo: 'Dealer' },
        { designationCode: 'DGM-01', designationName: 'DGM Service', department: 'Service', grade: 'G5', level: 'Head', appliesTo: 'Dealer' },
        { designationCode: 'CRO-01', designationName: 'Customer Relations Officer', department: 'Customer Relations', grade: 'G3', level: 'Floor', appliesTo: 'Both' },
        { designationCode: 'NM-01', designationName: 'Network Manager', department: 'Service', grade: 'G5', level: 'Manager', appliesTo: 'TML' },
        { designationCode: 'ADM-01', designationName: 'Portal Administrator', department: 'IT', grade: 'G4', level: 'Manager', appliesTo: 'TML' },
      ]),
      [
        rule('RULE-DSG1', { type: 'unique', fields: ['designationCode'] }),
        rule('RULE-DSG2', { type: 'unique', fields: ['designationName', 'department'] }),
        rule('RULE-DSG3', { type: 'exists_in', field: 'department', refMaster: 'department_master', refField: 'departmentName' }),
      ]
    ),
    m(
      'shift_master',
      'Shift Master',
      'Organisation',
      'Working shifts of a workshop. Used for bay allocation, attendance and technician planning.',
      [
        code('shiftCode', 'Shift Code', '^[A-Z0-9]{2,6}$', 'Capitals and digits, e.g. GEN'),
        text('shiftName', 'Shift Name', true),
        text('startTime', 'Start Time', true, { validation: { pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', customErrorMessage: 'Use 24-hour HH:MM, e.g. 09:00' } }),
        text('endTime', 'End Time', true, { validation: { pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', customErrorMessage: 'Use 24-hour HH:MM, e.g. 18:00' } }),
        sel('weeklyOff', 'Weekly Off', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Rotational'], { mandatory: true }),
      ],
      rows('SFT', [
        { shiftCode: 'GEN', shiftName: 'General', startTime: '09:00', endTime: '18:00', weeklyOff: 'Sunday' },
        { shiftCode: 'EARLY', shiftName: 'Early Shift', startTime: '07:00', endTime: '15:00', weeklyOff: 'Rotational' },
        { shiftCode: 'LATE', shiftName: 'Late Shift', startTime: '13:00', endTime: '21:00', weeklyOff: 'Rotational' },
        { shiftCode: 'NIGHT', shiftName: 'Night Security', startTime: '21:00', endTime: '06:00', weeklyOff: 'Rotational' },
      ]),
      [rule('RULE-SFT1', { type: 'unique', fields: ['shiftCode'] })],
      'DEALER_ADMIN'
    ),

    // ---------------------------------------------------------------- People: skills, levels, certifications
    m(
      'skill_master',
      'Skill Master',
      'People & Skills',
      'Skills an employee can hold, by category, with the roles that need them. Used on the employee profile, bay / technician allocation and training.',
      [
        code('skillCode', 'Skill Code', '^[A-Z0-9-]{3,14}$', 'Capitals, digits and hyphen, e.g. EV-HV-01'),
        text('skillName', 'Skill Name', true),
        sel('category', 'Skill Category', SKILL_CATEGORIES, { mandatory: true, lovCode: 'ADMIN_SKILL_CATEGORY' }),
        sel('bu', 'BU', ['PV', 'EV'], { mandatory: true, lovCode: 'COMMON_BU' }),
        sel('forDesignation', 'Typically held by', ['Technician', 'Master Technician', 'Service Advisor', 'Quality Inspector', 'Paint Specialist', 'Parts Store Officer', 'Claims Officer', 'Any'], { mandatory: true }),
        sel('critical', 'Critical for safety', ['Y', 'N'], { mandatory: true, defaultValue: 'N' }),
      ],
      rows('SKL', [
        { skillCode: 'MECH-ENG', skillName: 'Engine & Powertrain Repair', category: 'Mechanical', bu: 'PV', forDesignation: 'Technician', critical: 'N' },
        { skillCode: 'MECH-TRN', skillName: 'Transmission & Clutch', category: 'Mechanical', bu: 'PV', forDesignation: 'Technician', critical: 'N' },
        { skillCode: 'MECH-SUS', skillName: 'Suspension, Steering & Brakes', category: 'Mechanical', bu: 'PV', forDesignation: 'Technician', critical: 'Y' },
        { skillCode: 'ELEC-BAS', skillName: 'Vehicle Electricals & Wiring', category: 'Electrical', bu: 'PV', forDesignation: 'Technician', critical: 'N' },
        { skillCode: 'DIAG-TDS', skillName: 'Diagnostics with TDS / DTC', category: 'Diagnostics', bu: 'PV', forDesignation: 'Master Technician', critical: 'N' },
        { skillCode: 'AC-COOL', skillName: 'AC & Cooling System', category: 'AC & Cooling', bu: 'PV', forDesignation: 'Technician', critical: 'N' },
        { skillCode: 'EV-HV-01', skillName: 'HV Battery & Safety Isolation', category: 'EV / High Voltage', bu: 'EV', forDesignation: 'Technician', critical: 'Y' },
        { skillCode: 'EV-HV-02', skillName: 'EV Powertrain & Charging Diagnostics', category: 'EV / High Voltage', bu: 'EV', forDesignation: 'Master Technician', critical: 'Y' },
        { skillCode: 'BODY-DNT', skillName: 'Denting & Panel Repair', category: 'Bodyshop', bu: 'PV', forDesignation: 'Technician', critical: 'N' },
        { skillCode: 'PAINT-01', skillName: 'Painting & Colour Matching', category: 'Paint', bu: 'PV', forDesignation: 'Paint Specialist', critical: 'N' },
        { skillCode: 'QC-EQC', skillName: 'Electronic Quality Check (EQC)', category: 'Quality', bu: 'PV', forDesignation: 'Quality Inspector', critical: 'N' },
        { skillCode: 'CUST-HND', skillName: 'Customer Handling & Job Card Creation', category: 'Customer Handling', bu: 'PV', forDesignation: 'Service Advisor', critical: 'N' },
        { skillCode: 'SA-MECH', skillName: 'Service Advisory — Mechanical jobs', category: 'Customer Handling', bu: 'PV', forDesignation: 'Service Advisor', critical: 'N' },
        { skillCode: 'SA-BODY', skillName: 'Service Advisory — Bodyshop & Insurance jobs', category: 'Customer Handling', bu: 'PV', forDesignation: 'Service Advisor', critical: 'N' },
        { skillCode: 'PART-INV', skillName: 'Parts Issue & Inventory', category: 'Parts & Inventory', bu: 'PV', forDesignation: 'Parts Store Officer', critical: 'N' },
        { skillCode: 'SAFE-FIRE', skillName: 'Workshop Safety & Fire Response', category: 'Safety', bu: 'PV', forDesignation: 'Any', critical: 'Y' },
      ]),
      [
        rule('RULE-SKL1', { type: 'unique', fields: ['skillCode'] }),
        rule('RULE-SKL2', { type: 'allowed_if', field: 'category', whenField: 'bu', whenValues: ['PV'], values: SKILL_CATEGORIES.filter((c) => c !== 'EV / High Voltage'), message: 'EV / High Voltage skills belong to BU EV.' }),
      ]
    ),
    m(
      'skill_level_master',
      'Skill Level (Proficiency) Master',
      'People & Skills',
      'Proficiency levels L1 to L4 with the experience and authority each level carries. Matches the LMS upgrade eligibility.',
      [
        code('levelCode', 'Level Code', '^L[1-9]$', 'L1 to L9'),
        text('levelName', 'Level Name', true),
        num('minExperienceMonths', 'Minimum Experience (Months)', 0, 360, true),
        num('minCoursesPassed', 'Minimum Courses Passed', 0, 100, true),
        sel('canWorkUnsupervised', 'Can work unsupervised', ['Y', 'N'], { mandatory: true }),
        sel('canSignOffJob', 'Can sign off a job', ['Y', 'N'], { mandatory: true }),
        text('description', 'Description'),
      ],
      rows('SLV', [
        { levelCode: 'L1', levelName: 'Trainee / Apprentice', minExperienceMonths: 0, minCoursesPassed: 0, canWorkUnsupervised: 'N', canSignOffJob: 'N', description: 'Works under supervision' },
        { levelCode: 'L2', levelName: 'Technician', minExperienceMonths: 12, minCoursesPassed: 4, canWorkUnsupervised: 'Y', canSignOffJob: 'N', description: 'Routine jobs independently' },
        { levelCode: 'L3', levelName: 'Senior Technician', minExperienceMonths: 36, minCoursesPassed: 8, canWorkUnsupervised: 'Y', canSignOffJob: 'Y', description: 'Complex jobs and sign-off' },
        { levelCode: 'L4', levelName: 'Master Technician', minExperienceMonths: 72, minCoursesPassed: 12, canWorkUnsupervised: 'Y', canSignOffJob: 'Y', description: 'Diagnostics, THD and coaching' },
      ]),
      [rule('RULE-SLV1', { type: 'unique', fields: ['levelCode'] })]
    ),
    m(
      'certification_master',
      'Certification Master',
      'People & Skills',
      'Certificates an employee can hold (safety, EV, paint, diagnostics) with validity and the work they unlock.',
      [
        code('certCode', 'Certification Code', '^[A-Z0-9-]{3,14}$', 'Capitals, digits and hyphen, e.g. HVS-1'),
        text('certName', 'Certification Name', true),
        text('issuedBy', 'Issued By', true),
        num('validityMonths', 'Validity (Months)', 0, 120, true),
        sel('mandatoryFor', 'Mandatory for', ['EV technicians', 'All technicians', 'Paint specialists', 'Quality inspectors', 'Nobody (optional)'], { mandatory: true }),
        text('unlocks', 'Work it unlocks'),
      ],
      rows('CRT', [
        { certCode: 'HVS-1', certName: 'High Voltage Safety Level 1', issuedBy: 'TML Academy', validityMonths: 24, mandatoryFor: 'EV technicians', unlocks: 'Work on HV battery and isolate HV system' },
        { certCode: 'HVS-2', certName: 'High Voltage Safety Level 2', issuedBy: 'TML Academy', validityMonths: 24, mandatoryFor: 'Nobody (optional)', unlocks: 'HV battery pack repair' },
        { certCode: 'EVT-1', certName: 'EV Technician Level 1', issuedBy: 'TML Academy', validityMonths: 36, mandatoryFor: 'EV technicians', unlocks: 'EV periodic service and charging checks' },
        { certCode: 'DIAG-1', certName: 'Diagnostics (TDS) Certified', issuedBy: 'TML Academy', validityMonths: 36, mandatoryFor: 'Nobody (optional)', unlocks: 'THD escalations and DTC clearing' },
        { certCode: 'PAINT-1', certName: 'Paint Technology Certified', issuedBy: 'Paint Partner', validityMonths: 48, mandatoryFor: 'Paint specialists', unlocks: 'Booth operation and colour matching' },
        { certCode: 'EQC-1', certName: 'EQC Inspector Certified', issuedBy: 'TML Quality', validityMonths: 24, mandatoryFor: 'Quality inspectors', unlocks: 'Sign off the electronic quality check' },
        { certCode: 'FIRE-1', certName: 'Workshop Fire Safety', issuedBy: 'Dealer HR', validityMonths: 12, mandatoryFor: 'All technicians', unlocks: 'Floor access' },
      ]),
      [rule('RULE-CRT1', { type: 'unique', fields: ['certCode'] })]
    ),

    // ---------------------------------------------------------------- Service and job card vocabulary
    m(
      'service_type_master',
      'Service Type Master',
      'Service',
      'Types of service a vehicle can come for, with standard turnaround and whether it is billable. Used by appointment, job card creation, JC tracking and claims.',
      [
        code('serviceTypeCode', 'Service Type Code', '^[A-Z0-9_]{3,16}$', 'Capitals, digits and _, e.g. FREE_1'),
        text('serviceTypeName', 'Service Type', true),
        sel('jobType', 'Job Type', ['Mechanical', 'Electrical', 'Bodyshop', 'Paint', 'AC', 'EV', 'Detailing'], { mandatory: true, lovCode: 'JC_JOB_TYPE' }),
        sel('billable', 'Billable to customer', ['Y', 'N'], { mandatory: true }),
        num('standardTatHours', 'Standard TAT (Hours)', 0, 240, true),
        sel('requiresAppointment', 'Appointment needed', ['Y', 'N'], { mandatory: true }),
        sel('claimable', 'Claimable from TML', ['Y', 'N'], { mandatory: true }),
      ],
      rows('SVT', [
        { serviceTypeCode: 'FREE_1', serviceTypeName: 'First Free Service', jobType: 'Mechanical', billable: 'N', standardTatHours: 4, requiresAppointment: 'Y', claimable: 'Y' },
        { serviceTypeCode: 'FREE_2', serviceTypeName: 'Second Free Service', jobType: 'Mechanical', billable: 'N', standardTatHours: 5, requiresAppointment: 'Y', claimable: 'Y' },
        { serviceTypeCode: 'PAID', serviceTypeName: 'Paid Periodic Service', jobType: 'Mechanical', billable: 'Y', standardTatHours: 6, requiresAppointment: 'Y', claimable: 'N' },
        { serviceTypeCode: 'RUNNING', serviceTypeName: 'Running Repair', jobType: 'Mechanical', billable: 'Y', standardTatHours: 8, requiresAppointment: 'N', claimable: 'N' },
        { serviceTypeCode: 'WARRANTY', serviceTypeName: 'Warranty Repair', jobType: 'Mechanical', billable: 'N', standardTatHours: 24, requiresAppointment: 'N', claimable: 'Y' },
        { serviceTypeCode: 'AMC', serviceTypeName: 'AMC / Extended Warranty Repair', jobType: 'Mechanical', billable: 'N', standardTatHours: 24, requiresAppointment: 'N', claimable: 'Y' },
        { serviceTypeCode: 'GOODWILL', serviceTypeName: 'Goodwill Repair', jobType: 'Mechanical', billable: 'N', standardTatHours: 24, requiresAppointment: 'N', claimable: 'Y' },
        { serviceTypeCode: 'ACCIDENT', serviceTypeName: 'Accident Repair', jobType: 'Bodyshop', billable: 'Y', standardTatHours: 96, requiresAppointment: 'N', claimable: 'N' },
        { serviceTypeCode: 'PDI', serviceTypeName: 'Pre-Delivery Inspection', jobType: 'Mechanical', billable: 'N', standardTatHours: 3, requiresAppointment: 'N', claimable: 'N' },
        { serviceTypeCode: 'CAMPAIGN', serviceTypeName: 'Recall / Service Campaign', jobType: 'Mechanical', billable: 'N', standardTatHours: 6, requiresAppointment: 'Y', claimable: 'Y' },
        { serviceTypeCode: 'EV_PERIODIC', serviceTypeName: 'EV Periodic Service', jobType: 'EV', billable: 'Y', standardTatHours: 4, requiresAppointment: 'Y', claimable: 'N' },
        { serviceTypeCode: 'DETAILING', serviceTypeName: 'Detailing / Wash', jobType: 'Detailing', billable: 'Y', standardTatHours: 3, requiresAppointment: 'N', claimable: 'N' },
      ]),
      [
        rule('RULE-SVT1', { type: 'unique', fields: ['serviceTypeCode'] }),
        rule('RULE-SVT2', { type: 'allowed_if', field: 'claimable', whenField: 'billable', whenValues: ['Y'], values: ['N'], severity: 'warning', message: 'A billable service is normally not claimable from TML.' }),
      ]
    ),
    m(
      'jc_status_master',
      'Job Card Status Master',
      'Service',
      'Status of a job card from creation to gate-out and the TML Journey stage it belongs to. Used by JC tracking, the worklist tabs and the Journey.',
      [
        code('statusCode', 'Status Code', '^[A-Z0-9_]{2,20}$', 'Capitals, digits and _, e.g. WIP'),
        text('statusName', 'Status', true),
        sel('journeyStage', 'Journey Stage', ['Appointment', 'Reception', 'Gate In', 'Job Card Creation', 'Workshop', 'Quality Check', 'Billing', 'Delivery', 'Closed'], { mandatory: true }),
        num('sequence', 'Sequence', 1, 99, true),
        sel('terminal', 'Final status', ['Y', 'N'], { mandatory: true, defaultValue: 'N' }),
        sel('colour', 'Badge colour', ['Grey', 'Blue', 'Amber', 'Green', 'Red', 'Purple'], { mandatory: true }),
      ],
      rows('JCS', [
        { statusCode: 'APPT', statusName: 'Appointment Booked', journeyStage: 'Appointment', sequence: 1, terminal: 'N', colour: 'Grey' },
        { statusCode: 'GATE_IN', statusName: 'Gate In', journeyStage: 'Gate In', sequence: 2, terminal: 'N', colour: 'Blue' },
        { statusCode: 'JC_OPEN', statusName: 'Job Card Open', journeyStage: 'Job Card Creation', sequence: 3, terminal: 'N', colour: 'Blue' },
        { statusCode: 'ESTIMATE', statusName: 'Awaiting Customer Approval', journeyStage: 'Job Card Creation', sequence: 4, terminal: 'N', colour: 'Amber' },
        { statusCode: 'WIP', statusName: 'Work in Progress', journeyStage: 'Workshop', sequence: 5, terminal: 'N', colour: 'Blue' },
        { statusCode: 'PARTS_WAIT', statusName: 'Waiting for Parts', journeyStage: 'Workshop', sequence: 6, terminal: 'N', colour: 'Amber' },
        { statusCode: 'ON_HOLD', statusName: 'On Hold (Paused)', journeyStage: 'Workshop', sequence: 7, terminal: 'N', colour: 'Amber' },
        { statusCode: 'THD', statusName: 'With Technical Help Desk', journeyStage: 'Workshop', sequence: 8, terminal: 'N', colour: 'Purple' },
        { statusCode: 'QC', statusName: 'Quality Check', journeyStage: 'Quality Check', sequence: 9, terminal: 'N', colour: 'Blue' },
        { statusCode: 'READY', statusName: 'Ready for Delivery', journeyStage: 'Delivery', sequence: 10, terminal: 'N', colour: 'Green' },
        { statusCode: 'BILLED', statusName: 'Billed', journeyStage: 'Billing', sequence: 11, terminal: 'N', colour: 'Green' },
        { statusCode: 'CLOSED', statusName: 'Closed (Gate Out)', journeyStage: 'Closed', sequence: 12, terminal: 'Y', colour: 'Green' },
        { statusCode: 'CANCELLED', statusName: 'Cancelled', journeyStage: 'Closed', sequence: 13, terminal: 'Y', colour: 'Red' },
      ]),
      [rule('RULE-JCS1', { type: 'unique', fields: ['statusCode'] }), rule('RULE-JCS2', { type: 'unique', fields: ['sequence'] })]
    ),
    m(
      'vehicle_colour_master',
      'Vehicle Colour Master',
      'Vehicle',
      'Factory colours with colour code and display shade. The code ties a vehicle to its picture on the Vehicle Info and worklist screens.',
      [
        code('colourCode', 'Colour Code', '^[A-Z0-9]{2,6}$', 'Capitals and digits, e.g. PW01'),
        text('colourName', 'Colour Name', true),
        text('hex', 'Display Shade (hex)', true, { validation: { pattern: '^#[0-9A-Fa-f]{6}$', customErrorMessage: 'Use a hex colour such as #1F3A5F' } }),
        sel('finish', 'Finish', ['Solid', 'Metallic', 'Pearl', 'Dual Tone'], { mandatory: true }),
        sel('paintCostBand', 'Paint cost band', ['Standard', 'Premium'], { mandatory: true }),
      ],
      rows('CLR', [
        { colourCode: 'PW01', colourName: 'Pristine White', hex: '#F4F4F2', finish: 'Solid', paintCostBand: 'Standard' },
        { colourCode: 'DG02', colourName: 'Daytona Grey', hex: '#6B6F73', finish: 'Metallic', paintCostBand: 'Standard' },
        { colourCode: 'FB03', colourName: 'Flame Red', hex: '#B3201F', finish: 'Solid', paintCostBand: 'Standard' },
        { colourCode: 'OB04', colourName: 'Oberon Black', hex: '#14161A', finish: 'Metallic', paintCostBand: 'Standard' },
        { colourCode: 'CB05', colourName: 'Cosmic Blue', hex: '#1F3A5F', finish: 'Pearl', paintCostBand: 'Premium' },
        { colourCode: 'TG06', colourName: 'Teal Blue', hex: '#1B6F7A', finish: 'Dual Tone', paintCostBand: 'Premium' },
      ]),
      [rule('RULE-CLR1', { type: 'unique', fields: ['colourCode'] })]
    ),

    // ---------------------------------------------------------------- Parts, tax and documents
    m(
      'uom_master',
      'Unit of Measure Master',
      'Parts & Tax',
      'Units used for parts, oils, labour and consumables.',
      [code('uomCode', 'UoM Code', '^[A-Z]{1,6}$', 'Capitals, e.g. NOS'), text('uomName', 'Unit Name', true), sel('type', 'Type', ['Count', 'Volume', 'Weight', 'Length', 'Time'], { mandatory: true })],
      rows('UOM', [
        { uomCode: 'NOS', uomName: 'Numbers', type: 'Count' },
        { uomCode: 'SET', uomName: 'Set', type: 'Count' },
        { uomCode: 'LTR', uomName: 'Litre', type: 'Volume' },
        { uomCode: 'ML', uomName: 'Millilitre', type: 'Volume' },
        { uomCode: 'KG', uomName: 'Kilogram', type: 'Weight' },
        { uomCode: 'MTR', uomName: 'Metre', type: 'Length' },
        { uomCode: 'HR', uomName: 'Hour (labour)', type: 'Time' },
      ]),
      [rule('RULE-UOM1', { type: 'unique', fields: ['uomCode'] })]
    ),
    m(
      'tax_master',
      'GST / HSN Master',
      'Parts & Tax',
      'GST rate by HSN (parts) or SAC (labour). Used to price estimates, invoices and claims.',
      [
        text('hsnSac', 'HSN / SAC', true, { validation: { pattern: '^\\d{4,8}$', customErrorMessage: '4 to 8 digits' } }),
        text('description', 'Description', true),
        sel('itemType', 'Item Type', ['Part', 'Labour', 'Oil & Consumable', 'Accessory'], { mandatory: true }),
        num('gstRate', 'GST Rate (%)', 0, 40, true),
        num('cessRate', 'Cess Rate (%)', 0, 40),
      ],
      rows('TAX', [
        { hsnSac: '8708', description: 'Motor vehicle parts and accessories', itemType: 'Part', gstRate: 28, cessRate: 0 },
        { hsnSac: '8714', description: 'Parts of two / three wheelers', itemType: 'Part', gstRate: 28, cessRate: 0 },
        { hsnSac: '8507', description: 'Batteries (including EV battery packs)', itemType: 'Part', gstRate: 18, cessRate: 0 },
        { hsnSac: '4011', description: 'New pneumatic tyres of rubber', itemType: 'Part', gstRate: 28, cessRate: 0 },
        { hsnSac: '2710', description: 'Lubricating oils and greases', itemType: 'Oil & Consumable', gstRate: 18, cessRate: 0 },
        { hsnSac: '998714', description: 'Maintenance and repair of motor vehicles (labour)', itemType: 'Labour', gstRate: 18, cessRate: 0 },
        { hsnSac: '8708', description: 'Accessories — fitted by dealer', itemType: 'Accessory', gstRate: 28, cessRate: 0 },
      ]),
      [
        rule('RULE-TAX1', { type: 'unique', fields: ['hsnSac', 'itemType'] }),
        rule('RULE-TAX2', { type: 'range', field: 'gstRate', min: 0, max: 28, severity: 'warning', message: 'GST above 28% is unusual — please double-check.' }),
      ]
    ),
    m(
      'document_type_master',
      'Document Type Master',
      'Documents',
      'Documents captured or attached anywhere in the application (customer, vehicle, insurance, claims, THD).',
      [
        code('docCode', 'Document Code', '^[A-Z0-9_]{3,16}$', 'Capitals, digits and _, e.g. RC_COPY'),
        text('docName', 'Document', true),
        sel('category', 'Category', ['Customer', 'Vehicle', 'Insurance', 'Claim', 'THD / Quality', 'Employee'], { mandatory: true }),
        sel('mandatory', 'Mandatory', ['Y', 'N'], { mandatory: true }),
        sel('fileTypes', 'File types', ['Image', 'PDF', 'Image or PDF', 'Video'], { mandatory: true }),
        num('maxSizeMb', 'Maximum size (MB)', 1, 100, true),
      ],
      rows('DOC', [
        { docCode: 'RC_COPY', docName: 'Registration Certificate (RC)', category: 'Vehicle', mandatory: 'Y', fileTypes: 'Image or PDF', maxSizeMb: 5 },
        { docCode: 'ID_PROOF', docName: 'Customer ID Proof', category: 'Customer', mandatory: 'N', fileTypes: 'Image or PDF', maxSizeMb: 5 },
        { docCode: 'INS_POLICY', docName: 'Insurance Policy Copy', category: 'Insurance', mandatory: 'Y', fileTypes: 'PDF', maxSizeMb: 10 },
        { docCode: 'POLICE_RPT', docName: 'Police Complaint Report', category: 'Insurance', mandatory: 'N', fileTypes: 'Image or PDF', maxSizeMb: 10 },
        { docCode: 'DIR_REPORT', docName: 'DIR Report', category: 'THD / Quality', mandatory: 'Y', fileTypes: 'PDF', maxSizeMb: 10 },
        { docCode: 'CLAIM_PHOTO', docName: 'Claim Evidence Photo', category: 'Claim', mandatory: 'Y', fileTypes: 'Image', maxSizeMb: 5 },
        { docCode: 'FAULT_VIDEO', docName: 'Fault Video', category: 'THD / Quality', mandatory: 'N', fileTypes: 'Video', maxSizeMb: 50 },
        { docCode: 'EMP_CERT', docName: 'Employee Certificate', category: 'Employee', mandatory: 'N', fileTypes: 'Image or PDF', maxSizeMb: 5 },
      ]),
      [rule('RULE-DOC1', { type: 'unique', fields: ['docCode'] })]
    ),

    // ---------------------------------------------------------------- Communication and escalation
    m(
      'notification_template_master',
      'Notification Template Master',
      'Communication',
      'Message templates sent to customers and staff by event and channel. {placeholders} are filled in by the application.',
      [
        code('eventCode', 'Event Code', '^[A-Z0-9_]{3,24}$', 'Capitals, digits and _, e.g. JC_READY'),
        text('eventName', 'Event', true),
        sel('channel', 'Channel', ['SMS', 'WhatsApp', 'Email', 'App Push'], { mandatory: true, lovCode: 'COMMON_COMM_CHANNEL' }),
        sel('audience', 'Audience', ['Customer', 'Service Advisor', 'Manager', 'Technician'], { mandatory: true }),
        sel('language', 'Language', ['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Gujarati', 'Bengali'], { mandatory: true, lovCode: 'COMMON_LANGUAGE' }),
        text('message', 'Message', true, { description: 'Placeholders: {customerName}, {regNo}, {jcNumber}, {dealerName}, {date}' }),
      ],
      rows('NTF', [
        { eventCode: 'APPT_CONFIRM', eventName: 'Appointment confirmed', channel: 'SMS', audience: 'Customer', language: 'English', message: 'Dear {customerName}, your service for {regNo} is booked at {dealerName} on {date}.' },
        { eventCode: 'APPT_REMIND', eventName: 'Appointment reminder', channel: 'WhatsApp', audience: 'Customer', language: 'English', message: 'Reminder: {regNo} is due at {dealerName} on {date}. Reply 1 to confirm.' },
        { eventCode: 'JC_OPENED', eventName: 'Job card opened', channel: 'SMS', audience: 'Customer', language: 'English', message: 'Job card {jcNumber} opened for {regNo} at {dealerName}.' },
        { eventCode: 'EST_APPROVAL', eventName: 'Estimate needs approval', channel: 'WhatsApp', audience: 'Customer', language: 'English', message: 'Estimate for {jcNumber} is ready. Please approve to start the work.' },
        { eventCode: 'JC_READY', eventName: 'Vehicle ready for delivery', channel: 'SMS', audience: 'Customer', language: 'English', message: 'Your vehicle {regNo} is ready for delivery at {dealerName}.' },
        { eventCode: 'JC_READY', eventName: 'Vehicle ready for delivery', channel: 'SMS', audience: 'Customer', language: 'Hindi', message: 'आपका वाहन {regNo} {dealerName} पर डिलीवरी के लिए तैयार है।' },
        { eventCode: 'JC_DELAY', eventName: 'Job card delayed', channel: 'App Push', audience: 'Manager', language: 'English', message: 'Job card {jcNumber} has crossed its TAT. Please review.' },
        { eventCode: 'THD_RAISED', eventName: 'THD case raised', channel: 'Email', audience: 'Manager', language: 'English', message: 'A THD case was raised for {jcNumber} ({regNo}).' },
      ]),
      [rule('RULE-NTF1', { type: 'unique', fields: ['eventCode', 'channel', 'audience', 'language'] })]
    ),
    m(
      'escalation_matrix_master',
      'Escalation Matrix Master',
      'Communication',
      'Who is told, at which level and after how many hours, when a job card, request or THD case is not moving. Used by exceptions and reminders.',
      [
        sel('module', 'Module', ['Appointment', 'Reception', 'Security', 'JC Creation', 'JC Tracking', 'SPD', 'THD', 'EQC', 'Claims', 'Bodyshop'], { mandatory: true }),
        num('level', 'Escalation Level', 1, 5, true),
        num('afterHours', 'Escalate after (Hours)', 1, 720, true),
        sel('notifyDesignation', 'Notify', ['Workshop Floor Manager', 'Service Manager', 'DGM Service', 'Network Manager', 'Claims Officer', 'Master Technician'], { mandatory: true }),
        sel('channel', 'Channel', ['SMS', 'WhatsApp', 'Email', 'App Push'], { mandatory: true, lovCode: 'COMMON_COMM_CHANNEL' }),
      ],
      rows('ESC', [
        { module: 'JC Tracking', level: 1, afterHours: 2, notifyDesignation: 'Workshop Floor Manager', channel: 'App Push' },
        { module: 'JC Tracking', level: 2, afterHours: 6, notifyDesignation: 'Service Manager', channel: 'SMS' },
        { module: 'JC Tracking', level: 3, afterHours: 24, notifyDesignation: 'DGM Service', channel: 'Email' },
        { module: 'THD', level: 1, afterHours: 4, notifyDesignation: 'Master Technician', channel: 'App Push' },
        { module: 'THD', level: 2, afterHours: 24, notifyDesignation: 'Service Manager', channel: 'Email' },
        { module: 'Claims', level: 1, afterHours: 24, notifyDesignation: 'Claims Officer', channel: 'Email' },
        { module: 'Claims', level: 2, afterHours: 48, notifyDesignation: 'Network Manager', channel: 'Email' },
        { module: 'SPD', level: 1, afterHours: 4, notifyDesignation: 'Workshop Floor Manager', channel: 'App Push' },
      ]),
      [
        rule('RULE-ESC1', { type: 'unique', fields: ['module', 'level'] }),
        rule('RULE-ESC2', { type: 'range', field: 'afterHours', min: 1, max: 168, severity: 'warning', message: 'More than 7 days before escalation is unusual.' }),
      ]
    ),
  ];
}

