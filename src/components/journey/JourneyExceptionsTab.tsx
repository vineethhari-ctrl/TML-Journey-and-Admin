import React from 'react';
import { JourneyException, ExceptionStatus } from '../../types';
import { useApp } from '../../context/AppContext';
import { AlertTriangle, Clock, User, CheckCircle2, RefreshCw } from 'lucide-react';

interface JourneyExceptionsTabProps {
  jcNumber: string;
}

export const JourneyExceptionsTab: React.FC<JourneyExceptionsTabProps> = ({ jcNumber }) => {
  const { exceptions, updateExceptionStatus } = useApp();

  const caseExceptions = exceptions.filter((e) => e.jcNumber === jcNumber);

  const getSeverityBadge = (severity: JourneyException['severity']) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'LOW':
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusBadge = (status: ExceptionStatus) => {
    switch (status) {
      case 'OPEN':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'IN PROGRESS':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'RESOLVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Journey Operational Exceptions & Blockers</span>
            <span className="text-xs font-normal text-slate-500">
              ({caseExceptions.length} active exceptions flagged)
            </span>
          </h3>
          <p className="text-xs text-slate-500">
            Real-time bottlenecks escalated from sub-modules preventing next-stage handover.
          </p>
        </div>
      </div>

      {caseExceptions.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-slate-200 bg-white">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
          <h4 className="text-sm font-bold text-slate-800">No Open Exceptions</h4>
          <p className="text-xs text-slate-500 mt-1">
            This vehicle journey is progressing smoothly with zero bottlenecks detected.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {caseExceptions.map((exc) => (
            <div
              key={exc.id}
              className={`rounded-xl border p-4 bg-white shadow-xs transition-all ${
                exc.status === 'RESOLVED' ? 'opacity-70 border-slate-200' : 'border-amber-300 ring-1 ring-amber-100'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadge(
                        exc.severity
                      )}`}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {exc.severity} SEVERITY
                    </span>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      Module: {exc.module}
                    </span>
                    <span className="font-mono text-xs text-slate-400">ID: {exc.id}</span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 mt-1">{exc.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-mono bg-slate-50 p-2 rounded border border-slate-100 mt-1">
                    {exc.description}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadge(
                      exc.status
                    )}`}
                  >
                    {exc.status}
                  </span>

                  <div className="flex items-center gap-1 text-xs text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded">
                    <Clock className="h-3 w-3" />
                    <span>Age: {exc.age}</span>
                  </div>
                </div>
              </div>

              {/* Action row */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4 text-slate-500">
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    Owner: <strong className="text-slate-700 ml-1">{exc.owner}</strong>
                  </span>
                  <span>•</span>
                  <span>Raised: {exc.raisedTime}</span>
                </div>

                {/* Status action buttons */}
                <div className="flex items-center gap-2">
                  {exc.status === 'OPEN' && (
                    <button
                      onClick={() => updateExceptionStatus(exc.id, 'IN PROGRESS')}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs border border-blue-200 transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Take Ownership
                    </button>
                  )}

                  {exc.status !== 'RESOLVED' && (
                    <button
                      onClick={() => updateExceptionStatus(exc.id, 'RESOLVED')}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-xs transition-colors shadow-2xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Resolve Blocker
                    </button>
                  )}

                  {exc.status === 'RESOLVED' && (
                    <button
                      onClick={() => updateExceptionStatus(exc.id, 'OPEN')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium text-xs transition-colors"
                    >
                      Reopen Exception
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
