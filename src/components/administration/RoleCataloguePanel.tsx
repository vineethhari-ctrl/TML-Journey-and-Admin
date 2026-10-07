import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Search, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ROLE_CATALOGUE, ROLE_GROUPS, SA_EXPERTISE, type CatalogueRole } from '../../data/roleCatalogue';
import { useWorkshopPolicy } from '../../data/workshopPolicy';
import { gapsFor, requiredSkillsFor, roleOfUser } from '../../utils/employeeProfile';
import { groupPermissions, viewsForRole } from '../../utils/roleViews';
import { downloadWorkbook } from '../../utils/masterWorkbook';
import { useEmployeeProfiles } from '../../hooks/useEmployeeProfiles';

const input = 'px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-blue-500 focus:outline-hidden';
const Chip: React.FC<{ tone?: 'blue' | 'amber' | 'green' | 'slate'; children: React.ReactNode }> = ({ tone = 'slate', children }) => {
  const cls = { blue: 'bg-blue-100 text-blue-800', amber: 'bg-amber-100 text-amber-900', green: 'bg-emerald-100 text-emerald-800', slate: 'bg-slate-100 text-slate-700' }[tone];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{children}</span>;
};
const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div><div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</div><div className="flex flex-wrap gap-1.5">{children}</div></div>
);

/**
 * Roles & Position Types: every role in the application with the screens, cards, tabs and columns it sees, its
 * permissions, how many people hold it, and the skills and certificates it requires.
 */
