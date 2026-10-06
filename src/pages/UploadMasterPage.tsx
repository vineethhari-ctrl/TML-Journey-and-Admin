import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Info, PlusCircle, Upload, XCircle } from 'lucide-react';
import type { WorkBook } from 'xlsx';
import { useApp } from '../context/AppContext';
import { WORKSHOP_MODULES, type MasterConfig } from '../data/masterCatalogue';
import { LOGICAL_MODULES } from '../data/masterCatalogue';
import { buildMasterTemplate, analyseUpload, uploadIsClean, type SheetOutcome } from '../utils/masterUpload';
import { downloadWorkbook, readWorkbook, validateMasterDefinition } from '../utils/masterWorkbook';
import { guessPlacement, masterIdFor, toMasterConfig } from '../utils/smartExcelImport';

const field = 'px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:border-blue-500 focus:outline-hidden';
const badge = (cls: string) => `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`;
const MODULE_CHOICES = [...WORKSHOP_MODULES.map((m) => ({ code: m.code as string, title: m.title })), { code: 'common', title: 'Common Masters' }];

interface Draft {
  name: string;
  moduleCode: string;
  owner: 'TML_ADMIN' | 'DEALER_ADMIN';
}

/**
 * Upload a Master: drop any Excel file. A BA definition workbook creates masters, a sheet in an existing master's own
 * template adds / updates its rows (any column difference is an error), any other table becomes a new master.
 */
