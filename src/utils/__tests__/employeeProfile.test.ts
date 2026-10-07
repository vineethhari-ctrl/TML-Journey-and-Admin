import { describe, it, expect } from 'vitest';
import type { AppUser } from '../../types';
import { MASTER_COLLECTIONS } from '../../data/masterCatalogue';
import { INITIAL_ROLES } from '../../data/mockDataGenerator';
import { generateInitialData } from '../../data/mockDataGenerator';
import { DEFAULT_WORKSHOP_POLICY } from '../../data/workshopPolicy';
import { ROLE_CATALOGUE, SA_EXPERTISE } from '../../data/roleCatalogue';
import { REFERENCE_DATE, advisorsByExpertise, availabilityBySkill, canAdviseOn, certStatus, expiringCertificates, gapsFor, hashOf, requiredSkillsFor, roleOfUser, seedProfile, type ProfileMasters } from '../employeeProfile';
import { groupPermissions, viewsForRole } from '../roleViews';
import { canRoleAccessRoute } from '../roleAccess';

const rows = (id: string) => MASTER_COLLECTIONS.find((m) => m.id === id)!.records;
const masters: ProfileMasters = { skills: rows('skill_master'), certs: rows('certification_master'), designations: rows('designation_master'), shifts: rows('shift_master') };
const users = generateInitialData().users;
const profiles = users.map((user) => ({ user, profile: seedProfile(user, masters) }));
const user = (role: string, employeeId = 'TML10001', over: Partial<AppUser> = {}): AppUser => ({ ...users[0], role, employeeId, status: 'ACTIVE', ...over });

describe('role catalogue', () => {
  it('has every Roles & Access role and every portal view role, with unique ids', () => {
    expect(new Set(ROLE_CATALOGUE.map((r) => r.id)).size).toBe(ROLE_CATALOGUE.length);
    INITIAL_ROLES.forEach((r) => expect(ROLE_CATALOGUE.some((c) => c.adminRoleName === r.name), r.name).toBe(true));
    ['superAdmin', 'serviceAdvisor', 'receptionist', 'securityGuard', 'driver', 'dgm', 'dealerAdmin', 'cro'].forEach((id) => expect(ROLE_CATALOGUE.some((c) => c.platformRoleId === id), id).toBe(true));
  });

  it('requires only skills, certificates and designations that exist in the generic masters', () => {
    const skills = new Set(masters.skills.map((s) => s.skillCode));
    const certs = new Set(masters.certs.map((c) => c.certCode));
    const designations = new Set(masters.designations.map((d) => d.designationName));
    ROLE_CATALOGUE.forEach((r) => {
      r.requiredSkills.forEach((s) => expect(skills.has(s), `${r.name} skill ${s}`).toBe(true));
      r.requiredCerts.forEach((c) => expect(certs.has(c), `${r.name} cert ${c}`).toBe(true));
      if (r.designation) expect(designations.has(r.designation), `${r.name} designation ${r.designation}`).toBe(true);
    });
  });

  it('maps every seeded user to a catalogue role', () => {
    users.forEach((u) => expect(roleOfUser(u), u.role).toBeDefined());
  });
});

