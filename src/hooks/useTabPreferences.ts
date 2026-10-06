import { useCallback, useMemo } from 'react';
import { scopedKey, usePreferenceStore } from './usePreferenceStore';
import { MIN_VISIBLE_TABS, TabPreference, moveItem, normalizeTabPreference, setTabVisible, splitTabs } from '../utils/viewPreferences';

export const TAB_PREF_STORAGE_KEY = 'user_pref_tabs';
export const CARD_PREF_STORAGE_KEY = 'user_pref_cards';

export interface TabDef {
  id: string;
  label: string;
  /** Count shown on the tab (kept on tabs collapsed into "More"). */
  badge?: number;
  /** Colour of the count, as in the BU design. */
  tone?: 'blue' | 'purple' | 'amber' | 'red' | 'green';
}

interface Options {
  userId: string;
  roleId: string;
  tabs: TabDef[];
  /** Preset for the role, used until the user saves their own layout. */
  roleDefault: TabPreference;
  /** How many visible tabs fit inline before the rest collapse into "More (n)". */
  maxInline?: number;
  /** Storage base key; landing-page cards use "user_pref_cards". */
  storageKey?: string;
}

/** Tab visibility, order and default landing tab per user + role, for the login session (admin defaults otherwise). */
export function useTabPreferences({ userId, roleId, tabs, roleDefault, maxInline = 6, storageKey = TAB_PREF_STORAGE_KEY }: Options) {
  const store = usePreferenceStore<TabPreference>(scopedKey(storageKey, userId, roleId));
  const tabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);
  const pref = useMemo(() => normalizeTabPreference(store.value, tabIds, roleDefault), [store.value, tabIds, roleDefault]);
  const byId = useMemo(() => new Map(tabs.map((t) => [t.id, t])), [tabs]);
  const { inline, overflow } = splitTabs(pref, maxInline);
  const toTabs = (ids: string[]) => ids.map((id) => byId.get(id)!).filter(Boolean);

  const setVisible = useCallback(
    (id: string, visible: boolean): boolean => {
      const next = setTabVisible(pref, id, visible);
      if (!next) return false;
      store.save(next);
      return true;
    },
    [pref, store],
  );

  return {
    preference: pref,
    orderedTabs: toTabs(pref.tabOrder),
    inlineTabs: toTabs(inline),
    moreTabs: toTabs(overflow),
    isHidden: (id: string) => pref.hiddenTabs.includes(id),
    defaultLandingTab: pref.defaultLandingTab,
    minVisible: MIN_VISIBLE_TABS,
    /** False when hiding would leave fewer than the minimum visible tabs. */
    setVisible,
    move: (id: string, direction: -1 | 1) => store.save({ ...pref, tabOrder: moveItem(pref.tabOrder, id, direction) }),
    setDefaultLanding: (id: string) => {
      if (!pref.hiddenTabs.includes(id)) store.save({ ...pref, defaultLandingTab: id });
    },
    reset: () => store.save(normalizeTabPreference(null, tabIds, roleDefault)),
  };
}
