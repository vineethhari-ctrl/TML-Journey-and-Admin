import { SystemConfiguration } from '../types';

/** Cross-field rules the per-input min/max attributes can't express. */
export function validateConfiguration(cfg: SystemConfiguration): string[] {
  const errors: string[] = [];
  if (cfg.idleTimeoutMinutes > cfg.sessionTimeoutMinutes) {
    errors.push('Idle timeout cannot be longer than the session timeout.');
  }
  if (cfg.exceptionThresholdMinutes > cfg.stageTimeoutThresholdHours * 60) {
    errors.push('Exception threshold cannot exceed the stage timeout threshold.');
  }
  (Object.keys(cfg) as Array<keyof SystemConfiguration>).forEach((k) => {
    const v = cfg[k];
    if (typeof v === 'number' && (!Number.isFinite(v) || v < 0)) {
      errors.push(`${k} must be a non-negative number.`);
    }
  });
  return errors;
}

/** Human-readable list of changed settings, e.g. "sessionTimeoutMinutes: 30 → 45". */
export function diffConfiguration(before: SystemConfiguration, after: SystemConfiguration): string[] {
  return (Object.keys(after) as Array<keyof SystemConfiguration>)
    .filter((k) => before[k] !== after[k])
    .map((k) => `${k}: ${String(before[k])} → ${String(after[k])}`);
}