describe('Service Advisor expertise (Mechanical / Bodyshop / Both)', () => {
  it('has the three options and the matching skill requirement', () => {
    expect([...SA_EXPERTISE]).toEqual(['Mechanical', 'Bodyshop', 'Both']);
    const sa = ROLE_CATALOGUE.find((r) => r.id === 'R-SA')!;
    expect(requiredSkillsFor(sa, { expertise: 'Mechanical' })).toEqual(['CUST-HND', 'SA-MECH']);
    expect(requiredSkillsFor(sa, { expertise: 'Bodyshop' })).toEqual(['CUST-HND', 'SA-BODY']);
    expect(requiredSkillsFor(sa, { expertise: 'Both' })).toEqual(['CUST-HND', 'SA-MECH', 'SA-BODY']);
  });

  it('every Service Advisor has an expertise, other roles have none', () => {
    profiles.forEach(({ user: u, profile }) => {
      if (roleOfUser(u)?.id === 'R-SA') expect(SA_EXPERTISE as readonly string[]).toContain(profile.expertise);
      else expect(profile.expertise).toBeUndefined();
    });
    expect(new Set(profiles.filter((p) => p.profile.expertise).map((p) => p.profile.expertise)).size).toBeGreaterThan(1);
  });

  it('who can advise on which job', () => {
    expect(canAdviseOn({ expertise: 'Mechanical' }, 'Mechanical')).toBe(true);
    expect(canAdviseOn({ expertise: 'Mechanical' }, 'Bodyshop')).toBe(false);
    expect(canAdviseOn({ expertise: 'Both' }, 'Bodyshop')).toBe(true);
    const groups = advisorsByExpertise(profiles);
    expect(groups.Mechanical.length + groups.Bodyshop.length + groups.Both.length).toBe(profiles.filter((p) => p.profile.expertise && p.user.status === 'ACTIVE' && p.profile.lifecycle === 'Active').length);
  });

  it('a Service Advisor with the wrong skill for the expertise has a gap', () => {
    const sa = ROLE_CATALOGUE.find((r) => r.id === 'R-SA')!;
    const p = seedProfile(user('Service Advisor', 'TML10030'), masters);
    const bodyshopOnly = { ...p, expertise: 'Bodyshop' as const, skills: p.skills.filter((s) => s.skillCode !== 'SA-BODY') };
    expect(gapsFor(bodyshopOnly, sa, REFERENCE_DATE).missingSkills).toContain('SA-BODY');
  });
});

describe('employee profiles', () => {
  it('are stable: the same employee always gets the same profile', () => {
    const u = user('Technician', 'TML10033');
    expect(seedProfile(u, masters)).toEqual(seedProfile(u, masters));
    expect(hashOf('A')).not.toBe(hashOf('B'));
  });

  it('use designations, shifts, skills and certificates from the masters', () => {
    const shifts = new Set(masters.shifts.map((s) => s.shiftCode));
    const skills = new Set(masters.skills.map((s) => s.skillCode));
    const certs = new Set(masters.certs.map((c) => c.certCode));
    profiles.forEach(({ profile }) => {
      expect(shifts.has(profile.shift)).toBe(true);
      profile.skills.forEach((s) => expect(skills.has(s.skillCode)).toBe(true));
      profile.certs.forEach((c) => expect(certs.has(c.certCode)).toBe(true));
    });
  });

  it('the people have a mix of skills: some hold EV / diagnostics skills, with the certificates that go with them', () => {
    const holders = (code: string) => profiles.filter((p) => p.profile.skills.some((k) => k.skillCode === code));
    expect(holders('EV-HV-01').length).toBeGreaterThan(0);
    const ev = holders('EV-HV-01');
    expect(ev.filter((p) => p.profile.certs.some((c) => c.certCode === 'HVS-1')).length).toBeGreaterThanOrEqual(Math.floor(ev.length * 0.6));
    expect(profiles.some((p) => p.profile.designation === 'Master Technician')).toBe(true);
    expect(new Set(profiles.flatMap((p) => p.profile.skills.map((k) => k.skillCode))).size).toBeGreaterThan(8);
  });

  it('certificate status: valid, expiring within 60 days, expired', () => {
    expect(certStatus('2027-01-01', REFERENCE_DATE)).toBe('valid');
    expect(certStatus('2026-11-15', REFERENCE_DATE)).toBe('expiring');
    expect(certStatus('2026-10-06', REFERENCE_DATE)).toBe('expired');
  });

  it('finds skill and certificate gaps against the role, and lists expiring certificates', () => {
    const tech = ROLE_CATALOGUE.find((r) => r.id === 'R-EV-TECH')!;
    const empty = { ...seedProfile(user('Technician', 'TML10040'), masters), skills: [], certs: [] };
    const g = gapsFor(empty, tech, REFERENCE_DATE);
    expect(g.ok).toBe(false);
    expect(g.missingSkills).toEqual(['EV-HV-01', 'SAFE-FIRE']);
    expect(g.missingCerts).toEqual(['HVS-1', 'EVT-1', 'FIRE-1']);
    const withExpired = { ...empty, certs: [{ certCode: 'FIRE-1', issuedOn: '2025-01-01', expiresOn: '2026-01-01', certificateNo: 'X' }] };
    expect(gapsFor(withExpired, tech, REFERENCE_DATE).expiredCerts).toEqual(['FIRE-1']);
    const alerts = expiringCertificates(profiles, REFERENCE_DATE);
    expect(alerts.every((a) => a.status !== 'valid')).toBe(true);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.map((a) => a.daysLeft)).toEqual([...alerts.map((a) => a.daysLeft)].sort((a, b) => a - b));
  });

  it('availability counts only active employees, per shift and skill, optionally by level and dealer', () => {
    const all = availabilityBySkill(profiles, masters);
    const total = all.reduce((n, r) => n + r.total, 0);
    expect(total).toBeGreaterThan(0);
    const l4 = availabilityBySkill(profiles, masters, { minLevel: 'L4' }).reduce((n, r) => n + r.total, 0);
    expect(l4).toBeLessThanOrEqual(total);
    const suspended = profiles.map((p) => ({ ...p, user: { ...p.user, status: 'SUSPENDED' as const } }));
    expect(availabilityBySkill(suspended, masters).reduce((n, r) => n + r.total, 0)).toBe(0);
  });
});

