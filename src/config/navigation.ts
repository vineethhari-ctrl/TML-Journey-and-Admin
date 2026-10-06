/** Single source of truth for navigable pages (used by the command palette and access fallbacks). */
export interface NavPage {
  route: string;
  label: string;
  group: 'Overview' | 'TML Journey' | 'Administration';
  keywords: string;
}

export const NAV_PAGES: NavPage[] = [
  { route: '/dashboard', label: 'Dashboard', group: 'Overview', keywords: 'home kpi overview metrics' },
  { route: '/journey', label: 'Journey Search', group: 'TML Journey', keywords: 'vehicle jc vin search track' },
  { route: '/journey/JC20260930001234', label: 'Vehicle Journey (Demo EV)', group: 'TML Journey', keywords: 'timeline demo mh01ab1234' },
  { route: '/journey?filter=delayed', label: 'Delayed Journeys', group: 'TML Journey', keywords: 'sla breach late' },
  { route: '/journey?filter=pending', label: 'Pending Actions', group: 'TML Journey', keywords: 'approval blocked waiting' },
  { route: '/workshop', label: 'Workshop Worklist (tabs, columns, DPDP)', group: 'TML Journey', keywords: 'gate-in my assignment worklist tabs columns dpdp mask phone privacy cti call vehicle image variant colour' },
  { route: '/journey?filter=in_workshop', label: 'Vehicles In Workshop', group: 'TML Journey', keywords: 'bay floor' },
  { route: '/admin/masters', label: 'Masters Maintenance', group: 'Administration', keywords: 'master data fields schema bay' },
  { route: '/admin/bay-approvals', label: 'Bay Approvals', group: 'Administration', keywords: 'bay approve reject network manager allocation inactive request' },
  { route: '/admin/masters-guide', label: 'BA Guide: Adding Masters', group: 'Administration', keywords: 'help guide template workbook import excel ba how to' },
  { route: '/admin/masters?open=smart-import', label: 'Smart Excel Import (BA Excel → masters)', group: 'Administration', keywords: 'upload excel ba sheet any format new master import xlsx auto detect' },
  { route: '/admin/masters?open=eqc', label: 'EQC Masters (Electronic Quality Check)', group: 'Administration', keywords: 'eqc quality check guided gc road test ptd risk did threshold checklist schedule' },
  { route: '/admin/masters?open=bodyshop', label: 'Bodyshop Masters', group: 'Administration', keywords: 'bodyshop inventory capture checkpoint section insurance document facility tools technician paint denting' },
  { route: '/admin/workshop-policy', label: 'Workshop Tabs & Columns (per role)', group: 'Administration', keywords: 'tabs columns worklist role default landing visible personalise preference policy' },
  { route: '/admin/audit?module=DPDP', label: 'DPDP Access Log', group: 'Administration', keywords: 'dpdp privacy pii unmask reveal who saw customer data phone audit' },
  { route: '/admin/users', label: 'Employee / Users', group: 'Administration', keywords: 'user employee staff create' },
  { route: '/admin/roles', label: 'Roles & Access', group: 'Administration', keywords: 'permission rbac matrix' },
  { route: '/admin/devices', label: 'Devices', group: 'Administration', keywords: 'device block trust' },
  { route: '/admin/sessions', label: 'Sessions', group: 'Administration', keywords: 'session logout terminate' },
  { route: '/admin/config', label: 'Configuration', group: 'Administration', keywords: 'settings timeout security' },
  { route: '/admin/audit', label: 'Audit Log', group: 'Administration', keywords: 'history trail export' },
];
