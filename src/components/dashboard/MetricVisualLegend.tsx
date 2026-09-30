import React, { useState } from 'react';
import {
  Info,
  GitBranch,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  Car,
  FileText,
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  X,
  Sparkles,
} from 'lucide-react';

interface MetricVisualLegendProps {
  onFilterClick?: (filterKey: string) => void;
}

export const MetricVisualLegend: React.FC<MetricVisualLegendProps> = ({ onFilterClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'equations' | 'definitions'>('hierarchy');

  const categories = [
    {
      id: 'active_vehicles',
      name: 'Active Vehicles',
      count: '1,284',
      type: 'Total Population',
      typeColor: 'bg-blue-100 text-blue-900 border-blue-300',
      dotColor: 'bg-blue-600',
      description: 'Grand total of vehicles present in the dealership network right now.',
      formula: '936 Active JCs + 348 Inbound Arrivals = 1,284 Active Vehicles',
      icon: Car,
    },
    {
      id: 'active_jcs',
      name: 'Active JCs',
      count: '936',
      type: 'Service Order Subset',
      typeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      dotColor: 'bg-indigo-600',
      description: 'Formal repair orders open and undergoing active service (72.9% of pipeline).',
      formula: '742 In Bays + 194 Reception/Wash Transit = 936 Active JCs',
      icon: FileText,
    },
    {
      id: 'in_workshop',
      name: 'In Workshop Bays',
      count: '742',
      type: 'Physical Location',
      typeColor: 'bg-purple-100 text-purple-900 border-purple-300',
      dotColor: 'bg-purple-600',
      description: 'Vehicles physically on two-post lifts, diagnostic labs, or paint booths (79.3% of JCs).',
      formula: '742 on repair lifts + 194 in transit = 936 Active JCs',
      icon: Activity,
    },
    {
      id: 'pending',
      name: 'Pending Actions',
      count: '186',
      type: 'Operational Blocker Flag',
      typeColor: 'bg-amber-100 text-amber-900 border-amber-300',
      dotColor: 'bg-amber-600',
      description: 'Sub-flag: Active JCs paused awaiting customer estimate or parts approval (19.9% of JCs).',
      formula: '186 JCs flagged awaiting customer/parts/insurance approval',
      icon: Clock,
    },
    {
      id: 'delayed',
      name: 'Delayed Journeys',
      count: '42',
      type: 'SLA Escalation Flag',
      typeColor: 'bg-rose-100 text-rose-900 border-rose-300',
      dotColor: 'bg-rose-600',
      description: 'Sub-flag: Active JCs with turnaround time (TAT) SLA breached > 4h (4.5% of JCs).',
      formula: '42 JCs flagged with Turnaround Time (TAT) overdue',
      icon: AlertTriangle,
    },
    {
      id: 'completed',
      name: 'Completed Today',
      count: '518',
      type: 'Exited Pipeline',
      typeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      dotColor: 'bg-emerald-600',
      description: 'Vehicles finished, invoiced, and handed over to customer today (exited active pipeline).',
      formula: '1,284 Active + 518 Delivered Today = 1,802 Total Daily Handled',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="rounded-xl border border-blue-200/90 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/60 p-3.5 shadow-2xs space-y-2.5">
      {/* Legend Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-blue-900 text-white">
            <Layers className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-950">
                Vehicle Status Categories &amp; Calculation Legend
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 font-semibold">
                Platform Architecture
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Categories represent hierarchical subsets and cross-cutting flags, not horizontal sums.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white hover:bg-blue-50 border border-blue-200 text-blue-900 font-bold text-xs transition-colors cursor-pointer shadow-2xs"
          >
            <HelpCircle className="h-3.5 w-3.5 text-blue-600" />
            <span>{isOpen ? 'Hide Calculation Guide' : 'Explain Calculations & Hierarchy'}</span>
            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Visual Status Category Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.id}
              onClick={() => onFilterClick && onFilterClick(cat.id)}
              className="p-2 rounded-lg bg-white/95 border border-slate-200/90 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
              title={`${cat.name}: ${cat.formula}`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] font-bold text-slate-800 group-hover:text-blue-700">
                    <span className={`h-2 w-2 rounded-full ${cat.dotColor}`} />
                    <span>{cat.name}</span>
                  </span>
                  <Icon className="h-3 w-3 text-slate-400 group-hover:text-blue-600" />
                </div>
                <div className="flex items-baseline justify-between pt-0.5">
                  <span className="font-mono font-black text-sm text-slate-900">{cat.count}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${cat.typeColor}`}>
                    {cat.type}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 line-clamp-1 group-hover:line-clamp-none transition-all">
                {cat.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Expandable Deep Calculation & Hierarchy Guide */}
      {isOpen && (
        <div className="mt-3 pt-3 border-t border-blue-100 bg-white p-4 rounded-xl shadow-2xs space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-blue-700" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Mathematical Hierarchy &amp; Total Count Formulas
              </h4>
            </div>

            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setActiveTab('hierarchy')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  activeTab === 'hierarchy' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Visual Flowchart
              </button>
              <button
                onClick={() => setActiveTab('equations')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  activeTab === 'equations' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Calculation Formulas
              </button>
              <button
                onClick={() => setActiveTab('definitions')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  activeTab === 'definitions' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Status Definitions
              </button>
            </div>
          </div>

          {/* Tab 1: Visual Flowchart */}
          {activeTab === 'hierarchy' && (
            <div className="space-y-3 text-xs">
              <p className="text-slate-600 text-xs">
                In automotive workshop operations, the pipeline flows in nested hierarchical tiers:
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="font-bold text-slate-900">1. DAILY NETWORK THROUGHPUT:</span>
                  <span className="font-bold text-blue-900">1,802 Total Vehicles Processed Today</span>
                </div>
                <div className="pl-4 space-y-1.5 border-l-2 border-slate-300">
                  <div className="flex items-center justify-between text-emerald-800">
                    <span>├── [EXITED] Completed &amp; Delivered Today:</span>
                    <span className="font-bold">518 Vehicles (28.7%)</span>
                  </div>
                  <div className="flex items-center justify-between text-blue-900 font-bold">
                    <span>└── [ACTIVE] Active Vehicles in Pipeline:</span>
                    <span>1,284 Vehicles (71.3%)</span>
                  </div>

                  {/* Level 2 */}
                  <div className="pl-6 space-y-1.5 border-l-2 border-blue-300 pt-1">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>├── Inbound Arrivals &amp; Scheduled Appointments:</span>
                      <span className="font-bold">348 Vehicles (Checked in at gate)</span>
                    </div>
                    <div className="flex items-center justify-between text-indigo-900 font-bold">
                      <span>└── Active Job Cards (Under repair):</span>
                      <span>936 Active JCs (72.9% of active)</span>
                    </div>

                    {/* Level 3 */}
                    <div className="pl-6 space-y-1.5 border-l-2 border-indigo-300 pt-1">
                      <div className="flex items-center justify-between text-purple-800 font-bold">
                        <span>├── Physical Workshop Bays:</span>
                        <span>742 Vehicles (79.3% on repair lifts/booths)</span>
                      </div>
                      <div className="flex items-center justify-between text-cyan-800">
                        <span>└── Reception, Wash &amp; Road Test Staging:</span>
                        <span className="font-bold">194 Vehicles (20.7% in transit)</span>
                      </div>

                      <div className="pt-2 border-t border-slate-200">
                        <span className="font-bold text-slate-700">Cross-cutting Flags on Active JCs (Subsets, not separate cars):</span>
                        <div className="flex items-center justify-between text-amber-800 pt-1">
                          <span>• ⚠️ Pending Actions (Waiting estimate/parts):</span>
                          <span className="font-bold">186 JCs (19.9% of active JCs)</span>
                        </div>
                        <div className="flex items-center justify-between text-rose-800 pt-1">
                          <span>• 🚨 Delayed Journeys (Turnaround Time SLA breached):</span>
                          <span className="font-bold">42 JCs (4.5% of active JCs)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Calculation Formulas */}
          {activeTab === 'equations' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 space-y-1.5">
                <span className="font-bold text-blue-900 uppercase tracking-wider text-[10px]">
                  Equation 1: Daily Throughput
                </span>
                <p className="font-mono font-bold text-sm text-blue-950">1,284 + 518 = 1,802</p>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  1,284 vehicles are currently active inside workshops + 518 have been delivered today.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-200 space-y-1.5">
                <span className="font-bold text-indigo-900 uppercase tracking-wider text-[10px]">
                  Equation 2: Active Pipeline
                </span>
                <p className="font-mono font-bold text-sm text-indigo-950">936 + 348 = 1,284</p>
                <p className="text-[11px] text-indigo-800 leading-relaxed">
                  936 vehicles have formal open Job Cards + 348 vehicles are confirmed incoming bookings.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-purple-50/70 border border-purple-200 space-y-1.5">
                <span className="font-bold text-purple-900 uppercase tracking-wider text-[10px]">
                  Equation 3: Bay Occupancy
                </span>
                <p className="font-mono font-bold text-sm text-purple-950">742 + 194 = 936</p>
                <p className="text-[11px] text-purple-800 leading-relaxed">
                  742 vehicles occupy physical workshop repair bays + 194 are in reception/wash transit.
                </p>
              </div>
            </div>
          )}

          {/* Tab 3: Definitions */}
          {activeTab === 'definitions' && (
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-800">Why doesn&apos;t 936 + 742 + 186 + 42 + 518 sum to 1,284?</span>
                  <p className="text-slate-600 text-[11px] mt-1">
                    Because you would be counting the same vehicle 2 or 3 times:
                    A car in a repair bay (742) is already part of the active JCs (936), and if it is awaiting customer approval, it is also tagged in Pending Actions (186).
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-800">Are Pending Actions &amp; Delayed Journeys extra cars?</span>
                  <p className="text-slate-600 text-[11px] mt-1">
                    No. They are <strong>operational status flags</strong> attached to specific active Job Cards that require workshop manager intervention.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-blue-700 font-bold hover:underline cursor-pointer"
            >
              Close Guide [✕]
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
