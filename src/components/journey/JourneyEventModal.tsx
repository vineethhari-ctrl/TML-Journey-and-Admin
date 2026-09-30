import React from 'react';
import { Modal } from '../common/Modal';
import { JourneyEvent } from '../../types';
import { Clock, User, Building, Hash, Layers, CheckCircle2, AlertCircle } from 'lucide-react';

interface JourneyEventModalProps {
  event: JourneyEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

export const JourneyEventModal: React.FC<JourneyEventModalProps> = ({ event, isOpen, onClose }) => {
  if (!event) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Event Details"
      subtitle={`Cross-Module Lifecycle Event • ${event.referenceNumber}`}
      maxWidth="lg"
    >
      <div className="space-y-5 text-sm">
        {/* Banner with Event Type & Status */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50/70 border border-blue-200">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
              Module: {event.module}
            </span>
            <h4 className="text-base font-bold text-slate-900 mt-0.5">{event.eventType}</h4>
            <p className="text-xs text-slate-500">{event.stage}</p>
          </div>
          <div className="text-right">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                event.status.toLowerCase().includes('completed')
                  ? 'bg-emerald-100 text-emerald-800'
                  : event.status.toLowerCase().includes('progress')
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {event.status}
            </span>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Clock className="h-3.5 w-3.5" />
              <span>Timestamp</span>
            </div>
            <p className="font-semibold text-slate-800 font-mono">{event.timestamp}</p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Hash className="h-3.5 w-3.5" />
              <span>Reference Number</span>
            </div>
            <p className="font-semibold text-slate-800 font-mono">{event.referenceNumber}</p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <User className="h-3.5 w-3.5" />
              <span>Performed By</span>
            </div>
            <p className="font-semibold text-slate-800">{event.userName}</p>
            <p className="text-[11px] text-slate-400 font-mono">ID: {event.employeeId}</p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-1.5 text-slate-400 mb-1">
              <Building className="h-3.5 w-3.5" />
              <span>Dealer / Facility</span>
            </div>
            <p className="font-semibold text-slate-800 truncate">{event.dealer}</p>
          </div>
        </div>

        {/* Status Transition Card */}
        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Layers className="h-3.5 w-3.5 text-blue-600" />
            <span>Status Transition</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-slate-200 text-slate-700 font-medium">
              {event.previousStatus || 'Initial'}
            </span>
            <span className="text-slate-400">→</span>
            <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 font-bold">
              {event.newStatus}
            </span>
          </div>
        </div>

        {/* Remarks / Log Details */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
            Remarks / Diagnostic Log
          </span>
          <div className="p-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 leading-relaxed font-mono">
            {event.remarks}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </Modal>
  );
};
