import React, { useState, useMemo } from 'react';
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
  Sparkles,
  Database,
  Sliders,
  Settings,
  ExternalLink,
  ChevronRight,
  Info,
  Zap,
  Link2,
} from 'lucide-react';
import { MasterFieldDef } from '../data/masterCatalogue';
import { DynamicFieldRenderer } from '../components/common/DynamicFieldRenderer';
import { MaskedName, MaskedPhone } from '../components/dpdp/MaskedPii';
import { useDpdp } from '../hooks/useDpdp';
import { sanitizeForExport } from '../utils/dpdp';
import { buildIdChain } from '../utils/jcIdChain';
import { IdChainStrip, JourneyIdChain } from '../components/journey/JourneyIdChain';
import { CustomerCategoryBadge } from '../components/fleet/CustomerCategoryBadge';
import { useFleetRegister } from '../data/fleetRegister';
import { classifyVehicle } from '../utils/fleetRegister';

interface JourneyDetailPageProps {
  jcNumber?: string;
}

export const JourneyDetailPage: React.FC<JourneyDetailPageProps> = ({ jcNumber = 'JC20260930001234' }) => {
  const { serviceCases, navigate } = useApp();
  const exists = serviceCases.some((c) => c.jcNumber === jcNumber);

  if (!exists) {
    const suggestions = serviceCases
      .filter((c) => c.jcNumber.includes(jcNumber.slice(-4)) || c.vehicleRegistration.toLowerCase() === jcNumber.toLowerCase())
      .slice(0, 5);
    return (
      <div className="max-w-lg mx-auto my-12 bg-white rounded-2xl border border-amber-200 p-8 shadow-xs text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Job Card not found</h2>
          <p className="text-xs text-slate-500 mt-1">
            No service case matches <span className="font-mono font-bold text-slate-800">{jcNumber}</span>.
          </p>
        </div>
        {suggestions.length > 0 && (
          <div className="text-left space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Did you mean</p>
            {suggestions.map((c) => (
              <button
                key={c.jcNumber}
                onClick={() => navigate(`/journey/${c.jcNumber}`)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-xs cursor-pointer"
              >
                <span className="font-mono font-bold text-blue-900">{c.jcNumber}</span>
                <span className="text-slate-500">{c.vehicleRegistration} • {c.currentStage}</span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => navigate(`/journey?search=${encodeURIComponent(jcNumber)}`)}
          className="px-4 py-2 bg-blue-900 text-white rounded-lg text-xs font-bold hover:bg-blue-800 transition-colors cursor-pointer"
        >
          Search journeys for "{jcNumber}"
        </button>
      </div>
    );
  }

  // Keyed by JC so tab / selection state resets when switching between vehicles
  return <JourneyDetailContent key={jcNumber} jcNumber={jcNumber} />;
};

const formatClock = (dateTime: string) => {
  const [datePart, timePart = '00:00'] = dateTime.split(' ');
  const [h, m] = timePart.split(':').map(Number);
  const [y, mo, d] = datePart.split('-').map(Number);
  const dt = new Date(y, (mo || 1) - 1, d || 1, h || 0, m || 0);
  return {
    time: dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    date: dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
  };
};

const JourneyDetailContent: React.FC<{ jcNumber: string }> = ({ jcNumber }) => {
  const { serviceCases, stages, events, exceptions, navigate, showToast, masterConfigs, vehicles } = useApp();
  const { canExportPlainPii } = useDpdp();

  const [activeTab, setActiveTab] = useState<'timeline' | 'id_chain' | 'exceptions' | 'performance' | 'master_mapping' | 'rules_engine'>('timeline');
  const [selectedStage, setSelectedStage] = useState<JourneyStage | null>(null);

  // Dynamic Custom Field Values managed by Rules Engine
  const [dynamicValues, setDynamicValues] = useState<Record<string, any>>({
    ev_battery_health_soh: 94.5,
    ev_battery_serial_no: 'TATA-EV-BAT-NEX09482',
    extended_warranty_tier: 'PLATINUM',
    telematics_ota_status: 'OTA_ACTIVE',
    fastag_rfid_serial: '6001019283746501',
    insurance_claim_number: '',
  });

  // Local simulated override for testing mapping changes live
  const [simulatedOverrides, setSimulatedOverrides] = useState<Record<string, string>>({});

  // Find target case or fallback to first
  const currentCase = serviceCases.find((c) => c.jcNumber === jcNumber) || serviceCases[0];
  const started = formatClock(currentCase.createdAt);
  const matchingVehicle = useMemo(() => {
    return vehicles.find(
      (v) => v.vehicleId === currentCase.vehicleId || v.vin === currentCase.vin || v.registrationNumber === currentCase.vehicleRegistration
    );
  }, [vehicles, currentCase]);

  const caseStages = stages[currentCase.jcNumber] || [];
  const caseEvents = events[currentCase.jcNumber] || [];
  const caseExceptions = exceptions.filter((e) => e.jcNumber === currentCase.jcNumber);
  const idChain = useMemo(() => buildIdChain(currentCase, caseStages), [currentCase, caseStages]);
  const { vehicles: fleetVehicles } = useFleetRegister();
  const activeStage =
    caseStages.find((s) => s.status === 'IN PROGRESS' || s.status === 'BLOCKED') ||
    caseStages.find((s) => s.module === currentCase.currentStage);

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/journey/${currentCase.jcNumber}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Journey link copied to clipboard', 'success');
    } catch {
      window.prompt('Copy this journey link:', url);
    }
  };

  const handleExportDossier = () => {
    // DPDP: customer details are masked unless the user holds the supervisor export permission
    const [serviceCase] = sanitizeForExport([currentCase], { customerName: 'name', customerMobile: 'phone' }, canExportPlainPii);
    const vehicle = matchingVehicle
      ? sanitizeForExport([matchingVehicle], { customerName: 'name', customerMobile: 'phone', customerEmail: 'email' }, canExportPlainPii)[0]
      : null;
    const dossier = {
      exportedAt: new Date().toISOString(),
      piiMasked: !canExportPlainPii,
      serviceCase,
      vehicle,
      stages: caseStages,
      events: caseEvents,
      exceptions: caseExceptions,
      customerCategory: classifyVehicle(currentCase.vin, fleetVehicles).category,
      idChain,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `TML_Journey_${currentCase.jcNumber}_${currentCase.vehicleRegistration}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Journey dossier exported (${caseStages.length} stages, ${caseEvents.length} events)${canExportPlainPii ? '' : ', customer details masked'}`, 'success');
  };

  const handleStageSelect = (stage: JourneyStage) => {
    setSelectedStage((prev) => (prev?.stageId === stage.stageId ? null : stage));
  };

  // Dynamic evaluation context for rules engine based on real active case
  const vehicleContext = useMemo(() => {
    const modelName = matchingVehicle?.model || 'Nexon EV Empowered+';
    const isEv = matchingVehicle?.fuelType === 'EV' || modelName.toLowerCase().includes('ev');
    return {
      fuel_type: isEv ? 'EV' : (matchingVehicle?.fuelType || 'DIESEL'),
      fuelType: isEv ? 'EV' : (matchingVehicle?.fuelType || 'DIESEL'),
      isEvVehicle: isEv,
      model: modelName,
      serviceType: currentCase.serviceType || 'Periodic Maintenance',
      isInsuranceClaim: currentCase.serviceType?.toLowerCase().includes('accident') ?? false,
      hasConnectedTelematics: true,
      odometer: 18450,
    };
  }, [currentCase, matchingVehicle]);

  // Dynamically resolve on-the-fly custom fields from Master Admin exposed to Dealer App
  const exposedMasterFields = useMemo(() => {
    const list: Array<{
      masterId: string;
      masterName: string;
      field: MasterFieldDef;
      rawValue: any;
      mappedValue: string;
    }> = [];

    masterConfigs.forEach((m) => {
      // Find matching vehicle record in master, or fallback to first record
      const matchingRecord =
        m.records.find(
          (r) =>
            r.pplName === 'Nexon' ||
            r.plName?.includes('Nexon EV') ||
            r.dealerCode === 'DLR1001'
        ) || m.records[0] || {};

      m.fields.forEach((f) => {
        if (
          f.displayInDealerApp &&
          (f.dealerTargetModule === 'vehicle_journey' ||
            f.dealerTargetModule === 'general' ||
            !f.dealerTargetModule)
        ) {
          const raw =
            simulatedOverrides[f.key] !== undefined
              ? simulatedOverrides[f.key]
              : matchingRecord[f.key] ?? '—';

          const mapped =
            f.valueMapping && f.valueMapping[String(raw)]
              ? f.valueMapping[String(raw)]
              : String(raw);

          list.push({
            masterId: m.id,
            masterName: m.name,
            field: f,
            rawValue: raw,
            mappedValue: mapped,
          });
        }
      });
    });

    return list;
  }, [masterConfigs, simulatedOverrides]);

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
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share</span>
          </button>
          <button
            onClick={handleExportDossier}
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
                {matchingVehicle ? `Tata ${matchingVehicle.model}` : currentCase.serviceType}
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
                Customer:{' '}
                <MaskedName name={currentCase.customerName} vehicleRegNo={currentCase.vehicleRegistration} assignedSa={{ name: currentCase.serviceAdvisor }} className="text-slate-800 font-medium" />
                <MaskedPhone phone={currentCase.customerMobile} vehicleRegNo={currentCase.vehicleRegistration} />
                <CustomerCategoryBadge chassisNo={currentCase.vin} />
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5 text-slate-400" /> ID chain:
              </span>
              <IdChainStrip chain={idChain} onOpen={() => setActiveTab('id_chain')} />
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
                    : currentCase.overallStatus === 'BLOCKED'
                    ? 'bg-rose-600 text-white shadow-xs'
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
            value={started.time}
            subtitle={started.date}
            icon={Clock}
          />
          <StatCard
            title="Elapsed Time"
            value={currentCase.elapsedTimeFormatted}
            subtitle={currentCase.overallStatus === 'DELAYED' ? 'SLA breached' : currentCase.overallStatus === 'BLOCKED' ? 'Blocked — needs action' : 'Within expected SLA'}
            icon={Activity}
            variant="accent"
          />
          <StatCard
            title="Current Stage"
            value={currentCase.currentStage}
            subtitle={activeStage ? `Owner: ${activeStage.responsibleUser}` : '—'}
            icon={Layers}
          />
          <StatCard
            title="Pending Actions"
            value={currentCase.pendingActionsCount}
            subtitle={caseExceptions.length > 0 ? `${caseExceptions.filter((e) => e.status !== 'RESOLVED').length} open exception(s)` : currentCase.pendingActionsCount > 0 ? 'Awaiting approvals' : 'Nothing pending'}
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

        {/* Dynamic Master Extended Attributes & Value Mapping Card in Dealer Application */}
        {exposedMasterFields.length > 0 && (
          <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/70 via-slate-50 to-blue-50/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-blue-900 text-white flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-blue-200" />
                </div>
                <div>
                  <div className="font-extrabold text-xs text-blue-950 flex items-center gap-2">
                    <span>Configured Master Extended Attributes (Dealer Application)</span>
                    <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                      LIVE VALUE MAPPED
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Configured on the fly in Master Admin &bull; Automatically populated into dealer workflow
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('master_mapping')}
                  className="text-xs font-bold text-blue-700 hover:text-blue-900 cursor-pointer flex items-center gap-1"
                >
                  <span>Inspection &amp; Simulation ({exposedMasterFields.length})</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => navigate('/admin/masters')}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Configure new custom fields and value mappings in Master Admin"
                >
                  <Settings className="h-3 w-3 text-slate-500" />
                  <span>Configure Masters</span>
                </button>
              </div>
            </div>

            {/* Live Attribute Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {exposedMasterFields.map((item) => (
                <div
                  key={`${item.masterId}_${item.field.key}`}
                  data-master-field={item.field.key}
                  className="bg-white p-3 rounded-lg border border-slate-200/90 shadow-2xs space-y-1 hover:border-blue-400 transition-colors"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-slate-500 truncate max-w-[160px]">
                      {item.field.dealerDisplayLabel || item.field.label}
                    </span>
                    <span className="text-slate-400 font-mono text-[9px] bg-slate-100 px-1 py-0.2 rounded">
                      {item.masterName.split(' ')[0]}
                    </span>
                  </div>

                  {/* Mapped Dealer Value Display */}
                  <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5 pt-0.5">
                    <span className="truncate">{item.mappedValue}</span>
                  </div>

                  {/* Raw Code Footnote */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                    <span>Raw: <strong className="text-slate-600">{String(item.rawValue)}</strong></span>
                    {item.field.valueMapping && (
                      <span className="text-emerald-700 font-sans font-semibold text-[9px]">
                        ✓ {Object.keys(item.field.valueMapping).length} rules mapped
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
            onClick={() => setActiveTab('id_chain')}
            data-testid="tab-id-chain"
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'id_chain'
                ? 'border-blue-900 text-blue-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Link2 className="h-4 w-4 text-blue-600" />
            <span>ID Chain &amp; Customer Updates</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-bold">
              {idChain.updates.length}
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

          <button
            onClick={() => setActiveTab('master_mapping')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'master_mapping'
                ? 'border-blue-900 text-blue-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="h-4 w-4 text-purple-600" />
            <span>Master Attributes &amp; Value Mappings</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-800 font-bold">
              {exposedMasterFields.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('rules_engine')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'rules_engine'
                ? 'border-indigo-600 text-indigo-950 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="h-4 w-4 text-indigo-600" />
            <span>Rules Engine Dynamic Fields</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-bold">
              Dynamic UI
            </span>
          </button>
        </div>
      </div>

      {activeTab === 'id_chain' && <JourneyIdChain chain={idChain} />}

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

      {/* Tab 4: Master Attributes & Value Mappings Inspection & Live Testing */}
      {activeTab === 'master_mapping' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-slate-900">
                    Live Master Dynamic Attributes &amp; Value Mapping Engine
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    ZERO-DOWNTIME SYNC
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  These extended attributes are configured in the <strong>Master Admin Console</strong>. When new fields or value mapping dictionaries are defined, they propagate immediately into dealer service screens with no database locks or code deployment required.
                </p>
              </div>

              <button
                onClick={() => navigate('/admin/masters')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <Database className="h-4 w-4 text-blue-200" />
                <span>Configure in Master Admin</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Explanatory Architecture Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 space-y-1">
                <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Zero Risk Extensibility</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Core enterprise entities remain immutable. Custom fields live in an extended schema layer, guaranteeing zero breaking changes or database lockups.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 space-y-1">
                <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span>On-The-Fly Value Mapping</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Translates cryptic OEM internal codes (e.g. <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-[10px]">PLATINUM</code>) into friendly dealer terms (<code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-[10px]">🛡️ Platinum 5-Yr Comprehensive</code>).
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/60 space-y-1">
                <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <span>Cross-Module Propagation</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Fields mapped to <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-[10px]">vehicle_journey</code>, <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-[10px]">reception</code>, or <code className="bg-slate-200 px-1 py-0.2 rounded font-mono text-[10px]">workshop_floor</code> appear instantaneously in targeted dealer views.
                </p>
              </div>
            </div>

            {/* Mappings Table */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#002B49] text-white font-semibold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Dealer Display Label</th>
                    <th className="py-3 px-4">Source Master</th>
                    <th className="py-3 px-4">Internal Key</th>
                    <th className="py-3 px-4">Target Module</th>
                    <th className="py-3 px-4">Raw Master Code</th>
                    <th className="py-3 px-4">Mapped Display Value</th>
                    <th className="py-3 px-4 text-right">Interactive Simulator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {exposedMasterFields.map((item) => {
                    const hasMapping = item.field.valueMapping && Object.keys(item.field.valueMapping).length > 0;
                    return (
                      <tr key={`${item.masterId}_${item.field.key}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">
                            {item.field.dealerDisplayLabel || item.field.label}
                          </div>
                          {item.field.description && (
                            <div className="text-[10px] text-slate-400 mt-0.5">{item.field.description}</div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                            {item.masterName}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          {item.field.key}
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                            {item.field.dealerTargetModule || 'vehicle_journey'}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                            {String(item.rawValue)}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-bold text-blue-950 bg-blue-50/80 px-2.5 py-1 rounded-md border border-blue-200 inline-block shadow-2xs">
                            {item.mappedValue}
                          </span>
                        </td>

                        {/* Interactive Testing Simulator */}
                        <td className="py-3 px-4 text-right">
                          {item.field.options && item.field.options.length > 0 ? (
                            <select
                              value={String(item.rawValue)}
                              onChange={(e) => {
                                setSimulatedOverrides((prev) => ({
                                  ...prev,
                                  [item.field.key]: e.target.value,
                                }));
                                showToast(`Simulated raw value change to "${e.target.value}". Value mapping updated live!`, 'info');
                              }}
                              className="px-2 py-1 text-xs border border-blue-300 rounded-lg bg-blue-50/40 text-blue-950 font-bold focus:outline-hidden cursor-pointer"
                              title="Test how changing this master code maps in the dealer app"
                            >
                              {item.field.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  Test: {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={String(item.rawValue)}
                              onChange={(e) => {
                                setSimulatedOverrides((prev) => ({
                                  ...prev,
                                  [item.field.key]: e.target.value,
                                }));
                              }}
                              className="w-24 px-2 py-1 text-xs border border-slate-200 rounded font-mono text-right"
                              placeholder="Test code"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {exposedMasterFields.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Database className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <div className="font-bold text-slate-700">No Custom Fields Exposed to Dealer Application Yet</div>
                        <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                          Open the <strong>Masters Maintenance</strong> page, click <strong>+ Add Custom Parameter</strong> on any master table, check <strong>Expose to Dealer App</strong>, and define value mappings.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Value Mapping Dictionary Legend */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
              <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-blue-700" />
                <span>Active Value Mapping Dictionaries (Configured Rules)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {exposedMasterFields.filter((item) => item.field.valueMapping).map((item) => (
                  <div key={item.field.key} className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-blue-950">
                        {item.field.dealerDisplayLabel || item.field.label} ({item.field.key})
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {Object.keys(item.field.valueMapping || {}).length} rules
                      </span>
                    </div>

                    <div className="space-y-1">
                      {Object.entries(item.field.valueMapping || {}).map(([raw, mapped]) => (
                        <div key={raw} className="flex items-center justify-between text-[11px] bg-slate-50 px-2 py-1 rounded">
                          <code className="font-mono text-slate-600 font-bold">{raw}</code>
                          <span className="text-slate-400 font-bold">→</span>
                          <span className="font-medium text-blue-900">{mapped}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Rules Engine Dynamic Parameters */}
      {activeTab === 'rules_engine' && (
        <div className="space-y-4">
          <DynamicFieldRenderer
            targetModule="vehicle_journey"
            values={dynamicValues}
            onChange={(key, val) => setDynamicValues((prev) => ({ ...prev, [key]: val }))}
            contextData={vehicleContext}
            showInspector={true}
            title={`Vehicle Journey Dynamic Parameters · ${matchingVehicle?.model || currentCase.vehicleRegistration}`}
            subtitle="Real-time evaluation of dynamic validation rules (regex, ranges) and UI rendering logic (conditional visibility)"
          />
        </div>
      )}
    </div>
  );
};
