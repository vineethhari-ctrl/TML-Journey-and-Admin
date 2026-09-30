import React, { useState } from 'react';
import { JourneyStage } from '../../types';
import { journeyService } from '../../services/journeyService';
import { CheckCircle2, Clock, PlayCircle, AlertOctagon, CornerRightDown, LayoutList, Columns } from 'lucide-react';

interface JourneyTrackerProps {
  stages: JourneyStage[];
  selectedStageId?: string;
  onSelectStage: (stage: JourneyStage) => void;
}

export const JourneyTracker: React.FC<JourneyTrackerProps> = ({
  stages,
  selectedStageId,
  onSelectStage,
}) => {
  const [viewMode, setViewMode] = useState<'flow' | 'grid'>('flow');

  const getStatusIcon = (status: JourneyStage['status']) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case 'IN PROGRESS':
        return <PlayCircle className="h-4 w-4 text-blue-600 animate-pulse" />;
      case 'BLOCKED':
        return <AlertOctagon className="h-4 w-4 text-rose-600" />;
      case 'SKIPPED':
        return <CornerRightDown className="h-4 w-4 text-amber-600" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Tracker Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Service Module Progression Pipeline</span>
            <span className="text-xs font-normal text-slate-500">
              ({stages.filter((s) => s.status === 'COMPLETED').length} of {stages.length} stages completed)
            </span>
          </h3>
          <p className="text-xs text-slate-500">
            Click any stage node to inspect stage parameters, responsible personnel, and filter timeline logs.
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
          <button
            onClick={() => setViewMode('flow')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
              viewMode === 'flow'
                ? 'bg-white font-semibold text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Columns className="h-3.5 w-3.5" /> Horizontal Flow
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-white font-semibold text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutList className="h-3.5 w-3.5" /> Stage Grid
          </button>
        </div>
      </div>

      {/* Horizontal Sequential Flow */}
      {viewMode === 'flow' ? (
        <div className="relative overflow-x-auto pb-3 pt-1">
          <div className="flex items-start gap-2.5 min-w-max">
            {stages.map((stg, index) => {
              const isSelected = selectedStageId === stg.stageId;
              const colors = journeyService.getStageColor(stg.status);

              return (
                <React.Fragment key={stg.stageId}>
                  <div
                    onClick={() => onSelectStage(stg)}
                    className={`group relative w-48 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md bg-white'
                        : `${colors.bg} hover:border-slate-400 hover:shadow-xs`
                    }`}
                  >
                    {/* Top status indicator & sequence */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold bg-white/80 border border-slate-200 shadow-2xs">
                          {stg.sequence}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 truncate max-w-[80px]">
                          {stg.module}
                        </span>
                      </div>
                      <div>{getStatusIcon(stg.status)}</div>
                    </div>

                    {/* Stage Name */}
                    <h5 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-blue-700 transition-colors">
                      {stg.name}
                    </h5>

                    {/* Metadata pill */}
                    <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1 text-[11px]">
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Duration:</span>
                        <span className="font-semibold text-slate-800">{stg.duration || '--'}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Lead:</span>
                        <span className="font-medium text-slate-700 truncate max-w-[90px]">
                          {stg.responsibleUser.split(' ')[0]}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="mt-2.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${colors.badge}`}>
                        {stg.status}
                      </span>
                    </div>
                  </div>

                  {/* Connecting Arrow */}
                  {index < stages.length - 1 && (
                    <div className="flex items-center self-center text-slate-300">
                      <div className="h-0.5 w-3 bg-slate-300" />
                      <span className="text-[10px] text-slate-400">▶</span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ) : (
        /* Detailed Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {stages.map((stg) => {
            const isSelected = selectedStageId === stg.stageId;
            const colors = journeyService.getStageColor(stg.status);

            return (
              <div
                key={stg.stageId}
                onClick={() => onSelectStage(stg)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md bg-white'
                    : `${colors.bg} hover:border-slate-400`
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Stage {stg.sequence} • {stg.module}
                    </span>
                    <h5 className="text-xs font-bold text-slate-900 mt-0.5">{stg.name}</h5>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${colors.badge}`}>
                    {stg.status}
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Duration</span>
                    <span className="font-semibold text-slate-800">{stg.duration || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Responsible</span>
                    <span className="font-semibold text-slate-800 truncate block">
                      {stg.responsibleUser}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-400 block">Reference</span>
                    <span className="font-mono text-[11px] text-slate-700">
                      {stg.referenceNumber || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="mt-2 p-2 bg-white/70 rounded border border-slate-200/60 text-[11px] text-slate-600 italic line-clamp-1">
                  "{stg.remarks}"
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
