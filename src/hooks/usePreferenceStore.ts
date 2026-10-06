import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A user preference kept in the browser first and saved to the backend in the background.
 *  - Reads are instant from localStorage (works offline and on first paint).
 *  - Writes update localStorage immediately, then call `remote.save` after a short debounce.
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
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredPreference<T>) : null;
  } catch {
    return null;
  }
};

const write = <T,>(key: string, pref: StoredPreference<T> | null) => {
  try {
    if (pref) localStorage.setItem(key, JSON.stringify(pref));
    else localStorage.removeItem(key);
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

  // Key changes (another user / role): load that scope's local copy.
  useEffect(() => {
    setPref(read<T>(key));
  }, [key]);

  // Server copy wins when it is newer than the local one.
  useEffect(() => {
    if (!remote) return;
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
      if (!remote || !next) return;
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
