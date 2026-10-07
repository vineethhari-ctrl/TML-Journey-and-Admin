/**
 * Employee profile: designation, shift, expertise, skills and certificates of an employee, and the checks the
 * Employee / Users screen shows (skill gaps against the role, expiring certificates, availability by skill and shift).
 * Plain, deterministic functions — no server and no AI. Masters (skills, certificates, designations, shifts) come in as
 * parameters so what the admin edits in the generic masters is what these functions use.
 */
import type { AppUser } from '../types';
import { ROLE_CATALOGUE, SA_EXPERTISE, SA_EXPERTISE_SKILL, type CatalogueRole, type SaExpertise } from '../data/roleCatalogue';

type Rec = Record<string, any>;

export const SKILL_LEVELS = ['L1', 'L2', 'L3', 'L4'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export interface EmployeeSkill {
  skillCode: string;
  level: SkillLevel;
  since: string;
  source: 'LMS' | 'Assessment' | 'Manual';
}
export interface EmployeeCert {
  certCode: string;
  issuedOn: string;
  expiresOn: string;
  certificateNo: string;
}
export interface EmployeeProfile {
  employeeId: string;
  designation: string;
  employmentType: string;
  lifecycle: string;
  joinedOn: string;
  shift: string;
  /** Service Advisors only: which jobs he or she can create and advise on. */
  expertise?: SaExpertise;
  skills: EmployeeSkill[];
  certs: EmployeeCert[];
}

export interface ProfileMasters {
  skills: Rec[];
  certs: Rec[];
  designations: Rec[];
  shifts: Rec[];
}

/** "Today" for the seed data and for the tests; the screens pass the real date. */
export const REFERENCE_DATE = '2026-10-07';

const active = (r: Rec) => String(r.status ?? 'Active').toLowerCase() === 'active';
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();
const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addMonths = (iso: string, months: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};
export const addDays = (iso: string, days: number) => isoOf(day(iso) + days * 86400000);
export const daysBetween = (from: string, to: string) => Math.round((day(to) - day(from)) / 86400000);

/** Small stable number from text (same employee → same seed data every time). */
export function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The catalogue role of a user (Roles & Access role name first, then the role name). */
export const roleOfUser = (user: Pick<AppUser, 'role'>): CatalogueRole | undefined =>
  ROLE_CATALOGUE.find((r) => r.adminRoleName === user.role) ?? ROLE_CATALOGUE.find((r) => r.name === user.role);

/** Skills a role needs; a Service Advisor also needs the skill of his or her expertise. */
export function requiredSkillsFor(role: CatalogueRole | undefined, profile?: Pick<EmployeeProfile, 'expertise'>): string[] {
  if (!role) return [];
  const extra = role.id === 'R-SA' ? SA_EXPERTISE_SKILL[profile?.expertise ?? 'Mechanical'] : [];
  return [...new Set([...role.requiredSkills, ...extra])];
}

// ---------------------------------------------------------------------------
// Seed: a believable profile for every employee that has none saved yet
// ---------------------------------------------------------------------------

export function seedProfile(user: AppUser, masters: ProfileMasters, today: string = REFERENCE_DATE): EmployeeProfile {
  const h = hashOf(user.employeeId);
  const role = roleOfUser(user);
  // About 1 in 5 Technicians is a Master Technician
  const designation = role?.id === 'R-TECH' && h % 5 === 0 ? 'Master Technician' : role?.designation ?? 'Technician';
  const expertise: SaExpertise | undefined = role?.id === 'R-SA' ? SA_EXPERTISE[h % 3] : undefined;
  const shifts = masters.shifts.filter(active).map((s) => String(s.shiftCode));
  const shift = designation === 'Security Guard' ? (shifts.includes('NIGHT') ? ['GEN', 'NIGHT'][h % 2] : shifts[0] ?? 'GEN') : (['GEN', 'EARLY', 'LATE'].filter((s) => shifts.includes(s))[h % 3] ?? shifts[0] ?? 'GEN');
  const joinedOn = `${2017 + (h % 8)}-${String(1 + (h % 12)).padStart(2, '0')}-${String(1 + (h % 27)).padStart(2, '0')}`;
  const employmentType = h % 11 === 0 ? 'Trainee' : h % 7 === 0 ? 'Contract' : 'Permanent';

  // Skills: everything the role needs, one missing for about 1 in 4 people so the gap view has something to show
  const needed = requiredSkillsFor(role, { expertise });
  const owned = needed.filter((_, i) => !(h % 4 === 0 && i === needed.length - 1 && needed.length > 1));
  const known = new Set(masters.skills.map((s) => String(s.skillCode)));
  // Beyond what the role needs: some skills typical of the designation (a mix, so the matrix and the finder have variety)
  const extras = masters.skills
    .filter(active)
    .filter((sk) => String(sk.forDesignation) === designation || (designation === 'Master Technician' && String(sk.forDesignation) === 'Technician'))
    .map((sk) => String(sk.skillCode))
    .filter((c) => !owned.includes(c) && !c.startsWith('SA-') && (hashOf(`${user.employeeId}:${c}`) % 100) < (designation === 'Master Technician' ? 70 : 38));
  const skillCodes = [...owned, ...extras];
  const skills: EmployeeSkill[] = skillCodes
    .filter((c) => known.has(c))
    .map((skillCode, i) => ({
      skillCode,
      level: SKILL_LEVELS[Math.min(3, (h >> (i + 2)) % 4)],
      since: addMonths(today, -(6 + ((h >> i) % 60))),
      source: (['LMS', 'Assessment', 'Manual'] as const)[(h + i) % 3],
    }));

  // Certificates: the ones the role needs, issued so that some are about to expire and a few have expired
  const validity = new Map(masters.certs.map((c) => [String(c.certCode), Number(c.validityMonths) || 12]));
  const certCodes = [...new Set([...(role?.requiredCerts ?? []), ...(skillCodes.includes('EV-HV-01') ? ['HVS-1', 'EVT-1'] : []), ...(skillCodes.includes('DIAG-TDS') ? ['DIAG-1'] : [])])];
  const certs: EmployeeCert[] = certCodes
    .filter((c) => validity.has(c))
    .filter((_, i) => !(h % 9 === 0 && i === 0))
    .map((certCode, i) => {
      const months = validity.get(certCode)!;
      const age = [months - 1, 2, 0, months + 1, 6][(h + i) % 5]; // months since issue
      const issuedOn = addMonths(today, -Math.max(0, age));
      return { certCode, issuedOn, expiresOn: addMonths(issuedOn, months), certificateNo: `CRT-${String(10000 + (h % 90000) + i)}` };
    });

  return { employeeId: user.employeeId, designation, employmentType, lifecycle: user.status === 'INACTIVE' ? 'Left' : 'Active', joinedOn, shift, expertise, skills, certs };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export type CertStatus = 'valid' | 'expiring' | 'expired';
export const EXPIRY_WARNING_DAYS = 60;

export function certStatus(expiresOn: string, today: string): CertStatus {
  const left = daysBetween(today, expiresOn);
  return left < 0 ? 'expired' : left <= EXPIRY_WARNING_DAYS ? 'expiring' : 'valid';
}

export interface Gaps {
  missingSkills: string[];
  missingCerts: string[];
  expiredCerts: string[];
  expiringCerts: string[];
  ok: boolean;
}

/** What the employee lacks for the role: skills not held, certificates not held / expired / about to expire. */
export function gapsFor(profile: EmployeeProfile, role: CatalogueRole | undefined, today: string): Gaps {
  const held = new Set(profile.skills.map((s) => s.skillCode));
  const missingSkills = requiredSkillsFor(role, profile).filter((c) => !held.has(c));
  const certFor = new Map(profile.certs.map((c) => [c.certCode, c]));
  const required = role?.requiredCerts ?? [];
  const missingCerts = required.filter((c) => !certFor.has(c));
  const status = (c: string) => (certFor.get(c) ? certStatus(certFor.get(c)!.expiresOn, today) : undefined);
  const expiredCerts = required.filter((c) => status(c) === 'expired');
  const expiringCerts = required.filter((c) => status(c) === 'expiring');
  return { missingSkills, missingCerts, expiredCerts, expiringCerts, ok: !missingSkills.length && !missingCerts.length && !expiredCerts.length };
}

/** Certificates of all employees that expire soon or have expired (for the alert list). */
export function expiringCertificates(rows: Array<{ user: AppUser; profile: EmployeeProfile }>, today: string) {
  return rows
    .flatMap(({ user, profile }) => profile.certs.map((c) => ({ user, cert: c, status: certStatus(c.expiresOn, today), daysLeft: daysBetween(today, c.expiresOn) })))
    .filter((x) => x.status !== 'valid')
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

// ---------------------------------------------------------------------------
// Availability: who can do what, on which shift
// ---------------------------------------------------------------------------

/** An employee counts as available when the account is Active and the employee has not left / is not on leave. */
export const isAvailable = (user: AppUser, profile: EmployeeProfile) => user.status === 'ACTIVE' && profile.lifecycle === 'Active';

export interface AvailabilityRow {
  skillCode: string;
  skillName: string;
  byShift: Record<string, number>;
  total: number;
}

export function availabilityBySkill(
  rows: Array<{ user: AppUser; profile: EmployeeProfile }>,
  masters: ProfileMasters,
  filter: { dealer?: string; minLevel?: SkillLevel } = {}
): AvailabilityRow[] {
  const shifts = masters.shifts.filter(active).map((s) => String(s.shiftCode));
  const min = filter.minLevel ? SKILL_LEVELS.indexOf(filter.minLevel) : 0;
  const pool = rows.filter(({ user, profile }) => isAvailable(user, profile) && (!filter.dealer || user.dealer === filter.dealer));
  return masters.skills
    .filter(active)
    .map((s) => {
      const code = String(s.skillCode);
      const byShift = Object.fromEntries(shifts.map((sh) => [sh, 0])) as Record<string, number>;
      pool.forEach(({ profile }) => {
        const held = profile.skills.find((k) => k.skillCode === code);
        if (held && SKILL_LEVELS.indexOf(held.level) >= min) byShift[profile.shift] = (byShift[profile.shift] ?? 0) + 1;
      });
      return { skillCode: code, skillName: String(s.skillName), byShift, total: Object.values(byShift).reduce((a, b) => a + b, 0) };
    });
}

/** Service Advisors by expertise (and shift): who can create mechanical, bodyshop or both kinds of job cards. */
export function advisorsByExpertise(rows: Array<{ user: AppUser; profile: EmployeeProfile }>, dealer?: string) {
  const out: Record<SaExpertise, Array<{ user: AppUser; profile: EmployeeProfile }>> = { Mechanical: [], Bodyshop: [], Both: [] };
  rows
    .filter(({ user, profile }) => profile.expertise && isAvailable(user, profile) && (!dealer || user.dealer === dealer))
    .forEach((r) => out[r.profile.expertise!].push(r));
  return out;
}

/** Can this Service Advisor create a job card of that kind? */
export const canAdviseOn = (profile: Pick<EmployeeProfile, 'expertise'>, job: 'Mechanical' | 'Bodyshop') => profile.expertise === 'Both' || profile.expertise === job;
