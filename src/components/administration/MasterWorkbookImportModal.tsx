import React, { useEffect, useMemo, useState } from 'react';
import { Download, Upload, FileSpreadsheet, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { WorkBook } from 'xlsx';
import { Modal } from '../common/Modal';
import { useApp } from '../../context/AppContext';
import { MasterConfig } from '../../data/masterCatalogue';
import {
  buildMasterWorkbook,
  buildTemplateWorkbook,
  parseMasterWorkbook,
  readWorkbook,
  downloadWorkbook,
  ExistingMasterMode,
  PROTECTED_MASTER_IDS,
} from '../../utils/masterWorkbook';

interface MasterWorkbookImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (masters: MasterConfig[]) => void;
}

export const MasterWorkbookImportModal: React.FC<MasterWorkbookImportModalProps> = ({ isOpen, onClose, onImported }) => {
  const { masterConfigs, importMasters, showToast, navigate } = useApp();
  const [workbook, setWorkbook] = useState<WorkBook | null>(null);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<ExistingMasterMode>('skip');
  const [readError, setReadError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setWorkbook(null);
      setFileName('');
      setMode('skip');
      setReadError(null);
    }
  }, [isOpen]);

  const parsed = useMemo(
    () => (workbook ? parseMasterWorkbook(workbook, masterConfigs, mode) : null),
    [workbook, masterConfigs, mode]
  );
  const errors = parsed?.issues.filter((i) => i.severity === 'error') ?? [];
  const warnings = parsed?.issues.filter((i) => i.severity === 'warning') ?? [];
  const toImport = parsed?.summary.filter((s) => s.action !== 'skip') ?? [];

  const handleFile = async (file: File) => {
    setReadError(null);
    try {
      setWorkbook(readWorkbook(new Uint8Array(await file.arrayBuffer())));
      setFileName(file.name);
    } catch {
      setWorkbook(null);
      setReadError(`"${file.name}" could not be read. Save it as an Excel workbook (.xlsx) and try again.`);
    }
  };

  const handleImport = () => {
    if (!parsed || parsed.hasErrors || parsed.masters.length === 0) return;
    importMasters(parsed.masters, `BA Workbook: ${fileName}`);
    onImported(parsed.masters);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import BA Master Workbook"
      subtitle="Create new masters, or add missed fields and records to existing ones, from one Excel workbook"
      maxWidth="4xl"
    >
      <div className="space-y-5 text-xs">
        {/* Step 1: template */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50/60">
          <div>
            <div className="font-bold text-blue-950">1. Start from the template</div>
            <p className="text-slate-600">
              The README sheet explains every column. Need help?{' '}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/admin/masters-guide');
                }}
                className="font-bold text-blue-800 underline cursor-pointer"
              >
                Open the BA Guide
              </button>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                downloadWorkbook(buildTemplateWorkbook(), 'TML_Master_Definition_Template.xlsx');
                showToast('Downloaded BA master definition template', 'success');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 text-white font-bold hover:bg-blue-800 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Download Template
            </button>
            <button
              type="button"
              onClick={() => {
                const exportable = masterConfigs.filter((m) => !PROTECTED_MASTER_IDS.includes(m.id));
                downloadWorkbook(buildMasterWorkbook(exportable), `TML_Masters_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
                showToast(`Exported ${exportable.length} masters in workbook format`, 'success');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 bg-white text-blue-900 font-bold hover:bg-blue-50 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Export Current Masters
            </button>
          </div>
        </div>

        {/* Step 2: upload */}
        <div className="space-y-2">
          <div className="font-bold text-slate-800">2. Upload the completed workbook</div>
          <label className="flex items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-blue-400 cursor-pointer">
            <Upload className="h-4 w-4 text-blue-700" />
            <span className="font-semibold text-slate-700">{fileName || 'Choose .xlsx file'}</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              aria-label="Master workbook file"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
          </label>
          {readError && <p className="text-rose-700 font-semibold">{readError}</p>}

          <fieldset className="flex flex-wrap items-center gap-4 pt-1">
            <legend className="sr-only">When a master already exists</legend>
            <span className="font-semibold text-slate-600">If a master already exists:</span>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="wb-mode" checked={mode === 'skip'} onChange={() => setMode('skip')} /> Skip it
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="wb-mode" checked={mode === 'update'} onChange={() => setMode('update')} /> Update existing masters
              <span className="text-slate-400">(add new fields &amp; upsert records by id)</span>
            </label>
          </fieldset>
        </div>

        {/* Step 3: preview */}
        {parsed && (
          <div className="space-y-3">
            <div className="font-bold text-slate-800">3. Review</div>
            <table className="w-full text-left border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Master</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Fields</th>
                  <th className="px-3 py-2">Records in file</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsed.summary.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2">
                      <div className="font-bold text-slate-900">{s.name || s.id}</div>
                      <div className="font-mono text-[10px] text-slate-400">{s.id}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.action === 'create'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.action === 'update'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {s.action === 'create' ? 'NEW' : s.action === 'update' ? 'UPDATE' : 'SKIPPED'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {s.fieldCount}
                      {s.action === 'update' && s.newFieldCount > 0 && <span className="text-emerald-700"> (+{s.newFieldCount} new)</span>}
                    </td>
                    <td className="px-3 py-2">{s.recordCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {errors.length > 0 && (
              <div role="alert" className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 space-y-1 max-h-48 overflow-y-auto">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> {errors.length} error(s) — fix these in the workbook and upload again
                </div>
                <ul className="space-y-0.5">
                  {errors.map((e, i) => (
                    <li key={i}>
                      <span className="font-mono text-[10px] bg-white px-1 rounded border border-rose-200 mr-1">
                        {e.sheet}
                        {e.row ? ` row ${e.row}` : ''}
                      </span>
                      {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 space-y-1 max-h-36 overflow-y-auto">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> {warnings.length} warning(s)
                </div>
                <ul className="space-y-0.5">
                  {warnings.map((w, i) => (
                    <li key={i}>
                      <span className="font-mono text-[10px]">{w.sheet}{w.row ? ` row ${w.row}` : ''}: </span>
                      {w.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!parsed.hasErrors && toImport.length > 0 && (
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Ready: {toImport.length} master(s) will be imported.
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!parsed || parsed.hasErrors || toImport.length === 0}
            className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold hover:bg-blue-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Import {toImport.length > 0 ? `${toImport.length} Master(s)` : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
};
