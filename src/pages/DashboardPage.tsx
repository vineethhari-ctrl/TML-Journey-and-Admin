import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { StatCard } from '../components/common/StatCard';
import { MetricVisualLegend } from '../components/dashboard/MetricVisualLegend';
import {
  Car,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  Smartphone,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Activity,
  ChevronRight,
  Sparkles,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Info,
  Layers,
  GitBranch,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { navigate, exceptions, updateExceptionStatus } = useApp();

  // State to toggle the metric reconciliation breakdown drawer
  const [showLogicBreakdown, setShowLogicBreakdown] = useState(false);
  const [selectedFlowTab, setSelectedFlowTab] = useState<'all' | 'pipeline' | 'workshop' | 'flags'>('all');

  // Journey stage distribution data (Sum = exactly 936 Active Job Cards)
  const stageDistribution = [
    { name: 'Appointment & Security Gate', count: 70, pct: 7.5, color: 'bg-slate-500', stageKey: 'Security' },
    { name: 'JC Creation', count: 184, pct: 19.7, color: 'bg-blue-600', stageKey: 'JC Creation' },
    { name: 'JC Tracking (Repair Bays)', count: 210, pct: 22.4, color: 'bg-indigo-600', stageKey: 'JC Tracking' },
    { name: 'SPD (Spare Parts Diagnostics)', count: 142, pct: 15.2, color: 'bg-sky-500', stageKey: 'SPD' },
    { name: 'THD (Technical Desk)', count: 96, pct: 10.3, color: 'bg-amber-500', stageKey: 'THD' },
    { name: 'EQC (Quality Check)', count: 70, pct: 7.5, color: 'bg-emerald-500', stageKey: 'EQC' },
    { name: 'Claim Settlement', count: 68, pct: 7.3, color: 'bg-purple-500', stageKey: 'Claim' },
    { name: 'BodyShop & Paint', count: 54, pct: 5.8, color: 'bg-orange-500', stageKey: 'BodyShop' },
    { name: 'IRA Connected Telematics', count: 42, pct: 4.5, color: 'bg-teal-500', stageKey: 'IRA' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-[#002B49] via-[#003B66] to-[#0b4d82] text-white p-6 rounded-2xl shadow-md border border-[#003B66]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-200">
              Tata Motors Service Transformation
            </span>
            <span className="h-1 w-1 rounded-full bg-blue-300" />
            <span className="text-xs text-blue-200 font-mono">Central Hub 100% Operational</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Service Control Center
          </h1>
          <p className="text-xs text-blue-100/90 max-w-xl">
            Centralized operational heartbeat tracking cross-module vehicle journeys and system access governance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/journey/JC20260930001234')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-blue-900 font-bold text-xs hover:bg-blue-50 shadow-md transition-all cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-blue-600" />
            <span>Open Demo Journey (MH01AB1234)</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Section 1: Journey Metrics */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-blue-700" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Journey Metrics
            </h2>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">
              Click any card below to filter journeys
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Metric logic toggle button */}
            <button
              onClick={() => setShowLogicBreakdown(!showLogicBreakdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold transition-all cursor-pointer"
            >
              <HelpCircle className="h-3.5 w-3.5 text-blue-600" />
              <span>How Counts Sum Up</span>
              {showLogicBreakdown ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            <button
              onClick={() => navigate('/journey?filter=active_vehicles')}
              className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              View all active journeys <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Visual Category Legend & Calculation Guide */}
        <MetricVisualLegend
          onFilterClick={(filterKey) => navigate(`/journey?filter=${filterKey}`)}
        />

        {/* 6 Clickable Journey Metric Cards with Interactive Hover Tooltips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            title="Active Vehicles"
            value="1,284"
            subtitle="936 Active JCs + 348 Inbound arrivals"
            badge="Active Pipeline"
            icon={Car}
            variant="accent"
            actionHint="Click to view (1,284)"
            tooltipInfo={{
              categoryType: 'Total Pipeline Population',
              calculationFormula: '936 Active JCs + 348 Inbound = 1,284 Active Vehicles',
              explanation: 'Total active vehicles present anywhere in the dealership workshops, triage bays, or security gates today.',
              hierarchyContext: 'Base Universe',
            }}
            onClick={() => navigate('/journey?filter=active_vehicles')}
          />
          <StatCard
            title="Active JCs"
            value="936"
            subtitle="742 in bays + 194 in reception/transit"
            badge="72.9% of Pipeline"
            icon={FileText}
            actionHint="Click to filter (936)"
            tooltipInfo={{
              categoryType: 'Formal Service Order Subset',
              calculationFormula: '742 Workshop Bays + 194 Reception/Wash Transit = 936 Active JCs',
              explanation: 'Vehicles with a formal repair order open and actively undergoing repair. Represents 72.9% of the active pipeline.',
              hierarchyContext: 'Subset of 1,284',
            }}
            onClick={() => navigate('/journey?filter=active_jcs')}
          />
          <StatCard
            title="In Workshop"
            value="742"
            subtitle="79.3% of JCs on repair lifts & bays"
            badge="Repair Bays"
            icon={Activity}
            actionHint="Click to filter bays (742)"
            tooltipInfo={{
              categoryType: 'Physical Bay Occupancy',
              calculationFormula: '742 on repair lifts + 194 in transit = 936 Active JCs',
              explanation: 'Vehicles physically stationed on two-post lifts, diagnostic test labs, wheel alignment, or paint booths.',
              hierarchyContext: '79.3% of Active JCs',
            }}
            onClick={() => navigate('/journey?filter=in_workshop')}
          />
          <StatCard
            title="Pending Actions"
            value="186"
            subtitle="Sub-flag: 186 JCs awaiting approvals"
            badge="19.9% of Active JCs"
            icon={Clock}
            variant="warning"
            actionHint="Click to filter (186)"
            tooltipInfo={{
              categoryType: 'Operational Blocker Flag',
              calculationFormula: '186 of 936 Active JCs flagged awaiting customer or parts approval',
              explanation: 'Not separate cars. This is an operational flag on 186 active JCs temporarily paused for estimate sign-off or spare parts delivery.',
              hierarchyContext: '19.9% of Active JCs',
            }}
            onClick={() => navigate('/journey?filter=pending')}
          />
          <StatCard
            title="Delayed Journeys"
            value="42"
            subtitle="Sub-flag: 42 JCs SLA TAT breached > 4h"
            badge="4.5% of Active JCs"
            icon={AlertTriangle}
            variant="danger"
            actionHint="Click to filter (42)"
            tooltipInfo={{
              categoryType: 'SLA Escalation Flag',
              calculationFormula: '42 of 936 Active JCs have exceeded customer-committed Turnaround Time (TAT)',
              explanation: 'Not separate cars. An escalation flag on 42 active JCs exceeding target SLA (>4h delay) requiring workshop manager intervention.',
              hierarchyContext: '4.5% of Active JCs',
            }}
            onClick={() => navigate('/journey?filter=delayed')}
          />
          <StatCard
            title="Completed Today"
            value="518"
            subtitle="Delivered to customer & exited pipeline"
            badge="Delivered Today"
            icon={CheckCircle2}
            variant="success"
            actionHint="Click to filter (518)"
            tooltipInfo={{
              categoryType: 'Exited Pipeline',
              calculationFormula: '1,284 Active + 518 Delivered Today = 1,802 Total Daily Volume',
              explanation: 'Vehicles whose service was finished, invoiced, and handed over to customers today. They have exited the active workshop pipeline.',
              hierarchyContext: 'Exited Pipeline',
            }}
            onClick={() => navigate('/journey?filter=completed')}
          />
        </div>

        {/* Metric Reconciliation & Sum Logic Panel (Expandable or always visible) */}
        {showLogicBreakdown && (
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50/70 to-white p-5 shadow-xs space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-blue-600 text-white">
                  <GitBranch className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Pipeline Metric Logic & Reconciliation Architecture
                  </h3>
                  <p className="text-xs text-slate-600">
                    How Active Vehicles, Active JCs, Workshop Bays, Flags, and Completed Deliveries relate mathematically
                  </p>
                </div>
              </div>

              {/* Navigation Tabs inside reconciliation */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-blue-200 text-xs">
                <button
                  onClick={() => setSelectedFlowTab('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    selectedFlowTab === 'all'
                      ? 'bg-blue-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Overview Equations
                </button>
                <button
                  onClick={() => setSelectedFlowTab('pipeline')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    selectedFlowTab === 'pipeline'
                      ? 'bg-blue-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Pipeline Flow
                </button>
                <button
                  onClick={() => setSelectedFlowTab('workshop')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    selectedFlowTab === 'workshop'
                      ? 'bg-blue-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Workshop vs Transit
                </button>
                <button
                  onClick={() => setSelectedFlowTab('flags')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    selectedFlowTab === 'flags'
                      ? 'bg-blue-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Attention Subsets
                </button>
              </div>
            </div>

            {/* Reconciliation Content */}
            {selectedFlowTab === 'all' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Equation 1: Daily Handled */}
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <span>1. Daily Handled Volume</span>
                    <span className="text-blue-700 font-mono">1,802 Vehicles</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs font-semibold text-slate-800">
                    1,284 Active + 518 Completed = 1,802 Total
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    <strong>518 Completed Today</strong> vehicles have finished service, been invoiced, and delivered back to customers, meaning they have already exited the active pipeline.
                  </p>
                </div>

                {/* Equation 2: Active Pipeline */}
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <span>2. Active Pipeline (1,284)</span>
                    <span className="text-blue-700 font-mono">100% Pipeline</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs font-semibold text-slate-800">
                    936 Active JCs + 348 Inbound = 1,284 Active
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    <strong>936 vehicles</strong> have an opened Job Card. The remaining <strong>348 vehicles</strong> are confirmed incoming appointments or checked-in at the security gate awaiting JC opening.
                  </p>
                </div>

                {/* Equation 3: Inside Active JCs */}
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <span>3. Inside Active JCs (936)</span>
                    <span className="text-blue-700 font-mono">100% Active JCs</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs font-semibold text-slate-800">
                    742 Bays + 194 Transit/Wash = 936 JCs
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    <strong>742 vehicles</strong> are physically in repair bays (lifts, body shop, diagnostics). <strong>194 vehicles</strong> are in front-office reception, washing, or road test staging.
                  </p>
                </div>
              </div>
            )}

            {selectedFlowTab === 'pipeline' && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 text-xs">
                  Daily Vehicle Flow Breakdown (Waterfalls from 1,802 Vehicles Processed)
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/50 border border-blue-100">
                    <span className="font-bold text-blue-950">Active Vehicles in Pipeline:</span>
                    <span className="font-mono font-bold text-blue-900">1,284 vehicles (71.3% of daily throughput)</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
                    <span className="font-bold text-emerald-950">Completed & Delivered Today:</span>
                    <span className="font-mono font-bold text-emerald-800">518 vehicles (28.7% of daily throughput)</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-bold text-slate-800">Total Network Throughput Today:</span>
                    <span className="font-mono font-bold text-slate-900">1,802 vehicles (1,284 + 518)</span>
                  </div>
                </div>
              </div>
            )}

            {selectedFlowTab === 'workshop' && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 text-xs">
                  Physical Bay Allocation of the 936 Active Job Cards
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>Vehicles in Workshop Bays</span>
                      <span className="font-mono text-indigo-700">742 (79.3%)</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Stationed on physical 2-post mechanical lifts, EV battery laboratories, wheel alignment stations, paint booths, and electronic inspection bays.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>Reception, Wash &amp; Staging Bays</span>
                      <span className="font-mono text-cyan-700">194 (20.7%)</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Customer reception lounge, security entrance, pre-delivery wash bay, road test staging, and invoice clearance desk.
                    </p>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-center font-mono font-bold text-blue-900">
                  742 (Workshop Bays) + 194 (Reception &amp; Transit) = exactly 936 Active JCs
                </div>
              </div>
            )}

            {selectedFlowTab === 'flags' && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 text-xs">
                  Operational Attention Flags on Active JCs (Subsets, Not Separate Vehicles)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 space-y-1.5">
                    <div className="flex justify-between font-bold text-amber-950">
                      <span>Pending Actions (186 JCs)</span>
                      <span className="font-mono text-amber-700">19.9% of Active JCs</span>
                    </div>
                    <p className="text-[11px] text-amber-900/80">
                      These are <strong>186 of the active JCs</strong> that are temporarily paused awaiting customer estimate approval, spare parts shipment, or insurance survey sign-off.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-rose-50/70 border border-rose-200 space-y-1.5">
                    <div className="flex justify-between font-bold text-rose-950">
                      <span>Delayed Journeys (42 JCs)</span>
                      <span className="font-mono text-rose-700">4.5% of Active JCs</span>
                    </div>
                    <p className="text-[11px] text-rose-900/80">
                      These are <strong>42 of the active JCs</strong> that have breached the customer-committed Turnaround Time (TAT &gt; 4h) and require workshop manager escalation.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
              <span className="flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-blue-600" />
                All 6 tabs above are interactive. Clicking any metric opens the matching filtered journey list.
              </span>
              <button
                onClick={() => setShowLogicBreakdown(false)}
                className="text-blue-700 font-bold hover:underline cursor-pointer"
              >
                Hide Breakdown [✕]
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Grid: Journey Stage Distribution + Administration Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stage Distribution visualization (2 cols on large) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Journey Stage Distribution
              </h3>
              <p className="text-xs text-slate-500">
                Live volume of vehicles across individual service modules (Click any bar to filter)
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              936 Active Cases
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {stageDistribution.map((item) => (
              <div
                key={item.name}
                onClick={() => navigate(`/journey?filter=stage_${encodeURIComponent(item.stageKey)}`)}
                className="group space-y-1 cursor-pointer p-1.5 -mx-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors flex items-center gap-1.5">
                    <span>{item.name}</span>
                    <span className="text-[10px] text-slate-400 group-hover:text-blue-500 font-normal opacity-0 group-hover:opacity-100 transition-opacity">
                      (Filter →)
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px] font-mono">{item.pct}%</span>
                    <span className="font-mono font-bold text-slate-900">
                      {item.count} cases
                    </span>
                  </div>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 group-hover:brightness-95 ${item.color}`}
                    style={{ width: `${item.pct * 3.5}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Administration Metrics Card (1 col) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Administration Metrics
                </h3>
                <p className="text-xs text-slate-500">
                  Access &amp; Security posture overview
                </p>
              </div>
              <button
                onClick={() => navigate('/admin/users')}
                className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                Manage
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 text-xs">
              <div
                onClick={() => navigate('/admin/users')}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 cursor-pointer hover:bg-blue-50/50 hover:border-blue-300 transition-all"
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span>Active Users</span>
                  <Users className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <p className="text-xl font-bold text-slate-900 mt-1">428</p>
                <span className="text-[10px] text-emerald-600 font-medium">312 CRM + 116 Non-CRM</span>
              </div>

              <div
                onClick={() => navigate('/admin/users')}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 cursor-pointer hover:bg-blue-50/50 hover:border-blue-300 transition-all"
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span>CRM Users</span>
                  <TrendingUp className="h-3.5 w-3.5 text-indigo-600" />
                </div>
                <p className="text-xl font-bold text-slate-900 mt-1">312</p>
                <span className="text-[10px] text-slate-500">Linked to CRM (72.9%)</span>
              </div>

              <div
                onClick={() => navigate('/admin/users')}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 cursor-pointer hover:bg-blue-50/50 hover:border-blue-300 transition-all"
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span>Non-CRM Users</span>
                  <Users className="h-3.5 w-3.5 text-cyan-600" />
                </div>
                <p className="text-xl font-bold text-slate-900 mt-1">116</p>
                <span className="text-[10px] text-slate-500">TML Local ID (27.1%)</span>
              </div>

              <div
                onClick={() => navigate('/admin/devices')}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 cursor-pointer hover:bg-purple-50/50 hover:border-purple-300 transition-all"
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span>Active Devices</span>
                  <Smartphone className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <p className="text-xl font-bold text-slate-900 mt-1">391</p>
                <span className="text-[10px] text-slate-500">Enrolled endpoints</span>
              </div>

              <div
                onClick={() => navigate('/admin/sessions')}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 cursor-pointer hover:bg-emerald-50/50 hover:border-emerald-300 transition-all"
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span>Active Sessions</span>
                  <Clock className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <p className="text-xl font-bold text-slate-900 mt-1">276</p>
                <span className="text-[10px] text-emerald-600 font-medium">Encrypted JWT tokens</span>
              </div>

              <div
                onClick={() => navigate('/admin/users')}
                className="p-3 bg-rose-50/60 rounded-xl border border-rose-200/80 cursor-pointer hover:bg-rose-100/50 hover:border-rose-300 transition-all"
              >
                <div className="flex items-center justify-between text-rose-700">
                  <span>Suspended Users</span>
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                </div>
                <p className="text-xl font-bold text-rose-950 mt-1">9</p>
                <span className="text-[10px] text-rose-700 font-medium">Access revoked</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400">Security Audit Logs: 35 recorded</span>
            <button
              onClick={() => navigate('/admin/audit')}
              className="text-blue-600 font-semibold hover:underline cursor-pointer"
            >
              Open Audit Trail →
            </button>
          </div>
        </div>
      </div>

      {/* Section 3: Recent Journey Exceptions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>Recent Journey Exceptions</span>
            </h3>
            <p className="text-xs text-slate-500">
              Active operational bottlenecks requiring intervention across workshops
            </p>
          </div>
          <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
            {exceptions.filter((e) => e.status !== 'RESOLVED').length} Open Exceptions
          </span>
        </div>

        {/* Exceptions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-[11px] uppercase tracking-wider border-y border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Vehicle</th>
                <th className="py-2.5 px-3">JC Number</th>
                <th className="py-2.5 px-3">Current Stage</th>
                <th className="py-2.5 px-3">Issue / Description</th>
                <th className="py-2.5 px-3">Age</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exceptions.slice(0, 5).map((exc) => (
                <tr key={exc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-900 font-mono">
                      {exc.vehicleRegistration}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono font-medium text-blue-900">
                    {exc.jcNumber}
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                      {exc.module}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-slate-800">{exc.title}</p>
                    <p className="text-[11px] text-slate-500 truncate max-w-md">{exc.description}</p>
                  </td>
                  <td className="py-3 px-3 font-mono font-medium text-rose-600 whitespace-nowrap">
                    {exc.age}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/journey/${exc.jcNumber}`)}
                        className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-[11px] transition-colors cursor-pointer"
                      >
                        View Journey
                      </button>
                      {exc.status !== 'RESOLVED' && (
                        <button
                          onClick={() => updateExceptionStatus(exc.id, 'RESOLVED')}
                          className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-[11px] transition-colors cursor-pointer"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
