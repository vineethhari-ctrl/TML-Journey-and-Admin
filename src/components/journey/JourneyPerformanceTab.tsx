import React from 'react';
import { Clock, TrendingUp, AlertTriangle, CheckCircle, Flame, BarChart3 } from 'lucide-react';
import { StatCard } from '../common/StatCard';

interface JourneyPerformanceTabProps {
  jcNumber: string;
}

export const JourneyPerformanceTab: React.FC<JourneyPerformanceTabProps> = () => {
  // Realistic stage performance metrics for this vehicle journey
  const stageDurations = [
    { stage: 'Appointment', minutes: 12, label: '12 min', sla: '15 min', status: 'GREEN' },
    { stage: 'P&D / Reception', minutes: 37, label: '37 min', sla: '30 min', status: 'AMBER' },
    { stage: 'Security', minutes: 8, label: '8 min', sla: '10 min', status: 'GREEN' },
    { stage: 'JC Creation', minutes: 15, label: '15 min', sla: '20 min', status: 'GREEN' },
    { stage: 'JC Tracking', minutes: 42, label: '42 min', sla: '30 min', status: 'AMBER' },
    { stage: 'SPD (Parts)', minutes: 70, label: '1h 10m', sla: '60 min', status: 'AMBER' },
    { stage: 'THD (Diagnostics)', minutes: 125, label: '2h 05m', sla: '120 min', status: 'AMBER' },
    { stage: 'EQC (Quality Check)', minutes: 55, label: '55 min (Active)', sla: '45 min', status: 'BLUE' },
    { stage: 'Claim Settlement', minutes: 80, label: '1h 20m (Est)', sla: '90 min', status: 'PENDING' },
    { stage: 'IRA Telematics', minutes: 45, label: '45 min (Est)', sla: '30 min', status: 'PENDING' },
  ];

  const maxMinutes = Math.max(...stageDurations.map((d) => d.minutes));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-600" />
          <span>Turnaround Time (TAT) & Stage SLA Performance</span>
        </h3>
        <p className="text-xs text-slate-500">
          Cross-module analytical efficiency benchmarks against Tata Motors workshop standards.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title="Total Elapsed"
          value="08h 42m"
          subtitle="Started at 09:05 AM"
          icon={Clock}
          variant="accent"
        />
        <StatCard
          title="Avg Stage TAT"
          value="48 min"
          subtitle="Target: ≤ 45 min"
          icon={TrendingUp}
        />
        <StatCard
          title="Longest Stage"
          value="THD"
          subtitle="2h 05m duration"
          icon={Flame}
          variant="warning"
        />
        <StatCard
          title="Delays / Hold"
          value="2"
          subtitle="Total hold: 52 min"
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="Stage Reopens"
          value="0"
          subtitle="Zero rework"
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Exceptions"
          value="2"
          subtitle="1 open, 1 in review"
          icon={AlertTriangle}
        />
      </div>

      {/* Stage Duration Bar Chart Visualizer */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Stage Duration Breakdown vs SLA
            </h4>
            <p className="text-xs text-slate-500">
              Visual duration comparison across all active and scheduled service modules.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-blue-600" /> Actual TAT
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-slate-300" /> Target SLA
            </span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          {stageDurations.map((item) => {
            const widthPct = Math.round((item.minutes / maxMinutes) * 100);

            return (
              <div key={item.stage} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-800 font-semibold">{item.stage}</span>
                  <div className="flex items-center gap-3 text-slate-500">
                    <span className="text-[11px] text-slate-400">SLA: {item.sla}</span>
                    <span className="font-mono font-bold text-slate-900">{item.label}</span>
                  </div>
                </div>
                {/* Bar */}
                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.status === 'BLUE'
                        ? 'bg-blue-600 animate-pulse'
                        : item.status === 'AMBER'
                        ? 'bg-amber-500'
                        : item.status === 'PENDING'
                        ? 'bg-slate-300'
                        : 'bg-emerald-600'
                    }`}
                    style={{ width: `${Math.max(5, widthPct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
