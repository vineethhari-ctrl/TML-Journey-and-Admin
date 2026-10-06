import { useCallback, useEffect, useState } from 'react';

/**
 * Where users' personal layouts (tabs, landing cards, columns) are kept.
 *  - keepAfterLogout = false (default, BU instruction of 6 Oct 2026): layouts last for the session and every user is back
 *    on the default view after logging out.
 *  - keepAfterLogout = true: layouts are remembered across logins (and synced to the backend when it exists).
 * Admins switch this in Admin Portal → Workshop Tabs & Columns.
 */
export const PERSONALISATION_SETTINGS_KEY = 'tml_personalisation_settings_v1';
export const USER_PREF_PREFIX = 'user_pref_';
export const PREFS_CLEARED_EVENT = 'tml:prefs-cleared';
const SETTINGS_EVENT = 'tml:personalisation-settings';

export interface PersonalisationSettings {
  keepAfterLogout: boolean;
}

export function readPersonalisationSettings(): PersonalisationSettings {
  try {
    const raw = localStorage.getItem(PERSONALISATION_SETTINGS_KEY);
    return { keepAfterLogout: raw ? JSON.parse(raw).keepAfterLogout === true : false };
  } catch {
    return { keepAfterLogout: false };
  }
}

/** Browser storage for personal layouts under the current setting. */
export function preferenceStorage(): Storage | null {
  try {
    return readPersonalisationSettings().keepAfterLogout ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

/** Logout: drop every personal layout so the next login starts from the default view. */
export function clearPersonalisation() {
  for (const storage of [safe(() => sessionStorage), safe(() => localStorage)]) {
    if (!storage) continue;
    Object.keys(storage)
      .filter((k) => k.startsWith(USER_PREF_PREFIX))
      .forEach((k) => storage.removeItem(k));
  }
  window.dispatchEvent(new Event(PREFS_CLEARED_EVENT));
}

function safe<T>(get: () => T): T | null {
  try {
    return get();
  } catch {
    return null;
  }
}

export function usePersonalisationSettings() {
  const [settings, setSettings] = useState(readPersonalisationSettings);
  useEffect(() => {
    const reload = () => setSettings(readPersonalisationSettings());
    window.addEventListener(SETTINGS_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);
  const save = useCallback((next: PersonalisationSettings) => {
    try {
      localStorage.setItem(PERSONALISATION_SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: applies for this page view only.
    }
    setSettings(next);
    window.dispatchEvent(new Event(SETTINGS_EVENT));
    // Layouts now come from the other storage: let open screens re-read them.
    window.dispatchEvent(new Event(PREFS_CLEARED_EVENT));
  }, []);
  return { settings, save };
}
