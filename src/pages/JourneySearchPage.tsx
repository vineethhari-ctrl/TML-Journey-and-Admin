import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { journeyService } from '../services/journeyService';
import { Pagination } from '../components/common/Pagination';
import {
  Search,
  Filter,
  Car,
  ChevronDown,
  Layers,
  ArrowRight,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Activity,
  FileText,
  X,
} from 'lucide-react';
import { ModuleType } from '../types';

export const JourneySearchPage: React.FC = () => {
  const { serviceCases, navigate, currentRoute } = useApp();

  const [searchBy, setSearchBy] = useState<'registration' | 'vin' | 'jc' | 'phone' | 'name'>('registration');
  const [queryInput, setQueryInput] = useState('MH01AB1234');
  const [activeQuery, setActiveQuery] = useState('MH01AB1234');

  // Advanced filters state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [zone, setZone] = useState('ALL');
  const [region, setRegion] = useState('ALL');
  const [dealer, setDealer] = useState('ALL');
  const [currentStage, setCurrentStage] = useState<ModuleType | 'ALL'>('ALL');
  const [overallStatus, setOverallStatus] = useState('ALL');
  const [inWorkshopOnly, setInWorkshopOnly] = useState(false);
  const [hasPendingActionsOnly, setHasPendingActionsOnly] = useState(false);

  // Active filter banner descriptor
  const [activeFilterLabel, setActiveFilterLabel] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // React to route query parameters from Dashboard cards
  useEffect(() => {
    if (currentRoute.includes('filter=')) {
      const param = currentRoute.split('filter=')[1]?.split('&')[0];
      if (param === 'delayed') {
        setQueryInput('');
        setActiveQuery('');
        setOverallStatus('DELAYED');
        setCurrentStage('ALL');
        setInWorkshopOnly(false);
        setHasPendingActionsOnly(false);
        setActiveFilterLabel('Delayed Journeys (TAT SLA Breached)');
        setCurrentPage(1);
      } else if (param === 'completed') {
        setQueryInput('');
        setActiveQuery('');
        setOverallStatus('COMPLETED');
        setCurrentStage('ALL');
        setInWorkshopOnly(false);
        setHasPendingActionsOnly(false);
        setActiveFilterLabel('Completed Today (Delivered to Customer)');
        setCurrentPage(1);
      } else if (param === 'in_workshop') {
        setQueryInput('');
        setActiveQuery('');
        setOverallStatus('ALL');
        setCurrentStage('ALL');
        setInWorkshopOnly(true);
        setHasPendingActionsOnly(false);
        setActiveFilterLabel('Vehicles In Workshop (Active Repair Bays: JC Tracking, SPD, THD, EQC, BodyShop)');
        setCurrentPage(1);
      } else if (param === 'pending') {
        setQueryInput('');
        setActiveQuery('');
        setOverallStatus('ALL');
        setCurrentStage('ALL');
        setInWorkshopOnly(false);
        setHasPendingActionsOnly(true);
        setActiveFilterLabel('Pending Actions (Awaiting Customer / Parts / Claim Approval)');
        setCurrentPage(1);
      } else if (param === 'active_jcs') {
        setQueryInput('');
        setActiveQuery('');
        setOverallStatus('IN PROGRESS');
        setCurrentStage('ALL');
        setInWorkshopOnly(false);
        setHasPendingActionsOnly(false);
        setActiveFilterLabel('Active Job Cards (In-Progress Repair Orders)');
        setCurrentPage(1);
      } else if (param === 'active_vehicles') {
        setQueryInput('');
        setActiveQuery('');
        setOverallStatus('ALL');
        setCurrentStage('ALL');
        setInWorkshopOnly(false);
        setHasPendingActionsOnly(false);
        setActiveFilterLabel('All Active Vehicles Across Workshop Network');
        setCurrentPage(1);
      } else if (param.startsWith('stage_')) {
        const rawStage = decodeURIComponent(param.replace('stage_', ''));
        const matched = ['JC Creation', 'JC Tracking', 'SPD', 'THD', 'EQC', 'Claim', 'BodyShop', 'IRA', 'Closure', 'Security'].find(
          (s) => s.toLowerCase() === rawStage.toLowerCase()
        ) as ModuleType | undefined;
        setQueryInput('');
        setActiveQuery('');
        setOverallStatus('ALL');
        setCurrentStage(matched || 'ALL');
        setInWorkshopOnly(false);
        setHasPendingActionsOnly(false);
        setActiveFilterLabel(`Stage Filter: ${rawStage}`);
        setCurrentPage(1);
      }
    }
  }, [currentRoute]);

  // Filtered cases
  const filteredCases = useMemo(() => {
    return journeyService.filterServiceCases(serviceCases, {
      query: activeQuery,
      searchBy,
      zone,
      region,
      dealer,
      currentStage,
      overallStatus,
      inWorkshopOnly,
      hasPendingActionsOnly,
    });
  }, [serviceCases, activeQuery, searchBy, zone, region, dealer, currentStage, overallStatus, inWorkshopOnly, hasPendingActionsOnly]);

  const totalItems = filteredCases.length;
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCases.slice(start, start + pageSize);
  }, [filteredCases, currentPage, pageSize]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setActiveQuery(queryInput);
    setActiveFilterLabel(null);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setQueryInput('');
    setActiveQuery('');
    setZone('ALL');
    setRegion('ALL');
    setDealer('ALL');
    setCurrentStage('ALL');
    setOverallStatus('ALL');
    setInWorkshopOnly(false);
    setHasPendingActionsOnly(false);
    setActiveFilterLabel(null);
    setCurrentPage(1);
    navigate('/journey');
  };

  const handleQuickPreset = (val: string) => {
    setQueryInput(val);
    setActiveQuery(val);
    setSearchBy('registration');
    setActiveFilterLabel(null);
    setInWorkshopOnly(false);
    setHasPendingActionsOnly(false);
    setCurrentStage('ALL');
    setOverallStatus('ALL');
    setCurrentPage(1);
  };

  const handleApplyPresetFilter = (type: 'all' | 'active_jcs' | 'in_workshop' | 'pending' | 'delayed' | 'completed') => {
    if (type === 'all') {
      handleReset();
    } else {
      navigate(`/journey?filter=${type}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
              Cross-Module Visibility
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-medium text-slate-500">Unified Journey Engine</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
            TML Journey
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track the complete vehicle and service journey across all service modules in real time
          </p>
        </div>

        {/* Aggregation label */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 font-medium">
          <Layers className="h-4 w-4 text-blue-600" />
          <span>Journey data aggregated from 12 service modules</span>
        </div>
      </div>

      {/* Quick Category Filter Pills with Categorical Groupings */}
      <div className="bg-slate-100/90 p-3 rounded-2xl border border-slate-200 text-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
            <Filter className="h-3.5 w-3.5 text-blue-700" />
            <span>Dashboard Filter Presets by Operational Category:</span>
          </div>
          <span className="text-[11px] text-slate-500 font-normal">
            Hierarchical subsets &amp; status flags (not mutually exclusive sums)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Group 1: Pipeline Population */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1.5">
              Pipeline:
            </span>
            <button
              onClick={() => handleApplyPresetFilter('all')}
              title="All 1,284 active vehicles currently in the network (936 JCs + 348 incoming appointments)"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                !activeFilterLabel && !overallStatus && !inWorkshopOnly && !hasPendingActionsOnly
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Car className="h-3 w-3" />
              <span>All Active (1,284)</span>
            </button>
            <button
              onClick={() => handleApplyPresetFilter('active_jcs')}
              title="936 open Job Cards (Formal repair orders opened and undergoing service)"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                overallStatus === 'IN PROGRESS' && !inWorkshopOnly
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FileText className="h-3 w-3 text-blue-600" />
              <span>Active JCs (936)</span>
            </button>
          </div>

          {/* Group 2: Physical Bay Location */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1.5">
              Location:
            </span>
            <button
              onClick={() => handleApplyPresetFilter('in_workshop')}
              title="742 of the active JCs currently occupying physical repair bays/lifts (remaining 194 are in reception/transit)"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                inWorkshopOnly
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Activity className="h-3 w-3 text-indigo-600" />
              <span>In Repair Bays (742)</span>
            </button>
          </div>

          {/* Group 3: Attention Sub-flags */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1.5">
              Attention Flags:
            </span>
            <button
              onClick={() => handleApplyPresetFilter('pending')}
              title="Sub-flag: 186 active JCs awaiting customer estimate approval, parts, or insurance clearance"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                hasPendingActionsOnly
                  ? 'bg-amber-700 text-white shadow-xs'
                  : 'text-amber-900 hover:bg-amber-50'
              }`}
            >
              <Clock className="h-3 w-3 text-amber-600" />
              <span>Pending Action (186)</span>
            </button>
            <button
              onClick={() => handleApplyPresetFilter('delayed')}
              title="Sub-flag: 42 active JCs with turnaround time (TAT) SLA breached > 4 hours"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                overallStatus === 'DELAYED'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'text-rose-900 hover:bg-rose-50'
              }`}
            >
              <AlertTriangle className="h-3 w-3 text-rose-600" />
              <span>Delayed TAT (42)</span>
            </button>
          </div>

          {/* Group 4: Historical Exited Pipeline */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1.5">
              Exited:
            </span>
            <button
              onClick={() => handleApplyPresetFilter('completed')}
              title="518 jobs completed, invoiced, and handed over to customers today (already exited active pipeline)"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                overallStatus === 'COMPLETED'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-emerald-900 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              <span>Completed Today (518)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Filter Notification Bar */}
      {activeFilterLabel && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-900 text-xs shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <span className="p-1 rounded-md bg-blue-200/80 text-blue-900">
              <Filter className="h-3.5 w-3.5" />
            </span>
            <div>
              <span className="font-semibold text-slate-600">Active Metric Filter: </span>
              <strong className="text-blue-950 font-bold">{activeFilterLabel}</strong>
              <span className="text-blue-700 ml-2 font-mono font-medium">({filteredCases.length} records found)</span>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white border border-blue-300 text-blue-900 font-bold hover:bg-blue-100 text-xs transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
            <span>Clear Filter</span>
          </button>
        </div>
      )}

      {/* Main Search Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col md:flex-row items-stretch gap-3">
            {/* Search By dropdown */}
            <div className="w-full md:w-56 shrink-0">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Search By:
              </label>
              <div className="relative">
                <select
                  value={searchBy}
                  onChange={(e) => setSearchBy(e.target.value as typeof searchBy)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden cursor-pointer"
                >
                  <option value="registration">Vehicle Registration</option>
                  <option value="vin">VIN / Chassis Number</option>
                  <option value="jc">JC Number</option>
                  <option value="phone">Customer Mobile Number</option>
                  <option value="name">Customer Name</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Query input */}
            <div className="flex-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Query Value:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="Enter e.g. MH01AB1234, JC20260930001234..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pl-10 text-xs font-mono font-medium text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
                />
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-end gap-2 shrink-0">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  showAdvanced
                    ? 'border-blue-300 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                <span>Filters</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                title="Reset filters"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-blue-500" /> Quick Demos:
            </span>
            <button
              type="button"
              onClick={() => handleQuickPreset('MH01AB1234')}
              className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-blue-100/70 text-blue-800 hover:bg-blue-200 transition-colors cursor-pointer"
            >
              MH01AB1234 (Demo EV)
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset('MH02CR9910')}
              className="px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              MH02CR9910 (Harrier)
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset('DL08BV4412')}
              className="px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              DL08BV4412 (Safari)
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-2 py-0.5 rounded-md text-[11px] text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
            >
              Clear & View All (30+)
            </button>
          </div>

          {/* Advanced Filter Collapse */}
          {showAdvanced && (
            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs animate-in fade-in duration-150">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Zone
                </label>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:outline-hidden"
                >
                  <option value="ALL">All Zones</option>
                  <option value="West">West</option>
                  <option value="North">North</option>
                  <option value="South">South</option>
                  <option value="East">East</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Region
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:outline-hidden"
                >
                  <option value="ALL">All Regions</option>
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="NCR">NCR</option>
                  <option value="Karnataka">Karnataka</option>
                  <option value="Tamil Nadu">Tamil Nadu</option>
                  <option value="Telangana">Telangana</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Current Stage
                </label>
                <select
                  value={currentStage}
                  onChange={(e) => setCurrentStage(e.target.value as ModuleType | 'ALL')}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:outline-hidden"
                >
                  <option value="ALL">All Stages</option>
                  <option value="JC Creation">JC Creation</option>
                  <option value="JC Tracking">JC Tracking</option>
                  <option value="SPD">SPD</option>
                  <option value="THD">THD</option>
                  <option value="EQC">EQC</option>
                  <option value="Claim">Claim</option>
                  <option value="BodyShop">BodyShop</option>
                  <option value="IRA">IRA</option>
                  <option value="Closure">Closure</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Journey Status
                </label>
                <select
                  value={overallStatus}
                  onChange={(e) => setOverallStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:outline-hidden"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="IN PROGRESS">IN PROGRESS</option>
                  <option value="DELAYED">DELAYED</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="BLOCKED">BLOCKED</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Dealer
                </label>
                <select
                  value={dealer}
                  onChange={(e) => setDealer(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:outline-hidden"
                >
                  <option value="ALL">All Dealers</option>
                  <option value="Andheri">Tata Motors - Andheri</option>
                  <option value="Fortune">Fortune Motors Worli</option>
                  <option value="Garve">Garve Tata Shivajinagar</option>
                  <option value="Jaika">Jaika Motors Sadar</option>
                  <option value="KHT">KHT Motors Whitefield</option>
                </select>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Matching Vehicles & Service Cases ({totalItems})
          </h2>
          <p className="text-xs text-slate-500">
            Click &quot;View Journey&quot; to inspect full cross-module progression and chronological events
          </p>
        </div>
      </div>

      {/* Result Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">JC Number</th>
                <th className="py-3 px-4">Dealer & Workshop</th>
                <th className="py-3 px-4">Current Stage</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Updated</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Car className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-semibold text-slate-700">No matching journey records found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try resetting filters or searching with another registration or JC number
                    </p>
                    <button
                      onClick={handleReset}
                      className="mt-4 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedCases.map((c) => {
                  const isDemo = c.vehicleRegistration === 'MH01AB1234';
                  return (
                    <tr
                      key={c.jcNumber}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isDemo ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900">
                                {c.vehicleRegistration}
                              </span>
                              {isDemo && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                                  DEMO
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {c.vin}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-semibold text-slate-900">{c.customerName}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{c.customerMobile}</p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-blue-900">
                        {c.jcNumber}
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-medium text-slate-800">{c.dealerName}</p>
                          <p className="text-[11px] text-slate-400">
                            {c.zone} Zone • {c.region}
                          </p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                            {c.currentStage}
                          </span>
                          {c.pendingActionsCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <Clock className="h-2.5 w-2.5" />
                              {c.pendingActionsCount} pending
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            c.overallStatus === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : c.overallStatus === 'DELAYED'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : c.overallStatus === 'BLOCKED'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-blue-100 text-blue-800 border border-blue-300'
                          }`}
                        >
                          {c.overallStatus}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        <div>
                          <span>{c.createdAt.split(' ')[1]}</span>
                          <p className="text-[10px] text-slate-400">{c.elapsedTimeFormatted} elapsed</p>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => navigate(`/journey/${c.jcNumber}`)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          <span>View Journey</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="p-4 border-t border-slate-100">
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    </div>
  );
};
