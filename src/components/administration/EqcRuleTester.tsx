import React, { useMemo, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, ChevronDown, ChevronUp, FlaskConical, Image as ImageIcon, Mic, Type, Video } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EQC_PPLS } from '../../data/masterCatalogue';
import {
  EQC_MASTER_IDS,
  NotOkCapture,
  applicableChecklist,
  checkDidValue,
  didParameters,
  eqcHealthCheck,
  evaluatePtdRisk,
  formatMinutes,
  groupBySection,
  notOkCapture,
  resolveGcMandate,
  resolveGcSteps,
} from '../../utils/eqcRules';
import { toIsoDate } from '../../utils/holidayCalendar';

const input = 'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-teal-500 focus:outline-hidden';
const card = 'rounded-xl border border-slate-200 bg-white p-3 space-y-2';
const h4 = 'text-[11px] font-bold uppercase tracking-wider text-slate-500';

const Flag: React.FC<{ on: boolean; label: string }> = ({ on, label }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${on ? 'bg-teal-100 text-teal-900' : 'bg-slate-100 text-slate-500'}`}>
    {label}: {on ? 'Yes' : 'No'}
  </span>
);

const Capture: React.FC<{ c: NotOkCapture }> = ({ c }) => (
  <span className="inline-flex items-center gap-1 text-slate-400" title="Captured when marked Not OK">
    {c.photo && <Camera className="h-3 w-3 text-teal-700" aria-label="Photo" />}
    {c.audio && <Mic className="h-3 w-3 text-teal-700" aria-label="Audio" />}
    {c.video && <Video className="h-3 w-3 text-teal-700" aria-label="Video" />}
    {c.text && <Type className="h-3 w-3 text-teal-700" aria-label="Text" />}
  </span>
);

const scopeLabel = (s: 'PPL' | 'ALL', ppl: string) => (s === 'PPL' ? `${ppl}-specific rule` : 'All-PPL rule');

/** Lets a BA pick a vehicle and see what every EQC master resolves to — live from the current master data. */
export const EqcRuleTester: React.FC = () => {
  const { masterConfigs } = useApp();
  const rows = useMemo(() => {
    const byId = (id: string) => masterConfigs.find((m) => m.id === id)?.records ?? [];
    return {
      mandate: byId(EQC_MASTER_IDS.mandate),
      steps: byId(EQC_MASTER_IDS.steps),
      ptd: byId(EQC_MASTER_IDS.ptd),
      did: byId(EQC_MASTER_IDS.did),
      general: byId(EQC_MASTER_IDS.general),
      schedule: byId(EQC_MASTER_IDS.schedule),
    };
  }, [masterConfigs]);

  const complaintCodes = useMemo(
    () => [...new Set([...rows.mandate, ...rows.steps].map((r) => String(r.complaintCode ?? '')).filter(Boolean))].sort(),
    [rows]
  );
  const params = useMemo(() => didParameters(rows.did), [rows]);

  const [open, setOpen] = useState(true);
  const [bu, setBu] = useState<'PV' | 'EV'>('PV');
  const [ppl, setPpl] = useState('Nexon');
  const [complaintCode, setComplaintCode] = useState(complaintCodes[0] ?? '');
  const [km, setKm] = useState('25000');
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [ptdH, setPtdH] = useState('1');
  const [ptdM, setPtdM] = useState('30');
  const [didParam, setDidParam] = useState(params[0] ?? '');
  const [didValue, setDidValue] = useState('');

  const kmNum = Number(km) || 0;
  const minutesLeft = (Number(ptdH) || 0) * 60 + (Number(ptdM) || 0);
  const mandate = resolveGcMandate(rows.mandate, { ppl, complaintCode, date });
  const steps = resolveGcSteps(rows.steps, { ppl, complaintCode });
  const ptd = evaluatePtdRisk(rows.ptd, minutesLeft);
  const did = didValue.trim() !== '' && !isNaN(Number(didValue)) ? checkDidValue(rows.did, { parameterName: didParam, ppl, value: Number(didValue) }) : null;
  const general = applicableChecklist(rows.general, { bu, ppl, km: kmNum });
  const schedule = groupBySection(applicableChecklist(rows.schedule, { bu, ppl, km: kmNum }));
  const issues = eqcHealthCheck({
    [EQC_MASTER_IDS.mandate]: rows.mandate,
    [EQC_MASTER_IDS.steps]: rows.steps,
    [EQC_MASTER_IDS.ptd]: rows.ptd,
    [EQC_MASTER_IDS.did]: rows.did,
    [EQC_MASTER_IDS.general]: rows.general,
    [EQC_MASTER_IDS.schedule]: rows.schedule,
  });

  const ptdCls = ptd.risk === 'Red' ? 'bg-rose-600 text-white' : ptd.risk === 'Orange' ? 'bg-orange-500 text-white' : 'bg-emerald-100 text-emerald-800';

  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50/40 shadow-xs" data-testid="eqc-rule-tester">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-teal-700" />
          <span className="text-sm font-bold text-slate-900">EQC Rule Tester</span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">Pick a vehicle and see what the dealer app will apply — uses the masters as they are now.</span>
        </span>
        <span className="flex items-center gap-2">
          <span
            data-testid="eqc-health"
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${issues.length ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}
          >
            {issues.length ? `${issues.length} configuration issue(s)` : 'Configuration OK'}
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 text-xs">
          {/* Inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <div>
              <label htmlFor="eqc-bu" className="block text-[11px] font-semibold text-slate-600 mb-1">BU</label>
              <select id="eqc-bu" className={input} value={bu} onChange={(e) => setBu(e.target.value as 'PV' | 'EV')}>
                <option>PV</option>
                <option>EV</option>
              </select>
            </div>
            <div>
              <label htmlFor="eqc-ppl" className="block text-[11px] font-semibold text-slate-600 mb-1">PPL</label>
              <select id="eqc-ppl" className={input} value={ppl} onChange={(e) => setPpl(e.target.value)}>
                {EQC_PPLS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="eqc-cc" className="block text-[11px] font-semibold text-slate-600 mb-1">Complaint Code</label>
              <input id="eqc-cc" list="eqc-cc-list" className={`${input} font-mono`} value={complaintCode} onChange={(e) => setComplaintCode(e.target.value.toUpperCase())} />
              <datalist id="eqc-cc-list">
                {complaintCodes.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label htmlFor="eqc-km" className="block text-[11px] font-semibold text-slate-600 mb-1">Odometer (Km)</label>
              <input id="eqc-km" inputMode="numeric" className={input} value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div>
              <label htmlFor="eqc-date" className="block text-[11px] font-semibold text-slate-600 mb-1">Job date</label>
              <input id="eqc-date" type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">PTD time left</label>
              <div className="flex items-center gap-1">
                <input aria-label="PTD hours left" inputMode="numeric" className={`${input} text-center`} value={ptdH} onChange={(e) => setPtdH(e.target.value.replace(/\D/g, ''))} />
                <span>h</span>
                <input aria-label="PTD minutes left" inputMode="numeric" className={`${input} text-center`} value={ptdM} onChange={(e) => setPtdM(e.target.value.replace(/\D/g, ''))} />
                <span>m</span>
              </div>
            </div>
            <div>
              <label htmlFor="eqc-did" className="block text-[11px] font-semibold text-slate-600 mb-1">DID parameter</label>
              <select id="eqc-did" className={input} value={didParam} onChange={(e) => setDidParam(e.target.value)}>
                {params.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="eqc-did-value" className="block text-[11px] font-semibold text-slate-600 mb-1">Scanned value</label>
              <input id="eqc-did-value" inputMode="decimal" className={input} placeholder="e.g. 18" value={didValue} onChange={(e) => setDidValue(e.target.value)} />
            </div>
          </div>

          {/* Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className={card} data-testid="eqc-result-mandate">
              <div className={h4}>Guided Check &amp; Road Test</div>
              {!mandate ? (
                <p className="text-slate-500">No rule for {complaintCode || '—'} — GC not applicable, road test not mandatory.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    <Flag on={mandate.gcApplicable} label="GC applicable" />
                    <Flag on={mandate.gcMandatory} label="GC mandatory" />
                    <Flag on={mandate.roadTestMandatory} label="Road test mandatory" />
                  </div>
                  {mandate.mandateExpired && (
                    <p className="text-amber-800">GC was mandatory till {mandate.gcMandatoryTill}; it is optional on {date}.</p>
                  )}
                  {!mandate.mandateExpired && mandate.gcMandatory && mandate.gcMandatoryTill && (
                    <p className="text-slate-500">Mandatory till {mandate.gcMandatoryTill}.</p>
                  )}
                  <p className="text-[11px] text-slate-400">
                    {scopeLabel(mandate.scope, ppl)} · {mandate.ruleId}
                  </p>
                </>
              )}
            </div>

            <div className={card} data-testid="eqc-result-steps">
              <div className={h4}>Guided Check Steps</div>
              {!mandate?.gcApplicable ? (
                <p className="text-slate-500">GC not applicable — no steps shown to the technician.</p>
              ) : steps.steps.length === 0 ? (
                <p className="text-amber-800">GC applies but no steps are defined for this PPL / complaint.</p>
              ) : (
                <>
                  <ol className="space-y-1">
                    {steps.steps.map((s) => (
                      <li key={s.ruleId} className="flex gap-2">
                        <span className="font-mono font-bold text-teal-800">{s.stepNo}.</span>
                        <span>
                          {s.text}
                          {s.images.length > 0 && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                              <ImageIcon className="h-3 w-3" /> {s.images.length}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-[11px] text-slate-400">{scopeLabel(steps.scope, ppl)}</p>
                </>
              )}
            </div>

            <div className={card}>
              <div className={h4}>PTD Risk &amp; DID Check</div>
              <div className="flex items-center gap-2">
                <span data-testid="eqc-result-ptd" className={`px-2.5 py-1 rounded-lg text-[11px] font-black ${ptdCls}`}>
                  {ptd.risk}
                </span>
                <span className="text-slate-600">{formatMinutes(minutesLeft)} to PTD</span>
              </div>
              <div data-testid="eqc-result-did">
                {!did ? (
                  <p className="text-slate-400">Enter a scanned value to check it.</p>
                ) : did.status === 'NO RULE' ? (
                  <p className="text-slate-500">No threshold for {didParam} on {ppl}.</p>
                ) : (
                  <p className={did.status === 'OK' ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                    {didParam} {didValue}
                    {did.unit} → {did.status} (expected {did.expected}
                    {did.unit}, {scopeLabel(did.scope!, ppl)})
                  </p>
                )}
              </div>
            </div>

            <div className={`${card} md:col-span-1 lg:col-span-1`} data-testid="eqc-result-general">
              <div className={h4}>General Checklist ({general.length})</div>
              {general.length === 0 ? (
                <p className="text-slate-500">No items for {bu} / {ppl} at {kmNum.toLocaleString('en-IN')} km.</p>
              ) : (
                <ul className="space-y-1">
                  {general.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-2">
                      <span>
                        <span className="text-[10px] text-slate-400">{r.checklistType} · </span>
                        {r.checklistItem}
                      </span>
                      <Capture c={notOkCapture(r)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={`${card} lg:col-span-2`} data-testid="eqc-result-schedule">
              <div className={h4}>Schedule Checklist ({schedule.reduce((n, g) => n + g.items.length, 0)})</div>
              {schedule.length === 0 ? (
                <p className="text-slate-500">No items for {bu} / {ppl} at {kmNum.toLocaleString('en-IN')} km.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {schedule.map((g) => (
                    <div key={g.section}>
                      <div className="font-bold text-slate-800">{g.section}</div>
                      <ul className="space-y-0.5">
                        {g.items.map((r) => (
                          <li key={r.id} className="flex items-start justify-between gap-2 pl-2 border-l-2 border-teal-200">
                            <span>{r.subSection}</span>
                            <Capture c={notOkCapture(r)} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Health check */}
          <div className={`rounded-xl border p-3 ${issues.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`} data-testid="eqc-issues">
            {issues.length === 0 ? (
              <p className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                <CheckCircle2 className="h-4 w-4" /> No conflicts, duplicates or missing GC steps across the EQC masters.
              </p>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-amber-900 font-bold mb-1">
                  <AlertTriangle className="h-4 w-4" /> Fix these before go-live
                </p>
                <ul className="list-disc pl-5 text-amber-900 space-y-0.5">
                  {issues.map((i) => <li key={i}>{i}</li>)}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
