import type { MasterConfig, MasterFieldDef } from './masterCatalogue';

/** Shared building blocks for masters transcribed from BA "LOV" sheets (value + Status + Order). */

export const STATUS_FIELD: MasterFieldDef = { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], mandatory: true, defaultValue: 'Active' };
export const ORDER_FIELD: MasterFieldDef = { key: 'order', label: 'Order', type: 'number', mandatory: true, validation: { min: 1, max: 99 }, description: 'Display order in the dropdown.' };

type Base = Pick<MasterConfig, 'owner' | 'logicalGroup' | 'moduleCode' | 'moduleName'>;

export interface LovSpec {
  id: string;
  /** Prefix of the row ids, e.g. "TOC" → TOC-01, TOC-02. */
  prefix: string;
  name: string;
  label: string;
  sheet: string;
  use: string;
  values: string[];
}

/** A dropdown list (LOV) master from one BA sheet. */
export const lovMaster = (base: Base, category: string, s: LovSpec): MasterConfig => ({
  ...base,
  id: s.id,
  name: s.name,
  category,
  description: `${s.use} (BA sheet "${s.sheet}"). Only Active values are shown, in Order.`,
  fields: [{ key: 'value', label: s.label, type: 'text', mandatory: true }, STATUS_FIELD, ORDER_FIELD],
  records: s.values.map((value, i) => ({ id: `${s.prefix}-${String(i + 1).padStart(2, '0')}`, value, status: 'Active', order: i + 1 })),
});
