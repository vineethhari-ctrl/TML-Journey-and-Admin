export interface MasterFieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'date';
  options?: string[];
  mandatory?: boolean;
}

export interface MasterConfig {
  id: string;
  name: string;
  owner: 'TML_ADMIN' | 'DEALER_ADMIN';
  category: 'JC Tracking' | 'Complaints & Labor' | 'Vehicle Hierarchy' | 'Commercial & AMC' | 'Dealership Operations';
  description: string;
  fields: MasterFieldDef[];
  records: Array<Record<string, any>>;
}

export const MASTER_COLLECTIONS: MasterConfig[] = [
  // 1. Pause Reason Master (From Image 7) - TML Admin
  {
    id: 'pause_reasons',
    name: 'Pause Reason Master',
    owner: 'TML_ADMIN',
    category: 'JC Tracking',
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

  // 2. Tech Model Specific Checklist (From Image 6) - TML Admin
  {
    id: 'model_checklists',
    name: 'Tech Model Specific Checklist',
    owner: 'TML_ADMIN',
    category: 'JC Tracking',
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

  // 3. Complaint Code Category Master - TML Admin
  {
    id: 'complaint_codes',
    name: 'Complaint Code Category Master',
    owner: 'TML_ADMIN',
    category: 'Complaints & Labor',
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

  // 4. Job Code Master & Standard FRT - TML Admin
  {
    id: 'job_codes',
    name: 'Job Code & FRT Master',
    owner: 'TML_ADMIN',
    category: 'Complaints & Labor',
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

  // 5. Complaint - Job Code - PPL Linkage - TML Admin
  {
    id: 'complaint_job_linkage',
    name: 'Complaint Job Code PPL Linkage',
    owner: 'TML_ADMIN',
    category: 'Complaints & Labor',
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

  // 6. PPL Master & PL Master - TML Admin
  {
    id: 'ppl_master',
    name: 'PPL & PL (Product Line) Master',
    owner: 'TML_ADMIN',
    category: 'Vehicle Hierarchy',
    description: 'Parent Product Line (PPL) and Product Line (PL) variants defining OEM parts and service eligibility.',
    fields: [
      { key: 'bu', label: 'BU', type: 'select', options: ['PV', 'EV', 'CV'], mandatory: true },
      { key: 'pplCode', label: 'PPL Code', type: 'text', mandatory: true },
      { key: 'pplName', label: 'PPL (Parent Line)', type: 'text', mandatory: true },
      { key: 'plName', label: 'PL (Variant / Sub-Line)', type: 'text', mandatory: true },
      { key: 'fuelType', label: 'Powertrain', type: 'select', options: ['EV', 'Petrol', 'Diesel', 'CNG'] },
      { key: 'active', label: 'Active', type: 'select', options: ['Y', 'N'] },
    ],
    records: [
      { id: 'PPL-01', bu: 'EV', pplCode: 'PPL-NEXON-EV', pplName: 'Nexon', plName: 'Nexon EV Long Range (45 kWh)', fuelType: 'EV', active: 'Y' },
      { id: 'PPL-02', bu: 'PV', pplCode: 'PPL-NEXON-ICE', pplName: 'Nexon', plName: 'Nexon Fearless+ DCA Petrol', fuelType: 'Petrol', active: 'Y' },
      { id: 'PPL-03', bu: 'PV', pplCode: 'PPL-ALTROZ', pplName: 'Altroz', plName: 'Altroz XZ i-CNG Twin Cylinder', fuelType: 'CNG', active: 'Y' },
      { id: 'PPL-04', bu: 'PV', pplCode: 'PPL-HARRIER', pplName: 'Harrier', plName: 'Harrier Fearless Dark 2.0L Diesel AT', fuelType: 'Diesel', active: 'Y' },
      { id: 'PPL-05', bu: 'EV', pplCode: 'PPL-CURVV-EV', pplName: 'Curvv', plName: 'Curvv EV 55 kWh Hyperion', fuelType: 'EV', active: 'Y' },
    ],
  },

  // 7. Repeat Complaint / Revisit Reason LOV Master - TML Admin
  {
    id: 'revisit_reasons',
    name: 'Repeat Complaint & Revisit LOV Master',
    owner: 'TML_ADMIN',
    category: 'Complaints & Labor',
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

  // 8. AMC Products & Pricing Master - TML Admin
  {
    id: 'amc_pricing',
    name: 'AMC Products & Pricing Master',
    owner: 'TML_ADMIN',
    category: 'Commercial & AMC',
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

  // 9. Bay Master with Division Capacity (From Image 4) - Dealer Admin
  {
    id: 'bay_division_summary',
    name: 'Dealership Division Bay Allocation',
    owner: 'DEALER_ADMIN',
    category: 'Dealership Operations',
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

  // 10. Bay - Technician Mapping (From Image 5) - Dealer Admin
  {
    id: 'bay_technician',
    name: 'Bay - Technician & Supervisor Roster',
    owner: 'DEALER_ADMIN',
    category: 'Dealership Operations',
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
];
