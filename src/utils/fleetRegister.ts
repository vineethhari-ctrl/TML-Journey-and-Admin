/**
 * Fleet flag (JC Creation walkthrough, 6 Oct 2026): a role with the fleet-upload privilege uploads chassis numbers as
 * Fleet; every vehicle not on the list is Individual. The Vehicle Info screen shows the badge under the customer name.
 *
 * The BA gave no more detail, so these are assumptions, shown as such on the Fleet Register page:
 *  - the key is the Chassis No (17-character VIN); Fleet Account, Valid From / To, Active and Remarks are optional;
 *  - TML owns one central list (not per dealer); an upload adds/updates by chassis or replaces the whole list;
 *  - a vehicle is Fleet only while its row is active and today is inside its validity dates (when given).
 */

export type CustomerCategory = 'FLEET' | 'INDIVIDUAL';

export interface FleetVehicle {
  chassisNo: string;
  fleetAccount: string;
  /** YYYY-MM-DD, optional */
  validFrom: string;
  /** YYYY-MM-DD, optional */
  validTo: string;
  active: boolean;
  remarks: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface FleetUploadRow {
  /** Excel row number (header = row 1) */
  row: number;
  chassisNo: string;
  fleetAccount: string;
  validFrom: string;
  validTo: string;
  active: boolean;
  remarks: string;
}

export interface FleetUploadIssue {
  row: number;
  chassisNo: string;
  level: 'error' | 'info';
  message: string;
}

export interface FleetUploadPreview {
  valid: FleetUploadRow[];
  issues: FleetUploadIssue[];
  /** Columns the file did not have (optional ones) */
  missingColumns: string[];
  /** Header of the chassis column was not found at all */
  noChassisColumn: boolean;
}

export type FleetUploadMode = 'merge' | 'replace';

/** The privilege; which roles hold it is set by the TML admin on the Fleet Register page. */
export const FLEET_UPLOAD_PERMISSION = 'fleet.upload';

export const FLEET_TEMPLATE_HEADERS = ['Chassis No', 'Fleet Account', 'Valid From', 'Valid To', 'Active (Y/N)', 'Remarks'];

/** VIN alphabet: no I, O or Q. */
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export const normaliseChassis = (raw: unknown): string => String(raw ?? '').toUpperCase().replace(/[\s-]/g, '');

export const isValidChassis = (chassisNo: string): boolean => VIN_RE.test(chassisNo);

const HEADER_ALIASES: Record<keyof Omit<FleetUploadRow, 'row'>, string[]> = {
  chassisNo: ['chassisno', 'chassisnumber', 'chassis', 'vin', 'chassisnovin', 'vinchassisno', 'vinno'],
  fleetAccount: ['fleetaccount', 'fleetname', 'fleetcustomer', 'account', 'accountname', 'fleetowner', 'company'],
  validFrom: ['validfrom', 'from', 'startdate', 'effectivefrom'],
  validTo: ['validto', 'to', 'enddate', 'validtill', 'validupto', 'effectiveto'],
  active: ['active', 'activeyn', 'status'],
  remarks: ['remarks', 'remark', 'comments', 'note', 'notes'],
};

const headerKey = (h: string) => h.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');

const pad = (n: number) => String(n).padStart(2, '0');

/** Accepts Excel dates, YYYY-MM-DD, DD-MM-YYYY and DD/MM/YYYY. Returns '' for blank, null when unreadable. */
export function parseFleetDate(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return '';
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return `${raw.getFullYear()}-${pad(raw.getMonth() + 1)}-${pad(raw.getDate())}`;
  }
  const s = String(raw).trim();
  if (!s) return '';
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else {
    match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

const parseYesNo = (raw: unknown): boolean | null => {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === '' || s === 'Y' || s === 'YES' || s === 'ACTIVE' || s === 'TRUE') return true;
  if (s === 'N' || s === 'NO' || s === 'INACTIVE' || s === 'FALSE') return false;
  return null;
};

/**
 * Check an uploaded sheet (array of row objects keyed by the Excel header) before anything is saved.
 * Errors block a row; info lines (e.g. "already on the list — will be updated") do not.
 */
export function previewFleetUpload(rows: Array<Record<string, unknown>>, existing: FleetVehicle[]): FleetUploadPreview {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const columnFor = {} as Record<keyof typeof HEADER_ALIASES, string | undefined>;
  (Object.keys(HEADER_ALIASES) as Array<keyof typeof HEADER_ALIASES>).forEach((k) => {
    columnFor[k] = headers.find((h) => HEADER_ALIASES[k].includes(headerKey(h)));
  });

  const missingColumns = (['fleetAccount', 'validFrom', 'validTo', 'active', 'remarks'] as const)
    .filter((k) => !columnFor[k])
    .map((k) => FLEET_TEMPLATE_HEADERS[['chassisNo', 'fleetAccount', 'validFrom', 'validTo', 'active', 'remarks'].indexOf(k)]);

  if (!columnFor.chassisNo) {
    return { valid: [], issues: [], missingColumns, noChassisColumn: true };
  }

  const known = new Set(existing.map((v) => v.chassisNo));
  const seen = new Map<string, number>();
  const valid: FleetUploadRow[] = [];
  const issues: FleetUploadIssue[] = [];
  const get = (r: Record<string, unknown>, k: keyof typeof HEADER_ALIASES) => (columnFor[k] ? r[columnFor[k]!] : '');

  rows.forEach((r, i) => {
    const row = i + 2;
    const values = Object.values(r).map((v) => String(v ?? '').trim());
    if (values.every((v) => v === '')) return; // blank line

    const chassisNo = normaliseChassis(get(r, 'chassisNo'));
    const err = (message: string) => issues.push({ row, chassisNo, level: 'error', message });

    if (!chassisNo) return err('Chassis No is blank.');
    if (!isValidChassis(chassisNo)) return err('Chassis No must be 17 letters/digits (VIN; no I, O or Q).');
    if (seen.has(chassisNo)) return err(`Duplicate of row ${seen.get(chassisNo)} in this file.`);
    seen.set(chassisNo, row);

    const validFrom = parseFleetDate(get(r, 'validFrom'));
    const validTo = parseFleetDate(get(r, 'validTo'));
    if (validFrom === null) return err('Valid From is not a date (use DD-MM-YYYY).');
    if (validTo === null) return err('Valid To is not a date (use DD-MM-YYYY).');
    if (validFrom && validTo && validTo < validFrom) return err('Valid To is before Valid From.');

    const active = parseYesNo(get(r, 'active'));
    if (active === null) return err('Active must be Y or N.');

    if (known.has(chassisNo)) issues.push({ row, chassisNo, level: 'info', message: 'Already on the fleet list — will be updated.' });
    valid.push({
      row,
      chassisNo,
      fleetAccount: String(get(r, 'fleetAccount') ?? '').trim(),
      validFrom,
      validTo,
      active,
      remarks: String(get(r, 'remarks') ?? '').trim(),
    });
  });

  return { valid, issues, missingColumns, noChassisColumn: false };
}

/** Apply a checked upload. Merge adds/updates by chassis; replace makes the file the whole list. */
export function applyFleetUpload(
  existing: FleetVehicle[],
  rows: FleetUploadRow[],
  mode: FleetUploadMode,
  by: { userId: string; at: string },
): { register: FleetVehicle[]; added: number; updated: number; removed: number } {
  const incoming = rows.map<FleetVehicle>((r) => ({
    chassisNo: r.chassisNo,
    fleetAccount: r.fleetAccount,
    validFrom: r.validFrom,
    validTo: r.validTo,
    active: r.active,
    remarks: r.remarks,
    uploadedBy: by.userId,
    uploadedAt: by.at,
  }));
  const before = new Map(existing.map((v) => [v.chassisNo, v]));
  const added = incoming.filter((v) => !before.has(v.chassisNo)).length;
  const updated = incoming.length - added;
  if (mode === 'replace') {
    const keep = new Set(incoming.map((v) => v.chassisNo));
    return { register: incoming, added, updated, removed: existing.filter((v) => !keep.has(v.chassisNo)).length };
  }
  const merged = new Map(before);
  incoming.forEach((v) => merged.set(v.chassisNo, v));
  return { register: [...merged.values()], added, updated, removed: 0 };
}

export interface FleetClassification {
  category: CustomerCategory;
  entry?: FleetVehicle;
  /** Why a listed vehicle still counts as Individual (inactive / not yet valid / expired). */
  reason?: string;
}

/** Fleet or Individual for a chassis on a given day (YYYY-MM-DD, default today). */
export function classifyVehicle(chassisNo: string, register: FleetVehicle[], onDate = todayIso()): FleetClassification {
  const entry = register.find((v) => v.chassisNo === normaliseChassis(chassisNo));
  if (!entry) return { category: 'INDIVIDUAL' };
  if (!entry.active) return { category: 'INDIVIDUAL', entry, reason: 'On the fleet list but marked inactive.' };
  if (entry.validFrom && onDate < entry.validFrom) return { category: 'INDIVIDUAL', entry, reason: `Fleet only from ${entry.validFrom}.` };
  if (entry.validTo && onDate > entry.validTo) return { category: 'INDIVIDUAL', entry, reason: `Fleet validity ended on ${entry.validTo}.` };
  return { category: 'FLEET', entry };
}

export function todayIso(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Who may upload: the TML admin always; other roles only when the TML admin grants the privilege. */
export function canUploadFleet(roleId: string, grantedRoles: string[]): boolean {
  return roleId === 'superAdmin' || grantedRoles.includes(roleId);
}
