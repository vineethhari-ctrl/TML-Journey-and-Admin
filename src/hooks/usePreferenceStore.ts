import { useCallback, useEffect, useRef, useState } from 'react';
import { PREFS_CLEARED_EVENT, preferenceStorage, readPersonalisationSettings } from '../utils/personalisationSettings';

/**
 * A user preference kept in the browser first and saved to the backend in the background.
 *  - Reads are instant from browser storage (works offline and on first paint).
 *  - By default (BU rule) preferences last for the session only and are cleared at logout, so users return to the
 *    default view; when admins enable "keep after logout" they go to localStorage and `remote` (see personalisationSettings).
 *  - Writes update storage immediately, then call `remote.save` after a short debounce (only when kept after logout).
 *  - On mount, `remote.load` can replace the local value when the server copy is newer.
 */
export interface PreferenceRemote<T> {
  load: (key: string) => Promise<StoredPreference<T> | null>;
  save: (key: string, value: StoredPreference<T>) => Promise<void>;
}

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

export function usePreferenceStore<T>(key: string, remote?: PreferenceRemote<T>, debounceMs = 600) {
  const [pref, setPref] = useState<StoredPreference<T> | null>(() => read<T>(key));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'error'>('idle');

  // Key changes (another user / role): load that scope's local copy. Logout clears every layout.
  useEffect(() => {
    setPref(read<T>(key));
    const reload = () => setPref(read<T>(key));
    window.addEventListener(PREFS_CLEARED_EVENT, reload);
    return () => window.removeEventListener(PREFS_CLEARED_EVENT, reload);
  }, [key]);

  // Server copy wins when it is newer than the local one.
  useEffect(() => {
    if (!remote || !readPersonalisationSettings().keepAfterLogout) return;
    let cancelled = false;
    remote
      .load(key)
      .then((server) => {
        if (cancelled || !server) return;
        const local = read<T>(key);
        if (!local || server.updatedAt > local.updatedAt) {
          write(key, server);
          setPref(server);
        }
      })
      .catch(() => {
        // Offline or server error: keep the local copy.
      });
    return () => {
      cancelled = true;
    };
  }, [key, remote]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const save = useCallback(
    (value: T | null) => {
      const next = value === null ? null : { value, updatedAt: new Date().toISOString() };
      write(key, next);
      setPref(next);
      if (!remote || !next || !readPersonalisationSettings().keepAfterLogout) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setSyncState('saving');
        remote
          .save(key, next)
          .then(() => setSyncState('idle'))
          .catch(() => setSyncState('error'));
      }, debounceMs);
    },
    [key, remote, debounceMs],
  );

  return { value: pref?.value ?? null, save, syncState };
}
