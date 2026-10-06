import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Lock, RotateCcw, Save, Star } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEFAULT_COLUMNS, GRID_COLUMNS, LANDING_CARDS, RoleWorkshopPolicy, WORKSHOP_TABS, policyForRole, useWorkshopPolicy } from '../data/workshopPolicy';
import { usePersonalisationSettings } from '../utils/personalisationSettings';
import { moveItem, normalizeColumnPreference, normalizeTabPreference, setColumnVisible, MIN_VISIBLE_TABS } from '../utils/viewPreferences';

const ROLES: Array<[string, string]> = [
  ['default', 'All other roles (default)'],
  ['serviceAdvisor', 'Service Advisor'],
  ['receptionist', 'Receptionist'],
  ['securityGuard', 'Security Guard'],
  ['driver', 'Driver'],
  ['dgm', 'DGM'],
  ['dealerAdmin', 'Dealer Admin'],
  ['cro', 'CRO (Telecaller)'],
];

const GRID_LABEL: Record<string, string> = { gate_in: "Today's Total Gate-In", my_assignment: 'My Assignment', mr_details: 'MR Details' };

/** Keep the role policy consistent: landing tab visible and allowed, at least 2 tabs visible. */
function tidy(p: RoleWorkshopPolicy): RoleWorkshopPolicy {
  const allowed = WORKSHOP_TABS.map((t) => t.id).filter((id) => p.allowedTabs.includes(id));
  const tabs = normalizeTabPreference({ ...p.tabs, hiddenTabs: p.tabs.hiddenTabs.filter((h) => allowed.includes(h)) }, allowed, p.tabs);
  const cardsAllowed = LANDING_CARDS.map((c) => c.id).filter((id) => p.cards!.allowed.includes(id));
  const layout = normalizeTabPreference({ ...p.cards!.layout, hiddenTabs: p.cards!.layout.hiddenTabs.filter((h) => cardsAllowed.includes(h)) }, cardsAllowed, p.cards!.layout);
  return { ...p, allowedTabs: allowed, tabs, cards: { allowed: cardsAllowed, layout } };
}

/**
 * Admin Portal → Workshop Tabs & Columns: which workflow tabs each role may use, the default tab layout, and the lean
 * default columns per worklist. Users personalise within this; tabs not allowed here never appear for the role.
 */
