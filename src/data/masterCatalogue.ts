import { buildThdMasters } from './thdMasters';
import { buildClaimMasters } from './claimMasters';

export type DealerTargetModule =
  | 'vehicle_journey'
  | 'job_card'
  | 'reception'
  | 'workshop_floor'
  | 'general';

export interface MasterFieldValidation {
  min?: number;
  max?: number;
  minDate?: string;
  maxDate?: string;
  pattern?: string;
  customErrorMessage?: string;
}

export interface MasterFieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'date';
  options?: string[];
  mandatory?: boolean;
  isCustom?: boolean;
  isSystem?: boolean;
  displayInDealerApp?: boolean;
  dealerTargetModule?: DealerTargetModule;
  dealerDisplayLabel?: string;
  valueMapping?: Record<string, string>; // Maps raw internal code to customer/dealer display label
  description?: string;
  validation?: MasterFieldValidation;
  /** Value pre-filled for a new record ('' = start blank, e.g. a PPL that means "all PPLs"). */
  defaultValue?: string | number;
  /** Text for the empty option of a non-mandatory select, e.g. "(All PPLs)". */
  blankLabel?: string;
}

export type ModuleCode =
  | 'appointment'
  | 'reception'
  | 'receptionist'
  | 'security'
  | 'jc_creation'
  | 'bodyshop'
  | 'jc_tracking'
  | 'eqc'
  | 'thd'
  | 'spd'
  | 'claim'
  | 'customer_journey'
  | 'dealer_network'
  | 'ira';

export type LogicalModuleGroup =
  | 'Vehicle Data'
  | 'Dealer Network'
  | 'Service Operations'
  | 'Parts, Claims & Support'
  | 'Electronic Quality Check'
  | 'Bodyshop';

export interface LogicalModuleDef {
  id: LogicalModuleGroup;
  title: string;
  shortDesc: string;
  iconName: string;
  colorTheme: string;
  badge: string;
}

export interface MasterModuleMeta {
  code: ModuleCode;
  title: string;
  subtitle: string;
  badge: string;
  iconName: string;
  accentColor: string;
  categoryTag: string;
  displayLines?: string[];
}

export interface MasterConfig {
  id: string;
  name: string;
  owner: 'TML_ADMIN' | 'DEALER_ADMIN';
  category: string;
  logicalGroup: LogicalModuleGroup;
  moduleCode: ModuleCode;
  moduleName: string;
  description: string;
  fields: MasterFieldDef[];
  records: Array<Record<string, any>>;
  isInteractiveSpecial?: boolean;
  interactiveTabTarget?: 'bays' | 'calendar' | 'dealers' | 'timeslots' | 'bodyshop';
}

export const LOGICAL_MODULES: LogicalModuleDef[] = [
  {
    id: 'Vehicle Data',
    title: 'Vehicle & Product Data',
    shortDesc: 'PPL & PL vehicle variants, model checklists, diagnostic codes, EV high-voltage safety & labor FRTs',
    iconName: 'Car',
    colorTheme: 'blue',
    badge: 'VEHICLE',
  },
  {
    id: 'Dealer Network',
    title: 'Dealer Network & Facilities',
    shortDesc: 'Authorized 3S/2S dealership network, physical bay configurations, holiday calendars & intake quotas',
    iconName: 'Building2',
    colorTheme: 'emerald',
    badge: 'NETWORK',
  },
  {
    id: 'Service Operations',
    title: 'Service Operations & Floor',
    shortDesc: 'Bay technician rosters, clocking pause reasons, repeat complaints, quality checks & bodyshop stages',
    iconName: 'Wrench',
    colorTheme: 'amber',
    badge: 'OPS',
  },
  {
    id: 'Parts, Claims & Support',
    title: 'Parts, Claims & Support',
    shortDesc: 'Spare parts dispatch (SPD), plant helpdesk (THD), AMC value care pricing, warranty defects & gate security',
    iconName: 'Package',
    colorTheme: 'purple',
    badge: 'SUPPORT',
  },
  {
    id: 'Electronic Quality Check',
    title: 'EQC Masters',
    shortDesc: 'Guided Check & road test mandates, GC steps, PTD risk colours, DID thresholds, general & schedule checklists',
    iconName: 'ClipboardCheck',
    colorTheme: 'teal',
    badge: 'EQC',
  },
  {
    id: 'Bodyshop',
    title: 'Bodyshop Masters',
    shortDesc: 'Inventory capture sections & checkpoints, insurance documents, bodyshop facilities and process stages',
    iconName: 'Flame',
    colorTheme: 'orange',
    badge: 'BODYSHOP',
  },
];

export const BS_ROLES = ['DSvAdv', 'Driver'];
export const BS_SERVICE_TYPES = ['All', 'Accident'];
export const BS_MEDIA_TYPES = ['Image', 'Video', 'Video/Image'];
const BS_ROLES_PATTERN = '^\\s*(DSvAdv|Driver)(\\s*,\\s*(DSvAdv|Driver))?\\s*$';
/** One Inventory Capture checkpoint row, in the Excel's column order. */
const cp = (
  id: string, section: string, subSection1: string, subSection1Seq: number | null, subSection2: string, subSection2Seq: number | null,
  checkpoint: string, checkpointSeq: number | null, role: string, acceptableValues: string, mandatory: string, active: string,
  mediaType: string, imagesRequired: number | null, mediaApplicableOn: string, serviceType: string
) => ({
  id, section, subSection1, subSection1Seq, subSection2, subSection2Seq, checkpoint,
  checkpointSeq, role, acceptableValues, mandatory, active, mediaType, imagesRequired, mediaApplicableOn, serviceType,
});

/** PPLs offered in EQC masters. Blank = all PPLs. */
export const EQC_PPLS = ['Nexon', 'Nexon EV', 'Altroz', 'Harrier', 'Safari', 'Punch', 'Punch EV', 'Tiago', 'Tiago EV', 'Tigor', 'Curvv', 'Curvv EV'];
export const EQC_CHECKLIST_TYPES = ['Pre-Delivery Inspection', 'Road Test', 'Underbody', 'Interior & Cleanliness', 'EV Safety'];
const COMPLAINT_CODE_PATTERN = '^[A-Z0-9]+(-[A-Z0-9]+)*$';
/** "11.8-14.5", ">=20", "<=4.2", ">0", "<5" or a single number. */
export const DID_RANGE_PATTERN = '^\\s*((-?\\d+(\\.\\d+)?)\\s*-\\s*(-?\\d+(\\.\\d+)?)|(>=|<=|>|<)\\s*-?\\d+(\\.\\d+)?|-?\\d+(\\.\\d+)?)\\s*$';
const NOT_OK_FIELDS: MasterFieldDef[] = [
  { key: 'notOkPhoto', label: 'Not OK: Photo', type: 'select', options: ['Y', 'N'], mandatory: true, defaultValue: 'N', description: 'Photo is mandatory when the item is marked Not OK.' },
  { key: 'notOkAudio', label: 'Not OK: Audio', type: 'select', options: ['Y', 'N'], mandatory: true, defaultValue: 'N' },
  { key: 'notOkVideo', label: 'Not OK: Video', type: 'select', options: ['Y', 'N'], mandatory: true, defaultValue: 'N' },
  { key: 'notOkText', label: 'Not OK: Text', type: 'select', options: ['Y', 'N'], mandatory: true, defaultValue: 'Y' },
];

export const WORKSHOP_MODULES: MasterModuleMeta[] = [
  // 1. Appointment Reminder
  {
    code: 'appointment',
    title: 'Appointment Reminder',
    subtitle: 'Service bookings, time slot intake quotas, holiday operating hours & customer reminders',
    badge: 'appointment',
    iconName: 'Calendar',
    accentColor: 'blue',
    categoryTag: 'Customer Inflow & Intake',
    displayLines: ['Appointment', 'Reminder'],
  },
  // 2. Pickup & Drop - Admin / Driver App
  {
    code: 'reception',
    title: 'Pickup & Drop - Admin / Driver App',
    subtitle: 'Pick & Drop transit queues, driver allocation roster, route geofences & chauffeur tracking',
    badge: 'pnd_driver',
    iconName: 'Car',
    accentColor: 'indigo',
    categoryTag: 'Transit & Driver App',
    displayLines: ['Pickup & Drop - Admin', 'Driver App'],
  },
  // 3. Receptionist
  {
    code: 'receptionist',
    title: 'Receptionist',
    subtitle: 'Customer reception desk check-in, lounge greeting checklist, digital welcome & waiting SLA',
    badge: 'receptionist',
    iconName: 'Users',
    accentColor: 'sky',
    categoryTag: 'Customer Experience & Lounge',
    displayLines: ['Receptionist'],
  },
  // 4. Security Guard
  {
    code: 'security',
    title: 'Security Guard',
    subtitle: 'Physical vehicle gate inward/outward barrier verification, pass generation & denial logs',
    badge: 'security',
    iconName: 'ShieldCheck',
    accentColor: 'emerald',
    categoryTag: 'Perimeter & Asset Security',
    displayLines: ['Security', 'Guard'],
  },
  // 5. JC Creation- Mechanical
  {
    code: 'jc_creation',
    title: 'JC Creation- Mechanical',
    subtitle: 'Open repair orders, customer complaint capture, PPL line variants & mechanical labor codes',
    badge: 'jc_mechanical',
    iconName: 'FileText',
    accentColor: 'violet',
    categoryTag: 'Mechanical Service Orders',
    displayLines: ['JC Creation-', 'Mechanical'],
  },
  // 6. JC Creation- Bodyshop
  {
    code: 'bodyshop',
    title: 'JC Creation- Bodyshop',
    subtitle: 'Accident estimates, panel repair ops, heated spray booth schedules & paint material systems',
    badge: 'jc_bodyshop',
    iconName: 'Paintbrush',
    accentColor: 'fuchsia',
    categoryTag: 'Body Repairs & Refinishing',
    displayLines: ['JC Creation-', 'Bodyshop'],
  },
  // 7. JC Tracking
  {
    code: 'jc_tracking',
    title: 'JC Tracking',
    subtitle: 'Real-time workshop bay occupancy, lift matrix, technician skill dispatch & delay tracking',
    badge: 'jc_tracking',
    iconName: 'Wrench',
    accentColor: 'sky',
    categoryTag: 'Shop Floor & Bay Tracking',
    displayLines: ['JC Tracking'],
  },
  // 8. eQC / Washing
  {
    code: 'eqc',
    title: 'eQC / Washing',
    subtitle: 'Electronic quality check, EV high-voltage safety inspection, torque audits & wash bay sign-off',
    badge: 'eqc_washing',
    iconName: 'CheckSquare',
    accentColor: 'teal',
    categoryTag: 'Quality Assurance & Sign-off',
    displayLines: ['eQC', 'Washing'],
  },
  // 9. THD
  {
    code: 'thd',
    title: 'THD',
    subtitle: 'Technical Help Desk, workshop diagnostic tools, calibration trackers & engineering tickets',
    badge: 'thd',
    iconName: 'HelpCircle',
    accentColor: 'orange',
    categoryTag: 'Technical Help Desk & Diagnostics',
    displayLines: ['THD'],
  },
  // 10. SPD
  {
    code: 'spd',
    title: 'SPD',
    subtitle: 'Spare Parts Dispatch, fast-moving parts inventory, warehouse bin allocation & stockout shortage tracking',
    badge: 'spd',
    iconName: 'Package',
    accentColor: 'amber',
    categoryTag: 'Supply Chain & Inventory',
    displayLines: ['SPD'],
  },
  // 11. Auth. Request Approval - Mobile / Web & Service Claims
  {
    code: 'claim',
    title: 'Auth. Request Approval & Service Claims',
    subtitle: 'Auth. Request Approval - Mobile • Auth. Request - Web • Service Claims - Web',
    badge: 'claim',
    iconName: 'Award',
    accentColor: 'rose',
    categoryTag: 'Warranty & Commercial Claims',
    displayLines: ['Auth. Request Approval - Mobile', 'Auth. Request - Web', 'Service Claims - Web'],
  },
  // 12. Customer Journey
  {
    code: 'customer_journey',
    title: 'Customer Journey & Dealer Network',
    subtitle: 'Digital customer journey transparency, live milestone tracking, mobile alerts & dealer network',
    badge: 'journey',
    iconName: 'TrendingUp',
    accentColor: 'slate',
    categoryTag: 'Customer Journey & Dealer Network',
    displayLines: ['Customer Journey', 'Dealer Network'],
  },
];