export const UploadMasterPage: React.FC = () => {
  const { masterConfigs, importMasters, showToast, navigate, activeRoleId } = useApp();
  const [wb, setWb] = useState<WorkBook | null>(null);
  const [fileName, setFileName] = useState('');
  const [readError, setReadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [templateId, setTemplateId] = useState('common_lov');
  const [done, setDone] = useState<string | null>(null);
  const canUpload = ['superAdmin', 'dealerAdmin'].includes(activeRoleId);

  const analysis = useMemo(() => (wb ? analyseUpload(wb, masterConfigs) : null), [wb, masterConfigs]);

  const draftFor = (o: SheetOutcome): Draft => {
    const key = `${o.sheet}|${o.detected?.range}`;
    return (
      drafts[key] ?? {
        name: o.detected!.name,
        moduleCode: guessPlacement(fileName, o.sheet).moduleCode,
        owner: 'TML_ADMIN',
      }
    );
  };
  const setDraft = (o: SheetOutcome, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [`${o.sheet}|${o.detected?.range}`]: { ...draftFor(o), ...patch } }));

  /** New master from a detected table with the chosen name / module. */
  const newMasterFor = (o: SheetOutcome): { config: MasterConfig; errors: string[] } => {
    const d = draftFor(o);
    const group = masterConfigs.find((m) => m.moduleCode === d.moduleCode)?.logicalGroup ?? guessPlacement(fileName, o.sheet).logicalGroup;
    const config = toMasterConfig(o.detected!, { id: masterIdFor(d.name), name: d.name.trim(), moduleCode: d.moduleCode, logicalGroup: group, owner: d.owner }, fileName);
    return { config, errors: validateMasterDefinition({ ...config, fields: config.fields }, masterConfigs.map((m) => m.id)) };
  };
  const newMasters = (analysis?.sheets ?? []).filter((s) => s.kind === 'new').map((s) => ({ s, ...newMasterFor(s) }));

  const clean = !!analysis && uploadIsClean(analysis) && newMasters.every((n) => n.errors.length === 0);

  const load = async (file: File) => {
    setReadError(null);
    setDone(null);
    setDrafts({});
    try {
      setWb(readWorkbook(new Uint8Array(await file.arrayBuffer())));
      setFileName(file.name);
    } catch {
      setWb(null);
      setReadError(`"${file.name}" could not be read. Save it as an Excel workbook (.xlsx) and try again.`);
    }
  };

  const reset = () => {
    setWb(null);
    setFileName('');
    setDrafts({});
  };

  const doImport = () => {
    if (!analysis || !clean) return;
    if (analysis.mode === 'definition') {
      importMasters(analysis.definition!.masters, `Upload a Master: ${fileName}`);
      setDone(`${analysis.definition!.masters.length} master(s) imported from ${fileName}.`);
    } else {
      const updates = analysis.sheets.filter((s) => s.kind === 'existing' && s.updated).map((s) => s.updated!);
      const created = newMasters.map((n) => n.config);
      importMasters([...updates, ...created], `Upload a Master: ${fileName}`);
      const rows = analysis.sheets.reduce((n, s) => n + s.add + s.update, 0);
      setDone(`${fileName}: ${rows} row(s) saved in ${updates.length} existing master(s)${created.length ? `, ${created.length} new master(s) created` : ''}.`);
    }
    showToast('Upload complete.', 'success');
    reset();
  };

  const template = masterConfigs.find((m) => m.id === templateId);

  if (!canUpload) {
    return (
      <div className="p-6 text-sm text-slate-600" data-testid="upload-master-page">
        Uploading masters is an Admin task. Switch to Super Administrator or Dealer Admin.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6" data-testid="upload-master-page">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Upload a Master</h1>
        <p className="mt-1 text-sm text-slate-600">
          Drop your Excel file here and see straight away whether it can be loaded. Nothing is saved until you press Import, and nothing is saved if
          any problem is shown.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3 text-xs text-slate-700">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="font-bold text-slate-900">Existing master</div>
          Use that master&apos;s own template (download it below). Columns must match exactly — a missing, extra or renamed column is an error. Rows are added as new rows; to change a row, keep its <i>id</i>.
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="font-bold text-slate-900">New master</div>
          Any Excel table with a header row. Each column becomes a field; you choose the module and name here. No coding or deployment.
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="font-bold text-slate-900">BA workbook</div>
          A workbook with <b>Masters</b> and <b>Fields</b> sheets defines masters (module, fields, rules) and their rows in one go.
        </div>
      </section>

      {/* Drop zone */}
      <label
        className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/40 px-4 py-8 text-center hover:bg-blue-50"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) void load(f);
        }}
      >
        <Upload className="h-7 w-7 text-blue-700" />
        <span className="text-sm font-bold text-slate-900">{fileName ? `Selected: ${fileName} — choose another file` : 'Choose or drop an Excel file'}</span>
        <span className="text-[11px] text-slate-500">.xlsx, .xls or .csv</span>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          aria-label="Master Excel file"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void load(f);
            e.target.value = '';
          }}
        />
      </label>
      {readError && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{readError}</p>}
      {done && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900" data-testid="upload-done">
          <CheckCircle2 className="h-4 w-4" /> {done}
          <button type="button" onClick={() => navigate('/admin/masters')} className="ml-auto underline cursor-pointer">Open Masters Maintenance</button>
        </p>
      )}

      {/* Result */}
      {analysis && (
        <section className="space-y-3" data-testid="upload-result">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Check result</h2>
            {clean ? <span className={badge('bg-emerald-100 text-emerald-800')}><CheckCircle2 className="h-3.5 w-3.5" /> Ready to import</span> : <span className={badge('bg-red-100 text-red-800')}><XCircle className="h-3.5 w-3.5" /> Cannot import yet — fix the problems below and upload again</span>}
          </div>

          {analysis.mode === 'definition' && analysis.definition && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-2">
              <div className="font-bold text-slate-900"><FileSpreadsheet className="inline h-4 w-4" /> BA definition workbook</div>
              {analysis.definition.summary.map((s) => (
                <div key={s.id}>
                  <b>{s.name}</b> — {s.action === 'create' ? 'new master' : s.action === 'update' ? 'existing master updated' : 'skipped'}; {s.fieldCount} fields, {s.recordCount} rows
                </div>
              ))}
              {analysis.definition.issues.map((i, n) => (
                <div key={n} className={i.severity === 'error' ? 'text-red-700' : 'text-amber-700'}>
                  {i.severity === 'error' ? '✗' : '!'} {i.sheet}{i.row ? ` row ${i.row}` : ''}: {i.message}
                </div>
              ))}
            </div>
          )}

          {analysis.sheets.map((o) => (
            <article key={`${o.sheet}-${o.detected?.range ?? ''}`} className={`rounded-xl border bg-white p-3 text-xs space-y-2 ${o.ok ? 'border-slate-200' : 'border-red-300'}`} data-testid="sheet-result">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900">Sheet “{o.sheet}”</span>
                {o.kind === 'existing' && o.master && <span className={badge('bg-blue-100 text-blue-800')}>Existing master: {o.master.name} (found by {o.matchedBy})</span>}
                {o.kind === 'new' && <span className={badge('bg-violet-100 text-violet-800')}><PlusCircle className="h-3.5 w-3.5" /> New master</span>}
                {o.kind === 'skipped' && <span className={badge('bg-slate-100 text-slate-600')}>Skipped</span>}
                {o.kind === 'existing' && o.ok && <span className={badge('bg-emerald-100 text-emerald-800')}>{o.add} new row(s) · {o.update} existing row(s) changed · {o.unchanged} already the same</span>}
              </div>
              {o.note && <p className="text-slate-600">{o.note}</p>}

              {o.headerProblems.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-800" data-testid="header-problems">
                  <div className="font-bold">This file is not in the {o.master?.name ?? 'master'} template:</div>
                  <ul className="list-disc pl-5">{o.headerProblems.map((p) => <li key={p}>{p}</li>)}</ul>
                  {o.master && (
                    <button type="button" onClick={() => downloadWorkbook(buildMasterTemplate(o.master!, false), `${o.master!.id}_template.xlsx`)} className="mt-1 inline-flex items-center gap-1 font-semibold underline cursor-pointer">
                      <Download className="h-3.5 w-3.5" /> Download the correct template
                    </button>
                  )}
                </div>
              )}

              {o.issues.length > 0 && o.kind === 'existing' && (
                <div className="overflow-x-auto rounded-lg border border-red-200" data-testid="row-issues">
                  <table className="w-full text-left">
                    <thead className="bg-red-50 text-[11px] uppercase text-red-800"><tr><th className="px-2 py-1 w-16">Row</th><th className="px-2 py-1">Problem</th></tr></thead>
                    <tbody>
                      {o.issues.slice(0, 30).map((i, n) => (
                        <tr key={n} className="border-t border-red-100"><td className="px-2 py-1 font-mono">{i.row ?? '—'}</td><td className="px-2 py-1">{i.message}</td></tr>
                      ))}
                      {o.issues.length > 30 && <tr><td colSpan={2} className="px-2 py-1 text-slate-500">…and {o.issues.length - 30} more.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {o.kind === 'new' && o.detected && (() => {
                const n = newMasters.find((x) => x.s === o);
                const d = draftFor(o);
                return (
                  <div className="space-y-2">
                    <p className="text-slate-600">
                      No existing master has these columns, so it will be created as a new master: {o.detected.columns.length} fields, {o.detected.records.length} rows.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="block"><span className="mb-1 block font-semibold text-slate-600">Master name</span>
                        <input className={`${field} w-full`} aria-label="Master name" value={d.name} onChange={(e) => setDraft(o, { name: e.target.value })} /></label>
                      <label className="block"><span className="mb-1 block font-semibold text-slate-600">Module</span>
                        <select className={`${field} w-full`} aria-label="Module" value={d.moduleCode} onChange={(e) => setDraft(o, { moduleCode: e.target.value })}>
                          {MODULE_CHOICES.map((m) => <option key={m.code} value={m.code}>{m.title}</option>)}
                        </select></label>
                      <label className="block"><span className="mb-1 block font-semibold text-slate-600">Owner</span>
                        <select className={`${field} w-full`} aria-label="Owner" value={d.owner} onChange={(e) => setDraft(o, { owner: e.target.value as Draft['owner'] })}>
                          <option value="TML_ADMIN">TML Admin</option><option value="DEALER_ADMIN">Dealer Admin</option>
                        </select></label>
                    </div>
                    <div className="text-slate-600">Fields: {o.detected.columns.map((c) => `${c.label} (${c.type})`).join(', ')}</div>
                    {n && n.errors.length > 0 && <ul className="list-disc pl-5 text-red-700">{n.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
                    {o.issues.length > 0 && <ul className="list-disc pl-5 text-amber-700">{o.issues.map((i, k) => <li key={k}>{i.message}</li>)}</ul>}
                  </div>
                );
              })()}
            </article>
          ))}

          <div className="flex items-center gap-2">
            <button type="button" disabled={!clean} onClick={doImport} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
              <Upload className="h-4 w-4" /> Import
            </button>
            <button type="button" onClick={reset} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
          </div>
        </section>
      )}

      {/* Templates */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-2">
        <h2 className="text-sm font-bold text-slate-900">Templates of the existing masters</h2>
        <p className="text-slate-600">
          <Info className="inline h-3.5 w-3.5" /> Pick a master and download either an <b>empty template</b> (to add new rows) or its <b>current rows</b> (to change existing rows).
        </p>
        <div className="rounded-lg bg-slate-50 p-3 space-y-1 text-slate-700" data-testid="upload-explainer">
          <div className="font-bold text-slate-900">What happens to each row you upload</div>
          <ul className="list-disc pl-5 space-y-0.5">
            <li><b>Empty template</b> (no <i>id</i> column): every row is added as a <b>new row</b>. Nothing existing is changed.</li>
            <li><b>Current rows</b> file (has an <i>id</i> column): to <b>change</b> an existing row, edit its cells and keep its <i>id</i>. The row with that <i>id</i> is updated instead of a new one being added.</li>
            <li>To add a new row in a <i>Current rows</i> file, leave the <i>id</i> cell empty.</li>
            <li>A cell you leave <b>empty</b> in a row you are changing keeps its present value — you only type what changes.</li>
            <li>A row that is exactly the same as one already saved is not added again (it is flagged as a duplicate or counted as &quot;already the same&quot;).</li>
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={`${field} min-w-64`} aria-label="Master template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {LOGICAL_MODULES.map((g) => (
              <optgroup key={g.id} label={g.title}>
                {masterConfigs.filter((m) => m.logicalGroup === g.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </optgroup>
            ))}
          </select>
          <button type="button" disabled={!template} onClick={() => template && downloadWorkbook(buildMasterTemplate(template, false), `${template.id}_template.xlsx`)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 cursor-pointer">
            <Download className="h-3.5 w-3.5" /> Empty template
          </button>
          <button type="button" disabled={!template} onClick={() => template && downloadWorkbook(buildMasterTemplate(template, true), `${template.id}_current.xlsx`)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50 cursor-pointer">
            <Download className="h-3.5 w-3.5" /> Current rows
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2" data-testid="ba-templates">
          <span className="font-semibold text-slate-700">BA workbook (to define NEW masters):</span>
          {[
            ['TML_Master_Definition_Template.xlsx', 'Blank BA workbook template'],
            ['TML_Master_Practice_Workbook.xlsx', 'Filled example workbook'],
            ['TML_Smart_Excel_Template.xlsx', 'Simple table template (any master)'],
            ['TML_Existing_Masters_Catalogue.xlsx', 'All existing masters (reference)'],
          ].map(([file, label]) => (
            <a key={file} href={`${import.meta.env.BASE_URL}downloads/${file}`} download className="font-semibold text-blue-700 underline">{label}</a>
          ))}
        </div>
        <p className="text-slate-500">In the BA workbook, the <b>Masters</b> sheet names each master and its module; the <b>Fields</b> sheet lists its columns; optional sheets named after a master hold its rows. Upload it here as it is.</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2" data-testid="sample-files">
          <span className="font-semibold text-slate-700">Practice files (test data):</span>
          {[
            ['Sample_Upload_1_LOV_Correct.xlsx', '1. List of Values — correct template'],
            ['Sample_Upload_2_LOV_WrongColumns.xlsx', '2. List of Values — wrong columns (shows the error)'],
            ['Sample_Upload_3_NewMaster.xlsx', '3. A new master (any table)'],
          ].map(([file, label]) => (
            <a key={file} href={`${import.meta.env.BASE_URL}downloads/${file}`} download className="font-semibold text-blue-700 underline">{label}</a>
          ))}
        </div>
        <p className="text-slate-500"><AlertTriangle className="inline h-3.5 w-3.5" /> Column headings are the field names shown on screen. Keep them as they are.</p>
      </section>
    </div>
  );
};
