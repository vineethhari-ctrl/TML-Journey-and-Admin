import { describe, it, expect, beforeEach } from 'vitest';
import { clearPersonalisation, preferenceStorage, readPersonalisationSettings, PERSONALISATION_SETTINGS_KEY } from '../personalisationSettings';

describe('personalisation settings', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('defaults to reset-after-logout: layouts live in sessionStorage', () => {
    expect(readPersonalisationSettings()).toEqual({ keepAfterLogout: false });
    expect(preferenceStorage()).toBe(sessionStorage);
  });

  it('keeps layouts in localStorage when admins enable it', () => {
    localStorage.setItem(PERSONALISATION_SETTINGS_KEY, JSON.stringify({ keepAfterLogout: true }));
    expect(preferenceStorage()).toBe(localStorage);
  });

  it('logout clears every user_pref_* layout from both storages and nothing else', () => {
    sessionStorage.setItem('user_pref_cards:U1:sa', '{}');
    localStorage.setItem('user_pref_columns:U1:sa', '{}');
    localStorage.setItem('tml_master_configs_v2', '[]');
    let fired = false;
    window.addEventListener('tml:prefs-cleared', () => (fired = true), { once: true });
    clearPersonalisation();
    expect(sessionStorage.getItem('user_pref_cards:U1:sa')).toBeNull();
    expect(localStorage.getItem('user_pref_columns:U1:sa')).toBeNull();
    expect(localStorage.getItem('tml_master_configs_v2')).toBe('[]');
    expect(fired).toBe(true);
  });
});