describe('what each role sees', () => {
  const role = (id: string) => ROLE_CATALOGUE.find((r) => r.id === id)!;

  it('screens are exactly the screens the role can open', () => {
    const sa = viewsForRole(role('R-SA'), DEFAULT_WORKSHOP_POLICY);
    expect(sa.hasPortalView).toBe(true);
    sa.screens.forEach((s) => expect(canRoleAccessRoute('serviceAdvisor', s.route)).toBe(true));
    expect(sa.screens.some((s) => s.route === '/admin/users')).toBe(false);
    const admin = viewsForRole(role('R-SUPER'), DEFAULT_WORKSHOP_POLICY);
    expect(admin.screens.some((s) => s.route === '/admin/users')).toBe(true);
    expect(admin.screens.length).toBeGreaterThan(sa.screens.length);
  });

  it('tabs, cards and columns come from the Default Views policy', () => {
    const sa = viewsForRole(role('R-SA'), DEFAULT_WORKSHOP_POLICY);
    expect(sa.tabs.find((t) => t.landing)?.id).toBe('my_assignment');
    expect(sa.tabs.find((t) => t.id === 'thd')?.hidden).toBe(true);
    expect(sa.cards.length).toBeGreaterThan(0);
    expect(sa.columns.find((c) => c.tab === 'gate_in')?.visible).toContain('vehicleNo');
    const recept = viewsForRole(role('R-RECEPT'), DEFAULT_WORKSHOP_POLICY);
    expect(recept.tabs.map((t) => t.id)).toEqual(['gate_in', 'my_assignment', 'pre_inspection']);
  });

  it('roles without a portal view say so; permissions are grouped for display', () => {
    expect(viewsForRole(role('R-PAINT'), DEFAULT_WORKSHOP_POLICY).hasPortalView).toBe(false);
    expect(groupPermissions(['*'])).toEqual([{ area: 'Everything', actions: ['*'] }]);
    expect(groupPermissions(['jobcard.read', 'jobcard.create', 'bay.read'])).toEqual([{ area: 'jobcard', actions: ['read', 'create'] }, { area: 'bay', actions: ['read'] }]);
  });
});
