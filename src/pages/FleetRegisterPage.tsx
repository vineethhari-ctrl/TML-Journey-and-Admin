import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertTriangle, CheckCircle2, Download, Info, Search, ShieldCheck, Trash2, Truck, Upload, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useFleetRegister } from '../data/fleetRegister';
import {
  FLEET_TEMPLATE_HEADERS,
  FleetUploadMode,
  FleetUploadPreview,
  applyFleetUpload,
  canUploadFleet,
  classifyVehicle,
  normaliseChassis,
  previewFleetUpload,
} from '../utils/fleetRegister';

const ROLES: Array<[string, string]> = [
  ['dealerAdmin', 'Dealer Admin'],
  ['dgm', 'DGM'],
  ['serviceAdvisor', 'Service Advisor'],
  ['receptionist', 'Receptionist'],
  ['cro', 'CRO (Telecaller)'],
];

const ASSUMPTIONS = [
  'Key = Chassis No (17-character VIN). Fleet Account, Valid From, Valid To, Active and Remarks are optional.',
  'One central list owned by TML (not per dealer). The TML admin always has the upload privilege and can grant it to other roles below.',
  'A vehicle is Fleet only while its row is active and today is within Valid From / Valid To (when given). Everything else is Individual.',
  'An upload either adds / updates by chassis, or replaces the whole list. Every upload and change is written to the Audit Log.',
];

const card = 'rounded-xl border border-slate-200 bg-white p-4 text-xs';

/**
 * Admin Portal → Fleet Register: the chassis list that makes a vehicle "Fleet" (badge under the customer name).
 * Viewing is open to admins; uploading needs the fleet-upload privilege.
 */
