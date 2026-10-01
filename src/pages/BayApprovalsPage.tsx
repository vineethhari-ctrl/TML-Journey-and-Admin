import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, ShieldCheck, Mail, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useBays } from '../context/BayContext';
import { Actor, BayRequest } from '../utils/bayGovernance';

/** Inbox for the TML Network Manager (additional bays) and TML Admin L1/L2 (status changes). */
export const BayApprovalsPage: React.FC = () => {
  const { currentRoute, currentUser, navigate } = useApp();
  const { requests, emails, decideRequest } = useBays();
  const focusId = new URLSearchParams(currentRoute.split('?')[1] || '').get('request');

  const [view, setView] = useState<'PENDING' | 'ALL'>('PENDING');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const approver: Actor = { name: currentUser.name, role: 'TML_ADMIN', email: currentUser.email };

  const focused = focusId ? requests.find((r) => r.id === focusId) : undefined;
  // A deep link to an already-decided request should still show it
  useEffect(() => {
    if (focused && focused.status !== 'PENDING') setView('ALL');
  }, [focused?.id, focused?.status]);
  useEffect(() => {
    if (focusId) document.querySelector(`[data-request-id="${focusId}"]`)?.scrollIntoView({ block: 'center' });
  }, [focusId, view]);

  const list = useMemo(
    () => requests.filter((r) => view === 'ALL' || r.status === 'PENDING'),
    [requests, view]
  );
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  const decide = (r: BayRequest, decision: 'APPROVED' | 'REJECTED') => {
    const res = decideRequest(r.id, decision, notes[r.id] ?? '', approver);
    if (res.ok) setNotes((n) => ({ ...n, [r.id]: '' }));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-blue-800">TML Network Manager · TML Admin (L1/L2)</div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-800" /> Bay Approvals
          </h1>
          <p className="text-xs text-slate-500 mt-1">Additional bays beyond the TML allocation, and dealer requests to activate / inactivate bays.</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          {(['PENDING', 'ALL'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg cursor-pointer ${view === v ? 'bg-white shadow-2xs text-blue-900' : 'text-slate-500'}`}
            >
              {v === 'PENDING' ? `Pending (${pendingCount})` : `All (${requests.length})`}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" /> Nothing waiting for approval.
        </div>
      )}

      <div className="space-y-3">
        {list.map((r) => {
          const isFocus = r.id === focusId;
          return (
            <div
              key={r.id}
              data-request-id={r.id}
              className={`rounded-2xl border bg-white p-4 shadow-xs space-y-3 text-xs ${isFocus ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.kind === 'ADD_BAY' ? 'bg-blue-100 text-blue-900' : 'bg-purple-100 text-purple-900'}`}>
                      {r.kind === 'ADD_BAY' ? 'ADDITIONAL BAY' : `STATUS: ${r.fromStatus} → ${r.toStatus}`}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">{r.id}</span>
                  </div>
                  <h2 className="text-sm font-extrabold text-slate-900 mt-1">
                    {r.bayName} <span className="font-normal text-slate-500">· {r.dealerCode} {r.dealerName}</span>
                  </h2>
                  <p className="text-slate-600">
                    {r.division} · {r.bu} · {r.bayType} — requested by <strong>{r.requestedBy.name}</strong> on {r.requestedAt}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Approver</div>
                  <div className="font-bold text-slate-800">{r.approverRole}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">{r.kind === 'ADD_BAY' ? 'Justification' : 'Reason'}</div>
                  <div className="text-slate-800">{r.reason}</div>
                </div>
                {r.allocation && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                    <div className="text-[10px] uppercase tracking-wider text-amber-600 mb-0.5">TML allocation</div>
                    {r.allocation.allocated} allocated · {r.allocation.used} already approved → this would be bay #{r.allocation.used + 1}
                  </div>
                )}
              </div>

              {r.status === 'PENDING' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label={`Decision note for ${r.id}`}
                    className="flex-1 min-w-[220px] px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                    placeholder="Note (required to reject)"
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                  />
                  <button
                    onClick={() => decide(r, 'REJECTED')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 font-bold hover:bg-rose-50 cursor-pointer"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                  <button
                    onClick={() => decide(r, 'APPROVED')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </button>
                </div>
              ) : (
                <div className={`p-2.5 rounded-lg font-semibold ${r.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                  {r.status} by {r.decidedBy?.name} on {r.decidedAt}
                  {r.decisionNote ? ` — ${r.decisionNote}` : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2 text-xs">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
          <Mail className="h-4 w-4 text-slate-500" /> Email log (simulated)
        </h3>
        <p className="text-[11px] text-slate-500">Emails are simulated in this prototype; the backend will send them for real.</p>
        <div className="divide-y divide-slate-100">
          {emails.slice(0, 20).map((m) => (
            <div key={m.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-800">{m.subject}</div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {m.sentAt} · to {m.to}
                </div>
              </div>
              <button onClick={() => navigate(m.link.split('#')[1] || '/admin/bay-approvals')} className="text-blue-700 font-semibold underline cursor-pointer">
                Open link
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
