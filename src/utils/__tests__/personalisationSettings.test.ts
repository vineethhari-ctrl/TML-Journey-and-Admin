import { describe, it, expect, beforeEach } from 'vitest';
import { clearPersonalisation, preferenceStorage } from '../personalisationSettings';

describe('personal layouts last for the login session', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('are kept in sessionStorage', () => {
    expect(preferenceStorage()).toBe(sessionStorage);
  });

  it('logout clears every user_pref_* layout (from both storages) and nothing else', () => {
    sessionStorage.setItem('user_pref_cards:U1:sa', '{}');
    localStorage.setItem('user_pref_columns:U1:sa', '{}');
    localStorage.setItem('tml_master_configs_v2', '[]');
    localStorage.setItem('tml_workshop_policy_v1', '{}');
    let fired = false;
    window.addEventListener('tml:prefs-cleared', () => (fired = true), { once: true });
    clearPersonalisation();
    expect(sessionStorage.getItem('user_pref_cards:U1:sa')).toBeNull();
    expect(localStorage.getItem('user_pref_columns:U1:sa')).toBeNull();
    expect(localStorage.getItem('tml_master_configs_v2')).toBe('[]');
    // the admin's default views are not personal layouts
    expect(localStorage.getItem('tml_workshop_policy_v1')).toBe('{}');
    expect(fired).toBe(true);
  });
});
