import { describe, it, expect } from 'vitest';
import { RECEIVED_BA_MASTERS, RECEIVED_MODULE_CODES } from '../receivedBaMasters';
import { CONFIRMED_BA_MASTERS, CONFIRMED_MODULE_CODES } from '../confirmedBaMasters';
import { MASTER_COLLECTIONS, WORKSHOP_MODULES } from '../masterCatalogue';

describe('masters received from a BA but not yet confirmed as final', () => {
  it('are 10 masters, 50 fields and 52 rows, with unique ids', () => {
    expect(RECEIVED_BA_MASTERS).toHaveLength(10);
    expect(new Set(RECEIVED_BA_MASTERS.map((m) => m.id)).size).toBe(10);
    expect(RECEIVED_BA_MASTERS.reduce((n, m) => n + m.fields, 0)).toBe(50);
    expect(RECEIVED_BA_MASTERS.reduce((n, m) => n + m.rows, 0)).toBe(52);
  });

  it('belong to known modules that the BA has not confirmed', () => {
    const modules = WORKSHOP_MODULES.map((m) => m.code);
    RECEIVED_BA_MASTERS.forEach((m) => expect(modules).toContain(m.moduleCode));
    expect(RECEIVED_MODULE_CODES.sort()).toEqual(['appointment', 'jc_tracking']);
    RECEIVED_MODULE_CODES.forEach((c) => expect(CONFIRMED_MODULE_CODES).not.toContain(c));
    expect(CONFIRMED_BA_MASTERS.some((c) => RECEIVED_MODULE_CODES.includes(c.moduleCodes[0]))).toBe(false);
  });

  it('are not in the portal yet, and every overlap names a master that exists in the portal', () => {
    const portalIds = new Set(MASTER_COLLECTIONS.map((m) => m.id));
    RECEIVED_BA_MASTERS.forEach((m) => {
      expect(portalIds.has(m.id)).toBe(false);
      m.overlapsWith.forEach((id) => expect(portalIds.has(id), `${m.id} overlaps with unknown master ${id}`).toBe(true));
    });
  });
});