export const MASTER_COLLECTIONS: MasterConfig[] = [
  // =========================================================================
  // LOGICAL GROUP 1: VEHICLE & PRODUCT DATA
  // =========================================================================
  {
    id: 'ppl_master',
    name: 'PPL & PL (Product Line) Master',
    owner: 'TML_ADMIN',
    category: 'Vehicle Hierarchy',
    logicalGroup: 'Vehicle Data',
    moduleCode: 'jc_creation',
    moduleName: 'JC Creation- Mechanical',
    description: 'Parent Product Line (PPL) and Product Line (PL) variants defining OEM parts and service eligibility.',
    fields: [
      { key: 'bu', label: 'BU', type: 'select', options: ['PV', 'EV', 'CV'], mandatory: true, isSystem: true },
      { key: 'pplCode', label: 'PPL Code', type: 'text', mandatory: true, isSystem: true },
      { key: 'pplName', label: 'PPL (Parent Line)', type: 'text', mandatory: true, isSystem: true },
      { key: 'plName', label: 'PL (Variant / Sub-Line)', type: 'text', mandatory: true, isSystem: true },
      { key: 'fuelType', label: 'Powertrain', type: 'select', options: ['EV', 'Petrol', 'Diesel', 'CNG'], isSystem: true },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'], isSystem: true },
      {
        key: 'extended_warranty_tier',
        label: 'Extended Warranty Tier',
        type: 'select',
        options: ['PLATINUM', 'GOLD', 'SILVER', 'STANDARD'],
        isCustom: true,
        displayInDealerApp: true,
        dealerTargetModule: 'vehicle_journey',
        dealerDisplayLabel: 'Warranty & AMC Protection Tier',
        valueMapping: {
          PLATINUM: '🛡️ Platinum 5-Yr Comprehensive Cover',
          GOLD: '⭐ Gold Shield 3-Yr Comprehensive',
          SILVER: '🔹 Silver Drivetrain Only',
          STANDARD: 'Standard 2-Yr Factory Warranty',
        },
        description: 'Auto-mapped protection tier displayed on Dealer Job Card & Vehicle Journey screens.',
      },
      {
        key: 'telematics_ota_status',
        label: 'Telematics Diagnostic Tier',
        type: 'select',
        options: ['OTA_ACTIVE', 'ECU_FLASH_REQ', 'NON_CONNECTED'],
        isCustom: true,
        displayInDealerApp: true,
        dealerTargetModule: 'vehicle_journey',
        dealerDisplayLabel: 'iRA Connected Telematics Status',
        valueMapping: {
          OTA_ACTIVE: '🟢 Connected Fleet OTA Active (v4.2)',
          ECU_FLASH_REQ: '⚠️ Manual Bay Flash Required',
          NON_CONNECTED: '⚪ Legacy Non-Telematics ECU',
        },
        description: 'Telematics connectivity status for dealer technician inspection guidance.',
      },
    ],
    records: [
      {
        id: 'PPL-01',
        bu: 'EV',
        pplCode: 'PPL-NEXON-EV',
        pplName: 'Nexon',
        plName: 'Nexon EV Long Range (45 kWh)',
        fuelType: 'EV',
        active: 'Y',
        extended_warranty_tier: 'PLATINUM',
        telematics_ota_status: 'OTA_ACTIVE',
      },
      {
        id: 'PPL-02',
        bu: 'PV',
        pplCode: 'PPL-NEXON-ICE',
        pplName: 'Nexon',
        plName: 'Nexon Fearless+ DCA Petrol',
        fuelType: 'Petrol',
        active: 'Y',
        extended_warranty_tier: 'GOLD',
        telematics_ota_status: 'OTA_ACTIVE',
      },
      {
        id: 'PPL-03',
        bu: 'PV',
        pplCode: 'PPL-ALTROZ',
        pplName: 'Altroz',
        plName: 'Altroz XZ i-CNG Twin Cylinder',
        fuelType: 'CNG',
        active: 'Y',
        extended_warranty_tier: 'GOLD',
        telematics_ota_status: 'NON_CONNECTED',
      },
      {
        id: 'PPL-04',
        bu: 'PV',
        pplCode: 'PPL-HARRIER',
        pplName: 'Harrier',
        plName: 'Harrier Fearless Dark 2.0L Diesel AT',
        fuelType: 'Diesel',
        active: 'Y',
        extended_warranty_tier: 'PLATINUM',
        telematics_ota_status: 'ECU_FLASH_REQ',
      },
      {
        id: 'PPL-05',
        bu: 'EV',
        pplCode: 'PPL-CURVV-EV',
        pplName: 'Curvv',
        plName: 'Curvv EV 55 kWh Hyperion',
        fuelType: 'EV',
        active: 'Y',
        extended_warranty_tier: 'PLATINUM',
        telematics_ota_status: 'OTA_ACTIVE',
      },
    ],
  },
  {
    id: 'model_checklists',
    name: 'Tech Model Specific Checklist',
    owner: 'TML_ADMIN',
    category: 'Vehicle Inspection',
    logicalGroup: 'Vehicle Data',
    moduleCode: 'jc_tracking',
    moduleName: 'JC Tracking',
    description: 'Mandatory technical quality inspection checklist items per vehicle Parent Product Line and Product Line.',
    fields: [
      { key: 'section', label: 'Section', type: 'text', mandatory: true },
      { key: 'pplName', label: 'PPL Name', type: 'select', options: ['Altroz', 'Nexon', 'Harrier', 'Safari', 'Punch', 'Curvv', 'Tiago'], mandatory: true },
      { key: 'pl', label: 'PL (Variant)', type: 'text', mandatory: true },
      { key: 'checkDescription', label: 'Check Description', type: 'text', mandatory: true },
      { key: 'actionBtn1', label: 'Action Btn 1', type: 'text' },
      { key: 'actionBtn2', label: 'Action Btn 2', type: 'text' },
      { key: 'actionBtn3', label: 'Action Btn 3', type: 'text' },
      { key: 'actionBtn4', label: 'Action Btn 4', type: 'text' },
      { key: 'actionBtn5', label: 'Action Btn 5', type: 'text' },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
      { key: 'displayOrder', label: 'Display Order', type: 'number' },
    ],
    records: [
      { id: 'MC-01', section: 'Technician Model Checklist', pplName: 'Altroz', pl: 'Altroz DCA / Turbo', checkDescription: 'Brake Pipe and Hoses', actionBtn1: 'Good', actionBtn2: 'Inspect', actionBtn3: 'Replace', actionBtn4: 'Clean', actionBtn5: 'No Action', active: 'Y', displayOrder: 1 },
      { id: 'MC-02', section: 'Technician Model Checklist', pplName: 'Altroz', pl: 'Altroz DCA / Turbo', checkDescription: 'Drive Shaft Boots', actionBtn1: 'Good', actionBtn2: 'Inspect', actionBtn3: 'Replace', actionBtn4: 'Clean', actionBtn5: 'No Action', active: 'Y', displayOrder: 2 },
      { id: 'MC-03', section: 'Technician Model Checklist', pplName: 'Altroz', pl: 'Altroz DCA / Turbo', checkDescription: 'Suspension B/J & D/C', actionBtn1: 'Good', actionBtn2: 'Inspect', actionBtn3: 'Replace', actionBtn4: 'Clean', actionBtn5: 'No Action', active: 'Y', displayOrder: 3 },
      { id: 'MC-04', section: 'Technician Model Checklist', pplName: 'Nexon', pl: 'Nexon XZ+ Petrol', checkDescription: 'Brake Pipe and Hoses', actionBtn1: 'Good', actionBtn2: 'Inspect', actionBtn3: 'Replace', actionBtn4: 'Clean', actionBtn5: 'No Action', active: 'Y', displayOrder: 4 },
      { id: 'MC-05', section: 'Technician Model Checklist', pplName: 'Nexon', pl: 'Nexon XZ+ Petrol', checkDescription: 'Drive Shaft Boots', actionBtn1: 'Good', actionBtn2: 'Inspect', actionBtn3: 'Replace', actionBtn4: 'Clean', actionBtn5: 'No Action', active: 'Y', displayOrder: 5 },
      { id: 'MC-06', section: 'Technician Model Checklist', pplName: 'Nexon', pl: 'Nexon XZ+ Petrol', checkDescription: 'Suspension B/J & D/C', actionBtn1: 'Good', actionBtn2: 'Inspect', actionBtn3: 'Replace', actionBtn4: 'Clean', actionBtn5: 'No Action', active: 'Y', displayOrder: 6 },
      { id: 'MC-07', section: 'Technician Model Checklist', pplName: 'Nexon', pl: 'Nexon EV Empowered', checkDescription: 'HV Traction Cable Insulation & Connector Seals', actionBtn1: 'Good', actionBtn2: 'Inspect', actionBtn3: 'Replace', actionBtn4: 'Torque', actionBtn5: 'No Action', active: 'Y', displayOrder: 7 },
    ],
  },
  {
    id: 'complaint_codes',
    name: 'Complaint Code Category Master',
    owner: 'TML_ADMIN',
    category: 'Complaints & Diagnostics',
    logicalGroup: 'Vehicle Data',
    moduleCode: 'jc_creation',
    moduleName: 'JC Creation- Mechanical',
    description: 'Hierarchical customer voice codes (Symptom, System, Sub-System) for standardization.',
    fields: [
      { key: 'categoryCode', label: 'Category Code', type: 'text', mandatory: true },
      { key: 'systemName', label: 'System Group', type: 'select', options: ['Engine & Powertrain', 'Brakes & Suspension', 'Electrical & Battery', 'HVAC & AC', 'Body & Interiors', 'Infotainment & Connected'] },
      { key: 'complaintDesc', label: 'Customer Voice Description', type: 'text', mandatory: true },
      { key: 'bu', label: 'Applicable BU', type: 'select', options: ['PV + EV', 'PV', 'EV', 'CV'] },
      { key: 'severity', label: 'Default Severity', type: 'select', options: ['High', 'Medium', 'Low'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'CC-01', categoryCode: 'ENG-NOIS-01', systemName: 'Engine & Powertrain', complaintDesc: 'Abnormal squeal / rattling noise during cold start', bu: 'PV', severity: 'Medium', active: 'Y' },
      { id: 'CC-02', categoryCode: 'BRK-VIB-02', systemName: 'Brakes & Suspension', complaintDesc: 'Steering shudder or brake pedal vibration on deceleration', bu: 'PV + EV', severity: 'High', active: 'Y' },
      { id: 'CC-03', categoryCode: 'BAT-SOC-03', systemName: 'Electrical & Battery', complaintDesc: 'Sudden drop in EV Battery SOC / Limited Performance turtle lamp', bu: 'EV', severity: 'High', active: 'Y' },
      { id: 'CC-04', categoryCode: 'AC-COOL-04', systemName: 'HVAC & AC', complaintDesc: 'Insufficient cooling during idle or city traffic', bu: 'PV + EV', severity: 'Medium', active: 'Y' },
      { id: 'CC-05', categoryCode: 'INFO-SCR-05', systemName: 'Infotainment & Connected', complaintDesc: 'Harman touchscreen blanking / Apple CarPlay disconnects', bu: 'PV + EV', severity: 'Low', active: 'Y' },
    ],
  },
  {
    id: 'job_codes',
    name: 'Job Code & FRT Master',
    owner: 'TML_ADMIN',
    category: 'Labor & Billed Hours',
    logicalGroup: 'Vehicle Data',
    moduleCode: 'jc_creation',
    moduleName: 'JC Creation- Mechanical',
    description: 'Tata Motors Flat Rate Time (FRT) standard labor operations and standard billed hours.',
    fields: [
      { key: 'jobCode', label: 'Labor Job Code', type: 'text', mandatory: true },
      { key: 'operationName', label: 'Operation Name', type: 'text', mandatory: true },
      { key: 'skillLevel', label: 'Required Skill', type: 'select', options: ['L0 (Apprentice)', 'L1 (Certified)', 'L2 (Master)', 'EV Level-3', 'Diagnostic Expert'] },
      { key: 'frtHours', label: 'Standard FRT (Hrs)', type: 'number', mandatory: true },
      { key: 'category', label: 'Work Category', type: 'select', options: ['Periodic Maintenance', 'Running Repair', 'Warranty', 'Recall'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'JC-01', jobCode: 'TML-LAB-1001', operationName: 'Engine Oil & Filter Replacement (Periodic)', skillLevel: 'L1 (Certified)', frtHours: 0.8, category: 'Periodic Maintenance', active: 'Y' },
      { id: 'JC-02', jobCode: 'TML-LAB-2042', operationName: 'Front Brake Disc & Caliper Overhaul', skillLevel: 'L2 (Master)', frtHours: 1.5, category: 'Running Repair', active: 'Y' },
      { id: 'JC-03', jobCode: 'TML-LAB-3901', operationName: 'EV High-Voltage Isolation & Pack Diagnostic Scan', skillLevel: 'EV Level-3', frtHours: 1.2, category: 'Warranty', active: 'Y' },
      { id: 'JC-04', jobCode: 'TML-LAB-4100', operationName: 'Four-Wheel 3D Laser Alignment & Camber Calibration', skillLevel: 'L1 (Certified)', frtHours: 0.9, category: 'Running Repair', active: 'Y' },
    ],
  },
  {
    id: 'complaint_job_linkage',
    name: 'Complaint Job Code PPL Linkage',
    owner: 'TML_ADMIN',
    category: 'Labor Mapping',
    logicalGroup: 'Vehicle Data',
    moduleCode: 'jc_creation',
    moduleName: 'JC Creation- Mechanical',
    description: 'AI-assisted routing mapping customer symptoms to standard labor job codes filtered by vehicle model.',
    fields: [
      { key: 'pplName', label: 'PPL Name', type: 'select', options: ['Nexon', 'Altroz', 'Harrier', 'Safari', 'Punch', 'Curvv', 'Tiago'], mandatory: true },
      { key: 'complaintCode', label: 'Complaint Code', type: 'text', mandatory: true },
      { key: 'recommendedJobCode', label: 'Recommended Job Code', type: 'text', mandatory: true },
      { key: 'matchConfidence', label: 'Match Confidence', type: 'select', options: ['Direct Match (100%)', 'High (90%)', 'Medium (75%)'] },
      { key: 'autoAssignBay', label: 'Suggested Bay Type', type: 'select', options: ['Mechanical', 'Electrical', 'EV Isolation', 'Wheel Alignment', 'AC Bay'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'CJ-01', pplName: 'Nexon', complaintCode: 'BRK-VIB-02', recommendedJobCode: 'TML-LAB-2042 (Front Brake Overhaul)', matchConfidence: 'Direct Match (100%)', autoAssignBay: 'Mechanical', active: 'Y' },
      { id: 'CJ-02', pplName: 'Nexon', complaintCode: 'BAT-SOC-03', recommendedJobCode: 'TML-LAB-3901 (EV HV Pack Diagnostic)', matchConfidence: 'Direct Match (100%)', autoAssignBay: 'EV Isolation', active: 'Y' },
      { id: 'CJ-03', pplName: 'Altroz', complaintCode: 'ENG-NOIS-01', recommendedJobCode: 'TML-LAB-1001 (Oil & Tensioner Check)', matchConfidence: 'High (90%)', autoAssignBay: 'Mechanical', active: 'Y' },
    ],
  },
  {
    id: 'ev_safety_protocols',
    name: 'EV High-Voltage Safety & Protocols',
    owner: 'TML_ADMIN',
    category: 'EV Protocols',
    logicalGroup: 'Electronic Quality Check',
    moduleCode: 'eqc',
    moduleName: 'eQC / Washing',
    description: 'Mandatory OEM safety gates before touching high-voltage (350V - 400V DC) EV components.',
    fields: [
      { key: 'protocolCode', label: 'Protocol ID', type: 'text', mandatory: true },
      { key: 'safetyGate', label: 'Mandatory Isolation Protocol', type: 'text', mandatory: true },
      { key: 'requiredPpe', label: 'Mandatory PPE Grade', type: 'select', options: ['Class 0 1000V Insulated Gloves + Face Shield', 'Arc Flash Suit Level 2', 'Rubber Insulated Floor Matting 17kV'] },
      { key: 'digitalMultimeterCheck', label: 'Bus Voltage Below 5V Verification', type: 'select', options: ['Y', 'N'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'EV-01', protocolCode: 'EV-ISO-01', safetyGate: 'Manual Service Disconnect (MSD) orange plug removal & lock-out tag-out (LOTO)', requiredPpe: 'Class 0 1000V Insulated Gloves + Face Shield', digitalMultimeterCheck: 'Y', active: 'Y' },
      { id: 'EV-02', protocolCode: 'EV-ISO-02', safetyGate: '12V Auxiliary battery terminal disconnection to disable HV contactor control', requiredPpe: 'Class 0 1000V Insulated Gloves + Face Shield', digitalMultimeterCheck: 'Y', active: 'Y' },
      { id: 'EV-03', protocolCode: 'EV-ISO-03', safetyGate: 'Capacitor discharge wait cycle (10 mins) and inverter busbar residual test', requiredPpe: 'Rubber Insulated Floor Matting 17kV', digitalMultimeterCheck: 'Y', active: 'Y' },
    ],
  },
  {
    id: 'dtc_telematics_alerts',
    name: 'DTC Fault Code Alert & Telematics',
    owner: 'TML_ADMIN',
    category: 'Telematics Codes',
    logicalGroup: 'Parts, Claims & Support',
    moduleCode: 'thd',
    moduleName: 'THD',
    description: 'Connected vehicle telemetry triggers from iRA modem triggering preemptive telecaller CRM outreach.',
    fields: [
      { key: 'dtcCode', label: 'OBD-II / CAN DTC Code', type: 'text', mandatory: true },
      { key: 'description', label: 'Telematics Fault Description', type: 'text', mandatory: true },
      { key: 'alertSeverity', label: 'Telemetry Alert Level', type: 'select', options: ['Critical Emergency (Red Lamp)', 'Warning Advisory (Amber Lamp)', 'Informational Routine (Blue)'] },
      { key: 'autoBookAppointment', label: 'Auto Trigger CRM Outbound Call', type: 'select', options: ['Y', 'N'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'DTC-01', dtcCode: 'P0A80-00', description: 'HV Battery Pack Cell Imbalance > 150mV across modules', alertSeverity: 'Critical Emergency (Red Lamp)', autoBookAppointment: 'Y', active: 'Y' },
      { id: 'DTC-02', dtcCode: 'P1A02-14', description: 'Electric Motor Inverter Coolant Flow Below Threshold', alertSeverity: 'Warning Advisory (Amber Lamp)', autoBookAppointment: 'Y', active: 'Y' },
      { id: 'DTC-03', dtcCode: 'B1245-01', description: 'Smart Key Fob Battery Low (30-day forecast)', alertSeverity: 'Informational Routine (Blue)', autoBookAppointment: 'N', active: 'Y' },
    ],
  },

  // =========================================================================
  // LOGICAL GROUP 2: DEALER NETWORK & FACILITIES
  // =========================================================================
  {
    id: 'dealer_details_registry',
    name: 'Authorized Dealer Network & Facility Registry',
    owner: 'TML_ADMIN',
    category: 'Facility Registry',
    logicalGroup: 'Dealer Network',
    moduleCode: 'customer_journey',
    moduleName: 'Customer Journey',
    isInteractiveSpecial: true,
    interactiveTabTarget: 'dealers',
    description: 'PAN-India authorized dealer facility registry, 3S/2S workshop status, zone affiliations, and active bay counts.',
    fields: [
      { key: 'dealerCode', label: 'Dealer Code', type: 'text', mandatory: true },
      { key: 'dealerName', label: 'Dealership Facility Name', type: 'text', mandatory: true },
      { key: 'city', label: 'City', type: 'text', mandatory: true },
      { key: 'zone', label: 'Zone', type: 'select', options: ['South', 'North', 'West', 'East'] },
      { key: 'facilityType', label: 'Facility Type', type: 'select', options: ['3S (Sales, Service, Spares)', '2S (Service & Spares)', '1S (Express Workshop)'] },
      { key: 'totalBays', label: 'Total Physical Bays', type: 'number', mandatory: true },
      { key: 'status', label: 'Operating Status', type: 'select', options: ['ACTIVE', 'SUSPENDED', 'UNDER_AUDIT'] },
    ],
    records: [
      { id: 'DLR-01', dealerCode: 'DLR1001', dealerName: 'Sample Motors Hyderabad', city: 'Hyderabad', zone: 'South', facilityType: '3S (Sales, Service, Spares)', totalBays: 12, status: 'ACTIVE' },
      { id: 'DLR-02', dealerCode: 'DLR1002', dealerName: 'Rudra Motors South', city: 'Bangalore', zone: 'South', facilityType: '3S (Sales, Service, Spares)', totalBays: 18, status: 'ACTIVE' },
      { id: 'DLR-03', dealerCode: 'DLR1003', dealerName: 'Concorde Motors Mumbai', city: 'Mumbai', zone: 'West', facilityType: '3S (Sales, Service, Spares)', totalBays: 24, status: 'ACTIVE' },
      { id: 'DLR-04', dealerCode: 'DLR1004', dealerName: 'Lexicon Motors Delhi', city: 'New Delhi', zone: 'North', facilityType: '3S (Sales, Service, Spares)', totalBays: 20, status: 'ACTIVE' },
      { id: 'DLR-05', dealerCode: 'DLR1005', dealerName: 'Austin Motors Kolkata', city: 'Kolkata', zone: 'East', facilityType: '2S (Service & Spares)', totalBays: 14, status: 'ACTIVE' },
    ],
  },
  {
    id: 'bay_management_interactive',
    name: 'Bay Management Master & Lift Matrix',
    owner: 'DEALER_ADMIN',
    category: 'Bay Setup',
    logicalGroup: 'Dealer Network',
    moduleCode: 'jc_tracking',
    moduleName: 'JC Tracking',
    isInteractiveSpecial: true,
    interactiveTabTarget: 'bays',
    description: 'Comprehensive physical bay infrastructure, floor levels, 2-post/4-post lift availability, special tooling, and approval states.',
    fields: [
      { key: 'bayName', label: 'Bay Name', type: 'text', mandatory: true },
      { key: 'bayType', label: 'Bay Classification', type: 'select', options: ['Mechanical', 'Electrical', 'EV', 'Fleet', 'Speedo', 'AC', 'BodyShop'] },
      { key: 'floor', label: 'Floor Level', type: 'select', options: ['Ground', 'Floor 1', 'Floor 2', 'Basement'] },
      { key: 'liftAvailability', label: 'Lift Setup', type: 'select', options: ['No Lift', '2 post lift', '4 post lift'] },
      { key: 'techSupervisor', label: 'Assigned Supervisor', type: 'text', mandatory: true },
      { key: 'approvalStatus', label: 'Approval Status', type: 'select', options: ['Approved', 'Pending Approval', 'Draft', 'Rejected'] },
    ],
    records: [
      { id: 'BAY-01', bayName: 'Mechanical Bay 01', bayType: 'Mechanical', floor: 'Floor 1', liftAvailability: '2 post lift', techSupervisor: 'Ram', approvalStatus: 'Approved' },
      { id: 'BAY-02', bayName: 'Mechanical Bay 02', bayType: 'Mechanical', floor: 'Floor 1', liftAvailability: '2 post lift', techSupervisor: 'Ram', approvalStatus: 'Approved' },
      { id: 'BAY-03', bayName: 'Electrical Bay 01', bayType: 'Electrical', floor: 'Floor 1', liftAvailability: 'No Lift', techSupervisor: 'Madhu', approvalStatus: 'Pending Approval' },
      { id: 'BAY-04', bayName: 'EV High-Voltage Bay 01', bayType: 'EV', floor: 'Floor 1', liftAvailability: '2 post lift', techSupervisor: 'Madhu', approvalStatus: 'Approved' },
      { id: 'BAY-05', bayName: 'Fleet Service Bay 01', bayType: 'Fleet', floor: 'Floor 1', liftAvailability: '4 post lift', techSupervisor: 'Ram', approvalStatus: 'Draft' },
    ],
  },
  {
    id: 'bay_division_summary',
    name: 'Dealership Division Bay Allocation',
    owner: 'DEALER_ADMIN',
    category: 'Capacity Allocations',
    logicalGroup: 'Dealer Network',
    moduleCode: 'jc_tracking',
    moduleName: 'JC Tracking',
    description: 'Dealership division bay capacities across Mechanical, Bodyshop, Wheel Alignment, Electrical, AC, Speedo, Fleet.',
    fields: [
      { key: 'divisionName', label: 'Division Name', type: 'text', mandatory: true },
      { key: 'dealerName', label: 'Dealer Name', type: 'text', mandatory: true },
      { key: 'bu', label: 'BU', type: 'select', options: ['PV', 'EV', 'PV + EV', 'CV'] },
      { key: 'bayCount', label: 'Total Bay Count', type: 'number', mandatory: true },
      { key: 'mechanical', label: 'Mechanical', type: 'number' },
      { key: 'bodyshop', label: 'Bodyshop', type: 'number' },
      { key: 'wheelAlignment', label: 'Wheel Alignment', type: 'number' },
      { key: 'electrical', label: 'Electrical', type: 'number' },
      { key: 'ac', label: 'AC', type: 'number' },
      { key: 'speedo', label: 'Speedo', type: 'number' },
      { key: 'fleet', label: 'Fleet', type: 'number' },
    ],
    records: [
      { id: 'BD-01', divisionName: 'D1 - South Main', dealerName: 'Sample Motors Hyderabad', bu: 'PV + EV', bayCount: 10, mechanical: 3, bodyshop: 2, wheelAlignment: 1, electrical: 2, ac: 1, speedo: 1, fleet: 0 },
      { id: 'BD-02', divisionName: 'D2 - Express Hub', dealerName: 'Sample Motors Hyderabad', bu: 'PV + EV', bayCount: 15, mechanical: 3, bodyshop: 3, wheelAlignment: 2, electrical: 2, ac: 2, speedo: 1, fleet: 2 },
    ],
  },
  {
    id: 'bodyshop_facility_master',
    name: 'Bodyshop Master & Facility Operations',
    owner: 'DEALER_ADMIN',
    category: 'BodyShop Facilities',
    logicalGroup: 'Bodyshop',
    moduleCode: 'bodyshop',
    moduleName: 'JC Creation- Bodyshop',
    isInteractiveSpecial: true,
    interactiveTabTarget: 'bodyshop',
    description: 'Comprehensive Body Shop facility data, capacity, specialized tools calibration, and lead technician assignments.',
    fields: [
      { key: 'facilityCode', label: 'Facility Code', type: 'text', mandatory: true },
      { key: 'dealerName', label: 'Dealership Name', type: 'text', mandatory: true },
      { key: 'divisionName', label: 'Division / Complex', type: 'text', mandatory: true },
      { key: 'bu', label: 'BU Classification', type: 'select', options: ['PV', 'EV', 'PV + EV', 'CV'], mandatory: true },
      { key: 'totalBays', label: 'Total Bodyshop Bays', type: 'number', mandatory: true },
      { key: 'dentingStalls', label: 'Denting Stalls', type: 'number', mandatory: true },
      { key: 'paintBooths', label: 'Heated Paint Booths', type: 'number', mandatory: true },
      { key: 'prepBays', label: 'Paint Prep Bays', type: 'number', mandatory: true },
      { key: 'chassisJigs', label: 'Chassis Alignment Jigs', type: 'number', mandatory: true },
      { key: 'maxSimultaneousRepairs', label: 'Max Active WIP Jobs', type: 'number', mandatory: true },
      { key: 'monthlyTargetThroughput', label: 'Monthly Throughput Target', type: 'number', mandatory: true },
      { key: 'supervisorName', label: 'Floor Supervisor', type: 'text', mandatory: true },
      { key: 'status', label: 'Operating Status', type: 'select', options: ['Active', 'Maintenance', 'Capacity Constrained'], mandatory: true },
    ],
    records: [
      { id: 'BF-01', facilityCode: 'BS-HYD-01', dealerName: 'Sample Motors Hyderabad', divisionName: 'D1 - South Main Workshop (Basement Bodyshop Complex)', bu: 'PV + EV', totalBays: 8, dentingStalls: 4, paintBooths: 2, prepBays: 2, chassisJigs: 1, maxSimultaneousRepairs: 14, monthlyTargetThroughput: 110, supervisorName: 'Ramachandran M', status: 'Active' },
      { id: 'BF-02', facilityCode: 'BS-HYD-02', dealerName: 'Sample Motors Hyderabad', divisionName: 'D2 - Express Hub Bodyshop Annex', bu: 'PV', totalBays: 6, dentingStalls: 3, paintBooths: 1, prepBays: 1, chassisJigs: 1, maxSimultaneousRepairs: 10, monthlyTargetThroughput: 80, supervisorName: 'K. S. Narayanan', status: 'Active' },
      { id: 'BF-03', facilityCode: 'BS-MUM-01', dealerName: 'Fortune Cars Worli', divisionName: 'Central Mumbai Crash Repair Center', bu: 'PV + EV', totalBays: 12, dentingStalls: 6, paintBooths: 3, prepBays: 2, chassisJigs: 2, maxSimultaneousRepairs: 22, monthlyTargetThroughput: 160, supervisorName: 'Vinod Shinde', status: 'Active' },
    ],
  },
  {
    id: 'holiday_calendar_master',
    name: 'Non-Operational Hours & Holiday Calendar',
    owner: 'DEALER_ADMIN',
    category: 'Operating Calendar',
    logicalGroup: 'Dealer Network',
    moduleCode: 'appointment',
    moduleName: 'Appointment Reminder',
    isInteractiveSpecial: true,
    interactiveTabTarget: 'calendar',
    description: 'Weekly day-off operating patterns and date-specific festival / plant maintenance overrides.',
    fields: [
      { key: 'date', label: 'Holiday Date', type: 'date', mandatory: true },
      { key: 'name', label: 'Occasion / Name', type: 'text', mandatory: true },
      { key: 'type', label: 'Classification', type: 'select', options: ['National Holiday', 'Festival Closure', 'State Holiday', 'Quarterly Maintenance'] },
      { key: 'hours', label: 'Operating Window', type: 'text', mandatory: true },
      { key: 'isClosed', label: 'Full Day Closed', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'HOL-01', date: '2026-10-02', name: 'Mahatma Gandhi Jayanti', type: 'National Holiday', hours: 'Closed', isClosed: 'Y' },
      { id: 'HOL-02', date: '2026-10-20', name: 'Dussehra / Vijayadashami', type: 'Festival Closure', hours: 'Closed', isClosed: 'Y' },
      { id: 'HOL-03', date: '2026-11-09', name: 'Diwali (Deepavali)', type: 'Festival Closure', hours: 'Closed', isClosed: 'Y' },
      { id: 'HOL-04', date: '2026-11-10', name: 'Govardhan Puja & Audit Maintenance', type: 'Quarterly Maintenance', hours: '09:00 AM - 01:00 PM', isClosed: 'N' },
    ],
  },
  {
    id: 'time_slot_quotas_master',
    name: 'Time Slot Quotas & Hourly Capacity',
    owner: 'DEALER_ADMIN',
    category: 'Intake Density',
    logicalGroup: 'Dealer Network',
    moduleCode: 'appointment',
    moduleName: 'Appointment Reminder',
    isInteractiveSpecial: true,
    interactiveTabTarget: 'timeslots',
    description: 'Regulates hourly intake densities, dedicated lift allocations, and walk-in buffer reserves per workshop division.',
    fields: [
      { key: 'slot', label: 'Time Window', type: 'text', mandatory: true },
      { key: 'cap', label: 'Max Vehicle Capacity', type: 'number', mandatory: true },
      { key: 'buffer', label: 'Walk-in Reserve Buffer', type: 'number', mandatory: true },
      { key: 'dedicatedBays', label: 'Dedicated Bays Allocated', type: 'number', mandatory: true },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'TS-01', slot: '09:00 AM - 10:00 AM', cap: 12, buffer: 3, dedicatedBays: 8, active: 'Y' },
      { id: 'TS-02', slot: '10:00 AM - 11:00 AM', cap: 14, buffer: 4, dedicatedBays: 9, active: 'Y' },
      { id: 'TS-03', slot: '11:00 AM - 12:00 PM', cap: 12, buffer: 3, dedicatedBays: 8, active: 'Y' },
      { id: 'TS-04', slot: '12:00 PM - 01:00 PM', cap: 10, buffer: 2, dedicatedBays: 7, active: 'Y' },
      { id: 'TS-05', slot: '02:00 PM - 03:00 PM', cap: 10, buffer: 2, dedicatedBays: 7, active: 'Y' },
      { id: 'TS-06', slot: '03:00 PM - 04:00 PM', cap: 8, buffer: 2, dedicatedBays: 6, active: 'Y' },
      { id: 'TS-07', slot: '04:00 PM - 05:00 PM', cap: 8, buffer: 2, dedicatedBays: 6, active: 'Y' },
      { id: 'TS-08', slot: '05:00 PM - 06:30 PM', cap: 6, buffer: 2, dedicatedBays: 5, active: 'Y' },
    ],
  },

  // =========================================================================
  // LOGICAL GROUP 3: SERVICE OPERATIONS & FLOOR
  // =========================================================================
  {
    id: 'bay_technician',
    name: 'Bay - Technician & Supervisor Roster',
    owner: 'DEALER_ADMIN',
    category: 'Manpower Allocation',
    logicalGroup: 'Service Operations',
    moduleCode: 'jc_tracking',
    moduleName: 'JC Tracking',
    description: 'Assigns certified technicians and technical supervisors to designated workshop bays.',
    fields: [
      { key: 'dealer', label: 'Dealer', type: 'text', mandatory: true },
      { key: 'division', label: 'Division', type: 'text', mandatory: true },
      { key: 'bayName', label: 'Bay Name', type: 'text', mandatory: true },
      { key: 'technicianType', label: 'Technician Type', type: 'select', options: ['Mechanical', 'Electrical', 'EV Certified', 'AC Specialist', 'Body Repair'] },
      { key: 'technicianName', label: 'Technician Name', type: 'text', mandatory: true },
      { key: 'experienceYears', label: 'Experience (in yrs)', type: 'number' },
      { key: 'skill', label: 'Skill Level', type: 'select', options: ['L0', 'L1', 'L2', 'Diagnostic Master'] },
      { key: 'certification', label: 'Certification', type: 'text' },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'BT-01', dealer: 'DLR1001', division: 'D1 - South Main', bayName: 'Elect Bay 01', technicianType: 'Electrical', technicianName: 'Rohit Yadav', experienceYears: 3, skill: 'L2', certification: 'TML Level 2 Auto-Electrical', active: 'Y' },
      { id: 'BT-02', dealer: 'DLR1001', division: 'D1 - South Main', bayName: 'Mech Bay 01', technicianType: 'Mechanical', technicianName: 'Shyam Sundar', experienceYears: 5, skill: 'L2', certification: 'DCA Gearbox Specialist', active: 'Y' },
      { id: 'BT-03', dealer: 'DLR1001', division: 'D2 - Express Hub', bayName: 'EV Bay 01', technicianType: 'EV Certified', technicianName: 'Arjun Das', experienceYears: 4, skill: 'Diagnostic Master', certification: 'Tata EV 1000V High Voltage Certified', active: 'Y' },
    ],
  },
  {
    id: 'pause_reasons',
    name: 'Clocking Pause Reason Master',
    owner: 'TML_ADMIN',
    category: 'Bay Clocking Rules',
    logicalGroup: 'Service Operations',
    moduleCode: 'jc_tracking',
    moduleName: 'JC Tracking',
    description: 'Governs bay clocking pauses. Configures mandatory dependent fields (SAP Part No, THD No, Ticket ID).',
    fields: [
      { key: 'bu', label: 'BU', type: 'select', options: ['PV + EV', 'PV', 'EV', 'CV'], mandatory: true },
      { key: 'pauseReason', label: 'Pause Reason', type: 'text', mandatory: true },
      { key: 'dependantField1', label: 'Dependant Field 1 (Mandatory)', type: 'text', mandatory: true },
      { key: 'dependantField2', label: 'Dependant Field 2 (Mandatory)', type: 'text' },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
      { key: 'displayOrder', label: 'Display Order', type: 'number' },
    ],
    records: [
      { id: 'PR-01', bu: 'PV + EV', pauseReason: 'Parts Not Available', dependantField1: 'Part Description (DPM Unissued)', dependantField2: 'Order Number (SAP Order No)', active: 'Y', displayOrder: 1 },
      { id: 'PR-02', bu: 'PV + EV', pauseReason: 'THD Resolution Pending', dependantField1: 'THD Number (Open/Closed)', dependantField2: 'NA', active: 'Y', displayOrder: 2 },
      { id: 'PR-03', bu: 'PV + EV', pauseReason: 'Waiting for customer approval', dependantField1: 'Customer Approval Doc / OTP', dependantField2: 'NA', active: 'Y', displayOrder: 3 },
      { id: 'PR-04', bu: 'PV + EV', pauseReason: 'Manpower absenteeism', dependantField1: 'Supervisor Override Code', dependantField2: 'NA', active: 'Y', displayOrder: 4 },
      { id: 'PR-05', bu: 'EV', pauseReason: 'HV Battery Support Awaited', dependantField1: 'Ticket No (Ticket Description)', dependantField2: 'Safety Officer Clearance', active: 'Y', displayOrder: 5 },
      { id: 'PR-06', bu: 'PV + EV', pauseReason: 'Vendor Support Awaited', dependantField1: 'Vendor Name (BOSCH / Delphi)', dependantField2: 'Vendor Visit Date', active: 'Y', displayOrder: 6 },
      { id: 'PR-07', bu: 'PV + EV', pauseReason: 'Goodwill Approval Awaited', dependantField1: 'Goodwill Request ID (CRM)', dependantField2: 'DGM Endorsement ID', active: 'Y', displayOrder: 7 },
      { id: 'PR-08', bu: 'PV + EV', pauseReason: 'Extended Warranty Approval Awaited', dependantField1: 'Request ID (Raised to TML)', dependantField2: 'Insurance Surveyor Ref', active: 'Y', displayOrder: 8 },
    ],
  },
  {
    id: 'revisit_reasons',
    name: 'Repeat Complaint & Revisit LOV Master',
    owner: 'TML_ADMIN',
    category: 'Quality Root Causes',
    logicalGroup: 'Service Operations',
    moduleCode: 'jc_creation',
    moduleName: 'JC Creation- Mechanical',
    description: 'Standardized root cause classifications for customer workshop revisits within 30 days.',
    fields: [
      { key: 'reasonCode', label: 'Reason Code', type: 'text', mandatory: true },
      { key: 'reasonName', label: 'Revisit Classification', type: 'text', mandatory: true },
      { key: 'department', label: 'Accountable Department', type: 'select', options: ['Workmanship / Technician', 'Parts Quality / Defective Spare', 'Diagnosis Error', 'Customer Education'] },
      { key: 'escalateToDGM', label: 'Auto Escalate to DGM', type: 'select', options: ['Y', 'N'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'RR-01', reasonCode: 'REV-TECH-01', reasonName: 'Incomplete torque or loose fastener during initial repair', department: 'Workmanship / Technician', escalateToDGM: 'Y', active: 'Y' },
      { id: 'RR-02', reasonCode: 'REV-PART-02', reasonName: 'New spare part premature failure within warranty', department: 'Parts Quality / Defective Spare', escalateToDGM: 'N', active: 'Y' },
      { id: 'RR-03', reasonCode: 'REV-DIAG-03', reasonName: 'Incorrect fault diagnosis (Replaced wrong component)', department: 'Diagnosis Error', escalateToDGM: 'Y', active: 'Y' },
      { id: 'RR-04', reasonCode: 'REV-CUST-04', reasonName: 'Operating nuance / normal NVH characteristic explained', department: 'Customer Education', escalateToDGM: 'N', active: 'Y' },
    ],
  },
  {
    id: 'appointment_cancellation_lov',
    name: 'Appointment Cancellation & Reschedule LOV',
    owner: 'TML_ADMIN',
    category: 'Appointment Flow',
    logicalGroup: 'Service Operations',
    moduleCode: 'appointment',
    moduleName: 'Appointment Reminder',
    description: 'Standardized classifications for telecaller CRM reschedule and cancellation tracking.',
    fields: [
      { key: 'reasonCode', label: 'Reason Code', type: 'text', mandatory: true },
      { key: 'reasonName', label: 'Cancellation / Reschedule Reason', type: 'text', mandatory: true },
      { key: 'category', label: 'Initiated By', type: 'select', options: ['Customer Request', 'Dealership Capacity Constrained', 'Parts Shortage', 'Weather / Transit'] },
      { key: 'allowAutoReschedule', label: 'Allow Auto Reschedule in CRM', type: 'select', options: ['Y', 'N'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'AC-01', reasonCode: 'CANC-CUST-OUT', reasonName: 'Customer out of town / traveling', category: 'Customer Request', allowAutoReschedule: 'Y', active: 'Y' },
      { id: 'AC-02', reasonCode: 'CANC-PRICE-HIGH', reasonName: 'Service estimate higher than expected (Cost objection)', category: 'Customer Request', allowAutoReschedule: 'N', active: 'Y' },
      { id: 'AC-03', reasonCode: 'CANC-BAY-CAP', reasonName: 'Specialized EV / Alignment bay overbooked', category: 'Dealership Capacity Constrained', allowAutoReschedule: 'Y', active: 'Y' },
      { id: 'AC-04', reasonCode: 'CANC-PART-BO', reasonName: 'Critical spare part on transit backorder', category: 'Parts Shortage', allowAutoReschedule: 'Y', active: 'Y' },
    ],
  },
  {
    id: 'eqc_inspection_checklist',
    name: 'Final Quality Inspection & Road Test Checklist',
    owner: 'TML_ADMIN',
    category: 'Quality Sign-off',
    logicalGroup: 'Electronic Quality Check',
    moduleCode: 'eqc',
    moduleName: 'eQC / Washing',
    description: 'Pre-delivery quality assurance checklists, OBD-II DTC error sweeps, and road test verifications.',
    fields: [
      { key: 'checkCode', label: 'QC Code', type: 'text', mandatory: true },
      { key: 'stageName', label: 'Inspection Stage', type: 'select', options: ['Underbody & Suspension', 'Underhood Fluids & Torques', 'Diagnostic Scan & OBD-II', 'Road Test Evaluation', 'Washing & Interior Cleanliness'] },
      { key: 'description', label: 'Standard Inspection Item', type: 'text', mandatory: true },
      { key: 'mandatoryPass', label: 'Zero-Defect Gate Requirement', type: 'select', options: ['Y', 'N'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'EQC-01', checkCode: 'EQC-OBD-01', stageName: 'Diagnostic Scan & OBD-II', description: 'Complete ECU fault code clear verification (Zero active DTCs)', mandatoryPass: 'Y', active: 'Y' },
      { id: 'EQC-02', checkCode: 'EQC-TORQ-02', stageName: 'Underbody & Suspension', description: 'Four-wheel lug nuts torque verification with calibrated digital wrench', mandatoryPass: 'Y', active: 'Y' },
      { id: 'EQC-03', checkCode: 'EQC-ROAD-03', stageName: 'Road Test Evaluation', description: '5 km dynamic road test: straight line tracking and ABS bite test', mandatoryPass: 'Y', active: 'Y' },
      { id: 'EQC-04', checkCode: 'EQC-WASH-04', stageName: 'Washing & Interior Cleanliness', description: 'Zero water seepage, spotless dashboard, paper floor mats installed', mandatoryPass: 'N', active: 'Y' },
    ],
  },
  {
    id: 'torque_verification_standards',
    name: 'Critical Fastener Torque Verification Master',
    owner: 'TML_ADMIN',
    category: 'Torque Engineering',
    logicalGroup: 'Electronic Quality Check',
    moduleCode: 'eqc',
    moduleName: 'eQC / Washing',
    description: 'Factory-specified torque values (Nm) for wheel hubs, calipers, subframes, and steering links.',
    fields: [
      { key: 'fastenerCode', label: 'Fastener Part Code', type: 'text', mandatory: true },
      { key: 'assemblyName', label: 'Assembly Location', type: 'text', mandatory: true },
      { key: 'nominalTorque', label: 'Nominal Torque (Nm)', type: 'number', mandatory: true },
      { key: 'tolerance', label: 'Tolerance (± Nm)', type: 'number', mandatory: true },
      { key: 'toolRequired', label: 'Digital Torque Wrench Tool ID', type: 'text', mandatory: true },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'TRQ-01', fastenerCode: 'FAST-WHL-120', assemblyName: 'Wheel Lug Nuts (All 4 wheels)', nominalTorque: 120, tolerance: 5, toolRequired: 'TW-DIGI-200', active: 'Y' },
      { id: 'TRQ-02', fastenerCode: 'FAST-CALIP-85', assemblyName: 'Front Brake Caliper Guide Pins', nominalTorque: 85, tolerance: 3, toolRequired: 'TW-DIGI-100', active: 'Y' },
      { id: 'TRQ-03', fastenerCode: 'FAST-SUBFRM-140', assemblyName: 'Front Subframe to Monocoque Mounts', nominalTorque: 140, tolerance: 8, toolRequired: 'TW-DIGI-250', active: 'Y' },
    ],
  },
  // =========================================================================
  // ELECTRONIC QUALITY CHECK (EQC) — rule masters
  // Blank PPL (or blank Km range) = applies to every vehicle. Rules: src/utils/eqcRules.ts
  // =========================================================================
  {
    id: 'eqc_gc_mandate',
    name: 'Guided Check & Road Test Mandate Master',
    owner: 'TML_ADMIN',
    category: 'EQC Rules',
    logicalGroup: 'Electronic Quality Check',
    moduleCode: 'eqc',
    moduleName: 'eQC / Washing',
    description:
      'Decides per PPL + Complaint Code whether a Guided Check (GC) applies / is mandatory and whether a road test is mandatory. Blank PPL = all PPLs; a PPL-specific row overrides it.',
    fields: [
      { key: 'ppl', label: 'PPL', type: 'select', options: EQC_PPLS, defaultValue: '', blankLabel: '(All PPLs)', description: 'Leave blank to apply to all PPLs for this Complaint Code.' },
      { key: 'complaintCode', label: 'Complaint Code', type: 'text', mandatory: true, validation: { pattern: COMPLAINT_CODE_PATTERN, customErrorMessage: 'Use capitals, digits and hyphens, e.g. BRK-VIB-02.' } },
      { key: 'gcApplicable', label: 'GC Applicable', type: 'select', options: ['Y', 'N'], mandatory: true },
      { key: 'gcMandatory', label: 'GC Mandatory', type: 'select', options: ['Y', 'N'], mandatory: true, defaultValue: 'N' },
      { key: 'gcMandatoryTill', label: 'GC Mandatory Till', type: 'date', defaultValue: '', description: 'Optional end date. After it, GC stays applicable but is no longer mandatory.' },
      { key: 'roadTestMandatory', label: 'Road Test Mandatory', type: 'select', options: ['Y', 'N'], mandatory: true, defaultValue: 'N' },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'], mandatory: true },
    ],
    records: [
      { id: 'GCM-01', ppl: '', complaintCode: 'BRK-VIB-02', gcApplicable: 'Y', gcMandatory: 'Y', gcMandatoryTill: '', roadTestMandatory: 'Y', active: 'Y' },
      { id: 'GCM-02', ppl: 'Nexon EV', complaintCode: 'BAT-SOC-03', gcApplicable: 'Y', gcMandatory: 'Y', gcMandatoryTill: '2027-03-31', roadTestMandatory: 'N', active: 'Y' },
      { id: 'GCM-03', ppl: '', complaintCode: 'BAT-SOC-03', gcApplicable: 'Y', gcMandatory: 'N', gcMandatoryTill: '', roadTestMandatory: 'N', active: 'Y' },
      { id: 'GCM-04', ppl: 'Altroz', complaintCode: 'ENG-NOIS-01', gcApplicable: 'Y', gcMandatory: 'Y', gcMandatoryTill: '2026-12-31', roadTestMandatory: 'Y', active: 'Y' },
      { id: 'GCM-05', ppl: '', complaintCode: 'AC-COOL-04', gcApplicable: 'Y', gcMandatory: 'N', gcMandatoryTill: '', roadTestMandatory: 'N', active: 'Y' },
      { id: 'GCM-06', ppl: '', complaintCode: 'INFO-SCR-05', gcApplicable: 'N', gcMandatory: 'N', gcMandatoryTill: '', roadTestMandatory: 'N', active: 'Y' },
    ],
  },
  {
    id: 'eqc_gc_steps',
    name: 'Guided Check Steps Master',
    owner: 'TML_ADMIN',
    category: 'EQC Rules',
    logicalGroup: 'Electronic Quality Check',
    moduleCode: 'eqc',
    moduleName: 'eQC / Washing',
    description:
      'Step-by-step Guided Check shown to the technician in the dealer app, per PPL + Complaint Code. PPL-specific steps replace the all-PPL steps for that PPL.',
    fields: [
      { key: 'ppl', label: 'PPL', type: 'select', options: EQC_PPLS, defaultValue: '', blankLabel: '(All PPLs)', description: 'Leave blank to apply to all PPLs.' },
      { key: 'complaintCode', label: 'Complaint Code', type: 'text', mandatory: true, validation: { pattern: COMPLAINT_CODE_PATTERN, customErrorMessage: 'Use capitals, digits and hyphens, e.g. BRK-VIB-02.' } },
      { key: 'stepNo', label: 'Step No.', type: 'number', mandatory: true, validation: { min: 1, max: 99 } },
      { key: 'gcStep', label: 'GC Step', type: 'text', mandatory: true },
      { key: 'gcImage1', label: 'GC Image 1', type: 'text', defaultValue: '', description: 'Image file name or URL shown with the step.' },
      { key: 'gcImage2', label: 'GC Image 2', type: 'text', defaultValue: '' },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'], mandatory: true },
    ],
    records: [
      { id: 'GCS-01', ppl: '', complaintCode: 'BRK-VIB-02', stepNo: 1, gcStep: 'Measure front disc run-out with dial gauge (limit 0.05 mm)', gcImage1: 'gc/brk-disc-runout.jpg', gcImage2: '', active: 'Y' },
      { id: 'GCS-02', ppl: '', complaintCode: 'BRK-VIB-02', stepNo: 2, gcStep: 'Check caliper guide pins for free movement and grease', gcImage1: 'gc/brk-guide-pins.jpg', gcImage2: '', active: 'Y' },
      { id: 'GCS-03', ppl: '', complaintCode: 'BRK-VIB-02', stepNo: 3, gcStep: 'Inspect wheel balancing and tyre wear pattern', gcImage1: '', gcImage2: '', active: 'Y' },
      { id: 'GCS-04', ppl: 'Nexon EV', complaintCode: 'BAT-SOC-03', stepNo: 1, gcStep: 'Read HV battery SOC and cell voltage spread via VCI', gcImage1: 'gc/ev-vci-soc.jpg', gcImage2: 'gc/ev-cell-spread.jpg', active: 'Y' },
      { id: 'GCS-05', ppl: 'Nexon EV', complaintCode: 'BAT-SOC-03', stepNo: 2, gcStep: 'Check BMS DTC history and last OTA version', gcImage1: '', gcImage2: '', active: 'Y' },
      { id: 'GCS-06', ppl: '', complaintCode: 'BAT-SOC-03', stepNo: 1, gcStep: 'Check 12V auxiliary battery voltage and terminals', gcImage1: 'gc/12v-terminals.jpg', gcImage2: '', active: 'Y' },
      { id: 'GCS-07', ppl: 'Altroz', complaintCode: 'ENG-NOIS-01', stepNo: 1, gcStep: 'Cold start: listen at timing belt tensioner with stethoscope', gcImage1: 'gc/eng-tensioner.jpg', gcImage2: '', active: 'Y' },
      { id: 'GCS-08', ppl: 'Altroz', complaintCode: 'ENG-NOIS-01', stepNo: 2, gcStep: 'Check engine mount bushes for cracks', gcImage1: '', gcImage2: '', active: 'Y' },
      { id: 'GCS-09', ppl: '', complaintCode: 'AC-COOL-04', stepNo: 1, gcStep: 'Measure vent outlet temperature at idle (target ≤ 8 °C)', gcImage1: 'gc/ac-vent-temp.jpg', gcImage2: '', active: 'Y' },
    ],
  },
  {
    id: 'eqc_ptd_risk',
    name: 'PTD Risk Configuration Master',
    owner: 'TML_ADMIN',
    category: 'EQC Rules',
    logicalGroup: 'Electronic Quality Check',
    moduleCode: 'eqc',
    moduleName: 'eQC / Washing',
    description:
      'Highlights a job at risk of missing its Promised Time of Delivery (PTD). Time left ≤ Red threshold → Red; ≤ Orange threshold → Orange. Red must be lower than Orange.',
    fields: [
      { key: 'colorCode', label: 'Color Code', type: 'select', options: ['Orange', 'Red'], mandatory: true },
      { key: 'thresholdHrs', label: 'Threshold in Hrs', type: 'number', mandatory: true, validation: { min: 0, max: 72 } },
      { key: 'thresholdMins', label: 'Threshold in Mins', type: 'number', mandatory: true, validation: { min: 0, max: 59 } },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'], mandatory: true },
    ],
    records: [
      { id: 'PTD-01', colorCode: 'Orange', thresholdHrs: 2, thresholdMins: 0, active: 'Y' },
      { id: 'PTD-02', colorCode: 'Red', thresholdHrs: 0, thresholdMins: 45, active: 'Y' },
    ],
  },
  {
    id: 'eqc_did_thresholds',
    name: 'DID Parameter Threshold Mapping Master',
    owner: 'TML_ADMIN',
    category: 'EQC Rules',
    logicalGroup: 'Electronic Quality Check',
    moduleCode: 'eqc',
    moduleName: 'eQC / Washing',
    description:
      'Expected values for VCI / OBD DID auto-scan parameters. Formats: "11.8-14.5", ">=20", "<=4.2", ">0", or an exact value. Blank PPL = all PPLs; a PPL-specific row overrides it.',
    fields: [
      { key: 'parameterName', label: 'Parameter Name', type: 'text', mandatory: true },
      { key: 'expectedValue', label: 'Expected Value / Range', type: 'text', mandatory: true, validation: { pattern: DID_RANGE_PATTERN, customErrorMessage: 'Use a range like 11.8-14.5, a limit like >=20 or <=4.2, or a single value.' } },
      { key: 'unit', label: 'Unit', type: 'text', defaultValue: '' },
      { key: 'ppl', label: 'PPL', type: 'select', options: EQC_PPLS, defaultValue: '', blankLabel: '(All PPLs)', description: 'Leave blank to apply to all PPLs.' },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'], mandatory: true },
    ],
    records: [
      { id: 'DID-01', parameterName: 'Battery SOC', expectedValue: '>=60', unit: '%', ppl: '', active: 'Y' },
      { id: 'DID-02', parameterName: '12V Battery Voltage', expectedValue: '12.2-14.8', unit: 'V', ppl: '', active: 'Y' },
      { id: 'DID-03', parameterName: 'HV Battery SOC', expectedValue: '>=20', unit: '%', ppl: 'Nexon EV', active: 'Y' },
      { id: 'DID-04', parameterName: 'HV Battery SOC', expectedValue: '>=25', unit: '%', ppl: 'Tiago EV', active: 'Y' },
      { id: 'DID-05', parameterName: 'BMS Cell Voltage', expectedValue: '3.2-4.2', unit: 'V', ppl: '', active: 'Y' },
      { id: 'DID-06', parameterName: 'Coolant Temperature', expectedValue: '80-105', unit: '°C', ppl: '', active: 'Y' },
    ],
  },
  {
    id: 'eqc_general_checklist',
    name: 'General Checklist Master',
    owner: 'TML_ADMIN',
    category: 'EQC Checklists',
    logicalGroup: 'Electronic Quality Check',
    moduleCode: 'eqc',
    moduleName: 'eQC / Washing',
    description:
      'EQC checklist items by BU and type. Blank PPL or blank Km range = every vehicle. The Not-OK flags decide what the technician must capture when an item is marked Not OK.',
    fields: [
      { key: 'bu', label: 'BU', type: 'select', options: ['PV', 'EV'], mandatory: true },
      { key: 'checklistType', label: 'Checklist Type', type: 'select', options: EQC_CHECKLIST_TYPES, mandatory: true },
      { key: 'checklistItem', label: 'Checklist Item', type: 'text', mandatory: true },
      { key: 'rangeStartKm', label: 'Range Start Km', type: 'number', defaultValue: '', validation: { min: 0, max: 999999 } },
      { key: 'rangeEndKm', label: 'Range End Km', type: 'number', defaultValue: '', validation: { min: 0, max: 999999 } },
      { key: 'ppl', label: 'PPL', type: 'select', options: EQC_PPLS, defaultValue: '', blankLabel: '(All PPLs)', description: 'Leave blank to apply to all PPLs.' },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'], mandatory: true },
      ...NOT_OK_FIELDS,
    ],
    records: [
      { id: 'GCL-01', bu: 'PV', checklistType: 'Pre-Delivery Inspection', checklistItem: 'All warning lamps OFF after engine start', rangeStartKm: null, rangeEndKm: null, ppl: '', active: 'Y', notOkPhoto: 'Y', notOkAudio: 'N', notOkVideo: 'N', notOkText: 'Y' },
      { id: 'GCL-02', bu: 'PV', checklistType: 'Road Test', checklistItem: 'No pull to either side under braking', rangeStartKm: null, rangeEndKm: null, ppl: '', active: 'Y', notOkPhoto: 'N', notOkAudio: 'N', notOkVideo: 'Y', notOkText: 'Y' },
      { id: 'GCL-03', bu: 'PV', checklistType: 'Underbody', checklistItem: 'Clutch plate wear within limit', rangeStartKm: 40000, rangeEndKm: 80000, ppl: '', active: 'Y', notOkPhoto: 'Y', notOkAudio: 'N', notOkVideo: 'N', notOkText: 'Y' },
      { id: 'GCL-04', bu: 'PV', checklistType: 'Road Test', checklistItem: 'DCA gear shift smooth, no judder at 1st–2nd', rangeStartKm: null, rangeEndKm: null, ppl: 'Altroz', active: 'Y', notOkPhoto: 'N', notOkAudio: 'Y', notOkVideo: 'Y', notOkText: 'Y' },
      { id: 'GCL-05', bu: 'EV', checklistType: 'EV Safety', checklistItem: 'HV connector seals and orange cable insulation intact', rangeStartKm: null, rangeEndKm: null, ppl: '', active: 'Y', notOkPhoto: 'Y', notOkAudio: 'N', notOkVideo: 'N', notOkText: 'Y' },
      { id: 'GCL-06', bu: 'EV', checklistType: 'Pre-Delivery Inspection', checklistItem: 'Regen braking levels switch correctly', rangeStartKm: null, rangeEndKm: null, ppl: 'Nexon EV', active: 'Y', notOkPhoto: 'N', notOkAudio: 'N', notOkVideo: 'Y', notOkText: 'Y' },
      { id: 'GCL-07', bu: 'PV', checklistType: 'Interior & Cleanliness', checklistItem: 'Paper floor mats and seat covers removed', rangeStartKm: null, rangeEndKm: null, ppl: '', active: 'N', notOkPhoto: 'N', notOkAudio: 'N', notOkVideo: 'N', notOkText: 'N' },
    ],
  },
  {
    id: 'eqc_schedule_checklist',
    name: 'Schedule Checklist Master (Section & Sub-Section)',
    owner: 'TML_ADMIN',
    category: 'EQC Checklists',
    logicalGroup: 'Electronic Quality Check',
    moduleCode: 'eqc',
    moduleName: 'eQC / Washing',
    description:
      'Service-schedule checklist grouped by Section and Sub-Section, filtered by BU, PPL and odometer Km. Blank PPL or Km range = every vehicle.',
    fields: [
      { key: 'bu', label: 'BU', type: 'select', options: ['PV', 'EV'], mandatory: true },
      { key: 'section', label: 'Section', type: 'text', mandatory: true },
      { key: 'subSection', label: 'Sub-Section', type: 'text', mandatory: true },
      { key: 'ppl', label: 'PPL', type: 'select', options: EQC_PPLS, defaultValue: '', blankLabel: '(All PPLs)', description: 'Leave blank to apply to all PPLs.' },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'], mandatory: true },
      ...NOT_OK_FIELDS,
      { key: 'rangeStartKm', label: 'Range Start Km', type: 'number', defaultValue: '', validation: { min: 0, max: 999999 } },
      { key: 'rangeEndKm', label: 'Range End Km', type: 'number', defaultValue: '', validation: { min: 0, max: 999999 } },
    ],
    records: [
      { id: 'SCL-01', bu: 'PV', section: 'Engine Compartment', subSection: 'Engine oil level and leakage', ppl: '', active: 'Y', notOkPhoto: 'Y', notOkAudio: 'N', notOkVideo: 'N', notOkText: 'Y', rangeStartKm: null, rangeEndKm: null },
      { id: 'SCL-02', bu: 'PV', section: 'Engine Compartment', subSection: 'Drive belt condition', ppl: '', active: 'Y', notOkPhoto: 'Y', notOkAudio: 'N', notOkVideo: 'N', notOkText: 'Y', rangeStartKm: 20000, rangeEndKm: null },
      { id: 'SCL-03', bu: 'PV', section: 'Brakes', subSection: 'Front pad thickness ≥ 3 mm', ppl: '', active: 'Y', notOkPhoto: 'Y', notOkAudio: 'N', notOkVideo: 'N', notOkText: 'Y', rangeStartKm: 10000, rangeEndKm: null },
      { id: 'SCL-04', bu: 'PV', section: 'Underbody', subSection: 'Turbo intercooler hoses', ppl: 'Harrier', active: 'Y', notOkPhoto: 'Y', notOkAudio: 'N', notOkVideo: 'N', notOkText: 'Y', rangeStartKm: null, rangeEndKm: null },
      { id: 'SCL-05', bu: 'EV', section: 'HV System', subSection: 'Battery pack mounting bolts torque', ppl: '', active: 'Y', notOkPhoto: 'Y', notOkAudio: 'N', notOkVideo: 'N', notOkText: 'Y', rangeStartKm: 15000, rangeEndKm: null },
      { id: 'SCL-06', bu: 'EV', section: 'HV System', subSection: 'Coolant level in battery thermal loop', ppl: '', active: 'Y', notOkPhoto: 'Y', notOkAudio: 'N', notOkVideo: 'N', notOkText: 'Y', rangeStartKm: null, rangeEndKm: null },
      { id: 'SCL-07', bu: 'PV', section: 'Electricals', subSection: 'Headlamp aim and fog lamps', ppl: '', active: 'Y', notOkPhoto: 'N', notOkAudio: 'N', notOkVideo: 'Y', notOkText: 'Y', rangeStartKm: null, rangeEndKm: 30000 },
    ],
  },
  // =========================================================================
  // BODYSHOP — from the BA workbook "Bodyshop_Master_1.xlsx" (rows transcribed as given;
  // blank cells stay blank so the checker can flag them). Rules: src/utils/bodyshopRules.ts
  // =========================================================================
  {
    id: 'bs_inventory_sections',
    name: 'Inventory Capture Master — Sections',
    owner: 'TML_ADMIN',
    category: 'Inventory Capture',
    logicalGroup: 'Bodyshop',
    moduleCode: 'bodyshop',
    moduleName: 'JC Creation- Bodyshop',
    description:
      'Sections of the vehicle inventory capture, per BU, in Sequence Priority order. Roles decide who sees the section; Service Type "Accident" shows it only for accident jobs.',
    fields: [
      { key: 'bu', label: 'BU', type: 'select', options: ['PV', 'EV'], mandatory: true },
      { key: 'section', label: 'Section', type: 'text', mandatory: true },
      { key: 'roles', label: 'Roles', type: 'text', mandatory: true, description: 'DSvAdv, Driver or both (comma separated).', validation: { pattern: BS_ROLES_PATTERN, customErrorMessage: 'Use DSvAdv, Driver or "DSvAdv, Driver".' } },
      { key: 'sequencePriority', label: 'Sequence Priority', type: 'number', mandatory: true, validation: { min: 1, max: 99 } },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'], mandatory: true },
      { key: 'serviceType', label: 'Service Type', type: 'select', options: BS_SERVICE_TYPES, mandatory: true },
    ],
    records: (['PV', 'EV'] as const).flatMap((bu, b) =>
      (
        [
          ['Documents', 'DSvAdv, Driver', 1, 'All'],
          ['Accident Details', 'DSvAdv', 2, 'Accident'],
          ['External', 'DSvAdv, Driver', 4, 'All'],
          ['Internal', 'DSvAdv', 3, 'All'],
          ['Inventory', 'DSvAdv', 5, 'All'],
          ['Accessories', 'DSvAdv, Driver', 6, 'All'],
          ['Tyre & Battery', 'DSvAdv, Driver', 7, 'All'],
        ] as const
      ).map(([section, roles, sequencePriority, serviceType], i) => ({
        id: `BSS-${String(b * 7 + i + 1).padStart(2, '0')}`,
        bu,
        section,
        roles,
        sequencePriority,
        active: 'Y',
        serviceType,
      }))
    ),
  },
  {
    id: 'bs_inventory_checkpoints',
    name: 'Inventory Capture Master — Checkpoints',
    owner: 'TML_ADMIN',
    category: 'Inventory Capture',
    logicalGroup: 'Bodyshop',
    moduleCode: 'bodyshop',
    moduleName: 'JC Creation- Bodyshop',
    description:
      'Rows as given in the BA workbook; incomplete rows are kept and listed in the preview checklist. What is captured inside each section: Sub-Section (Level 1 / Level 2) and Checkpoint, who captures it, acceptable values and the photo / video evidence. A row without a Checkpoint is captured at Sub-Section level.',
    fields: [
      { key: 'section', label: 'Section', type: 'text', description: 'Must match a Section in the Sections master. Blanks are listed in the preview checklist.' },
      { key: 'subSection1', label: 'Sub-Section Level 1', type: 'text' },
      { key: 'subSection1Seq', label: 'Sub-Section Sequence', type: 'number', defaultValue: '', validation: { min: 1, max: 999 } },
      { key: 'subSection2', label: 'Sub-Section Level 2', type: 'text', defaultValue: '' },
      { key: 'subSection2Seq', label: 'Sub-Section Level 2 Sequence', type: 'number', defaultValue: '', validation: { min: 1, max: 999 } },
      { key: 'checkpoint', label: 'Checkpoint', type: 'text', defaultValue: '', description: 'Leave blank to capture at Sub-Section level.' },
      { key: 'checkpointSeq', label: 'Checkpoint Sequence', type: 'number', defaultValue: '', validation: { min: 1, max: 999 } },
      { key: 'role', label: 'Role', type: 'select', options: BS_ROLES, mandatory: true },
      { key: 'acceptableValues', label: 'Acceptable Values', type: 'text', defaultValue: '', description: 'Comma separated, e.g. "OK, NOT OK, NA", or "Count".' },
      { key: 'mandatory', label: 'Mandatory', type: 'select', options: ['Y', 'N'], defaultValue: 'Y' },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'], defaultValue: 'Y', description: 'Blank is treated as inactive.' },
      { key: 'mediaType', label: 'Video/Image', type: 'select', options: BS_MEDIA_TYPES, defaultValue: '', blankLabel: '(No photo / video)' },
      { key: 'imagesRequired', label: 'No. of Image Required (Max 2)', type: 'number', defaultValue: '', validation: { min: 1, max: 2 } },
      { key: 'mediaApplicableOn', label: 'Image/Video Applicable On', type: 'select', options: ['All', 'Not OK'], defaultValue: '', blankLabel: '(Not applicable)' },
      { key: 'serviceType', label: 'Service Type', type: 'select', options: BS_SERVICE_TYPES, defaultValue: 'All' },
    ],
    records: [
      cp('BSC-01', 'Internal', 'Cabin', 1, '', null, '', null, 'DSvAdv', '', 'Y', 'Y', 'Image', 2, 'Not OK', 'All'),
      cp('BSC-02', 'Internal', 'Instrument Cluster', 2, '', null, '', null, 'DSvAdv', '', 'Y', 'Y', 'Video/Image', 1, 'Not OK', 'All'),
      cp('BSC-03', 'Internal', 'Seats & Belt', 3, '', null, '', null, 'DSvAdv', '', 'Y', 'Y', 'Video/Image', 1, 'Not OK', 'All'),
      cp('BSC-04', 'Internal', 'Steering Controls', 4, '', null, 'Steering Wheel Condition', null, 'DSvAdv', 'OK', 'Y', 'Y', 'Image', 1, 'All', 'All'),
      cp('BSC-05', 'Internal', 'Steering Controls', 5, '', null, 'Horn Working', null, 'DSvAdv', 'OK, NOT OK, NA', 'Y', 'Y', 'Image', 2, 'All', 'All'),
      cp('BSC-06', 'Internal', 'Steering Controls', null, '', null, 'Steering Controls Working', null, 'DSvAdv', 'OK, NOT OK', 'Y', 'Y', 'Image', 1, 'All', 'All'),
      cp('BSC-07', 'Documents', 'Insurance Copy', null, '', null, '', null, 'DSvAdv', '', 'Y', 'Y', 'Image', 1, 'All', 'Accident'),
      cp('BSC-08', 'Documents', 'Police Complaint Report', null, '', null, '', null, 'DSvAdv', '', 'Y', 'Y', 'Image', 1, 'All', 'Accident'),
      cp('BSC-09', 'Internal-Accessories', 'Battery Information', null, '', null, '', null, 'Driver', '', '', '', 'Video', null, '', ''),
      cp('BSC-10', '', 'Inventory Categories', null, 'Accessories Internal', null, "Owner's Manual", null, 'Driver', 'Count', 'Y', 'Y', '', null, '', ''),
      cp('BSC-11', '', '', null, '', null, 'Pen Drive', null, 'Driver', 'Count', 'Y', 'Y', '', null, '', ''),
    ],
  },
  {
    id: 'bs_insurance_documents',
    name: 'Insurance Document Collection — Customer',
    owner: 'TML_ADMIN',
    category: 'Insurance Documents',
    logicalGroup: 'Bodyshop',
    moduleCode: 'bodyshop',
    moduleName: 'JC Creation- Bodyshop',
    description: 'Documents collected from the customer for insurance (accident) jobs, in Sequence order. Only active documents are asked for.',
    fields: [
      { key: 'documentCategory', label: 'Document Category', type: 'text', mandatory: true },
      { key: 'mandatoryFlag', label: 'Mandatory Flag', type: 'select', options: ['Y', 'N'], mandatory: true },
      { key: 'documentType', label: 'Document Type', type: 'select', options: ['PDF/Image', 'Image', 'PDF'], mandatory: true },
      { key: 'imagesRequired', label: 'No. of Image Required (Max 2)', type: 'number', defaultValue: '', validation: { min: 1, max: 2 } },
      { key: 'sequence', label: 'Sequence', type: 'number', mandatory: true, validation: { min: 1, max: 99 } },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'], mandatory: true },
    ],
    records: [
      { id: 'BSD-01', documentCategory: 'Insurance Copy', mandatoryFlag: 'N', documentType: 'PDF/Image', imagesRequired: null, sequence: 2, active: 'N' },
      { id: 'BSD-02', documentCategory: 'Police Complaint Report', mandatoryFlag: 'N', documentType: 'Image', imagesRequired: 2, sequence: 1, active: 'Y' },
    ],
  },
  {
    id: 'bodyshop_process_stages',
    name: 'BodyShop Denting & Paint Stage Master',
    owner: 'TML_ADMIN',
    category: 'BodyShop Workflow',
    logicalGroup: 'Bodyshop',
    moduleCode: 'bodyshop',
    moduleName: 'JC Creation- Bodyshop',
    description: 'Sequenced bodyshop workflow stages from accident survey to bake oven finish.',
    fields: [
      { key: 'stageCode', label: 'Stage Code', type: 'text', mandatory: true },
      { key: 'stageName', label: 'Process Stage', type: 'text', mandatory: true },
      { key: 'standardDurationHrs', label: 'Standard FRT (Hrs)', type: 'number', mandatory: true },
      { key: 'requiresSurveyorApproval', label: 'Surveyor Sign-off Gate', type: 'select', options: ['Y', 'N'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'BSP-01', stageCode: 'BS-SURV-01', stageName: 'Insurance Surveyor Joint Inspection & Supplementary Estimate', standardDurationHrs: 24, requiresSurveyorApproval: 'Y', active: 'Y' },
      { id: 'BSP-02', stageCode: 'BS-DENT-02', stageName: 'Panel Beating & Hydraulic Chassis Pulling Jig Alignment', standardDurationHrs: 8, requiresSurveyorApproval: 'N', active: 'Y' },
      { id: 'BSP-03', stageCode: 'BS-PRIM-03', stageName: 'Body Filler Application & Anti-Corrosion Epoxy Primer', standardDurationHrs: 4, requiresSurveyorApproval: 'N', active: 'Y' },
      { id: 'BSP-04', stageCode: 'BS-OVEN-04', stageName: 'Heated Paint Booth Spray & 60°C Bake Cycle', standardDurationHrs: 3, requiresSurveyorApproval: 'N', active: 'Y' },
    ],
  },
  {
    id: 'paint_booth_schedule',
    name: 'Heated Spray Booth & Oven Slot Master',
    owner: 'DEALER_ADMIN',
    category: 'Paint Facilities',
    logicalGroup: 'Bodyshop',
    moduleCode: 'bodyshop',
    moduleName: 'JC Creation- Bodyshop',
    description: 'Spray booth slotting, color batching, and energy consumption metrics.',
    fields: [
      { key: 'boothName', label: 'Spray Booth Identification', type: 'text', mandatory: true },
      { key: 'paintType', label: 'Paint Technology', type: 'select', options: ['Waterborne Eco-Basecoat', 'Solvent-borne Clearcoat', 'Matte Finish Specialty'] },
      { key: 'maxBakeTemp', label: 'Baking Temperature (°C)', type: 'number', mandatory: true },
      { key: 'dailyCapacityPanels', label: 'Daily Panel Capacity', type: 'number', mandatory: true },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'PB-01', boothName: 'Booth 1 - Blowtherm Downdraft', paintType: 'Waterborne Eco-Basecoat', maxBakeTemp: 65, dailyCapacityPanels: 14, active: 'Y' },
      { id: 'PB-02', boothName: 'Booth 2 - Nova Verta High Temp', paintType: 'Solvent-borne Clearcoat', maxBakeTemp: 70, dailyCapacityPanels: 16, active: 'Y' },
    ],
  },

  // =========================================================================
  // LOGICAL GROUP 4: PARTS, CLAIMS & SUPPORT
  // =========================================================================
  {
    id: 'amc_pricing',
    name: 'AMC Products & Pricing Master',
    owner: 'TML_ADMIN',
    category: 'Commercial Contracts',
    logicalGroup: 'Parts, Claims & Support',
    moduleCode: 'claim',
    moduleName: 'Auth. Request Approval & Service Claims',
    description: 'Tata Motors Value Care AMC packages, tenure, coverage limits, and national price schedules.',
    fields: [
      { key: 'amcCode', label: 'AMC Plan Code', type: 'text', mandatory: true },
      { key: 'planName', label: 'AMC Plan Name', type: 'text', mandatory: true },
      { key: 'pplName', label: 'Applicable PPL', type: 'select', options: ['All Models', 'Nexon', 'Altroz', 'Harrier / Safari', 'EV Fleet'] },
      { key: 'tenureYears', label: 'Tenure (Yrs)', type: 'number', mandatory: true },
      { key: 'maxKms', label: 'Max Coverage (KMs)', type: 'number', mandatory: true },
      { key: 'priceInr', label: 'Base OEM MRP (₹)', type: 'number', mandatory: true },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'AMC-01', amcCode: 'TML-VC-SILVER-02', planName: 'Value Care Silver (Scheduled Lube & Filters)', pplName: 'Nexon', tenureYears: 2, maxKms: 30000, priceInr: 12500, active: 'Y' },
      { id: 'AMC-02', amcCode: 'TML-VC-GOLD-03', planName: 'Value Care Gold (Wear & Tear + Scheduled)', pplName: 'Harrier / Safari', tenureYears: 3, maxKms: 45000, priceInr: 34000, active: 'Y' },
      { id: 'AMC-03', amcCode: 'TML-EV-PROMISE-05', planName: 'EV Battery & Motor Health Guard AMC', pplName: 'EV Fleet', tenureYears: 5, maxKms: 100000, priceInr: 28500, active: 'Y' },
    ],
  },
  {
    id: 'warranty_defect_codes',
    name: 'Warranty Defect & Causal Part Tagging Master',
    owner: 'TML_ADMIN',
    category: 'Warranty Tagging',
    logicalGroup: 'Parts, Claims & Support',
    moduleCode: 'claim',
    moduleName: 'Auth. Request Approval & Service Claims',
    description: 'Defect classifications for processing OEM claims to Tata Motors and vendor chargebacks.',
    fields: [
      { key: 'defectCode', label: 'Defect Code', type: 'text', mandatory: true },
      { key: 'defectCategory', label: 'Defect Group', type: 'select', options: ['Manufacturing Quality', 'Material Defect', 'Vendor Assembly Flaw', 'Software / Firmware Logic', 'Corrosion / Paint Flaw'] },
      { key: 'partCoverage', label: 'Warranty Scheme', type: 'select', options: ['Standard 3Yr / 100K Km', 'Extended Warranty (EW)', 'EV HV Battery 8Yr / 160K Km'] },
      { key: 'requiresSampleReturn', label: 'Return Physical Sample to Plant', type: 'select', options: ['Y', 'N'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'WDC-01', defectCode: 'DEF-MFG-OILSEAL', defectCategory: 'Manufacturing Quality', partCoverage: 'Standard 3Yr / 100K Km', requiresSampleReturn: 'Y', active: 'Y' },
      { id: 'WDC-02', defectCode: 'DEF-VEND-SUSPBUSH', defectCategory: 'Vendor Assembly Flaw', partCoverage: 'Standard 3Yr / 100K Km', requiresSampleReturn: 'Y', active: 'Y' },
      { id: 'WDC-03', defectCode: 'DEF-EV-CELLIMB', defectCategory: 'Material Defect', partCoverage: 'EV HV Battery 8Yr / 160K Km', requiresSampleReturn: 'Y', active: 'Y' },
    ],
  },
  {
    id: 'goodwill_approval_limits',
    name: 'Goodwill & Special Concession Matrix',
    owner: 'TML_ADMIN',
    category: 'Approval Authorities',
    logicalGroup: 'Parts, Claims & Support',
    moduleCode: 'claim',
    moduleName: 'Auth. Request Approval & Service Claims',
    description: 'Financial approval thresholds for out-of-warranty customer goodwill concessions.',
    fields: [
      { key: 'authorityTier', label: 'Approving Authority', type: 'select', options: ['Works Manager (WM)', 'Area Service Manager (ASM - TML)', 'Regional Customer Care Head (RCCH)', 'DGM Service Central'] },
      { key: 'maxLaborConcession', label: 'Max Labor Discount (%)', type: 'number', mandatory: true },
      { key: 'maxPartsConcession', label: 'Max Parts Discount (%)', type: 'number', mandatory: true },
      { key: 'maxAmountInr', label: 'Max Claim Value (₹)', type: 'number', mandatory: true },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'GW-01', authorityTier: 'Works Manager (WM)', maxLaborConcession: 25, maxPartsConcession: 10, maxAmountInr: 5000, active: 'Y' },
      { id: 'GW-02', authorityTier: 'Area Service Manager (ASM - TML)', maxLaborConcession: 50, maxPartsConcession: 35, maxAmountInr: 25000, active: 'Y' },
      { id: 'GW-03', authorityTier: 'Regional Customer Care Head (RCCH)', maxLaborConcession: 75, maxPartsConcession: 60, maxAmountInr: 75000, active: 'Y' },
      { id: 'GW-04', authorityTier: 'DGM Service Central', maxLaborConcession: 100, maxPartsConcession: 100, maxAmountInr: 300000, active: 'Y' },
    ],
  },
  ...buildClaimMasters(),
  {
    id: 'spd_issuance_priority',
    name: 'Spare Parts Requisition & Issuance Priority',
    owner: 'TML_ADMIN',
    category: 'Inventory Picking',
    logicalGroup: 'Parts, Claims & Support',
    moduleCode: 'spd',
    moduleName: 'SPD',
    description: 'Prioritizes store counter picking slips by vehicle state: VOR (Vehicle Off Road), Warranty, Running Repair.',
    fields: [
      { key: 'priorityCode', label: 'Priority Code', type: 'text', mandatory: true },
      { key: 'priorityLevel', label: 'Priority Tag', type: 'select', options: ['Emergency VOR', 'Running Repair Express', 'Scheduled Periodic Maintenance', 'Recall Campaign'] },
      { key: 'slaMins', label: 'Picking SLA (Minutes)', type: 'number', mandatory: true },
      { key: 'requireOtp', label: 'Mechanic Fingerprint / OTP Verification', type: 'select', options: ['Y', 'N'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'SPD-01', priorityCode: 'PRIO-VOR-01', priorityLevel: 'Emergency VOR', slaMins: 15, requireOtp: 'Y', active: 'Y' },
      { id: 'SPD-02', priorityCode: 'PRIO-RUN-02', priorityLevel: 'Running Repair Express', slaMins: 30, requireOtp: 'N', active: 'Y' },
      { id: 'SPD-03', priorityCode: 'PRIO-SCH-03', priorityLevel: 'Scheduled Periodic Maintenance', slaMins: 45, requireOtp: 'N', active: 'Y' },
      { id: 'SPD-04', priorityCode: 'PRIO-REC-04', priorityLevel: 'Recall Campaign', slaMins: 20, requireOtp: 'Y', active: 'Y' },
    ],
  },
  {
    id: 'parts_delay_reasons',
    name: 'Spare Parts Stockout & Backorder LOV',
    owner: 'DEALER_ADMIN',
    category: 'Stockout Categories',
    logicalGroup: 'Parts, Claims & Support',
    moduleCode: 'spd',
    moduleName: 'SPD',
    description: 'Stockroom delay categorization for auto-generating SAP parts backorders and customer notifications.',
    fields: [
      { key: 'delayCode', label: 'Delay Code', type: 'text', mandatory: true },
      { key: 'reasonName', label: 'Non-Availability Root Cause', type: 'text', mandatory: true },
      { key: 'autoOrderSap', label: 'Auto Trigger SAP Emergency Order', type: 'select', options: ['Y', 'N'] },
      { key: 'smsCustomer', label: 'Trigger Customer ETA SMS', type: 'select', options: ['Y', 'N'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'PDR-01', delayCode: 'BO-PLANT-TRANSIT', reasonName: 'Depot stock depleted - Plant in-transit shipment', autoOrderSap: 'Y', smsCustomer: 'Y', active: 'Y' },
      { id: 'PDR-02', delayCode: 'BO-BIN-MISMATCH', reasonName: 'Physical bin inventory variance (Inventory Audit flag)', autoOrderSap: 'N', smsCustomer: 'N', active: 'Y' },
      { id: 'PDR-03', delayCode: 'BO-SUPPLIER-SHORT', reasonName: 'Tier-1 vendor supply constraint (Critical semiconductor/ECU)', autoOrderSap: 'Y', smsCustomer: 'Y', active: 'Y' },
    ],
  },
  {
    id: 'thd_escalation_categories',
    name: 'THD Technical Escalation Category & Severity',
    owner: 'TML_ADMIN',
    category: 'Engineering Escalations',
    logicalGroup: 'Parts, Claims & Support',
    moduleCode: 'thd',
    moduleName: 'THD',
    description: 'Field technical issue tickets to Tata Motors plant engineering, crash diagnostics, and high-voltage defects.',
    fields: [
      { key: 'categoryCode', label: 'Escalation Category', type: 'text', mandatory: true },
      { key: 'systemDomain', label: 'Engineering System', type: 'select', options: ['EV High Voltage Traction', 'DCA Dual Clutch Transmission', 'ADAS & Radar Calibration', 'Braking & ESP Hydraulics', 'CAN Bus Network Communication'] },
      { key: 'severityTier', label: 'Plant Response SLA', type: 'select', options: ['Tier 1 Critical (< 4 Hours)', 'Tier 2 High (< 12 Hours)', 'Tier 3 Standard (< 24 Hours)'] },
      { key: 'requiresPlantVisit', label: 'Plant Field Engineer Dispatch', type: 'select', options: ['Y', 'N'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'THD-01', categoryCode: 'THD-EV-BAT-ISO', systemDomain: 'EV High Voltage Traction', severityTier: 'Tier 1 Critical (< 4 Hours)', requiresPlantVisit: 'Y', active: 'Y' },
      { id: 'THD-02', categoryCode: 'THD-DCA-JERK', systemDomain: 'DCA Dual Clutch Transmission', severityTier: 'Tier 2 High (< 12 Hours)', requiresPlantVisit: 'N', active: 'Y' },
      { id: 'THD-03', categoryCode: 'THD-ADAS-MISALIGN', systemDomain: 'ADAS & Radar Calibration', severityTier: 'Tier 2 High (< 12 Hours)', requiresPlantVisit: 'N', active: 'Y' },
      { id: 'THD-04', categoryCode: 'THD-CAN-ERR', systemDomain: 'CAN Bus Network Communication', severityTier: 'Tier 3 Standard (< 24 Hours)', requiresPlantVisit: 'N', active: 'Y' },
    ],
  },
  {
    id: 'tib_bulletin_codes',
    name: 'Technical Information Bulletin (TIB) Advisory Codes',
    owner: 'TML_ADMIN',
    category: 'Plant Bulletins',
    logicalGroup: 'Parts, Claims & Support',
    moduleCode: 'thd',
    moduleName: 'THD',
    description: 'Tata Motors factory service technical bulletins, software flash versions, and campaign advisories.',
    fields: [
      { key: 'tibNumber', label: 'TIB Bulletin Reference', type: 'text', mandatory: true },
      { key: 'title', label: 'Subject / Advisory Scope', type: 'text', mandatory: true },
      { key: 'affectedPpl', label: 'Applicable Vehicle PPL', type: 'select', options: ['Nexon EV', 'Nexon ICE', 'Harrier / Safari', 'Curvv EV', 'Altroz'] },
      { key: 'reworkType', label: 'Rework Classification', type: 'select', options: ['ECU Firmware Update', 'Harness Rerouting', 'Hardware Bush Replacement', 'Torque Audit'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'TIB-01', tibNumber: 'TIB-2026-PV-089', title: 'BMS High-Voltage Contactor Firmware v4.8 Update', affectedPpl: 'Nexon EV', reworkType: 'ECU Firmware Update', active: 'Y' },
      { id: 'TIB-02', tibNumber: 'TIB-2026-PV-112', title: 'Rear Suspension Spring Seat Damping Pad Retrofit', affectedPpl: 'Harrier / Safari', reworkType: 'Hardware Bush Replacement', active: 'Y' },
      { id: 'TIB-03', tibNumber: 'TIB-2026-PV-134', title: 'Steering Column Earth Strap Resistance Check', affectedPpl: 'Altroz', reworkType: 'Torque Audit', active: 'Y' },
    ],
  },
  ...buildThdMasters(EQC_PPLS),
  {
    id: 'driver_transit_roster',
    name: 'Chauffeur & Pick-and-Drop Transit Roster',
    owner: 'DEALER_ADMIN',
    category: 'Transit Chauffeurs',
    logicalGroup: 'Parts, Claims & Support',
    moduleCode: 'reception',
    moduleName: 'Pickup & Drop - Admin / Driver App',
    description: 'Driver certifications, assigned zone geofences, and vehicle transit speed monitoring.',
    fields: [
      { key: 'driverCode', label: 'Driver Code', type: 'text', mandatory: true },
      { key: 'driverName', label: 'Driver Full Name', type: 'text', mandatory: true },
      { key: 'assignedZone', label: 'Assigned Territory Zone', type: 'select', options: ['Zone A - Hitec City', 'Zone B - Secunderabad', 'Zone C - Gachibowli', 'Zone D - Banjara Hills'] },
      { key: 'licenseNumber', label: 'Commercial DL Number', type: 'text', mandatory: true },
      { key: 'evCertified', label: 'EV Transit Certified', type: 'select', options: ['Y', 'N'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'DRV-01', driverCode: 'DRV-HYD-101', driverName: 'Nageshwar Rao', assignedZone: 'Zone A - Hitec City', licenseNumber: 'TS09-2019-0023412', evCertified: 'Y', active: 'Y' },
      { id: 'DRV-02', driverCode: 'DRV-HYD-102', driverName: 'Mohd Feroz Khan', assignedZone: 'Zone B - Secunderabad', licenseNumber: 'TS10-2018-0056123', evCertified: 'N', active: 'Y' },
      { id: 'DRV-03', driverCode: 'DRV-HYD-103', driverName: 'Pradeep Patil', assignedZone: 'Zone C - Gachibowli', licenseNumber: 'TS09-2021-0089145', evCertified: 'Y', active: 'Y' },
    ],
  },
  {
    id: 'lounge_reception_checklist',
    name: 'Customer Reception & Greeting Checklist',
    owner: 'TML_ADMIN',
    category: 'Customer Welcome',
    logicalGroup: 'Parts, Claims & Support',
    moduleCode: 'receptionist',
    moduleName: 'Receptionist',
    description: 'Standard OEM lounge customer greeting and advisor electronic tablet handover checklist.',
    fields: [
      { key: 'checkpointCode', label: 'Checkpoint Code', type: 'text', mandatory: true },
      { key: 'checkpointDesc', label: 'Reception Standard Requirement', type: 'text', mandatory: true },
      { key: 'channel', label: 'Intake Channel', type: 'select', options: ['Walk-in', 'Pre-Booked Appointment', 'Express Valet', 'Breakdown Flatbed'] },
      { key: 'mandatoryProof', label: 'Mandatory Photo / Signature', type: 'select', options: ['Y', 'N'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'REC-01', checkpointCode: 'REC-VAL-01', checkpointDesc: 'Digital vehicle outer walk-around photo capture (4 angles)', channel: 'Pre-Booked Appointment', mandatoryProof: 'Y', active: 'Y' },
      { id: 'REC-02', checkpointCode: 'REC-VAL-02', checkpointDesc: 'Fuel / EV SOC level verification & digital customer signature', channel: 'Pre-Booked Appointment', mandatoryProof: 'Y', active: 'Y' },
      { id: 'REC-03', checkpointCode: 'REC-VAL-03', checkpointDesc: 'Customer personal valuables custody declaration slip', channel: 'Walk-in', mandatoryProof: 'Y', active: 'Y' },
    ],
  },
  {
    id: 'gate_security_checklist',
    name: 'Vehicle Gate Inward / Outward Barrier Checklist',
    owner: 'TML_ADMIN',
    category: 'Perimeter Security',
    logicalGroup: 'Parts, Claims & Support',
    moduleCode: 'security',
    moduleName: 'Security Guard',
    description: 'Mandatory perimeter verification rules for automatic ANPR barrier opening and vehicle passes.',
    fields: [
      { key: 'ruleId', label: 'Gate Rule Code', type: 'text', mandatory: true },
      { key: 'direction', label: 'Movement Direction', type: 'select', options: ['Inward (Check-in)', 'Outward (Check-out)', 'Internal Bay Transit'] },
      { key: 'verificationItem', label: 'Verification Protocol', type: 'text', mandatory: true },
      { key: 'anprSync', label: 'ANPR Camera Auto-Verify', type: 'select', options: ['Y', 'N'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'SEC-01', ruleId: 'GATE-IN-01', direction: 'Inward (Check-in)', verificationItem: 'ANPR plate scan match against appointment roster or generate walk-in pass', anprSync: 'Y', active: 'Y' },
      { id: 'SEC-02', ruleId: 'GATE-IN-02', direction: 'Inward (Check-in)', verificationItem: 'Physical chassis plate stamp confirmation against CRM VIN', anprSync: 'N', active: 'Y' },
      { id: 'SEC-03', ruleId: 'GATE-OUT-01', direction: 'Outward (Check-out)', verificationItem: 'Cashier zero-balance clearance seal & gate pass OTP verification', anprSync: 'Y', active: 'Y' },
      { id: 'SEC-04', ruleId: 'GATE-OUT-02', direction: 'Outward (Check-out)', verificationItem: 'Old / replaced warranty parts box inventory verification (if customer request)', anprSync: 'N', active: 'Y' },
    ],
  },
  {
    id: 'gate_denial_reasons',
    name: 'Gate Entry Denial & Security Hold LOV',
    owner: 'DEALER_ADMIN',
    category: 'Perimeter Security',
    logicalGroup: 'Parts, Claims & Support',
    moduleCode: 'security',
    moduleName: 'Security Guard',
    description: 'Security gate vehicle hold classifications and escalation protocol for police or insurance hold.',
    fields: [
      { key: 'denialCode', label: 'Denial Code', type: 'text', mandatory: true },
      { key: 'reason', label: 'Security Denial / Hold Reason', type: 'text', mandatory: true },
      { key: 'escalateTo', label: 'Immediate Notification Target', type: 'select', options: ['Works Manager', 'Security Officer In-Charge', 'Service Head', 'Customer Relation Manager'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'GD-01', denialCode: 'HOLD-CHASSIS-MISMATCH', reason: 'Physical VIN stamp does not match registration papers', escalateTo: 'Works Manager', active: 'Y' },
      { id: 'GD-02', denialCode: 'HOLD-GATEPASS-PENDING', reason: 'Unsettled invoice amount or missing cashier gate pass release', escalateTo: 'Service Head', active: 'Y' },
      { id: 'GD-03', denialCode: 'HOLD-POLICE-STOLEN', reason: 'Chassis flagged in police stolen vehicle database alert', escalateTo: 'Security Officer In-Charge', active: 'Y' },
    ],
  },
];
