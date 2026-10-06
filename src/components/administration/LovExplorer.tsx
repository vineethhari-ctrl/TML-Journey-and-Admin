import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Copy, ListPlus, Plus, RotateCcw, Save, Search, Table2, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { MasterConfig } from '../../data/masterCatalogue';
import { DUPLICATE_RECORD_MESSAGE } from '../../utils/recordDuplicates';
import { LOV_MODULES, licFor } from '../../data/commonLov';
import { LOV_TYPE_ERRORS, applyLovTypeDraft, commonLovHealthCheck, lovCatalogue, lovRows, lovValues, type LovTypeHeader } from '../../utils/commonLov';

type Rec = Record<string, any>;
type Errors = Record<string, Record<string, string>>;

const cell = 'w-full px-2 py-1 rounded border border-transparent bg-transparent text-xs hover:border-slate-200 focus:border-blue-500 focus:bg-white focus:outline-hidden disabled:hover:border-transparent';
const input = 'px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-blue-500 focus:outline-hidden';
const btn = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const toFieldCode = (s: string) => licFor(s).replace(/^(\d)/, 'F$1');
let seq = 0;
const tempId = () => `NEW-${++seq}`;

interface Props {
  master: MasterConfig;
  canEdit: boolean;
  onSave: (updated: MasterConfig) => void;
  onTableView: () => void;
}

/**
 * List of Values administration in the Siebel style: pick an LOV Type on the left, edit its values in the grid on the
 * right (Display Value, Code, Order, Parent Value, Active, Description), then Save. New types and bulk-added values
 * get their codes proposed automatically.
 */