export const FleetRegisterPage: React.FC = () => {
  const { activeRoleId, currentUser, logAudit, showToast } = useApp();
  const { vehicles, settings, setVehicles, setUploadRoles } = useFleetRegister();
  const canUpload = canUploadFleet(activeRoleId, settings.uploadRoles);
  const isTmlAdmin = activeRoleId === 'superAdmin';

  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<FleetUploadPreview | null>(null);
  const [readError, setReadError] = useState('');
  const [mode, setMode] = useState<FleetUploadMode>('merge');
  const [query, setQuery] = useState('');
  const [check, setCheck] = useState('');

  const today = useMemo(() => vehicles.map((v) => classifyVehicle(v.chassisNo, vehicles)), [vehicles]);
  const fleetToday = today.filter((c) => c.category === 'FLEET').length;
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vehicles
      .map((v, i) => ({ v, c: today[i] }))
      .filter(({ v }) => !q || v.chassisNo.toLowerCase().includes(q) || v.fleetAccount.toLowerCase().includes(q));
  }, [vehicles, today, query]);

  const onFile = async (file: File) => {
    setReadError('');
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
      setPreview(previewFleetUpload(json, vehicles));
      setFileName(file.name);
    } catch {
      setPreview(null);
      setReadError(`"${file.name}" could not be read. Save it as Excel (.xlsx) or CSV and try again.`);
    }
  };

  const commit = () => {
    if (!preview || preview.valid.length === 0) return;
    const res = applyFleetUpload(vehicles, preview.valid, mode, { userId: currentUser.userId, at: new Date().toISOString() });
    setVehicles(res.register);
    const summary = `${res.added} added, ${res.updated} updated${mode === 'replace' ? `, ${res.removed} removed` : ''}`;
    logAudit('Fleet List Uploaded', 'Fleet Register', fileName, `${vehicles.length} vehicles`, `${res.register.length} vehicles (${mode === 'replace' ? 'replace' : 'add / update'}: ${summary})`);
    showToast(`Fleet list saved — ${summary}.`, 'success');
    setPreview(null);
    setFileName('');
  };

  const toggleActive = (chassisNo: string) => {
    const before = vehicles.find((v) => v.chassisNo === chassisNo);
    if (!before) return;
    setVehicles(vehicles.map((v) => (v.chassisNo === chassisNo ? { ...v, active: !v.active, uploadedBy: currentUser.userId, uploadedAt: new Date().toISOString() } : v)));
    logAudit(before.active ? 'Fleet Vehicle Deactivated' : 'Fleet Vehicle Activated', 'Fleet Register', chassisNo, before.active ? 'Active' : 'Inactive', before.active ? 'Inactive' : 'Active');
  };

  const remove = (chassisNo: string) => {
    setVehicles(vehicles.filter((v) => v.chassisNo !== chassisNo));
    logAudit('Fleet Vehicle Removed', 'Fleet Register', chassisNo, 'Fleet', 'Individual (removed from list)', 'WARNING');
    showToast(`${chassisNo} removed — it now shows as Individual.`, 'info');
  };

  const toggleRole = (roleId: string, on: boolean) => {
    const next = on ? [...settings.uploadRoles, roleId] : settings.uploadRoles.filter((r) => r !== roleId);
    setUploadRoles(next);
    logAudit('Fleet Upload Privilege Changed', 'Fleet Register', roleId, on ? 'Not granted' : 'Granted', on ? 'Granted' : 'Not granted');
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([FLEET_TEMPLATE_HEADERS, ['MAT700000K1000000', 'Test Fleet Account', '01-04-2026', '31-03-2027', 'Y', 'Example row — replace']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fleet List');
    XLSX.writeFile(wb, 'TML_Fleet_List_template.xlsx');
  };

  const exportList = () => {
    const ws = XLSX.utils.json_to_sheet(
      vehicles.map((v, i) => ({
        'Chassis No': v.chassisNo,
        'Fleet Account': v.fleetAccount,
        'Valid From': v.validFrom,
        'Valid To': v.validTo,
        'Active (Y/N)': v.active ? 'Y' : 'N',
        Remarks: v.remarks,
        'Today': today[i].category === 'FLEET' ? 'Fleet' : 'Individual',
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fleet List');
    XLSX.writeFile(wb, 'TML_Fleet_List.xlsx');
    logAudit('Fleet List Exported', 'Fleet Register', 'TML_Fleet_List.xlsx', '', `${vehicles.length} vehicles`);
  };

  const errors = preview?.issues.filter((i) => i.level === 'error') ?? [];
  const infos = preview?.issues.filter((i) => i.level === 'info') ?? [];
  const checkResult = check.trim() ? classifyVehicle(check, vehicles) : null;

  return (
    <div className="space-y-4 p-4 sm:p-6" data-testid="fleet-register">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Truck className="h-5 w-5 text-amber-600" /> Fleet Register</h1>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Fleet flag · chassis numbers uploaded here show as Fleet; all other vehicles are Individual</p>
          <p className="text-xs text-slate-500">The badge appears under the customer name (Vehicle Info, TML Journey).</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            <Download className="h-3.5 w-3.5" /> Template
          </button>
          <button onClick={exportList} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
            <Download className="h-3.5 w-3.5" /> Export list
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-slate-700" data-testid="fleet-assumptions">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-amber-900"><Info className="h-4 w-4" /> Working assumptions — the BA has not given more detail</h2>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
          {ASSUMPTIONS.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={card}><div className="text-slate-500">On the fleet list</div><div className="text-2xl font-black text-slate-900" data-testid="fleet-count">{vehicles.length}</div></div>
        <div className={card}><div className="text-slate-500">Fleet today</div><div className="text-2xl font-black text-amber-700" data-testid="fleet-today">{fleetToday}</div></div>
        <div className={card}><div className="text-slate-500">Listed but Individual today</div><div className="text-2xl font-black text-slate-500">{vehicles.length - fleetToday}</div><div className="text-[11px] text-slate-400">inactive, not yet valid or expired</div></div>
      </div>

      <section className={card}>
        <h2 className="mb-2 text-sm font-bold text-slate-900">Check a vehicle</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Chassis No to check"
            value={check}
            onChange={(e) => setCheck(e.target.value)}
            placeholder="Chassis No (VIN)"
            className="w-64 rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs uppercase"
          />
          {checkResult && (
            <span data-testid="fleet-check-result" className={`font-bold ${checkResult.category === 'FLEET' ? 'text-amber-700' : 'text-slate-600'}`}>
              {normaliseChassis(check)} → {checkResult.category === 'FLEET' ? `Fleet${checkResult.entry?.fleetAccount ? ` (${checkResult.entry.fleetAccount})` : ''}` : 'Individual'}
              {checkResult.reason && <span className="ml-1 font-normal text-slate-500">— {checkResult.reason}</span>}
            </span>
          )}
        </div>
      </section>

      {canUpload ? (
        <section className={card} data-testid="fleet-upload">
          <h2 className="mb-2 text-sm font-bold text-slate-900">Upload fleet chassis numbers</h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-900 px-3 py-1.5 font-semibold text-white hover:bg-blue-800">
              <Upload className="h-3.5 w-3.5" />
              {fileName ? `Loaded: ${fileName} — choose another` : 'Choose Excel / CSV'}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                data-testid="fleet-file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                  e.target.value = '';
                }}
              />
            </label>
            <fieldset className="flex items-center gap-3">
              <legend className="sr-only">Upload mode</legend>
              <label className="inline-flex items-center gap-1"><input type="radio" name="fleet-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Add / update</label>
              <label className="inline-flex items-center gap-1"><input type="radio" name="fleet-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace whole list</label>
            </fieldset>
          </div>
          {readError && <p className="mt-2 text-rose-700">{readError}</p>}
          {preview && (
            <div className="mt-3 space-y-2" data-testid="fleet-preview">
              {preview.noChassisColumn ? (
                <p className="flex items-center gap-1.5 font-semibold text-rose-700"><XCircle className="h-4 w-4" /> No "Chassis No" column found. Use the template headers: {FLEET_TEMPLATE_HEADERS.join(', ')}.</p>
              ) : (
                <>
                  <p className="flex items-center gap-1.5 font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {preview.valid.length} row(s) ready{errors.length ? `, ${errors.length} row(s) with errors will be skipped` : ''}.</p>
                  {preview.missingColumns.length > 0 && <p className="text-slate-500">Optional columns not in the file: {preview.missingColumns.join(', ')}.</p>}
                  {mode === 'replace' && <p className="flex items-center gap-1.5 font-semibold text-amber-700"><AlertTriangle className="h-4 w-4" /> Replace: chassis numbers not in this file become Individual.</p>}
                  {[...errors, ...infos].length > 0 && (
                    <table className="w-full text-left">
                      <thead className="text-slate-500"><tr><th className="py-1 pr-3">Row</th><th className="pr-3">Chassis No</th><th>Check</th></tr></thead>
                      <tbody>
                        {[...errors, ...infos].map((i) => (
                          <tr key={`${i.row}-${i.message}`} className={i.level === 'error' ? 'text-rose-700' : 'text-slate-500'}>
                            <td className="py-0.5 pr-3">{i.row}</td>
                            <td className="pr-3 font-mono">{i.chassisNo || '—'}</td>
                            <td>{i.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="flex gap-2">
                    <button onClick={commit} disabled={preview.valid.length === 0} className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-40 cursor-pointer">
                      Save {preview.valid.length} vehicle(s)
                    </button>
                    <button onClick={() => { setPreview(null); setFileName(''); }} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 cursor-pointer">Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600" data-testid="fleet-no-privilege">
          View only — your role does not hold the fleet-upload privilege. Ask the TML admin to grant it.
        </p>
      )}

      {isTmlAdmin && (
        <section className={card} data-testid="fleet-privilege">
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-slate-900"><ShieldCheck className="h-4 w-4 text-blue-700" /> Fleet-upload privilege</h2>
          <p className="mb-2 text-slate-500">The TML admin always has it. Tick a role to let it upload and change the fleet list too.</p>
          <div className="flex flex-wrap gap-4">
            {ROLES.map(([id, label]) => (
              <label key={id} className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={settings.uploadRoles.includes(id)} onChange={(e) => toggleRole(id, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        </section>
      )}

      <section className={card}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">Fleet list</h2>
          <label className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input aria-label="Search fleet list" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chassis or account" className="rounded-lg border border-slate-200 py-1.5 pl-7 pr-2.5 text-xs" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left" data-testid="fleet-table">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-1.5 pr-3">Chassis No</th><th className="pr-3">Fleet Account</th><th className="pr-3">Valid From</th><th className="pr-3">Valid To</th>
                <th className="pr-3">Active</th><th className="pr-3">Today</th><th className="pr-3">Last change</th>{canUpload && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ v, c }) => (
                <tr key={v.chassisNo} className="border-b border-slate-100" data-chassis={v.chassisNo}>
                  <td className="py-1.5 pr-3 font-mono font-semibold">{v.chassisNo}</td>
                  <td className="pr-3">{v.fleetAccount || '—'}</td>
                  <td className="pr-3">{v.validFrom || '—'}</td>
                  <td className="pr-3">{v.validTo || '—'}</td>
                  <td className="pr-3">{v.active ? 'Y' : 'N'}</td>
                  <td className="pr-3" title={c.reason}>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.category === 'FLEET' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                      {c.category === 'FLEET' ? 'Fleet' : 'Individual'}
                    </span>
                  </td>
                  <td className="pr-3 text-slate-500">{v.uploadedBy} · {v.uploadedAt.slice(0, 10)}</td>
                  {canUpload && (
                    <td className="whitespace-nowrap">
                      <button onClick={() => toggleActive(v.chassisNo)} className="mr-2 font-semibold text-blue-700 hover:underline cursor-pointer">{v.active ? 'Deactivate' : 'Activate'}</button>
                      <button onClick={() => remove(v.chassisNo)} aria-label={`Remove ${v.chassisNo}`} className="text-rose-600 hover:text-rose-800 cursor-pointer"><Trash2 className="inline h-3.5 w-3.5" /></button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="py-4 text-center text-slate-400">No vehicles on the fleet list{query ? ' match this search' : ''}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
