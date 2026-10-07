import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Plus, Trash2, XCircle } from 'lucide-react';
import type { AppUser } from '../../types';
import { useApp } from '../../context/AppContext';
import { useWorkshopPolicy } from '../../data/workshopPolicy';
import { SA_EXPERTISE, SA_EXPERTISE_HELP, type SaExpertise } from '../../data/roleCatalogue';
import {
  SKILL_LEVELS,
  addMonths,
  certStatus,
  daysBetween,
  gapsFor,
  requiredSkillsFor,
  roleOfUser,
  type EmployeeCert,
  type EmployeeProfile,
  type EmployeeSkill,
  type SkillLevel,
} from '../../utils/employeeProfile';
import { groupPermissions, viewsForRole } from '../../utils/roleViews';
import { useEmployeeProfiles } from '../../hooks/useEmployeeProfiles';

const input = 'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-blue-500 focus:outline-hidden';
const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const label = 'mb-1 block text-[11px] font-semibold text-slate-600';
const today = () => new Date().toISOString().slice(0, 10);

const Chip: React.FC<{ tone: 'green' | 'amber' | 'red' | 'slate' | 'blue'; children: React.ReactNode }> = ({ tone, children }) => {
  const cls = { green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-900', red: 'bg-red-100 text-red-800', slate: 'bg-slate-100 text-slate-700', blue: 'bg-blue-100 text-blue-800' }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{children}</span>;
};

/** Employment details: designation, shift, type, status and (Service Advisors) expertise. */
export const EmploymentTab: React.FC<{ user: AppUser }> = ({ user }) => {
  const { showToast, logAudit } = useApp();
  const { profileFor, saveProfile, masters } = useEmployeeProfiles();
  const saved = profileFor(user);
  const [draft, setDraft] = useState<EmployeeProfile>(saved);
  const role = roleOfUser(user);
  const isAdvisor = role?.id === 'R-SA';
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<EmployeeProfile>) => setDraft((d) => ({ ...d, ...patch }));
  const designation = masters.designations.find((d) => d.designationName === draft.designation);
  const activeOnly = <T extends Record<string, any>>(rows: T[]) => rows.filter((r) => String(r.status ?? 'Active') === 'Active');

  const save = () => {
    if (isAdvisor && !draft.expertise) return showToast('Choose the Service Advisor\'s expertise: Mechanical, Bodyshop or Both.', 'error');
    saveProfile(draft);
    logAudit('Employee Profile Updated', 'Administration', `${user.name} (${user.employeeId})`, `${saved.designation} / ${saved.shift}${saved.expertise ? ` / ${saved.expertise}` : ''}`, `${draft.designation} / ${draft.shift}${draft.expertise ? ` / ${draft.expertise}` : ''}`);
    showToast('Employee profile saved.', 'success');
  };

  return (
    <div className="space-y-4" data-testid="employment-tab">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className={label}>Designation</span>
          <select className={input} aria-label="Designation" value={draft.designation} onChange={(e) => set({ designation: e.target.value })}>
            {activeOnly(masters.designations).map((d) => <option key={d.id} value={d.designationName}>{d.designationName}</option>)}
          </select></label>
        <div><span className={label}>Department · Grade · Level</span>
          <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">{designation ? `${designation.department} · ${designation.grade} · ${designation.level}` : '—'}</div></div>
        <label className="block"><span className={label}>Employment type</span>
          <select className={input} aria-label="Employment type" value={draft.employmentType} onChange={(e) => set({ employmentType: e.target.value })}>
            {['Permanent', 'Contract', 'Apprentice', 'Trainee', 'Consultant'].map((v) => <option key={v}>{v}</option>)}
          </select></label>
        <label className="block"><span className={label}>Employment status</span>
          <select className={input} aria-label="Employment status" value={draft.lifecycle} onChange={(e) => set({ lifecycle: e.target.value })}>
            {['Active', 'On Leave', 'On Notice', 'Left'].map((v) => <option key={v}>{v}</option>)}
          </select></label>
        <label className="block"><span className={label}>Date of joining</span>
          <input type="date" className={input} aria-label="Date of joining" value={draft.joinedOn} onChange={(e) => set({ joinedOn: e.target.value })} /></label>
        <label className="block"><span className={label}>Shift</span>
          <select className={input} aria-label="Shift" value={draft.shift} onChange={(e) => set({ shift: e.target.value })}>
            {activeOnly(masters.shifts).map((s) => <option key={s.id} value={s.shiftCode}>{s.shiftName} ({s.startTime}–{s.endTime})</option>)}
          </select></label>
      </div>

      {isAdvisor && (
        <fieldset className="rounded-xl border border-blue-200 bg-blue-50/50 p-3" data-testid="expertise">
          <legend className="px-1 text-[11px] font-bold text-blue-900">Service Advisor expertise</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {SA_EXPERTISE.map((x) => (
              <label key={x} className={`flex cursor-pointer gap-2 rounded-lg border p-2 ${draft.expertise === x ? 'border-blue-500 bg-white' : 'border-slate-200 bg-white/60 hover:bg-white'}`}>
                <input type="radio" name="expertise" checked={draft.expertise === x} onChange={() => set({ expertise: x as SaExpertise })} />
                <span><span className="block font-bold text-slate-900">{x}</span><span className="block text-[11px] text-slate-600">{SA_EXPERTISE_HELP[x]}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex items-center gap-2">
        <button type="button" disabled={!dirty} onClick={save} className={`${btn} bg-emerald-700 text-white hover:bg-emerald-800`}>Save profile</button>
        <button type="button" disabled={!dirty} onClick={() => setDraft(saved)} className={`${btn} text-slate-600 hover:bg-slate-100`}>Undo changes</button>
      </div>
    </div>
  );
};

/** What the employee's role sees: screens, cards, tabs, columns, permissions, and what the role requires. */
export const RoleViewsTab: React.FC<{ user: AppUser }> = ({ user }) => {
  const { policy } = useWorkshopPolicy();
  const role = roleOfUser(user);
  const views = useMemo(() => (role ? viewsForRole(role, policy) : null), [role, policy]);
  if (!role || !views) return <p className="text-xs text-slate-500">This role is not in the Role Catalogue yet.</p>;
  return (
    <div className="space-y-4 text-xs" data-testid="role-views-tab">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-slate-900">{role.name}</span><Chip tone="blue">{role.group}</Chip><Chip tone="slate">{role.side}</Chip></div>
        <p className="mt-1 text-slate-600">{role.description}</p>
        <p className="mt-1 text-slate-500">Works in: {role.modules.join(', ')}</p>
      </div>
      {views.hasPortalView ? (
        <>
          <Section title={`Screens (${views.screens.length})`}>{views.screens.map((s) => <Chip key={s.route} tone="slate">{s.label}</Chip>)}</Section>
          <Section title={`Landing cards (${views.cards.length})`}>{views.cards.map((c) => <Chip key={c.id} tone={c.hidden ? 'amber' : 'blue'}>{c.label}{c.hidden ? ' · hidden by default' : ''}</Chip>)}</Section>
          <Section title={`Worklist tabs (${views.tabs.length})`}>{views.tabs.map((t) => <Chip key={t.id} tone={t.landing ? 'green' : t.hidden ? 'amber' : 'slate'}>{t.label}{t.landing ? ' · opens first' : ''}{t.hidden ? ' · hidden by default' : ''}</Chip>)}</Section>
          <Section title="Default columns by tab">
            <div className="w-full space-y-1">{views.columns.map((c) => <div key={c.tab}><b>{c.label}:</b> <span className="text-slate-600">{c.visible.join(', ')}</span></div>)}</div>
          </Section>
          <Section title="Permissions">{groupPermissions(views.permissions).map((g) => <Chip key={g.area} tone="slate">{g.area}: {g.actions.join(', ')}</Chip>)}</Section>
        </>
      ) : (
        <p className="rounded-lg bg-amber-50 p-2 text-amber-900">This role works in the dealer apps and back-office tools; it has no screens in this portal.</p>
      )}
      <Section title="Needed for this role">
        {requiredSkillsFor(role).length + role.requiredCerts.length === 0 ? <span className="text-slate-500">No skills or certificates required.</span> : null}
        {requiredSkillsFor(role).map((s) => <Chip key={s} tone="blue">Skill {s}</Chip>)}
        {role.requiredCerts.map((c) => <Chip key={c} tone="blue">Certificate {c}</Chip>)}
      </Section>
      <p className="text-slate-500">Screens, cards and tabs follow the Default Views set by the TML admin; Roles &amp; Access → Roles &amp; Position Types shows all roles.</p>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</div><div className="flex flex-wrap gap-1.5">{children}</div></div>
);

/** Skills (with level) and certificates (with expiry) of the employee, with the gaps against the role. */
export const SkillsTab: React.FC<{ user: AppUser }> = ({ user }) => {
  const { showToast, logAudit } = useApp();
  const { profileFor, saveProfile, masters } = useEmployeeProfiles();
  const profile = profileFor(user);
  const role = roleOfUser(user);
  const now = today();
  const gaps = gapsFor(profile, role, now);
  const skillName = (c: string) => String(masters.skills.find((s) => s.skillCode === c)?.skillName ?? c);
  const certMaster = (c: string) => masters.certs.find((x) => x.certCode === c);
  const [skillCode, setSkillCode] = useState('');
  const [level, setLevel] = useState<SkillLevel>('L2');
  const [certCode, setCertCode] = useState('');
  const [issuedOn, setIssuedOn] = useState(now);

  const update = (next: EmployeeProfile, what: string) => {
    saveProfile(next);
    logAudit('Employee Skills Updated', 'Administration', `${user.name} (${user.employeeId})`, '', what);
  };
  const addSkill = () => {
    if (!skillCode) return showToast('Choose a skill to add.', 'error');
    if (profile.skills.some((s) => s.skillCode === skillCode)) return showToast(`${skillCode} is already on this profile.`, 'error');
    const s: EmployeeSkill = { skillCode, level, since: now, source: 'Manual' };
    update({ ...profile, skills: [...profile.skills, s] }, `Added skill ${skillCode} ${level}`);
    setSkillCode('');
  };
  const addCert = () => {
    if (!certCode) return showToast('Choose a certificate to add.', 'error');
    if (profile.certs.some((c) => c.certCode === certCode)) return showToast(`${certCode} is already on this profile.`, 'error');
    const validity = Number(certMaster(certCode)?.validityMonths) || 12;
    const c: EmployeeCert = { certCode, issuedOn, expiresOn: addMonths(issuedOn, validity), certificateNo: `CRT-${Date.now().toString().slice(-6)}` };
    update({ ...profile, certs: [...profile.certs, c] }, `Added certificate ${certCode}`);
    setCertCode('');
  };

  return (
    <div className="space-y-5 text-xs" data-testid="skills-tab">
      <div className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 ${gaps.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`} data-testid="gap-summary">
        {gaps.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <AlertTriangle className="h-4 w-4 text-amber-700" />}
        <span className="font-bold">{gaps.ok ? `Meets everything ${role?.name ?? 'the role'} needs` : `Gaps for ${role?.name ?? 'the role'}:`}</span>
        {gaps.missingSkills.map((c) => <Chip key={c} tone="red">Missing skill: {skillName(c)}</Chip>)}
        {gaps.missingCerts.map((c) => <Chip key={c} tone="red">Missing certificate: {String(certMaster(c)?.certName ?? c)}</Chip>)}
        {gaps.expiredCerts.map((c) => <Chip key={c} tone="red">Expired: {String(certMaster(c)?.certName ?? c)}</Chip>)}
        {gaps.expiringCerts.map((c) => <Chip key={c} tone="amber">Expires soon: {String(certMaster(c)?.certName ?? c)}</Chip>)}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between"><h4 className="font-bold text-slate-900">Skills ({profile.skills.length})</h4></div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left" data-testid="skills-table">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-2 py-1.5">Skill</th><th className="px-2 py-1.5">Level</th><th className="px-2 py-1.5">Since</th><th className="px-2 py-1.5">Source</th><th className="px-2 py-1.5 w-10" /></tr></thead>
            <tbody>
              {profile.skills.map((s) => (
                <tr key={s.skillCode} className="border-t border-slate-100">
                  <td className="px-2 py-1.5"><span className="font-semibold">{skillName(s.skillCode)}</span> <span className="font-mono text-slate-400">{s.skillCode}</span></td>
                  <td className="px-2 py-1.5">
                    <select aria-label={`Level of ${s.skillCode}`} className={`${input} w-20`} value={s.level} onChange={(e) => update({ ...profile, skills: profile.skills.map((x) => (x.skillCode === s.skillCode ? { ...x, level: e.target.value as SkillLevel } : x)) }, `${s.skillCode} level ${e.target.value}`)}>
                      {SKILL_LEVELS.map((l) => <option key={l}>{l}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">{s.since}</td>
                  <td className="px-2 py-1.5">{s.source}</td>
                  <td className="px-2 py-1.5"><button type="button" aria-label={`Remove skill ${s.skillCode}`} className="rounded p-1 text-rose-600 hover:bg-rose-50 cursor-pointer" onClick={() => update({ ...profile, skills: profile.skills.filter((x) => x.skillCode !== s.skillCode) }, `Removed skill ${s.skillCode}`)}><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
              {!profile.skills.length && <tr><td colSpan={5} className="px-2 py-3 text-center text-slate-500">No skills recorded.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="block"><span className={label}>Add skill</span>
            <select aria-label="Skill to add" className={`${input} w-64`} value={skillCode} onChange={(e) => setSkillCode(e.target.value)}>
              <option value="">Select…</option>
              {masters.skills.filter((s) => String(s.status) === 'Active' && !profile.skills.some((k) => k.skillCode === s.skillCode)).map((s) => <option key={s.id} value={s.skillCode}>{s.skillName}</option>)}
            </select></label>
          <label className="block"><span className={label}>Level</span>
            <select aria-label="Level to add" className={`${input} w-20`} value={level} onChange={(e) => setLevel(e.target.value as SkillLevel)}>{SKILL_LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
          <button type="button" onClick={addSkill} className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}><Plus className="h-3.5 w-3.5" /> Add skill</button>
        </div>
      </div>

      <div>
        <h4 className="mb-1 font-bold text-slate-900">Certificates ({profile.certs.length})</h4>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left" data-testid="certs-table">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-2 py-1.5">Certificate</th><th className="px-2 py-1.5">Issued</th><th className="px-2 py-1.5">Expires</th><th className="px-2 py-1.5">Status</th><th className="px-2 py-1.5 w-10" /></tr></thead>
            <tbody>
              {profile.certs.map((c) => {
                const st = certStatus(c.expiresOn, now);
                const left = daysBetween(now, c.expiresOn);
                return (
                  <tr key={c.certCode} className="border-t border-slate-100">
                    <td className="px-2 py-1.5"><span className="font-semibold">{String(certMaster(c.certCode)?.certName ?? c.certCode)}</span> <span className="font-mono text-slate-400">{c.certCode}</span></td>
                    <td className="px-2 py-1.5">{c.issuedOn}</td>
                    <td className="px-2 py-1.5">{c.expiresOn}</td>
                    <td className="px-2 py-1.5">{st === 'valid' ? <Chip tone="green"><CheckCircle2 className="h-3 w-3" /> Valid</Chip> : st === 'expiring' ? <Chip tone="amber"><AlertTriangle className="h-3 w-3" /> {left} days left</Chip> : <Chip tone="red"><XCircle className="h-3 w-3" /> Expired {-left} days ago</Chip>}</td>
                    <td className="px-2 py-1.5"><button type="button" aria-label={`Remove certificate ${c.certCode}`} className="rounded p-1 text-rose-600 hover:bg-rose-50 cursor-pointer" onClick={() => update({ ...profile, certs: profile.certs.filter((x) => x.certCode !== c.certCode) }, `Removed certificate ${c.certCode}`)}><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                );
              })}
              {!profile.certs.length && <tr><td colSpan={5} className="px-2 py-3 text-center text-slate-500">No certificates recorded.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="block"><span className={label}>Add certificate</span>
            <select aria-label="Certificate to add" className={`${input} w-64`} value={certCode} onChange={(e) => setCertCode(e.target.value)}>
              <option value="">Select…</option>
              {masters.certs.filter((c) => String(c.status) === 'Active' && !profile.certs.some((k) => k.certCode === c.certCode)).map((c) => <option key={c.id} value={c.certCode}>{c.certName}</option>)}
            </select></label>
          <label className="block"><span className={label}>Issued on</span><input type="date" aria-label="Issued on" className={`${input} w-40`} value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} /></label>
          <button type="button" onClick={addCert} className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}><Plus className="h-3.5 w-3.5" /> Add certificate</button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Expiry = issue date + the certificate's validity in the Certification Master. Levels L1–L4 follow the Skill Level Master.</p>
      </div>
    </div>
  );
};

