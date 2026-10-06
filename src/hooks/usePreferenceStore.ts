import { useCallback, useEffect, useState } from 'react';
import { PREFS_CLEARED_EVENT, preferenceStorage } from '../utils/personalisationSettings';

/**
 * A user's personal layout for the current login session (BU rule: back to the default view after logout).
 * Stored in sessionStorage, so it survives page reloads and is cleared at logout (see personalisationSettings).
 */
export interface StoredPreference<T> {
  value: T;
  updatedAt: string;
}

const read = <T,>(key: string): StoredPreference<T> | null => {
  try {
    const raw = preferenceStorage()?.getItem(key);
    return raw ? (JSON.parse(raw) as StoredPreference<T>) : null;
  } catch {
    return null;
  }
};

const write = <T,>(key: string, pref: StoredPreference<T> | null) => {
  try {
    const storage = preferenceStorage();
    if (pref) storage?.setItem(key, JSON.stringify(pref));
    else storage?.removeItem(key);
  } catch {
    // Storage full or blocked (private mode): the preference still works for this page view.
  }
};

/** Scope a storage key to the user and role, e.g. "user_pref_tabs:SA_1042:serviceAdvisor". */
export const scopedKey = (base: string, userId: string, roleId: string) => `${base}:${userId}:${roleId}`;

export function usePreferenceStore<T>(key: string) {
  const [pref, setPref] = useState<StoredPreference<T> | null>(() => read<T>(key));

  // Key changes (another user / role): load that scope's copy. Logout clears every layout.
  useEffect(() => {
    setPref(read<T>(key));
    const reload = () => setPref(read<T>(key));
    window.addEventListener(PREFS_CLEARED_EVENT, reload);
    return () => window.removeEventListener(PREFS_CLEARED_EVENT, reload);
  }, [key]);

  const save = useCallback(
    (value: T | null) => {
      const next = value === null ? null : { value, updatedAt: new Date().toISOString() };
      write(key, next);
      setPref(next);
    },
    [key],
  );

  return { value: pref?.value ?? null, save };
}
