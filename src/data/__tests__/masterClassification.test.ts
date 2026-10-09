import { describe, it, expect } from 'vitest';
import { MASTER_COLLECTIONS } from '../masterCatalogue';
import { CLASS_LABEL, draftClassification, proposedIntegration, proposedSystemOfRecord } from '../masterClassification';

describe('draft master classification', () => {
  it('gives every master a class with a reason', () => {
    MASTER_COLLECTIONS.forEach((m) => {
      const d = draftClassification(m);
      expect(Object.keys(CLASS_LABEL)).toContain(d.masterClass);
      expect(d.basis.length).toBeGreaterThan(10);
    });
  });
  it('PL / PPL is a CRM master with business control (stated in the mail); the common LOV master is decided per list', () => {
    expect(draftClassification({ id: 'ppl_master' }).masterClass).toBe('C');
    expect(draftClassification({ id: 'common_lov' }).masterClass).toBe('TBC');
  });
  it('a master of a new module defaults to a new ST master, kept in the ST Portal with no CRM integration', () => {
    const d = draftClassification({ id: 'eqc_gc_steps' });
    expect(d.masterClass).toBe('B');
    expect(proposedSystemOfRecord(d.masterClass)).toBe('ST Portal');
    expect(proposedIntegration(d.masterClass)).toBe('None');
  });
});
