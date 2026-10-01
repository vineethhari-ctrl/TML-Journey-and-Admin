import { describe, it, expect } from 'vitest';
import { detectSearchType, journeyService } from '../journeyService';
import { generateInitialData } from '../../data/mockDataGenerator';

describe('detectSearchType', () => {
  it.each([
    ['JC20260930001234', 'jc'],
    ['jc2026', 'jc'],
    ['MAT700111K1000492', 'vin'],
    ['+91 98201 44521', 'phone'],
    ['9820144521', 'phone'],
    ['MH01AB1234', 'registration'],
    ['mh01', 'registration'],
    ['Rajesh Sharma', 'name'],
    ['', 'auto'],
  ])('%s → %s', (input, expected) => {
    expect(detectSearchType(input)).toBe(expected);
  });
});

describe('journeyService.filterServiceCases', () => {
  const { serviceCases } = generateInitialData();

  it('auto mode matches any identifier, ignoring spaces and case', () => {
    const demo = serviceCases[0];
    for (const q of [demo.jcNumber, demo.vehicleRegistration.toLowerCase(), demo.vin, demo.customerName]) {
      const res = journeyService.filterServiceCases(serviceCases, { query: q, searchBy: 'auto' });
      expect(res.map((c) => c.jcNumber)).toContain(demo.jcNumber);
    }
    const spaced = journeyService.filterServiceCases(serviceCases, { query: 'MH01 AB 1234', searchBy: 'auto' });
    expect(spaced.length).toBeGreaterThan(0);
  });

  it('a specific search type only looks at that field', () => {
    const res = journeyService.filterServiceCases(serviceCases, { query: 'JC2026', searchBy: 'registration' });
    expect(res).toHaveLength(0);
  });

  it('status / workshop / pending filters narrow the list', () => {
    const delayed = journeyService.filterServiceCases(serviceCases, { overallStatus: 'DELAYED' });
    expect(delayed.length).toBeGreaterThan(0);
    expect(delayed.every((c) => c.overallStatus === 'DELAYED')).toBe(true);

    const pending = journeyService.filterServiceCases(serviceCases, { hasPendingActionsOnly: true });
    expect(pending.every((c) => c.pendingActionsCount > 0)).toBe(true);

    const inWorkshop = journeyService.filterServiceCases(serviceCases, { inWorkshopOnly: true });
    expect(inWorkshop.some((c) => c.currentStage === 'Appointment')).toBe(false);
  });
});
