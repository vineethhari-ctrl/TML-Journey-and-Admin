/**
 * Rules Engine Service for Tata Motors sWorkshop CRM
 * Consumes JSON-based dynamic field definitions, validation rules (regex, ranges, Lov, cross-field),
 * and UI rendering logic (conditional visibility, conditional disabled, derived formulas, value mappings)
 * with an enterprise API Versioning & Release Management system ensuring zero breaking changes for live dealer workflows.
 */

import { parseDateTime } from '../utils/dateUtil';

export type DealerTargetModule =
  | 'vehicle_journey'
  | 'job_card'
  | 'reception'
  | 'workshop_floor'
  | 'general';

export type FieldWidgetType =
  | 'text'
  | 'number'
  | 'select'
  | 'boolean'
  | 'date'
  | 'textarea';

export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'in'
  | 'notIn'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'contains'
  | 'regex'
  | 'isTrue'
  | 'isFalse'
  | 'isEmpty'
  | 'isNotEmpty';

export interface FieldCondition {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

export interface CompoundCondition {
  logicalOperator?: 'AND' | 'OR';
  conditions: Array<FieldCondition | CompoundCondition>;
}

export interface RangeValidationRule {
  min?: number;
  max?: number;
  step?: number;
  minMessage?: string;
  maxMessage?: string;
}

export interface DateRangeValidationRule {
  minDate?: string; // 'today', 'today-30d', or 'YYYY-MM-DD'
  maxDate?: string; // 'today', 'today+365d', or 'YYYY-MM-DD'
  minDateMessage?: string;
  maxDateMessage?: string;
}

export interface RegexValidationRule {
  pattern: string;
  flags?: string;
  message: string;
  presetName?: string; // e.g. 'VIN_NUMBER', 'INDIAN_VEHICLE_REG', 'FASTAG_16_DIGIT'
}

export interface DynamicValidationRules {
  required?: boolean;
  requiredIf?: CompoundCondition | FieldCondition;
  requiredMessage?: string;
  regex?: RegexValidationRule;
  range?: RangeValidationRule;
  dateRange?: DateRangeValidationRule;
  allowedValues?: string[];
  allowedValuesMessage?: string;
}

export interface DynamicUiLogic {
  visibleIf?: CompoundCondition | FieldCondition;
  disabledIf?: CompoundCondition | FieldCondition;
  computedFormula?: {
    expression: string;
    dependencies: string[];
  };
  valueMapping?: Record<string, string>;
  badgeColor?: 'blue' | 'emerald' | 'purple' | 'amber' | 'rose' | 'slate';
  placeholder?: string;
  helperText?: string;
  gridSpan?: 1 | 2 | 3 | 'full';
}

export interface CustomFieldRuleDefinition {
  id: string;
  key: string;
  label: string;
  dealerDisplayLabel?: string;
  widgetType: FieldWidgetType;
  targetModule: DealerTargetModule;
  options?: string[];
  defaultValue?: any;
  description?: string;
  category?: string;
  version: number;
  lastUpdated: string;
  updatedBy: string;
  validation: DynamicValidationRules;
  uiLogic: DynamicUiLogic;
  active: boolean;
  deprecatedInVersion?: string;
  sunsetNotice?: string;
}

export interface FieldValidationResult {
  isValid: boolean;
  errors: string[];
  fieldKey: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  errorCount: number;
}

export interface RuleEvaluationLog {
  fieldKey: string;
  ruleType: 'VISIBILITY' | 'DISABLED' | 'VALIDATION' | 'COMPUTED' | 'MAPPING';
  result: boolean | string | number | null;
  detail: string;
  timestamp: string;
}

// =========================================================================
// API VERSIONING & RELEASE MANAGEMENT DATA STRUCTURES
// =========================================================================

export type ApiVersionStatus = 'DRAFT' | 'BETA' | 'ACTIVE' | 'DEPRECATED' | 'SUNSET';

export interface FieldMigrationRule {
  fieldKey: string;
  action: 'RENAME' | 'SET_DEFAULT' | 'TRANSFORM' | 'DEPRECATE_WARN';
  oldKey?: string;
  fallbackValue?: any;
  warningMessage?: string;
}

export interface ApiVersionRelease {
  version: string; // e.g. "v1.0.0", "v1.1.0", "v2.0.0"
  status: ApiVersionStatus;
  releaseName: string;
  releaseDate: string;
  publishedBy: string;
  releaseNotes: string;
  minClientAppVersion: string; // e.g. ">= 4.0.0"
  backwardCompatible: boolean;
  breakingChanges: string[];
  rules: CustomFieldRuleDefinition[];
  migrations?: FieldMigrationRule[];
}

export interface VersionDiffItem {
  key: string;
  label: string;
  changeType: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';
  isBreaking: boolean;
  details: string[];
}

export interface VersionComparisonResult {
  sourceVersion: string;
  targetVersion: string;
  isBackwardCompatible: boolean;
  breakingChangesCount: number;
  totalChangesCount: number;
  diffs: VersionDiffItem[];
}

// =========================================================================
// A/B TESTING DATA STRUCTURES & PILOT DEPLOYMENT
// =========================================================================

export type ExperimentStatus = 'DRAFT' | 'RUNNING' | 'PAUSED' | 'CONCLUDED';
export type ExperimentVariant = 'A' | 'B';

export interface ExperimentTargetingCriteria {
  dealers?: string[];
  regions?: string[];
  fuelTypes?: string[];
  userRoles?: string[];
}

export interface ExperimentMetrics {
  impressionsA: number;
  impressionsB: number;
  submissionsA: number;
  submissionsB: number;
  validationErrorsA: number;
  validationErrorsB: number;
  totalDurationSecA: number;
  totalDurationSecB: number;
}

export interface ABExperiment {
  id: string;
  name: string;
  description: string;
  targetModule: DealerTargetModule | 'all';
  status: ExperimentStatus;
  startDate: string;
  endDate?: string;
  controlVersion: string; // e.g. "v1.1.0" (Variant A)
  variantVersion: string; // e.g. "v2.0.0-rc1" (Variant B)
  trafficSplitPercentB: number; // e.g. 50 (50% traffic goes to B)
  targeting?: ExperimentTargetingCriteria;
  metrics: ExperimentMetrics;
  winningVariant?: ExperimentVariant;
  concludedDate?: string;
  concludedBy?: string;
  rolloutDecisionNotes?: string;
  createdBy: string;
  lastUpdated: string;
}

export interface ExperimentVariantAnalysis {
  experimentId: string;
  variantA: {
    version: string;
    ruleCount: number;
    impressions: number;
    submissions: number;
    validationErrors: number;
    submissionRatePercent: number;
    errorRatePercent: number;
    avgDurationSeconds: number;
  };
  variantB: {
    version: string;
    ruleCount: number;
    impressions: number;
    submissions: number;
    validationErrors: number;
    submissionRatePercent: number;
    errorRatePercent: number;
    avgDurationSeconds: number;
  };
  diffSummary: {
    totalDifferences: number;
    breakingChangesCount: number;
    fieldsAdded: string[];
    fieldsRemoved: string[];
    fieldsModified: string[];
  };
  recommendedWinner: 'A' | 'B' | 'INCONCLUSIVE';
  confidenceScore: number;
  recommendationReason: string;
}

const STORAGE_KEY = 'tata_motors_rules_engine_definitions_v2';
const AB_EXPERIMENTS_KEY = 'tata_motors_rules_ab_experiments_v2';

const isBlank = (v: any) => v === undefined || v === null || String(v).trim() === '';
const ACTIVE_VERSION_KEY = 'tata_motors_rules_engine_active_version_v2';
const VERSION_HISTORY_KEY = 'tata_motors_rules_engine_releases_v2';

// Standard Regex Presets for Automotive & Indian CRM domain
export const REGEX_PRESETS: Record<string, { label: string; pattern: string; message: string }> = {
  VIN_NUMBER: {
    label: 'Chassis VIN (17 Alphanumeric characters)',
    pattern: '^[A-HJ-NPR-Z0-9]{17}$',
    message: 'VIN must be exactly 17 alphanumeric characters (excluding I, O, Q)',
  },
  INDIAN_VEHICLE_REG: {
    label: 'Indian Vehicle Registration Plate (e.g. MH02AB1234)',
    pattern: '^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$',
    message: 'Registration must follow standard state plate format (e.g. MH02DW4821)',
  },
  BATTERY_SERIAL_NUMBER: {
    label: 'TATA EV High-Voltage Battery Pack Serial',
    pattern: '^TATA-EV-BAT-[A-Z0-9]{6,10}$',
    message: 'EV Battery serial must start with TATA-EV-BAT- followed by 6-10 characters',
  },
  FASTAG_16_DIGIT: {
    label: 'FASTag 16-Digit RFID Serial',
    pattern: '^[0-9]{16}$',
    message: 'FASTag RFID number must be exactly 16 digits',
  },
  INSURANCE_POLICY: {
    label: 'Insurance Policy / Claim ID (e.g. POL-849204)',
    pattern: '^(POL|CLM)-[A-Z0-9]{6,12}$',
    message: 'Policy/Claim ID must begin with POL- or CLM- followed by 6-12 characters',
  },
  INDIAN_MOBILE: {
    label: 'Customer Mobile (10-Digit Indian)',
    pattern: '^[6-9][0-9]{9}$',
    message: 'Mobile number must be a valid 10-digit Indian mobile starting with 6, 7, 8, or 9',
  },
  OBD_DTC_CODE: {
    label: 'OBD-II Diagnostic Trouble Code (e.g. P0A80)',
    pattern: '^[PBUC][0-3][0-9A-F]{3}$',
    message: 'DTC code must follow SAE standard format (e.g. P0A80, C1234)',
  },
};

// =========================================================================
// SEEDED API VERSION RELEASES (REALISTIC TATA MOTORS ROadmap)
// =========================================================================

const BASE_RULES_V1_0: CustomFieldRuleDefinition[] = [
  {
    id: 'RULE_EV_BATTERY_SOH',
    key: 'ev_battery_health_soh',
    label: 'High-Voltage Battery State of Health (SoH %)',
    dealerDisplayLabel: '⚡ EV Battery State of Health',
    widgetType: 'number',
    targetModule: 'vehicle_journey',
    defaultValue: 94,
    description: 'Real-time telemetry / diagnostic reading of high-voltage traction battery degradation level',
    category: 'EV Powertrain & High-Voltage Diagnostics',
    version: 1,
    lastUpdated: '2026-08-01 08:00:00',
    updatedBy: 'TML-RELEASE-ENG',
    active: true,
    validation: {
      required: true,
      range: {
        min: 0,
        max: 100,
        step: 0.1,
        minMessage: 'Battery State of Health cannot be less than 0%',
        maxMessage: 'Battery State of Health cannot exceed 100%',
      },
      requiredMessage: 'EV Battery State of Health is mandatory for all Electric Vehicles',
    },
    uiLogic: {
      visibleIf: {
        logicalOperator: 'OR',
        conditions: [
          { field: 'fuel_type', operator: 'equals', value: 'EV' },
          { field: 'fuelType', operator: 'equals', value: 'EV' },
          { field: 'isEvVehicle', operator: 'isTrue' },
          { field: 'model', operator: 'contains', value: 'EV' },
        ],
      },
      helperText: 'Readings below 80% automatically flag an High-Voltage Cell Diagnostic advisory',
      badgeColor: 'emerald',
      gridSpan: 1,
      placeholder: 'e.g. 94.5',
    },
  },
  {
    id: 'RULE_WARRANTY_TIER',
    key: 'extended_warranty_tier',
    label: 'Extended Warranty & AMC Tier',
    dealerDisplayLabel: '🛡️ Warranty & AMC Coverage Plan',
    widgetType: 'select',
    targetModule: 'vehicle_journey',
    options: ['PLATINUM', 'GOLD', 'SILVER', 'STANDARD'],
    defaultValue: 'PLATINUM',
    description: 'Active customer coverage contract for parts discount and labour concession',
    category: 'Customer Commercials & Value Added Services',
    version: 1,
    lastUpdated: '2026-08-01 08:00:00',
    updatedBy: 'TML-RELEASE-ENG',
    active: true,
    validation: {
      required: true,
      allowedValues: ['PLATINUM', 'GOLD', 'SILVER', 'STANDARD'],
      allowedValuesMessage: 'Please select a valid Tata Motors approved coverage tier',
    },
    uiLogic: {
      valueMapping: {
        PLATINUM: '🛡️ Platinum 5-Yr Comprehensive Cover (15% Labour Discount)',
        GOLD: '⭐ Gold 3-Yr Drivetrain & Parts Protection',
        SILVER: '🥈 Silver 2-Yr Scheduled Periodic Package',
        STANDARD: '🚗 Standard 1-Yr OEM Manufacturer Warranty',
      },
      helperText: 'Applied coverage automatically discounts approved warranty FRT items',
      badgeColor: 'purple',
      gridSpan: 2,
    },
  },
  {
    id: 'RULE_TELEMATICS_STATUS',
    key: 'telematics_ota_status',
    label: 'iRA Connected Telematics OTA Status',
    dealerDisplayLabel: '📡 iRA Connected Fleet Telematics',
    widgetType: 'select',
    targetModule: 'vehicle_journey',
    options: ['OTA_ACTIVE', 'ECU_FLASH_REQ', 'NON_CONNECTED'],
    defaultValue: 'OTA_ACTIVE',
    description: 'Tata Motors iRA connected car telematics diagnostic state',
    category: 'Connected Vehicle Telematics',
    version: 1,
    lastUpdated: '2026-08-01 08:00:00',
    updatedBy: 'TML-RELEASE-ENG',
    active: true,
    validation: {
      required: false,
    },
    uiLogic: {
      valueMapping: {
        OTA_ACTIVE: '🟢 Connected Fleet Live (Firmware v4.2 Current)',
        ECU_FLASH_REQ: '⚠️ Manual Bay Flash Required (Safety Update Pending)',
        NON_CONNECTED: '⚪ Legacy Non-Telematics ECU',
      },
      badgeColor: 'blue',
      gridSpan: 2,
    },
  },
  {
    id: 'RULE_INSURANCE_CLAIM_ID',
    key: 'insurance_claim_number',
    label: 'Surveyor Authorized Insurance Claim Number',
    dealerDisplayLabel: '📑 Insurance Claim ID',
    widgetType: 'text',
    targetModule: 'vehicle_journey',
    defaultValue: 'CLM-NIA-839201',
    description: 'Cashless / Reimbursement claim ID approved by registered insurance surveyor',
    category: 'Bodyshop & Accidental Insurance Claims',
    version: 1,
    lastUpdated: '2026-08-01 08:00:00',
    updatedBy: 'TML-RELEASE-ENG',
    active: true,
    validation: {
      requiredIf: {
        logicalOperator: 'OR',
        conditions: [
          { field: 'isInsuranceClaim', operator: 'isTrue' },
          { field: 'serviceType', operator: 'contains', value: 'Accidental' },
          { field: 'serviceType', operator: 'contains', value: 'Bodyshop' },
          { field: 'claimStatus', operator: 'isNotEmpty' },
        ],
      },
      regex: {
        presetName: 'INSURANCE_POLICY',
        pattern: '^(POL|CLM)-[A-Z0-9]{6,12}$',
        message: 'Claim number must start with CLM- or POL- followed by 6-12 letters/numbers',
      },
      requiredMessage: 'Claim Number is strictly mandatory when Insurance Claim is active',
    },
    uiLogic: {
      visibleIf: {
        logicalOperator: 'OR',
        conditions: [
          { field: 'isInsuranceClaim', operator: 'isTrue' },
          { field: 'serviceType', operator: 'contains', value: 'Accidental' },
          { field: 'serviceType', operator: 'contains', value: 'Bodyshop' },
          { field: 'claimStatus', operator: 'isNotEmpty' },
        ],
      },
      helperText: 'Verified against ICICI Lombard / New India / Tata AIG cashless portal',
      badgeColor: 'rose',
      gridSpan: 1,
      placeholder: 'CLM-XXX-123456',
    },
  },
];

const BASE_RULES_V1_1: CustomFieldRuleDefinition[] = [
  ...BASE_RULES_V1_0,
  {
    id: 'RULE_EV_BATTERY_SERIAL',
    key: 'ev_battery_serial_no',
    label: 'High-Voltage Battery Pack Serial Number',
    dealerDisplayLabel: '🔋 Traction Battery Pack Serial',
    widgetType: 'text',
    targetModule: 'vehicle_journey',
    defaultValue: 'TATA-EV-BAT-NEX09482',
    description: 'Individual battery pack serial scanned during battery thermal scan',
    category: 'EV Powertrain & High-Voltage Diagnostics',
    version: 1,
    lastUpdated: '2026-09-15 10:00:00',
    updatedBy: 'TML-PO-VH01',
    active: true,
    validation: {
      required: true,
      regex: {
        presetName: 'BATTERY_SERIAL_NUMBER',
        pattern: '^TATA-EV-BAT-[A-Z0-9]{6,10}$',
        message: 'Must follow format: TATA-EV-BAT-XXXXXX (e.g. TATA-EV-BAT-NEX09482)',
      },
      requiredMessage: 'Battery Pack Serial must be verified for EV warranty claims',
    },
    uiLogic: {
      visibleIf: {
        logicalOperator: 'OR',
        conditions: [
          { field: 'fuel_type', operator: 'equals', value: 'EV' },
          { field: 'fuelType', operator: 'equals', value: 'EV' },
          { field: 'isEvVehicle', operator: 'isTrue' },
          { field: 'model', operator: 'contains', value: 'EV' },
        ],
      },
      helperText: 'Barcode/QR code scanned from underside thermal cover',
      badgeColor: 'blue',
      gridSpan: 1,
      placeholder: 'TATA-EV-BAT-XXXXXX',
    },
  },
  {
    id: 'RULE_FASTAG_RFID',
    key: 'fastag_rfid_serial',
    label: 'FASTag 16-Digit RFID Transponder',
    dealerDisplayLabel: '🏷️ FASTag RFID Serial',
    widgetType: 'text',
    targetModule: 'vehicle_journey',
    defaultValue: '6001019283746501',
    description: 'RFID windshield transponder verified for automated workshop toll & gate transit',
    category: 'Vehicle Identity & Gate Pass',
    version: 1,
    lastUpdated: '2026-09-15 10:00:00',
    updatedBy: 'TML-PO-VH01',
    active: true,
    validation: {
      regex: {
        presetName: 'FASTAG_16_DIGIT',
        pattern: '^[0-9]{16}$',
        message: 'FASTag RFID must be exactly 16 numeric digits',
      },
    },
    uiLogic: {
      helperText: 'Read automatically by gate camera upon dealership arrival',
      badgeColor: 'amber',
      gridSpan: 1,
      placeholder: '16 digit RFID number',
    },
  },
];

const BASE_RULES_V2_0: CustomFieldRuleDefinition[] = [
  ...BASE_RULES_V1_1,
  {
    id: 'RULE_EV_INSULATION_RESISTANCE',
    key: 'ev_insulation_resistance_mohm',
    label: 'High-Voltage Insulation Resistance (MΩ)',
    dealerDisplayLabel: '⚡ HV Insulation Resistance',
    widgetType: 'number',
    targetModule: 'workshop_floor',
    defaultValue: 550,
    description: 'Safety megohmmeter check on 400V traction bus before vehicle is released to customer',
    category: 'EV Powertrain & High-Voltage Diagnostics',
    version: 1,
    lastUpdated: '2026-09-30 08:30:00',
    updatedBy: 'TML-SAFETY-COMM',
    active: true,
    validation: {
      required: true,
      range: {
        min: 500,
        max: 5000,
        minMessage: 'Insulation resistance must be ≥ 500 MΩ for safety signoff',
      },
      requiredMessage: 'Insulation resistance test is legally mandatory for EV gate release',
    },
    uiLogic: {
      visibleIf: {
        logicalOperator: 'OR',
        conditions: [
          { field: 'fuel_type', operator: 'equals', value: 'EV' },
          { field: 'isEvVehicle', operator: 'isTrue' },
        ],
      },
      helperText: 'Tested across HV Positive/Negative to chassis ground using Fluke 1587',
      badgeColor: 'emerald',
      gridSpan: 1,
      placeholder: 'Min 500 MΩ',
    },
  },
  {
    id: 'RULE_OBD_DTC_CODE',
    key: 'obd_primary_dtc',
    label: 'Primary OBD-II DTC Diagnostic Trouble Code',
    dealerDisplayLabel: '🔧 OBD-II Diagnostic DTC',
    widgetType: 'text',
    targetModule: 'job_card',
    defaultValue: 'P0A80',
    description: 'Primary diagnostic trouble code pulled via Tata Motors Diagnostics Scanner (TDS)',
    category: 'Diagnostic Telemetry & EQC',
    version: 1,
    lastUpdated: '2026-09-30 08:30:00',
    updatedBy: 'TML-TECH-OPS',
    active: true,
    validation: {
      regex: {
        presetName: 'OBD_DTC_CODE',
        pattern: '^[PBUC][0-3][0-9A-F]{3}$',
        message: 'Must follow SAE DTC format (e.g. P0A80, C1234, B0001)',
      },
    },
    uiLogic: {
      helperText: 'Pulled automatically via VCI OBD Dongle in Bay',
      badgeColor: 'purple',
      gridSpan: 1,
      placeholder: 'e.g. P0A80',
    },
  },
];

export const DEFAULT_API_VERSION_RELEASES: ApiVersionRelease[] = [
  {
    version: 'v1.0.0',
    status: 'DEPRECATED',
    releaseName: 'Baseline Automotive Schema (LTS)',
    releaseDate: '2026-08-01',
    publishedBy: 'TML Central Architecture',
    releaseNotes:
      'Initial release of dynamic schema rules for EV Battery SoH, AMC Warranty Tiers, and Telematics OTA states.',
    minClientAppVersion: '>= 3.8.0',
    backwardCompatible: true,
    breakingChanges: [],
    rules: BASE_RULES_V1_0,
  },
  {
    version: 'v1.1.0',
    status: 'ACTIVE',
    releaseName: 'Fleet Telematics & FASTag RFID Extension',
    releaseDate: '2026-09-15',
    publishedBy: 'TML PV & EV Services',
    releaseNotes:
      'Added high-voltage battery pack serial regex validation and FASTag 16-digit RFID windshield transponder parameter.',
    minClientAppVersion: '>= 4.1.0',
    backwardCompatible: true,
    breakingChanges: [],
    rules: BASE_RULES_V1_1,
  },
  {
    version: 'v2.0.0-rc1',
    status: 'BETA',
    releaseName: 'Next-Gen EV Safety & OBD Diagnostic Telemetry',
    releaseDate: '2026-09-30',
    publishedBy: 'TML Safety & EV Powertrain Group',
    releaseNotes:
      'Introduces mandatory High-Voltage Insulation Resistance checks (≥500 MΩ) and standardized OBD-II DTC trouble code pattern verification.',
    minClientAppVersion: '>= 4.3.0',
    backwardCompatible: false,
    breakingChanges: [
      'High-Voltage Insulation Resistance is now strictly mandatory for all EV Gate Passes.',
      'EV Battery Serial format enforcement is tightened to 10 alphanumeric characters.',
    ],
    rules: BASE_RULES_V2_0,
    migrations: [
      {
        fieldKey: 'ev_insulation_resistance_mohm',
        action: 'SET_DEFAULT',
        fallbackValue: 550,
        warningMessage: 'Legacy records default to 550 MΩ standard baseline.',
      },
    ],
  },
];

export const DEFAULT_AUTOMOTIVE_RULES = BASE_RULES_V1_1;

export const DEFAULT_AB_EXPERIMENTS: ABExperiment[] = [
  {
    id: 'EXP-EV-INSPECTION-V2',
    name: 'Next-Gen EV Safety & High-Voltage Telemetry Pilot',
    description:
      'A/B comparison of mandatory High-Voltage Insulation Resistance checks (v2.0.0-rc1) versus standard battery health baseline (v1.1.0) before nationwide dealer rollout.',
    targetModule: 'all',
    status: 'RUNNING',
    startDate: '2026-09-20',
    controlVersion: 'v1.1.0',
    variantVersion: 'v2.0.0-rc1',
    trafficSplitPercentB: 50,
    targeting: {
      fuelTypes: ['EV'],
      regions: ['West', 'North'],
    },
    metrics: {
      impressionsA: 184,
      impressionsB: 180,
      submissionsA: 172,
      submissionsB: 171,
      validationErrorsA: 9,
      validationErrorsB: 12,
      totalDurationSecA: 7740,
      totalDurationSecB: 8160,
    },
    createdBy: 'TML-SAFETY-COMM',
    lastUpdated: '2026-09-30 14:00:00',
  },
  {
    id: 'EXP-FASTAG-RECEPTION-V1',
    name: 'Workshop Reception FASTag Windshield RFID Validation',
    description:
      'Evaluated 16-digit RFID windshield transponder parameter against legacy free-form entry at workshop arrival gates.',
    targetModule: 'reception',
    status: 'CONCLUDED',
    startDate: '2026-09-01',
    endDate: '2026-09-14',
    controlVersion: 'v1.0.0',
    variantVersion: 'v1.1.0',
    trafficSplitPercentB: 50,
    metrics: {
      impressionsA: 420,
      impressionsB: 435,
      submissionsA: 388,
      submissionsB: 426,
      validationErrorsA: 41,
      validationErrorsB: 8,
      totalDurationSecA: 15520,
      totalDurationSecB: 12780,
    },
    winningVariant: 'B',
    concludedDate: '2026-09-15',
    concludedBy: 'TML-CENTRAL-SERVICES',
    rolloutDecisionNotes:
      'Variant B increased automated gate check-in accuracy by 32% and lowered data errors from 9.7% to 1.8%. Fully promoted to active production release.',
    createdBy: 'TML-CENTRAL-SERVICES',
    lastUpdated: '2026-09-15 10:00:00',
  },
];

class RulesEngineService {
  private releases: ApiVersionRelease[] = [];
  private experiments: ABExperiment[] = [];
  private activeVersionStr: string = 'v1.1.0';
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadState();
  }

