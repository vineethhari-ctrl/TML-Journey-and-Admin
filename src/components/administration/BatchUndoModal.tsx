import React, { useState } from 'react';
import { MasterConfig } from '../../data/masterCatalogue';
import {
  RotateCcw,
  History,
  X,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Plus,
  Edit,
  Trash2,
  Sliders,
  Layers,
  ArrowRight,
  ShieldAlert,
  Clock,
  Check,
  Undo2,
} from 'lucide-react';

export interface MasterChangeSnapshot {
  id: string;
  timestamp: string; // formatted time or ISO
  timeDisplay: string;
  actionType:
    | 'BULK_IMPORT'
    | 'BULK_EDIT'
    | 'BULK_DELETE'
    | 'CREATE_RECORD'
    | 'UPDATE_RECORD'
    | 'DELETE_RECORD'
    | 'SCHEMA_EXTEND'
    | 'BATCH_ROLLBACK';
  description: string;
  details?: string;
  affectedCount: number;
  previousMaster: MasterConfig;
  currentMaster: MasterConfig;
  user: {
    userId: string;
    name: string;
  };
}

interface BatchUndoModalProps {
  isOpen: boolean;
  onClose: () => void;
  undoStack: MasterChangeSnapshot[];
  currentMaster: MasterConfig;
  onRevertSnapshot: (snapshot: MasterChangeSnapshot, reason: string) => void;
  onRevertLastBulkImport: () => void;
  onClearHistory: () => void;
}

