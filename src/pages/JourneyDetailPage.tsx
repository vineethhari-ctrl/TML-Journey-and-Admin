import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { JourneyStage } from '../types';
import { JourneyTracker } from '../components/journey/JourneyTracker';
import { JourneyTimeline } from '../components/journey/JourneyTimeline';
import { JourneyExceptionsTab } from '../components/journey/JourneyExceptionsTab';
import { JourneyPerformanceTab } from '../components/journey/JourneyPerformanceTab';
import { StatCard } from '../components/common/StatCard';
import {
  Car,
  Clock,
  Layers,
  AlertTriangle,
  Activity,
  ArrowLeft,
  Share2,
  FileDown,
  Building,
  User,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface JourneyDetailPageProps {
  jcNumber?: string;
}

export const JourneyDetailPage: React.FC<JourneyDetailPageProps> = ({ jcNumber = 'JC20260930001234' }) => {
  const { serviceCases, stages, events, exceptions, navigate, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'timeline' | 'exceptions' | 'performance'>('timeline');
  const [selectedStage, setSelectedStage] = useState<JourneyStage | null>(null);

  // Find target case or fallback to first
  const currentCase = serviceCases.find((c) => c.jcNumber === jcNumber) || serviceCases[0];
  const caseStages = stages[currentCase.jcNumber] || stages['JC20260930001234'] || [];
  const caseEvents = events[currentCase.jcNumber] || events['JC20260930001234'] || [];
  const caseExceptions = exceptions.filter((e) => e.jcNumber === currentCase.jcNumber);

  const handleStageSelect = (stage: JourneyStage) => {
    setSelectedStage((prev) => (prev?.stageId === stage.stageId ? null : stage));
  };

  return (
    <div className="space-y-6">
      {/* Top action row */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/journey')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Journey Search</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => showToast('Journey share link copied to clipboard', 'info')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share</span>
          </button>
          <button
            onClick={() => showToast('Exporting complete journey dossier (PDF/JSON)...', 'success')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Export Journey Dossier</span>
          </button>
        </div>
      </div>

      {/* Main Vehicle Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#002B49] text-white">
                TML JOURNEY
              </span>
              <span className="text-xs text-slate-400 font-mono">CROSS-MODULE SERVICE RECORD</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                {currentCase.serviceType}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-3 pt-1">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 font-mono">
                {currentCase.vehicleRegistration}
              </h1>
              <span className="text-base font-semibold text-slate-600">
                Tata Nexon EV Empowered Plus
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
              <span className="font-mono">
                VIN: <strong className="text-slate-800 font-semibold">{currentCase.vin}</strong>
              </span>
              <span>•</span>
              <span className="font-mono">
                JC: <strong className="text-blue-900 font-semibold">{currentCase.jcNumber}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building className="h-3.5 w-3.5 text-slate-400" />
                <strong className="text-slate-800 font-medium">{currentCase.dealerName}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-slate-400" />
                Customer: <strong className="text-slate-800 font-medium">{currentCase.customerName}</strong>
                <span className="text-slate-400 font-mono">({currentCase.customerMobile})</span>
              </span>
            </div>
          </div>

          {/* Status & Current Stage Badge */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Current Stage:</span>
              <span className="px-3 py-1 rounded-lg text-xs font-black bg-blue-100 text-blue-900 border border-blue-200 shadow-2xs">
                {currentCase.currentStage}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Overall Status:</span>
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                  currentCase.overallStatus === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : currentCase.overallStatus === 'DELAYED'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-blue-600 text-white shadow-xs'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {currentCase.overallStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Aggregation Banner Note */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Layers className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="font-semibold text-blue-950">
              Cross-Module Data Consolidation:
            </span>
            <span className="text-slate-500">
              Journey data aggregated across service modules (Appointment, Reception, Security, JC Creation, JC Tracking, SPD, THD, EQC, Claim, BodyShop, IRA, Closure).
            </span>
          </div>
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" /> Sync Verified
          </span>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          <StatCard
            title="Journey Started"
            value="09:05 AM"
            subtitle="Today, 30 Sep 2026"
            icon={Clock}
          />
          <StatCard
            title="Elapsed Time"
            value={currentCase.elapsedTimeFormatted}
            subtitle="Within expected SLA"
            icon={Activity}
            variant="accent"
          />
          <StatCard
            title="Current Stage"
            value={currentCase.currentStage}
            subtitle="Inspector: Amit Kumar"
            icon={Layers}
          />
          <StatCard
            title="Pending Actions"
            value={currentCase.pendingActionsCount}
            subtitle="Customer OTP approval"
            icon={AlertTriangle}
            variant={currentCase.pendingActionsCount > 0 ? 'warning' : 'default'}
            onClick={() => setActiveTab('exceptions')}
          />
          <StatCard
            title="Total Events"
            value={caseEvents.length}
            subtitle="Telemetry & operational"
            icon={Car}
            onClick={() => setActiveTab('timeline')}
          />
        </div>
      </div>

      {/* Interactive Tabs Header */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'timeline'
                ? 'border-blue-900 text-blue-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Journey Progress & Timeline</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600">
              {caseEvents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('exceptions')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'exceptions'
                ? 'border-blue-900 text-blue-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>Exceptions</span>
            {caseExceptions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
                {caseExceptions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('performance')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'performance'
                ? 'border-blue-900 text-blue-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="h-4 w-4 text-emerald-600" />
            <span>Performance & SLA</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Timeline & Stage Tracker */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          {/* Stage Progression Pipeline */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <JourneyTracker
              stages={caseStages}
              selectedStageId={selectedStage?.stageId}
              onSelectStage={handleStageSelect}
            />
          </div>

          {/* Chronological Event Timeline */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <JourneyTimeline
              events={caseEvents}
              activeStageFilter={selectedStage?.name}
              onClearStageFilter={() => setSelectedStage(null)}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Exceptions Tab */}
      {activeTab === 'exceptions' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <JourneyExceptionsTab jcNumber={currentCase.jcNumber} />
        </div>
      )}

      {/* Tab 3: Performance Tab */}
      {activeTab === 'performance' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <JourneyPerformanceTab jcNumber={currentCase.jcNumber} />
        </div>
      )}
    </div>
  );
};
