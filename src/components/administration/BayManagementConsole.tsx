import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Upload,
  FileSpreadsheet,
  ShieldCheck,
  Power,
  Mail,
  ExternalLink,
  Copy,
  Clock,
  Layers,
  Settings2,
  Bell,
  Send,
  Search,
  X,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBays } from '../../context/BayContext';
import { Modal } from '../common/Modal';
import { DEALER_DIVISIONS } from '../../data/bayData';
import { masterExportUtil } from '../../utils/masterExportUtil';
import {
  Actor,
  APPROVAL_STATUSES,
  Bay,
  BayStatus,
  BAY_TYPES,
  BUS,
  FLOORS,
  LIFTS,
  STATUS_REASONS,
  NewBayInput,
  allocationUsage,
  submitBay,
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
const filterSel = `${sel} disabled:bg-slate-100 disabled:text-slate-500`;
const card = 'rounded-xl border border-slate-200 bg-white shadow-xs';

/** Only bays that haven't been (or are no longer) with an approver can be sent for approval. */
export const isSelectable = (b: Bay) => (b.approvalStatus === 'Draft' || b.approvalStatus === 'Rejected') && !b.pendingRequestId;

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
      ? 'bg-emerald-100 text-emerald-800'
      : bay.approvalStatus === 'Pending Approval'
      ? 'bg-amber-100 text-amber-800'
      : bay.approvalStatus === 'Draft'
      ? 'bg-sky-100 text-sky-800'
      : 'bg-rose-100 text-rose-800';
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{bay.approvalStatus}</span>;
};

