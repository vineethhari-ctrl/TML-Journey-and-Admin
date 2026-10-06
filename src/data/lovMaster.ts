import type { MasterFieldDef } from './masterCatalogue';

/** Shared Status field (Active / Inactive). Dropdown lists themselves live in the Common LOV Master (commonLov.ts). */
export const STATUS_FIELD: MasterFieldDef = { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], mandatory: true, defaultValue: 'Active' };
