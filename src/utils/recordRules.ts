import { EQC_RECORD_RULES } from './eqcRules';
import { BODYSHOP_RECORD_RULES } from './bodyshopRules';
import { THD_RECORD_RULES } from './thdRules';
import { CLAIM_RECORD_RULES } from './claimRules';
import { COMMON_LOV_RECORD_RULES } from './commonLov';

/** Cross-field business rules per master id (run on save and on BA workbook import). */
const RECORD_RULES: Record<string, (r: Record<string, any>) => Record<string, string>> = {
  ...EQC_RECORD_RULES,
  ...BODYSHOP_RECORD_RULES,
  ...THD_RECORD_RULES,
  ...CLAIM_RECORD_RULES,
  ...COMMON_LOV_RECORD_RULES,
};

export function validateMasterRecordRules(masterId: string, record: Record<string, any>): Record<string, string> {
  return RECORD_RULES[masterId]?.(record) ?? {};
}
