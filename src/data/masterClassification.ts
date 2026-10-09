/**
 * DRAFT classification of every master, for the master-data strategy (CRM vs ST Portal) of 8 Oct 2026.
 * Everything here is PROPOSED: the BA leads confirm or change it. Only PL / PPL is stated in the mail as a CRM master with business
 * control; the rest is a starting point so the BAs have something to correct instead of a blank sheet.
 *
 *  A  CRM master, used as it is: CRM is the System of Record, ST Portal reads it (Solar / API), read-only.
 *  B  New ST master: maintained in the ST Portal with administration and governance controls.
 *  C  CRM master with business control: CRM stays the source; Business enables / disables / configures records inside ST.
 *  TBC  Cannot tell from here; the BA lead decides.
 */
import type { MasterConfig } from './masterCatalogue';

export type MasterClass = 'A' | 'B' | 'C' | 'TBC';

export const CLASS_LABEL: Record<MasterClass, string> = {
  A: 'A · CRM master, used as it is (read-only in ST)',
  B: 'B · New ST master (maintained in ST Portal)',
  C: 'C · CRM master + business control in ST',
  TBC: 'To be confirmed by the BA lead',
};

export interface ClassificationDraft {
  masterClass: MasterClass;
  /** Short reason, so a BA can agree or disagree quickly. */
  basis: string;
  /** What the control layer is about (class C only; blank for the BA to fill otherwise). */
  controlHint?: string;
}

const draft = (masterClass: MasterClass, basis: string, controlHint?: string): ClassificationDraft => ({ masterClass, basis, controlHint });

const STATED = 'Stated in the 8 Oct mail: CRM master; Business may select which models are available in ST functions';
const ST_MODULE = 'Business master of a new Service Transformation module; no CRM equivalent known';
const DEALER_OPS = 'Dealer-level operating set-up of a new ST module; no CRM equivalent known';
const LIKELY_CRM = 'Enterprise reference data that probably already exists in CRM';

/** By master id; any master not listed is a new ST module master (B). */
const BY_ID: Record<string, ClassificationDraft> = {
  ppl_master: draft('C', STATED, 'Enable / disable models (PL, PPL) per ST functionality'),
  dealer_details_registry: draft('C', 'Mail names Dealers and Outlets as future control candidates; the dealer registry is normally owned by CRM', 'Enable / disable dealers and outlets per ST functionality'),
  complaint_codes: draft('TBC', 'Complaint codes may already exist in CRM as a reference master'),
  job_codes: draft('TBC', 'Job codes and FRT times normally live in CRM / DMS'),
  complaint_job_linkage: draft('B', 'ST linkage between complaint, job code and PPL; it refers to CRM data but the link itself is new'),
  model_checklists: draft('B', 'Model-specific checklists of the new tracking module; refers to PPL from CRM'),
  zone_region_master: draft('TBC', LIKELY_CRM),
  vehicle_colour_master: draft('TBC', LIKELY_CRM),
  uom_master: draft('TBC', LIKELY_CRM),
  tax_master: draft('TBC', LIKELY_CRM + ' (GST / HSN)'),
  service_type_master: draft('TBC', 'Service types may exist in CRM; ST may need extra types'),
  jc_status_master: draft('TBC', 'Job card statuses may exist in CRM; ST needs its own journey statuses'),
  department_master: draft('B', 'Employee master data of ST; no CRM equivalent known'),
  designation_master: draft('B', 'Employee master data of ST; no CRM equivalent known'),
  shift_master: draft('B', 'Workshop shifts for availability planning; no CRM equivalent known'),
  skill_master: draft('B', 'Skills for allocation; no CRM equivalent known'),
  skill_level_master: draft('B', 'Skill proficiency levels; no CRM equivalent known'),
  certification_master: draft('B', 'Certificates and validity; no CRM equivalent known'),
  document_type_master: draft('B', 'Document types of the ST modules'),
  notification_template_master: draft('B', 'Notification templates of the ST modules'),
  escalation_matrix_master: draft('B', 'Escalation matrix of the ST modules'),
  thd_users: draft('TBC', 'People master: source (HR / IAM / CRM) to be confirmed'),
  claim_shq_users: draft('TBC', 'People master: source (HR / IAM / CRM) to be confirmed'),
  bay_management_interactive: draft('B', DEALER_OPS),
  bay_division_summary: draft('B', DEALER_OPS),
  bodyshop_facility_master: draft('B', DEALER_OPS),
  holiday_calendar_master: draft('B', DEALER_OPS),
  time_slot_quotas_master: draft('B', DEALER_OPS),
  bay_technician: draft('B', DEALER_OPS),
  paint_booth_schedule: draft('B', DEALER_OPS),
  driver_transit_roster: draft('B', DEALER_OPS),
};

export function draftClassification(master: Pick<MasterConfig, 'id'>): ClassificationDraft {
  if (master.id === 'common_lov') return draft('TBC', 'Decide per list: lists coming from CRM are class A, lists created in ST are class B (see the LOV Types sheet)');
  return BY_ID[master.id] ?? draft('B', ST_MODULE);
}

/** Where the master would be read from, as a proposal. */
export const proposedSystemOfRecord = (c: MasterClass) => ({ A: 'CRM', B: 'ST Portal', C: 'CRM (source) + ST Portal (control)', TBC: 'To confirm' }[c]);
export const proposedIntegration = (c: MasterClass) => ({ A: 'Solar or API (to confirm)', B: 'None', C: 'Solar or API (to confirm)', TBC: 'To confirm' }[c]);
