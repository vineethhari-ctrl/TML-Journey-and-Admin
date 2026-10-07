import type { PlatformRoleId } from '../utils/roleAccess';

/**
 * Every role in the application, in one list: the portal view roles (what each user sees), the Roles & Access
 * permission roles, the dealer workshop roles and the TML back-office roles — with the skills and certificates each
 * role requires. Names of designations, skills and certificates follow the generic masters (genericMasters.ts).
 */

export type RoleGroup = 'Administration' | 'Dealer management' | 'Dealer front office' | 'Dealer workshop' | 'TML back office' | 'Read only';

export interface CatalogueRole {
  id: string;
  name: string;
  group: RoleGroup;
  side: 'TML' | 'Dealer' | 'Both';
  description: string;
  /** Portal view role (screens, tabs, cards) when the role has one. */
  platformRoleId?: PlatformRoleId;
  /** Name of the permission role in Roles & Access, used for its CRUD matrix and user count. */
  adminRoleName?: string;
  /** Designation (designation_master) a person in this role normally holds. */
  designation?: string;
  /** Modules (of the 12) this role works in. */
  modules: string[];
  requiredSkills: string[];
  requiredCerts: string[];
}

/** Service Advisor expertise: which jobs he or she can create and advise on. */
export const SA_EXPERTISE = ['Mechanical', 'Bodyshop', 'Both'] as const;
export type SaExpertise = (typeof SA_EXPERTISE)[number];
export const SA_EXPERTISE_SKILL: Record<SaExpertise, string[]> = { Mechanical: ['SA-MECH'], Bodyshop: ['SA-BODY'], Both: ['SA-MECH', 'SA-BODY'] };
export const SA_EXPERTISE_HELP: Record<SaExpertise, string> = {
  Mechanical: 'Creates and advises on mechanical / periodic service job cards.',
  Bodyshop: 'Creates and advises on bodyshop, accident and insurance job cards.',
  Both: 'Handles mechanical and bodyshop job cards.',
};

