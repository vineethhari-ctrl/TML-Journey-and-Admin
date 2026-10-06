/**
 * "Duplicate record cannot exist": a row whose values are all the same as another row (only the id differs) is refused.
 * Used when a row copied with Ctrl+B is saved without changing anything.
 */
import type { MasterFieldDef } from '../data/masterCatalogue';

type Rec = Record<string, any>;

export const DUPLICATE_RECORD_MESSAGE = 'Duplicate record cannot exist';

const same = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** The other row that has exactly the same value in every field (ignoring id), or undefined. */
export function findIdenticalRecord(fields: MasterFieldDef[], record: Rec, others: Rec[]): Rec | undefined {
  const keys = fields.map((f) => f.key).filter((k) => k !== 'id');
  if (!keys.length) return undefined;
  return others.find((o) => o.id !== record.id && keys.every((k) => same(o[k]) === same(record[k])));
}

export const duplicateMessage = (existing: Rec) => `${DUPLICATE_RECORD_MESSAGE}: this row is identical to ${existing.id}. Change at least one value.`;

/** Next free id for a copy of a row, in the master's own id style (e.g. PPL-003 → next number). */
export function nextRecordId(masterId: string, records: Rec[]): string {
  const ids = new Set(records.map((r) => String(r.id)));
  let id = '';
  for (let n = records.length + 1; !id || ids.has(id); n++) id = `${masterId.slice(0, 3).toUpperCase()}-${String(n).padStart(3, '0')}`;
  return id;
}
