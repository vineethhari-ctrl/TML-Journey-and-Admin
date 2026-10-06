import { describe, it, expect } from 'vitest';
import { duplicateMessage, findIdenticalRecord, nextRecordId } from '../recordDuplicates';

const fields = [{ key: 'id' }, { key: 'name' }, { key: 'bu' }] as any;
const rows = [{ id: 'X-001', name: 'Alpha', bu: 'PV' }, { id: 'X-002', name: 'Beta', bu: 'EV' }];

describe('duplicate records', () => {
  it('finds a row identical in every field except id (ignoring case and spaces)', () => {
    expect(findIdenticalRecord(fields, { id: 'X-003', name: ' alpha ', bu: 'pv' }, rows)?.id).toBe('X-001');
    expect(duplicateMessage(rows[0])).toMatch(/^Duplicate record cannot exist.*X-001/);
  });
  it('allows a row that differs in any field, and ignores itself', () => {
    expect(findIdenticalRecord(fields, { id: 'X-003', name: 'Alpha', bu: 'EV' }, rows)).toBeUndefined();
    expect(findIdenticalRecord(fields, rows[0], rows)).toBeUndefined();
  });
  it('proposes a free id for a copy', () => {
    expect(nextRecordId('xyz_master', rows)).toBe('XYZ-003');
    expect(nextRecordId('xyz_master', [...rows, { id: 'XYZ-003' }])).toBe('XYZ-004');
  });
});
