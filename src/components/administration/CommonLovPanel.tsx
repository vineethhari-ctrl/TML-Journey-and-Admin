import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ListTree, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LOV_MODULES } from '../../data/commonLov';
import { commonLovHealthCheck, commonLovRecords, lovCatalogue } from '../../utils/commonLov';

const input = 'px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-slate-500 focus:outline-hidden';

/** One line per dropdown list in the Common LOV Master: Parameter, owner module, values and where it is used. */
export const CommonLovPanel: React.FC = () => {
  const { masterConfigs } = useApp();
  const rows = useMemo(() => commonLovRecords(masterConfigs), [masterConfigs]);
  const lists = useMemo(() => lovCatalogue(rows, masterConfigs), [rows, masterConfigs]);
  const issues = useMemo(() => commonLovHealthCheck(rows, masterConfigs), [rows, masterConfigs]);
  const [open, setOpen] = useState(true);
  const [module, setModule] = useState('ALL');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = lists.filter(
    (l) =>
      (module === 'ALL' || l.module === module) &&
      (!q || [l.code, l.fieldName, ...l.values].some((v) => v.toLowerCase().includes(q))),
  );
  const modules = LOV_MODULES.filter(([m]) => lists.some((l) => l.module === m));

  return (
    <div className="rounded-2xl border border-slate-300 bg-slate-50/60 shadow-xs" data-testid="common-lov-panel">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer">
        <span className="flex items-center gap-2">
          <ListTree className="h-4 w-4 text-slate-700" />
          <span className="text-sm font-bold text-slate-900">LOV Catalogue</span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            {lists.length} dropdown lists, {rows.length} values — one place for every module.
          </span>
        </span>
        <span className="flex items-center gap-2">
          {issues.length ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
              <AlertTriangle className="h-3.5 w-3.5" /> {issues.length} to fix
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" /> All lists OK
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 text-xs">
          <p className="text-slate-600">
            Add a value: a new row with the list&apos;s <b>Parameter (LOV Code)</b>. New list: name it <span className="font-mono">&lt;MODULE&gt;_&lt;FIELD&gt;</span>, e.g.{' '}
            <span className="font-mono">THD_COMPLAINT_TYPE</span>; use <span className="font-mono">COMMON_</span> for lists several modules share. Dependent lists
            fill in Parent LOV Code and Parent Value. Set a value Inactive instead of deleting it.
          </p>

          {issues.length > 0 && (
            <ul className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-1 text-red-800" data-testid="common-lov-issues">
              {issues.slice(0, 8).map((i) => <li key={i}>{i}</li>)}
              {issues.length > 8 && <li>…and {issues.length - 8} more.</li>}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Search lists</span>
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input className={`${input} pl-7 w-56`} placeholder="Search code, field or value" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="flex items-center gap-1 text-slate-600">
              Module
              <select className={input} value={module} onChange={(e) => setModule(e.target.value)} aria-label="Module">
                <option value="ALL">All modules</option>
                {modules.map(([m, title]) => <option key={m} value={m}>{m} — {title}</option>)}
              </select>
            </label>
            <span className="text-slate-500">{shown.length} lists</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left" data-testid="common-lov-catalogue">
              <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Parameter (LOV Code)</th>
                  <th className="px-3 py-2">Module</th>
                  <th className="px-3 py-2">Field Name</th>
                  <th className="px-3 py-2">Values (Active)</th>
                  <th className="px-3 py-2">Depends on</th>
                  <th className="px-3 py-2">Used in</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.code} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 font-mono font-semibold text-slate-900">{l.code}</td>
                    <td className="px-3 py-2">{l.module}</td>
                    <td className="px-3 py-2">{l.fieldName}</td>
                    <td className="px-3 py-2 max-w-md">
                      <span className="font-semibold">{l.active}</span>
                      {l.inactive > 0 && <span className="text-slate-400"> (+{l.inactive} inactive)</span>}
                      <span className="text-slate-500">: {l.values.slice(0, 4).join(', ')}{l.values.length > 4 ? ', …' : ''}</span>
                    </td>
                    <td className="px-3 py-2 font-mono">{l.parentCode || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{l.usedIn.join('; ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