export const LovExplorer: React.FC<Props> = ({ master, canEdit, onSave, onTableView }) => {
  const { masterConfigs, showToast, logAudit } = useApp();
  const rows = master.records;
  const lists = useMemo(() => lovCatalogue(rows, masterConfigs), [rows, masterConfigs]);
  const issues = useMemo(() => commonLovHealthCheck(rows, masterConfigs), [rows, masterConfigs]);

  const [query, setQuery] = useState('');
  const [module, setModule] = useState('ALL');
  const [selected, setSelected] = useState<string | null>(lists[0]?.code ?? null);
  const [isNew, setIsNew] = useState(false);
  const [header, setHeader] = useState<LovTypeHeader>({ code: '', module: 'COMMON', fieldName: '', parentCode: '' });
  const [draft, setDraft] = useState<Rec[]>([]);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [parentFilter, setParentFilter] = useState('ALL');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState('');
  const [showIssues, setShowIssues] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  // After Ctrl+B, put the cursor in the copy's Display Value, ready to type over it
  useEffect(() => {
    if (!focusId) return;
    const el = document.querySelector<HTMLInputElement>(`[data-lov-row="${focusId}"] input[aria-label="Display Value"]`);
    el?.focus();
    el?.select();
    setFocusId(null);
  }, [focusId, draft]);

  // Load the chosen type into the grid
  const load = (code: string | null) => {
    const list = code ? lovRows(rows, code) : [];
    const first = list[0] ?? {};
    setSelected(code);
    setIsNew(false);
    setHeader({ code: code ?? '', module: String(first.module ?? 'COMMON'), fieldName: String(first.fieldName ?? ''), parentCode: String(first.parentLovCode ?? '') });
    // Dependent lists: grouped by the parent's own order, then by Order
    const parents = first.parentLovCode ? lovValues(rows, String(first.parentLovCode)) : [];
    const rank = (r: Rec) => parents.indexOf(String(r.parentValue ?? ''));
    setDraft([...list].sort((a, b) => rank(a) - rank(b) || (Number(a.order) || 0) - (Number(b.order) || 0)).map((r) => ({ ...r })));
    setDirty(false);
    setErrors({});
    setParentFilter('ALL');
    setBulkOpen(false);
  };
  useEffect(() => {
    if (!dirty && !isNew) load(selected && lists.some((l) => l.code === selected) ? selected : lists[0]?.code ?? null);
    // reload when the saved records change (save, import, reset)
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const guard = (fn: () => void) => {
    if (dirty && !window.confirm('Discard the unsaved changes to this list?')) return;
    fn();
  };

  const q = query.trim().toLowerCase();
  const shownLists = lists.filter(
    (l) => (module === 'ALL' || l.module === module) && (!q || [l.code, l.fieldName, ...l.values].some((v) => v.toLowerCase().includes(q))),
  );
  const summary = lists.find((l) => l.code === selected);
  const parentOptions = header.parentCode ? lovValues(rows, header.parentCode) : [];
  const visible = draft.filter((r) => parentFilter === 'ALL' || String(r.parentValue ?? '') === parentFilter);
  const typeErrors = errors[LOV_TYPE_ERRORS] ?? {};
  const editable = canEdit;

  const change = (next: Rec[]) => {
    setDraft(next);
    setDirty(true);
  };
  const update = (id: string, patch: Rec) => change(draft.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const newRow = (value = ''): Rec => ({
    id: tempId(),
    _new: true,
    value,
    lic: '',
    parentValue: parentFilter !== 'ALL' ? parentFilter : '',
    description: '',
    status: 'Active',
  });
  const addRow = () => change([...draft, newRow()]);
  // Duplicate keeps every value (replace what differs); the Code (LIC) is blank so it follows the new Display Value
  const copyRow = (r: Rec) => {
    const i = draft.indexOf(r);
    const copy = { ...r, id: tempId(), _new: true, lic: '' };
    change([...draft.slice(0, i + 1), copy, ...draft.slice(i + 1)]);
    setFocusId(copy.id);
  };
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'b') return;
    e.preventDefault();
    if (!editable) return;
    const id = (e.target as HTMLElement).closest('[data-lov-row]')?.getAttribute('data-lov-row');
    const row = draft.find((d) => d.id === id);
    if (row) copyRow(row);
    else showToast('Click in a value row, then press Ctrl+B to duplicate it.', 'info');
  };
  const removeRow = (r: Rec) => change(draft.filter((d) => d !== r));
  const move = (r: Rec, dir: -1 | 1) => {
    const group = draft.filter((d) => String(d.parentValue ?? '') === String(r.parentValue ?? ''));
    const swapWith = group[group.indexOf(r) + dir];
    if (!swapWith) return;
    const a = draft.indexOf(r);
    const b = draft.indexOf(swapWith);
    const next = [...draft];
    [next[a], next[b]] = [next[b], next[a]];
    change(next);
  };
  const addBulk = () => {
    const values = bulk.split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
    if (!values.length) return;
    change([...draft, ...values.map((v) => newRow(v))]);
    setBulk('');
    setBulkOpen(false);
  };
  const startNewType = () =>
    guard(() => {
      setSelected(null);
      setIsNew(true);
      setHeader({ code: '', module: module !== 'ALL' ? module : 'COMMON', fieldName: '', parentCode: '' });
      setDraft([newRow()]);
      setDirty(true);
      setErrors({});
      setParentFilter('ALL');
    });
  const setHeaderField = (patch: Partial<LovTypeHeader>) => {
    const next = { ...header, ...patch };
    // Propose the Parameter for a new type from its module and field name: THD + "Type of Complaint" → THD_TYPE_OF_COMPLAINT
    if (isNew && ('module' in patch || 'fieldName' in patch) && (!header.code || header.code === proposed(header))) next.code = proposed(next);
    setHeader(next);
    setDirty(true);
  };

  const save = () => {
    const { records, errors: found } = applyLovTypeDraft(rows, isNew ? null : selected, header, draft);
    setErrors(found);
    if (Object.keys(found).length) {
      const dup = Object.values(found).flatMap((e) => Object.values(e)).find((m) => m.startsWith(DUPLICATE_RECORD_MESSAGE));
      showToast(dup ? `${DUPLICATE_RECORD_MESSAGE}. Change the copied row's value before saving.` : 'Please fix the highlighted cells before saving.', 'error');
      return;
    }
    onSave({ ...master, records });
    const before = isNew ? 0 : lovRows(rows, selected!).length;
    logAudit('LOV Saved', 'Masters', `Common LOV ${header.code}`, `${before} values`, `${draft.length} values`);
    showToast(`${header.code} saved (${draft.length} values).`, 'success');
    setDirty(false);
    setIsNew(false);
    setSelected(header.code.trim().toUpperCase());
  };

  const err = (id: string, key: string) => errors[id]?.[key];
  const errCls = (id: string, key: string) => (err(id, key) ? ' border-red-400 bg-red-50' : '');

  return (
    <div className="rounded-2xl border border-slate-300 bg-white shadow-xs" data-testid="lov-explorer">
      {/* Title bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 rounded-t-2xl">
        <div>
          <h3 className="text-sm font-bold text-slate-900">List of Values</h3>
          <p className="text-[11px] text-slate-500">
            {lists.length} LOV types · {rows.length} values · pick a type, edit its values, Save. Used by every module.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowIssues(!showIssues)}
            className={`${btn} ${issues.length ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}
          >
            {issues.length ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {issues.length ? `${issues.length} to fix` : 'All lists OK'}
          </button>
          <button type="button" onClick={() => guard(onTableView)} className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
            <Table2 className="h-3.5 w-3.5" /> Table / Excel view
          </button>
        </div>
      </div>
      {showIssues && issues.length > 0 && (
        <ul className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800 space-y-0.5" data-testid="common-lov-issues">
          {issues.slice(0, 10).map((i) => <li key={i}>{i}</li>)}
          {issues.length > 10 && <li>…and {issues.length - 10} more.</li>}
        </ul>
      )}

      <div className="grid md:grid-cols-[18rem_1fr]">
        {/* LOV Types */}
        <aside className="border-b md:border-b-0 md:border-r border-slate-200 p-3 space-y-2">
          <label className="relative block">
            <span className="sr-only">Find a list</span>
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input className={`${input} w-full pl-7`} placeholder="Find type, field or value" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <select className={`${input} w-full`} value={module} onChange={(e) => setModule(e.target.value)} aria-label="Module">
            <option value="ALL">All modules</option>
            {LOV_MODULES.map(([m, title]) => <option key={m} value={m}>{m} — {title}</option>)}
          </select>
          {editable && (
            <button type="button" onClick={startNewType} className={`${btn} w-full justify-center bg-blue-700 text-white hover:bg-blue-800`}>
              <Plus className="h-3.5 w-3.5" /> New LOV Type
            </button>
          )}
          <ul className="max-h-[28rem] overflow-y-auto -mx-1" role="listbox" aria-label="LOV Types" data-testid="lov-type-list">
            {isNew && (
              <li role="option" aria-selected className="mx-1 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-2 text-xs font-mono font-semibold text-blue-900">
                {header.code || 'New LOV Type'} *
              </li>
            )}
            {shownLists.map((l) => (
              <li key={l.code} role="option" aria-selected={!isNew && l.code === selected}>
                <button
                  type="button"
                  onClick={() => l.code !== selected && guard(() => load(l.code))}
                  className={`mx-1 w-[calc(100%-0.5rem)] rounded-lg px-2.5 py-2 text-left cursor-pointer ${!isNew && l.code === selected ? 'bg-blue-50 border border-blue-200' : 'border border-transparent hover:bg-slate-50'}`}
                >
                  <span className="block font-mono text-[11px] font-semibold text-slate-900 break-all">{l.code}{!isNew && l.code === selected && dirty ? ' *' : ''}</span>
                  <span className="flex justify-between gap-2 text-[11px] text-slate-500">
                    <span className="truncate">{l.fieldName}</span>
                    <span className="shrink-0">{l.active}{l.inactive ? ` +${l.inactive}` : ''}</span>
                  </span>
                </button>
              </li>
            ))}
            {!shownLists.length && <li className="px-2 py-3 text-xs text-slate-500">No list matches.</li>}
          </ul>
        </aside>

        {/* Selected type and its values */}
        <section className="p-3 space-y-3 min-w-0">
          {!selected && !isNew ? (
            <p className="text-xs text-slate-500">Pick an LOV Type on the left{editable ? ' or create a new one' : ''}.</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs" data-testid="lov-type-header">
                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">LOV Type (Parameter)</span>
                  <input
                    className={`${input} w-full font-mono${typeErrors.code ? ' border-red-400' : ''}`}
                    value={header.code}
                    disabled={!isNew}
                    onChange={(e) => setHeaderField({ code: e.target.value.toUpperCase() })}
                  />
                  {typeErrors.code && <span className="text-[11px] text-red-700">{typeErrors.code}</span>}
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">Module</span>
                  <select className={`${input} w-full`} value={header.module} disabled={!isNew} onChange={(e) => setHeaderField({ module: e.target.value })}>
                    {LOV_MODULES.map(([m, title]) => <option key={m} value={m}>{m} — {title}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">Field Name (on screen)</span>
                  <input
                    className={`${input} w-full${typeErrors.fieldName ? ' border-red-400' : ''}`}
                    value={header.fieldName}
                    disabled={!editable}
                    onChange={(e) => setHeaderField({ fieldName: e.target.value })}
                  />
                  {typeErrors.fieldName && <span className="text-[11px] text-red-700">{typeErrors.fieldName}</span>}
                </label>
                <label className="block">
                  <span className="block text-[11px] font-semibold text-slate-600 mb-1">Depends on (parent LOV Type)</span>
                  <select
                    className={`${input} w-full`}
                    value={header.parentCode}
                    disabled={!isNew}
                    onChange={(e) => setHeaderField({ parentCode: e.target.value })}
                  >
                    <option value="">— none —</option>
                    {lists.filter((l) => l.code !== header.code).map((l) => <option key={l.code} value={l.code}>{l.code}</option>)}
                  </select>
                  {typeErrors.parentCode && <span className="text-[11px] text-red-700">{typeErrors.parentCode}</span>}
                </label>
              </div>
              {summary && summary.usedIn.length > 0 && <p className="text-[11px] text-slate-500">Used in: {summary.usedIn.join('; ')}</p>}

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {editable && (
                  <>
                    <button type="button" onClick={addRow} className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
                      <Plus className="h-3.5 w-3.5" /> New Value
                    </button>
                    <button type="button" onClick={() => setBulkOpen(!bulkOpen)} className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
                      <ListPlus className="h-3.5 w-3.5" /> Add several
                    </button>
                  </>
                )}
                {header.parentCode && (
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    Show values for
                    <select className={input} value={parentFilter} onChange={(e) => setParentFilter(e.target.value)} aria-label="Show values for">
                      <option value="ALL">All {header.parentCode} values</option>
                      {parentOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                )}
                <span className="flex-1" />
                {editable && (
                  <>
                    <button type="button" disabled={!dirty} onClick={() => (isNew ? guard(() => load(lists[0]?.code ?? null)) : load(selected))} className={`${btn} text-slate-600 hover:bg-slate-100`}>
                      <RotateCcw className="h-3.5 w-3.5" /> Undo changes
                    </button>
                    <button type="button" disabled={!dirty} onClick={save} className={`${btn} bg-emerald-700 text-white hover:bg-emerald-800`}>
                      <Save className="h-3.5 w-3.5" /> Save
                    </button>
                  </>
                )}
              </div>
              {typeErrors.values && <p className="text-xs text-red-700">{typeErrors.values}</p>}

              {bulkOpen && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="lov-bulk">
                    Paste or type values, one per line{parentFilter !== 'ALL' ? ` (added under "${parentFilter}")` : ''}
                  </label>
                  <textarea id="lov-bulk" rows={4} className={`${input} w-full`} value={bulk} onChange={(e) => setBulk(e.target.value)} />
                  <div className="flex gap-2">
                    <button type="button" onClick={addBulk} className={`${btn} bg-blue-700 text-white hover:bg-blue-800`}>Add to list</button>
                    <button type="button" onClick={() => setBulkOpen(false)} className={`${btn} text-slate-600 hover:bg-slate-100`}><X className="h-3.5 w-3.5" /> Close</button>
                  </div>
                </div>
              )}

              {/* Values grid */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs" data-testid="lov-values">
                  <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-2 py-2 w-16">Order</th>
                      <th className="px-2 py-2 min-w-48">Display Value</th>
                      <th className="px-2 py-2 min-w-40">Code (LIC)</th>
                      {header.parentCode && <th className="px-2 py-2 min-w-40">Parent Value</th>}
                      <th className="px-2 py-2 w-16 text-center">Active</th>
                      <th className="px-2 py-2 min-w-32">Description</th>
                      {editable && <th className="px-2 py-2 w-16"><span className="sr-only">Actions</span></th>}
                    </tr>
                  </thead>
                  <tbody onKeyDown={onGridKeyDown}>
                    {visible.map((r) => {
                      const group = draft.filter((d) => String(d.parentValue ?? '') === String(r.parentValue ?? ''));
                      const pos = group.indexOf(r);
                      const rowErrors = Object.values(errors[r.id] ?? {});
                      return (
                        <React.Fragment key={r.id}>
                          <tr className={`border-t border-slate-100 ${String(r.status) === 'Inactive' ? 'text-slate-400' : ''}`} data-testid="lov-value-row" data-lov-row={r.id}>
                            <td className="px-2 py-1">
                              <span className="flex items-center gap-0.5">
                                <span className="w-5 text-right font-mono">{pos + 1}</span>
                                {editable && (
                                  <>
                                    <button type="button" aria-label={`Move ${r.value || 'value'} up`} disabled={pos === 0} onClick={() => move(r, -1)} className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer"><ArrowUp className="h-3 w-3" /></button>
                                    <button type="button" aria-label={`Move ${r.value || 'value'} down`} disabled={pos === group.length - 1} onClick={() => move(r, 1)} className="p-0.5 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer"><ArrowDown className="h-3 w-3" /></button>
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="px-1 py-1">
                              <input aria-label="Display Value" className={cell + errCls(r.id, 'value')} value={r.value ?? ''} disabled={!editable} onChange={(e) => update(r.id, { value: e.target.value })} autoFocus={r._new && !r.value} />
                            </td>
                            <td className="px-1 py-1">
                              <input
                                aria-label="Code (LIC)"
                                className={`${cell} font-mono${errCls(r.id, 'lic')}`}
                                value={r.lic ?? ''}
                                placeholder={licFor(String(r.value ?? '')) || 'auto'}
                                disabled={!editable}
                                onChange={(e) => update(r.id, { lic: e.target.value.toUpperCase() })}
                              />
                            </td>
                            {header.parentCode && (
                              <td className="px-1 py-1">
                                <select aria-label="Parent Value" className={cell + errCls(r.id, 'parentValue')} value={r.parentValue ?? ''} disabled={!editable} onChange={(e) => update(r.id, { parentValue: e.target.value })}>
                                  <option value="">Select…</option>
                                  {parentOptions.map((p) => <option key={p}>{p}</option>)}
                                </select>
                              </td>
                            )}
                            <td className="px-2 py-1 text-center">
                              <input
                                type="checkbox"
                                aria-label={`${r.value || 'value'} active`}
                                checked={String(r.status ?? 'Active') !== 'Inactive'}
                                disabled={!editable}
                                onChange={(e) => update(r.id, { status: e.target.checked ? 'Active' : 'Inactive' })}
                                className="h-4 w-4 accent-blue-700 cursor-pointer"
                              />
                            </td>
                            <td className="px-1 py-1">
                              <input aria-label="Description" className={cell} value={r.description ?? ''} disabled={!editable} onChange={(e) => update(r.id, { description: e.target.value })} />
                            </td>
                            {editable && (
                              <td className="px-2 py-1">
                                <span className="flex items-center gap-1">
                                  <button type="button" title="Duplicate row (Ctrl+B)" aria-label={`Duplicate ${r.value || 'value'}`} onClick={() => copyRow(r)} className="p-1 rounded hover:bg-slate-100 cursor-pointer"><Copy className="h-3.5 w-3.5" /></button>
                                  {r._new ? (
                                    <button type="button" title="Remove" aria-label={`Remove ${r.value || 'value'}`} onClick={() => removeRow(r)} className="p-1 rounded text-red-700 hover:bg-red-50 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
                                  ) : (
                                    <span className="px-1 text-[10px] text-slate-400 cursor-help" title="Saved values are kept for history: untick Active to retire">—</span>
                                  )}
                                </span>
                              </td>
                            )}
                          </tr>
                          {rowErrors.length > 0 && (
                            <tr>
                              <td colSpan={7} className="px-3 pb-1.5 text-[11px] text-red-700">{rowErrors.join(' ')}</td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {!visible.length && (
                      <tr>
                        <td colSpan={7} className="px-3 py-4 text-center text-slate-500">No values{parentFilter !== 'ALL' ? ` under "${parentFilter}"` : ''} yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500">
                <b>Ctrl+B</b> duplicates the row you are in — type over the copy's values. Order = position in the dropdown (use the arrows). Code (LIC) is filled from the Display Value when left blank and
                stays fixed when the wording changes. Untick Active to retire a value; old records keep showing it.
                {!editable && ' View only: TML Admin maintains the List of Values.'}
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

const proposed = (h: LovTypeHeader) => (h.fieldName.trim() ? `${h.module}_${toFieldCode(h.fieldName)}` : '');
