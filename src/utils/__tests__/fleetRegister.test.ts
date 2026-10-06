import { describe, it, expect } from 'vitest';
import {
  FleetVehicle,
  applyFleetUpload,
  canUploadFleet,
  classifyVehicle,
  normaliseChassis,
  parseFleetDate,
  previewFleetUpload,
} from '../fleetRegister';
import { DEFAULT_FLEET_REGISTER } from '../../data/fleetRegister';
import { generateInitialData } from '../../data/mockDataGenerator';

const v = (chassisNo: string, extra: Partial<FleetVehicle> = {}): FleetVehicle => ({
  chassisNo,
  fleetAccount: 'Test Fleet',
  validFrom: '',
  validTo: '',
  active: true,
  remarks: '',
  uploadedBy: 'u',
  uploadedAt: '2026-10-01T00:00:00.000Z',
  ...extra,
});

describe('fleet register — classification', () => {
  const register = [
    v('MAT700222K1000984'),
    v('MAT700555K1002460', { active: false }),
    v('MAT700999K1004428', { validFrom: '2026-11-01' }),
    v('MAT701332K1005904', { validTo: '2026-06-30' }),
  ];

  it('a listed, active, in-validity chassis is Fleet; anything else is Individual', () => {
    expect(classifyVehicle('MAT700222K1000984', register, '2026-10-06').category).toBe('FLEET');
    expect(classifyVehicle('mat700222k1000984', register, '2026-10-06').category).toBe('FLEET');
    expect(classifyVehicle('MAT624009K1234567', register, '2026-10-06')).toEqual({ category: 'INDIVIDUAL' });
  });

  it('inactive, not-yet-valid and expired rows are Individual with a reason', () => {
    for (const [chassis, reason] of [
      ['MAT700555K1002460', /inactive/],
      ['MAT700999K1004428', /from 2026-11-01/],
      ['MAT701332K1005904', /ended on 2026-06-30/],
    ] as const) {
      const c = classifyVehicle(chassis, register, '2026-10-06');
      expect(c.category).toBe('INDIVIDUAL');
      expect(c.reason).toMatch(reason);
    }
    // validity dates are inclusive
    expect(classifyVehicle('MAT701332K1005904', register, '2026-06-30').category).toBe('FLEET');
    expect(classifyVehicle('MAT700999K1004428', register, '2026-11-01').category).toBe('FLEET');
  });

  it('seed data uses only mock chassis numbers that exist in the demo vehicles', () => {
    const vins = new Set(generateInitialData().vehicles.map((x) => x.vin));
    DEFAULT_FLEET_REGISTER.vehicles.forEach((f) => expect(vins.has(f.chassisNo)).toBe(true));
    expect(vins.has('MAT624009K1234567')).toBe(true);
    expect(DEFAULT_FLEET_REGISTER.vehicles.some((f) => f.chassisNo === 'MAT624009K1234567')).toBe(false); // demo EV stays Individual
  });
});

