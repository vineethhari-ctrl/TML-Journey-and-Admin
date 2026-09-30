export type ImportMode = 'append' | 'upsert' | 'replace';

type Row = Record<string, any>;

const idOf = (r: Row) => (r.id === undefined || r.id === null ? '' : String(r.id).trim().toLowerCase());

/**
 * Applies bulk-imported rows to an existing master's records.
 * - replace: imported rows become the full record set
 * - upsert:  rows with a matching id update the existing record, others are added
 * - append:  imported rows are added in front of the existing ones
 * Rows without an id never match (so they can't overwrite an unrelated record).
 */
export function mergeImportedRecords(existing: Row[], imported: Row[], mode: ImportMode): Row[] {
  if (mode === 'replace') return [...imported];
  if (mode === 'append') return [...imported, ...existing];

  const importedById = new Map<string, Row>();
  imported.forEach((r) => {
    const id = idOf(r);
    if (id) importedById.set(id, r);
  });
  const existingIds = new Set(existing.map(idOf).filter(Boolean));
  const updated = existing.map((r) => {
    const id = idOf(r);
    // Keep the stored id spelling; the match itself is case-insensitive
    return id && importedById.has(id) ? { ...r, ...importedById.get(id), id: r.id } : r;
  });
  const brandNew = imported.filter((r) => !idOf(r) || !existingIds.has(idOf(r)));
  return [...brandNew, ...updated];
}
