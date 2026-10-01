import React, { useState, useEffect, useMemo } from 'react';
import {
  rulesEngineService,
  ABExperiment,
  ExperimentVariant,
  ExperimentStatus,
  DealerTargetModule,
  ExperimentVariantAnalysis,
  ApiVersionRelease,
} from '../../services/rulesEngineService';
import {
  Split,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Plus,
  Trash2,
  Target,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  ExternalLink,
  Sliders,
  Car,
  Award,
} from 'lucide-react';

interface ABTestingConsoleProps {
  onNavigateToPreview?: (module: DealerTargetModule) => void;
}

export const ABTestingConsole: React.FC<ABTestingConsoleProps> = ({ onNavigateToPreview }) => {
  const [experiments, setExperiments] = useState<ABExperiment[]>(() =>
    rulesEngineService.getAllExperiments()
  );
  const [releases, setReleases] = useState<ApiVersionRelease[]>(() =>
    rulesEngineService.getAllApiVersions()
  );
  const [selectedExperimentId, setSelectedExperimentId] = useState<string>(
    experiments[0]?.id || ''
  );
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Experiment Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExpName, setNewExpName] = useState('');
  const [newExpDesc, setNewExpDesc] = useState('');
  const [newExpModule, setNewExpModule] = useState<DealerTargetModule | 'all'>('all');
  const [newExpControlVersion, setNewExpControlVersion] = useState(
    rulesEngineService.getActiveApiVersion().version
  );
  const [newExpVariantVersion, setNewExpVariantVersion] = useState(
    releases.find((r) => r.version !== rulesEngineService.getActiveApiVersion().version)?.version || ''
  );
  const [newExpTrafficSplit, setNewExpTrafficSplit] = useState(50);
  const [newExpSelectedRegions, setNewExpSelectedRegions] = useState<string[]>(['West', 'North']);
  const [newExpSelectedFuels, setNewExpSelectedFuels] = useState<string[]>(['EV']);
  const [newExpStartImmediately, setNewExpStartImmediately] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);

  // Conclude Modal State
  const [showConcludeModal, setShowConcludeModal] = useState(false);
  const [concludeWinner, setConcludeWinner] = useState<ExperimentVariant>('B');
  const [concludeDeployToActive, setConcludeDeployToActive] = useState(true);
  const [concludeNotes, setConcludeNotes] = useState('');

  // Live Allocation Tester State
  const [testSubjectKey, setTestSubjectKey] = useState('DLR-MUMBAI-01');

  // Sync state when rulesEngineService updates
  useEffect(() => {
    const unsub = rulesEngineService.subscribe(() => {
      setExperiments(rulesEngineService.getAllExperiments());
      setReleases(rulesEngineService.getAllApiVersions());
    });
    return unsub;
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3500);
  };

  const selectedExperiment =
    experiments.find((e) => e.id === selectedExperimentId) || experiments[0];

  const analysis: ExperimentVariantAnalysis | null = useMemo(() => {
    if (!selectedExperiment) return null;
    return rulesEngineService.compareExperimentVariants(selectedExperiment.id);
  }, [selectedExperiment, experiments]);

  const filteredExperiments = useMemo(() => {
    return experiments.filter((exp) => {
      if (statusFilter !== 'ALL' && exp.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          exp.name.toLowerCase().includes(q) ||
          exp.id.toLowerCase().includes(q) ||
          exp.controlVersion.toLowerCase().includes(q) ||
          exp.variantVersion.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [experiments, statusFilter, searchQuery]);

  // Handle Lifecycle actions
  const handleToggleStatus = (exp: ABExperiment) => {
    if (exp.status === 'RUNNING') {
      rulesEngineService.pauseExperiment(exp.id);
      showToast(`Experiment "${exp.name}" paused.`);
    } else if (exp.status === 'PAUSED' || exp.status === 'DRAFT') {
      rulesEngineService.startExperiment(exp.id);
      showToast(`Experiment "${exp.name}" is now live and serving split traffic.`);
    }
  };

  const handleDelete = (expId: string) => {
    if (confirm('Are you sure you want to delete this experiment?')) {
      rulesEngineService.deleteExperiment(expId);
      showToast('Experiment deleted.');
      if (selectedExperimentId === expId) {
        setSelectedExperimentId(experiments.find((e) => e.id !== expId)?.id || '');
      }
    }
  };

  const handleOpenConcludeModal = () => {
    if (!selectedExperiment) return;
    setConcludeWinner(analysis?.recommendedWinner === 'A' ? 'A' : 'B');
    setConcludeDeployToActive(true);
    setConcludeNotes(analysis?.recommendationReason || '');
    setShowConcludeModal(true);
  };

  const handleConfirmConclude = () => {
    if (!selectedExperiment) return;
    const res = rulesEngineService.concludeExperiment(
      selectedExperiment.id,
      concludeWinner,
      concludeDeployToActive,
      concludeNotes,
      'TML-SYSTEM-ADMIN'
    );
    setShowConcludeModal(false);
    showToast(res.message);
  };

  // Simulate Telemetry Traffic
  const handleSimulateTraffic = (count: number = 10) => {
    if (!selectedExperiment || selectedExperiment.status !== 'RUNNING') {
      showToast('Pilot must be RUNNING to record telemetry traffic.');
      return;
    }
    for (let i = 0; i < count; i++) {
      const dealerKey = `DLR-SIM-${Math.floor(Math.random() * 50)}`;
      const assigned = rulesEngineService.assignVariant(selectedExperiment, dealerKey);
      rulesEngineService.recordExperimentMetric(selectedExperiment.id, assigned, 'impression');
      // 90% chance of successful form submission
      if (Math.random() < 0.9) {
        const durationSec = Math.floor(30 + Math.random() * 40);
        rulesEngineService.recordExperimentMetric(
          selectedExperiment.id,
          assigned,
          'submission',
          durationSec
        );
      } else {
        rulesEngineService.recordExperimentMetric(selectedExperiment.id, assigned, 'error');
      }
    }
    showToast(`Simulated ${count} randomized dealer impressions & submissions.`);
  };

  // Handle Create Experiment
  const handleCreateExperiment = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newExpName.trim()) {
      setCreateError('Experiment name is required.');
      return;
    }
    if (newExpControlVersion === newExpVariantVersion) {
      setCreateError('Control Version (A) and Variant Version (B) must be different.');
      return;
    }

    const res = rulesEngineService.createExperiment({
      name: newExpName.trim(),
      description: newExpDesc.trim(),
      targetModule: newExpModule,
      status: newExpStartImmediately ? 'RUNNING' : 'DRAFT',
      controlVersion: newExpControlVersion,
      variantVersion: newExpVariantVersion,
      trafficSplitPercentB: newExpTrafficSplit,
      targeting: {
        regions: newExpSelectedRegions,
        fuelTypes: newExpSelectedFuels,
      },
      createdBy: 'TML-RULES-ADMIN',
    });

    if (!res.success) {
      setCreateError(res.error || 'Failed to create experiment.');
      return;
    }

    setShowCreateModal(false);
    setNewExpName('');
    setNewExpDesc('');
    setSelectedExperimentId(res.experiment?.id || '');
    showToast(
      `Experiment "${res.experiment?.name}" created ${
        newExpStartImmediately ? 'and launched live!' : 'as Draft.'
      }`
    );
  };

  // Test subject assignment
  const simulatedAssignment = selectedExperiment
    ? rulesEngineService.assignVariant(selectedExperiment, testSubjectKey)
    : 'A';

  // Overall KPI calculation
  const totalImpressions = experiments.reduce(
    (acc, e) => acc + (e.metrics.impressionsA || 0) + (e.metrics.impressionsB || 0),
    0
  );
  const totalSubmissions = experiments.reduce(
    (acc, e) => acc + (e.metrics.submissionsA || 0) + (e.metrics.submissionsB || 0),
    0
  );
  const overallConversion =
    totalImpressions > 0 ? ((totalSubmissions / totalImpressions) * 100).toFixed(1) : '0.0';
  const runningCount = experiments.filter((e) => e.status === 'RUNNING').length;

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2 text-xs font-semibold animate-fade-in">
          <Zap className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner & KPIs */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 rounded-2xl p-5 text-white border border-indigo-900/50 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-800/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/30 border border-indigo-400/30 text-indigo-300">
              <Split className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold tracking-tight text-white">
                  A/B Testing &amp; Progressive Deployment Engine
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                  Zero-Downtime Rollout
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Safely pilot dynamic field configurations and validation rule changes on targeted dealer cohorts before PAN-India rollout.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer border border-indigo-400/40"
          >
            <Plus className="h-4 w-4" />
            <span>New A/B Pilot</span>
          </button>
        </div>

        {/* 4 Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="bg-slate-900/60 rounded-xl p-3 border border-indigo-900/40">
            <span className="text-indigo-300 font-medium text-[11px] block">Active Pilots</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white">{runningCount}</span>
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1" />
                Live in Bays
              </span>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-xl p-3 border border-indigo-900/40">
            <span className="text-indigo-300 font-medium text-[11px] block">Test Cohort Impressions</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white">{totalImpressions.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400">Recorded</span>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-xl p-3 border border-indigo-900/40">
            <span className="text-indigo-300 font-medium text-[11px] block">Form Completion Rate</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-emerald-400">{overallConversion}%</span>
              <span className="text-[10px] text-slate-400">Telemetry Verified</span>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-xl p-3 border border-indigo-900/40">
            <span className="text-indigo-300 font-medium text-[11px] block">Registered API Releases</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white">{releases.length}</span>
              <span className="text-[10px] text-indigo-300">Active: {rulesEngineService.getActiveApiVersion().version}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dual-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Experiments Registry List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Target className="h-4 w-4 text-indigo-600" />
                <span>Pilot Experiments</span>
              </span>
              <span className="text-[11px] font-mono text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full">
                {filteredExperiments.length}
              </span>
            </div>

            {/* Search and Filters */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search experiments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1 flex-wrap text-[11px]">
                {(['ALL', 'RUNNING', 'PAUSED', 'CONCLUDED', 'DRAFT'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                      statusFilter === st
                        ? 'bg-indigo-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
              {filteredExperiments.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No experiments match the filter.
                </div>
              ) : (
                filteredExperiments.map((exp) => {
                  const isSelected = exp.id === selectedExperiment?.id;
                  const totalImp = exp.metrics.impressionsA + exp.metrics.impressionsB;
                  const statusColors: Record<ExperimentStatus, string> = {
                    RUNNING: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                    PAUSED: 'bg-amber-100 text-amber-800 border-amber-300',
                    CONCLUDED: 'bg-blue-100 text-blue-800 border-blue-300',
                    DRAFT: 'bg-slate-100 text-slate-700 border-slate-300',
                  };

                  return (
                    <div
                      key={exp.id}
                      onClick={() => setSelectedExperimentId(exp.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all space-y-2 ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 shadow-xs ring-1 ring-indigo-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[10px] font-bold text-slate-500">
                              {exp.id}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                                statusColors[exp.status]
                              }`}
                            >
                              {exp.status}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 mt-0.5 leading-snug">
                            {exp.name}
                          </h4>
                        </div>
                      </div>

                      {/* Versions & Split Bar */}
                      <div className="space-y-1 bg-white/70 p-2 rounded-lg border border-slate-200/60">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-600 font-medium">
                            <span className="font-bold text-slate-900">A:</span> {exp.controlVersion}
                          </span>
                          <span className="text-slate-400 font-mono text-[10px]">vs</span>
                          <span className="text-indigo-700 font-medium">
                            <span className="font-bold text-indigo-900">B:</span> {exp.variantVersion}
                          </span>
                        </div>

                        {/* Split Bar */}
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
                          <div
                            className="bg-slate-500 h-full"
                            style={{ width: `${100 - exp.trafficSplitPercentB}%` }}
                            title={`Control A: ${100 - exp.trafficSplitPercentB}%`}
                          />
                          <div
                            className="bg-indigo-600 h-full"
                            style={{ width: `${exp.trafficSplitPercentB}%` }}
                            title={`Challenger B: ${exp.trafficSplitPercentB}%`}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                          <span>{100 - exp.trafficSplitPercentB}% / {exp.trafficSplitPercentB}% Split</span>
                          <span>{totalImp} impressions</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Active Experiment Detail, Side-by-Side Comparison & Decisioning */}
        <div className="lg:col-span-8 space-y-4">
          {selectedExperiment && analysis ? (
            <div className="space-y-4">
              {/* Experiment Overview Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {selectedExperiment.id}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-[11px] font-semibold text-indigo-700 capitalize">
                        Target Module: {selectedExperiment.targetModule.replace('_', ' ')}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-[11px] text-slate-500">
                        Started: {selectedExperiment.startDate}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                      {selectedExperiment.name}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                      {selectedExperiment.description}
                    </p>
                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedExperiment.status === 'RUNNING' && (
                      <button
                        onClick={() => handleToggleStatus(selectedExperiment)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        <span>Pause Pilot</span>
                      </button>
                    )}

                    {(selectedExperiment.status === 'PAUSED' || selectedExperiment.status === 'DRAFT') && (
                      <button
                        onClick={() => handleToggleStatus(selectedExperiment)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer transition-colors"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>Launch Pilot</span>
                      </button>
                    )}

                    {selectedExperiment.status !== 'CONCLUDED' && (
                      <button
                        onClick={handleOpenConcludeModal}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-900 hover:bg-indigo-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                      >
                        <Award className="h-3.5 w-3.5 text-amber-300" />
                        <span>Conclude &amp; Promote Winner</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleSimulateTraffic(10)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                      title="Inject 10 simulated dealer telemetry transactions to test analytics"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-indigo-600" />
                      <span>+10 Telemetry Events</span>
                    </button>

                    {selectedExperiment.status !== 'RUNNING' && (
                      <button
                        onClick={() => handleDelete(selectedExperiment.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete experiment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Targeting Criteria Chips */}
                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
                  <span className="font-semibold text-slate-800 text-[11px]">Pilot Cohort Scope:</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                    Regions: {selectedExperiment.targeting?.regions?.join(', ') || 'All Regions'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                    Fuels: {selectedExperiment.targeting?.fuelTypes?.join(', ') || 'All Powertrains'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 text-[11px] font-semibold border border-indigo-200">
                    Traffic Split: {100 - selectedExperiment.trafficSplitPercentB}% Control A / {selectedExperiment.trafficSplitPercentB}% Challenger B
                  </span>
                </div>
              </div>

              {/* Side-by-Side Variant Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Variant A: Control */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-black text-xs">
                        A
                      </span>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">
                          Control Baseline ({analysis.variantA.version})
                        </h4>
                        <span className="text-[10px] text-slate-400">Production Baseline Schema</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {analysis.variantA.ruleCount} Fields
                    </span>
                  </div>

                  {/* Variant A Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-500 block">Impressions</span>
                      <span className="font-black text-slate-900 text-sm">
                        {analysis.variantA.impressions}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-500 block">Submissions</span>
                      <span className="font-black text-slate-900 text-sm">
                        {analysis.variantA.submissions}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-500 block">Completion %</span>
                      <span className="font-black text-slate-900 text-sm">
                        {analysis.variantA.submissionRatePercent}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span>Validation Error Rate: {analysis.variantA.errorRatePercent}%</span>
                    <span>Avg Duration: {analysis.variantA.avgDurationSeconds}s</span>
                  </div>
                </div>

                {/* Variant B: Challenger */}
                <div className="bg-white rounded-2xl border-2 border-indigo-500/80 p-4 shadow-xs space-y-3 bg-indigo-50/20">
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                        B
                      </span>
                      <div>
                        <h4 className="font-bold text-indigo-950 text-xs">
                          Challenger Variant ({analysis.variantB.version})
                        </h4>
                        <span className="text-[10px] text-indigo-600 font-semibold">Candidate Release</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded">
                      {analysis.variantB.ruleCount} Fields
                    </span>
                  </div>

                  {/* Variant B Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-indigo-50/60 p-2 rounded-lg border border-indigo-100">
                      <span className="text-[10px] text-indigo-700 block">Impressions</span>
                      <span className="font-black text-indigo-950 text-sm">
                        {analysis.variantB.impressions}
                      </span>
                    </div>
                    <div className="bg-indigo-50/60 p-2 rounded-lg border border-indigo-100">
                      <span className="text-[10px] text-indigo-700 block">Submissions</span>
                      <span className="font-black text-indigo-950 text-sm">
                        {analysis.variantB.submissions}
                      </span>
                    </div>
                    <div className="bg-indigo-50/60 p-2 rounded-lg border border-indigo-100">
                      <span className="text-[10px] text-indigo-700 block">Completion %</span>
                      <span className="font-black text-emerald-600 text-sm flex items-center justify-center gap-0.5">
                        {analysis.variantB.submissionRatePercent}%
                        {analysis.variantB.submissionRatePercent >= analysis.variantA.submissionRatePercent && (
                          <TrendingUp className="h-3 w-3" />
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-indigo-800 px-1">
                    <span>Validation Error Rate: {analysis.variantB.errorRatePercent}%</span>
                    <span>Avg Duration: {analysis.variantB.avgDurationSeconds}s</span>
                  </div>
                </div>
              </div>

              {/* Statistical Recommendation & Winner Decision Engine */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Rollout Intelligence Recommendation
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 font-mono font-bold">
                          Confidence: {analysis.confidenceScore}%
                        </span>
                      </div>
                      <p className="text-xs text-indigo-100 mt-1 leading-relaxed">
                        {analysis.recommendationReason}
                      </p>
                    </div>
                  </div>

                  {selectedExperiment.status !== 'CONCLUDED' && (
                    <button
                      onClick={handleOpenConcludeModal}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="h-4 w-4" />
                      <span>Promote Winner to Active Pan-India</span>
                    </button>
                  )}
                </div>

                {/* Diff Summary Badges */}
                <div className="border-t border-indigo-900/60 pt-2.5 flex items-center gap-3 text-xs flex-wrap">
                  <span className="text-[11px] text-indigo-300 font-semibold">Schema Delta vs Baseline:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/50 text-[11px]">
                    +{analysis.diffSummary.fieldsAdded.length} Fields Added: {analysis.diffSummary.fieldsAdded.join(', ') || 'None'}
                  </span>
                  {analysis.diffSummary.fieldsModified.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/50 text-[11px]">
                      {analysis.diffSummary.fieldsModified.length} Rules Modified: {analysis.diffSummary.fieldsModified.join(', ')}
                    </span>
                  )}
                  {analysis.diffSummary.breakingChangesCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/50 text-[11px]">
                      ⚠️ {analysis.diffSummary.breakingChangesCount} Breaking Rules (Automated Fallbacks Active)
                    </span>
                  )}
                </div>
              </div>

              {/* Interactive Deterministic Allocation Simulator */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-indigo-600" />
                    <h4 className="font-bold text-xs text-slate-900">
                      Live Cohort Variant Allocation Tester
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Deterministic polynomial hashing guarantees sticky variant experience
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={testSubjectKey}
                      onChange={(e) => setTestSubjectKey(e.target.value)}
                      placeholder="Enter Dealer Code (e.g. DLR-MUM-01) or VIN..."
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Assigned Cohort:</span>
                    <span
                      className={`px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 ${
                        simulatedAssignment === 'B'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-800 text-white'
                      }`}
                    >
                      Variant {simulatedAssignment} (
                      {simulatedAssignment === 'B'
                        ? selectedExperiment.variantVersion
                        : selectedExperiment.controlVersion}
                      )
                    </span>
                  </div>

                  {onNavigateToPreview && (
                    <button
                      onClick={() => onNavigateToPreview(selectedExperiment.targetModule === 'all' ? 'vehicle_journey' : selectedExperiment.targetModule)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-indigo-700 text-xs font-bold cursor-pointer transition-colors"
                    >
                      <span>Simulate in App</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              Select or create an A/B testing experiment to view variant analytics.
            </div>
          )}
        </div>
      </div>

      {/* CREATE EXPERIMENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 text-xs space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
                  <Split className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Create New Rules A/B Pilot
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure a controlled variant rollout to dealer cohorts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {createError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateExperiment} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Pilot Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EV High-Voltage Insulation Check Pilot"
                  value={newExpName}
                  onChange={(e) => setNewExpName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Executive Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Objective and expected impact on workshop compliance..."
                  value={newExpDesc}
                  onChange={(e) => setNewExpDesc(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Control Variant A (Baseline) *
                  </label>
                  <select
                    value={newExpControlVersion}
                    onChange={(e) => setNewExpControlVersion(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:border-indigo-500 font-mono"
                  >
                    {releases.map((r) => (
                      <option key={r.version} value={r.version}>
                        {r.version} ({r.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Challenger Variant B *
                  </label>
                  <select
                    value={newExpVariantVersion}
                    onChange={(e) => setNewExpVariantVersion(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:border-indigo-500 font-mono"
                  >
                    {releases.map((r) => (
                      <option key={r.version} value={r.version}>
                        {r.version} ({r.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1">
                  <span>Challenger Traffic Allocation:</span>
                  <span className="font-mono text-indigo-700 font-bold">{newExpTrafficSplit}% to Variant B</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="95"
                  step="5"
                  value={newExpTrafficSplit}
                  onChange={(e) => setNewExpTrafficSplit(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>Control A: {100 - newExpTrafficSplit}%</span>
                  <span>Challenger B: {newExpTrafficSplit}%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Target Module
                  </label>
                  <select
                    value={newExpModule}
                    onChange={(e) => setNewExpModule(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:border-indigo-500 capitalize"
                  >
                    <option value="all">All Workshop Modules</option>
                    <option value="vehicle_journey">Vehicle Journey</option>
                    <option value="job_card">Job Card</option>
                    <option value="workshop_floor">Workshop Floor</option>
                    <option value="reception">Reception Gate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Target Powertrains
                  </label>
                  <div className="flex items-center gap-2 pt-1.5">
                    {['EV', 'CNG', 'Diesel', 'Petrol'].map((fuel) => (
                      <label key={fuel} className="flex items-center gap-1 text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newExpSelectedFuels.includes(fuel)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewExpSelectedFuels([...newExpSelectedFuels, fuel]);
                            } else {
                              setNewExpSelectedFuels(newExpSelectedFuels.filter((f) => f !== fuel));
                            }
                          }}
                          className="accent-indigo-600 rounded"
                        />
                        <span>{fuel}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-semibold text-[11px]">
                  <input
                    type="checkbox"
                    checked={newExpStartImmediately}
                    onChange={(e) => setNewExpStartImmediately(e.target.checked)}
                    className="accent-indigo-600 rounded"
                  />
                  <span>Start serving traffic immediately upon creation</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer shadow-xs"
                  >
                    Create Pilot
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONCLUDE & DEPLOY MODAL */}
      {showConcludeModal && selectedExperiment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 text-xs space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                  <Award className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Conclude A/B Pilot &amp; Pick Winner
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ratify pilot results and optionally promote winner to Production
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConcludeModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Select Winning Variant:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConcludeWinner('A')}
                    className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                      concludeWinner === 'A'
                        ? 'border-slate-800 bg-slate-900 text-white font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block text-xs">Variant A (Control)</span>
                    <span className="text-[10px] opacity-80 font-mono">{selectedExperiment.controlVersion}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConcludeWinner('B')}
                    className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                      concludeWinner === 'B'
                        ? 'border-indigo-600 bg-indigo-600 text-white font-bold'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block text-xs">Variant B (Challenger)</span>
                    <span className="text-[10px] opacity-80 font-mono">{selectedExperiment.variantVersion}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Decision Notes &amp; Audit Trail
                </label>
                <textarea
                  rows={2}
                  value={concludeNotes}
                  onChange={(e) => setConcludeNotes(e.target.value)}
                  placeholder="e.g. Challenger demonstrated 95% compliance on high-voltage checks..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-emerald-950 text-xs">
                  <input
                    type="checkbox"
                    checked={concludeDeployToActive}
                    onChange={(e) => setConcludeDeployToActive(e.target.checked)}
                    className="accent-emerald-600 rounded"
                  />
                  <span>Promote winning version to ACTIVE pan-India immediately</span>
                </label>
                <p className="text-[10px] text-emerald-800/80 pl-5">
                  Hot-reloads the Dealer Application with zero disruption or manual server restarting.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConcludeModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmConclude}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shadow-xs"
                >
                  Confirm &amp; Ratify
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
