/**
 * DPDP (Digital Personal Data Protection Act, 2023) helpers for customer PII shown in grids and detail screens.
 *
 *  - Phone numbers are masked by default: every digit except the last 4 (10-digit mobile → "******3540").
 *  - Customer names are shown in full only to the assigned Service Advisor; everyone else sees initials.
 *  - Revealing a value needs the `pii.unmask` permission and is written to the audit log (never the value itself).
 *  - Exports carry masked PII unless the user holds the supervisor `pii.export` permission.
 */

export const PII_PERMISSIONS = {
  unmask: 'pii.unmask',
  exportPlain: 'pii.export',
} as const;

export type PiiKind = 'phone' | 'name' | 'email';

const digitsOf = (value: string) => value.replace(/\D/g, '');

/** "+91 98201 44521" → "******4521". Keeps only the last 4 digits of the national number. */
export function maskPhone(phone: string | null | undefined): string {
  const digits = digitsOf(String(phone ?? ''));
  if (!digits) return '';
  const national = digits.length > 10 ? digits.slice(-10) : digits;
  if (national.length <= 4) return '*'.repeat(national.length);
  return '*'.repeat(national.length - 4) + national.slice(-4);
}

/** "Rajesh Kumar Sharma" → "R*** K*** S***". Fixed-width stars so the name length is not revealed. */
export function maskName(name: string | null | undefined): string {
  return String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}***`)
    .join(' ');
}

/** "rajesh.sharma@example.com" → "r***@example.com". */
export function maskEmail(email: string | null | undefined): string {
  const value = String(email ?? '').trim();
  const at = value.indexOf('@');
  if (at < 1) return value ? '***' : '';
  return `${value[0]}***${value.slice(at)}`;
}

export const maskPii = (kind: PiiKind, value: string | null | undefined): string =>
  kind === 'phone' ? maskPhone(value) : kind === 'name' ? maskName(value) : maskEmail(value);

/** Full customer name only for the Service Advisor assigned to the job; masked for everyone else. */
export const canSeeFullName = (viewer: { userId: string; name?: string }, assignedSa: { id?: string; name?: string }): boolean =>
  (!!assignedSa.id && assignedSa.id === viewer.userId) || (!!assignedSa.name && !!viewer.name && assignedSa.name.trim() === viewer.name.trim());

/** Audit payload for a manual reveal. The revealed value itself is never logged. */
export interface UnmaskAuditPayload {
  userId: string;
  vehicleRegNo: string;
  actionType: 'UNMASK_PII';
  field: PiiKind;
  timestamp: string;
  /** Stamped by the server from the request in production; the browser cannot know it reliably. */
  sessionIp: string;
}

export function buildUnmaskAudit(p: { userId: string; vehicleRegNo: string; field: PiiKind; sessionIp?: string; at?: Date }): UnmaskAuditPayload {
  return {
    userId: p.userId,
    vehicleRegNo: p.vehicleRegNo,
    actionType: 'UNMASK_PII',
    field: p.field,
    timestamp: (p.at ?? new Date()).toISOString(),
    sessionIp: p.sessionIp ?? 'server-stamped',
  };
}

/**
 * Rows ready for CSV / Excel export: PII fields are masked unless the user may export plain PII.
 * `piiFields` maps a row key to its kind, e.g. { customerMobile: 'phone', customerName: 'name' }.
 */
export function sanitizeForExport<T extends object>(rows: T[], piiFields: Partial<Record<keyof T, PiiKind>>, allowPlainPii: boolean): T[] {
  if (allowPlainPii) return rows;
  const entries = Object.entries(piiFields) as Array<[keyof T, PiiKind]>;
  return rows.map((row) => {
    const copy: Record<string, unknown> = { ...(row as Record<string, unknown>) };
    entries.forEach(([key, kind]) => {
      if (copy[key as string] !== undefined && copy[key as string] !== null) copy[key as string] = maskPii(kind, String(copy[key as string]));
    });
    return copy as T;
  });
}
