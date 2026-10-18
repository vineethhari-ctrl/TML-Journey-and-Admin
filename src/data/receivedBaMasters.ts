/**
 * Masters a BA has SENT but NOT confirmed as final (so they are not in CONFIRMED_BA_MASTERS).
 *  - Bay Operations: "Workshop Bay Operations Master Definition Workbook" from the Bay Operations BA, received 18 Oct 2026.
 *    10 masters, 50 fields, 52 rows. It passes the portal's workbook import with no errors or warnings.
 * Only the definitions (names, owner, counts) are kept here; the rows stay in the BA's file. Test data only.
 */
export interface ReceivedMaster {
  id: string;
  name: string;
  moduleCode: string;
  owner: 'TML_ADMIN' | 'DEALER_ADMIN';
  category: string;
  /** One line, in plain words. */
  about: string;
  fields: number;
  rows: number;
  /** Existing (draft) portal masters this one overlaps with: the BA must say which to keep. */
  overlapsWith: string[];
}

export const RECEIVED_SOURCE = 'Workshop Bay Operations Master Definition Workbook (received 18 Oct 2026, not yet confirmed as final)';

export const RECEIVED_BA_MASTERS: ReceivedMaster[] = [
  { id: 'bay_type_lov_master', name: 'Bay Type LOV Master', moduleCode: 'jc_tracking', owner: 'TML_ADMIN', category: 'Bay Configuration', about: 'The bay types and whether a bay type is shared (common).', fields: 5, rows: 7, overlapsWith: ['bay_management_interactive'] },
  { id: 'bay_equipment_lov_master', name: 'Bay Equipment LOV Master', moduleCode: 'jc_tracking', owner: 'TML_ADMIN', category: 'Bay Configuration', about: 'Special tools and heavy equipment a bay can have.', fields: 4, rows: 7, overlapsWith: ['bay_management_interactive'] },
  { id: 'bay_lift_type_master', name: 'Bay Lift Type Master', moduleCode: 'jc_tracking', owner: 'TML_ADMIN', category: 'Bay Configuration', about: 'Lift options of a bay (2-post, 4-post, no lift).', fields: 3, rows: 3, overlapsWith: ['bay_management_interactive'] },
  { id: 'floor_level_master', name: 'Floor Level Master', moduleCode: 'jc_tracking', owner: 'TML_ADMIN', category: 'Workshop Layout', about: 'Floor levels of a workshop, with a floor code.', fields: 3, rows: 4, overlapsWith: ['bay_management_interactive'] },
  { id: 'technician_skill_level_master', name: 'Technician Skill Level Master', moduleCode: 'jc_tracking', owner: 'TML_ADMIN', category: 'Skill Management', about: 'Technician grades L0 to L2 and whether a grade can act as primary technician.', fields: 5, rows: 3, overlapsWith: ['skill_level_master', 'bay_technician'] },
  { id: 'service_skill_matrix_master', name: 'Service Job Skill Matrix Master', moduleCode: 'jc_tracking', owner: 'TML_ADMIN', category: 'Skill Management', about: 'What each grade can do, by type of service and complaint severity.', fields: 6, rows: 8, overlapsWith: ['service_type_master'] },
  { id: 'bay_skill_eligibility_master', name: 'Bay Skill Eligibility Master', moduleCode: 'jc_tracking', owner: 'TML_ADMIN', category: 'Bay Configuration', about: 'Which grades may work in which bay type, with the maximum technicians and supervisors.', fields: 6, rows: 6, overlapsWith: ['bay_technician'] },
  { id: 'appointment_slot_bay_master', name: 'Appointment Slot Bay Master', moduleCode: 'appointment', owner: 'TML_ADMIN', category: 'Appointment Configuration', about: 'How much of each bay type is offered for online booking, and how much is kept for fleet and walk-ins.', fields: 6, rows: 6, overlapsWith: ['time_slot_quotas_master'] },
  { id: 'workshop_shift_timing_master', name: 'Workshop Shift Timing Master', moduleCode: 'jc_tracking', owner: 'DEALER_ADMIN', category: 'Workshop Schedule', about: 'Shift hours and breaks.', fields: 7, rows: 3, overlapsWith: ['shift_master'] },
  { id: 'holiday_type_exception_master', name: 'Holiday Type & Exception Master', moduleCode: 'jc_tracking', owner: 'TML_ADMIN', category: 'Holiday Governance', about: 'Holiday categories, whether a bay may stay open, and the default working status.', fields: 5, rows: 5, overlapsWith: ['holiday_calendar_master'] },
];

/** Modules for which a first list has been received but not confirmed. */
export const RECEIVED_MODULE_CODES = [...new Set(RECEIVED_BA_MASTERS.map((m) => m.moduleCode))];
