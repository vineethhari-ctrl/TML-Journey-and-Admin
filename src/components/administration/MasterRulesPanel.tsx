import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { MasterConfig } from '../../data/masterCatalogue';
import {
  PATTERN_PRESETS,
  RULE_TYPES,
  describeRule,
  fieldChoices,
  newRuleId,
  ruleReport,
  validateRuleDefinition,
  type MasterRule,
  type MasterRuleType,
} from '../../utils/masterRules';

const input = 'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-blue-500 focus:outline-hidden';
const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

interface Props {
  master: MasterConfig;
  canEdit: boolean;
  onSave: (rules: MasterRule[]) => void;
}

const blankRule = (type: MasterRuleType = 'required_if'): MasterRule => ({ id: newRuleId(), type, enabled: true, severity: 'error' });

/** Picks one or more values: tick boxes when the field has a list, otherwise comma-separated text. */
const ValuesPicker: React.FC<{ label: string; choices: string[]; value: string[]; onChange: (v: string[]) => void }> = ({ label, choices, value, onChange }) =>
  choices.length ? (
    <fieldset>
      <legend className="mb-1 block text-[11px] font-semibold text-slate-600">{label}</legend>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {choices.map((c) => (
          <label key={c} className="inline-flex items-center gap-1 text-xs">
            <input type="checkbox" checked={value.includes(c)} onChange={(e) => onChange(e.target.checked ? [...value, c] : value.filter((x) => x !== c))} />
            {c}
          </label>
        ))}
      </div>
    </fieldset>
  ) : (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-600">{label} (comma separated)</span>
      <input className={input} aria-label={label} value={value.join(', ')} onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
    </label>
  );

/**
 * Rules tab of a master: business rules made from a fixed list of rule types, without coding. They are stored with the
 * master and checked on every save, Ctrl+S, new row / copy, Excel upload and BA workbook import.
 */
