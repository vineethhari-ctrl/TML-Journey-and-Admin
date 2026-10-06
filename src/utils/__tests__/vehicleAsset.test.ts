import { describe, it, expect } from 'vitest';
import { resolveVehicle, vehicleImageCandidates, vehicleTrimLabel } from '../vehicleAsset';

const MASTER = [
  { regNo: 'MH 12 TS 0001', vin: 'V1', model: 'Nexon EV', variantCode: 'XZ_LUX', variantName: 'XZ+ Lux', colourCode: 'DAYTONA_GREY', colourName: 'Daytona Grey' },
  { regNo: 'MH12TS0002', vin: 'V2', model: 'Nexon EV', variantCode: 'XZ_LUX' },
  { regNo: 'MH12TS0003', vin: 'V3', model: 'Tiago' },
];

describe('vehicle render resolution', () => {
  it('resolves the vehicle by Reg No, ignoring spaces and case', () => {
    expect(resolveVehicle('mh12-ts-0001', MASTER).vin).toBe('V1');
    expect(resolveVehicle('XX00XX0000', MASTER)).toEqual({ regNo: 'XX00XX0000' });
  });

  it('builds the URL from the convention, then falls back to the hero shade', () => {
    expect(vehicleImageCandidates(resolveVehicle('MH12TS0001', MASTER), { XZ_LUX: 'FLAME_RED' })).toEqual([
      '/assets/vehicles/nexon-ev/xz-lux/daytona-grey_front_three_quarter.webp',
      '/assets/vehicles/nexon-ev/xz-lux/flame-red_front_three_quarter.webp',
    ]);
    expect(vehicleImageCandidates(resolveVehicle('MH12TS0002', MASTER), { XZ_LUX: 'FLAME_RED' })).toEqual(['/assets/vehicles/nexon-ev/xz-lux/flame-red_front_three_quarter.webp']);
  });

  it('returns no URL (generic silhouette) without a VC or any shade', () => {
    expect(vehicleImageCandidates(resolveVehicle('MH12TS0003', MASTER))).toEqual([]);
    expect(vehicleImageCandidates(resolveVehicle('MH12TS0002', MASTER))).toEqual([]);
  });

  it('labels the trim and colour', () => {
    expect(vehicleTrimLabel(resolveVehicle('MH12TS0001', MASTER))).toBe('XZ+ Lux · Daytona Grey');
  });
});