  /**
   * Load releases, experiments, and active version from storage or initialize defaults
   */
  private loadState(): void {
    try {
      const storedReleases = localStorage.getItem(VERSION_HISTORY_KEY);
      const storedActiveVersion = localStorage.getItem(ACTIVE_VERSION_KEY);
      const storedExperiments = localStorage.getItem(AB_EXPERIMENTS_KEY);

      if (storedReleases) {
        const parsed = JSON.parse(storedReleases);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.releases = parsed;
        }
      }

      if (this.releases.length === 0) {
        this.releases = JSON.parse(JSON.stringify(DEFAULT_API_VERSION_RELEASES));
      }

      if (storedExperiments) {
        const parsedExp = JSON.parse(storedExperiments);
        if (Array.isArray(parsedExp) && parsedExp.length > 0) {
          this.experiments = parsedExp;
        }
      }

      if (this.experiments.length === 0) {
        this.experiments = JSON.parse(JSON.stringify(DEFAULT_AB_EXPERIMENTS));
      }

      if (storedActiveVersion && this.releases.some((r) => r.version === storedActiveVersion)) {
        this.activeVersionStr = storedActiveVersion;
      } else {
        const activeRelease = this.releases.find((r) => r.status === 'ACTIVE') || this.releases[0];
        this.activeVersionStr = activeRelease.version;
      }
    } catch (err) {
      console.warn('Failed to load version history or experiments, initializing defaults:', err);
      this.releases = JSON.parse(JSON.stringify(DEFAULT_API_VERSION_RELEASES));
      this.experiments = JSON.parse(JSON.stringify(DEFAULT_AB_EXPERIMENTS));
      this.activeVersionStr = 'v1.1.0';
    }

