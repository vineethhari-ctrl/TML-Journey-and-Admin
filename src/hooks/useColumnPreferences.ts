import { useMemo } from 'react';
import { scopedKey, usePreferenceStore } from './usePreferenceStore';
import { ColumnPreference, moveColumn, normalizeColumnPreference, setColumnVisible } from '../utils/viewPreferences';

export const COLUMN_PREF_STORAGE_KEY = 'user_pref_columns';

export interface ColumnDef<Row> {
  key: string;
  label: string;
  /** Cell renderer; defaults to the row value as text. */
  render?: (row: Row) => React.ReactNode;
  /** Holds customer PII (masked by DPDP rules, masked on export). */
  pii?: 'phone' | 'name' | 'email';
  align?: 'left' | 'right' | 'center';
}

type AllTabs = Record<string, ColumnPreference>;

interface Options<Row> {
  userId: string;
  roleId: string;
  /** Worklist / tab these columns belong to, e.g. "gate_in". */
  tabId: string;
  columns: ColumnDef<Row>[];
  /** Lean default: visible, hidden pool and pinned columns. */
  preset: ColumnPreference;
}

/** Per-list column visibility and order, with pinned columns and Reset to Default, for the login session. */
export function useColumnPreferences<Row>({ userId, roleId, tabId, columns, preset }: Options<Row>) {
  // One saved object holds every tab's layout: { gate_in: {...}, my_assignment: {...} }.
  const store = usePreferenceStore<AllTabs>(scopedKey(COLUMN_PREF_STORAGE_KEY, userId, roleId));
  const keys = useMemo(() => columns.map((c) => c.key), [columns]);
  const pref = useMemo(() => normalizeColumnPreference(store.value?.[tabId] ?? null, keys, preset), [store.value, tabId, keys, preset]);
  const byKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);
  const saveTab = (next: ColumnPreference) => store.save({ ...(store.value ?? {}), [tabId]: next });

  return {
    preference: pref,
    visibleColumns: pref.visibleColumns.map((k) => byKey.get(k)!).filter(Boolean),
    hiddenColumns: pref.hiddenColumns.map((k) => byKey.get(k)!).filter(Boolean),
    isPinned: (key: string) => pref.pinnedLeft.includes(key) || pref.pinnedRight.includes(key),
    /** False for pinned (mandatory) columns, which cannot be hidden. */
    setVisible: (key: string, visible: boolean): boolean => {
      const next = setColumnVisible(pref, key, visible);
      if (!next) return false;
      saveTab(next);
      return true;
    },
    move: (key: string, direction: -1 | 1) => saveTab(moveColumn(pref, key, direction)),
    reset: () => saveTab(normalizeColumnPreference(null, keys, preset)),
  };
}
