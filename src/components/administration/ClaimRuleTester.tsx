import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Clock, FlaskConical } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CLAIM_MASTER_IDS, claimHealthCheck, claimPendingItems, goodwillCategory, routeWarrantyRequest } from '../../utils/claimRules';
import { dropdownValues } from '../../utils/thdRules';

const input = 'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-rose-500 focus:outline-hidden';
const CATEGORY_STYLE: Record<string, string> = {
  red: 'bg-red-100 text-red-800 border-red-200',
  amber: 'bg-amber-100 text-amber-900 border-amber-200',
  green: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

/** Try the Warranty approval matrix and Goodwill categorisation against the Claims masters as they are now. */
export const ClaimRuleTester: React.FC = () => {
  const { masterConfigs } = useApp();
  const rows = useMemo(() => {
    const out: Record<string, Array<Record<string, any>>> = {};
    Object.values(CLAIM_MASTER_IDS).forEach((id) => (out[id] = masterConfigs.find((m) => m.id === id)?.records ?? []));
    return out;
  }, [masterConfigs]);

  const [open, setOpen] = useState(true);
  const [amount, setAmount] = useState('15000');
  const issues = dropdownValues(rows[CLAIM_MASTER_IDS.issueDescription]);
  const [issue, setIssue] = useState(issues[0] ?? '');

  const route = routeWarrantyRequest(rows[CLAIM_MASTER_IDS.approvalMatrix], Number(amount) || 0);
  const category = goodwillCategory(rows[CLAIM_MASTER_IDS.goodwillCategory], issue);
  const health = claimHealthCheck(rows);
  const pending = claimPendingItems(rows);
  const lists: Array<[string, string[]]> = [
    ['Budget Allocation Purpose', dropdownValues(rows[CLAIM_MASTER_IDS.budgetPurpose])],
    ['Special Goodwill Claim', dropdownValues(rows[CLAIM_MASTER_IDS.specialGoodwill])],
    ['AMC / EW Complaint Type', dropdownValues(rows[CLAIM_MASTER_IDS.complaintType])],
  ];

  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/40 shadow-xs" data-testid="claim-rule-tester">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer">
        <span className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-rose-700" />
          <span className="text-sm font-bold text-slate-900">Claims Rule Tester</span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">Who approves a request and how a goodwill request is categorised — uses the masters as they are now.</span>
        </span>
        <span className="flex items-center gap-2">
          {pending.length > 0 && (
            <span data-testid="claim-pending" className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-900">
              {pending.length} item(s) pending from business
            </span>
          )}
          <span data-testid="claim-health" className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${health.length ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>
            {health.length ? `${health.length} item(s) to fix` : 'Configuration OK'}
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">1 · Warranty Authorization Request</div>
              <label htmlFor="claim-amount" className="block text-[11px] font-semibold text-slate-600">Request amount (₹)</label>
              <input id="claim-amount" className={input} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
              <ol className="space-y-1.5" data-testid="claim-route">
                {route.steps.map((s) => (
                  <li key={s.level} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${s.canApprove ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                    <span className="font-bold">L{s.level}</span>
                    <span className="flex-1">{s.persona}</span>
                    <span className={s.canApprove ? 'font-bold text-emerald-800' : 'text-slate-500'}>{s.canApprove ? 'Approves' : 'Forwards'}</span>
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                    <span className="text-slate-500">{s.reminderHours} h reminder</span>
                  </li>
                ))}
              </ol>
              {route.gap && (
                <div className="flex items-start gap-1.5 text-sky-900" data-testid="claim-gap">
                  <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {route.gap}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">2 · Goodwill Request category</div>
              <label htmlFor="claim-issue" className="block text-[11px] font-semibold text-slate-600">Issue Description</label>
              <select id="claim-issue" className={input} value={issue} onChange={(e) => setIssue(e.target.value)}>
                {issues.map((i) => <option key={i}>{i}</option>)}
              </select>
              <div data-testid="claim-category">
                {category ? (
                  <div className={`rounded-lg border px-2 py-1.5 ${CATEGORY_STYLE[category.category.toLowerCase()] ?? 'bg-slate-50 border-slate-200'}`}>
                    <strong>{category.category}</strong> · {category.issueType}
                  </div>
                ) : (
                  <div className="text-amber-900">No Request Category mapped for this Issue Description.</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">3 · Dropdowns</div>
              {lists.map(([label, values]) => (
                <div key={label} className="border-t border-slate-100 pt-1 first:border-0">
                  <div className="text-slate-600">{label}</div>
                  <div className="font-semibold">{values.join(' · ') || '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {(pending.length > 0 || health.length > 0) && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
              {pending.map((p) => (
                <div key={p} className="flex items-start gap-1.5 text-sky-900">
                  <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {p}
                </div>
              ))}
              {health.map((i) => (
                <div key={i} className="flex items-start gap-1.5 text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {i}
                </div>
              ))}
            </div>
          )}
          {health.length === 0 && (
            <div className="flex items-center gap-1.5 text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" /> All Claims masters are consistent.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