interface Filters {
  division: string;
  bu: string;
  bayType: string;
  status: string;
  approval: string;
  name: string;
}
const NO_FILTERS: Filters = { division: 'All', bu: 'All', bayType: 'All', status: 'All', approval: 'All', name: '' };

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

  // ---- Scope: a Dealer Admin is locked to their own dealership
  const [dealerCode, setDealerCode] = useState(dealers[0]?.code ?? 'DLR1001');
  useEffect(() => {
    if (!isTml) setDealerCode(dealers[0]?.code ?? 'DLR1001');
  }, [isTml, dealers]);
  const dealer = dealers.find((d) => d.code === dealerCode) ?? dealers[0];
  const divisions = DEALER_DIVISIONS[dealerCode] ?? ['Main Workshop'];

  // ---- Filters: edited in a draft and applied with Search
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);

  const requestById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);
  const dealerBays = bays.filter((b) => b.dealerCode === dealerCode);
  const filteredBays = dealerBays
    .filter(
      (b) =>
        (filters.division === 'All' || b.division === filters.division) &&
        (filters.bu === 'All' || b.bu === filters.bu) &&
        (filters.bayType === 'All' || b.bayType === filters.bayType) &&
        (filters.status === 'All' || b.bayStatus === filters.status) &&
        (filters.approval === 'All' || b.approvalStatus === filters.approval) &&
        (!filters.name.trim() || b.bayName.toLowerCase().includes(filters.name.trim().toLowerCase()))
    )
    .sort((a, b) => a.no - b.no);
  const dealerRequests = requests.filter((r) => r.dealerCode === dealerCode);
  const pendingForDealer = dealerRequests.filter((r) => r.status === 'PENDING').length;
  const pendingAll = requests.filter((r) => r.status === 'PENDING').length;
  const bellCount = isTml ? pendingAll : pendingForDealer;

  // ---- Bay details panel
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = bays.find((b) => b.id === selectedId && b.dealerCode === dealerCode) ?? null;

  // ---- Selection (Draft / Rejected only)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectable = filteredBays.filter(isSelectable);
  const selectedBays = bays.filter((b) => selectedIds.includes(b.id) && isSelectable(b));
  const allSelected = selectable.length > 0 && selectable.every((b) => selectedIds.includes(b.id));
  const toggleSelect = (id: string) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  // ---- Allocation editor (TML)
  const dealerAllocations = allocations.filter((a) => a.dealerCode === dealerCode);
  const [allocDraft, setAllocDraft] = useState<Record<string, string>>({});
  const [newAlloc, setNewAlloc] = useState({ division: divisions[0], bu: 'PV' as Bay['bu'], bayType: 'Mechanical' as Bay['bayType'], allocated: '1' });
  useEffect(() => {
    setNewAlloc((n) => ({ ...n, division: (DEALER_DIVISIONS[dealerCode] ?? ['Main Workshop'])[0] }));
    setDraft(NO_FILTERS);
    setFilters(NO_FILTERS);
    setSelectedIds([]);
    setSelectedId(null);
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
  const saveNewBay = (asDraft: boolean) => {
    if (!newBay) return;
    const res = bayStore.addBay({ ...newBay, asDraft }, actor);
    if (!res.ok) return;
    setNewBay(null);
    setSelectedId(res.value.id);
    if (asDraft) showToast(`${res.value.bayName} saved as Draft — select it and use Send for Approval`, 'success');
    else if (!res.request) showToast(`${res.value.bayName} added and active`, 'success');
  };
  const newBayUsage = newBay ? allocationUsage(bayStore, newBay) : null;
  const newBayBeyond = !!newBayUsage && newBayUsage.used >= newBayUsage.allocated;

  // ---- Status change dialog
  const [statusDialog, setStatusDialog] = useState<{ bay: Bay; to: BayStatus; reason: string; other: string } | null>(null);
  const statusNeedsApproval = !isTml && policy.dealerStatusChangeNeedsApproval;
  const canChangeStatus = isTml || policy.dealerCanChangeStatus;

  // ---- Send for Approval dialog: preview each bay's outcome in order (earlier ones use up the allocation)
  const [sendDialog, setSendDialog] = useState<{ ids: string[]; justification: string } | null>(null);
  const sendPreview = useMemo(() => {
    if (!sendDialog) return [];
    let s = { bays, allocations, requests, emails: bayStore.emails, policy };
    return sendDialog.ids.flatMap((id) => {
      const bay = s.bays.find((b) => b.id === id);
      if (!bay) return [];
      const res = submitBay(s, id, 'preview', actor, '', '');
      if (res.ok) s = res.state;
      return [{ bay, outcome: res.ok ? res.value : undefined, error: res.error }];
    });
  }, [sendDialog?.ids.join(), bays, allocations, requests, policy, isTml]);
  const sendNeedsJustification = sendPreview.some((p) => p.outcome === 'PENDING_APPROVAL');


  const exportBays = () => {
    masterExportUtil.exportToExcel({
      masterName: 'Bay Management Master',
      category: 'Dealer Network',
      currentUser: { userId: currentUser.userId, name: currentUser.name },
      columns: [
        { key: 'no', label: 'No.' },
        { key: 'region', label: 'Region' },
        { key: 'dealerCode', label: 'Dealer Code' },
        { key: 'dealerName', label: 'Dealer Name' },
        { key: 'division', label: 'Division' },
        { key: 'bu', label: 'BU' },
        { key: 'bayName', label: 'Bay Name' },
        { key: 'bayType', label: 'Bay Type' },
        { key: 'bayStatus', label: 'Bay Status' },
        { key: 'approvalStatus', label: 'Approval Status' },
        { key: 'floor', label: 'Floor' },
        { key: 'liftAvailability', label: 'Lift' },
        { key: 'techSupervisor', label: 'Tech Supervisor' },
      ],
      data: filteredBays,
    });
    showToast(`Exported ${filteredBays.length} bays to Excel`, 'success');
  };

  const filterFields: [string, keyof Filters, string[]][] = [
    ['Bay Type', 'bayType', ['All', ...BAY_TYPES]],
    ['Bay Status', 'status', ['All', 'Active', 'Inactive']],
  ];

  return (
    <div className="space-y-4">
      {/* sWorkshop header */}
      <div className="rounded-xl bg-[#0b2a5b] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="leading-none">
            <div className="text-[11px] font-black tracking-[0.2em]">TATA MOTORS</div>
            <div className="text-[10px] text-blue-200 font-semibold">sWorkshop</div>
          </div>
          <span className="h-7 w-px bg-blue-300/40" />
          <h2 className="text-base font-bold tracking-tight">Bay Management</h2>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 font-bold" title="Switch with the Dealer Admin / TML Admin toggle above">
            {adminRole}
          </span>
          <button
            type="button"
            title={isTml ? 'Pending bay approvals' : 'My pending requests'}
            aria-label={`${bellCount} pending bay request(s)`}
            onClick={() =>
              isTml ? navigate('/admin/bay-approvals') : document.querySelector('[data-testid="bay-requests"]')?.scrollIntoView({ behavior: 'smooth' })
            }
            className="relative p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            {bellCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-[9px] font-black flex items-center justify-center">
                {bellCount}
              </span>
            )}
          </button>
          <span className="font-semibold">
            {dealer?.code} - {dealer?.name}
          </span>
        </div>
      </div>

      {/* Governance note */}
      <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-[11px] text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-bold text-blue-950 flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-700" /> Bay governance — acting as {adminRole}
        </span>
        <span>Within the TML allocation → approved automatically; beyond it → TML Network Manager.</span>
        <span>
          Active ⇄ Inactive:{' '}
          {!policy.dealerCanChangeStatus
            ? 'TML Admin only.'
            : policy.dealerStatusChangeNeedsApproval
            ? 'Dealer Admin requests need TML Admin approval.'
            : 'Dealer Admin and TML Admin can change directly.'}
        </span>
      </div>

      {/* Filters */}
      <form
        aria-label="Bay filters"
        className={`${card} p-4`}
        onSubmit={(e) => {
          e.preventDefault();
          setFilters(draft);
        }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs items-end">
          <div>
            <label htmlFor="bay-region" className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              Region <Lock className="h-3 w-3 text-slate-400" />
            </label>
            <select id="bay-region" className={filterSel} disabled value={dealer?.zone}>
              <option>{dealer?.zone}</option>
            </select>
          </div>
          <div className="col-span-2">
            <label htmlFor="bay-dealer" className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
              Dealer {!isTml && <Lock className="h-3 w-3 text-slate-400" />}
            </label>
            <select id="bay-dealer" className={filterSel} disabled={!isTml} value={dealerCode} onChange={(e) => setDealerCode(e.target.value)}>
              {dealers.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>
          {filterFields.map(([label, key, options]) => (
            <div key={key}>
              <label htmlFor={`bay-f-${key}`} className="text-[11px] font-semibold text-slate-600 block mb-1">{label}</label>
              <select id={`bay-f-${key}`} className={filterSel} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}>
                {options.map((o) => (
                  <option key={o} value={o}>{o === 'All' ? 'All' : o}</option>
                ))}
              </select>
            </div>
          ))}
          <div>
            <label htmlFor="bay-f-name" className="text-[11px] font-semibold text-slate-600 block mb-1">Bay Name</label>
            <input id="bay-f-name" className={sel} value={draft.name} placeholder="Contains…" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="bay-f-approval" className="text-[11px] font-semibold text-slate-600 block mb-1">Approval Status</label>
            <select id="bay-f-approval" className={filterSel} value={draft.approval} onChange={(e) => setDraft({ ...draft, approval: e.target.value })}>
              {['All', ...APPROVAL_STATUSES].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bay-f-division" className="text-[11px] font-semibold text-slate-600 block mb-1">Division</label>
            <select id="bay-f-division" className={filterSel} value={draft.division} onChange={(e) => setDraft({ ...draft, division: e.target.value })}>
              {['All', ...divisions].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bay-f-bu" className="text-[11px] font-semibold text-slate-600 block mb-1">BU</label>
            <select id="bay-f-bu" className={filterSel} value={draft.bu} onChange={(e) => setDraft({ ...draft, bu: e.target.value })}>
              {['All', ...BUS].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 lg:col-span-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(NO_FILTERS);
                setFilters(NO_FILTERS);
              }}
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
            <button type="submit" className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-[#0b2a5b] text-white font-bold hover:bg-blue-900 cursor-pointer">
              <Search className="h-3.5 w-3.5" /> Search
            </button>
          </div>
        </div>
      </form>

      {/* Bays */}
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-slate-200 gap-3">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">Bays</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setNewBay(emptyBay())}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0b2a5b] hover:bg-blue-900 text-xs font-bold text-white shadow-2xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> New Bay
            </button>
            <button
              onClick={onBulkUpload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-blue-600" /> Bulk Upload
            </button>
            <button
              disabled={selectedBays.length === 0}
              onClick={() => setSendDialog({ ids: selectedBays.map((b) => b.id), justification: '' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-2xs cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <Send className="h-3.5 w-3.5" /> Send for Approval{selectedBays.length ? ` (${selectedBays.length})` : ''}
            </button>
            <button
              onClick={exportBays}
              title="Export the listed bays to Excel"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Export
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="pl-4 pr-2 py-2.5 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all Draft and Rejected bays"
                    disabled={selectable.length === 0}
                    checked={allSelected}
                    onChange={() => setSelectedIds(allSelected ? [] : selectable.map((b) => b.id))}
                  />
                </th>
                <th className="px-2 py-2.5">No.</th>
                <th className="px-3 py-2.5">Region</th>
                <th className="px-3 py-2.5">Dealer Code</th>
                <th className="px-3 py-2.5">Dealer Name</th>
                <th className="px-3 py-2.5">Division / BU</th>
                <th className="px-3 py-2.5">Bay Name</th>
                <th className="px-3 py-2.5">Bay Type</th>
                <th className="px-3 py-2.5">Bay Status</th>
                <th className="px-3 py-2.5">Approval Status</th>
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
                const canSelect = isSelectable(b);
                return (
                  <tr
                    key={b.id}
                    data-bay-id={b.id}
                    onClick={() => setSelectedId(b.id)}
                    className={`cursor-pointer transition-colors ${selectedId === b.id ? 'bg-blue-50' : 'hover:bg-slate-50/70'}`}
                  >
                    <td className="pl-4 pr-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${b.bayName}`}
                        disabled={!canSelect}
                        title={canSelect ? undefined : 'Only Draft and Rejected bays can be selected'}
                        checked={canSelect && selectedIds.includes(b.id)}
                        onChange={() => toggleSelect(b.id)}
                      />
                    </td>
                    <td className="px-2 py-2.5 font-mono text-slate-600">{b.no}</td>
                    <td className="px-3 py-2.5 text-slate-700">{b.region}</td>
                    <td className="px-3 py-2.5 font-mono text-slate-700">{b.dealerCode}</td>
                    <td className="px-3 py-2.5 text-slate-700">{b.dealerName}</td>
                    <td className="px-3 py-2.5 text-slate-600">{b.division} · {b.bu}</td>
                    <td className="px-3 py-2.5 font-bold text-blue-900">{b.bayName}</td>
                    <td className="px-3 py-2.5 text-slate-700">{b.bayType}</td>
                    <td className="px-3 py-2.5"><StatusBadge bay={b} /></td>
                    <td className="px-3 py-2.5"><ApprovalBadge bay={b} pendingKind={pendingKind} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 bg-slate-50/60 text-[11px] text-slate-500">
          <span>Only Draft and Rejected bays can be selected.</span>
          <span data-testid="bay-record-count">{filteredBays.length} records</span>
        </div>
      </div>

      {/* Bay details */}
      <div className={`${card} p-4 space-y-3 text-xs`} data-testid="bay-details">
        <h3 className="text-sm font-bold text-slate-900">Bay Details</h3>
        {!selected ? (
          <p className="text-slate-400">Select a bay from the list, or use New Bay to add one.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900">{selected.bayName}</span>
                <span className="font-mono text-[11px] text-slate-400">{selected.id}</span>
                <StatusBadge bay={selected} />
                <ApprovalBadge bay={selected} pendingKind={selected.pendingRequestId ? requestById.get(selected.pendingRequestId)?.kind : undefined} />
              </div>
              <div className="flex items-center gap-2">
                {selected.approvalStatus === 'Approved' && !selected.pendingRequestId && canChangeStatus && (
                  <button
                    onClick={() => setStatusDialog({ bay: selected, to: selected.bayStatus === 'Active' ? 'Inactive' : 'Active', reason: '', other: '' })}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold border cursor-pointer ${
                      selected.bayStatus === 'Active' ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" /> {selected.bayStatus === 'Active' ? 'Inactivate' : 'Activate'}
                  </button>
                )}
                {isSelectable(selected) && (
                  <button
                    onClick={() => setSendDialog({ ids: [selected.id], justification: '' })}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold border border-emerald-200 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" /> {selected.approvalStatus === 'Rejected' ? 'Resubmit' : 'Send for Approval'}
                  </button>
                )}
                {selected.pendingRequestId && <span className="text-[11px] text-amber-700 font-semibold">Awaiting TML decision</span>}
              </div>
            </div>
            <BayInspector key={selected.id} bay={selected} />
          </>
        )}
      </div>

      {/* TML allocation */}
      <div className={`${card} overflow-hidden`} data-testid="bay-allocations">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-blue-700" /> TML Bay Allocation — {dealer?.name}
          </h3>
          <p className="text-[11px] text-slate-500">
            Set by TML Admin per division and BU. {isTml ? 'Edit counts below.' : 'Read-only for Dealer Admin.'}
          </p>
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

      {/* Requests for this dealer */}
      <div className={`${card} p-4 space-y-2`} data-testid="bay-requests">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Approval requests — {dealerCode}</h3>
          {isTml && (
            <button
              onClick={() => navigate('/admin/bay-approvals')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 text-white text-xs font-bold hover:bg-blue-800 cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Open Bay Approvals {pendingAll > 0 ? `(${pendingAll})` : ''}
            </button>
          )}
        </div>
        {dealerRequests.length === 0 ? (
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
              {dealerRequests.map((r) => (
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
      <div className={`${card} p-4 space-y-2 text-xs`} data-testid="bay-policy">
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
      <Modal isOpen={!!newBay} onClose={() => setNewBay(null)} title="New Bay" subtitle={`${dealer?.code} – ${dealer?.name} · ${dealer?.zone}`} maxWidth="2xl">
        {newBay && (
          <form
            aria-label="Add bay"
            className="space-y-3 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              saveNewBay(false);
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
              <button type="button" onClick={() => saveNewBay(true)} className="px-4 py-1.5 rounded-lg border border-sky-200 text-sky-800 font-bold hover:bg-sky-50 cursor-pointer">
                Save as Draft
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold hover:bg-blue-800 cursor-pointer">
                {newBayBeyond && !isTml ? 'Send for Approval' : 'Add Bay'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={!!sendDialog}
        onClose={() => setSendDialog(null)}
        title={`Send ${sendPreview.length} bay(s) for approval`}
        subtitle="Within the TML allocation bays are approved automatically; the rest go to the TML Network Manager"
        maxWidth="2xl"
      >
        {sendDialog && (
          <form
            aria-label="Send for approval"
            className="space-y-3 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              const res = bayStore.submitBays(sendDialog.ids, sendDialog.justification, actor);
              if (res.approved + res.pending === 0) return;
              setSendDialog(null);
              setSelectedIds([]);
              showToast(
                `${res.approved} approved within allocation, ${res.pending} sent to TML Network Manager${res.errors.length ? `, ${res.errors.length} not sent` : ''}`,
                res.errors.length ? 'error' : 'success'
              );
            }}
          >
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200" data-testid="send-preview">
              {sendPreview.map(({ bay, outcome, error }) => (
                <li key={bay.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>
                    <strong>{bay.bayName}</strong> <span className="text-slate-500">· {bay.division} / {bay.bu} / {bay.bayType}</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      outcome === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : outcome ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {outcome === 'APPROVED' ? 'Auto-approved (within allocation)' : outcome ? 'To TML Network Manager' : error}
                  </span>
                </li>
              ))}
            </ul>
            {sendNeedsJustification && (
              <div>
                <label htmlFor="sd-just" className="font-semibold text-slate-600 block mb-1">Justification for the TML Network Manager *</label>
                <textarea
                  id="sd-just"
                  rows={2}
                  className={sel}
                  value={sendDialog.justification}
                  onChange={(e) => setSendDialog({ ...sendDialog, justification: e.target.value })}
                  placeholder="Why are additional bays needed?"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSendDialog(null)} className="px-4 py-1.5 rounded-lg border border-slate-200 font-semibold cursor-pointer">Cancel</button>
              <button type="submit" className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 cursor-pointer">
                <Send className="h-3.5 w-3.5" /> Send
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
  const readOnly = (label: string, value: string) => (
    <div>
      <div className="font-semibold text-slate-600 mb-1">{label}</div>
      <div className="px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50 text-slate-700">{value}</div>
    </div>
  );
  return (
    <div className="space-y-3" data-testid="bay-inspector">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {readOnly('Region', bay.region)}
        {readOnly('Dealer', `${bay.dealerCode} - ${bay.dealerName}`)}
        {readOnly('Division', bay.division)}
        {readOnly('BU', bay.bu)}
        {readOnly('Bay Type', bay.bayType)}
        {readOnly('Status reason', bay.statusReason || '—')}
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
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">Type, division, BU and status are governed and can't be edited here.</p>
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
