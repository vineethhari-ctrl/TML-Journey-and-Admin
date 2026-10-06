/**
 * Pure rules behind the tab and column preferences (used by useTabPreferences / useColumnPreferences).
 * Saved preferences are always normalised against the current tab / column list, so tabs or columns added
 * or removed in a release never break a user's saved layout.
 */

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

export const MIN_VISIBLE_TABS = 2;

export interface TabPreference {
  defaultLandingTab: string;
  tabOrder: string[];
  hiddenTabs: string[];
}

const unique = (ids: string[]) => [...new Set(ids)];

/** Fit a saved (or role-default) preference to the tabs that exist now. */
export function normalizeTabPreference(pref: Partial<TabPreference> | null, tabIds: string[], roleDefault: TabPreference): TabPreference {
  const base = pref ?? roleDefault;
  const known = new Set(tabIds);
  // Saved order first, then tabs the user has never seen, in the role-default order, then the rest.
  const order = unique([...(base.tabOrder ?? []), ...roleDefault.tabOrder, ...tabIds].filter((id) => known.has(id)));
  // A tab that is new since the preference was saved takes its visibility from the role default.
  const seen = new Set([...(base.tabOrder ?? []), ...(base.hiddenTabs ?? [])]);
  let hidden = unique([...(base.hiddenTabs ?? []), ...roleDefault.hiddenTabs.filter((id) => !seen.has(id))]).filter((id) => known.has(id));
  let visible = order.filter((id) => !hidden.includes(id));
  // Never fewer than the minimum: bring back the first hidden tabs in order.
  for (const id of order) {
    if (visible.length >= Math.min(MIN_VISIBLE_TABS, order.length)) break;
    if (hidden.includes(id)) {
      hidden = hidden.filter((h) => h !== id);
      visible = order.filter((o) => !hidden.includes(o));
    }
  }
  const landing = visible.includes(base.defaultLandingTab ?? '') ? base.defaultLandingTab! : visible.includes(roleDefault.defaultLandingTab) ? roleDefault.defaultLandingTab : visible[0] ?? '';
  return { defaultLandingTab: landing, tabOrder: order, hiddenTabs: hidden };
}

/** Show or hide a tab. Returns null when hiding would leave fewer than the minimum visible. */
export function setTabVisible(p: TabPreference, id: string, visible: boolean): TabPreference | null {
  const hidden = visible ? p.hiddenTabs.filter((h) => h !== id) : unique([...p.hiddenTabs, id]);
  const remaining = p.tabOrder.filter((t) => !hidden.includes(t));
  if (remaining.length < MIN_VISIBLE_TABS) return null;
  const defaultLandingTab = remaining.includes(p.defaultLandingTab) ? p.defaultLandingTab : remaining[0];
  return { ...p, hiddenTabs: hidden, defaultLandingTab };
}

/** Move an item one place up (-1) or down (+1) in a list. */
export function moveItem<T>(list: T[], item: T, direction: -1 | 1): T[] {
  const i = list.indexOf(item);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

/** Tabs shown inline and the ones collapsed into "More (n)": user-hidden tabs and anything beyond `maxInline`. */
export function splitTabs(p: TabPreference, maxInline: number): { inline: string[]; overflow: string[] } {
  const visible = p.tabOrder.filter((id) => !p.hiddenTabs.includes(id));
  const inline = visible.slice(0, Math.max(MIN_VISIBLE_TABS, maxInline));
  const overflow = [...visible.slice(inline.length), ...p.tabOrder.filter((id) => p.hiddenTabs.includes(id))];
  return { inline, overflow };
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

export interface ColumnPreference {
  pinnedLeft: string[];
  pinnedRight: string[];
  /** Order of the visible columns (pinned ones included). */
  visibleColumns: string[];
  hiddenColumns: string[];
}

/** Fit a saved (or default) column preference to the columns that exist now. Pinned columns are always visible. */
export function normalizeColumnPreference(pref: Partial<ColumnPreference> | null, columnKeys: string[], preset: ColumnPreference): ColumnPreference {
  const known = new Set(columnKeys);
  const keep = (ids: string[] | undefined) => unique((ids ?? []).filter((id) => known.has(id)));
  // Pinning is a property of the screen, not a user choice: always taken from the preset.
  const pinnedLeft = keep(preset.pinnedLeft);
  const pinnedRight = keep(preset.pinnedRight).filter((id) => !pinnedLeft.includes(id));
  const pinned = new Set([...pinnedLeft, ...pinnedRight]);
  const base = pref ?? preset;
  const seen = new Set([...(base.visibleColumns ?? []), ...(base.hiddenColumns ?? [])]);
  const hidden = keep([...(base.hiddenColumns ?? []), ...keep(preset.hiddenColumns).filter((id) => !seen.has(id))]).filter((id) => !pinned.has(id));
  // Columns nobody has placed yet (new in a release) default to visible unless the preset hides them.
  const middle = keep([...(base.visibleColumns ?? []), ...preset.visibleColumns, ...columnKeys]).filter((id) => !pinned.has(id) && !hidden.includes(id));
  return { pinnedLeft, pinnedRight, visibleColumns: [...pinnedLeft, ...middle, ...pinnedRight], hiddenColumns: hidden };
}

const middleOf = (p: ColumnPreference) => p.visibleColumns.filter((id) => !p.pinnedLeft.includes(id) && !p.pinnedRight.includes(id));
const withMiddle = (p: ColumnPreference, middle: string[]): ColumnPreference => ({ ...p, visibleColumns: [...p.pinnedLeft, ...middle, ...p.pinnedRight] });

/** Show or hide a column. Pinned (mandatory) columns cannot be hidden: returns null. */
export function setColumnVisible(p: ColumnPreference, key: string, visible: boolean): ColumnPreference | null {
  if (p.pinnedLeft.includes(key) || p.pinnedRight.includes(key)) return visible ? p : null;
  const middle = middleOf(p).filter((id) => id !== key);
  return withMiddle({ ...p, hiddenColumns: visible ? p.hiddenColumns.filter((h) => h !== key) : unique([...p.hiddenColumns, key]) }, visible ? [...middle, key] : middle);
}

/** Reorder a visible, unpinned column one place left (-1) or right (+1). */
export const moveColumn = (p: ColumnPreference, key: string, direction: -1 | 1): ColumnPreference => withMiddle(p, moveItem(middleOf(p), key, direction));