export const MasterRulesPanel: React.FC<Props> = ({ master, canEdit, onSave }) => {
  const { masterConfigs, logAudit, showToast } = useApp();
  const rules = master.rules ?? [];
  const report = useMemo(() => ruleReport(master, masterConfigs), [master, masterConfigs]);
  const [draft, setDraft] = useState<MasterRule | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const isNew = !!draft && !rules.some((r) => r.id === draft.id);

  const fieldSelect = (label: string, value: string | undefined, onChange: (v: string) => void, fields = master.fields) => (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-600">{label}</span>
      <select className={input} aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>
    </label>
  );
  const set = (patch: Partial<MasterRule>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setErrors([]);
  };

  const save = () => {
    if (!draft) return;
    const clean: MasterRule = { ...draft, message: draft.message?.trim() || undefined };
    const problems = validateRuleDefinition(clean, master, masterConfigs);
    if (problems.length) return setErrors(problems);
    const next = isNew ? [...rules, clean] : rules.map((r) => (r.id === clean.id ? clean : r));
    onSave(next);
    logAudit(isNew ? 'Rule Added' : 'Rule Changed', 'Masters', `${master.name} rule`, '', describeRule(clean, master, masterConfigs));
    const breaking = ruleReport({ ...master, rules: [clean] }, masterConfigs)[0].failing.length;
    showToast(breaking ? `Rule saved. ${breaking} saved row(s) do not follow it yet — see the list.` : 'Rule saved. All saved rows follow it.', breaking ? 'info' : 'success');
    setDraft(null);
  };
  const remove = (r: MasterRule) => {
    if (!window.confirm(`Delete this rule?\n\n${describeRule(r, master, masterConfigs)}`)) return;
    onSave(rules.filter((x) => x.id !== r.id));
    logAudit('Rule Deleted', 'Masters', `${master.name} rule`, describeRule(r, master, masterConfigs), '');
  };
  const toggle = (r: MasterRule) => onSave(rules.map((x) => (x.id === r.id ? { ...x, enabled: x.enabled === false } : x)));

  const d = draft;
  const fieldOf = (k?: string) => master.fields.find((f) => f.key === k);
  const ref = masterConfigs.find((m) => m.id === d?.refMaster);

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3" data-testid="rules-panel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><ShieldCheck className="h-4 w-4 text-indigo-700" /> Rules for {master.name}</h3>
          <p className="text-[11px] text-slate-600">
            Checked on every save, Ctrl+S, new row, Excel upload and BA workbook import. Error = the row is refused; Warning = saved, user is told. No coding or deployment.
          </p>
        </div>
        {canEdit && !draft && (
          <button type="button" onClick={() => setDraft(blankRule())} className={`${btn} bg-indigo-700 text-white hover:bg-indigo-800`}>
            <Plus className="h-3.5 w-3.5" /> Add rule
          </button>
        )}
      </div>

      {/* Rule list */}
      {rules.length === 0 && !draft && <p className="text-xs text-slate-500">No rules yet{canEdit ? ' — press "Add rule".' : '.'}</p>}
      {rules.length > 0 && (
        <ul className="space-y-1.5" data-testid="rules-list">
          {rules.map((r) => {
            const failing = report.find((x) => x.rule.id === r.id)?.failing ?? [];
            return (
              <li key={r.id} className={`rounded-xl border bg-white px-3 py-2 text-xs ${r.enabled === false ? 'opacity-60' : ''}`} data-testid="rule-item">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.severity === 'error' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}>{r.severity === 'error' ? 'Error' : 'Warning'}</span>
                  <span className="flex-1 font-semibold text-slate-800">{describeRule(r, master, masterConfigs)}</span>
                  {r.enabled !== false &&
                    (failing.length ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-800" title={failing.slice(0, 10).map((f) => f.id).join(', ')}>
                        <AlertTriangle className="h-3.5 w-3.5" /> {failing.length} saved row(s) don&apos;t follow it: {failing.slice(0, 5).map((f) => f.id).join(', ')}{failing.length > 5 ? '…' : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> All rows follow it</span>
                    ))}
                  {canEdit && (
                    <span className="flex items-center gap-1">
                      <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                        <input type="checkbox" checked={r.enabled !== false} onChange={() => toggle(r)} aria-label={`Rule on: ${describeRule(r, master, masterConfigs)}`} /> On
                      </label>
                      <button type="button" aria-label="Edit rule" title="Edit" onClick={() => setDraft({ ...r })} className="p-1 rounded hover:bg-slate-100 cursor-pointer"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Delete rule" title="Delete" onClick={() => remove(r)} className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                    </span>
                  )}
                </div>
                {r.message && <div className="mt-0.5 text-[11px] text-slate-500">Message shown: “{r.message}”</div>}
              </li>
            );
          })}
        </ul>
      )}

      {/* Rule form */}
      {d && (
        <div className="rounded-xl border border-indigo-200 bg-white p-3 space-y-3" data-testid="rule-form">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">{isNew ? 'New rule' : 'Edit rule'}</span>
            <button type="button" aria-label="Close" onClick={() => setDraft(null)} className="p-1 rounded hover:bg-slate-100 cursor-pointer"><X className="h-4 w-4" /></button>
          </div>

          <fieldset>
            <legend className="mb-1 text-[11px] font-semibold text-slate-600">1. What kind of rule?</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {RULE_TYPES.map((t) => (
                <label key={t.type} className={`flex cursor-pointer gap-2 rounded-lg border p-2 text-xs ${d.type === t.type ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="rule-type" checked={d.type === t.type} onChange={() => setDraft({ ...blankRule(t.type), id: d.id, severity: d.severity })} />
                  <span>
                    <span className="block font-bold text-slate-900">{t.title}</span>
                    <span className="block text-[11px] text-slate-600">{t.hint} <i>e.g. {t.example}</i></span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-slate-600">2. Fill in the details</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {d.type === 'required_if' && (
                <>
                  {fieldSelect('This field is required', d.field, (v) => set({ field: v }))}
                  {fieldSelect('when this field', d.whenField, (v) => set({ whenField: v, whenValues: [] }))}
                  <div className="sm:col-span-2">
                    <ValuesPicker label="has one of these values (none ticked = is filled)" choices={fieldChoices(fieldOf(d.whenField))} value={d.whenValues ?? []} onChange={(v) => set({ whenValues: v })} />
                  </div>
                </>
              )}
              {d.type === 'unique' && (
                <div className="sm:col-span-2">
                  <ValuesPicker
                    label="These fields together must not repeat"
                    choices={master.fields.map((f) => f.label)}
                    value={(d.fields ?? []).map((k) => fieldOf(k)?.label ?? k)}
                    onChange={(labels) => set({ fields: labels.map((l) => master.fields.find((f) => f.label === l)!.key) })}
                  />
                </div>
              )}
              {d.type === 'not_greater' && (
                <>
                  {fieldSelect('This field (From)', d.field, (v) => set({ field: v }), master.fields.filter((f) => ['number', 'date', 'text'].includes(f.type)))}
                  {fieldSelect('must not be greater than (To)', d.otherField, (v) => set({ otherField: v }), master.fields.filter((f) => ['number', 'date', 'text'].includes(f.type)))}
                </>
              )}
              {d.type === 'allowed_if' && (
                <>
                  {fieldSelect('When this field', d.whenField, (v) => set({ whenField: v, whenValues: [] }))}
                  {fieldSelect('this field', d.field, (v) => set({ field: v, values: [] }))}
                  <ValuesPicker label="has one of these values" choices={fieldChoices(fieldOf(d.whenField))} value={d.whenValues ?? []} onChange={(v) => set({ whenValues: v })} />
                  <ValuesPicker label="may only be" choices={fieldChoices(fieldOf(d.field))} value={d.values ?? []} onChange={(v) => set({ values: v })} />
                </>
              )}
              {d.type === 'exists_in' && (
                <>
                  {fieldSelect('This field', d.field, (v) => set({ field: v }))}
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-600">must exist in master</span>
                    <select className={input} aria-label="Other master" value={d.refMaster ?? ''} onChange={(e) => set({ refMaster: e.target.value, refField: '' })}>
                      <option value="">Select…</option>
                      {masterConfigs.filter((m) => m.id !== master.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </label>
                  {ref && fieldSelect(`field of ${ref.name}`, d.refField, (v) => set({ refField: v }), ref.fields)}
                </>
              )}
              {d.type === 'range' && (
                <>
                  {fieldSelect('This number', d.field, (v) => set({ field: v }), master.fields.filter((f) => f.type === 'number' || f.type === 'text'))}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Minimum</span>
                      <input type="number" className={input} aria-label="Minimum" value={d.min ?? ''} onChange={(e) => set({ min: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
                    <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Maximum</span>
                      <input type="number" className={input} aria-label="Maximum" value={d.max ?? ''} onChange={(e) => set({ max: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>
                  </div>
                </>
              )}
              {d.type === 'pattern' && (
                <>
                  {fieldSelect('This field', d.field, (v) => set({ field: v }), master.fields.filter((f) => f.type === 'text'))}
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-600">must have the format</span>
                    <select className={input} aria-label="Format" value={PATTERN_PRESETS.some(([p]) => p === d.pattern) ? d.pattern : d.pattern ? '__own' : ''} onChange={(e) => set({ pattern: e.target.value === '__own' ? d.pattern || '^' : e.target.value })}>
                      <option value="">Select…</option>
                      {PATTERN_PRESETS.map(([p, label]) => <option key={p} value={p}>{label}</option>)}
                      <option value="__own">Own pattern (for IT)…</option>
                    </select>
                  </label>
                  {d.pattern && !PATTERN_PRESETS.some(([p]) => p === d.pattern) && (
                    <label className="block sm:col-span-2"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Own pattern</span>
                      <input className={`${input} font-mono`} aria-label="Own pattern" value={d.pattern} onChange={(e) => set({ pattern: e.target.value })} /></label>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">3. If broken</span>
              <select className={input} aria-label="If broken" value={d.severity} onChange={(e) => set({ severity: e.target.value as MasterRule['severity'] })}>
                <option value="error">Error — refuse the row</option>
                <option value="warning">Warning — save, but tell the user</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">Message to users (optional)</span>
              <input className={input} aria-label="Message to users" value={d.message ?? ''} placeholder={describeRule(d, master, masterConfigs)} onChange={(e) => set({ message: e.target.value })} />
            </label>
          </div>

          <div className="rounded-lg bg-slate-50 p-2 text-xs" data-testid="rule-preview">
            <span className="font-semibold text-slate-600">Rule: </span>
            {validateRuleDefinition(d, master, masterConfigs).length ? <span className="text-slate-400">fill in the details above…</span> : describeRule(d, master, masterConfigs)}
          </div>
          {errors.length > 0 && <ul className="list-disc pl-5 text-xs text-red-700">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          <div className="flex gap-2">
            <button type="button" onClick={save} className={`${btn} bg-emerald-700 text-white hover:bg-emerald-800`}>Save rule</button>
            <button type="button" onClick={() => setDraft(null)} className={`${btn} text-slate-600 hover:bg-slate-100`}>Cancel</button>
          </div>
        </div>
      )}
      {!canEdit && rules.length > 0 && <p className="text-[11px] text-slate-500">View only: the TML Admin maintains the rules of this master.</p>}
    </div>
  );
};
