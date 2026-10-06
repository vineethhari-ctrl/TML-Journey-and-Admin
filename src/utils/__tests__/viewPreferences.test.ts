import { describe, it, expect } from 'vitest';
import { normalizeColumnPreference, normalizeTabPreference, moveColumn, moveItem, setColumnVisible, setTabVisible, splitTabs, TabPreference, ColumnPreference } from '../viewPreferences';

const TABS = ['gate_in', 'my_assignment', 'pre_inspection', 'estimate_approvals', 'active_job_cards', 'mr_details', 'thd', 'additional_jobs', 'quality_inspection'];
const SA: TabPreference = {
  defaultLandingTab: 'my_assignment',
  tabOrder: ['my_assignment', 'gate_in', 'pre_inspection', 'estimate_approvals', 'active_job_cards', 'mr_details'],
  hiddenTabs: ['thd', 'additional_jobs', 'quality_inspection'],
};

describe('tab preferences', () => {
  it('uses the role preset when nothing is saved, keeping every tab reachable', () => {
    const p = normalizeTabPreference(null, TABS, SA);
    expect(p.defaultLandingTab).toBe('my_assignment');
    expect(p.tabOrder).toHaveLength(9);
    expect(p.tabOrder.slice(0, 2)).toEqual(['my_assignment', 'gate_in']);
    expect(p.hiddenTabs).toEqual(['thd', 'additional_jobs', 'quality_inspection']);
  });

  it('keeps at least 2 tabs visible', () => {
    let p = normalizeTabPreference({ tabOrder: TABS, hiddenTabs: TABS.slice(1), defaultLandingTab: 'gate_in' }, TABS, SA);
    expect(p.tabOrder.filter((t) => !p.hiddenTabs.includes(t))).toHaveLength(2);
    expect(setTabVisible(p, 'gate_in', false)).toBeNull();
    p = setTabVisible(p, 'thd', true)!;
    expect(setTabVisible(p, 'gate_in', false)).not.toBeNull();
  });

  it('moves the landing tab when it is hidden, and ignores unknown or removed tabs', () => {
    const p = setTabVisible(normalizeTabPreference(null, TABS, SA), 'my_assignment', false)!;
    expect(p.defaultLandingTab).toBe('gate_in');
    const fromOld = normalizeTabPreference({ tabOrder: ['old_tab', 'gate_in'], hiddenTabs: ['old_tab'], defaultLandingTab: 'old_tab' }, TABS, SA);
    expect(fromOld.tabOrder).not.toContain('old_tab');
    expect(fromOld.defaultLandingTab).toBe('my_assignment');
  });

  it('a tab added in a later release takes its visibility from the role preset', () => {
    const saved = { tabOrder: ['gate_in', 'my_assignment'], hiddenTabs: [], defaultLandingTab: 'gate_in' };
    const p = normalizeTabPreference(saved, TABS, SA);
    expect(p.hiddenTabs).toEqual(['thd', 'additional_jobs', 'quality_inspection']);
    expect(p.tabOrder.slice(0, 2)).toEqual(['gate_in', 'my_assignment']);
  });

  it('collapses extra and hidden tabs into More', () => {
    const { inline, overflow } = splitTabs(normalizeTabPreference(null, TABS, SA), 4);
    expect(inline).toEqual(['my_assignment', 'gate_in', 'pre_inspection', 'estimate_approvals']);
    expect(overflow).toEqual(['active_job_cards', 'mr_details', 'thd', 'additional_jobs', 'quality_inspection']);
  });

  it('moves items within bounds', () => {
    expect(moveItem(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
  });
});

const GATE: ColumnPreference = {
  pinnedLeft: ['vehicleNo'],
  pinnedRight: ['action'],
  visibleColumns: ['vehicleNo', 'model', 'assignedSa', 'status', 'waitingTime', 'action'],
  hiddenColumns: ['customerSeverity', 'customerType', 'appointmentId', 'revisit'],
};
const KEYS = ['vehicleNo', 'model', 'assignedSa', 'status', 'waitingTime', 'action', 'customerSeverity', 'customerType', 'appointmentId', 'revisit'];

describe('column preferences', () => {
  it('starts from the lean preset with pinned columns at the edges', () => {
    const p = normalizeColumnPreference(null, KEYS, GATE);
    expect(p.visibleColumns).toEqual(['vehicleNo', 'model', 'assignedSa', 'status', 'waitingTime', 'action']);
    expect(p.hiddenColumns).toEqual(['customerSeverity', 'customerType', 'appointmentId', 'revisit']);
  });

  it('shows, hides and reorders unpinned columns; pinned columns cannot be hidden or moved', () => {
    let p = normalizeColumnPreference(null, KEYS, GATE);
    expect(setColumnVisible(p, 'vehicleNo', false)).toBeNull();
    p = setColumnVisible(p, 'revisit', true)!;
    expect(p.visibleColumns).toEqual(['vehicleNo', 'model', 'assignedSa', 'status', 'waitingTime', 'revisit', 'action']);
    p = moveColumn(p, 'revisit', -1);
    expect(p.visibleColumns.slice(-3)).toEqual(['revisit', 'waitingTime', 'action']);
    p = setColumnVisible(p, 'model', false)!;
    expect(p.hiddenColumns).toContain('model');
    expect(moveColumn(p, 'vehicleNo', 1)).toEqual(p);
  });

  it('a saved layout keeps pinning from the preset and survives new / removed columns', () => {
    const saved = { pinnedLeft: [], pinnedRight: [], visibleColumns: ['status', 'action', 'gone'], hiddenColumns: ['vehicleNo', 'model'] };
    const p = normalizeColumnPreference(saved, [...KEYS, 'newCol'], GATE);
    expect(p.visibleColumns[0]).toBe('vehicleNo');
    expect(p.visibleColumns.at(-1)).toBe('action');
    expect(p.visibleColumns).toContain('newCol');
    expect(p.visibleColumns).not.toContain('gone');
    expect(p.hiddenColumns).toContain('model');
  });
});
