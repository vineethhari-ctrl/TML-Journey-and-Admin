import { describe, it, expect } from 'vitest';
import { MASTER_COLLECTIONS } from '../masterCatalogue';
import { CONFIRMED_BA_MASTERS, baStatusOf } from '../confirmedBaMasters';

describe('masters confirmed by the BA', () => {
  it('lists 9 eQC and 2 Bodyshop masters', () => {
    expect(CONFIRMED_BA_MASTERS.filter((c) => c.module === 'eQC')).toHaveLength(9);
    expect(CONFIRMED_BA_MASTERS.filter((c) => c.module === 'Bodyshop')).toHaveLength(2);
  });
  it('only points at masters that exist in the portal', () => {
    const ids = new Set(MASTER_COLLECTIONS.map((m) => m.id));
    CONFIRMED_BA_MASTERS.flatMap((c) => c.portalMasterIds).forEach((id) => expect(ids.has(id)).toBe(true));
  });
  it('knows which confirmed masters are not in the portal yet', () => {
    expect(CONFIRMED_BA_MASTERS.filter((c) => !c.portalMasterIds.length).map((c) => c.name)).toEqual([
      'Bodyshop Checklist (eQC)', 'Washing Checklist', 'Washing Job Code Master', 'VCI / OBD Exceptions',
    ]);
  });
  it('status: confirmed, not in the BA-confirmed list (eQC / Bodyshop), or waiting', () => {
    const m = (id: string) => MASTER_COLLECTIONS.find((x) => x.id === id)!;
    expect(baStatusOf(m('eqc_general_checklist'))).toBe('Confirmed by BA');
    expect(baStatusOf(m('torque_verification_standards'))).toBe('Not in the BA-confirmed list');
    expect(baStatusOf(m('paint_booth_schedule'))).toBe('Not in the BA-confirmed list');
    expect(baStatusOf(m('thd_users'))).toBe('Waiting for BA');
  });
});
