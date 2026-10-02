import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Info, Sparkles, Upload, XCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { SmartExcelPicture } from './SmartExcelPicture';
import { useApp } from '../../context/AppContext';
import { LOGICAL_MODULES, MasterConfig, MasterFieldDef, WORKSHOP_MODULES } from '../../data/masterCatalogue';
import { validateMasterDefinition } from '../../utils/masterWorkbook';
import { masterValidationSchema } from '../../utils/masterValidationSchema';
import {
  DetectedColumn,
  DetectedMaster,
  DraftPlacement,
  SmartImportResult,
  detectMasters,
  fieldsFor,
  guessPlacement,
  masterIdFor,
  readRawWorkbook,
  recordsFor,
  toMasterConfig,
} from '../../utils/smartExcelImport';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: (masters: MasterConfig[]) => void;
}

interface Draft extends DraftPlacement {
  include: boolean;
  detected: DetectedMaster;
}

const input = 'w-full px-2 py-1 rounded-md border border-slate-200 bg-white text-xs focus:border-violet-500 focus:outline-hidden';
const TYPES: MasterFieldDef['type'][] = ['text', 'number', 'select', 'date'];

/** Upload a BA's own Excel (any layout) → review the detected masters → create them. */
export const SmartExcelImportModal: React.FC<Props> = ({ isOpen, onClose, onImported }) => {
  const { masterConfigs, importMasters } = useApp();
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<SmartImportResult | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [readError, setReadError] = useState<string | null>(null);
  const [openIdx, setOpenIdx] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setFileName('');
      setResult(null);
      setDrafts([]);
      setReadError(null);
      setOpenIdx(0);
    }
  }, [isOpen]);

  const handleFile = async (file: File) => {
    setReadError(null);
    try {
      const res = detectMasters(readRawWorkbook(new Uint8Array(await file.arrayBuffer())));
      setResult(res);
      setFileName(file.name);
      setDrafts(
        res.masters.map((d) => ({
          ...guessPlacement(file.name, d.sheet),
          include: true,
          id: d.id,
          name: d.name,
          owner: 'TML_ADMIN',
          detected: d,
        }))
      );
      setOpenIdx(0);
    } catch {
      setResult(null);
      setDrafts([]);
      setReadError(`"${file.name}" could not be read. Save it as an Excel workbook (.xlsx) and try again.`);
    }
  };

  const update = (i: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const updateColumn = (i: number, k: number, patch: Partial<DetectedColumn>) =>
    setDrafts((ds) =>
      ds.map((d, j) => {
        if (j !== i) return d;
        const columns = d.detected.columns.map((c, m) => {
          if (m !== k) return c;
          const next = { ...c, ...patch };
          // Switching to dropdown: offer the values found in the sheet
          if (patch.type === 'select' && !next.options?.length) {
            next.options = [...new Set(d.detected.records.map((r) => String(r[c.key] ?? '').trim()).filter(Boolean))];
          }
          return next;
        });
        return { ...d, detected: { ...d.detected, columns } };
      })
    );

  // Per-draft problems: definition errors (ids, options…) and records that won't pass validation
  const checks = useMemo(() => {
    const taken = new Set(masterConfigs.map((m) => m.id.toLowerCase()));
    return drafts.map((d) => {
      if (!d.include) return { errors: [] as string[], badRows: [] as string[] };
      const fields = fieldsFor(d.detected.columns);
      const errors = validateMasterDefinition({ ...d, fields }, taken);
      taken.add(d.id.toLowerCase());
      const badRows: string[] = [];
      recordsFor(d.detected).forEach((r, k) => {
        const res = masterValidationSchema.validateRecord(fields, r, d.id);
        if (!res.isValid) badRows.push(`Row ${d.detected.rowNumbers[k]}: ${Object.values(res.errors).join(' ')}`);
      });
      return { errors, badRows };
    });
  }, [drafts, masterConfigs]);

  const selected = drafts.filter((d) => d.include);
  const blocked = checks.some((c) => c.errors.length > 0 || c.badRows.length > 0);

  const handleCreate = () => {
    if (blocked || selected.length === 0) return;
    const configs = selected.map((d) => toMasterConfig(d.detected, d, fileName));
    importMasters(configs, `Smart Excel Import: ${fileName}`);
    onImported(configs);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Smart Excel Import"
      subtitle="Upload a BA's Excel as it is — tables, column types and gaps are detected for you to review"
      maxWidth="4xl"
    >
      <div className="space-y-4 text-xs" data-testid="smart-import">
        <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/50 cursor-pointer hover:bg-violet-50">
          <Upload className="h-5 w-5 text-violet-700" />
          <span className="font-bold text-violet-950">{fileName ? `Loaded: ${fileName} — choose another file` : 'Choose the BA Excel file (.xlsx)'}</span>
          <span className="text-slate-500">Any layout: several sheets, side-by-side tables, repeated PV / EV blocks, a "Master List" sheet.</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            aria-label="BA Excel file"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
        </label>

        {!result && (
          <details className="rounded-xl border border-slate-200 bg-slate-50/60 p-3" open>
            <summary className="cursor-pointer text-xs font-bold text-slate-800">What a good sheet looks like (and the template to send to BAs)</summary>
            <div className="pt-3">
              <SmartExcelPicture compact />
            </div>
          </details>
        )}

        {readError && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800">
            <XCircle className="h-4 w-4" /> {readError}
          </div>
        )}

        {result && result.notes.length > 0 && (
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-0.5" data-testid="smart-import-notes">
            {result.notes.map((n) => (
              <div key={n} className="flex items-start gap-1.5 text-slate-600">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {n}
              </div>
            ))}
          </div>
        )}

        {result && drafts.length === 0 && <p className="text-slate-500">No tables with a header row and data were found.</p>}

        {drafts.map((d, i) => {
          const check = checks[i];
          const isOpenCard = openIdx === i;
          return (
            <div key={`${d.detected.sheet}-${d.detected.range}`} className="rounded-xl border border-slate-200 bg-white" data-testid="smart-draft">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-100">
                <input type="checkbox" aria-label={`Include ${d.name}`} checked={d.include} onChange={(e) => update(i, { include: e.target.checked })} />
                <FileSpreadsheet className="h-4 w-4 text-violet-700" />
                <button type="button" onClick={() => setOpenIdx(isOpenCard ? -1 : i)} className="font-bold text-slate-900 hover:underline cursor-pointer">
                  {d.name}
                </button>
                <span className="text-slate-400">
                  sheet "{d.detected.sheet}" · {d.detected.range} · {d.detected.records.length} rows · {d.detected.columns.length} columns
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  {d.detected.issues.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">{d.detected.issues.length} gap(s)</span>
                  )}
                  {d.include && (check.errors.length || check.badRows.length) ? (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">fix before import</span>
                  ) : d.include ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">ready</span>
                  ) : null}
                </span>
              </div>

              {isOpenCard && d.include && (
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor={`sm-name-${i}`}>Master name</label>
                      <input
                        id={`sm-name-${i}`}
                        className={input}
                        value={d.name}
                        onChange={(e) => update(i, { name: e.target.value, id: masterIdFor(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor={`sm-id-${i}`}>Master ID</label>
                      <input id={`sm-id-${i}`} className={`${input} font-mono`} value={d.id} onChange={(e) => update(i, { id: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor={`sm-group-${i}`}>Group</label>
                      <select id={`sm-group-${i}`} className={input} value={d.logicalGroup} onChange={(e) => update(i, { logicalGroup: e.target.value })}>
                        {LOGICAL_MODULES.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor={`sm-module-${i}`}>Module</label>
                      <select id={`sm-module-${i}`} className={input} value={d.moduleCode} onChange={(e) => update(i, { moduleCode: e.target.value })}>
                        {WORKSHOP_MODULES.map((m) => <option key={m.code} value={m.code}>{m.title}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="px-2 py-1.5">Column</th>
                          <th className="px-2 py-1.5">Type</th>
                          <th className="px-2 py-1.5">Mandatory</th>
                          <th className="px-2 py-1.5">Dropdown options</th>
                          <th className="px-2 py-1.5">Sample</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {d.detected.columns.map((c, k) => (
                          <tr key={c.key}>
                            <td className="px-2 py-1">
                              <div className="font-semibold text-slate-800">{c.label}</div>
                              <div className="font-mono text-[10px] text-slate-400">{c.key}</div>
                            </td>
                            <td className="px-2 py-1">
                              <select aria-label={`Type of ${c.label}`} className={input} value={c.type} onChange={(e) => updateColumn(i, k, { type: e.target.value as MasterFieldDef['type'] })}>
                                {TYPES.map((t) => <option key={t}>{t}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1 text-center">
                              <input type="checkbox" aria-label={`${c.label} mandatory`} checked={c.mandatory} onChange={(e) => updateColumn(i, k, { mandatory: e.target.checked })} />
                            </td>
                            <td className="px-2 py-1 min-w-[180px]">
                              {c.type === 'select' ? (
                                <input
                                  // Edited as free text; applied when the field loses focus so commas can be typed
                                  key={(c.options ?? []).join('|')}
                                  aria-label={`Options of ${c.label}`}
                                  className={input}
                                  defaultValue={(c.options ?? []).join(', ')}
                                  onBlur={(e) => updateColumn(i, k, { options: [...new Set(e.target.value.split(',').map((o) => o.trim()).filter(Boolean))] })}
                                />
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-2 py-1 text-slate-500 max-w-[200px] truncate">
                              {d.detected.records
                                .map((r) => r[c.key])
                                .filter((v) => v !== '' && v !== null)
                                .slice(0, 3)
                                .join(' · ') || <span className="italic text-slate-300">empty</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {d.detected.issues.length > 0 && (
                    <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900" data-testid="smart-gaps">
                      <div className="font-bold flex items-center gap-1.5 mb-0.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> Gaps in the Excel (imported as they are — send back to the BA)
                      </div>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {d.detected.issues.map((x) => <li key={x}>{x}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {d.include && (check.errors.length > 0 || check.badRows.length > 0) && (
                <div className="mx-3 mb-3 p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800" data-testid="smart-errors">
                  <div className="font-bold mb-0.5">Fix before import</div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {[...check.errors, ...check.badRows.slice(0, 5)].map((x) => <li key={x}>{x}</li>)}
                    {check.badRows.length > 5 && <li>…and {check.badRows.length - 5} more row(s)</li>}
                  </ul>
                  <p className="mt-1 text-rose-700">Tip: untick "Mandatory" for a column the BA left blank, or change its type.</p>
                </div>
              )}
            </div>
          );
        })}

        {drafts.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="flex items-center gap-1.5 text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-violet-600" /> Gaps are kept as they are and listed in each master, so nothing is guessed.
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-lg border border-slate-200 font-semibold cursor-pointer">Cancel</button>
              <button
                type="button"
                disabled={blocked || selected.length === 0}
                onClick={handleCreate}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-700 text-white font-bold hover:bg-violet-600 disabled:opacity-40 cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Create {selected.length} master(s)
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
