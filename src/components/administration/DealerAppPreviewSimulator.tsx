import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  rulesEngineService,
  CustomFieldRuleDefinition,
  DealerTargetModule,
} from '../../services/rulesEngineService';
import { MasterConfig, MasterFieldDef } from '../../data/masterCatalogue';
import {
  Smartphone,
  Tablet,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Sliders,
  Car,
  RotateCcw,
  Sparkles,
  Zap,
  Shield,
  Layers,
  Search,
  ExternalLink,
  ChevronRight,
  Info,
  Check,
  Send,
  Lock,
  Calendar,
  Clock,
  BatteryCharging,
  Wifi,
  Radio,
  FileText,
  Building,
  User,
  ArrowRight,
} from 'lucide-react';

interface DealerAppPreviewSimulatorProps {
  currentMaster?: MasterConfig;
  onClose?: () => void;
  onOpenMastersMaintenance?: () => void;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

interface VehiclePreset {
  id: string;
  name: string;
  tag: string;
  color: string;
  model: string;
  fuelType: 'EV' | 'DIESEL' | 'PETROL' | 'CNG';
  regNo: string;
  vin: string;
  customerName: string;
  customerPhone: string;
  jcNumber: string;
  serviceType: string;
  isInsuranceClaim: boolean;
  claimId?: string;
  batterySoh?: number;
  initialDynamicValues: Record<string, any>;
}

const VEHICLE_PRESETS: VehiclePreset[] = [
  {
    id: 'nexon_ev_max',
    name: 'Tata Nexon EV Max Empowered+',
    tag: '⚡ Electric (EV)',
    color: 'emerald',
    model: 'Nexon EV Max (40.5 kWh)',
    fuelType: 'EV',
    regNo: 'MH02DW4821',
    vin: 'MAT623849P0192837',
    customerName: 'Anand Mahindra Rao',
    customerPhone: '+91 98201 49201',
    jcNumber: 'JC-2026-NEX-0192',
    serviceType: 'EV Periodic Comprehensive (30k km)',
    isInsuranceClaim: false,
    batterySoh: 94.5,
    initialDynamicValues: {
      ev_battery_health_soh: 94.5,
      ev_battery_serial_no: 'TATA-EV-BAT-NEX09482',
      extended_warranty_tier: 'PLATINUM',
      telematics_ota_status: 'OTA_ACTIVE',
      fastag_rfid_serial: '6001019283746501',
      insurance_claim_number: '',
    },
  },
  {
    id: 'curvv_ev_fault',
    name: 'Tata Curvv.ev Creative (Low SoH Test)',
    tag: '⚠️ EV Warning Edge Case',
    color: 'amber',
    model: 'Curvv.ev 55 Long Range',
    fuelType: 'EV',
    regNo: 'DL01AB9942',
    vin: 'MAT719482Q9384712',
    customerName: 'Priya Sharma',
    customerPhone: '+91 99102 38491',
    jcNumber: 'JC-2026-CRV-8491',
    serviceType: 'High-Voltage Battery Cell Diagnostics',
    isInsuranceClaim: false,
    batterySoh: 76.5, // triggers low SoH warning
    initialDynamicValues: {
      ev_battery_health_soh: 76.5,
      ev_battery_serial_no: 'TATA-EV-BAT-CRV0184',
      extended_warranty_tier: 'GOLD',
      telematics_ota_status: 'ECU_FLASH_REQ',
      fastag_rfid_serial: '6001019948201944',
      insurance_claim_number: '',
    },
  },
  {
    id: 'safari_diesel_claim',
    name: 'Tata Safari 2.0L Kryotec (Bodyshop Claim)',
    tag: '📑 Insurance Bodyshop',
    color: 'rose',
    model: 'Safari Dark Edition XZA+',
    fuelType: 'DIESEL',
    regNo: 'KA03MN7721',
    vin: 'MAT518294M1029384',
    customerName: 'Venkatesh K.',
    customerPhone: '+91 97401 88392',
    jcNumber: 'JC-2026-SAF-4412',
    serviceType: 'Accidental Bodyshop & Paintwork',
    isInsuranceClaim: true,
    claimId: 'CLM-NIA-849201',
    initialDynamicValues: {
      extended_warranty_tier: 'SILVER',
      telematics_ota_status: 'NON_CONNECTED',
      fastag_rfid_serial: '6001018849201923',
      insurance_claim_number: 'CLM-NIA-849201',
    },
  },
  {
    id: 'tiago_cng',
    name: 'Tata Tiago iCNG Dual-Cylinder',
    tag: '🚗 CNG Periodic Maintenance',
    color: 'blue',
    model: 'Tiago iCNG XZ+ Dual-Cylinder',
    fuelType: 'CNG',
    regNo: 'TS07HK1293',
    vin: 'MAT401928K9948201',
    customerName: 'Rajesh Goud',
    customerPhone: '+91 94401 29482',
    jcNumber: 'JC-2026-TIA-9912',
    serviceType: 'Periodic 20,000 km Scheduled Service',
    isInsuranceClaim: false,
    initialDynamicValues: {
      extended_warranty_tier: 'STANDARD',
      fastag_rfid_serial: '6001017482910394',
    },
  },
];

export const DealerAppPreviewSimulator: React.FC<DealerAppPreviewSimulatorProps> = ({
  currentMaster,
  onClose,
  onOpenMastersMaintenance,
}) => {
  const { showToast, logAudit, currentUser, masterConfigs } = useApp();

  // Viewport / Device Emulation Mode
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('tablet');

  // Active Dealer Target Module Screen
  const [targetModule, setTargetModule] = useState<DealerTargetModule>('vehicle_journey');

  // Selected Vehicle Preset
  const [selectedPresetId, setSelectedPresetId] = useState<string>('nexon_ev_max');
  const activePreset = VEHICLE_PRESETS.find((p) => p.id === selectedPresetId) || VEHICLE_PRESETS[0];

  // Simulated Live Vehicle Context
  const [simulatedContext, setSimulatedContext] = useState<Record<string, any>>({
    fuel_type: activePreset.fuelType,
    fuelType: activePreset.fuelType,
    isEvVehicle: activePreset.fuelType === 'EV',
    model: activePreset.model,
    serviceType: activePreset.serviceType,
    isInsuranceClaim: activePreset.isInsuranceClaim,
    hasConnectedTelematics: true,
    odometer: 18450,
  });

  // Dynamic Fields Test Values
  const [dynamicValues, setDynamicValues] = useState<Record<string, any>>(
    activePreset.initialDynamicValues
  );

  // Inspector and Diagnostic drawer toggle
  const [showInspector, setShowInspector] = useState(true);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Update context when preset changes
  useEffect(() => {
    setSimulatedContext({
      fuel_type: activePreset.fuelType,
      fuelType: activePreset.fuelType,
      isEvVehicle: activePreset.fuelType === 'EV',
      model: activePreset.model,
      serviceType: activePreset.serviceType,
      isInsuranceClaim: activePreset.isInsuranceClaim,
      hasConnectedTelematics: true,
      odometer: 18450,
    });
    setDynamicValues(activePreset.initialDynamicValues);
  }, [selectedPresetId]);

  // Subscribe to Rules Engine rules
  const [rules, setRules] = useState<CustomFieldRuleDefinition[]>(() =>
    rulesEngineService.getRulesForModule(targetModule)
  );

  useEffect(() => {
    // Load immediately for the newly selected screen, then keep in sync with rule edits
    setRules(rulesEngineService.getRulesForModule(targetModule));
    const unsub = rulesEngineService.subscribe(() => {
      setRules(rulesEngineService.getRulesForModule(targetModule));
    });
    return unsub;
  }, [targetModule]);

  // Aggregate custom fields from masterConfigs with displayInDealerApp: true
  const masterCustomFields = useMemo(() => {
    const list: Array<{ masterName: string; field: MasterFieldDef }> = [];
    masterConfigs.forEach((m) => {
      m.fields.forEach((f) => {
        if (
          f.displayInDealerApp &&
          (f.dealerTargetModule === targetModule ||
            f.dealerTargetModule === 'general' ||
            !f.dealerTargetModule)
        ) {
          list.push({ masterName: m.name, field: f });
        }
      });
    });
    return list;
  }, [masterConfigs, targetModule]);

  // Combine evaluation context
  const fullEvaluationContext = useMemo(() => {
    return { ...simulatedContext, ...dynamicValues };
  }, [simulatedContext, dynamicValues]);

  // Evaluate all rules in real-time
  const evaluatedRules = useMemo(() => {
    return rules.map((rule) => {
      const isVisible = rulesEngineService.evaluateVisibility(rule, fullEvaluationContext);
      const isRequired = rulesEngineService.evaluateIsRequired(rule, fullEvaluationContext);
      const isDisabled = rulesEngineService.evaluateDisabled(rule, fullEvaluationContext);
      const val = dynamicValues[rule.key] !== undefined ? dynamicValues[rule.key] : rule.defaultValue ?? '';
      const validationRes = rulesEngineService.validateField(rule, val, fullEvaluationContext);
      const mappedDisplay = rulesEngineService.resolveMappedDisplayValue(rule, val);

      return {
        rule,
        isVisible,
        isRequired,
        isDisabled,
        value: val,
        validationRes,
        mappedDisplay,
      };
    });
  }, [rules, fullEvaluationContext, dynamicValues]);

  const visibleRules = evaluatedRules.filter((r) => r.isVisible);
  const hiddenRules = evaluatedRules.filter((r) => !r.isVisible);
  const invalidRules = visibleRules.filter((r) => !r.validationRes.isValid);
  const isValidOverall = invalidRules.length === 0;

  // Handle single field change in preview
  const handleFieldChange = (key: string, val: any) => {
    setDynamicValues((prev) => ({ ...prev, [key]: val }));
  };

  // Action: Load faulty edge case to test error states
  const handleLoadFaultyData = () => {
    setDynamicValues({
      ev_battery_health_soh: 115, // Out of range (>100)
      ev_battery_serial_no: 'INVALID-SERIAL-123', // Regex mismatch
      extended_warranty_tier: 'UNKNOWN_PLAN', // LOV violation
      fastag_rfid_serial: '123', // Regex mismatch (must be 16 digits)
      insurance_claim_number: 'NOT_A_VALID_CLAIM', // Regex mismatch
    });
    showToast('Loaded faulty edge-case data. Check validation error indicators!', 'info');
  };

  // Action: Reset to active preset values
  const handleResetValues = () => {
    setDynamicValues(activePreset.initialDynamicValues);
    showToast('Simulator values reset to preset baseline', 'info');
  };

  // Action: Publish Verified Schema to Production
  const handlePublishToProduction = () => {
    // The audit entry claims "zero validation errors", so don't publish while errors are showing
    if (!isValidOverall) {
      showToast(`Fix ${invalidRules.length} validation error(s) in the preview before publishing`, 'error');
      return;
    }
    logAudit(
      'Dynamic Schema & Rules Verified & Deployed',
      'Masters Maintenance',
      targetModule,
      'Deploy to Dealer App',
      `Admin verified ${visibleRules.length} dynamic parameters with zero validation errors in Dealer App Simulator and deployed to production.`,
      'SUCCESS'
    );

    setPublishSuccess(true);
    showToast(
      '🎉 Dynamic schema and validation rules verified and published live to PAN-India dealer application!',
      'success'
    );
    setTimeout(() => setPublishSuccess(false), 4000);
  };

  // Compute container width based on device emulation
  const getDeviceFrameStyles = () => {
    switch (deviceMode) {
      case 'mobile':
        return 'max-w-[420px] shadow-2xl rounded-[40px] border-[12px] border-slate-900 ring-4 ring-slate-800/50';
      case 'tablet':
        return 'max-w-[820px] shadow-2xl rounded-[32px] border-[14px] border-slate-900 ring-4 ring-slate-800/50';
      case 'desktop':
      default:
        return 'w-full rounded-2xl border border-slate-300 shadow-md';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner: Simulator Mode Header */}
      <div className="bg-[#002B49] text-white rounded-2xl p-4 shadow-sm border border-[#003B66] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600/80 border border-blue-300/40 flex items-center justify-center text-white shadow-inner">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold tracking-tight text-white">
                Dealer Application Preview Simulator
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                LIVE RUNTIME EMULATOR
              </span>
            </div>
            <p className="text-xs text-blue-200 mt-0.5">
              Simulates how configured dynamic schema fields, regex patterns, range limits, and conditional visibility render on dealer devices before deployment.
            </p>
          </div>
        </div>

        {/* Viewport Device Controls & Module Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Device Toggle Buttons */}
          <div className="bg-blue-950/80 p-0.5 rounded-xl border border-blue-400/30 flex items-center text-xs">
            <button
              onClick={() => setDeviceMode('desktop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                deviceMode === 'desktop'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-blue-200 hover:text-white'
              }`}
              title="Desktop Workshop Terminal (1080p)"
            >
              <Monitor className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Desktop</span>
            </button>
            <button
              onClick={() => setDeviceMode('tablet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                deviceMode === 'tablet'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-blue-200 hover:text-white'
              }`}
              title="Workshop Bay Tablet (Samsung Active Tab / iPad)"
            >
              <Tablet className="h-3.5 w-3.5" />
              <span>Tablet</span>
            </button>
            <button
              onClick={() => setDeviceMode('mobile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                deviceMode === 'mobile'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-blue-200 hover:text-white'
              }`}
              title="Mobile P&D Handheld Terminal"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Mobile</span>
            </button>
          </div>

          {/* Module Screen Selector */}
          <select
            value={targetModule}
            onChange={(e) => setTargetModule(e.target.value as DealerTargetModule)}
            className="px-3 py-1.5 text-xs font-bold bg-blue-900/90 text-white border border-blue-400/40 rounded-xl focus:outline-hidden cursor-pointer shadow-xs"
          >
            <option value="vehicle_journey">Target: Vehicle Journey &amp; Job Card</option>
            <option value="job_card">Target: JC Creation &amp; Demanded Work</option>
            <option value="reception">Target: Reception &amp; Transit</option>
            <option value="workshop_floor">Target: Workshop Floor &amp; Bays</option>
            <option value="general">Target: All Dealer Views (General)</option>
          </select>

          {/* Publish Action */}
          <button
            onClick={handlePublishToProduction}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer transition-all border border-emerald-400/40"
            title="Deploy verified dynamic parameters and validation rules to production"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Publish to Live Dealers</span>
          </button>
        </div>
      </div>

      {/* Publish Toast Alert */}
      {publishSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-900 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>
              All dynamic schema parameters and validation rules deployed successfully to Tata Motors Dealerships!
            </span>
          </div>
          <span className="font-mono text-[11px] text-emerald-700">Audit ID: AUD-SYNC-{Date.now().toString().slice(-4)}</span>
        </div>
      )}

      {/* Main Grid: Left Vehicle Profile & Diagnostics Toolbar | Center Device Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Test Vehicle Presets & Interactive Playground (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          {/* Preset Selector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                <Car className="h-4 w-4 text-blue-700" />
                <span>Simulated Vehicle Profile Presets</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">TATA FLEET</span>
            </div>

            <div className="space-y-2">
              {VEHICLE_PRESETS.map((p) => {
                const isSelected = p.id === selectedPresetId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPresetId(p.id)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-900 border-blue-950 text-white shadow-xs'
                        : 'bg-slate-50/70 border-slate-200 hover:bg-white text-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold truncate">{p.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                          isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {p.fuelType}
                      </span>
                    </div>
                    <div
                      className={`text-[11px] flex items-center justify-between ${
                        isSelected ? 'text-blue-200' : 'text-slate-400'
                      }`}
                    >
                      <span className="font-mono">{p.regNo}</span>
                      <span>{p.serviceType.split('(')[0]}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Fuel Type & Context Playground */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-purple-700" />
                <span>Real-Time Condition Playground</span>
              </span>
              <button
                type="button"
                onClick={handleResetValues}
                className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Baseline</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Toggle these parameters to observe how the Rules Engine immediately evaluates conditional visibility in the simulator:
            </p>

            <div className="space-y-2.5">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                  Fuel Type (`fuel_type`) &bull; Controls EV Battery Fields
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['EV', 'DIESEL', 'PETROL', 'CNG'] as const).map((ft) => (
                    <button
                      key={ft}
                      type="button"
                      onClick={() =>
                        setSimulatedContext({
                          ...simulatedContext,
                          fuel_type: ft,
                          fuelType: ft,
                          isEvVehicle: ft === 'EV',
                        })
                      }
                      className={`py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                        simulatedContext.fuel_type === ft
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {ft}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                  Insurance Claim Active? &bull; Controls Claim ID Visibility
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSimulatedContext({
                        ...simulatedContext,
                        isInsuranceClaim: false,
                        serviceType: 'Periodic Maintenance',
                      })
                    }
                    className={`py-1 px-2 rounded-lg font-bold text-[11px] cursor-pointer ${
                      !simulatedContext.isInsuranceClaim
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    No (Customer Paid)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSimulatedContext({
                        ...simulatedContext,
                        isInsuranceClaim: true,
                        serviceType: 'Accidental Bodyshop Repair',
                      })
                    }
                    className={`py-1 px-2 rounded-lg font-bold text-[11px] cursor-pointer ${
                      simulatedContext.isInsuranceClaim
                        ? 'bg-rose-700 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    Yes (Bodyshop Claim)
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">Fault Testing Mode:</span>
                <button
                  type="button"
                  onClick={handleLoadFaultyData}
                  className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] border border-amber-300 transition-colors cursor-pointer"
                >
                  ⚡ Inject Validation Errors
                </button>
              </div>
            </div>
          </div>

          {/* Real-time Diagnostics Scorecard */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-emerald-600" />
                <span>Rules Engine Validation State</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isValidOverall ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {isValidOverall ? 'READY TO DEPLOY' : `${invalidRules.length} ERRORS DETECTED`}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-semibold">Active Fields</div>
                <div className="text-base font-extrabold text-blue-900">{visibleRules.length}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-semibold">Hidden by Rules</div>
                <div className="text-base font-extrabold text-slate-600">{hiddenRules.length}</div>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-semibold">Regex/Range Errors</div>
                <div
                  className={`text-base font-extrabold ${
                    invalidRules.length > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {invalidRules.length}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Emulated Device Screen (8 cols) */}
        <div className="lg:col-span-8 flex flex-col items-center">
          <div className={`w-full transition-all duration-300 ${getDeviceFrameStyles()}`}>
            {/* Emulated Device Top Status Bar (for tablet and mobile modes) */}
            {(deviceMode === 'tablet' || deviceMode === 'mobile') && (
              <div className="bg-slate-900 text-slate-400 px-6 py-2.5 flex items-center justify-between text-[11px] select-none rounded-t-[20px]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">09:42</span>
                  <span className="text-[10px] bg-blue-900 text-blue-200 px-1.5 py-0.2 rounded font-mono">
                    Tata sWorkshop v4.2
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Wifi className="h-3.5 w-3.5 text-slate-300" />
                  <Radio className="h-3.5 w-3.5 text-emerald-400" />
                  <div className="flex items-center gap-1 font-mono text-[10px] text-slate-300">
                    <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
                    <span>94%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Simulated Dealer Screen Body */}
            <div className="bg-slate-100 p-4 sm:p-5 space-y-4 max-h-[780px] overflow-y-auto">
              {/* Dealer App Application Bar */}
              <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold text-xs">
                    TML
                  </div>
                  <div>
                    <div className="font-extrabold text-xs text-blue-950 flex items-center gap-1.5">
                      <span>TATA MOTORS sWORKSHOP DEALER PORTAL</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                        DLR1001
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Sample Motors Hyderabad &bull; Workshop Bay 03 &bull; Advisor: Amit Kumar
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-900 border border-blue-200">
                    {targetModule.toUpperCase()} VIEW
                  </span>
                </div>
              </div>

              {/* Simulated Vehicle Card in Job Card Workflow */}
              <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-slate-900">{activePreset.model}</h3>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                        {activePreset.regNo}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      VIN: <span className="font-mono">{activePreset.vin}</span> &bull; Customer:{' '}
                      <strong>{activePreset.customerName}</strong> ({activePreset.customerPhone})
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-lg font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      IN PROGRESS (BAY 03)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Job Card Number</span>
                    <span className="font-mono font-bold text-blue-900">{activePreset.jcNumber}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Demanded Work</span>
                    <span className="font-medium text-slate-800 truncate block">{activePreset.serviceType}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Odometer</span>
                    <span className="font-mono font-bold text-slate-900">18,450 km</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Powertrain</span>
                    <span
                      className={`font-bold ${
                        simulatedContext.fuel_type === 'EV' ? 'text-emerald-700' : 'text-slate-700'
                      }`}
                    >
                      {simulatedContext.fuel_type}
                    </span>
                  </div>
                </div>
              </div>

              {/* DYNAMIC PARAMETERS ENGINE SECTION (Live Tested Component) */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-300" />
                    <span className="font-bold text-xs tracking-tight">
                      Configured Dynamic Parameters &bull; Real-Time Rules Engine
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-800 text-blue-200 border border-blue-400/30">
                    {visibleRules.length} Active Fields
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {/* Dynamic Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {visibleRules.map(
                      ({ rule, isRequired, isDisabled, value, validationRes, mappedDisplay }) => {
                        const hasError = !validationRes.isValid;
                        const errorMsg = validationRes.errors[0];

                        return (
                          <div key={rule.key} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <label className="font-bold text-slate-800 flex items-center gap-1">
                                <span>{rule.dealerDisplayLabel || rule.label}</span>
                                {isRequired && <span className="text-rose-500 font-bold">*</span>}
                                {isDisabled && <Lock className="h-3 w-3 text-slate-400" />}
                              </label>

                              {/* Verified Check or Validation Alert Badge */}
                              {hasError ? (
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 flex items-center gap-0.5">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  <span>Invalid</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5">
                                  <Check className="h-2.5 w-2.5" />
                                  <span>Verified</span>
                                </span>
                              )}
                            </div>

                            {/* Widget rendering */}
                            <div>
                              {rule.widgetType === 'select' ? (
                                <select
                                  value={String(value)}
                                  disabled={isDisabled}
                                  onChange={(e) => handleFieldChange(rule.key, e.target.value)}
                                  className={`w-full px-2.5 py-1.5 text-xs rounded-lg border font-semibold ${
                                    hasError
                                      ? 'border-rose-400 bg-rose-50/60 text-rose-950'
                                      : 'border-slate-300 bg-white text-slate-900 focus:border-blue-500'
                                  }`}
                                >
                                  <option value="">-- Select {rule.dealerDisplayLabel || rule.label} --</option>
                                  {rule.options?.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {rule.uiLogic?.valueMapping?.[opt] || opt}
                                    </option>
                                  ))}
                                </select>
                              ) : rule.widgetType === 'boolean' ? (
                                <div className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50">
                                  <span className="text-xs text-slate-600">Active status</span>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(value)}
                                    disabled={isDisabled}
                                    onChange={(e) => handleFieldChange(rule.key, e.target.checked)}
                                    className="h-4 w-4 rounded text-blue-600"
                                  />
                                </div>
                              ) : (
                                <input
                                  type={rule.widgetType === 'number' ? 'number' : 'text'}
                                  value={String(value)}
                                  disabled={isDisabled}
                                  onChange={(e) =>
                                    handleFieldChange(
                                      rule.key,
                                      rule.widgetType === 'number'
                                        ? e.target.value === ''
                                          ? ''
                                          : Number(e.target.value)
                                        : e.target.value
                                    )
                                  }
                                  placeholder={rule.uiLogic?.placeholder || 'Enter value...'}
                                  className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${
                                    hasError
                                      ? 'border-rose-400 bg-rose-50/60 text-rose-950 font-medium'
                                      : 'border-slate-300 bg-white text-slate-900'
                                  }`}
                                />
                              )}
                            </div>

                            {/* Render Value Mapping Badge if applicable */}
                            {mappedDisplay && mappedDisplay !== String(value) && (
                              <div className="p-1.5 rounded-md bg-blue-50/80 border border-blue-200 text-[11px] font-bold text-blue-950 flex items-center gap-1 shadow-2xs">
                                <Sparkles className="h-3 w-3 text-blue-600 shrink-0" />
                                <span className="truncate">{mappedDisplay}</span>
                              </div>
                            )}

                            {/* Inline Error Message */}
                            {hasError && (
                              <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span>{errorMsg}</span>
                              </p>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>

                  {visibleRules.length === 0 && (
                    <div className="py-6 text-center text-slate-400 space-y-1">
                      <Eye className="h-6 w-6 mx-auto text-slate-300" />
                      <p className="text-xs font-semibold">No dynamic fields match current vehicle conditions.</p>
                      <p className="text-[11px]">
                        Switch fuel type to &quot;EV&quot; or enable &quot;Insurance Claim&quot; on the left to see conditional fields appear.
                      </p>
                    </div>
                  )}

                  {/* Simulator Testing Footnote */}
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5 text-blue-700" />
                      <span>Dealer App Runtime Sync: <strong>Zero Redeployment Required</strong></span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      Module: {targetModule}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