    this.saveState();
  }

  private saveState(): void {
    try {
      localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(this.releases));
      localStorage.setItem(ACTIVE_VERSION_KEY, this.activeVersionStr);
      localStorage.setItem(AB_EXPERIMENTS_KEY, JSON.stringify(this.experiments));
      // Backwards-compatible legacy key storage for the active rules list
      const activeRelease = this.getActiveApiVersion();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activeRelease.rules));
      this.notifyListeners();
    } catch (err) {
      console.error('Failed to persist rules engine release state:', err);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Error executing rules engine listener:', e);
      }
    });
  }

  // =========================================================================
  // API VERSION MANAGEMENT CRUD & LIFECYCLE
  // =========================================================================

  public getAllApiVersions(): ApiVersionRelease[] {
    return JSON.parse(JSON.stringify(this.releases));
  }

  public getActiveApiVersion(): ApiVersionRelease {
    const active = this.releases.find((r) => r.version === this.activeVersionStr);
    return (
      active ||
      this.releases.find((r) => r.status === 'ACTIVE') ||
      this.releases[0]
    );
  }

  public getApiVersion(version: string): ApiVersionRelease | undefined {
    return this.releases.find((r) => r.version === version);
  }

  /**
   * Promotes a version to ACTIVE with zero dealer downtime and deprecates the prior active release
   */
  public setActiveApiVersion(
    version: string,
    user: string = 'TML-ADMIN'
  ): { success: boolean; message: string; previousVersion: string } {
    const target = this.releases.find((r) => r.version === version);
    if (!target) {
      return { success: false, message: `Version ${version} not found in release registry`, previousVersion: this.activeVersionStr };
    }

    const previous = this.activeVersionStr;

    // Demote prior active version to DEPRECATED if it was active
    this.releases.forEach((r) => {
      if (r.version === previous && r.status === 'ACTIVE') {
        r.status = 'DEPRECATED';
      }
    });

    target.status = 'ACTIVE';
    target.releaseDate = new Date().toISOString().substring(0, 10);
    target.publishedBy = user;
    this.activeVersionStr = version;

    this.saveState();
    return {
      success: true,
      message: `Version ${version} promoted to ACTIVE PAN-India. Live Dealer Application hot-reloaded without downtime!`,
      previousVersion: previous,
    };
  }

  /**
   * Emergency Rollback to a previous stable version
   */
  public rollbackToVersion(
    targetVersion: string,
    user: string = 'TML-ADMIN'
  ): { success: boolean; message: string } {
    const target = this.releases.find((r) => r.version === targetVersion);
    if (!target) {
      return { success: false, message: `Cannot rollback: target version ${targetVersion} does not exist.` };
    }

    const current = this.activeVersionStr;
    const currentRelease = this.releases.find((r) => r.version === current);
    if (currentRelease) {
      currentRelease.status = 'DEPRECATED';
    }

    target.status = 'ACTIVE';
    this.activeVersionStr = targetVersion;
    this.saveState();

    return {
      success: true,
      message: `Emergency rollback complete: Cut back from ${current} to stable release ${targetVersion} with zero dealer disruption.`,
    };
  }

  /**
   * Creates a draft release by forking an existing release
   */
  public createDraftVersion(
    baseVersionStr: string,
    newVersionStr: string,
    releaseName: string,
    releaseNotes: string,
    user: string = 'TML-ADMIN'
  ): ApiVersionRelease {
    const base = this.releases.find((r) => r.version === baseVersionStr) || this.getActiveApiVersion();
    const clonedRules: CustomFieldRuleDefinition[] = JSON.parse(JSON.stringify(base.rules));

    const newRelease: ApiVersionRelease = {
      version: newVersionStr,
      status: 'DRAFT',
      releaseName: releaseName || `Release ${newVersionStr}`,
      releaseDate: new Date().toISOString().substring(0, 10),
      publishedBy: user,
      releaseNotes: releaseNotes || 'Draft schema update pending validation',
      minClientAppVersion: '>= 4.2.0',
      backwardCompatible: true,
      breakingChanges: [],
      rules: clonedRules,
      migrations: [],
    };

    this.releases.unshift(newRelease);
    this.saveState();
    return newRelease;
  }

  /**
   * Updates an existing draft or beta version's configuration
   */
  public updateVersion(release: ApiVersionRelease): boolean {
    const idx = this.releases.findIndex((r) => r.version === release.version);
    if (idx >= 0) {
      this.releases[idx] = JSON.parse(JSON.stringify(release));
      this.saveState();
      return true;
    }
    return false;
  }

  /**
   * Promotes version status (e.g. DRAFT -> BETA -> ACTIVE -> DEPRECATED)
   */
  public promoteVersionStatus(versionStr: string, newStatus: ApiVersionStatus, user: string = 'TML-ADMIN'): boolean {
    const target = this.releases.find((r) => r.version === versionStr);
    if (!target) return false;

    if (newStatus === 'ACTIVE') {
      this.setActiveApiVersion(versionStr, user);
      return true;
    }

    target.status = newStatus;
    this.saveState();
    return true;
  }

  /**
   * Deletes a DRAFT release (Cannot delete ACTIVE version)
   */
  public deleteVersion(versionStr: string): { success: boolean; error?: string } {
    if (versionStr === this.activeVersionStr) {
      return { success: false, error: 'Cannot delete the currently ACTIVE production release!' };
    }
    const prev = this.releases.length;
    this.releases = this.releases.filter((r) => r.version !== versionStr);
    if (this.releases.length !== prev) {
      this.saveState();
      return { success: true };
    }
    return { success: false, error: 'Version not found' };
  }

  // =========================================================================
  // VERSION DIFF & BREAKING CHANGE ANALYZER
  // =========================================================================

  /**
   * Performs an automated semantic diff between two versions to identify additions,
   * modifications, deletions, and breaking changes before rollout
   */
  public compareVersions(sourceVersionStr: string, targetVersionStr: string): VersionComparisonResult {
    const source = this.releases.find((r) => r.version === sourceVersionStr);
    const target = this.releases.find((r) => r.version === targetVersionStr);

    if (!source || !target) {
      return {
        sourceVersion: sourceVersionStr,
        targetVersion: targetVersionStr,
        isBackwardCompatible: true,
        breakingChangesCount: 0,
        totalChangesCount: 0,
        diffs: [],
      };
    }

    const diffs: VersionDiffItem[] = [];
    const sourceRuleMap = new Map<string, CustomFieldRuleDefinition>();
    source.rules.forEach((r) => sourceRuleMap.set(r.key, r));

    const targetRuleMap = new Map<string, CustomFieldRuleDefinition>();
    target.rules.forEach((r) => targetRuleMap.set(r.key, r));

    // Check target rules against source
    target.rules.forEach((targetRule) => {
      const sourceRule = sourceRuleMap.get(targetRule.key);

      if (!sourceRule) {
        // Field was added
        const isRequiredWithoutDefault =
          Boolean(targetRule.validation?.required) &&
          (targetRule.defaultValue === undefined || targetRule.defaultValue === '');

        diffs.push({
          key: targetRule.key,
          label: targetRule.dealerDisplayLabel || targetRule.label,
          changeType: 'ADDED',
          isBreaking: isRequiredWithoutDefault,
          details: [
            `New field added (${targetRule.widgetType})`,
            ...(isRequiredWithoutDefault
              ? ['⚠️ Mandatory without default value: BREAKING for older clients submitting records!']
              : ['Backward-compatible addition']),
          ],
        });
      } else {
        // Field exists in both: inspect modifications
        const deltaDetails: string[] = [];
        let isBreaking = false;

        // Check widget type change
        if (sourceRule.widgetType !== targetRule.widgetType) {
          deltaDetails.push(`Widget type changed from ${sourceRule.widgetType} to ${targetRule.widgetType}`);
          isBreaking = true;
        }

        // Check required change
        if (!sourceRule.validation?.required && targetRule.validation?.required) {
          deltaDetails.push('Field was made mandatory (previously optional)');
          isBreaking = true;
        }

        // Check regex change
        if (sourceRule.validation?.regex?.pattern !== targetRule.validation?.regex?.pattern) {
          deltaDetails.push(
            `Regex pattern modified: "${sourceRule.validation?.regex?.pattern || 'None'}" → "${targetRule.validation?.regex?.pattern || 'None'}"`
          );
        }

        // Check range changes
        if (
          sourceRule.validation?.range?.min !== targetRule.validation?.range?.min ||
          sourceRule.validation?.range?.max !== targetRule.validation?.range?.max
        ) {
          deltaDetails.push(
            `Numeric range adjusted to [${targetRule.validation?.range?.min ?? '-∞'}, ${targetRule.validation?.range?.max ?? '+∞'}]`
          );
        }

        if (deltaDetails.length > 0) {
          diffs.push({
            key: targetRule.key,
            label: targetRule.dealerDisplayLabel || targetRule.label,
            changeType: 'MODIFIED',
            isBreaking,
            details: deltaDetails,
          });
        }
      }
    });

    // Check for removed fields in target
    source.rules.forEach((sourceRule) => {
      if (!targetRuleMap.has(sourceRule.key)) {
        diffs.push({
          key: sourceRule.key,
          label: sourceRule.dealerDisplayLabel || sourceRule.label,
          changeType: 'REMOVED',
          isBreaking: true,
          details: ['Field was removed from schema: BREAKING if dependent screens expect it'],
        });
      }
    });

    const breakingCount = diffs.filter((d) => d.isBreaking).length;

    return {
      sourceVersion: sourceVersionStr,
      targetVersion: targetVersionStr,
      isBackwardCompatible: breakingCount === 0,
      breakingChangesCount: breakingCount,
      totalChangesCount: diffs.length,
      diffs,
    };
  }

  // =========================================================================
  // CLIENT NEGOTIATION & BACKWARD-COMPATIBLE RULE RESOLUTION
  // =========================================================================

  /**
   * Returns rule definitions for a specific version or fallback to active
   */
  public getRulesForVersion(versionStr?: string, targetModule?: DealerTargetModule): CustomFieldRuleDefinition[] {
    const targetRelease = versionStr
      ? this.releases.find((r) => r.version === versionStr) || this.getActiveApiVersion()
      : this.getActiveApiVersion();

    if (!targetModule || targetModule === 'general') {
      return targetRelease.rules.filter((r) => r.active);
    }

    return targetRelease.rules.filter(
      (r) => r.active && (r.targetModule === targetModule || r.targetModule === 'general')
    );
  }

  /**
   * Resolves client requests considering dealer app version for graceful backward compatibility
   */
  public resolveClientRules(
    clientAppVersion?: string,
    requestedApiVersion?: string,
    targetModule?: DealerTargetModule
  ): {
    version: string;
    status: ApiVersionStatus;
    rules: CustomFieldRuleDefinition[];
    isLegacyFallback: boolean;
    notice?: string;
  } {
    // If specific version explicitly requested and exists, honor it
    if (requestedApiVersion) {
      const match = this.releases.find((r) => r.version === requestedApiVersion);
      if (match) {
        return {
          version: match.version,
          status: match.status,
          rules: this.getRulesForVersion(match.version, targetModule),
          isLegacyFallback: match.status === 'DEPRECATED',
          notice: match.status === 'DEPRECATED' ? `API Version ${match.version} is deprecated.` : undefined,
        };
      }
    }

    // Default to active version
    const active = this.getActiveApiVersion();

    // Check if clientAppVersion is too old for the active release
    if (clientAppVersion && active.minClientAppVersion) {
      const minReq = active.minClientAppVersion.replace(/[^0-9.]/g, '');
      const clientClean = clientAppVersion.replace(/[^0-9.]/g, '');

      if (this.compareSemVer(clientClean, minReq) < 0) {
        // Client is too old for active release! Gracefully fall back to latest compatible deprecated release
        const fallback =
          this.releases.find((r) => r.status === 'DEPRECATED' && r.backwardCompatible) || active;
        return {
          version: fallback.version,
          status: fallback.status,
          rules: this.getRulesForVersion(fallback.version, targetModule),
          isLegacyFallback: true,
          notice: `Client app v${clientAppVersion} does not support API ${active.version}. Served compatible schema ${fallback.version}.`,
        };
      }
    }

    return {
      version: active.version,
      status: active.status,
      rules: this.getRulesForVersion(active.version, targetModule),
      isLegacyFallback: false,
    };
  }

  /**
   * Migrates legacy form data payloads when upgrading schema versions
   */
  public migrateLegacyPayload(
    payload: Record<string, any>,
    sourceVersion: string,
    targetVersion?: string
  ): { migrated: Record<string, any>; warnings: string[] } {
    const target = targetVersion
      ? this.releases.find((r) => r.version === targetVersion) || this.getActiveApiVersion()
      : this.getActiveApiVersion();

    const migrated: Record<string, any> = { ...payload };
    const warnings: string[] = [];

    // Apply migrations defined in target release
    if (target.migrations && target.migrations.length > 0) {
      target.migrations.forEach((m) => {
        if (m.action === 'SET_DEFAULT' && (migrated[m.fieldKey] === undefined || migrated[m.fieldKey] === '')) {
          migrated[m.fieldKey] = m.fallbackValue;
          if (m.warningMessage) warnings.push(m.warningMessage);
        }
      });
    }

    return { migrated, warnings };
  }

  private compareSemVer(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }

  // =========================================================================
  // RULE MANAGEMENT ON ACTIVE RELEASE
  // =========================================================================

  public getAllRules(): CustomFieldRuleDefinition[] {
    return this.getActiveApiVersion().rules;
  }

  public getRuleById(id: string): CustomFieldRuleDefinition | undefined {
    return this.getActiveApiVersion().rules.find((r) => r.id === id);
  }

  public getRulesForModule(targetModule: DealerTargetModule): CustomFieldRuleDefinition[] {
    return this.getRulesForVersion(this.activeVersionStr, targetModule);
  }

  /**
   * Creates or updates a rule (matched by id). Keys must be unique across rules —
   * saving a rule whose key belongs to a different rule is rejected rather than
   * silently overwriting that other rule.
   */
  public saveRule(rule: CustomFieldRuleDefinition): { success: boolean; error?: string } {
    const active = this.getActiveApiVersion();
    const key = rule.key.trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      return { success: false, error: `Field key "${rule.key}" must start with a letter/underscore and contain only letters, digits and underscores.` };
    }
    const keyOwner = active.rules.find((r) => r.key === key && r.id !== rule.id);
    if (keyOwner) {
      return { success: false, error: `Field key "${key}" is already used by rule "${keyOwner.label}".` };
    }
    if (rule.validation?.regex?.pattern) {
      try {
        new RegExp(rule.validation.regex.pattern, rule.validation.regex.flags || '');
      } catch (err: any) {
        return { success: false, error: `Invalid regex pattern: ${err?.message || rule.validation.regex.pattern}` };
      }
    }

    const existingIndex = active.rules.findIndex((r) => r.id === rule.id);
    const updatedRule: CustomFieldRuleDefinition = {
      ...rule,
      key,
      version: existingIndex >= 0 ? active.rules[existingIndex].version + 1 : 1,
      lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    // Replace the array (never mutate in place) so subscribers holding the old array re-render
    active.rules =
      existingIndex >= 0
        ? active.rules.map((r, i) => (i === existingIndex ? updatedRule : r))
        : [...active.rules, updatedRule];
    this.saveState();
    return { success: true };
  }

  /** Returns a key not yet used by any rule in the active release, e.g. custom_field_7. */
  public suggestUniqueKey(base = 'custom_field'): string {
    const used = new Set(this.getActiveApiVersion().rules.map((r) => r.key));
    let n = used.size + 1;
    while (used.has(`${base}_${n}`)) n++;
    return `${base}_${n}`;
  }

  public deleteRule(id: string): boolean {
    const active = this.getActiveApiVersion();
    const prevLen = active.rules.length;
    active.rules = active.rules.filter((r) => r.id !== id);
    if (active.rules.length !== prevLen) {
      this.saveState();
      return true;
    }
    return false;
  }

  public resetToDefaults(): void {
    this.releases = JSON.parse(JSON.stringify(DEFAULT_API_VERSION_RELEASES));
    this.experiments = JSON.parse(JSON.stringify(DEFAULT_AB_EXPERIMENTS));
    this.activeVersionStr = 'v1.1.0';
    this.saveState();
  }

  // =========================================================================
  // A/B TESTING EXPERIMENTS MANAGEMENT & RESOLUTION
  // =========================================================================

  public getAllExperiments(): ABExperiment[] {
    return JSON.parse(JSON.stringify(this.experiments));
  }

  public getExperimentById(id: string): ABExperiment | undefined {
    return this.experiments.find((e) => e.id === id);
  }

  public createExperiment(data: Partial<ABExperiment>): {
    success: boolean;
    experiment?: ABExperiment;
    error?: string;
  } {
    if (!data.name || !data.controlVersion || !data.variantVersion) {
      return { success: false, error: 'Name, control version, and variant version are required.' };
    }
    if (!this.releases.some((r) => r.version === data.controlVersion)) {
      return { success: false, error: `Control version "${data.controlVersion}" does not exist in release registry.` };
    }
    if (!this.releases.some((r) => r.version === data.variantVersion)) {
      return { success: false, error: `Variant version "${data.variantVersion}" does not exist in release registry.` };
    }
    if (data.controlVersion === data.variantVersion) {
      return { success: false, error: 'Control version (A) and variant version (B) must be different.' };
    }

    const id = data.id || `EXP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const newExp: ABExperiment = {
      id,
      name: data.name.trim(),
      description: data.description?.trim() || '',
      targetModule: data.targetModule || 'all',
      status: data.status || 'DRAFT',
      startDate: data.startDate || new Date().toISOString().substring(0, 10),
      endDate: data.endDate,
      controlVersion: data.controlVersion,
      variantVersion: data.variantVersion,
      trafficSplitPercentB:
        typeof data.trafficSplitPercentB === 'number'
          ? Math.max(0, Math.min(100, data.trafficSplitPercentB))
          : 50,
      targeting: data.targeting || {},
      metrics: {
        impressionsA: 0,
        impressionsB: 0,
        submissionsA: 0,
        submissionsB: 0,
        validationErrorsA: 0,
        validationErrorsB: 0,
        totalDurationSecA: 0,
        totalDurationSecB: 0,
      },
      createdBy: data.createdBy || 'TML-ADMIN',
      lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    this.experiments.unshift(newExp);
    this.saveState();
    return { success: true, experiment: newExp };
  }

  public updateExperiment(experiment: ABExperiment): boolean {
    const idx = this.experiments.findIndex((e) => e.id === experiment.id);
    if (idx >= 0) {
      this.experiments[idx] = {
        ...experiment,
        lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };
      this.saveState();
      return true;
    }
    return false;
  }

  public startExperiment(id: string): boolean {
    const exp = this.experiments.find((e) => e.id === id);
    if (exp) {
      exp.status = 'RUNNING';
      exp.lastUpdated = new Date().toISOString().replace('T', ' ').substring(0, 19);
      this.saveState();
      return true;
    }
    return false;
  }

  public pauseExperiment(id: string): boolean {
    const exp = this.experiments.find((e) => e.id === id);
    if (exp) {
      exp.status = 'PAUSED';
      exp.lastUpdated = new Date().toISOString().replace('T', ' ').substring(0, 19);
      this.saveState();
      return true;
    }
    return false;
  }

  public deleteExperiment(id: string): boolean {
    const prev = this.experiments.length;
    this.experiments = this.experiments.filter((e) => e.id !== id);
    if (this.experiments.length !== prev) {
      this.saveState();
      return true;
    }
    return false;
  }

  public concludeExperiment(
    id: string,
    winningVariant: ExperimentVariant,
    deployWinnerToActive: boolean = false,
    decisionNotes?: string,
    user: string = 'TML-ADMIN'
  ): { success: boolean; message: string } {
    const exp = this.experiments.find((e) => e.id === id);
    if (!exp) {
      return { success: false, message: 'Experiment not found.' };
    }

    exp.status = 'CONCLUDED';
    exp.winningVariant = winningVariant;
    exp.concludedDate = new Date().toISOString().substring(0, 10);
    exp.concludedBy = user;
    exp.rolloutDecisionNotes =
      decisionNotes || `Concluded with winning variant ${winningVariant}.`;
    exp.lastUpdated = new Date().toISOString().replace('T', ' ').substring(0, 19);

    let deployMessage = '';
    if (deployWinnerToActive) {
      const winnerVersion = winningVariant === 'A' ? exp.controlVersion : exp.variantVersion;
      this.setActiveApiVersion(winnerVersion, user);
      deployMessage = ` Winning version ${winnerVersion} has been promoted to ACTIVE Production release pan-India!`;
    }

    this.saveState();
    return {
      success: true,
      message: `Experiment "${exp.name}" successfully concluded.${deployMessage}`,
    };
  }

  /**
   * Deterministically assigns Variant A or Variant B for a given subject key (dealer ID, VIN, user ID).
   * Uses a stable hashing function so the same entity consistently experiences the same variant.
   */
  public assignVariant(experiment: ABExperiment, subjectKey: string): ExperimentVariant {
    let hash = 0;
    const str = `${experiment.id}:${subjectKey || 'default'}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    const bucket = Math.abs(hash) % 100;
    return bucket < experiment.trafficSplitPercentB ? 'B' : 'A';
  }

  /**
   * Finds the active running experiment matching the current context and resolves the assigned variant
   */
  public getActiveExperimentForContext(context: {
    subjectKey?: string;
    dealerId?: string;
    region?: string;
    fuelType?: string;
    userRole?: string;
    targetModule?: DealerTargetModule;
  }): {
    experiment: ABExperiment;
    assignedVariant: ExperimentVariant;
    assignedVersion: string;
    rules: CustomFieldRuleDefinition[];
  } | null {
    const running = this.experiments.filter((e) => e.status === 'RUNNING');
    if (running.length === 0) return null;

    for (const exp of running) {
      // Check target module
      if (exp.targetModule !== 'all' && context.targetModule && exp.targetModule !== context.targetModule) {
        continue;
      }

      // Check targeting criteria
      const t = exp.targeting;
      if (t) {
        if (t.dealers && t.dealers.length > 0 && context.dealerId && !t.dealers.includes(context.dealerId)) {
          continue;
        }
        if (t.regions && t.regions.length > 0 && context.region && !t.regions.includes(context.region)) {
          continue;
        }
        if (t.fuelTypes && t.fuelTypes.length > 0 && context.fuelType) {
          const matchFuel = t.fuelTypes.some((f) => f.toLowerCase() === context.fuelType!.toLowerCase());
          if (!matchFuel) continue;
        }
        if (t.userRoles && t.userRoles.length > 0 && context.userRole && !t.userRoles.includes(context.userRole)) {
          continue;
        }
      }

      // Match found! Assign variant
      const subject = context.subjectKey || context.dealerId || 'session-default';
      const variant = this.assignVariant(exp, subject);
      const assignedVersion = variant === 'A' ? exp.controlVersion : exp.variantVersion;
      const rules = this.getRulesForVersion(assignedVersion, context.targetModule);

      return {
        experiment: exp,
        assignedVariant: variant,
        assignedVersion,
        rules,
      };
    }

    return null;
  }

  /**
   * Resolves field rules taking active A/B experiments into account with fallback to active release
   */
  public resolveRulesWithABTesting(context: {
    subjectKey?: string;
    dealerId?: string;
    region?: string;
    fuelType?: string;
    userRole?: string;
    targetModule?: DealerTargetModule;
    forceVariant?: ExperimentVariant;
  }): {
    rules: CustomFieldRuleDefinition[];
    resolvedVersion: string;
    activeExperiment?: {
      id: string;
      name: string;
      variant: ExperimentVariant;
      controlVersion: string;
      variantVersion: string;
      trafficSplitPercentB: number;
    };
  } {
    const abResult = this.getActiveExperimentForContext(context);
    if (abResult) {
      const variant = context.forceVariant || abResult.assignedVariant;
      const resolvedVersion =
        variant === 'A' ? abResult.experiment.controlVersion : abResult.experiment.variantVersion;
      const rules = this.getRulesForVersion(resolvedVersion, context.targetModule);

      return {
        rules,
        resolvedVersion,
        activeExperiment: {
          id: abResult.experiment.id,
          name: abResult.experiment.name,
          variant,
          controlVersion: abResult.experiment.controlVersion,
          variantVersion: abResult.experiment.variantVersion,
          trafficSplitPercentB: abResult.experiment.trafficSplitPercentB,
        },
      };
    }

    // No active experiment matching context, use standard active version rules
    const active = this.getActiveApiVersion();
    const rules = this.getRulesForVersion(active.version, context.targetModule);
    return {
      rules,
      resolvedVersion: active.version,
    };
  }

  /**
   * Records live telemetry metrics for A/B testing evaluation
   */
  public recordExperimentMetric(
    experimentId: string,
    variant: ExperimentVariant,
    metricType: 'impression' | 'submission' | 'error',
    durationSeconds: number = 0
  ): boolean {
    const exp = this.experiments.find((e) => e.id === experimentId);
    if (!exp) return false;

    if (!exp.metrics) {
      exp.metrics = {
        impressionsA: 0,
        impressionsB: 0,
        submissionsA: 0,
        submissionsB: 0,
        validationErrorsA: 0,
        validationErrorsB: 0,
        totalDurationSecA: 0,
        totalDurationSecB: 0,
      };
    }

    if (variant === 'A') {
      if (metricType === 'impression') exp.metrics.impressionsA += 1;
      if (metricType === 'submission') exp.metrics.submissionsA += 1;
      if (metricType === 'error') exp.metrics.validationErrorsA += 1;
      if (durationSeconds > 0) exp.metrics.totalDurationSecA += durationSeconds;
    } else {
      if (metricType === 'impression') exp.metrics.impressionsB += 1;
      if (metricType === 'submission') exp.metrics.submissionsB += 1;
      if (metricType === 'error') exp.metrics.validationErrorsB += 1;
      if (durationSeconds > 0) exp.metrics.totalDurationSecB += durationSeconds;
    }

    exp.lastUpdated = new Date().toISOString().replace('T', ' ').substring(0, 19);
    this.saveState();
    return true;
  }

  /**
   * Analyzes experiment metrics and performs semantic diff to provide data-backed rollout recommendations
   */
  public compareExperimentVariants(experimentId: string): ExperimentVariantAnalysis | null {
    const exp = this.experiments.find((e) => e.id === experimentId);
    if (!exp) return null;

    const controlRules = this.getRulesForVersion(exp.controlVersion);
    const variantRules = this.getRulesForVersion(exp.variantVersion);
    const diff = this.compareVersions(exp.controlVersion, exp.variantVersion);

    const m = exp.metrics;
    const subRateA = m.impressionsA > 0 ? (m.submissionsA / m.impressionsA) * 100 : 0;
    const subRateB = m.impressionsB > 0 ? (m.submissionsB / m.impressionsB) * 100 : 0;

    const errRateA = m.impressionsA > 0 ? (m.validationErrorsA / m.impressionsA) * 100 : 0;
    const errRateB = m.impressionsB > 0 ? (m.validationErrorsB / m.impressionsB) * 100 : 0;

    const avgDurA = m.submissionsA > 0 ? Math.round(m.totalDurationSecA / m.submissionsA) : 0;
    const avgDurB = m.submissionsB > 0 ? Math.round(m.totalDurationSecB / m.submissionsB) : 0;

    // Recommendation logic based on submission rate, errors and sample volume
    const totalImpressions = m.impressionsA + m.impressionsB;
    let recommendedWinner: 'A' | 'B' | 'INCONCLUSIVE' = 'INCONCLUSIVE';
    let confidenceScore = 50;
    let recommendationReason = 'Insufficient data sample collected (< 50 impressions per variant).';

    if (totalImpressions >= 60) {
      const submissionLift = subRateB - subRateA;
      const errorDelta = errRateB - errRateA;

      if (submissionLift >= 0 && errorDelta <= 5) {
        recommendedWinner = 'B';
        confidenceScore = Math.min(98, 70 + Math.round(submissionLift * 4) + Math.round(totalImpressions / 20));
        recommendationReason = `Challenger Variant B (${exp.variantVersion}) demonstrates strong operational performance with ${subRateB.toFixed(1)}% submission rate and controlled error rate (${errRateB.toFixed(1)}%). Recommended for PAN-India promotion.`;
      } else if (submissionLift < -5 || errorDelta > 15) {
        recommendedWinner = 'A';
        confidenceScore = 88;
        recommendationReason = `Control Variant A (${exp.controlVersion}) outperformed Variant B due to lower error rates (${errRateA.toFixed(1)}% vs ${errRateB.toFixed(1)}%). Review validation rules in Variant B before attempting further rollout.`;
      } else {
        recommendedWinner = 'B';
        confidenceScore = 74;
        recommendationReason = `Variant B shows acceptable compliance across dealer test cohort with comparable completion metrics to baseline.`;
      }
    }

    return {
      experimentId: exp.id,
      variantA: {
        version: exp.controlVersion,
        ruleCount: controlRules.length,
        impressions: m.impressionsA,
        submissions: m.submissionsA,
        validationErrors: m.validationErrorsA,
        submissionRatePercent: Math.round(subRateA * 10) / 10,
        errorRatePercent: Math.round(errRateA * 10) / 10,
        avgDurationSeconds: avgDurA,
      },
      variantB: {
        version: exp.variantVersion,
        ruleCount: variantRules.length,
        impressions: m.impressionsB,
        submissions: m.submissionsB,
        validationErrors: m.validationErrorsB,
        submissionRatePercent: Math.round(subRateB * 10) / 10,
        errorRatePercent: Math.round(errRateB * 10) / 10,
        avgDurationSeconds: avgDurB,
      },
      diffSummary: {
        totalDifferences: diff.totalChangesCount,
        breakingChangesCount: diff.breakingChangesCount,
        fieldsAdded: diff.diffs.filter((d) => d.changeType === 'ADDED').map((d) => d.label),
        fieldsRemoved: diff.diffs.filter((d) => d.changeType === 'REMOVED').map((d) => d.label),
        fieldsModified: diff.diffs.filter((d) => d.changeType === 'MODIFIED').map((d) => d.label),
      },
      recommendedWinner,
      confidenceScore,
      recommendationReason,
    };
  }

  public exportRulesJSON(): string {
    return JSON.stringify(this.releases, null, 2);
  }

  public importRulesJSON(jsonString: string): { success: boolean; count: number; error?: string } {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed) && parsed[0]?.version && parsed[0]?.rules) {
        // It's a full API version releases array
        this.releases = parsed;
        const active = this.releases.find((r) => r.status === 'ACTIVE') || this.releases[0];
        this.activeVersionStr = active.version;
        this.saveState();
        return { success: true, count: parsed.length };
      } else if (Array.isArray(parsed)) {
        // It's a rules array - update active version
        const active = this.getActiveApiVersion();
        active.rules = parsed;
        this.saveState();
        return { success: true, count: parsed.length };
      }
      return { success: false, count: 0, error: 'Unrecognized JSON format' };
    } catch (err: any) {
      return { success: false, count: 0, error: err?.message || 'Invalid JSON syntax' };
    }
  }

  // =========================================================================
  // CONDITION EVALUATION ENGINE
  // =========================================================================

  public evaluateSingleCondition(cond: FieldCondition, formValues: Record<string, any>): boolean {
    const val = formValues[cond.field];

    switch (cond.operator) {
      case 'equals':
        return String(val ?? '').toLowerCase() === String(cond.value ?? '').toLowerCase();

      case 'notEquals':
        return String(val ?? '').toLowerCase() !== String(cond.value ?? '').toLowerCase();

      case 'in':
        if (Array.isArray(cond.value)) {
          return cond.value.map((v) => String(v).toLowerCase()).includes(String(val ?? '').toLowerCase());
        }
        return false;

      case 'notIn':
        if (Array.isArray(cond.value)) {
          return !cond.value.map((v) => String(v).toLowerCase()).includes(String(val ?? '').toLowerCase());
        }
        return true;

      // Numeric comparisons never match an empty value (Number('') would be 0)
      case 'greaterThan':
        return !isBlank(val) && Number(val) > Number(cond.value);

      case 'lessThan':
        return !isBlank(val) && Number(val) < Number(cond.value);

      case 'greaterThanOrEqual':
        return !isBlank(val) && Number(val) >= Number(cond.value);

      case 'lessThanOrEqual':
        return !isBlank(val) && Number(val) <= Number(cond.value);

      case 'contains':
        return String(val ?? '').toLowerCase().includes(String(cond.value ?? '').toLowerCase());

      case 'regex':
        try {
          const re = new RegExp(cond.value);
          return re.test(String(val ?? ''));
        } catch {
          return false;
        }

      case 'isTrue':
        return val === true || val === 'true' || val === 1 || val === '1' || val === 'Y';

      case 'isFalse':
        return val === false || val === 'false' || val === 0 || val === '0' || val === 'N';

      case 'isEmpty':
        return val === undefined || val === null || String(val).trim() === '';

      case 'isNotEmpty':
        return val !== undefined && val !== null && String(val).trim() !== '';

      default:
        return true;
    }
  }

  public evaluateCompoundCondition(
    condition: CompoundCondition | FieldCondition,
    formValues: Record<string, any>
  ): boolean {
    if (!condition) return true;

    if ('field' in condition && 'operator' in condition) {
      return this.evaluateSingleCondition(condition as FieldCondition, formValues);
    }

    const compound = condition as CompoundCondition;
    if (!compound.conditions || compound.conditions.length === 0) return true;

    const isOr = compound.logicalOperator === 'OR';

    if (isOr) {
      return compound.conditions.some((child) => this.evaluateCompoundCondition(child, formValues));
    } else {
      return compound.conditions.every((child) => this.evaluateCompoundCondition(child, formValues));
    }
  }

  // =========================================================================
  // DYNAMIC UI LOGIC & VALIDATION EVALUATION
  // =========================================================================

  public evaluateVisibility(rule: CustomFieldRuleDefinition, formValues: Record<string, any>): boolean {
    if (!rule.active) return false;
    if (!rule.uiLogic?.visibleIf) return true;
    return this.evaluateCompoundCondition(rule.uiLogic.visibleIf, formValues);
  }

  public evaluateDisabled(rule: CustomFieldRuleDefinition, formValues: Record<string, any>): boolean {
    if (!rule.active) return true;
    if (!rule.uiLogic?.disabledIf) return false;
    return this.evaluateCompoundCondition(rule.uiLogic.disabledIf, formValues);
  }

  public evaluateIsRequired(rule: CustomFieldRuleDefinition, formValues: Record<string, any>): boolean {
    if (!rule.active) return false;
    if (rule.validation?.required) return true;
    if (rule.validation?.requiredIf) {
      return this.evaluateCompoundCondition(rule.validation.requiredIf, formValues);
    }
    return false;
  }

  public resolveMappedDisplayValue(rule: CustomFieldRuleDefinition, rawValue: any): string {
    const rawStr = String(rawValue ?? '');
    if (rule.uiLogic?.valueMapping && rule.uiLogic.valueMapping[rawStr]) {
      return rule.uiLogic.valueMapping[rawStr];
    }
    return rawStr;
  }

  public validateField(
    rule: CustomFieldRuleDefinition,
    value: any,
    formValues: Record<string, any>
  ): FieldValidationResult {
    const errors: string[] = [];
    const isVisible = this.evaluateVisibility(rule, formValues);

    if (!isVisible) {
      return { isValid: true, errors: [], fieldKey: rule.key };
    }

    const isRequired = this.evaluateIsRequired(rule, formValues);
    const isEmpty = value === undefined || value === null || String(value).trim() === '';

    // Required check
    if (isRequired && isEmpty) {
      errors.push(
        rule.validation?.requiredMessage ||
          `${rule.dealerDisplayLabel || rule.label} is required`
      );
    }

    if (isEmpty) {
      return {
        isValid: errors.length === 0,
        errors,
        fieldKey: rule.key,
      };
    }

    // Regex check
    if (rule.validation?.regex) {
      try {
        const { pattern, flags = '', message } = rule.validation.regex;
        const re = new RegExp(pattern, flags);
        if (!re.test(String(value))) {
          errors.push(message || `Invalid format for ${rule.dealerDisplayLabel || rule.label}`);
        }
      } catch (err) {
        console.error('Invalid regex in rule definition:', rule.key, err);
      }
    }

    // Range check
    if (rule.validation?.range && (rule.widgetType === 'number' || typeof value === 'number')) {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push(`${rule.dealerDisplayLabel || rule.label} must be a valid number`);
      } else {
        const { min, max, minMessage, maxMessage } = rule.validation.range;
        if (min !== undefined && num < min) {
          errors.push(minMessage || `Value must be at least ${min}`);
        }
        if (max !== undefined && num > max) {
          errors.push(maxMessage || `Value cannot exceed ${max}`);
        }
      }
    }

    // Date range check
    if (rule.validation?.dateRange && rule.widgetType === 'date') {
      // Parse as a local calendar date: new Date('YYYY-MM-DD') is UTC midnight, which is
      // 05:30 IST and would make "max: today" reject today's date.
      const dateVal = parseDateTime(String(value));
      dateVal.setHours(0, 0, 0, 0);
      if (isNaN(dateVal.getTime())) {
        errors.push(`Invalid date format for ${rule.dealerDisplayLabel || rule.label}`);
      } else {
        const { minDate, maxDate, minDateMessage, maxDateMessage } = rule.validation.dateRange;

        if (minDate) {
          const resolvedMin = this.resolveRelativeDate(minDate);
          if (dateVal < resolvedMin) {
            errors.push(minDateMessage || `Date cannot be earlier than ${resolvedMin.toISOString().split('T')[0]}`);
          }
        }

        if (maxDate) {
          const resolvedMax = this.resolveRelativeDate(maxDate);
          if (dateVal > resolvedMax) {
            errors.push(maxDateMessage || `Date cannot be later than ${resolvedMax.toISOString().split('T')[0]}`);
          }
        }
      }
    }

    // LOV check
    if (rule.validation?.allowedValues && rule.validation.allowedValues.length > 0) {
      if (!rule.validation.allowedValues.includes(String(value))) {
        errors.push(
          rule.validation.allowedValuesMessage ||
            `Value must be one of: ${rule.validation.allowedValues.join(', ')}`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      fieldKey: rule.key,
    };
  }

  public validateAll(
    rules: CustomFieldRuleDefinition[],
    formValues: Record<string, any>
  ): FormValidationResult {
    const errors: Record<string, string[]> = {};
    let errorCount = 0;

    for (const rule of rules) {
      const fieldVal = formValues[rule.key];
      const res = this.validateField(rule, fieldVal, formValues);
      if (!res.isValid) {
        errors[rule.key] = res.errors;
        errorCount += res.errors.length;
      }
    }

    return {
      isValid: errorCount === 0,
      errors,
      errorCount,
    };
  }

  private resolveRelativeDate(dateStr: string): Date {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (dateStr === 'today') {
      return now;
    }

    const matchPlus = dateStr.match(/^today\+(\d+)d$/);
    if (matchPlus) {
      const days = parseInt(matchPlus[1], 10);
      const res = new Date(now);
      res.setDate(res.getDate() + days);
      return res;
    }

    const matchMinus = dateStr.match(/^today-(\d+)d$/);
    if (matchMinus) {
      const days = parseInt(matchMinus[1], 10);
      const res = new Date(now);
      res.setDate(res.getDate() - days);
      return res;
    }

    const parsed = parseDateTime(dateStr);
    if (isNaN(parsed.getTime())) return now;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }
}

// Export singleton instance
export const rulesEngineService = new RulesEngineService();
