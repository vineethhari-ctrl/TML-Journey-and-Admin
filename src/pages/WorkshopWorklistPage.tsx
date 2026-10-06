import React, { useEffect, useMemo, useState } from 'react';
import { Download, Info, ShieldCheck, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTabPreferences, TabDef } from '../hooks/useTabPreferences';
import { ColumnDef, useColumnPreferences } from '../hooks/useColumnPreferences';
import { useDpdp } from '../hooks/useDpdp';
import { WorkshopTabBar } from '../components/workshop/WorkshopTabBar';
import { ColumnCustomizer } from '../components/workshop/ColumnCustomizer';
import { VehicleRender } from '../components/workshop/VehicleRender';
import { MaskedName, MaskedPhone } from '../components/dpdp/MaskedPii';
import { TabPreference, ColumnPreference } from '../utils/viewPreferences';
import { HeroShades, VehicleMasterRow, resolveVehicle, vehicleTrimLabel } from '../utils/vehicleAsset';
import { sanitizeForExport } from '../utils/dpdp';

/**
 * Workshop worklist reference screen (TASK-01..04): personalised tabs, lean columns with a customiser, DPDP masking
 * with CTI click-to-call and audited reveal, and variant + colour vehicle renders. Test data only.
 * The dealer-app team can reuse the hooks / components: useTabPreferences, useColumnPreferences, MaskedPhone,
 * MaskedName, VehicleRender, sanitizeForExport.
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
  customerName: string;
  customerMobile: string;
  assignedSa: { id: string; name: string };
  status: string;
  waitingTime: string;
  stageAging: string;
  vehicleType: string;
  customerSeverity: string;
  customerType: string;
  appointmentId: string;
  revisit: string;
  visitorType: string;
}

const ROWS: Row[] = [
  { vehicleNo: 'MH12TS0001', model: 'Nexon', customerName: 'Test Customer Alpha', customerMobile: '+91 90000 13540', assignedSa: SA_ME, status: 'Waiting for SA', waitingTime: '12 min', stageAging: '0h 12m', vehicleType: 'ICE', customerSeverity: 'Normal', customerType: 'Retail', appointmentId: 'APT-T-0001', revisit: 'N', visitorType: 'Walk-in' },
  { vehicleNo: 'MH12TS0002', model: 'Nexon', customerName: 'Test Customer Bravo', customerMobile: '+91 90000 27781', assignedSa: SA_ME, status: 'Pre-inspection', waitingTime: '25 min', stageAging: '0h 40m', vehicleType: 'ICE', customerSeverity: 'High', customerType: 'Fleet', appointmentId: 'APT-T-0002', revisit: 'Y', visitorType: 'Appointment' },
  { vehicleNo: 'MH12TS0003', model: 'Punch EV', customerName: 'Test Customer Charlie', customerMobile: '+91 90000 39012', assignedSa: SA_OTHER, status: 'Estimate pending', waitingTime: '5 min', stageAging: '1h 05m', vehicleType: 'EV', customerSeverity: 'Normal', customerType: 'Retail', appointmentId: 'APT-T-0003', revisit: 'N', visitorType: 'Appointment' },
  { vehicleNo: 'MH12TS0004', model: 'Tiago', customerName: 'Test Customer Delta', customerMobile: '+91 90000 44120', assignedSa: SA_OTHER, status: 'Waiting for SA', waitingTime: '31 min', stageAging: '0h 31m', vehicleType: 'ICE', customerSeverity: 'Normal', customerType: 'Retail', appointmentId: '—', revisit: 'N', visitorType: 'Walk-in' },
  { vehicleNo: 'MH12TS0005', model: 'Harrier', customerName: 'Test Customer Echo', customerMobile: '+91 90000 58893', assignedSa: SA_ME, status: 'Job card open', waitingTime: '—', stageAging: '2h 20m', vehicleType: 'ICE', customerSeverity: 'VIP', customerType: 'Corporate', appointmentId: 'APT-T-0005', revisit: 'N', visitorType: 'Appointment' },
];

// --- Tabs (TASK-01) ---------------------------------------------------------------------------------------------

const TABS: TabDef[] = [
  { id: 'gate_in', label: "Today's Total Gate-In", badge: 5 },
  { id: 'my_assignment', label: 'My Assignment', badge: 3 },
  { id: 'pre_inspection', label: 'Pre Inspection', badge: 1 },
  { id: 'estimate_approvals', label: 'Pending Estimate Approvals', badge: 1 },
  { id: 'active_job_cards', label: 'My Active Job Cards', badge: 2 },
  { id: 'mr_details', label: 'MR Details', badge: 0 },
  { id: 'thd', label: 'THD', badge: 1 },
  { id: 'additional_jobs', label: 'Additional Jobs & Parts', badge: 2 },
  { id: 'quality_inspection', label: 'Quality Inspection', badge: 0 },
];

/** Role presets used until a user saves their own layout. The SA preset is the spec example. */
const ROLE_TAB_DEFAULTS: Record<string, TabPreference> = {
  serviceAdvisor: {
    defaultLandingTab: 'my_assignment',
    tabOrder: ['my_assignment', 'gate_in', 'pre_inspection', 'estimate_approvals', 'active_job_cards', 'mr_details'],
    hiddenTabs: ['thd', 'additional_jobs', 'quality_inspection'],
  },
  default: { defaultLandingTab: 'gate_in', tabOrder: TABS.map((t) => t.id), hiddenTabs: [] },
};

