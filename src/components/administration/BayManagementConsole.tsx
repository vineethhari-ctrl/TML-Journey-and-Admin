import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Upload,
  FileSpreadsheet,
  ShieldCheck,
  Power,
  RotateCcw,
  Mail,
  ExternalLink,
  Copy,
  Clock,
  Layers,
  Settings2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBays } from '../../context/BayContext';
import { Modal } from '../common/Modal';
import { DEALER_DIVISIONS } from '../../data/bayData';
import { masterExportUtil } from '../../utils/masterExportUtil';
import {
  Actor,
  Bay,
  BayStatus,
  BAY_TYPES,
  BUS,
  FLOORS,
  LIFTS,
  STATUS_REASONS,
  NewBayInput,
  allocationUsage,
} from '../../utils/bayGovernance';

export interface DealerInfo {
  code: string;
  name: string;
  zone: string;
}

interface Props {
  adminRole: 'Dealer Admin' | 'TML Admin';
  dealers: DealerInfo[];
  onBulkUpload: () => void;
}

const sel = 'w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:border-blue-500 focus:outline-hidden';

const StatusBadge: React.FC<{ bay: Bay }> = ({ bay }) => (
  <span
    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
      bay.bayStatus === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
    }`}
  >
    {bay.bayStatus}
  </span>
);

const ApprovalBadge: React.FC<{ bay: Bay; pendingKind?: string }> = ({ bay, pendingKind }) => {
  if (bay.pendingRequestId && pendingKind === 'STATUS_CHANGE') {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1">
        <Clock className="h-3 w-3" /> Status change pending
      </span>
    );
  }
  const cls =
    bay.approvalStatus === 'Approved'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : bay.approvalStatus === 'Pending Approval'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-rose-100 text-rose-800';
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{bay.approvalStatus}</span>;
};

export const BayManagementConsole: React.FC<Props> = ({ adminRole, dealers, onBulkUpload }) => {
  const { currentUser, navigate, showToast, activeRoleId } = useApp();
  const bayStore = useBays();
  const { bays, allocations, requests, policy } = bayStore;

  const isTml = adminRole === 'TML Admin';
  const actor: Actor = isTml
    ? { name: currentUser.name, role: 'TML_ADMIN', email: currentUser.email }
    : activeRoleId === 'dealerAdmin'
    ? { name: currentUser.name, role: 'DEALER_ADMIN', email: currentUser.email }
    : { name: 'K. Venkatesh', role: 'DEALER_ADMIN', email: 'k.venkatesh@prerana.tatamotors.com' };

  // ---- Filters
  const [dealerCode, setDealerCode] = useState(dealers[0]?.code ?? 'DLR1001');
  const [division, setDivision] = useState('All');
  const [bu, setBu] = useState('All');
  const [bayType, setBayType] = useState('All');
  const [status, setStatus] = useState('All');
  const [approval, setApproval] = useState('All');
  const [nameQuery, setNameQuery] = useState('');
  const dealer = dealers.find((d) => d.code === dealerCode) ?? dealers[0];
  const divisions = DEALER_DIVISIONS[dealerCode] ?? ['Main Workshop'];

  const requestById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);
  const dealerBays = bays.filter((b) => b.dealerCode === dealerCode);
  const filteredBays = dealerBays.filter(
    (b) =>
      (division === 'All' || b.division === division) &&
      (bu === 'All' || b.bu === bu) &&
      (bayType === 'All' || b.bayType === bayType) &&
      (status === 'All' || b.bayStatus === status) &&
      (approval === 'All' || b.approvalStatus === approval) &&
      (!nameQuery.trim() || b.bayName.toLowerCase().includes(nameQuery.trim().toLowerCase()))
  );
  const pendingForDealer = requests.filter((r) => r.dealerCode === dealerCode && r.status === 'PENDING').length;
  const pendingAll = requests.filter((r) => r.status === 'PENDING').length;

  // ---- Allocation editor (TML)
  const dealerAllocations = allocations.filter((a) => a.dealerCode === dealerCode);
  const [allocDraft, setAllocDraft] = useState<Record<string, string>>({});
  const [newAlloc, setNewAlloc] = useState({ division: divisions[0], bu: 'PV' as Bay['bu'], bayType: 'Mechanical' as Bay['bayType'], allocated: '1' });
  useEffect(() => {
    setNewAlloc((n) => ({ ...n, division: (DEALER_DIVISIONS[dealerCode] ?? ['Main Workshop'])[0] }));
    setDivision('All');
  }, [dealerCode]);

  // ---- New bay dialog
  const emptyBay = (): NewBayInput => ({
    dealerCode,
    dealerName: dealer?.name ?? dealerCode,
    region: ((dealer?.zone as Bay['region']) || 'South'),
    division: divisions[0],
    bu: 'PV',
    bayType: 'Mechanical',
    bayName: '',
    floor: 'Ground',
    liftAvailability: 'No Lift',
    techSupervisor: '',
    tech1: '',
    tech2: '',
    justification: '',
  });
  const [newBay, setNewBay] = useState<NewBayInput | null>(null);
  const newBayUsage = newBay ? allocationUsage(bayStore, newBay) : null;
  const newBayBeyond = !!newBayUsage && newBayUsage.used >= newBayUsage.allocated;

  // ---- Status change dialog
  const [statusDialog, setStatusDialog] = useState<{ bay: Bay; to: BayStatus; reason: string; other: string } | null>(null);
  const statusNeedsApproval = !isTml && policy.dealerStatusChangeNeedsApproval;

  // ---- Resubmit dialog
  const [resubmit, setResubmit] = useState<{ bay: Bay; text: string } | null>(null);

  // ---- Inspector (non-governed attributes only)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = bays.find((b) => b.id === selectedId) ?? null;

  const canChangeStatus = isTml || policy.dealerCanChangeStatus;

  return (
    <div className="space-y-4">
      {/* Governance banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="font-bold text-blue-950 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-blue-700" /> Bay governance — acting as{' '}
            <span className="px-1.5 py-0.5 rounded bg-blue-900 text-white text-[10px]">{adminRole}</span>
          </div>
          <ul className="text-[11px] text-slate-600 space-y-0.5">
            <li>• Bays within the TML allocation go live immediately; beyond it they go to the <strong>TML Network Manager</strong>.</li>
            <li>
              • Active ⇄ Inactive:{' '}
              {!policy.dealerCanChangeStatus
                ? 'TML Admin only.'
                : policy.dealerStatusChangeNeedsApproval
                ? 'Dealer Admin requests need TML Admin approval; TML Admin changes apply immediately.'
                : 'Dealer Admin and TML Admin can change directly.'}
            </li>
          </ul>
        </div>
        <div className="flex items-center gap-2">
          {pendingForDealer > 0 && (
            <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold text-[11px]">
              {pendingForDealer} request(s) pending for {dealerCode}
            </span>
          )}
          {isTml && (
            <button
              onClick={() => navigate('/admin/bay-approvals')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 text-white font-bold hover:bg-blue-800 cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Bay Approvals {pendingAll > 0 ? `(${pendingAll})` : ''}
            </button>
          )}
        </div>
      </div>

      {/* Dealer + filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
          <div className="col-span-2">
            <label htmlFor="bay-dealer" className="text-[11px] font-semibold text-slate-600 block mb-1">Dealer</label>
            <select id="bay-dealer" className={sel} value={dealerCode} onChange={(e) => setDealerCode(e.target.value)}>
              {dealers.map((d) => (
                <option key={d.code} value={d.code}>{d.code} - {d.name}</option>
              ))}
            </select>
          </div>
          {(
            [
              ['Division', division, setDivision, ['All', ...divisions]],
              ['BU', bu, setBu, ['All', ...BUS]],
              ['Bay Type', bayType, setBayType, ['All', ...BAY_TYPES]],
              ['Bay Status', status, setStatus, ['All', 'Active', 'Inactive']],
              ['Approval', approval, setApproval, ['All', 'Approved', 'Pending Approval', 'Rejected']],
            ] as const
          ).map(([label, value, setter, options]) => (
            <div key={label}>
              <label htmlFor={`bay-f-${label}`} className="text-[11px] font-semibold text-slate-600 block mb-1">{label}</label>
              <select id={`bay-f-${label}`} className={sel} value={value} onChange={(e) => (setter as (v: string) => void)(e.target.value)}>
                {options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          ))}
          <div>
            <label htmlFor="bay-f-name" className="text-[11px] font-semibold text-slate-600 block mb-1">Bay Name</label>
            <input id="bay-f-name" className={sel} value={nameQuery} placeholder="Search" onChange={(e) => setNameQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {/* TML allocation */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden" data-testid="bay-allocations">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-blue-700" /> TML Bay Allocation — {dealer?.name}
            </h3>
            <p className="text-[11px] text-slate-500">
              Set by TML Admin per division and BU. {isTml ? 'Edit counts below.' : 'Read-only for Dealer Admin.'}
            </p>
          </div>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-4 py-2">Division</th>
              <th className="px-3 py-2">BU</th>
              <th className="px-3 py-2">Bay Type</th>
              <th className="px-3 py-2">Allocated</th>
              <th className="px-3 py-2">Approved Bays</th>
              <th className="px-3 py-2">Remaining</th>
              {isTml && <th className="px-3 py-2 text-right">Update</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dealerAllocations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-slate-400">
                  No allocation set for this dealer yet — every bay a dealer adds will need TML Network Manager approval.
                </td>
              </tr>
            )}
            {dealerAllocations.map((a) => {
              const u = allocationUsage(bayStore, a);
              return (
                <tr key={a.id}>
                  <td className="px-4 py-2 font-semibold text-slate-800">{a.division}</td>
                  <td className="px-3 py-2">{a.bu}</td>
                  <td className="px-3 py-2">{a.bayType}</td>
                  <td className="px-3 py-2 font-mono font-bold">{a.allocated}</td>
                  <td className="px-3 py-2 font-mono">{u.used}</td>
                  <td className={`px-3 py-2 font-mono font-bold ${u.remaining === 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{u.remaining}</td>
                  {isTml && (
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center gap-1">
                        <input
                          aria-label={`Allocation ${a.division} ${a.bu} ${a.bayType}`}
                          type="number"
                          min={0}
                          className="w-16 px-2 py-1 rounded border border-slate-200 text-xs"
                          value={allocDraft[a.id] ?? String(a.allocated)}
                          onChange={(e) => setAllocDraft({ ...allocDraft, [a.id]: e.target.value })}
                        />
                        <button
                          disabled={(allocDraft[a.id] ?? String(a.allocated)) === String(a.allocated)}
                          onClick={() => {
                            const res = bayStore.setAllocation(a, Number(allocDraft[a.id]), actor);
                            if (res.ok) showToast(`Allocation updated to ${allocDraft[a.id]}`, 'success');
                          }}
                          className="px-2 py-1 rounded bg-blue-900 text-white text-[11px] font-bold disabled:opacity-30 cursor-pointer"
                        >
                          Save
                        </button>
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
            {isTml && (
              <tr className="bg-slate-50/60">
                <td className="px-4 py-2">
                  <select aria-label="New allocation division" className={sel} value={newAlloc.division} onChange={(e) => setNewAlloc({ ...newAlloc, division: e.target.value })}>
                    {divisions.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select aria-label="New allocation BU" className={sel} value={newAlloc.bu} onChange={(e) => setNewAlloc({ ...newAlloc, bu: e.target.value as Bay['bu'] })}>
                    {BUS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select aria-label="New allocation bay type" className={sel} value={newAlloc.bayType} onChange={(e) => setNewAlloc({ ...newAlloc, bayType: e.target.value as Bay['bayType'] })}>
                    {BAY_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input aria-label="New allocation count" type="number" min={0} className="w-16 px-2 py-1 rounded border border-slate-200 text-xs" value={newAlloc.allocated} onChange={(e) => setNewAlloc({ ...newAlloc, allocated: e.target.value })} />
                </td>
                <td colSpan={2} />
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => {
                      const res = bayStore.setAllocation({ dealerCode, division: newAlloc.division, bu: newAlloc.bu, bayType: newAlloc.bayType }, Number(newAlloc.allocated), actor);
                      if (res.ok) showToast('Allocation saved', 'success');
                    }}
                    className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-500 cursor-pointer"
                  >
                    + Set allocation
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bays */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between p-4 border-b border-slate-200 gap-3">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Workshop Bays ({filteredBays.length})</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNewBay(emptyBay())}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-xs font-bold text-white shadow-2xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> New Bay
            </button>
            <button
              onClick={() => {
                masterExportUtil.exportToExcel({
                  masterName: 'Bay Management Master',
                  category: 'Dealer Network',
                  currentUser: { userId: currentUser.userId, name: currentUser.name },
                  columns: [
                    { key: 'id', label: 'Bay ID' },
                    { key: 'dealerCode', label: 'Dealer Code' },
                    { key: 'division', label: 'Division' },
                    { key: 'bu', label: 'BU' },
                    { key: 'bayName', label: 'Bay Name' },
                    { key: 'bayType', label: 'Bay Type' },
                    { key: 'bayStatus', label: 'Status' },
                    { key: 'approvalStatus', label: 'Approval' },
                    { key: 'floor', label: 'Floor' },
                    { key: 'liftAvailability', label: 'Lift' },
                    { key: 'techSupervisor', label: 'Tech Supervisor' },
                  ],
                  data: filteredBays,
                });
                showToast(`Exported ${filteredBays.length} bays to Excel`, 'success');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Export to Excel
            </button>
            <button
              onClick={onBulkUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-blue-600" /> Bulk Upload
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-3 py-3">No.</th>
                <th className="px-3 py-3">Division</th>
                <th className="px-3 py-3">BU</th>
                <th className="px-4 py-3">Bay Name</th>
                <th className="px-3 py-3">Bay Type</th>
                <th className="px-3 py-3">Bay Status</th>
                <th className="px-3 py-3">Approval</th>
                <th className="px-3 py-3">Lift</th>
                <th className="px-3 py-3">Floor</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBays.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-slate-400">No bays match the filters.</td>
                </tr>
              )}
              {filteredBays.map((b) => {
                const pendingKind = b.pendingRequestId ? requestById.get(b.pendingRequestId)?.kind : undefined;
                const target: BayStatus = b.bayStatus === 'Active' ? 'Inactive' : 'Active';
                return (
                  <tr
                    key={b.id}
                    data-bay-id={b.id}
                    onClick={() => setSelectedId(b.id)}
                    className={`cursor-pointer transition-colors ${selectedId === b.id ? 'bg-blue-50/70' : 'hover:bg-slate-50/70'}`}
                  >
                    <td className="px-3 py-2.5 font-mono text-slate-600">{b.no}</td>
                    <td className="px-3 py-2.5 text-slate-700">{b.division}</td>
                    <td className="px-3 py-2.5 text-slate-700">{b.bu}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">{b.bayName}</td>
                    <td className="px-3 py-2.5 text-slate-700">{b.bayType}</td>
                    <td className="px-3 py-2.5"><StatusBadge bay={b} /></td>
                    <td className="px-3 py-2.5"><ApprovalBadge bay={b} pendingKind={pendingKind} /></td>
                    <td className="px-3 py-2.5 text-slate-600">{b.liftAvailability}</td>
                    <td className="px-3 py-2.5 text-slate-600">{b.floor}</td>
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {b.approvalStatus === 'Approved' && !b.pendingRequestId && canChangeStatus && (
                        <button
                          onClick={() => setStatusDialog({ bay: b, to: target, reason: '', other: '' })}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                            target === 'Inactive'
                              ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          <Power className="h-3 w-3" /> {target === 'Inactive' ? 'Inactivate' : 'Activate'}
                        </button>
                      )}
                      {b.approvalStatus === 'Rejected' && !isTml && (
                        <button
                          onClick={() => setResubmit({ bay: b, text: '' })}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border border-blue-200 text-blue-800 hover:bg-blue-50 cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" /> Resubmit
                        </button>
                      )}
                      {b.pendingRequestId && <span className="text-[10px] text-amber-700">Awaiting TML</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspector: physical attributes only (type / division / BU / status are governed) */}
      {selected && <BayInspector key={selected.id} bay={selected} />}

      {/* Requests for this dealer */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2" data-testid="bay-requests">
        <h3 className="text-sm font-bold text-slate-900">Approval requests — {dealerCode}</h3>
        {requests.filter((r) => r.dealerCode === dealerCode).length === 0 ? (
          <p className="text-xs text-slate-400">No requests yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-1.5">Request</th>
                <th>Type</th>
                <th>Bay</th>
                <th>Approver</th>
                <th>Status</th>
                <th>Decision note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests
                .filter((r) => r.dealerCode === dealerCode)
                .map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 font-mono text-[11px]">{r.id}</td>
                    <td>{r.kind === 'ADD_BAY' ? 'Additional bay' : `Status → ${r.toStatus}`}</td>
                    <td className="font-semibold">{r.bayName}</td>
                    <td>{r.approverRole}</td>
                    <td>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="text-slate-500">{r.decisionNote ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Policy (TML only can change) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2 text-xs" data-testid="bay-policy">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Settings2 className="h-4 w-4 text-slate-500" /> Bay status policy {isTml ? '' : '(set by TML Admin)'}
        </h3>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={!isTml}
            checked={policy.dealerCanChangeStatus}
            onChange={(e) => bayStore.setPolicy({ ...policy, dealerCanChangeStatus: e.target.checked }, actor)}
          />
          Dealer Admin can change bay status (Active ⇄ Inactive)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={!isTml || !policy.dealerCanChangeStatus}
            checked={policy.dealerStatusChangeNeedsApproval}
            onChange={(e) => bayStore.setPolicy({ ...policy, dealerStatusChangeNeedsApproval: e.target.checked }, actor)}
          />
          Dealer Admin status changes need TML Admin approval
        </label>
        <p className="text-[11px] text-slate-500">TML Admin (L1/L2 Support) can always change bay status directly.</p>
      </div>

      {/* ---------- Dialogs ---------- */}
      <Modal isOpen={!!newBay} onClose={() => setNewBay(null)} title="Add Bay" subtitle={`${dealer?.code} – ${dealer?.name}`} maxWidth="2xl">
        {newBay && (
          <form
            aria-label="Add bay"
            className="space-y-3 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              const res = bayStore.addBay(newBay, actor);
              if (!res.ok) return;
              setNewBay(null);
              if (!res.request) showToast(`${res.value.bayName} added and active`, 'success');
            }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="col-span-2 sm:col-span-3">
                <label htmlFor="nb-name" className="font-semibold text-slate-600 block mb-1">Bay Name *</label>
                <input id="nb-name" className={sel} value={newBay.bayName} onChange={(e) => setNewBay({ ...newBay, bayName: e.target.value })} placeholder="e.g. Mechanical Bay 03" />
              </div>
              <div>
                <label htmlFor="nb-division" className="font-semibold text-slate-600 block mb-1">Division</label>
                <select id="nb-division" className={sel} value={newBay.division} onChange={(e) => setNewBay({ ...newBay, division: e.target.value })}>
                  {divisions.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="nb-bu" className="font-semibold text-slate-600 block mb-1">BU</label>
                <select id="nb-bu" className={sel} value={newBay.bu} onChange={(e) => setNewBay({ ...newBay, bu: e.target.value as Bay['bu'] })}>
                  {BUS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="nb-type" className="font-semibold text-slate-600 block mb-1">Bay Type</label>
                <select id="nb-type" className={sel} value={newBay.bayType} onChange={(e) => setNewBay({ ...newBay, bayType: e.target.value as Bay['bayType'] })}>
                  {BAY_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="nb-floor" className="font-semibold text-slate-600 block mb-1">Floor</label>
                <select id="nb-floor" className={sel} value={newBay.floor} onChange={(e) => setNewBay({ ...newBay, floor: e.target.value as Bay['floor'] })}>
                  {FLOORS.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="nb-lift" className="font-semibold text-slate-600 block mb-1">Lift</label>
                <select id="nb-lift" className={sel} value={newBay.liftAvailability} onChange={(e) => setNewBay({ ...newBay, liftAvailability: e.target.value as Bay['liftAvailability'] })}>
                  {LIFTS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="nb-sup" className="font-semibold text-slate-600 block mb-1">Tech Supervisor</label>
                <input id="nb-sup" className={sel} value={newBay.techSupervisor} onChange={(e) => setNewBay({ ...newBay, techSupervisor: e.target.value })} />
              </div>
            </div>

            {newBayUsage && (
              <div
                data-testid="allocation-check"
                className={`p-3 rounded-xl border ${newBayBeyond ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}
              >
                <div className="font-bold">
                  TML allocation for {newBay.division} / {newBay.bu} / {newBay.bayType}: {newBayUsage.used} of {newBayUsage.allocated} used
                </div>
                {!newBayBeyond ? (
                  <div>Within allocation — the bay will be active immediately.</div>
                ) : isTml ? (
                  <div>Beyond allocation — as TML Admin you can add it directly. Consider updating the allocation.</div>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    <div>Beyond allocation — this will be sent to the <strong>TML Network Manager</strong> for approval (in-app + email).</div>
                    <label htmlFor="nb-just" className="font-semibold block">Justification *</label>
                    <textarea
                      id="nb-just"
                      rows={2}
                      className={sel}
                      value={newBay.justification}
                      onChange={(e) => setNewBay({ ...newBay, justification: e.target.value })}
                      placeholder="Why is an additional bay needed?"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setNewBay(null)} className="px-4 py-1.5 rounded-lg border border-slate-200 font-semibold cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold hover:bg-blue-800 cursor-pointer">
                {newBayBeyond && !isTml ? 'Send for Approval' : 'Add Bay'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={!!statusDialog}
        onClose={() => setStatusDialog(null)}
        title={statusDialog ? `${statusDialog.to === 'Inactive' ? 'Inactivate' : 'Activate'} ${statusDialog.bay.bayName}` : ''}
        subtitle={statusNeedsApproval ? 'Will be sent to TML Admin (L1/L2 Support) for approval' : 'Applies immediately'}
        maxWidth="md"
      >
        {statusDialog && (
          <form
            aria-label="Change bay status"
            className="space-y-3 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              const reason = statusDialog.reason === 'Other' ? statusDialog.other : statusDialog.reason;
              const res = bayStore.changeBayStatus(statusDialog.bay.id, statusDialog.to, reason, actor);
              if (!res.ok) return;
              setStatusDialog(null);
              if (res.value === 'APPLIED') showToast(`${statusDialog.bay.bayName} is now ${statusDialog.to}`, 'success');
            }}
          >
            <div>
              <label htmlFor="sc-reason" className="font-semibold text-slate-600 block mb-1">Reason *</label>
              <select id="sc-reason" className={sel} value={statusDialog.reason} onChange={(e) => setStatusDialog({ ...statusDialog, reason: e.target.value })}>
                <option value="">— Select —</option>
                {STATUS_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            {statusDialog.reason === 'Other' && (
              <input aria-label="Other reason" className={sel} value={statusDialog.other} onChange={(e) => setStatusDialog({ ...statusDialog, other: e.target.value })} placeholder="Describe the reason" />
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setStatusDialog(null)} className="px-4 py-1.5 rounded-lg border border-slate-200 font-semibold cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold hover:bg-blue-800 cursor-pointer">
                {statusNeedsApproval ? 'Send for Approval' : `Make ${statusDialog.to}`}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!resubmit} onClose={() => setResubmit(null)} title={resubmit ? `Resubmit ${resubmit.bay.bayName}` : ''} subtitle="Sent to the TML Network Manager" maxWidth="md">
        {resubmit && (
          <form
            aria-label="Resubmit bay"
            className="space-y-3 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              if (bayStore.resubmitBay(resubmit.bay.id, resubmit.text, actor).ok) setResubmit(null);
            }}
          >
            <label htmlFor="rs-text" className="font-semibold text-slate-600 block">New justification *</label>
            <textarea id="rs-text" rows={3} className={sel} value={resubmit.text} onChange={(e) => setResubmit({ ...resubmit, text: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setResubmit(null)} className="px-4 py-1.5 rounded-lg border border-slate-200 font-semibold cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold cursor-pointer">Resubmit</button>
            </div>
          </form>
        )}
      </Modal>

      <EmailSentModal />
    </div>
  );
};

/** Edits physical attributes; governed fields (type, division, BU, status) are read-only here. */
const BayInspector: React.FC<{ bay: Bay }> = ({ bay }) => {
  const [draft, setDraft] = useState(bay);
  const { logAudit, showToast } = useApp();
  const bayStore = useBays();
  const dirty = JSON.stringify(draft) !== JSON.stringify(bay);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3 text-xs" data-testid="bay-inspector">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{bay.bayName} <span className="font-mono text-[11px] text-slate-400">{bay.id}</span></h3>
          <p className="text-[11px] text-slate-500">
            {bay.division} · {bay.bu} · {bay.bayType} · {bay.bayStatus}
            {bay.statusReason ? ` (${bay.statusReason})` : ''} — type, division, BU and status are governed and can't be edited here.
          </p>
        </div>
        <button
          disabled={!dirty || !draft.bayName.trim()}
          onClick={() => {
            bayStore.updateBayDetails(draft);
            logAudit('Bay Details Updated', 'Bay Management', `${bay.id} (${bay.dealerCode})`, `${bay.bayName}/${bay.floor}/${bay.liftAvailability}`, `${draft.bayName}/${draft.floor}/${draft.liftAvailability}`);
            showToast(`Saved ${draft.bayName}`, 'success');
          }}
          className="px-4 py-1.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg disabled:opacity-40 cursor-pointer"
        >
          Save Bay Details
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="col-span-2">
          <label htmlFor="bi-name" className="font-semibold text-slate-600 block mb-1">Bay Name</label>
          <input id="bi-name" className={sel} value={draft.bayName} onChange={(e) => setDraft({ ...draft, bayName: e.target.value })} />
        </div>
        <div>
          <label htmlFor="bi-floor" className="font-semibold text-slate-600 block mb-1">Floor</label>
          <select id="bi-floor" className={sel} value={draft.floor} onChange={(e) => setDraft({ ...draft, floor: e.target.value as Bay['floor'] })}>
            {FLOORS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="bi-lift" className="font-semibold text-slate-600 block mb-1">Lift</label>
          <select id="bi-lift" className={sel} value={draft.liftAvailability} onChange={(e) => setDraft({ ...draft, liftAvailability: e.target.value as Bay['liftAvailability'] })}>
            {LIFTS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="bi-sup" className="font-semibold text-slate-600 block mb-1">Tech Supervisor</label>
          <input id="bi-sup" className={sel} value={draft.techSupervisor} onChange={(e) => setDraft({ ...draft, techSupervisor: e.target.value })} />
        </div>
        <div>
          <label htmlFor="bi-t1" className="font-semibold text-slate-600 block mb-1">Technician 1</label>
          <input id="bi-t1" className={sel} value={draft.tech1} onChange={(e) => setDraft({ ...draft, tech1: e.target.value })} />
        </div>
      </div>
    </div>
  );
};

/** Shows the (simulated) approval email that was just sent, with its deep link. */
export const EmailSentModal: React.FC = () => {
  const { lastEmail, dismissLastEmail } = useBays();
  const { navigate, showToast } = useApp();
  return (
    <Modal isOpen={!!lastEmail} onClose={dismissLastEmail} title="Approval request sent" subtitle="Email notification (simulated until the backend is connected)" maxWidth="2xl">
      {lastEmail && (
        <div className="space-y-3 text-xs" data-testid="email-preview">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 space-y-0.5">
              <div><span className="text-slate-400 w-14 inline-block">To:</span> <strong>{lastEmail.to}</strong></div>
              <div><span className="text-slate-400 w-14 inline-block">Subject:</span> {lastEmail.subject}</div>
            </div>
            <pre className="px-4 py-3 whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">{lastEmail.body}</pre>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(lastEmail.link);
                  showToast('Approval link copied', 'success');
                } catch {
                  window.prompt('Copy the approval link:', lastEmail.link);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 font-semibold cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" /> Copy link
            </button>
            <button
              onClick={() => {
                const hash = lastEmail.link.split('#')[1] || '/admin/bay-approvals';
                dismissLastEmail();
                navigate(hash);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-900 font-bold cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open link (as approver)
            </button>
            <button onClick={dismissLastEmail} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 text-white font-bold cursor-pointer">
              <Mail className="h-3.5 w-3.5" /> Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
