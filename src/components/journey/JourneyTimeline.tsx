import React, { useState } from 'react';
import { JourneyEvent, ModuleType } from '../../types';
import { JourneyEventModal } from './JourneyEventModal';
import {
  Clock,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { parseDateTime } from '../../utils/dateUtil';

interface JourneyTimelineProps {
  events: JourneyEvent[];
  activeStageFilter?: string;
  onClearStageFilter?: () => void;
}

export const JourneyTimeline: React.FC<JourneyTimelineProps> = ({
  events,
  activeStageFilter,
  onClearStageFilter,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<JourneyEvent | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');

  // Filter events
  const filteredEvents = events.filter((evt) => {
    if (activeStageFilter && evt.stage !== activeStageFilter && evt.module !== activeStageFilter) {
      return false;
    }
    if (moduleFilter !== 'ALL' && evt.module !== moduleFilter) {
      return false;
    }
    return true;
  });

  // Sort events
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const timeA = parseDateTime(a.timestamp).getTime();
    const timeB = parseDateTime(b.timestamp).getTime();
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  const uniqueModules = Array.from(new Set(events.map((e) => e.module))) as ModuleType[];

  return (
    <div className="space-y-4">
      {/* Timeline Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Clock className="h-4 w-4 text-blue-600" />
            <span>Operational Event Log</span>
            <span className="text-slate-400 font-normal">({sortedEvents.length} events)</span>
          </div>

          {activeStageFilter && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
              <span>Stage: {activeStageFilter}</span>
              <button
                onClick={onClearStageFilter}
                className="ml-1 hover:text-blue-950 font-bold"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex items-center gap-2 text-xs">
          {/* Module Filter */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-hidden text-xs cursor-pointer"
            >
              <option value="ALL">All Modules</option>
              {uniqueModules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Sort order toggle */}
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 hover:bg-slate-50 font-medium transition-colors"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
          </button>
        </div>
      </div>

      {/* Timeline Stream */}
      {sortedEvents.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
          No events match the selected criteria.
        </div>
      ) : (
        <div className="relative border-l-2 border-blue-200 ml-4 space-y-6 pl-6 py-2">
          {sortedEvents.map((evt) => {
            const timeStr = evt.timestamp.includes(' ')
              ? evt.timestamp.split(' ')[1].slice(0, 5)
              : evt.timestamp;
            const dateStr = evt.timestamp.includes(' ') ? evt.timestamp.split(' ')[0] : '';

            const isProgress = evt.status.toLowerCase().includes('progress');
            const isCompleted = evt.status.toLowerCase().includes('completed');

            return (
              <div
                key={evt.eventId}
                onClick={() => setSelectedEvent(evt)}
                className="group relative cursor-pointer"
              >
                {/* Node circle on the vertical spine */}
                <div
                  className={`absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-white transition-all group-hover:scale-125 ${
                    isProgress
                      ? 'border-blue-600 bg-blue-600 ring-4 ring-blue-100'
                      : isCompleted
                      ? 'border-emerald-600 bg-emerald-500'
                      : 'border-slate-400 bg-slate-300'
                  }`}
                />

                {/* Event Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:border-blue-400 hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    {/* Timestamp & Module Header */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-extrabold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {timeStr}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {dateStr}
                        </span>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100">
                          {evt.module}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors flex items-center gap-1.5">
                        {evt.eventType}
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </h4>
                    </div>

                    {/* Status Pill */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isProgress
                            ? 'bg-blue-100 text-blue-800 animate-pulse'
                            : isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {evt.status}
                      </span>
                    </div>
                  </div>

                  {/* Body Remarks */}
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed font-mono bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                    {evt.remarks}
                  </p>

                  {/* Footer Actor & Reference */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                    <div className="flex items-center gap-3">
                      <span>
                        By:{' '}
                        <strong className="text-slate-800 font-semibold">{evt.userName}</strong>
                        {evt.employeeId && (
                          <span className="text-[10px] text-slate-400 ml-1">({evt.employeeId})</span>
                        )}
                      </span>
                      <span>•</span>
                      <span className="text-slate-500 truncate max-w-[180px]">{evt.dealer}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-500">
                        Ref: {evt.referenceNumber}
                      </span>
                      <span className="text-[11px] text-blue-600 font-semibold inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        View Details <ExternalLink className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog for Clicked Event */}
      <JourneyEventModal
        event={selectedEvent}
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
};