describe('fleet register — upload checks', () => {
  it('reads the template headers and flags every bad row with its Excel row number', () => {
    const rows = [
      { 'Chassis No': 'MAT700222K1000984', 'Fleet Account': 'A', 'Valid From': '01-04-2026', 'Valid To': '31-03-2027', 'Active (Y/N)': 'Y', Remarks: '' },
      { 'Chassis No': '', 'Fleet Account': 'B', 'Valid From': '', 'Valid To': '', 'Active (Y/N)': '', Remarks: 'x' },
      { 'Chassis No': 'MAT12', 'Fleet Account': '', 'Valid From': '', 'Valid To': '', 'Active (Y/N)': '', Remarks: '' },
      { 'Chassis No': 'mat700222k1000984', 'Fleet Account': '', 'Valid From': '', 'Valid To': '', 'Active (Y/N)': '', Remarks: '' },
      { 'Chassis No': 'MAT700555K1002460', 'Fleet Account': '', 'Valid From': '2026-05-01', 'Valid To': '2026-04-01', 'Active (Y/N)': '', Remarks: '' },
      { 'Chassis No': 'MAT700999K1004428', 'Fleet Account': '', 'Valid From': '31-02-2026', 'Valid To': '', 'Active (Y/N)': '', Remarks: '' },
      { 'Chassis No': 'MAT701332K1005904', 'Fleet Account': '', 'Valid From': '', 'Valid To': '', 'Active (Y/N)': 'maybe', Remarks: '' },
      { 'Chassis No': 'MAT7013 32K1005 9O4', 'Fleet Account': '', 'Valid From': '', 'Valid To': '', 'Active (Y/N)': '', Remarks: '' },
      { 'Chassis No': '', 'Fleet Account': '', 'Valid From': '', 'Valid To': '', 'Active (Y/N)': '', Remarks: '' },
      { 'Chassis No': 'MAT700111K1000492', 'Fleet Account': ' C ', 'Valid From': new Date(2026, 9, 1), 'Valid To': '', 'Active (Y/N)': 'n', Remarks: '' },
    ];
    const res = previewFleetUpload(rows, [v('MAT700111K1000492')]);
    expect(res.noChassisColumn).toBe(false);
    expect(res.missingColumns).toEqual([]);
    expect(res.valid.map((r) => [r.row, r.chassisNo])).toEqual([
      [2, 'MAT700222K1000984'],
      [11, 'MAT700111K1000492'],
    ]);
    expect(res.valid[0]).toMatchObject({ validFrom: '2026-04-01', validTo: '2027-03-31', active: true, fleetAccount: 'A' });
    expect(res.valid[1]).toMatchObject({ validFrom: '2026-10-01', active: false, fleetAccount: 'C' });
    const errors = res.issues.filter((i) => i.level === 'error').map((i) => [i.row, i.message]);
    expect(errors).toEqual([
      [3, 'Chassis No is blank.'],
      [4, expect.stringMatching(/17 letters/)],
      [5, 'Duplicate of row 2 in this file.'],
      [6, 'Valid To is before Valid From.'],
      [7, expect.stringMatching(/Valid From is not a date/)],
      [8, 'Active must be Y or N.'],
      [9, expect.stringMatching(/no I, O or Q/)],
    ]);
    expect(res.issues.filter((i) => i.level === 'info')).toEqual([
      { row: 11, chassisNo: 'MAT700111K1000492', level: 'info', message: 'Already on the fleet list — will be updated.' },
    ]);
  });

  it('accepts other header spellings and reports a missing chassis column', () => {
    const res = previewFleetUpload([{ VIN: 'MAT700222K1000984', 'Fleet Name': 'X' }], []);
    expect(res.valid).toHaveLength(1);
    expect(res.missingColumns).toEqual(['Valid From', 'Valid To', 'Active (Y/N)', 'Remarks']);
    expect(previewFleetUpload([{ 'Reg No': 'MH01AB1234' }], []).noChassisColumn).toBe(true);
  });

  it('merge adds/updates by chassis; replace makes the file the whole list', () => {
    const existing = [v('MAT700222K1000984', { fleetAccount: 'Old' }), v('MAT700555K1002460')];
    const rows = previewFleetUpload([{ 'Chassis No': 'MAT700222K1000984', 'Fleet Account': 'New' }, { 'Chassis No': 'MAT700999K1004428' }], existing).valid;
    const by = { userId: 'TML-ADMIN', at: '2026-10-06T10:00:00.000Z' };

    const merged = applyFleetUpload(existing, rows, 'merge', by);
    expect(merged).toMatchObject({ added: 1, updated: 1, removed: 0 });
    expect(merged.register.map((x) => x.chassisNo).sort()).toEqual(['MAT700222K1000984', 'MAT700555K1002460', 'MAT700999K1004428']);
    expect(merged.register.find((x) => x.chassisNo === 'MAT700222K1000984')).toMatchObject({ fleetAccount: 'New', uploadedBy: 'TML-ADMIN' });
    expect(merged.register[0]).not.toHaveProperty('row');

    const replaced = applyFleetUpload(existing, rows, 'replace', by);
    expect(replaced).toMatchObject({ added: 1, updated: 1, removed: 1 });
    expect(replaced.register.map((x) => x.chassisNo)).toEqual(['MAT700222K1000984', 'MAT700999K1004428']);
  });
});

describe('fleet register — helpers', () => {
  it('normalises chassis numbers and parses dates', () => {
    expect(normaliseChassis(' mat-700222 k1000984 ')).toBe('MAT700222K1000984');
    expect(parseFleetDate('')).toBe('');
    expect(parseFleetDate('2026-4-1')).toBe('2026-04-01');
    expect(parseFleetDate('1/4/2026')).toBe('2026-04-01');
    expect(parseFleetDate('31-02-2026')).toBeNull();
    expect(parseFleetDate('next week')).toBeNull();
  });

  it('only the TML admin uploads unless the privilege is granted to a role', () => {
    expect(canUploadFleet('superAdmin', [])).toBe(true);
    expect(canUploadFleet('dealerAdmin', [])).toBe(false);
    expect(canUploadFleet('dealerAdmin', ['dealerAdmin'])).toBe(true);
  });
});
