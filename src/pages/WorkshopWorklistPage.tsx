import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Download, Info, Search, ShieldCheck, UserRound, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTabPreferences, TabDef } from '../hooks/useTabPreferences';
import { ColumnDef, useColumnPreferences } from '../hooks/useColumnPreferences';
import { useDpdp } from '../hooks/useDpdp';
import { WorkshopTabBar } from '../components/workshop/WorkshopTabBar';
import { ColumnCustomizer } from '../components/workshop/ColumnCustomizer';
import { VehicleRender } from '../components/workshop/VehicleRender';
import { MaskedName, MaskedPhone } from '../components/dpdp/MaskedPii';
import { GRID_COLUMNS, WORKSHOP_TABS, policyForRole, useWorkshopPolicy } from '../data/workshopPolicy';
import { HeroShades, VehicleMasterRow, resolveVehicle, vehicleTrimLabel } from '../utils/vehicleAsset';
import { sanitizeForExport } from '../utils/dpdp';

/**
 * Workshop worklist reference screen, styled on the BU-accepted design (counter tabs, filter bar, grids):
 * personalised tabs within the admin policy, lean columns with a customiser, DPDP masking with CTI click-to-call and
 * audited reveal, and variant + colour vehicle renders. Test data only.
 */

// --- Test data --------------------------------------------------------------------------------------------------

const VEHICLE_MASTER: VehicleMasterRow[] = [
  { regNo: 'MH12TS0001', vin: 'TESTVIN0000000001', model: 'Nexon', variantCode: 'XZ_LUX', variantName: 'XZ+ Lux', colourCode: 'DAYTONA_GREY', colourName: 'Daytona Grey' },
  { regNo: 'MH12TS0002', vin: 'TESTVIN0000000002', model: 'Nexon', variantCode: 'XZ_LUX', variantName: 'XZ+ Lux', colourCode: 'PURE_GREY', colourName: 'Pure Grey (no render yet → hero shade)' },
  { regNo: 'MH12TS0003', vin: 'TESTVIN0000000003', model: 'Punch EV', variantCode: 'EMPOWERED_PLUS', variantName: 'Empowered+', colourCode: 'SEAWEED_GREEN_DUAL_TONE', colourName: 'Seaweed Green, dual-tone' },
  { regNo: 'MH12TS0004', vin: 'TESTVIN0000000004', model: 'Tiago' },
  { regNo: 'MH12TS0005', vin: 'TESTVIN0000000005', model: 'Harrier', variantCode: 'FEARLESS', variantName: 'Fearless' },
];
const HERO_SHADES: HeroShades = { XZ_LUX: 'FLAME_RED' };
const DEMO_ASSETS = `${import.meta.env.BASE_URL}demo-vehicles`;

const SA_ME = { id: 'TML-SA-4011', name: 'Vikramaditya S.' };
const SA_OTHER = { id: 'TML-SA-4019', name: 'Test Advisor B' };

interface Row {
  vehicleNo: string;
  model: string;
  bu: 'PV' | 'EV';
  customerName: string;
  customerMobile: string;
  assignedSa: { id: string; name: string } | null;
  status: string;
  waitingTime: string;
  stageAging: string;
  workshopElapsed: string;
  vehicleType: string;
  customerSeverity: 'Low' | 'Medium' | 'High';
  customerType: string;
  appointmentId: string;
  revisit: boolean;
  criticalCustomer: boolean;
  visitorType: 'Customer' | 'Driver';
  arrival: 'Appointment' | 'Walk-In';
}

