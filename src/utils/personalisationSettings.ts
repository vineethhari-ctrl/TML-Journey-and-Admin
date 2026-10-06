/**
 * Personal layouts (tabs, landing cards, columns) last only for the login session (BU rule, confirmed 6 Oct 2026):
 * every user — dealer or TML — can personalise, and after logging out and back in sees the default view again.
 * The defaults themselves are set by the TML admin in Admin Portal → Default Views.
 */
export const USER_PREF_PREFIX = 'user_pref_';
export const PREFS_CLEARED_EVENT = 'tml:prefs-cleared';

/** Browser storage for personal layouts: the session only. */
export function preferenceStorage(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

/** Logout: drop every personal layout so the next login starts from the default view. */
export function clearPersonalisation() {
  for (const get of [() => sessionStorage, () => localStorage]) {
    let storage: Storage | null = null;
    try {
      storage = get();
    } catch {
      storage = null;
    }
    if (!storage) continue;
    Object.keys(storage)
      .filter((k) => k.startsWith(USER_PREF_PREFIX))
      .forEach((k) => storage!.removeItem(k));
  }
  window.dispatchEvent(new Event(PREFS_CLEARED_EVENT));
}