export const RoleCataloguePanel: React.FC = () => {
  const { roles } = useApp();
  const { policy } = useWorkshopPolicy();
  const { rows, masters } = useEmployeeProfiles();
  const [group, setGroup] = useState('ALL');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('R-SA');
  const now = new Date().toISOString().slice(0, 10);

  const people = useMemo(() => {
    const by = new Map<string, typeof rows>();
    rows.forEach((r) => {
      const role = roleOfUser(r.user);
      if (role) by.set(role.id, [...(by.get(role.id) ?? []), r]);
    });
    return by;
  }, [rows]);

  const q = query.trim().toLowerCase();
  const list = ROLE_CATALOGUE.filter((r) => (group === 'ALL' || r.group === group) && (!q || `${r.name} ${r.description} ${r.modules.join(' ')}`.toLowerCase().includes(q)));
  const selected = ROLE_CATALOGUE.find((r) => r.id === selectedId) ?? ROLE_CATALOGUE[0];
  const views = useMemo(() => viewsForRole(selected, policy), [selected, policy]);
  const holders = people.get(selected.id) ?? [];
  const adminRole = roles.find((r) => r.name === selected.adminRoleName);
  const skillName = (c: string) => String(masters.skills.find((s) => s.skillCode === c)?.skillName ?? c);
  const certName = (c: string) => String(masters.certs.find((x) => x.certCode === c)?.certName ?? c);
  const withGaps = holders.filter((h) => !gapsFor(h.profile, selected, now).ok).length;

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const header = ['Role', 'Group', 'Side', 'Description', 'Works in', 'People', 'Portal screens', 'Landing cards', 'Worklist tabs', 'Required skills', 'Required certificates'];
    const data = ROLE_CATALOGUE.map((r) => {
      const v = viewsForRole(r, policy);
      return [
        r.name, r.group, r.side, r.description, r.modules.join(', '), people.get(r.id)?.length ?? 0,
        v.screens.map((s) => s.label).join('; '), v.cards.map((c) => c.label).join('; '), v.tabs.map((t) => t.label).join('; '),
        requiredSkillsFor(r).map(skillName).join('; '), r.requiredCerts.map(certName).join('; '),
      ];
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...data]), 'Role catalogue');
    downloadWorkbook(wb, `TML_Role_Catalogue_${now}.xlsx`);
  };

  const detail = (r: CatalogueRole) => (
    <div className="space-y-4 text-xs" data-testid="role-detail">
      <div>
        <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black text-slate-900">{r.name}</h3><Chip tone="blue">{r.group}</Chip><Chip>{r.side}</Chip></div>
        <p className="mt-1 text-slate-600">{r.description}</p>
        <p className="mt-1 text-slate-500">Works in: {r.modules.join(', ')}{r.designation ? ` · Designation: ${r.designation}` : ''}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-50 p-2"><div className="text-lg font-black text-blue-900">{holders.length}</div><div className="text-[11px] text-slate-500">people hold this role</div></div>
        <div className="rounded-lg bg-slate-50 p-2"><div className={`text-lg font-black ${withGaps ? 'text-amber-700' : 'text-emerald-700'}`}>{withGaps}</div><div className="text-[11px] text-slate-500">with skill / certificate gaps</div></div>
        <div className="rounded-lg bg-slate-50 p-2"><div className="text-lg font-black text-blue-900">{adminRole?.userCount ?? '—'}</div><div className="text-[11px] text-slate-500">users in Roles & Access</div></div>
      </div>

      {r.id === 'R-SA' && (
        <Block title="Expertise of the Service Advisors">
          {SA_EXPERTISE.map((x) => <Chip key={x} tone="blue">{x}: {holders.filter((h) => h.profile.expertise === x).length}</Chip>)}
          <span className="basis-full text-[11px] text-slate-500">Each Service Advisor is Mechanical, Bodyshop or Both — set on the employee's Employment tab. It decides which job cards he or she can create and which skill is required.</span>
        </Block>
      )}

      {views.hasPortalView ? (
        <>
          <Block title={`Screens in this portal (${views.screens.length})`}>{views.screens.map((s) => <Chip key={s.route}>{s.label}</Chip>)}</Block>
          <Block title={`Landing-page cards (${views.cards.length})`}>{views.cards.map((c) => <Chip key={c.id} tone={c.hidden ? 'amber' : 'blue'}>{c.label}{c.hidden ? ' · hidden by default' : ''}</Chip>)}</Block>
          <Block title={`Worklist tabs (${views.tabs.length})`}>{views.tabs.map((t) => <Chip key={t.id} tone={t.landing ? 'green' : t.hidden ? 'amber' : 'slate'}>{t.label}{t.landing ? ' · opens first' : ''}{t.hidden ? ' · hidden by default' : ''}</Chip>)}</Block>
          <Block title="Default columns">
            <div className="w-full space-y-0.5">{views.columns.map((c) => <div key={c.tab}><b>{c.label}:</b> <span className="text-slate-600">{c.visible.join(', ')}</span></div>)}</div>
          </Block>
          <Block title="Permissions">{groupPermissions(views.permissions).map((g) => <Chip key={g.area}>{g.area}: {g.actions.join(', ')}</Chip>)}</Block>
        </>
      ) : (
        <p className="rounded-lg bg-amber-50 p-2 text-amber-900">This role works in the dealer apps and back-office tools and has no screens in this portal.</p>
      )}

      {adminRole && (
        <Block title="Module permissions (Roles & Access)">
          {adminRole.permissions.map((p) => (
            <Chip key={p.module} tone={p.create || p.edit ? 'blue' : 'slate'}>
              {p.module}: {['view', 'create', 'edit', 'approve', 'delete', 'export'].filter((a) => p[a as keyof typeof p]).join(' / ') || 'none'}
            </Chip>
          ))}
        </Block>
      )}

      <Block title="Needed for this role">
        {requiredSkillsFor(r).length + r.requiredCerts.length === 0 && <span className="text-slate-500">No skills or certificates required.</span>}
        {requiredSkillsFor(r).map((c) => <Chip key={c} tone="blue">Skill: {skillName(c)}</Chip>)}
        {r.requiredCerts.map((c) => <Chip key={c} tone="blue">Certificate: {certName(c)}</Chip>)}
      </Block>
    </div>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white" data-testid="role-catalogue">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
        <div className="mr-auto">
          <h2 className="text-sm font-black text-slate-900">Roles &amp; Position Types</h2>
          <p className="text-[11px] text-slate-500">Every role in the application — what it sees, what it can do, how many people hold it and what skills it needs.</p>
        </div>
        <div className="relative"><Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
          <input className={`${input} w-52 pl-7`} placeholder="Find a role or module" aria-label="Find a role" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <select className={input} aria-label="Group" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="ALL">All groups</option>
          {ROLE_GROUPS.map((g) => <option key={g}>{g}</option>)}
        </select>
        <button type="button" onClick={exportExcel} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"><Download className="h-3.5 w-3.5" /> Export to Excel</button>
      </div>
      <div className="grid md:grid-cols-[22rem_1fr]">
        <ul className="max-h-[40rem] overflow-y-auto border-b border-slate-200 md:border-b-0 md:border-r" data-testid="role-list">
          {ROLE_GROUPS.filter((g) => list.some((r) => r.group === g)).map((g) => (
            <li key={g}>
              <div className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{g}</div>
              <ul>
                {list.filter((r) => r.group === g).map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setSelectedId(r.id)} aria-pressed={r.id === selected.id} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs cursor-pointer ${r.id === selected.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                      <span className="flex-1"><span className="block font-bold text-slate-900">{r.name}</span><span className="block text-[11px] text-slate-500">{r.modules.slice(0, 3).join(', ')}{r.modules.length > 3 ? '…' : ''}</span></span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500"><Users className="h-3 w-3" />{people.get(r.id)?.length ?? 0}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {!list.length && <li className="px-3 py-6 text-center text-xs text-slate-500">No role matches.</li>}
        </ul>
        <div className="p-4">{detail(selected)}</div>
      </div>
    </div>
  );
};
