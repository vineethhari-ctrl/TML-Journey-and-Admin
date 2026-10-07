import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertTriangle, Download, Search, Users } from 'lucide-react';
import type { AppUser } from '../../types';
import { ROLE_CATALOGUE, SA_EXPERTISE } from '../../data/roleCatalogue';
import {
  SKILL_LEVELS,
  advisorsByExpertise,
  availabilityBySkill,
  expiringCertificates,
  gapsFor,
  isAvailable,
  roleOfUser,
  type SkillLevel,
} from '../../utils/employeeProfile';
import { downloadWorkbook } from '../../utils/masterWorkbook';
import { useEmployeeProfiles } from '../../hooks/useEmployeeProfiles';

const input = 'px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-blue-500 focus:outline-hidden';
const today = () => new Date().toISOString().slice(0, 10);
const LEVEL_CLS: Record<string, string> = { L1: 'bg-slate-100 text-slate-700', L2: 'bg-blue-100 text-blue-800', L3: 'bg-indigo-100 text-indigo-800', L4: 'bg-emerald-100 text-emerald-800' };

const Stat: React.FC<{ label: string; value: number; tone?: 'red' | 'amber' | 'green' | 'blue' }> = ({ label, value, tone = 'blue' }) => {
  const cls = { red: 'text-red-700', amber: 'text-amber-700', green: 'text-emerald-700', blue: 'text-blue-900' }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className={`text-2xl font-black ${cls}`}>{value}</div>
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
    </div>
  );
};

interface PanelProps {
  searchQuery: string;
  onOpenEmployee: (user: AppUser) => void;
}