const ROWS: Row[] = [
  { vehicleNo: 'MH12TS0001', model: 'Nexon', bu: 'PV', customerName: 'Test Customer Alpha', customerMobile: '+91 90000 13540', assignedSa: SA_ME, status: 'SA Assigned', waitingTime: '00:15', stageAging: '00:20', workshopElapsed: '00:05', vehicleType: 'PV', customerSeverity: 'High', customerType: 'Regular', appointmentId: 'APT-T-0001', revisit: true, criticalCustomer: true, visitorType: 'Customer', arrival: 'Appointment' },
  { vehicleNo: 'MH12TS0002', model: 'Nexon', bu: 'PV', customerName: 'Test Customer Bravo', customerMobile: '+91 90000 27781', assignedSa: SA_ME, status: 'Vehicle Info', waitingTime: '00:20', stageAging: '00:20', workshopElapsed: '--', vehicleType: 'PV', customerSeverity: 'Medium', customerType: 'Fleet', appointmentId: 'APT-T-0002', revisit: false, criticalCustomer: true, visitorType: 'Driver', arrival: 'Appointment' },
  { vehicleNo: 'MH12TS0003', model: 'Punch EV', bu: 'EV', customerName: 'Test Customer Charlie', customerMobile: '+91 90000 39012', assignedSa: SA_OTHER, status: 'Gate-In', waitingTime: '00:20', stageAging: '00:10', workshopElapsed: '--', vehicleType: 'EV', customerSeverity: 'Low', customerType: 'Regular', appointmentId: '—', revisit: true, criticalCustomer: false, visitorType: 'Customer', arrival: 'Walk-In' },
  { vehicleNo: 'MH12TS0004', model: 'Tiago', bu: 'PV', customerName: 'Test Customer Delta', customerMobile: '+91 90000 44120', assignedSa: null, status: 'Gate-In', waitingTime: '00:31', stageAging: '00:31', workshopElapsed: '--', vehicleType: 'PV', customerSeverity: 'Low', customerType: 'Regular', appointmentId: '—', revisit: false, criticalCustomer: false, visitorType: 'Customer', arrival: 'Walk-In' },
  { vehicleNo: 'MH12TS0005', model: 'Harrier', bu: 'PV', customerName: 'Test Customer Echo', customerMobile: '+91 90000 58893', assignedSa: SA_ME, status: 'Est. & Approval', waitingTime: '00:05', stageAging: '02:20', workshopElapsed: '00:25', vehicleType: 'PV', customerSeverity: 'Low', customerType: 'Corporate', appointmentId: 'APT-T-0005', revisit: false, criticalCustomer: false, visitorType: 'Driver', arrival: 'Appointment' },
];

interface MrRow {
  requestId: string;
  jcNo: string;
  vehicleNo: string;
  bu: 'PV' | 'EV';
  status: string;
  requestDateTime: string;
  stageAging: string;
  assignedTo: string;
}

const MR_ROWS: MrRow[] = [
  { requestId: 'MR-T-5001', jcNo: '--', vehicleNo: 'MH12TS0001', bu: 'PV', status: 'New', requestDateTime: '09-07-2026 11:00 AM', stageAging: '00:00:20', assignedTo: 'Test Advisor A' },
  { requestId: 'MR-T-5002', jcNo: 'JC-T-56789', vehicleNo: 'MH12TS0003', bu: 'EV', status: 'Approved by Warranty Manager', requestDateTime: '10-07-2026 12:10 PM', stageAging: '00:00:10', assignedTo: 'Test Advisor B' },
  { requestId: 'MR-T-5003', jcNo: 'JC-T-34567', vehicleNo: 'MH12TS0005', bu: 'PV', status: 'In Progress', requestDateTime: '08-07-2026 12:40 PM', stageAging: '00:00:15', assignedTo: 'Test Advisor A' },
];

const STATUS_STYLE: Record<string, string> = {
  'SA Assigned': 'border-emerald-500 text-emerald-700',
  'Gate-In': 'border-emerald-500 text-emerald-700',
};

const PII_EXPORT_FIELDS = { customerName: 'name', customerMobile: 'phone' } as const;