// --- Columns (TASK-03) ------------------------------------------------------------------------------------------

const COLUMN_PRESETS: Record<string, ColumnPreference> = {
  gate_in: {
    pinnedLeft: ['vehicleNo'],
    pinnedRight: ['action'],
    visibleColumns: ['vehicleNo', 'model', 'assignedSa', 'status', 'waitingTime', 'action'],
    hiddenColumns: ['customerSeverity', 'customerType', 'appointmentId', 'revisit', 'customerName', 'maskedPhone'],
  },
  my_assignment: {
    pinnedLeft: ['action', 'vehicleNo'],
    pinnedRight: [],
    visibleColumns: ['action', 'vehicleNo', 'model', 'customerName', 'maskedPhone', 'status', 'stageAging', 'vehicleType'],
    hiddenColumns: ['customerType', 'customerSeverity', 'visitorType'],
  },
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

export const WorkshopWorklistPage: React.FC = () => {
  const { currentUser, activeRoleId, showToast, logAudit } = useApp();
  const { canUnmask, canExportPlainPii } = useDpdp();
  const roleDefault = ROLE_TAB_DEFAULTS[activeRoleId] ?? ROLE_TAB_DEFAULTS.default;
  const tabs = useTabPreferences({ userId: currentUser.userId, roleId: activeRoleId, tabs: TABS, roleDefault, maxInline: 5 });
  const [activeTab, setActiveTab] = useState(tabs.defaultLandingTab);
  const [selected, setSelected] = useState<Row | null>(null);
  // A different user / role opens on their own landing tab.
  useEffect(() => {
    setActiveTab(tabs.defaultLandingTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.userId, activeRoleId]);

  const gridTab = COLUMN_PRESETS[activeTab] ? activeTab : null;
  const rows = activeTab === 'my_assignment' ? ROWS.filter((r) => r.assignedSa.id === SA_ME.id) : ROWS;

  const columns: ColumnDef<Row>[] = useMemo(
    () => [
      {
        key: 'vehicleNo',
        label: 'Vehicle No',
        render: (r) => (
          <button type="button" onClick={() => setSelected(r)} className="flex items-center gap-2 font-mono font-semibold text-blue-800 hover:underline cursor-pointer">
            <VehicleRender vehicle={resolveVehicle(r.vehicleNo, VEHICLE_MASTER)} heroShades={HERO_SHADES} size="thumb" assetBase={DEMO_ASSETS} />
            {r.vehicleNo}
          </button>
        ),
      },
      { key: 'model', label: 'Model' },
      { key: 'customerName', label: 'Customer', pii: 'name', render: (r) => <MaskedName name={r.customerName} vehicleRegNo={r.vehicleNo} assignedSa={r.assignedSa} /> },
      { key: 'maskedPhone', label: 'Mobile', pii: 'phone', render: (r) => <MaskedPhone phone={r.customerMobile} vehicleRegNo={r.vehicleNo} /> },
      { key: 'assignedSa', label: 'Assigned SA', render: (r) => (r.assignedSa.id === currentUser.userId ? `${r.assignedSa.name} (you)` : r.assignedSa.name) },
      { key: 'status', label: 'Status' },
      { key: 'waitingTime', label: 'Waiting Time' },
      { key: 'stageAging', label: 'Stage Aging' },
      { key: 'vehicleType', label: 'Vehicle Type' },
      { key: 'customerSeverity', label: 'Customer Severity' },
      { key: 'customerType', label: 'Customer Type' },
      { key: 'appointmentId', label: 'Appointment ID' },
      { key: 'revisit', label: 'Revisit' },
      { key: 'visitorType', label: 'Visitor Type' },
      {
        key: 'action',
        label: 'Action',
        render: (r) => (
          <button type="button" onClick={() => setSelected(r)} className="rounded-md bg-blue-700 px-2 py-1 text-[11px] font-bold text-white hover:bg-blue-600 cursor-pointer">
            Open
          </button>
        ),
      },
    ],
    [currentUser.userId],
  );
  const tabColumns = useMemo(() => {
    const preset = COLUMN_PRESETS[gridTab ?? 'gate_in'];
    const keys = new Set([...preset.visibleColumns, ...preset.hiddenColumns]);
    return columns.filter((c) => keys.has(c.key));
  }, [columns, gridTab]);
  const cols = useColumnPreferences<Row>({ userId: currentUser.userId, roleId: activeRoleId, tabId: gridTab ?? 'gate_in', columns: tabColumns, preset: COLUMN_PRESETS[gridTab ?? 'gate_in'] });

  const exportCsv = () => {
    const visible = cols.visibleColumns.filter((c) => c.key !== 'action');
    const data = sanitizeForExport(rows.map((r) => ({ ...r, assignedSaName: r.assignedSa.name })), PII_EXPORT_FIELDS, canExportPlainPii);
    const valueOf = (r: (typeof data)[number], key: string) =>
      key === 'maskedPhone' ? r.customerMobile : key === 'assignedSa' ? r.assignedSaName : String((r as unknown as Record<string, unknown>)[key] ?? '');
    downloadCsv(`Worklist_${gridTab}.csv`, visible.map((c) => c.label), data.map((r) => visible.map((c) => valueOf(r, c.key))));
    logAudit('EXPORT_WORKLIST', 'DPDP', gridTab ?? '', '', canExportPlainPii ? 'Plain PII (supervisor permission)' : 'PII masked', canExportPlainPii ? 'WARNING' : 'SUCCESS');
    showToast(canExportPlainPii ? 'Exported with full customer details (supervisor permission, logged)' : 'Exported with customer details masked', 'success');
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Workshop Worklist</h1>
          <p className="text-xs text-slate-500">Reference screen for the dealer-app team: personalised tabs, lean columns, DPDP masking and vehicle renders. Test data only.</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800" data-testid="dpdp-status">
          <ShieldCheck className="h-3.5 w-3.5" /> DPDP: {canUnmask ? 'you can reveal PII (logged)' : 'PII masked for your role'} · export {canExportPlainPii ? 'full (supervisor)' : 'masked'}
        </span>
      </div>

      <WorkshopTabBar prefs={tabs} activeTab={activeTab} onSelect={setActiveTab} />

      {gridTab ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
            <span className="text-xs font-bold text-slate-700" data-testid="grid-title">
              {TABS.find((t) => t.id === gridTab)?.label} · {rows.length} vehicles
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={exportCsv} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
              <ColumnCustomizer prefs={cols} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="worklist-grid">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  {cols.visibleColumns.map((c) => (
                    <th key={c.key} className={`whitespace-nowrap px-3 py-2 font-semibold ${cols.isPinned(c.key) ? 'bg-slate-100' : ''}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.vehicleNo} className="border-t border-slate-100">
                    {cols.visibleColumns.map((c) => (
                      <td key={c.key} className={`whitespace-nowrap px-3 py-2 ${cols.isPinned(c.key) ? 'bg-slate-50/60' : ''}`}>
                        {c.render ? c.render(r) : String((r as unknown as Record<string, unknown>)[c.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-xs text-slate-600">
          <Info className="h-4 w-4 shrink-0 text-slate-400" /> This worklist is built by the dealer-app team. The two sample grids are on "Today's Total Gate-In" and "My Assignment".
        </div>
      )}

      {selected && <VehicleInfoCard row={selected} onClose={() => setSelected(null)} />}
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
          <MaskedName name={row.customerName} vehicleRegNo={row.vehicleNo} assignedSa={row.assignedSa} className="font-semibold text-slate-800" />
          <MaskedPhone phone={row.customerMobile} vehicleRegNo={row.vehicleNo} />
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close vehicle card" className="self-start rounded-md p-1 text-slate-400 hover:bg-slate-100 cursor-pointer">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
