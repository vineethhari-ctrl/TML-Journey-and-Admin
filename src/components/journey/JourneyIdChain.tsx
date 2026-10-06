import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Info, MessageSquare, Package } from 'lucide-react';
import { ID_KIND_LABEL, IdLink, JcIdChain, validateIdChain } from '../../utils/jcIdChain';

const linkTone: Record<IdLink['status'], string> = {
  CREATED: 'border-emerald-300 bg-emerald-50',
  AWAITED: 'border-dashed border-slate-300 bg-slate-50',
  NOT_APPLICABLE: 'border-dashed border-slate-200 bg-white',
};

const LinkCard: React.FC<{ link: IdLink }> = ({ link }) => (
  <div className={`min-w-[150px] flex-1 rounded-xl border p-3 ${linkTone[link.status]}`} data-testid={`id-link-${link.kind}`} data-status={link.status}>
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{ID_KIND_LABEL[link.kind]}</div>
    <div className={`mt-0.5 font-mono text-xs font-bold ${link.status === 'CREATED' ? 'text-slate-900' : 'text-slate-400'}`}>
      {link.status === 'NOT_APPLICABLE' ? 'Not applicable' : link.id ?? 'Awaited'}
    </div>
    <div className="mt-1 text-[10px] text-slate-500">{link.source}</div>
    {link.createdAt && link.status === 'CREATED' && (
      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500"><Clock className="h-3 w-3" /> {link.createdAt}</div>
    )}
    {link.note && <div className="mt-0.5 text-[10px] italic text-slate-400">{link.note}</div>}
  </div>
);

/** Compact one-line chain for the journey header. */
export const IdChainStrip: React.FC<{ chain: JcIdChain; onOpen?: () => void }> = ({ chain, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    data-testid="id-chain-strip"
    className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600 hover:border-blue-300 hover:bg-blue-50 cursor-pointer"
    title="Open the ID chain"
  >
    {chain.links.map((l, i) => (
      <React.Fragment key={l.kind}>
        {i > 0 && <ArrowRight className="h-3 w-3 text-slate-400" />}
        <span className={l.status === 'CREATED' ? 'font-mono font-semibold text-slate-800' : 'text-slate-400'}>
          {l.status === 'CREATED' ? l.id : l.status === 'NOT_APPLICABLE' ? `${ID_KIND_LABEL[l.kind]}: walk-in` : `${ID_KIND_LABEL[l.kind]}: awaited`}
        </span>
      </React.Fragment>
    ))}
    {chain.mrs.length > 0 && <span className="ml-1 rounded-full bg-blue-100 px-1.5 font-bold text-blue-800">{chain.mrs.length} MR</span>}
  </button>
);

/** Full ID chain: Appointment → Visit → SR → Pre-JC → JC, MRs under the JC, and the customer updates sent. */
export const JourneyIdChain: React.FC<{ chain: JcIdChain }> = ({ chain }) => {
  const issues = validateIdChain(chain);
  return (
    <div className="space-y-4" data-testid="id-chain">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">IDs under this Job Card</h3>
            <p className="text-[11px] text-slate-500">
              Arrival: <strong>{chain.arrival}</strong> · SR from: <strong>{chain.srOrigin}</strong>
            </p>
          </div>
          {issues.length === 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800" data-testid="id-chain-check">
              <CheckCircle2 className="h-3.5 w-3.5" /> Chain consistent
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-800" data-testid="id-chain-check">
              <AlertTriangle className="h-3.5 w-3.5" /> {issues.length} issue(s)
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          {chain.links.map((l, i) => (
            <React.Fragment key={l.kind}>
              {i > 0 && <ArrowRight className="h-4 w-4 self-center text-slate-400" />}
              <LinkCard link={l} />
            </React.Fragment>
          ))}
        </div>
        {issues.length > 0 && (
          <ul className="list-disc pl-5 text-[11px] text-rose-700">{issues.map((i) => <li key={i}>{i}</li>)}</ul>
        )}

        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
          <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-blue-950"><Package className="h-3.5 w-3.5" /> MRs linked to {chain.jcNumber}</h4>
          {chain.mrs.length === 0 ? (
            <p className="text-[11px] text-slate-500">No MR raised yet.</p>
          ) : (
            <table className="w-full text-left text-[11px]" data-testid="id-chain-mrs">
              <thead className="text-slate-500"><tr><th className="pr-3">MR</th><th className="pr-3">Raised</th><th className="pr-3">Source</th><th>Note</th></tr></thead>
              <tbody>
                {chain.mrs.map((m) => (
                  <tr key={m.id}><td className="pr-3 font-mono font-semibold">{m.id}</td><td className="pr-3">{m.createdAt}</td><td className="pr-3">{m.source}</td><td>{m.note}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900"><MessageSquare className="h-4 w-4 text-blue-700" /> Customer updates sent</h3>
        {chain.updates.length === 0 ? (
          <p className="text-[11px] text-slate-500">No customer update sent yet.</p>
        ) : (
          <table className="w-full text-left text-[11px]" data-testid="id-chain-updates">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr><th className="py-1 pr-3">Sent</th><th className="pr-3">Channel</th><th className="pr-3">For</th><th className="pr-3">Message</th><th>Status</th></tr>
            </thead>
            <tbody>
              {chain.updates.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="py-1 pr-3 whitespace-nowrap">{u.at}</td>
                  <td className="pr-3">{u.channel}</td>
                  <td className="pr-3 font-mono">{u.linkedId}</td>
                  <td className="pr-3">{u.message}</td>
                  <td className={u.status === 'FAILED' ? 'font-bold text-rose-700' : 'text-emerald-700'}>{u.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-[11px] text-slate-700" data-testid="id-chain-assumptions">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
        <span>
          Working assumptions (BA has not given more detail): a walk-in has no Appointment ID; Visit, SR, Pre-JC and JC are each required in
          that order; an SR is created at gate-in straight into CRM, or automatically by Service Buddy; a JC can have several MRs. In production
          each module sends its ID with the JC number in its journey event — here the IDs are demo values.
        </span>
      </p>
    </div>
  );
};
