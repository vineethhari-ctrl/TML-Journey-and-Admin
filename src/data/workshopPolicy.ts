import { useCallback, useEffect, useState } from 'react';
import type { TabPreference, ColumnPreference } from '../utils/viewPreferences';
import { WORKSHOP_MODULES } from './masterCatalogue';

/**
 * Default views set by the TML admin (Admin Portal → Default Views), per role: landing cards, header tabs and the
 * default (lean) fields of each list across the pages (workshop worklists, TML Journey Search).
 * Users personalise within this policy; a tab not allowed for the role never appears, not even under "More".
 */

export type WorkshopTone = 'blue' | 'purple' | 'amber' | 'red' | 'green';

export interface WorkshopTab {
  id: string;
  label: string;
  tone: WorkshopTone;
}

/** The workflow tabs from the BU-accepted design, left to right. */
export const WORKSHOP_TABS: WorkshopTab[] = [
  { id: 'gate_in', label: "Today's Total Gate-In", tone: 'blue' },
  { id: 'my_assignment', label: 'My Assignment', tone: 'blue' },
  { id: 'pre_inspection', label: 'Pre Inspection', tone: 'purple' },
  { id: 'estimate_approvals', label: 'Pending Estimate Approvals', tone: 'purple' },
  { id: 'active_job_cards', label: 'My Active Job Cards', tone: 'amber' },
  { id: 'mr_details', label: 'MR Details', tone: 'red' },
  { id: 'thd', label: 'THD', tone: 'red' },
  { id: 'additional_jobs', label: 'Additional Jobs & Parts', tone: 'purple' },
  { id: 'quality_inspection', label: 'Quality Inspection', tone: 'amber' },
];

export interface GridColumn {
  key: string;
  label: string;
}

/** Every column each list can show (the full set in the BU screenshots); the policy picks the lean default. */
export const GRID_COLUMNS: Record<string, GridColumn[]> = {
  gate_in: [
    { key: 'action', label: 'Action' },
    { key: 'vehicleNo', label: 'Vehicle No.' },
    { key: 'model', label: 'Model' },
    { key: 'assignedSa', label: 'Assigned SA' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'maskedPhone', label: 'Phone No.' },
    { key: 'customerType', label: 'Customer Type' },
    { key: 'customerSeverity', label: 'Customer Severity' },
    { key: 'revisit', label: 'Revisit' },
    { key: 'criticalCustomer', label: 'Critical Customer' },
    { key: 'status', label: 'Status' },
    { key: 'waitingTime', label: 'Waiting Time (HH:MM)' },
    { key: 'workshopElapsed', label: 'Workshop Elapsed Time' },
    { key: 'appointmentId', label: 'Appointment ID' },
  ],
  my_assignment: [
    { key: 'action', label: 'Action' },
    { key: 'vehicleNo', label: 'Vehicle No.' },
    { key: 'model', label: 'Model' },
    { key: 'customerName', label: 'Customer Name' },
    { key: 'maskedPhone', label: 'Phone No.' },
    { key: 'customerType', label: 'Customer Type' },
    { key: 'customerSeverity', label: 'Customer Severity' },
    { key: 'revisit', label: 'Revisit' },
    { key: 'criticalCustomer', label: 'Critical Customer' },
    { key: 'status', label: 'Status' },
    { key: 'stageAging', label: 'Stage Aging (HH:MM)' },
    { key: 'workshopElapsed', label: 'Workshop Elapsed Time' },
    { key: 'visitorType', label: 'Visitor Type' },
    { key: 'vehicleType', label: 'Vehicle Type' },
  ],
  journey_search: [
    { key: 'vehicle', label: 'Vehicle' },
    { key: 'customer', label: 'Customer' },
    { key: 'jcNumber', label: 'JC Number' },
    { key: 'dealer', label: 'Dealer & Workshop' },
    { key: 'stage', label: 'Current Stage' },
    { key: 'status', label: 'Status' },
    { key: 'updated', label: 'Last Updated' },
    { key: 'action', label: 'Action' },
  ],
  mr_details: [
    { key: 'action', label: 'Action' },
    { key: 'requestId', label: 'Request ID' },
    { key: 'jcNo', label: 'JC No.' },
    { key: 'vehicleNo', label: 'Vehicle No.' },
    { key: 'status', label: 'Status' },
    { key: 'requestDateTime', label: 'Request Date & Time' },
    { key: 'stageAging', label: 'Stage Ageing DD:HH:MM' },
    { key: 'assignedTo', label: 'Assigned To' },
  ],
};

/** Landing-page cards: the 12 module cards of the BU home page, in BU order. */
export const LANDING_CARDS: Array<{ id: string; label: string }> = WORKSHOP_MODULES.map((m) => ({ id: m.code, label: m.title }));
const ALL_CARDS = LANDING_CARDS.map((c) => c.id);

export interface CardPolicy {
  /** Cards this role may see at all. */
  allowed: string[];
  /** Default card order and hidden cards until a user personalises. */
  layout: TabPreference;
}

const cardPolicy = (allowed: string[], hidden: string[] = []): CardPolicy => ({
  allowed,
  layout: { defaultLandingTab: allowed[0], tabOrder: allowed, hiddenTabs: hidden },
});

export interface RoleWorkshopPolicy {
  /** Landing-page cards (optional in saved policies from before cards existed). */
  cards?: CardPolicy;
  /** Tabs this role may use at all. */
  allowedTabs: string[];
  /** Default layout used until a user saves their own. */
  tabs: TabPreference;
  /** Lean default columns per grid tab. */
  columns: Record<string, ColumnPreference>;
}

