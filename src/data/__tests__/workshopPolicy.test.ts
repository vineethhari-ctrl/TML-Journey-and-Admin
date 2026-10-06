import { describe, it, expect } from 'vitest';
import { DEFAULT_COLUMNS, DEFAULT_WORKSHOP_POLICY, GRID_COLUMNS, WORKSHOP_TABS, policyForRole } from '../workshopPolicy';
import { normalizeColumnPreference, normalizeTabPreference } from '../../utils/viewPreferences';

const TAB_IDS = WORKSHOP_TABS.map((t) => t.id);

describe('built-in workshop policy', () => {
  it('every role default is valid: allowed tabs exist, landing tab visible, at least 2 visible', () => {
    Object.entries(DEFAULT_WORKSHOP_POLICY).forEach(([role, p]) => {
      p.allowedTabs.forEach((t) => expect(TAB_IDS, role).toContain(t));
      const n = normalizeTabPreference(null, p.allowedTabs, p.tabs);
      expect(n, role).toEqual(normalizeTabPreference(p.tabs, p.allowedTabs, p.tabs));
      expect(n.hiddenTabs, role).not.toContain(n.defaultLandingTab);
      expect(n.tabOrder.filter((t) => !n.hiddenTabs.includes(t)).length, role).toBeGreaterThanOrEqual(2);
    });
  });

  it('the Service Advisor default is the spec example', () => {
    const sa = policyForRole(DEFAULT_WORKSHOP_POLICY, 'serviceAdvisor').tabs;
    expect(sa.defaultLandingTab).toBe('my_assignment');
    expect(sa.hiddenTabs).toEqual(['thd', 'additional_jobs', 'quality_inspection']);
  });

  it('unknown roles fall back to the default policy', () => {
    expect(policyForRole(DEFAULT_WORKSHOP_POLICY, 'someNewRole')).toBe(DEFAULT_WORKSHOP_POLICY.default);
  });

  it('default columns cover every grid column exactly once (visible or hidden pool)', () => {
    Object.entries(GRID_COLUMNS).forEach(([grid, cols]) => {
      const keys = cols.map((c) => c.key);
      const p = DEFAULT_COLUMNS[grid];
      expect([...p.visibleColumns, ...p.hiddenColumns].sort(), grid).toEqual([...keys].sort());
      expect(normalizeColumnPreference(null, keys, p).visibleColumns, grid).toEqual(p.visibleColumns);
    });
  });
});
