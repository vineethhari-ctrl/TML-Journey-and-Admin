import { describe, it, expect } from 'vitest';
import { validateConfiguration, diffConfiguration } from '../configUtil';
import { INITIAL_CONFIGURATION } from '../../data/mockDataGenerator';

describe('configuration rules', () => {
  it('the shipped default configuration is valid', () => {
    expect(validateConfiguration(INITIAL_CONFIGURATION)).toEqual([]);
  });

  it('rejects an idle timeout longer than the session timeout', () => {
    const cfg = { ...INITIAL_CONFIGURATION, sessionTimeoutMinutes: 30, idleTimeoutMinutes: 45 };
    expect(validateConfiguration(cfg).join(' ')).toMatch(/Idle timeout/);
  });

  it('diff lists only the changed settings with before → after', () => {
    const after = { ...INITIAL_CONFIGURATION, maxLoginAttempts: INITIAL_CONFIGURATION.maxLoginAttempts + 1 };
    expect(diffConfiguration(INITIAL_CONFIGURATION, after)).toEqual([
      `maxLoginAttempts: ${INITIAL_CONFIGURATION.maxLoginAttempts} → ${INITIAL_CONFIGURATION.maxLoginAttempts + 1}`,
    ]);
    expect(diffConfiguration(INITIAL_CONFIGURATION, { ...INITIAL_CONFIGURATION })).toEqual([]);
  });
});