export type WorkshopPolicy = Record<string, RoleWorkshopPolicy>;

const ALL_TABS = WORKSHOP_TABS.map((t) => t.id);

/** Lean column presets from the spec (TASK-03); secondary columns sit in the hidden pool. */
export const DEFAULT_COLUMNS: Record<string, ColumnPreference> = {
  gate_in: {
    pinnedLeft: ['vehicleNo'],
    pinnedRight: ['action'],
    visibleColumns: ['vehicleNo', 'model', 'assignedSa', 'status', 'waitingTime', 'action'],
    hiddenColumns: ['customerSeverity', 'customerType', 'appointmentId', 'revisit', 'customerName', 'maskedPhone', 'criticalCustomer', 'workshopElapsed'],
  },
  my_assignment: {
    pinnedLeft: ['action', 'vehicleNo'],
    pinnedRight: [],
    visibleColumns: ['action', 'vehicleNo', 'model', 'customerName', 'maskedPhone', 'status', 'stageAging', 'vehicleType'],
    hiddenColumns: ['customerType', 'customerSeverity', 'visitorType', 'revisit', 'criticalCustomer', 'workshopElapsed'],
  },
  journey_search: {
    pinnedLeft: ['vehicle'],
    pinnedRight: ['action'],
    visibleColumns: ['vehicle', 'customer', 'jcNumber', 'stage', 'status', 'action'],
    hiddenColumns: ['dealer', 'updated'],
  },
  mr_details: {
    pinnedLeft: ['action', 'requestId'],
    pinnedRight: [],
    visibleColumns: ['action', 'requestId', 'jcNo', 'vehicleNo', 'status', 'stageAging', 'assignedTo'],
    hiddenColumns: ['requestDateTime'],
  },
};

const generic: RoleWorkshopPolicy = {
  cards: cardPolicy(ALL_CARDS),
  allowedTabs: ALL_TABS,
  tabs: { defaultLandingTab: 'gate_in', tabOrder: ALL_TABS, hiddenTabs: [] },
  columns: DEFAULT_COLUMNS,
};

/** Built-in policy; the SA preset is the spec example. Roles not listed use `default`. */
export const DEFAULT_WORKSHOP_POLICY: WorkshopPolicy = {
  serviceAdvisor: {
    cards: cardPolicy(
      ['jc_creation', 'jc_tracking', 'appointment', 'receptionist', 'reception', 'bodyshop', 'eqc', 'thd', 'spd', 'claim', 'customer_journey', 'security'],
      ['security'],
    ),
    allowedTabs: ALL_TABS,
    tabs: {
      defaultLandingTab: 'my_assignment',
      tabOrder: ['my_assignment', 'gate_in', 'pre_inspection', 'estimate_approvals', 'active_job_cards', 'mr_details'],
      hiddenTabs: ['thd', 'additional_jobs', 'quality_inspection'],
    },
    columns: DEFAULT_COLUMNS,
  },
  receptionist: {
    cards: cardPolicy(['receptionist', 'appointment', 'reception', 'customer_journey']),
    allowedTabs: ['gate_in', 'my_assignment', 'pre_inspection'],
    tabs: { defaultLandingTab: 'gate_in', tabOrder: ['gate_in', 'my_assignment', 'pre_inspection'], hiddenTabs: [] },
    columns: DEFAULT_COLUMNS,
  },
  securityGuard: { ...generic, cards: cardPolicy(['security', 'customer_journey']) },
  driver: { ...generic, cards: cardPolicy(['reception', 'customer_journey']) },
  default: generic,
};

export const WORKSHOP_POLICY_STORAGE_KEY = 'tml_workshop_policy_v1';
const CHANGE_EVENT = 'tml:workshop-policy';

export const policyForRole = (policy: WorkshopPolicy, roleId: string): RoleWorkshopPolicy => {
  const p = policy[roleId] ?? policy.default ?? generic;
  return p.cards ? p : { ...p, cards: (DEFAULT_WORKSHOP_POLICY[roleId] ?? generic).cards };
};

function readPolicy(): WorkshopPolicy {
  try {
    const raw = localStorage.getItem(WORKSHOP_POLICY_STORAGE_KEY);
    return raw ? { ...DEFAULT_WORKSHOP_POLICY, ...(JSON.parse(raw) as WorkshopPolicy) } : DEFAULT_WORKSHOP_POLICY;
  } catch {
    return DEFAULT_WORKSHOP_POLICY;
  }
}

/** The admin policy, kept in sync across screens and browser tabs. */
export function useWorkshopPolicy() {
  const [policy, setPolicy] = useState<WorkshopPolicy>(readPolicy);
  useEffect(() => {
    const reload = () => setPolicy(readPolicy());
    window.addEventListener(CHANGE_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(CHANGE_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const saveRole = useCallback((roleId: string, rolePolicy: RoleWorkshopPolicy | null) => {
    const next = { ...readPolicy() };
    // null = back to the built-in policy for this role
    if (rolePolicy) next[roleId] = rolePolicy;
    else if (DEFAULT_WORKSHOP_POLICY[roleId]) next[roleId] = DEFAULT_WORKSHOP_POLICY[roleId];
    else delete next[roleId];
    try {
      const custom = Object.fromEntries(Object.entries(next).filter(([id, p]) => JSON.stringify(p) !== JSON.stringify(DEFAULT_WORKSHOP_POLICY[id])));
      localStorage.setItem(WORKSHOP_POLICY_STORAGE_KEY, JSON.stringify(custom));
    } catch {
      // Storage unavailable: the change still applies for this page view.
    }
    setPolicy(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { policy, saveRole };
}