/** Employees × skills: level held, gaps against the role, expiring certificates; exportable to Excel. */
export const SkillsMatrixPanel: React.FC<PanelProps> = ({ searchQuery, onOpenEmployee }) => {
  const { rows, masters } = useEmployeeProfiles();
  const now = today();
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [dealerFilter, setDealerFilter] = useState('ALL');
  const [gapsOnly, setGapsOnly] = useState(false);
  const skills = masters.skills.filter((s) => String(s.status) === 'Active');
  const dealers = useMemo(() => [...new Set(rows.map((r) => r.user.dealer))].sort(), [rows]);

  const enriched = useMemo(() => rows.map((r) => ({ ...r, role: roleOfUser(r.user), gaps: gapsFor(r.profile, roleOfUser(r.user), now) })), [rows, now]);
  const q = searchQuery.trim().toLowerCase();
  const shown = enriched.filter(
    (r) =>
      (roleFilter === 'ALL' || r.role?.id === roleFilter) &&
      (dealerFilter === 'ALL' || r.user.dealer === dealerFilter) &&
      (!gapsOnly || !r.gaps.ok) &&
      (!q || `${r.user.name} ${r.user.employeeId} ${r.profile.designation} ${r.user.dealer}`.toLowerCase().includes(q)),
  );
  const alerts = useMemo(() => expiringCertificates(rows, now), [rows, now]);
  const withGaps = enriched.filter((r) => !r.gaps.ok).length;

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const header = ['Employee ID', 'Name', 'Role', 'Designation', 'Dealer', 'Shift', 'Expertise', ...skills.map((s) => String(s.skillName)), 'Gaps'];
    const data = shown.map((r) => [
      r.user.employeeId, r.user.name, r.user.role, r.profile.designation, r.user.dealer, r.profile.shift, r.profile.expertise ?? '',
      ...skills.map((s) => r.profile.skills.find((k) => k.skillCode === s.skillCode)?.level ?? ''),
      [...r.gaps.missingSkills.map((c) => `Missing skill ${c}`), ...r.gaps.missingCerts.map((c) => `Missing certificate ${c}`), ...r.gaps.expiredCerts.map((c) => `Expired ${c}`)].join('; '),
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...data]), 'Skills matrix');
    downloadWorkbook(wb, `TML_Skills_Matrix_${now}.xlsx`);
  };

  return (
    <div className="space-y-4 p-4" data-testid="skills-matrix-panel">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Employees" value={enriched.length} />
        <Stat label="With a skill / certificate gap" value={withGaps} tone={withGaps ? 'amber' : 'green'} />
        <Stat label="Certificates expired" value={alerts.filter((a) => a.status === 'expired').length} tone="red" />
        <Stat label="Certificates expiring in 60 days" value={alerts.filter((a) => a.status === 'expiring').length} tone="amber" />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select className={input} aria-label="Role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="ALL">All roles</option>
          {ROLE_CATALOGUE.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select className={input} aria-label="Dealer" value={dealerFilter} onChange={(e) => setDealerFilter(e.target.value)}>
          <option value="ALL">All dealers</option>
          {dealers.map((d) => <option key={d}>{d}</option>)}
        </select>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={gapsOnly} onChange={(e) => setGapsOnly(e.target.checked)} /> Only people with gaps</label>
        <span className="text-slate-500">{shown.length} employees</span>
        <button type="button" onClick={exportExcel} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
          <Download className="h-3.5 w-3.5" /> Export to Excel
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-[11px]" data-testid="skills-matrix">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 uppercase">Employee</th>
              <th className="px-2 py-2 uppercase">Designation</th>
              {skills.map((s) => <th key={s.id} className="px-1.5 py-2 text-center font-semibold" title={String(s.skillName)}>{String(s.skillCode)}</th>)}
              <th className="px-2 py-2 uppercase">Gaps</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ user, profile, role, gaps }) => {
              const needed = new Set([...gaps.missingSkills]);
              return (
                <tr key={user.employeeId} className="border-t border-slate-100 hover:bg-slate-50/70" data-testid="matrix-row">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
                    <button type="button" onClick={() => onOpenEmployee(user)} className="text-left font-semibold text-blue-800 hover:underline cursor-pointer">{user.name}</button>
                    <div className="text-slate-400">{user.employeeId} · {role?.name ?? user.role}{profile.expertise ? ` · ${profile.expertise}` : ''}</div>
                  </td>
                  <td className="px-2 py-1.5">{profile.designation}</td>
                  {skills.map((s) => {
                    const held = profile.skills.find((k) => k.skillCode === s.skillCode);
                    const missing = needed.has(String(s.skillCode));
                    return (
                      <td key={s.id} className="px-1 py-1 text-center">
                        {held ? <span className={`inline-block rounded px-1.5 py-0.5 font-bold ${LEVEL_CLS[held.level]}`}>{held.level}</span> : missing ? <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 font-bold text-red-700" title="Required but not held">!</span> : <span className="text-slate-300">–</span>}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5">
                    {gaps.ok ? <span className="text-emerald-700">OK</span> : <span className="text-amber-800">{[...gaps.missingSkills, ...gaps.missingCerts, ...gaps.expiredCerts].join(', ')}</span>}
                  </td>
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={skills.length + 3} className="px-3 py-6 text-center text-slate-500">No employees match.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">L1–L4 = proficiency level · <span className="rounded bg-red-100 px-1 font-bold text-red-700">!</span> = skill the role requires but the employee does not hold · skill codes come from the Skill Master (hover for the name).</p>

      <div>
        <h3 className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-900"><AlertTriangle className="h-4 w-4 text-amber-600" /> Certificates to renew ({alerts.length})</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-[11px]" data-testid="cert-alerts">
            <thead className="bg-slate-50 text-slate-500 uppercase"><tr><th className="px-3 py-2">Employee</th><th className="px-2 py-2">Certificate</th><th className="px-2 py-2">Expires</th><th className="px-2 py-2">Status</th></tr></thead>
            <tbody>
              {alerts.slice(0, 12).map((a) => (
                <tr key={`${a.user.employeeId}-${a.cert.certCode}`} className="border-t border-slate-100">
                  <td className="px-3 py-1.5"><button type="button" onClick={() => onOpenEmployee(a.user)} className="font-semibold text-blue-800 hover:underline cursor-pointer">{a.user.name}</button> <span className="text-slate-400">{a.user.dealer}</span></td>
                  <td className="px-2 py-1.5">{String(masters.certs.find((c) => c.certCode === a.cert.certCode)?.certName ?? a.cert.certCode)}</td>
                  <td className="px-2 py-1.5">{a.cert.expiresOn}</td>
                  <td className="px-2 py-1.5">{a.status === 'expired' ? <span className="font-bold text-red-700">Expired {-a.daysLeft} days ago</span> : <span className="font-bold text-amber-700">{a.daysLeft} days left</span>}</td>
                </tr>
              ))}
              {!alerts.length && <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-500">Nothing to renew.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/** Who is available, by skill and shift; Service Advisors by expertise; a finder for "who can do this". */
export const AvailabilityPanel: React.FC<PanelProps> = ({ onOpenEmployee }) => {
  const { rows, masters } = useEmployeeProfiles();
  const [dealer, setDealer] = useState('ALL');
  const [minLevel, setMinLevel] = useState<SkillLevel>('L1');
  const [findSkill, setFindSkill] = useState('');
  const [findShift, setFindShift] = useState('ALL');
  const dealers = useMemo(() => [...new Set(rows.map((r) => r.user.dealer))].sort(), [rows]);
  const d = dealer === 'ALL' ? undefined : dealer;
  const shifts = masters.shifts.filter((s) => String(s.status) === 'Active');
  const grid = useMemo(() => availabilityBySkill(rows, masters, { dealer: d, minLevel }), [rows, masters, d, minLevel]);
  const advisors = useMemo(() => advisorsByExpertise(rows, d), [rows, d]);
  const pool = rows.filter((r) => isAvailable(r.user, r.profile) && (!d || r.user.dealer === d));
  const found = findSkill
    ? pool.filter((r) => {
        const k = r.profile.skills.find((s) => s.skillCode === findSkill);
        return k && SKILL_LEVELS.indexOf(k.level) >= SKILL_LEVELS.indexOf(minLevel) && (findShift === 'ALL' || r.profile.shift === findShift);
      })
    : [];

  return (
    <div className="space-y-5 p-4" data-testid="availability-panel">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Users className="h-4 w-4 text-blue-800" />
        <select className={input} aria-label="Dealer" value={dealer} onChange={(e) => setDealer(e.target.value)}>
          <option value="ALL">All dealers</option>
          {dealers.map((x) => <option key={x}>{x}</option>)}
        </select>
        <label className="inline-flex items-center gap-1">Minimum level
          <select className={input} aria-label="Minimum level" value={minLevel} onChange={(e) => setMinLevel(e.target.value as SkillLevel)}>{SKILL_LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
        </label>
        <span className="text-slate-500">{pool.length} employees available (Active account, not on leave / notice / left)</span>
      </div>

      <div>
        <h3 className="mb-1 text-xs font-bold text-slate-900">Service Advisors by expertise</h3>
        <div className="grid gap-3 md:grid-cols-3" data-testid="advisor-expertise">
          {SA_EXPERTISE.map((x) => (
            <div key={x} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-baseline justify-between"><span className="text-xs font-bold text-slate-900">{x}</span><span className="text-2xl font-black text-blue-900">{advisors[x].length}</span></div>
              <div className="mt-1 flex flex-wrap gap-1">
                {advisors[x].slice(0, 8).map(({ user, profile }) => (
                  <button key={user.employeeId} type="button" onClick={() => onOpenEmployee(user)} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-blue-100 cursor-pointer" title={`${user.dealer} · shift ${profile.shift}`}>{user.name}</button>
                ))}
                {advisors[x].length > 8 && <span className="text-[10px] text-slate-500">+{advisors[x].length - 8} more</span>}
                {!advisors[x].length && <span className="text-[11px] text-slate-400">none available</span>}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">Mechanical: mechanical job cards · Bodyshop: bodyshop / accident / insurance job cards · Both: either kind.</p>
      </div>

      <div>
        <h3 className="mb-1 text-xs font-bold text-slate-900">Available people by skill and shift</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-[11px]" data-testid="availability-grid">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr><th className="px-3 py-2">Skill</th>{shifts.map((s) => <th key={s.id} className="px-2 py-2 text-center" title={`${s.startTime}–${s.endTime}`}>{String(s.shiftName)}</th>)}<th className="px-2 py-2 text-center">Total</th></tr>
            </thead>
            <tbody>
              {grid.map((g) => (
                <tr key={g.skillCode} className="border-t border-slate-100">
                  <td className="px-3 py-1.5"><span className="font-semibold">{g.skillName}</span> <span className="font-mono text-slate-400">{g.skillCode}</span></td>
                  {shifts.map((s) => <td key={s.id} className={`px-2 py-1.5 text-center ${g.byShift[String(s.shiftCode)] ? 'font-bold text-slate-900' : 'text-red-400'}`}>{g.byShift[String(s.shiftCode)] ?? 0}</td>)}
                  <td className="px-2 py-1.5 text-center font-bold">{g.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3" data-testid="finder">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-900"><Search className="h-4 w-4" /> Who can do this?</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select className={`${input} w-72`} aria-label="Skill needed" value={findSkill} onChange={(e) => setFindSkill(e.target.value)}>
            <option value="">Choose a skill…</option>
            {masters.skills.filter((s) => String(s.status) === 'Active').map((s) => <option key={s.id} value={s.skillCode}>{s.skillName}</option>)}
          </select>
          <select className={input} aria-label="Shift" value={findShift} onChange={(e) => setFindShift(e.target.value)}>
            <option value="ALL">Any shift</option>
            {shifts.map((s) => <option key={s.id} value={s.shiftCode}>{s.shiftName}</option>)}
          </select>
          <span className="text-slate-500">at level {minLevel} or above</span>
        </div>
        {findSkill && (
          <div className="mt-2 flex flex-wrap gap-1.5" data-testid="finder-results">
            {found.map(({ user, profile }) => (
              <button key={user.employeeId} type="button" onClick={() => onOpenEmployee(user)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-left hover:border-blue-400 cursor-pointer">
                <span className="block font-semibold text-slate-900">{user.name}</span>
                <span className="block text-[10px] text-slate-500">{user.dealer} · {profile.shift} · {profile.skills.find((s) => s.skillCode === findSkill)?.level}</span>
              </button>
            ))}
            {!found.length && <span className="text-[11px] text-slate-500">Nobody available matches.</span>}
          </div>
        )}
      </div>
    </div>
  );
};