function downloadCsv(name: string, header: string[], rows: string[][]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const input = 'h-8 rounded-full border border-slate-200 bg-white px-3 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden';

export const WorkshopWorklistPage: React.FC = () => {
  const { currentUser, activeRoleId, showToast, logAudit } = useApp();
  const { canUnmask, canExportPlainPii } = useDpdp();
  const { policy } = useWorkshopPolicy();
  const rolePolicy = policyForRole(policy, activeRoleId);

  // Filters (shared by every grid)
  const [bu, setBu] = useState<'All' | 'PV' | 'EV'>('All');
  const [regNo, setRegNo] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('');
  const [critical, setCritical] = useState('');
  const [revisit, setRevisit] = useState('');
  const [search, setSearch] = useState('');
  const [arrival, setArrival] = useState<'Appointment' | 'Walk-In'>('Appointment');
  const [selected, setSelected] = useState<string | null>(null);

  const matches = (r: { vehicleNo: string; bu: string; status: string }, extra?: Row) => {
    if (bu !== 'All' && r.bu !== bu) return false;
    if (regNo && !r.vehicleNo.toLowerCase().includes(regNo.trim().toLowerCase())) return false;
    if (status && r.status !== status) return false;
    if (extra) {
      // Phone search matches the full number but only the masked value is ever shown.
      if (phone && !extra.customerMobile.replace(/\D/g, '').includes(phone.replace(/\D/g, ''))) return false;
      if (critical && String(extra.criticalCustomer) !== critical) return false;
      if (revisit && String(extra.revisit) !== revisit) return false;
    }
    if (search) {
      const q = search.trim().toLowerCase();
      const hay = [r.vehicleNo, r.status, extra?.model, extra?.appointmentId].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const gateInRows = ROWS.filter((r) => matches(r, r));
  const myRows = ROWS.filter((r) => r.assignedSa?.id === currentUser.userId && matches(r, r));
  const mrRows = MR_ROWS.filter((r) => matches(r));

  const tabs: TabDef[] = useMemo(() => {
    const counts: Record<string, number> = {
      gate_in: ROWS.length,
      my_assignment: ROWS.filter((r) => r.assignedSa?.id === currentUser.userId).length,
      pre_inspection: 3,
      estimate_approvals: 3,
      active_job_cards: 5,
      mr_details: MR_ROWS.length,
      thd: 1,
      additional_jobs: 3,
      quality_inspection: 3,
    };
    return WORKSHOP_TABS.filter((t) => rolePolicy.allowedTabs.includes(t.id)).map((t) => ({ ...t, badge: counts[t.id] }));
  }, [rolePolicy.allowedTabs, currentUser.userId]);

  const prefs = useTabPreferences({ userId: currentUser.userId, roleId: activeRoleId, tabs, roleDefault: rolePolicy.tabs, maxInline: 6 });
  const [activeTab, setActiveTab] = useState(prefs.defaultLandingTab);
  // A different user / role opens on their own landing tab.
  useEffect(() => {
    setActiveTab(prefs.defaultLandingTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.userId, activeRoleId]);
  const currentTab = tabs.some((t) => t.id === activeTab) ? activeTab : prefs.defaultLandingTab;

  const vehicleCell = (vehicleNo: string, highlight = false) => (
    <button type="button" onClick={() => setSelected(vehicleNo)} className={`flex items-center gap-2 font-medium underline underline-offset-2 cursor-pointer ${highlight ? 'text-red-600' : 'text-slate-800'}`}>
      <VehicleRender vehicle={resolveVehicle(vehicleNo, VEHICLE_MASTER)} heroShades={HERO_SHADES} size="thumb" assetBase={DEMO_ASSETS} />
      {vehicleNo}
    </button>
  );
  const actionCell = (vehicleNo: string) => (
    <button type="button" onClick={() => setSelected(vehicleNo)} aria-label={`Open ${vehicleNo}`} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white cursor-pointer">
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );

  const rowColumns: ColumnDef<Row>[] = useMemo(() => {
    const render: Record<string, (r: Row) => React.ReactNode> = {
      action: (r) => actionCell(r.vehicleNo),
      vehicleNo: (r) => vehicleCell(r.vehicleNo, r.criticalCustomer && !r.assignedSa),
      assignedSa: (r) => (r.assignedSa ? (r.assignedSa.id === currentUser.userId ? `${r.assignedSa.name} (you)` : r.assignedSa.name) : '-'),
      customerName: (r) => <MaskedName name={r.customerName} vehicleRegNo={r.vehicleNo} assignedSa={r.assignedSa ?? {}} />,
      maskedPhone: (r) => <MaskedPhone phone={r.customerMobile} vehicleRegNo={r.vehicleNo} />,
      revisit: (r) => (r.revisit ? <CheckCircle2 className="h-4 w-4 text-red-600" aria-label="Revisit" /> : null),
      criticalCustomer: (r) =>
        r.criticalCustomer ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-700 px-2 py-0.5 text-[10px] font-semibold text-white">
            <UserRound className="h-3 w-3" /> Critical Customer
          </span>
        ) : null,
      status: (r) => <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] ${STATUS_STYLE[r.status] ?? 'border-blue-500 text-blue-700'}`}>{r.status}</span>,
      vehicleType: (r) => <span className={`font-bold ${r.vehicleType === 'EV' ? 'text-emerald-600' : 'text-blue-700'}`}>{r.vehicleType}</span>,
      appointmentId: (r) => <span className="underline underline-offset-2">{r.appointmentId}</span>,
    };
    const all = [...GRID_COLUMNS.gate_in, ...GRID_COLUMNS.my_assignment];
    return [...new Map(all.map((c) => [c.key, c])).values()].map((c) => ({
      ...c,
      pii: c.key === 'customerName' ? ('name' as const) : c.key === 'maskedPhone' ? ('phone' as const) : undefined,
      render: render[c.key],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.userId]);

  const mrColumns: ColumnDef<MrRow>[] = useMemo(
    () =>
      GRID_COLUMNS.mr_details.map((c) => ({
        ...c,
        render:
          c.key === 'action'
            ? (r: MrRow) => actionCell(r.vehicleNo)
            : c.key === 'requestId'
              ? (r: MrRow) => <span className="font-medium underline underline-offset-2">{r.requestId}</span>
              : c.key === 'vehicleNo'
                ? (r: MrRow) => vehicleCell(r.vehicleNo)
                : undefined,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const gridTab = GRID_COLUMNS[currentTab] ? currentTab : null;
  const isMr = gridTab === 'mr_details';
  const keysFor = (id: string) => new Set(GRID_COLUMNS[id].map((c) => c.key));
  const tabRowColumns = useMemo(() => (gridTab && !isMr ? rowColumns.filter((c) => keysFor(gridTab).has(c.key)) : rowColumns.slice(0, 1)), [rowColumns, gridTab, isMr]);
  const rowCols = useColumnPreferences<Row>({
    userId: currentUser.userId,
    roleId: activeRoleId,
    tabId: gridTab && !isMr ? gridTab : 'gate_in',
    columns: tabRowColumns,
    preset: rolePolicy.columns[gridTab && !isMr ? gridTab : 'gate_in'],
  });
  const mrCols = useColumnPreferences<MrRow>({ userId: currentUser.userId, roleId: activeRoleId, tabId: 'mr_details', columns: mrColumns, preset: rolePolicy.columns.mr_details });

  const tableRows: Array<Row | MrRow> = isMr ? mrRows : currentTab === 'my_assignment' ? myRows : gateInRows.filter((r) => r.arrival === arrival);
  const visible = (isMr ? mrCols.visibleColumns : rowCols.visibleColumns) as ColumnDef<Row | MrRow>[];

  const exportCsv = () => {
    const cols = visible.filter((c) => c.key !== 'action');
    const data = isMr ? (tableRows as MrRow[]) : sanitizeForExport(tableRows as Row[], PII_EXPORT_FIELDS, canExportPlainPii);
    const valueOf = (r: Row | MrRow, key: string): string => {
      if (key === 'maskedPhone') return (r as Row).customerMobile;
      if (key === 'assignedSa') return (r as Row).assignedSa?.name ?? '-';
      const v = (r as unknown as Record<string, unknown>)[key];
      return typeof v === 'boolean' ? (v ? 'Y' : 'N') : String(v ?? '');
    };
    downloadCsv(`Worklist_${gridTab}.csv`, cols.map((c) => c.label), data.map((r) => cols.map((c) => valueOf(r, c.key))));
    logAudit('EXPORT_WORKLIST', 'DPDP', gridTab ?? '', '', canExportPlainPii ? 'Plain PII (supervisor permission)' : 'PII masked', canExportPlainPii ? 'WARNING' : 'SUCCESS');
    showToast(canExportPlainPii ? 'Exported with full customer details (supervisor permission, logged)' : 'Exported with customer details masked', 'success');
  };

  const statuses = [...new Set((isMr ? MR_ROWS : ROWS).map((r) => r.status))];
  const selectedRow = ROWS.find((r) => r.vehicleNo === selected);

  return (
    <div className="space-y-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Workshop Worklist</h1>
          <p className="text-xs text-slate-500">Reference screen for the dealer-app team (BU design). Tabs and default columns per role are set in Admin → Workshop Tabs &amp; Columns. Test data only.</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800" data-testid="dpdp-status">
          <ShieldCheck className="h-3.5 w-3.5" /> DPDP: {canUnmask ? 'you can reveal PII (logged)' : 'PII masked for your role'} · export {canExportPlainPii ? 'full (supervisor)' : 'masked'}
        </span>
      </div>

      <WorkshopTabBar prefs={prefs} activeTab={currentTab} onSelect={setActiveTab} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5" data-testid="worklist-filters">
        <div className="flex rounded-full bg-slate-100 p-0.5 text-[11px] font-semibold">
          {(['All', 'PV', 'EV'] as const).map((b) => (
            <button key={b} type="button" onClick={() => setBu(b)} aria-pressed={bu === b} className={`rounded-full px-3 py-1 cursor-pointer ${bu === b ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}>
              {b}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input aria-label="Reg. Number" placeholder="Reg. Number" className={`${input} w-32`} value={regNo} onChange={(e) => setRegNo(e.target.value)} />
          {!isMr && <input aria-label="Phone No." placeholder="Phone No." inputMode="numeric" className={`${input} w-28`} value={phone} onChange={(e) => setPhone(e.target.value)} />}
          <select aria-label="Status" className={`${input} w-32`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Status</option>
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
          {!isMr && (
            <>
              <select aria-label="Critical Customer" className={`${input} w-36`} value={critical} onChange={(e) => setCritical(e.target.value)}>
                <option value="">Critical Customer</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
              <select aria-label="Revisit" className={`${input} w-24`} value={revisit} onChange={(e) => setRevisit(e.target.value)}>
                <option value="">Revisit</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </>
          )}
          <span className="relative">
            <input aria-label="Search here" placeholder="Search here" className={`${input} w-32 pr-7`} value={search} onChange={(e) => setSearch(e.target.value)} />
            <Search className="pointer-events-none absolute right-2.5 top-2 h-4 w-4 text-slate-400" />
          </span>
          {gridTab && <ColumnCustomizer prefs={(isMr ? mrCols : rowCols) as never} />}
        </div>
      </div>

      {gridTab ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span className="text-sm font-bold text-slate-900" data-testid="grid-title">
              {gridTab === 'gate_in' ? "Today's Gate-In" : WORKSHOP_TABS.find((t) => t.id === gridTab)?.label} · {tableRows.length} vehicles
            </span>
            <div className="flex items-center gap-2">
              {gridTab === 'gate_in' && (
                <div className="flex rounded-full border border-slate-200 p-0.5 text-[11px] font-semibold">
                  {(['Appointment', 'Walk-In'] as const).map((a) => (
                    <button key={a} type="button" onClick={() => setArrival(a)} aria-pressed={arrival === a} className={`rounded-full px-3 py-1 cursor-pointer ${arrival === a ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`}>
                      {a === 'Appointment' ? 'Appointments' : a}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={exportCsv} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto px-3 pb-3">
            <table className="w-full overflow-hidden rounded-lg text-xs" data-testid="worklist-grid">
              <thead className="bg-slate-100 text-left text-[11px] text-slate-700">
                <tr>
                  {visible.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-3 py-2.5 font-semibold">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => (
                  <tr key={(r as MrRow).requestId ?? r.vehicleNo} className="border-b border-slate-100 even:bg-slate-50/60">
                    {visible.map((c) => (
                      <td key={c.key} className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        {c.render ? c.render(r) : String((r as unknown as Record<string, unknown>)[c.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan={visible.length} className="px-3 py-6 text-center text-slate-500">
                      No vehicles match the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-xs text-slate-600">
          <Info className="h-4 w-4 shrink-0 text-slate-400" /> This worklist is built by the dealer-app team. Sample grids: "Today's Total Gate-In", "My Assignment" and "MR Details".
        </div>
      )}

      {selectedRow && <VehicleInfoCard row={selectedRow} onClose={() => setSelected(null)} />}
    </div>
  );
};

/** Vehicle Information header card (TASK-04): 3/4 render next to the Reg No and trim label. */
const VehicleInfoCard: React.FC<{ row: Row; onClose: () => void }> = ({ row, onClose }) => {
  const v = resolveVehicle(row.vehicleNo, VEHICLE_MASTER);
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4" data-testid="vehicle-info-card">
      <VehicleRender vehicle={v} heroShades={HERO_SHADES} assetBase={DEMO_ASSETS} />
      <div className="min-w-0 flex-1 space-y-1 text-xs">
        <div className="font-mono text-lg font-bold text-slate-900">{v.regNo}</div>
        <div className="font-semibold text-slate-700">
          {v.model} {vehicleTrimLabel(v) && <span className="font-normal text-slate-500">· {vehicleTrimLabel(v)}</span>}
        </div>
        <div className="text-slate-500">VIN {v.vin ?? '—'} · VC {v.variantCode ?? 'not in master'} · Colour {v.colourCode ?? 'not in master'}</div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <MaskedName name={row.customerName} vehicleRegNo={row.vehicleNo} assignedSa={row.assignedSa ?? {}} className="font-semibold text-slate-800" />
          <MaskedPhone phone={row.customerMobile} vehicleRegNo={row.vehicleNo} />
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close vehicle card" className="self-start rounded-md p-1 text-slate-400 hover:bg-slate-100 cursor-pointer">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
