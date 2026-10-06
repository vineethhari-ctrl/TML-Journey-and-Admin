import { describe, it, expect } from 'vitest';
import { buildUnmaskAudit, canSeeFullName, maskEmail, maskName, maskPhone, sanitizeForExport } from '../dpdp';

describe('DPDP masking', () => {
  it('masks the first 6 digits of a 10-digit mobile, ignoring +91 and spaces', () => {
    expect(maskPhone('9820443540')).toBe('******3540');
    expect(maskPhone('+91 98201 43540')).toBe('******3540');
    expect(maskPhone('091-9820143540')).toBe('******3540');
    expect(maskPhone('')).toBe('');
    expect(maskPhone('123')).toBe('***');
  });

  it('masks names to initials with fixed-width stars and e-mails to the first letter', () => {
    expect(maskName('Test Customer Alpha')).toBe('T*** C*** A***');
    expect(maskName('  ravi  ')).toBe('R***');
    expect(maskEmail('test.user@example.com')).toBe('t***@example.com');
  });

  it('shows the full name only to the assigned SA', () => {
    const sa = { userId: 'TML-SA-4011', name: 'Test Advisor A' };
    expect(canSeeFullName(sa, { id: 'TML-SA-4011' })).toBe(true);
    expect(canSeeFullName(sa, { name: 'Test Advisor A' })).toBe(true);
    expect(canSeeFullName(sa, { id: 'TML-SA-4019', name: 'Test Advisor B' })).toBe(false);
    expect(canSeeFullName(sa, {})).toBe(false);
  });

  it('builds the unmask audit payload from the spec, without the revealed value', () => {
    const p = buildUnmaskAudit({ userId: 'SA_1042', vehicleRegNo: 'MH12TS0001', field: 'phone', at: new Date('2026-10-06T10:00:00Z') });
    expect(p).toEqual({ userId: 'SA_1042', vehicleRegNo: 'MH12TS0001', actionType: 'UNMASK_PII', field: 'phone', timestamp: '2026-10-06T10:00:00.000Z', sessionIp: 'server-stamped' });
  });

  it('masks PII in exports unless the supervisor permission is held', () => {
    const rows = [{ reg: 'MH12TS0001', customerName: 'Test Customer Alpha', customerMobile: '+91 90000 13540' }];
    expect(sanitizeForExport(rows, { customerName: 'name', customerMobile: 'phone' }, false)).toEqual([{ reg: 'MH12TS0001', customerName: 'T*** C*** A***', customerMobile: '******3540' }]);
    expect(sanitizeForExport(rows, { customerName: 'name', customerMobile: 'phone' }, true)).toBe(rows);
    expect(rows[0].customerName).toBe('Test Customer Alpha');
  });
});