export const ROLE_CATALOGUE: CatalogueRole[] = [
  // ---- Administration
  { id: 'R-SUPER', name: 'Super Administrator', group: 'Administration', side: 'TML', platformRoleId: 'superAdmin', adminRoleName: 'Super Administrator', designation: 'Portal Administrator', description: 'Full governance across all modules, masters, users, roles, policies and audit.', modules: ['All modules'], requiredSkills: [], requiredCerts: [] },
  { id: 'R-ADMIN', name: 'Administrator', group: 'Administration', side: 'TML', adminRoleName: 'Administrator', designation: 'Portal Administrator', description: 'Day-to-day administration of users, masters and configuration.', modules: ['All modules'], requiredSkills: [], requiredCerts: [] },
  { id: 'R-NM', name: 'Network Manager', group: 'Administration', side: 'TML', designation: 'Network Manager', description: 'TML approver for additional bays and network changes; monitors dealer performance.', modules: ['JC Tracking', 'Customer Journey'], requiredSkills: [], requiredCerts: [] },
  // ---- Dealer management
  { id: 'R-DEALER-ADMIN', name: 'Dealer Admin', group: 'Dealer management', side: 'Dealer', platformRoleId: 'dealerAdmin', designation: 'Service Manager', description: 'Runs the dealership service operation: local staff, bays, calendar, dealer masters.', modules: ['Appointment', 'JC Creation', 'JC Tracking', 'Customer Journey'], requiredSkills: [], requiredCerts: [] },
  { id: 'R-DGM', name: 'DGM', group: 'Dealer management', side: 'Dealer', platformRoleId: 'dgm', designation: 'DGM Service', description: 'Supervises workshop performance, escalations, high-value estimates and audits.', modules: ['JC Tracking', 'Claims', 'Customer Journey'], requiredSkills: [], requiredCerts: [] },
  { id: 'R-DEALER-MGR', name: 'Dealer Manager', group: 'Dealer management', side: 'Dealer', adminRoleName: 'Dealer Manager', designation: 'Service Manager', description: 'Manages the dealership service department and its people.', modules: ['Appointment', 'JC Creation', 'JC Tracking', 'Claims'], requiredSkills: [], requiredCerts: [] },
  { id: 'R-WS-MGR', name: 'Workshop Manager', group: 'Dealer management', side: 'Dealer', adminRoleName: 'Workshop Manager', designation: 'Workshop Floor Manager', description: 'Allocates bays and technicians, watches turnaround and pauses on the floor.', modules: ['JC Tracking', 'THD', 'SPD', 'EQC'], requiredSkills: ['SAFE-FIRE'], requiredCerts: ['FIRE-1'] },
  // ---- Dealer front office
  { id: 'R-SA', name: 'Service Advisor', group: 'Dealer front office', side: 'Dealer', platformRoleId: 'serviceAdvisor', adminRoleName: 'Service Advisor', designation: 'Service Advisor', description: 'Greets the customer, creates the job card, estimates, tracks repair and hands over. Expertise: Mechanical, Bodyshop or Both.', modules: ['Appointment', 'JC Creation', 'JC Tracking', 'Bodyshop', 'Customer Journey'], requiredSkills: ['CUST-HND'], requiredCerts: [] },
  { id: 'R-RECEPT', name: 'Receptionist', group: 'Dealer front office', side: 'Dealer', platformRoleId: 'receptionist', designation: 'Service Advisor', description: 'Appointment desk, customer reception, courtesy services and gate coordination.', modules: ['Appointment', 'Receptionist', 'P&D / Reception'], requiredSkills: ['CUST-HND'], requiredCerts: [] },
  { id: 'R-SECURITY', name: 'Security Guard', group: 'Dealer front office', side: 'Dealer', platformRoleId: 'securityGuard', designation: 'Security Guard', description: 'Workshop gate: inward / outward vehicle log, checks and denial reasons.', modules: ['Security'], requiredSkills: ['SAFE-FIRE'], requiredCerts: ['FIRE-1'] },
  { id: 'R-DRIVER', name: 'Driver', group: 'Dealer front office', side: 'Dealer', platformRoleId: 'driver', designation: 'Pickup & Drop Driver', description: 'Pick & Drop customer vehicles, road tests and inter-bay movement.', modules: ['P&D / Reception', 'JC Tracking'], requiredSkills: [], requiredCerts: [] },
  { id: 'R-CRO', name: 'CRO (Telecaller)', group: 'Dealer front office', side: 'Both', platformRoleId: 'cro', designation: 'Customer Relations Officer', description: 'Outbound reminder calls and service feedback. Not configured in this release.', modules: ['Appointment', 'Customer Journey'], requiredSkills: ['CUST-HND'], requiredCerts: [] },
  // ---- Dealer workshop
  { id: 'R-TECH', name: 'Technician', group: 'Dealer workshop', side: 'Dealer', adminRoleName: 'Technician', designation: 'Technician', description: 'Carries out the repair work on the bay and records progress.', modules: ['JC Tracking', 'SPD'], requiredSkills: ['MECH-SUS', 'ELEC-BAS', 'SAFE-FIRE'], requiredCerts: ['FIRE-1'] },
  { id: 'R-EV-TECH', name: 'EV Technician (HV)', group: 'Dealer workshop', side: 'Dealer', designation: 'Technician', description: 'Works on EVs and high-voltage systems; needs HV safety certification.', modules: ['JC Tracking', 'EQC'], requiredSkills: ['EV-HV-01', 'SAFE-FIRE'], requiredCerts: ['HVS-1', 'EVT-1', 'FIRE-1'] },
  { id: 'R-MASTER-TECH', name: 'Master Technician', group: 'Dealer workshop', side: 'Dealer', designation: 'Master Technician', description: 'Diagnostics, THD escalations, coaching and job sign-off.', modules: ['JC Tracking', 'THD'], requiredSkills: ['DIAG-TDS', 'MECH-ENG', 'MECH-TRN', 'MECH-SUS', 'ELEC-BAS'], requiredCerts: ['DIAG-1', 'FIRE-1'] },
  { id: 'R-QI', name: 'Quality Inspector', group: 'Dealer workshop', side: 'Dealer', designation: 'Quality Inspector', description: 'Electronic quality check before delivery.', modules: ['EQC'], requiredSkills: ['QC-EQC'], requiredCerts: ['EQC-1'] },
  { id: 'R-PAINT', name: 'Paint Specialist', group: 'Dealer workshop', side: 'Dealer', designation: 'Paint Specialist', description: 'Bodyshop painting and colour matching.', modules: ['Bodyshop'], requiredSkills: ['PAINT-01'], requiredCerts: ['PAINT-1'] },
  { id: 'R-SPD', name: 'SPD Store Officer', group: 'Dealer workshop', side: 'Dealer', designation: 'Parts Store Officer', description: 'Issues spare parts to the bay and keeps inventory.', modules: ['SPD'], requiredSkills: ['PART-INV'], requiredCerts: [] },
  // ---- TML back office
  { id: 'R-CLAIMS-MGR', name: 'Claims Manager', group: 'TML back office', side: 'Both', adminRoleName: 'Claims Manager', designation: 'Claims Officer', description: 'Reviews and approves warranty, AMC and goodwill requests.', modules: ['Claims'], requiredSkills: [], requiredCerts: [] },
  { id: 'R-CLAIMS-OFF', name: 'Claims Officer', group: 'TML back office', side: 'Both', designation: 'Claims Officer', description: 'Raises and follows up claims.', modules: ['Claims'], requiredSkills: [], requiredCerts: [] },
  { id: 'R-THD-L1', name: 'Tech Executive L1 (THD)', group: 'TML back office', side: 'TML', designation: 'Master Technician', description: 'First-line technical help desk executive; assigned auto-triggered THD cases.', modules: ['THD'], requiredSkills: ['DIAG-TDS'], requiredCerts: ['DIAG-1'] },
  { id: 'R-THD-OTHER', name: 'RTSM / COC L2 / Plant / Product Reliability', group: 'TML back office', side: 'TML', description: 'Higher THD levels that follow up, investigate and close cases.', modules: ['THD'], requiredSkills: [], requiredCerts: [] },
  // ---- Read only
  { id: 'R-READONLY', name: 'Read Only', group: 'Read only', side: 'Both', adminRoleName: 'Read Only', description: 'Views data without changing anything.', modules: ['All modules'], requiredSkills: [], requiredCerts: [] },
];

export const ROLE_GROUPS: RoleGroup[] = ['Administration', 'Dealer management', 'Dealer front office', 'Dealer workshop', 'TML back office', 'Read only'];
