import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useApp } from './AppContext';
import { createSeedBayState } from '../data/bayData';
import {
  Actor,
  AllocationKey,
  Bay,
  BayPolicy,
  BayState,
  BayStatus,
  NewBayInput,
  Result,
  addBay,
  changeBayStatus,
  decideRequest,
  resubmitBay,
  submitBay,
  setAllocation,
} from '../utils/bayGovernance';

const STORAGE_KEY = 'tml_bay_governance_v1';

/** URL the approval email links back to (the app's own address, without the hash). */
export const appBaseUrl = () => `${window.location.origin}${window.location.pathname}`;

const nowStamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

interface BayContextType extends BayState {
  addBay: (input: NewBayInput, actor: Actor) => Result<any>;
  importBays: (inputs: NewBayInput[], actor: Actor) => { added: number; pending: number; errors: string[] };
  resubmitBay: (bayId: string, justification: string, actor: Actor) => Result<any>;
  /** "Send for Approval" on selected Draft / Rejected bays. */
  submitBays: (bayIds: string[], justification: string, actor: Actor) => { approved: number; pending: number; errors: string[] };
  changeBayStatus: (bayId: string, toStatus: BayStatus, reason: string, actor: Actor) => Result<any>;
  decideRequest: (requestId: string, decision: 'APPROVED' | 'REJECTED', note: string, approver: Actor) => Result<any>;
  setAllocation: (key: AllocationKey, allocated: number, actor: Actor) => Result<any>;
  setPolicy: (policy: BayPolicy, actor: Actor) => void;
  /** Updates physical attributes only; governed fields (type, division, BU, status, approval) are ignored. */
  updateBayDetails: (bay: Bay) => void;
  /** The last approval email "sent", shown to the requester as confirmation. */
  lastEmail: BayState['emails'][number] | null;
  dismissLastEmail: () => void;
  resetBayData: () => void;
}

const BayContext = createContext<BayContextType | undefined>(undefined);

const loadState = (): BayState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.bays) && Array.isArray(parsed.requests)) return parsed;
    }
  } catch {
    // fall back to seed data
  }
  return createSeedBayState(appBaseUrl());
};

