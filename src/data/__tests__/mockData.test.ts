import { describe, it, expect } from 'vitest';
import { generateInitialData, buildJourneyForCase } from '../mockDataGenerator';

const data = generateInitialData();

describe('generated demo data', () => {
  it('has unique ids for JCs, users, devices and sessions', () => {
    const unique = (xs: string[]) => new Set(xs).size === xs.length;
    expect(unique(data.serviceCases.map((c) => c.jcNumber))).toBe(true);
    expect(unique(data.users.map((u) => u.userId))).toBe(true);
    expect(unique(data.devices.map((d) => d.deviceId))).toBe(true);
    expect(unique(data.sessions.map((s) => s.sessionId))).toBe(true);
  });

  it('every exception points at an existing JC with the matching vehicle number', () => {
    const byJc = new Map(data.serviceCases.map((c) => [c.jcNumber, c.vehicleRegistration]));
    for (const exc of data.exceptions) {
      if (byJc.has(exc.jcNumber)) expect(exc.vehicleRegistration).toBe(byJc.get(exc.jcNumber));
    }
  });
});

describe('buildJourneyForCase', () => {
  it('builds 12 ordered stages consistent with the current stage', () => {
    for (const sc of data.serviceCases.slice(1)) {
      const { stages, events } = buildJourneyForCase(sc);
      expect(stages).toHaveLength(12);
      expect(stages.map((s) => s.sequence)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));

      const current = stages.find((s) => s.module === sc.currentStage)!;
      if (sc.overallStatus === 'COMPLETED') {
        expect(stages.every((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED')).toBe(true);
      } else if (current.status !== 'SKIPPED') {
        expect(current.status).toBe(sc.overallStatus === 'BLOCKED' ? 'BLOCKED' : 'IN PROGRESS');
      }
      // Nothing after the current stage has started
      stages.filter((s) => s.sequence > current.sequence && sc.overallStatus !== 'COMPLETED').forEach((s) => {
        expect(s.startedAt).toBeUndefined();
      });
      // Events are newest-first with well-formed timestamps
      expect(events.every((e) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(e.timestamp))).toBe(true);
      const times = events.map((e) => e.timestamp);
      expect(times).toEqual([...times].sort().reverse());
    }
  });
});
