import React from 'react';
import { Modal } from '../common/Modal';
import { Session } from '../../types';
import { AlertOctagon, Laptop, User, ShieldAlert } from 'lucide-react';

interface TerminateSessionModalProps {
  session: Session | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const TerminateSessionModal: React.FC<TerminateSessionModalProps> = ({
  session,
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!session) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Terminate Session?"
      subtitle="Security session revocation"
      maxWidth="md"
    >
      <div className="space-y-4 text-xs">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200">
          <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h5 className="font-bold text-rose-950 text-sm">Immediate Session Invalidation</h5>
            <p className="text-rose-800 leading-relaxed">
              This will immediately log the user out from the selected device and revoke access tokens.
            </p>
          </div>
        </div>

        {/* Session details */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-slate-400" /> User
            </span>
            <span className="font-bold text-slate-800">{session.userName}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Session ID</span>
            <span className="font-mono text-slate-700">{session.sessionId}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Laptop className="h-3.5 w-3.5 text-slate-400" /> Device & IP
            </span>
            <span className="text-slate-700 font-mono">
              {session.deviceType} • {session.ipAddress}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Login Time</span>
            <span className="text-slate-700">{session.loginTime}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors shadow-2xs"
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            Terminate
          </button>
        </div>
      </div>
    </Modal>
  );
};
