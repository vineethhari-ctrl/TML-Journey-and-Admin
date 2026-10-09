/**
 * Master lists the BA has CONFIRMED as final (update as more BAs confirm). Test data only.
 *  - eQC: "eQC Master Management Portal v11" (HTML), 9 masters.
 *  - Bodyshop: Bodyshop_Master.xlsx, "Master List" sheet, 2 masters (status Closed).
 * portalMasterIds = the masters in this portal that correspond to it today (empty = not in the portal yet).
 */
export interface ConfirmedMaster {
  module: 'eQC' | 'Bodyshop';
  moduleCodes: string[];
  name: string;
  source: string;
  /** Number of fields in the confirmed file. */
  fields: number;
  portalMasterIds: string[];
}

const EQC = 'eQC Master Management Portal v11 (HTML)';
const BS = 'Bodyshop_Master.xlsx';

export const CONFIRMED_BA_MASTERS: ConfirmedMaster[] = [
  { module: 'eQC', moduleCodes: ['eqc'], name: 'General Checklist', source: EQC, fields: 15, portalMasterIds: ['eqc_general_checklist'] },
  { module: 'eQC', moduleCodes: ['eqc'], name: 'Scheduled Checklist', source: EQC, fields: 17, portalMasterIds: ['eqc_schedule_checklist'] },
  { module: 'eQC', moduleCodes: ['eqc'], name: 'Bodyshop Checklist (eQC)', source: EQC, fields: 11, portalMasterIds: [] },
  { module: 'eQC', moduleCodes: ['eqc'], name: 'Washing Checklist', source: EQC, fields: 8, portalMasterIds: [] },
  { module: 'eQC', moduleCodes: ['eqc'], name: 'Washing Job Code Master', source: EQC, fields: 8, portalMasterIds: [] },
  { module: 'eQC', moduleCodes: ['eqc'], name: 'Guided Check & Road Test', source: EQC, fields: 8, portalMasterIds: ['eqc_gc_mandate', 'eqc_gc_steps'] },
  { module: 'eQC', moduleCodes: ['eqc'], name: 'VCI / OBD Exceptions', source: EQC, fields: 7, portalMasterIds: [] },
  { module: 'eQC', moduleCodes: ['eqc'], name: 'DID Threshold Mapping', source: EQC, fields: 11, portalMasterIds: ['eqc_did_thresholds'] },
  { module: 'eQC', moduleCodes: ['eqc'], name: 'PTD Risk Configuration', source: EQC, fields: 5, portalMasterIds: ['eqc_ptd_risk'] },
  { module: 'Bodyshop', moduleCodes: ['bodyshop'], name: 'Inventory Capture Master', source: BS, fields: 21, portalMasterIds: ['bs_inventory_sections', 'bs_inventory_checkpoints'] },
  { module: 'Bodyshop', moduleCodes: ['bodyshop'], name: 'Insurance Document Collection - Customer', source: BS, fields: 6, portalMasterIds: ['bs_insurance_documents'] },
];

/** Modules whose master list the BA has confirmed. */
export const CONFIRMED_MODULE_CODES = ['eqc', 'bodyshop'];

export type BaStatus = 'Confirmed by BA' | 'Not in the BA-confirmed list' | 'Waiting for BA';

/** Where a portal master stands with its BA. */
export function baStatusOf(master: { id: string; moduleCode: string }): BaStatus {
  if (CONFIRMED_BA_MASTERS.some((c) => c.portalMasterIds.includes(master.id))) return 'Confirmed by BA';
  return CONFIRMED_MODULE_CODES.includes(master.moduleCode) ? 'Not in the BA-confirmed list' : 'Waiting for BA';
}
