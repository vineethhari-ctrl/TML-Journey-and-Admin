import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, FlaskConical, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EQC_PPLS } from '../../data/masterCatalogue';
import { THD_MASTER_IDS, criticalComplaint, criticalWithoutPpl, dropdownValues, evaluateAutoThd, pendingTriggerRules, subStatusesFor, thdHealthCheck } from '../../utils/thdRules';

const input = 'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-orange-500 focus:outline-hidden';
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

const Field: React.FC<{ id: string; label: string; children: React.ReactNode }> = ({ id, label, children }) => (
  <div>
    <label htmlFor={id} className="block text-[11px] font-semibold text-slate-600 mb-1">{label}</label>
    {children}
  </div>
);

/** Try the THD auto-trigger rules and closure dropdowns against the masters as they are now. */
export const ThdRuleTester: React.FC = () => {
  const { masterConfigs } = useApp();
  const rows = useMemo(() => {
    const out: Record<string, Array<Record<string, any>>> = {};
    Object.values(THD_MASTER_IDS).forEach((id) => (out[id] = masterConfigs.find((m) => m.id === id)?.records ?? []));
    return out;
  }, [masterConfigs]);

  const [open, setOpen] = useState(true);
  const [ppl, setPpl] = useState('Nexon');
  const [code, setCode] = useState('E32');
  const [addedLater, setAddedLater] = useState('');
  const [repeatDays, setRepeatDays] = useState('');
  const [openHours, setOpenHours] = useState('');
  const [delayReason, setDelayReason] = useState('');
  const [qi, setQi] = useState(false);
  const [escalation, setEscalation] = useState(false);
  const [dtc, setDtc] = useState(false);
  const [unattended, setUnattended] = useState('');
  const [progress, setProgress] = useState('');

  const triggers = rows[THD_MASTER_IDS.triggers];
  const critical = criticalComplaint(rows[THD_MASTER_IDS.critical], { ppl, complaintCode: code.trim() });
  const listed = rows[THD_MASTER_IDS.critical].filter((r) => String(r.complaintCode).toLowerCase() === code.trim().toLowerCase());
  const known = critical ?? listed[0];
  const aggregate = known?.aggregate ? [String(known.aggregate)] : [];
  const result = evaluateAutoThd(triggers, rows[THD_MASTER_IDS.critical], {
    ppl,
    complaintCodes: code.trim() ? [code.trim()] : [],
    aggregates: aggregate,
    previousJobCard: num(repeatDays) !== undefined ? { daysSinceClosure: num(repeatDays)!, aggregates: aggregate } : undefined,
    hoursSinceCriticalAddedLater: num(addedLater),
    jobCardOpenHours: num(openHours),
    delayReason: delayReason || undefined,
    qiMarkedThdRequired: qi,
    openEscalation: escalation,
    criticalDtcReceived: dtc,
    thdUnattendedHours: num(unattended),
  });
  const pendingRules = pendingTriggerRules(triggers);
  const unmapped = criticalWithoutPpl(rows[THD_MASTER_IDS.critical]);
  const pendingCount = pendingRules.length + unmapped.length;
  const issues = thdHealthCheck(rows);
  const delayReasons = [...new Set(triggers.flatMap((t) => String(t.triggerValues ?? '').split(',').map((s) => s.trim()).filter(Boolean)))];
  const progressValues = dropdownValues(rows[THD_MASTER_IDS.progress]);
  const closureLists: Array<[string, string[]]> = [
    ['Type of Complaint', dropdownValues(rows[THD_MASTER_IDS.complaintType])],
    ['Complaint Short Description', dropdownValues(rows[THD_MASTER_IDS.shortDescription])],
    ['Action Taken', dropdownValues(rows[THD_MASTER_IDS.actionTaken])],
    ['Reason for Delay', dropdownValues(rows[THD_MASTER_IDS.delayReason])],
    ['Closure Action', dropdownValues(rows[THD_MASTER_IDS.closureAction])],
  ];

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50/40 shadow-xs" data-testid="thd-rule-tester">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer">
        <span className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-orange-700" />
          <span className="text-sm font-bold text-slate-900">THD Rule Tester</span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">Try a job card and see which THD cases are raised — uses the masters as they are now.</span>
        </span>
        <span className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span data-testid="thd-pending" className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-900">
              {pendingCount} item(s) pending from business
            </span>
          )}
          <span data-testid="thd-health" className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${issues.length ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>
            {issues.length ? `${issues.length} item(s) to fix` : 'Configuration OK'}
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-3 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">1 · Job card situation</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Field id="thd-ppl" label="PPL">
                  <select id="thd-ppl" className={input} value={ppl} onChange={(e) => setPpl(e.target.value)}>
                    {EQC_PPLS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field id="thd-code" label="Complaint code">
                  <input id="thd-code" className={input} value={code} onChange={(e) => setCode(e.target.value)} />
                </Field>
                <Field id="thd-later" label="Added after JC creation (hours ago)">
                  <input id="thd-later" className={input} inputMode="numeric" placeholder="blank = at creation" value={addedLater} onChange={(e) => setAddedLater(e.target.value)} />
                </Field>
                <Field id="thd-repeat" label="Previous JC closed (days ago)">
                  <input id="thd-repeat" className={input} inputMode="numeric" placeholder="blank = first visit" value={repeatDays} onChange={(e) => setRepeatDays(e.target.value)} />
                </Field>
                <Field id="thd-open" label="JC open for (hours)">
                  <input id="thd-open" className={input} inputMode="numeric" value={openHours} onChange={(e) => setOpenHours(e.target.value)} />
                </Field>
                <Field id="thd-delay" label="JC delay reason">
                  <select id="thd-delay" className={input} value={delayReason} onChange={(e) => setDelayReason(e.target.value)}>
                    <option value="">(none)</option>
                    {delayReasons.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </Field>
                <Field id="thd-unattended" label="THD unattended for (hours)">
                  <input id="thd-unattended" className={input} inputMode="numeric" value={unattended} onChange={(e) => setUnattended(e.target.value)} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {([['QI marked THD Required', qi, setQi], ['Open escalated complaint', escalation, setEscalation], ['Critical DTC received', dtc, setDtc]] as const).map(([label, value, set]) => (
                  <label key={label} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} /> {label}
                  </label>
                ))}
              </div>
              <div className="text-[11px] text-slate-500">
                {critical
                  ? `${critical.complaintCode} is a critical complaint for ${critical.ppl} (${critical.aggregate}).`
                  : listed.some((r) => r.ppl)
                    ? `${code} is a critical complaint for ${listed.filter((r) => r.ppl).map((r) => r.ppl).join(', ')} — not for ${ppl}.`
                    : listed.length
                      ? `${code} is in the Critical Complaints master but has no PPL yet — it raises a THD only after its PPL is mapped.`
                    : `${code || 'This code'} is not in the Critical Complaints master.`}
              </div>

              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pt-1">2 · THD cases raised</div>
              <ul className="space-y-1.5" data-testid="thd-fired">
                {result.fired.length === 0 && <li className="text-slate-500">No THD case is raised.</li>}
                {result.fired.map(({ rule, reason }) => (
                  <li key={rule.id} className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-1.5">
                    <Zap className="h-3.5 w-3.5 mt-0.5 text-emerald-700 shrink-0" />
                    <span>
                      <strong>Rule {rule.ruleNo}</strong> · {rule.thdTag} → <strong>{rule.assignedTo}</strong>
                      <span className="block text-slate-600">{reason}</span>
                    </span>
                  </li>
                ))}
                {result.pending.map(({ rule, reason }) => (
                  <li key={rule.id} className="flex items-start gap-2 rounded-lg bg-sky-50 border border-sky-200 px-2 py-1.5">
                    <Clock className="h-3.5 w-3.5 mt-0.5 text-sky-700 shrink-0" />
                    <span>
                      <strong>Rule {rule.ruleNo}</strong> · {rule.thdTag} — {reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">3 · Closure form dropdowns</div>
              <Field id="thd-progress" label="Progress">
                <select id="thd-progress" className={input} value={progress} onChange={(e) => setProgress(e.target.value)}>
                  <option value="">Select…</option>
                  {progressValues.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field id="thd-substatus" label="Progress sub-status">
                <select id="thd-substatus" className={input} disabled={!progress}>
                  {(progress ? subStatusesFor(rows[THD_MASTER_IDS.subStatus], progress) : []).map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              {closureLists.map(([label, values]) => (
                <div key={label} className="flex justify-between gap-2 border-t border-slate-100 pt-1">
                  <span className="text-slate-600">{label}</span>
                  <span className="font-semibold">{values.length} values</span>
                </div>
              ))}
            </div>
          </div>

          {(pendingCount > 0 || issues.length > 0) && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
              {pendingRules.map((r) => (
                <div key={r.id} className="flex items-start gap-1.5 text-sky-900">
                  <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Rule {r.ruleNo} ({r.thdTag}): Time Window not given yet — ask business for the value.
                </div>
              ))}
              {unmapped.map((r) => (
                <div key={r.id} className="flex items-start gap-1.5 text-sky-900">
                  <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Critical complaint {r.complaintCode} has no PPL yet — map it from the CRM complaint master.
                </div>
              ))}
              {issues.map((i) => (
                <div key={i} className="flex items-start gap-1.5 text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {i}
                </div>
              ))}
            </div>
          )}
          {issues.length === 0 && (
            <div className="flex items-center gap-1.5 text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" /> All THD masters are consistent.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