export const WorkshopPolicyPage: React.FC = () => {
  const { logAudit, showToast } = useApp();
  const { policy, saveRole } = useWorkshopPolicy();
  const [roleId, setRoleId] = useState('serviceAdvisor');
  const [draft, setDraft] = useState<RoleWorkshopPolicy>(() => tidy(policyForRole(policy, 'serviceAdvisor')));
  const [message, setMessage] = useState('');
  useEffect(() => {
    // tidy() lists every allowed tab, including ones hidden by default
    setDraft(tidy(policyForRole(policy, roleId)));
    setMessage('');
  }, [roleId, policy]);

  const tabs = draft.tabs;
  const visibleCount = tabs.tabOrder.filter((t) => !tabs.hiddenTabs.includes(t)).length;
  const label = (id: string) => WORKSHOP_TABS.find((t) => t.id === id)?.label ?? id;
  const update = (next: RoleWorkshopPolicy) => setDraft(tidy(next));

  const toggleAllowed = (id: string, on: boolean) => {
    const allowedTabs = on ? [...draft.allowedTabs, id] : draft.allowedTabs.filter((a) => a !== id);
    if (allowedTabs.length < MIN_VISIBLE_TABS) return setMessage(`A role needs at least ${MIN_VISIBLE_TABS} tabs.`);
    setMessage('');
    update({ ...draft, allowedTabs, tabs: { ...tabs, tabOrder: on ? [...tabs.tabOrder, id] : tabs.tabOrder } });
  };
  const toggleVisible = (id: string, on: boolean) => {
    if (!on && visibleCount <= MIN_VISIBLE_TABS) return setMessage(`At least ${MIN_VISIBLE_TABS} tabs must be visible by default.`);
    setMessage('');
    update({ ...draft, tabs: { ...tabs, hiddenTabs: on ? tabs.hiddenTabs.filter((h) => h !== id) : [...tabs.hiddenTabs, id] } });
  };
  const toggleColumn = (grid: string, key: string, on: boolean) => {
    const current = normalizeColumnPreference(draft.columns[grid], GRID_COLUMNS[grid].map((c) => c.key), DEFAULT_COLUMNS[grid]);
    const next = setColumnVisible(current, key, on);
    if (next) setDraft({ ...draft, columns: { ...draft.columns, [grid]: next } });
  };

  const cards = draft.cards!;
  const cardLabel = (id: string) => LANDING_CARDS.find((c) => c.id === id)?.label ?? id;
  const visibleCards = cards.layout.tabOrder.filter((c) => !cards.layout.hiddenTabs.includes(c)).length;
  const setCards = (next: Partial<typeof cards>) => update({ ...draft, cards: { ...cards, ...next } });
  const toggleCardAllowed = (id: string, on: boolean) => {
    const allowed = on ? [...cards.allowed, id] : cards.allowed.filter((a) => a !== id);
    if (allowed.length < MIN_VISIBLE_TABS) return setMessage(`A role needs at least ${MIN_VISIBLE_TABS} cards.`);
    setMessage('');
    setCards({ allowed, layout: { ...cards.layout, tabOrder: on ? [...cards.layout.tabOrder, id] : cards.layout.tabOrder } });
  };
  const toggleCardVisible = (id: string, on: boolean) => {
    if (!on && visibleCards <= MIN_VISIBLE_TABS) return setMessage(`At least ${MIN_VISIBLE_TABS} cards must be shown by default.`);
    setMessage('');
    const hiddenTabs = on ? cards.layout.hiddenTabs.filter((h) => h !== id) : [...cards.layout.hiddenTabs, id];
    setCards({ layout: { ...cards.layout, hiddenTabs } });
  };
  const { settings, save: saveSettings } = usePersonalisationSettings();

  const save = () => {
    const before = policyForRole(policy, roleId);
    saveRole(roleId, draft);
    logAudit('Workshop Policy Updated', 'Administration', `Workshop tabs & columns: ${roleId}`, `${before.allowedTabs.length} tabs allowed`, `${draft.allowedTabs.length} tabs allowed, landing ${draft.tabs.defaultLandingTab}`);
    showToast(`Saved tabs & columns for ${ROLES.find((r) => r[0] === roleId)?.[1]}`, 'success');
  };
  const reset = () => {
    saveRole(roleId, null);
    logAudit('Workshop Policy Reset', 'Administration', `Workshop tabs & columns: ${roleId}`, 'custom', 'built-in default');
    showToast('Restored the built-in default for this role', 'info');
  };

  return (
    <div className="space-y-4 p-4 sm:p-6" data-testid="workshop-policy">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Workshop Tabs &amp; Columns</h1>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Personalisation defaults per role: landing cards, tabs, columns</p>
          <p className="text-xs text-slate-500">
            Which workflow tabs each role sees, the default layout, and the default columns. Users can personalise within this; users who already did keep
            their layout, but a tab you disallow disappears for them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="policy-role" className="text-xs font-semibold text-slate-600">Role</label>
          <select id="policy-role" value={roleId} onChange={(e) => setRoleId(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold">
            {ROLES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs" data-testid="personalisation-setting">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Personal layouts after logout</h2>
          <p className="text-slate-500">
            {settings.keepAfterLogout
              ? 'Kept: each user sees their own cards, tabs and columns again at the next login.'
              : 'Reset (BU rule): every user is back on the default view after logging out. Changes last only for the session.'}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={settings.keepAfterLogout}
            onChange={(e) => {
              saveSettings({ keepAfterLogout: e.target.checked });
              logAudit('Personalisation Setting Updated', 'Administration', 'Keep personal layouts after logout', String(!e.target.checked), String(e.target.checked));
            }}
          />
          Keep personal layouts after logout
        </label>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-xs" data-testid="card-policy">
        <h2 className="mb-1 text-sm font-bold text-slate-900">Landing page cards</h2>
        <p className="mb-2 text-slate-500">Cards this role may see on Home, which are shown by default and in what order. Users can hide or reorder their own.</p>
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
          {[...cards.layout.tabOrder, ...LANDING_CARDS.map((c) => c.id).filter((id) => !cards.allowed.includes(id))].map((id, i) => {
            const allowed = cards.allowed.includes(id);
            const shown = allowed && !cards.layout.hiddenTabs.includes(id);
            return (
              <div key={id} className="flex items-center gap-2 border-t border-slate-100 py-1.5">
                <span className={`flex-1 ${allowed ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{cardLabel(id)}</span>
                <label className="flex items-center gap-1 text-[11px] text-slate-500">
                  <input type="checkbox" aria-label={`Allow card ${cardLabel(id)}`} checked={allowed} onChange={(e) => toggleCardAllowed(id, e.target.checked)} /> allowed
                </label>
                <label className="flex items-center gap-1 text-[11px] text-slate-500">
                  <input type="checkbox" aria-label={`Show card ${cardLabel(id)} by default`} disabled={!allowed} checked={shown} onChange={(e) => toggleCardVisible(id, e.target.checked)} /> shown
                </label>
                {allowed && (
                  <span className="whitespace-nowrap">
                    <button type="button" disabled={i === 0} aria-label={`Move card ${cardLabel(id)} up`} onClick={() => setCards({ layout: { ...cards.layout, tabOrder: moveItem(cards.layout.tabOrder, id, -1) } })} className="text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" disabled={i === cards.layout.tabOrder.length - 1} aria-label={`Move card ${cardLabel(id)} down`} onClick={() => setCards({ layout: { ...cards.layout, tabOrder: moveItem(cards.layout.tabOrder, id, 1) } })} className="text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
          <h2 className="mb-2 text-sm font-bold text-slate-900">Tabs</h2>
          <table className="w-full">
            <thead className="text-left text-[11px] text-slate-500">
              <tr>
                <th className="py-1 font-semibold">Tab</th>
                <th className="py-1 font-semibold">Allowed</th>
                <th className="py-1 font-semibold">Visible by default</th>
                <th className="py-1 font-semibold">Landing</th>
                <th className="py-1 font-semibold">Order</th>
              </tr>
            </thead>
            <tbody>
              {[...tabs.tabOrder, ...WORKSHOP_TABS.map((t) => t.id).filter((id) => !draft.allowedTabs.includes(id))].map((id, i) => {
                const allowed = draft.allowedTabs.includes(id);
                const shown = allowed && !tabs.hiddenTabs.includes(id);
                return (
                  <tr key={id} className="border-t border-slate-100">
                    <td className={`py-1.5 ${allowed ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{label(id)}</td>
                    <td><input type="checkbox" aria-label={`Allow ${label(id)}`} checked={allowed} onChange={(e) => toggleAllowed(id, e.target.checked)} /></td>
                    <td><input type="checkbox" aria-label={`Show ${label(id)} by default`} disabled={!allowed} checked={shown} onChange={(e) => toggleVisible(id, e.target.checked)} /></td>
                    <td>
                      <button
                        type="button"
                        disabled={!shown}
                        aria-label={`Land on ${label(id)}`}
                        onClick={() => update({ ...draft, tabs: { ...tabs, defaultLandingTab: id } })}
                        className={`cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 ${tabs.defaultLandingTab === id ? 'text-amber-500' : 'text-slate-300'}`}
                      >
                        <Star className="h-4 w-4" fill={tabs.defaultLandingTab === id ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="whitespace-nowrap">
                      {allowed && (
                        <>
                          <button type="button" disabled={i === 0} aria-label={`Move ${label(id)} up`} onClick={() => update({ ...draft, tabs: { ...tabs, tabOrder: moveItem(tabs.tabOrder, id, -1) } })} className="text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" disabled={i === tabs.tabOrder.length - 1} aria-label={`Move ${label(id)} down`} onClick={() => update({ ...draft, tabs: { ...tabs, tabOrder: moveItem(tabs.tabOrder, id, 1) } })} className="text-slate-400 hover:text-slate-800 disabled:opacity-30 cursor-pointer">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {message && <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-amber-900" role="alert">{message}</p>}
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-xs">
          <h2 className="text-sm font-bold text-slate-900">Default columns</h2>
          {Object.keys(GRID_COLUMNS).map((grid) => {
            const pref = normalizeColumnPreference(draft.columns[grid], GRID_COLUMNS[grid].map((c) => c.key), DEFAULT_COLUMNS[grid]);
            const pinned = new Set([...pref.pinnedLeft, ...pref.pinnedRight]);
            return (
              <div key={grid}>
                <div className="mb-1 font-semibold text-slate-700">{GRID_LABEL[grid]}</div>
                <div className="flex flex-wrap gap-1.5">
                  {GRID_COLUMNS[grid].map((c) => {
                    const on = pref.visibleColumns.includes(c.key);
                    return pinned.has(c.key) ? (
                      <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                        <Lock className="h-3 w-3" /> {c.label}
                      </span>
                    ) : (
                      <label key={c.key} className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 ${on ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-500'}`}>
                        <input type="checkbox" className="h-3 w-3" aria-label={`${GRID_LABEL[grid]}: ${c.label}`} checked={on} onChange={(e) => toggleColumn(grid, c.key, e.target.checked)} />
                        {c.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-slate-500">Blue = shown by default. The rest stay in each user's "More columns" pool. Locked columns are always shown.</p>
        </section>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={save} className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-600 cursor-pointer">
          <Save className="h-3.5 w-3.5" /> Save for this role
        </button>
        <button type="button" onClick={reset} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
          <RotateCcw className="h-3.5 w-3.5" /> Restore built-in default
        </button>
      </div>
    </div>
  );
};
