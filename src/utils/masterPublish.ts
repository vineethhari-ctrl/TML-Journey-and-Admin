/**
 * Sharing masters without a backend (prototype stop-gap):
 *  - Publish: the admin exports every master as one file (published-masters.json). Once that file is deployed with the app,
 *    everybody who opens the site sees those masters.
 *  - Send changes: a BA exports only the rows he or she added or changed, in the existing "Upload a Master" format, so the
 *    admin can check and import them with the normal Upload a Master page.
 * Plain, deterministic functions; no server and no AI.
 */
import * as XLSX from 'xlsx';
import type { MasterConfig } from '../data/masterCatalogue';

export const PUBLISHED_FILE = 'published-masters.json';

export interface PublishedMasters {
  /** Counts up with every publish; people with an older version are offered the new one. */
  version: number;
  publishedAt: string;
  publishedBy: string;
  note: string;
  masters: MasterConfig[];
}

export function buildPublished(masters: MasterConfig[], version: number, publishedBy: string, note: string, now: Date = new Date()): PublishedMasters {
  return { version, publishedAt: now.toISOString(), publishedBy, note, masters };
}

/** Reads a published file; returns undefined unless it really is one (a dev server may answer a missing file with a web page). */
export function parsePublished(text: string): PublishedMasters | undefined {
  try {
    const p = JSON.parse(text);
    if (!p || typeof p !== 'object' || !Number.isInteger(p.version) || p.version < 1 || !Array.isArray(p.masters) || p.masters.length === 0) return undefined;
    const ok = p.masters.every((m: any) => m && typeof m.id === 'string' && typeof m.name === 'string' && Array.isArray(m.fields) && Array.isArray(m.records));
    return ok ? (p as PublishedMasters) : undefined;
  } catch {
    return undefined;
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
// Fields that name a Common LOV list get their dropdown options filled in at run time, so those options are not a user change
const definitionOf = (m: MasterConfig) => ({
  name: m.name,
  owner: m.owner,
  category: m.category,
  logicalGroup: m.logicalGroup,
  moduleCode: m.moduleCode,
  description: m.description,
  fields: m.fields.map((f) => (f.lovCode ? { ...f, options: undefined } : f)),
  rules: m.rules ?? [],
});


export interface MasterChange {
  master: MasterConfig;
  isNew: boolean;
  /** Fields or rules changed (cannot travel as rows; use the BA workbook for these). */
  definitionChanged: boolean;
  added: Array<Record<string, any>>;
  changed: Array<Record<string, any>>;
  /** Ids no longer present (an unneeded row is made Inactive instead of deleted, so this is only a heads-up). */
  removedIds: string[];
}

/** What a user changed against the baseline: new masters, changed definitions, added / changed / removed rows. */
export function diffMasters(baseline: MasterConfig[], current: MasterConfig[]): MasterChange[] {
  const before = new Map(baseline.map((m) => [m.id, m]));
  const out: MasterChange[] = [];
  current.forEach((m) => {
    const old = before.get(m.id);
    if (!old) {
      out.push({ master: m, isNew: true, definitionChanged: false, added: m.records, changed: [], removedIds: [] });
      return;
    }
    const oldById = new Map(old.records.map((r) => [String(r.id), r]));
    const added = m.records.filter((r) => !oldById.has(String(r.id)));
    const changed = m.records.filter((r) => oldById.has(String(r.id)) && !same(oldById.get(String(r.id)), r));
    const nowIds = new Set(m.records.map((r) => String(r.id)));
    const removedIds = old.records.map((r) => String(r.id)).filter((id) => !nowIds.has(id));
    const definitionChanged = !same(definitionOf(old), definitionOf(m));
    if (added.length || changed.length || removedIds.length || definitionChanged) out.push({ master: m, isNew: false, definitionChanged, added, changed, removedIds });
  });
  return out;
}

const cell = (v: unknown) => (typeof v === 'boolean' ? (v ? 'Y' : 'N') : v ?? '');

/**
 * The "Send changes" workbook: one sheet per master, named after the master, in the template of that master (id column + field
 * labels) with only the added and changed rows. New masters have no id column, so Upload a Master detects them as new masters.
 */
export function buildChangesWorkbook(changes: MasterChange[], by: string, now: Date = new Date()): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const readme = [
    ['Changes to send for review'],
    [`Prepared by ${by} on ${now.toISOString().slice(0, 10)}`],
    [],
    ['How to use: open Upload a Master, drop this file, check the result and press Import. Rows with an existing id update that row;'],
    ['rows without an id are added. Test data only.'],
    [],
    ['Master', 'New master', 'Rows added', 'Rows changed', 'Rows removed (heads-up)', 'Fields or rules changed (send the BA workbook for these)'],
    ...changes.map((c) => [c.master.name, c.isNew ? 'Y' : '', c.added.length, c.changed.length, c.removedIds.length, c.definitionChanged ? 'Y' : '']),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(readme), 'README');
  changes
    .filter((c) => c.added.length + c.changed.length > 0)
    .forEach((c) => {
      const withId = !c.isNew;
      const header = [...(withId ? ['id'] : []), ...c.master.fields.map((f) => f.label)];
      const rows = [...c.added, ...c.changed].map((r) => [...(withId ? [r.id] : []), ...c.master.fields.map((f) => cell(r[f.key]))]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), c.master.id.slice(0, 31));
    });
  return wb;
}

/** True when the masters differ from the baseline (published or built-in): a new master, a changed definition or any changed row. */
export const hasLocalChanges = (baseline: MasterConfig[], current: MasterConfig[]) => diffMasters(baseline, current).length > 0;