export const BayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logAudit, showToast, addNotification } = useApp();
  const [state, setState] = useState<BayState>(loadState);
  const [lastEmail, setLastEmail] = useState<BayContextType['lastEmail']>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable — keep in memory
    }
  }, [state]);

  /** Commits a successful result and runs the side effects (audit, notification, email) once. */
  const commit = useCallback(
    <T,>(res: Result<T>, audit?: [string, string, string, string]): Result<T> => {
      if (!res.ok) {
        showToast(res.error || 'Action not allowed', 'error');
        return res;
      }
      setState(res.state);
      if (audit) logAudit(audit[0], 'Bay Management', audit[1], audit[2], audit[3]);
      if (res.request && res.email) {
        const r = res.request;
        logAudit('Approval Requested', 'Bay Management', `${r.id} (${r.bayName}, ${r.dealerCode})`, r.kind, `Sent to ${r.approverRole}`);
        addNotification({
          type: 'APPROVAL',
          title: r.kind === 'ADD_BAY' ? 'Additional bay awaiting approval' : 'Bay status change awaiting approval',
          message: `${r.dealerName}: ${r.bayName} (${r.bayType}, ${r.division}/${r.bu}) — requested by ${r.requestedBy.name}`,
          targetPath: `/admin/bay-approvals?request=${r.id}`,
        });
        setLastEmail(res.email);
      }
      return res;
    },
    [logAudit, showToast, addNotification]
  );

  const value: BayContextType = {
    ...state,
    lastEmail,
    dismissLastEmail: () => setLastEmail(null),

    addBay: (input, actor) => {
      const res = commit(addBay(state, input, actor, appBaseUrl(), nowStamp()));
      if (res.ok && res.value) {
        logAudit(
          'Bay Added',
          'Bay Management',
          `${res.value.id} ${res.value.bayName} (${res.value.dealerCode})`,
          'None',
          `${res.value.division}/${res.value.bu}/${res.value.bayType} — ${res.value.approvalStatus}`
        );
      }
      return res;
    },

    importBays: (inputs, actor) => {
      let s = state;
      let added = 0;
      let pending = 0;
      const errors: string[] = [];
      const emails: typeof state.emails = [];
      inputs.forEach((input, i) => {
        // Imported rows beyond the allocation carry an automatic justification
        const res = addBay(s, { ...input, justification: input.justification || 'Bulk upload beyond TML allocation' }, actor, appBaseUrl(), nowStamp());
        if (!res.ok) {
          errors.push(`Row ${i + 1}: ${res.error}`);
          return;
        }
        s = res.state;
        if (res.request) {
          pending++;
          if (res.email) emails.push(res.email);
        } else added++;
      });
      setState(s);
      logAudit('Bays Imported', 'Bay Management', `${inputs.length} row(s)`, 'Bulk upload', `${added} live, ${pending} sent for approval, ${errors.length} rejected`);
      if (pending > 0) {
        addNotification({
          type: 'APPROVAL',
          title: `${pending} additional bay(s) awaiting approval`,
          message: 'Bulk upload exceeded the TML bay allocation.',
          targetPath: '/admin/bay-approvals',
        });
        setLastEmail(emails[0] ?? null);
      }
      return { added, pending, errors };
    },

    submitBays: (bayIds, justification, actor) => {
      let s = state;
      let approved = 0;
      let pending = 0;
      const errors: string[] = [];
      const emails: typeof state.emails = [];
      bayIds.forEach((id) => {
        const res = submitBay(s, id, justification, actor, appBaseUrl(), nowStamp());
        if (!res.ok) {
          errors.push(res.error || `${id}: not sent`);
          return;
        }
        s = res.state;
        if (res.value === 'APPROVED') approved++;
        else {
          pending++;
          if (res.email) emails.push(res.email);
          const r = res.request!;
          logAudit('Approval Requested', 'Bay Management', `${r.id} (${r.bayName}, ${r.dealerCode})`, r.kind, `Sent to ${r.approverRole}`);
        }
      });
      if (approved + pending === 0) {
        showToast(errors[0] || 'Nothing was sent', 'error');
        return { approved, pending, errors };
      }
      setState(s);
      logAudit('Bays Sent for Approval', 'Bay Management', `${bayIds.length} bay(s)`, 'Draft/Rejected', `${approved} approved within allocation, ${pending} sent to TML Network Manager`);
      if (pending > 0) {
        addNotification({
          type: 'APPROVAL',
          title: pending === 1 ? 'Additional bay awaiting approval' : `${pending} additional bays awaiting approval`,
          message: 'Bays sent beyond the TML bay allocation.',
          targetPath: emails.length === 1 ? `/admin/bay-approvals?request=${emails[0].requestId}` : '/admin/bay-approvals',
        });
        setLastEmail(emails[0] ?? null);
      }
      return { approved, pending, errors };
    },

    resubmitBay: (bayId, justification, actor) => commit(resubmitBay(state, bayId, justification, actor, appBaseUrl(), nowStamp())),

    changeBayStatus: (bayId, toStatus, reason, actor) => {
      const before = state.bays.find((b) => b.id === bayId);
      const res = commit(changeBayStatus(state, bayId, toStatus, reason, actor, appBaseUrl(), nowStamp()));
      if (res.ok && res.value === 'APPLIED' && before) {
        logAudit('Bay Status Changed', 'Bay Management', `${before.id} ${before.bayName} (${before.dealerCode})`, before.bayStatus, `${toStatus} — ${reason}`);
      }
      return res;
    },

    decideRequest: (requestId, decision, note, approver) => {
      const res = commit(decideRequest(state, requestId, decision, note, approver, nowStamp()));
      if (res.ok && res.value) {
        const r = res.value;
        logAudit(
          decision === 'APPROVED' ? 'Bay Request Approved' : 'Bay Request Rejected',
          'Bay Management',
          `${r.id} (${r.bayName}, ${r.dealerCode})`,
          'PENDING',
          `${decision}${note ? ` — ${note}` : ''}`
        );
        addNotification({
          type: 'APPROVAL',
          title: `Bay request ${decision === 'APPROVED' ? 'approved' : 'rejected'}`,
          message: `${r.bayName} (${r.dealerCode}) — ${r.kind === 'ADD_BAY' ? 'additional bay' : `status → ${r.toStatus}`}`,
          targetPath: '/admin/masters?open=bays',
        });
      }
      return res;
    },

    setAllocation: (key, allocated, actor) => {
      const before = state.allocations.find(
        (a) => a.dealerCode === key.dealerCode && a.division === key.division && a.bu === key.bu && a.bayType === key.bayType
      );
      return commit(setAllocation(state, key, allocated, actor, nowStamp()), [
        'Bay Allocation Set',
        `${key.dealerCode} ${key.division}/${key.bu}/${key.bayType}`,
        before ? String(before.allocated) : 'None',
        String(allocated),
      ]);
    },

    setPolicy: (policy, actor) => {
      if (actor.role !== 'TML_ADMIN') {
        showToast('Only TML Admin can change bay policies', 'error');
        return;
      }
      setState((s) => ({ ...s, policy }));
      logAudit(
        'Bay Policy Changed',
        'Bay Management',
        'Bay status policy',
        JSON.stringify(state.policy),
        JSON.stringify(policy)
      );
      showToast('Bay status policy updated', 'success');
    },

    updateBayDetails: (bay) =>
      setState((s) => ({
        ...s,
        bays: s.bays.map((b) =>
          b.id === bay.id
            ? {
                ...b,
                bayName: bay.bayName.trim() || b.bayName,
                floor: bay.floor,
                liftAvailability: bay.liftAvailability,
                techSupervisor: bay.techSupervisor,
                tech1: bay.tech1,
                tech2: bay.tech2,
              }
            : b
        ),
      })),

    resetBayData: () => {
      setState(createSeedBayState(appBaseUrl()));
      showToast('Bay data reset to sample data', 'info');
    },
  };

  return <BayContext.Provider value={value}>{children}</BayContext.Provider>;
};

export const useBays = () => {
  const ctx = useContext(BayContext);
  if (!ctx) throw new Error('useBays must be used within a BayProvider');
  return ctx;
};