export const BatchUndoModal: React.FC<BatchUndoModalProps> = ({
  isOpen,
  onClose,
  undoStack,
  currentMaster,
  onRevertSnapshot,
  onRevertLastBulkImport,
  onClearHistory,
}) => {
  const [confirmingSnapshotId, setConfirmingSnapshotId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Find most recent bulk import snapshot if any
  const lastBulkImportSnapshot = undoStack.find((s) => s.actionType === 'BULK_IMPORT');

  const getActionBadge = (type: MasterChangeSnapshot['actionType']) => {
    switch (type) {
      case 'BULK_IMPORT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
            <Upload className="h-3 w-3 text-purple-600" />
            <span>Bulk Import</span>
          </span>
        );
      case 'BULK_EDIT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200 flex items-center gap-1">
            <Check className="h-3 w-3 text-cyan-600" />
            <span>Bulk Edit</span>
          </span>
        );
      case 'BULK_DELETE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
            <Trash2 className="h-3 w-3 text-rose-600" />
            <span>Bulk Delete</span>
          </span>
        );
      case 'CREATE_RECORD':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <Plus className="h-3 w-3 text-emerald-600" />
            <span>Record Created</span>
          </span>
        );
      case 'UPDATE_RECORD':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
            <Edit className="h-3 w-3 text-blue-600" />
            <span>Record Updated</span>
          </span>
        );
      case 'DELETE_RECORD':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
            <Trash2 className="h-3 w-3 text-rose-600" />
            <span>Record Deleted</span>
          </span>
        );
      case 'SCHEMA_EXTEND':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
            <Sliders className="h-3 w-3 text-amber-600" />
            <span>Custom Parameter</span>
          </span>
        );
      case 'BATCH_ROLLBACK':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
            <RotateCcw className="h-3 w-3 text-indigo-600" />
            <span>Batch Revert</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
            Change
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-fade-in text-xs">
        {/* Header */}
        <div className="px-6 py-4 bg-[#002B49] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
              <RotateCcw className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">Batch Undo &amp; Session Rollback</h3>
                <span className="px-2 py-0.5 rounded bg-blue-800/80 text-[10px] font-mono text-blue-200">
                  {currentMaster.name}
                </span>
              </div>
              <p className="text-[11px] text-blue-200">
                Safely revert bulk imports and multiple record modifications
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Informational Guidance Banner */}
        <div className="px-6 py-3 bg-amber-50/70 border-b border-amber-200/80 flex items-start gap-2.5 shrink-0 text-amber-900">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <strong>Data Integrity Rollback Safeguard:</strong> Reverting to any previous checkpoint
            will restore the master records and schema to that exact historical state. All changes
            recorded after that checkpoint will be reverted.
          </div>
        </div>

        {/* Quick Action: Revert Last Bulk Import */}
        {lastBulkImportSnapshot && (
          <div className="px-6 py-3 bg-purple-50/60 border-b border-purple-100 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-purple-700 shrink-0" />
              <div>
                <span className="font-bold text-purple-900">Last Bulk Import:</span>{' '}
                <span className="text-purple-800">{lastBulkImportSnapshot.description}</span>
                <span className="text-purple-600 font-mono text-[10px] ml-1.5">
                  ({lastBulkImportSnapshot.timeDisplay})
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                onRevertLastBulkImport();
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
              title="Immediately rollback the entire dataset to before this bulk import was applied"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Revert Bulk Import</span>
            </button>
          </div>
        )}

        {/* Change History Timeline */}
        <div className="p-6 space-y-3 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between text-slate-500 font-semibold text-xs pb-1">
            <div className="flex items-center gap-1.5">
              <History className="h-4 w-4 text-slate-400" />
              <span>Session Modification Checkpoints ({undoStack.length})</span>
            </div>
            {undoStack.length > 0 && (
              <button
                onClick={onClearHistory}
                className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
              >
                Clear History Log
              </button>
            )}
          </div>

          {undoStack.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2 border border-dashed border-slate-200 rounded-xl">
              <RotateCcw className="h-8 w-8 mx-auto text-slate-300" />
              <p className="font-semibold text-slate-600 text-xs">No Modifications in Current Session</p>
              <p className="text-[11px] max-w-sm mx-auto">
                Any additions, updates, deletions, schema custom parameters, or bulk uploads will be
                tracked here for batch undo and instant rollback.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {undoStack.map((snapshot, idx) => {
                const isLatest = idx === 0;
                const isConfirming = confirmingSnapshotId === snapshot.id;
                const rowsDiff =
                  currentMaster.records.length - snapshot.previousMaster.records.length;

                return (
                  <div
                    key={snapshot.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isLatest
                        ? 'border-blue-300 bg-blue-50/20 shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400 font-bold">
                            #{undoStack.length - idx}
                          </span>
                          {getActionBadge(snapshot.actionType)}
                          <span className="font-bold text-slate-800 text-xs">
                            {snapshot.description}
                          </span>
                          {isLatest && (
                            <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[9px] font-bold">
                              Most Recent
                            </span>
                          )}
                        </div>

                        {snapshot.details && (
                          <p className="text-[11px] text-slate-500">{snapshot.details}</p>
                        )}

                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{snapshot.timeDisplay}</span>
                          </span>
                          <span>•</span>
                          <span>User: {snapshot.user.name}</span>
                          <span>•</span>
                          <span>
                            State before change:{' '}
                            <strong className="text-slate-700 font-mono">
                              {snapshot.previousMaster.records.length} records
                            </strong>
                          </span>
                          {rowsDiff !== 0 && (
                            <>
                              <span>•</span>
                              <span
                                className={
                                  rowsDiff > 0
                                    ? 'text-emerald-700 font-semibold'
                                    : 'text-rose-700 font-semibold'
                                }
                              >
                                {rowsDiff > 0 ? `+${rowsDiff}` : rowsDiff} net rows since this checkpoint
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      {!isConfirming ? (
                        <button
                          onClick={() => setConfirmingSnapshotId(snapshot.id)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 hover:border-amber-500 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-900 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0 shadow-2xs"
                          title="Revert master dataset to before this change"
                        >
                          <RotateCcw className="h-3 w-3 text-amber-600" />
                          <span>Rollback Here</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 p-1 bg-amber-50 rounded-lg border border-amber-200 animate-fade-in shrink-0">
                          <span className="text-[10px] text-amber-900 font-bold px-1.5">
                            Revert {idx + 1} change{idx > 0 ? 's' : ''}?
                          </span>
                          <button
                            onClick={() => {
                              onRevertSnapshot(
                                snapshot,
                                `Batch rollback of ${idx + 1} change(s) to checkpoint #${undoStack.length - idx}`
                              );
                              setConfirmingSnapshotId(null);
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmingSnapshotId(null)}
                            className="px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-600 font-semibold text-[11px] border border-slate-200 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            Current Dataset:{' '}
            <strong className="text-slate-800 font-mono">
              {currentMaster.records.length} records
            </strong>{' '}
            • {currentMaster.fields.length} schema fields
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
