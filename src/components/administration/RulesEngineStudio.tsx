import React, { useState, useEffect } from 'react';
import {
  rulesEngineService,
  CustomFieldRuleDefinition,
  REGEX_PRESETS,
  DEFAULT_AUTOMOTIVE_RULES,
  DealerTargetModule,
  FieldWidgetType,
  ConditionOperator,
} from '../../services/rulesEngineService';
import { DynamicFieldRenderer } from '../common/DynamicFieldRenderer';
import {
  Zap,
  Sliders,
  Sparkles,
  Plus,
  Trash2,
  Edit,
  Save,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  FileCode,
  Play,
  ArrowRight,
  ShieldCheck,
  Copy,
  Check,
  Info,
  Car,
  Layers,
  Search,
  ExternalLink,
} from 'lucide-react';

interface RulesEngineStudioProps {
  onRuleSelected?: (ruleId: string) => void;
}

export const RulesEngineStudio: React.FC<RulesEngineStudioProps> = () => {
  const [rules, setRules] = useState<CustomFieldRuleDefinition[]>(() =>
    rulesEngineService.getAllRules()
  );
  const [selectedRuleId, setSelectedRuleId] = useState<string>(rules[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'editor' | 'sandbox' | 'raw_json'>('editor');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModule, setFilterModule] = useState<string>('ALL');

  // Copy indicator
  const [copied, setCopied] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Raw JSON state
  const [jsonText, setJsonText] = useState<string>(() => rulesEngineService.exportRulesJSON());
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Subscribe to changes
  useEffect(() => {
    const unsub = rulesEngineService.subscribe(() => {
      const all = rulesEngineService.getAllRules();
      setRules(all);
      setJsonText(rulesEngineService.exportRulesJSON());
    });
    return unsub;
  }, []);

  const selectedRule = rules.find((r) => r.id === selectedRuleId) || rules[0];

  // Editor Draft State for currently selected rule
  const [draftRule, setDraftRule] = useState<CustomFieldRuleDefinition | null>(null);

  useEffect(() => {
    if (selectedRule) {
      setDraftRule(JSON.parse(JSON.stringify(selectedRule)));
    }
  }, [selectedRuleId]);

  // Sandbox Live Testing Form State
  const [sandboxContext, setSandboxContext] = useState<Record<string, any>>({
    fuel_type: 'EV',
    model: 'Nexon EV Empowered+',
    isEvVehicle: true,
    isInsuranceClaim: false,
    serviceType: 'Periodic Maintenance',
    hasConnectedTelematics: true,
    odometer: 18450,
  });

  const [sandboxDynamicValues, setSandboxDynamicValues] = useState<Record<string, any>>({
    ev_battery_health_soh: 94.5,
    ev_battery_serial_no: 'TATA-EV-BAT-NEX09482',
    extended_warranty_tier: 'PLATINUM',
    telematics_ota_status: 'OTA_ACTIVE',
    fastag_rfid_serial: '6001019283746501',
    insurance_claim_number: '',
  });

  const filteredRules = rules.filter((r) => {
    if (filterModule !== 'ALL' && r.targetModule !== filterModule) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.key.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Action: Create a brand new custom field rule
  const handleAddNewRule = () => {
    const newId = `RULE_CUSTOM_${Date.now()}`;
    const newRule: CustomFieldRuleDefinition = {
      id: newId,
      key: `custom_field_${rules.length + 1}`,
      label: 'New Dynamic Custom Parameter',
      dealerDisplayLabel: 'New Dynamic Parameter',
      widgetType: 'text',
      targetModule: 'vehicle_journey',
      defaultValue: '',
      description: 'Custom dynamic parameter evaluated by Rules Engine',
      category: 'General Workshop Operations',
      version: 1,
      lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 19),
      updatedBy: 'TML-ADMIN',
      active: true,
      validation: {
        required: false,
      },
      uiLogic: {
        gridSpan: 1,
        placeholder: 'Enter value...',
      },
    };

    rulesEngineService.saveRule(newRule);
    setSelectedRuleId(newId);
    setSaveSuccessMsg('Created new rule definition template');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Action: Save Draft Rule
  const handleSaveDraft = () => {
    if (!draftRule) return;
    rulesEngineService.saveRule(draftRule);
    setSaveSuccessMsg(`Rule "${draftRule.label}" saved and published to Dealer App!`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Action: Delete Rule
  const handleDeleteRule = (id: string) => {
    if (window.confirm('Are you sure you want to remove this rule definition from the Rules Engine?')) {
      rulesEngineService.deleteRule(id);
      const remaining = rules.filter((r) => r.id !== id);
      if (remaining.length > 0) {
        setSelectedRuleId(remaining[0].id);
      }
    }
  };

  // Action: Import JSON
  const handleApplyJson = () => {
    const res = rulesEngineService.importRulesJSON(jsonText);
    if (!res.success) {
      setJsonError(res.error || 'Invalid JSON');
    } else {
      setJsonError(null);
      setSaveSuccessMsg(`Successfully imported ${res.count} rule definitions!`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    }
  };

  // Action: Download JSON file
  const handleDownloadJson = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tata_motors_rules_engine_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Preset loader
  const handleLoadPresetRegex = (presetKey: string) => {
    if (!draftRule) return;
    const preset = REGEX_PRESETS[presetKey];
    if (preset) {
      setDraftRule({
        ...draftRule,
        validation: {
          ...draftRule.validation,
          regex: {
            presetName: presetKey,
            pattern: preset.pattern,
            message: preset.message,
          },
        },
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Studio Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-indigo-900/60 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-indigo-600/80 border border-indigo-400/40 flex items-center justify-center text-white shadow-inner">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight text-white">
                Rules Engine Studio &amp; Dynamic Schema Service
              </h2>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/40">
                Zero Redeployment
              </span>
            </div>
            <p className="text-xs text-indigo-200 mt-1 max-w-2xl leading-relaxed">
              Consumes JSON-based schema definitions to dynamically enforce validation rules (regex, ranges, Lov)
              and UI rendering logic (conditional visibility, value mappings) in the Dealer Application in real-time.
            </p>
          </div>
        </div>

        {/* Top Actions: Tabs & Create Rule */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-950/80 p-1 rounded-xl border border-indigo-400/30 flex items-center text-xs">
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'editor'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Rule Builder</span>
            </button>

            <button
              onClick={() => setActiveTab('sandbox')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'sandbox'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              <Play className="h-3.5 w-3.5" />
              <span>Live Sandbox Simulator</span>
            </button>

            <button
              onClick={() => setActiveTab('raw_json')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'raw_json'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              <FileCode className="h-3.5 w-3.5" />
              <span>JSON Engine Payload</span>
            </button>
          </div>

          <button
            onClick={handleAddNewRule}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer transition-all border border-emerald-400/40"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Add New Rule</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {saveSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-mono">Instant Runtime Sync</span>
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 1: VISUAL RULE BUILDER & DEFINITION EDITOR                          */}
      {/* ======================================================================= */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Rule Selector & Catalogue */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">Active Rule Definitions</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold">
                  {rules.length} Registered
                </span>
              </div>

              {/* Search & Filter */}
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search rules..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
                  />
                </div>
                <select
                  value={filterModule}
                  onChange={(e) => setFilterModule(e.target.value)}
                  className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-hidden"
                >
                  <option value="ALL">All Modules</option>
                  <option value="vehicle_journey">Vehicle Journey</option>
                  <option value="job_card">Job Card</option>
                  <option value="workshop_floor">Workshop Floor</option>
                </select>
              </div>

              {/* Rule Items List */}
              <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
                {filteredRules.map((r) => {
                  const isSelected = r.id === selectedRuleId;
                  const hasRegex = Boolean(r.validation?.regex);
                  const hasVisibleIf = Boolean(r.uiLogic?.visibleIf);
                  const hasMapping = Boolean(r.uiLogic?.valueMapping);

                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedRuleId(r.id)}
                      className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 shadow-xs ring-1 ring-indigo-500/30'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-slate-900 truncate">
                          {r.dealerDisplayLabel || r.label}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-slate-100 text-slate-600 uppercase">
                          {r.widgetType}
                        </span>
                      </div>

                      <div className="text-[11px] font-mono text-slate-500 truncate mb-1.5">{r.key}</div>

                      {/* Badges showing what dynamic logic is attached */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {r.validation?.required && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-bold">
                            Required
                          </span>
                        )}
                        {hasRegex && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-mono font-bold">
                            Regex Rule
                          </span>
                        )}
                        {hasVisibleIf && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-bold">
                            👁️ Conditional
                          </span>
                        )}
                        {hasMapping && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                            ✨ Mapping
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reset to Defaults button */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset all rule definitions to default Tata Motors automotive rules?')) {
                      rulesEngineService.resetToDefaults();
                      setSaveSuccessMsg('Restored automotive factory default rules');
                    }
                  }}
                  className="w-full py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restore Factory Presets</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Rule Editor Form */}
          <div className="lg:col-span-8 space-y-4">
            {draftRule ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-5">
                {/* Form Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Rule Definition: <span className="text-indigo-950 font-mono">{draftRule.key}</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Version {draftRule.version} · Last updated {draftRule.lastUpdated} by {draftRule.updatedBy}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(draftRule.id)}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>Save &amp; Deploy to Dealer App</span>
                    </button>
                  </div>
                </div>

                {/* Section 1: Basic Field Configuration */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <span className="h-4 w-1 bg-indigo-600 rounded-full" />
                    <span>1. Basic Field Metadata</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Internal Key</label>
                      <input
                        type="text"
                        value={draftRule.key}
                        onChange={(e) => setDraftRule({ ...draftRule, key: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-xs focus:outline-hidden focus:border-indigo-400 bg-slate-50"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Admin Display Label</label>
                      <input
                        type="text"
                        value={draftRule.label}
                        onChange={(e) => setDraftRule({ ...draftRule, label: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-indigo-400"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Dealer Display Label</label>
                      <input
                        type="text"
                        value={draftRule.dealerDisplayLabel || ''}
                        onChange={(e) => setDraftRule({ ...draftRule, dealerDisplayLabel: e.target.value })}
                        placeholder="e.g. ⚡ EV Battery Health"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-indigo-400"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Widget Type</label>
                      <select
                        value={draftRule.widgetType}
                        onChange={(e) =>
                          setDraftRule({ ...draftRule, widgetType: e.target.value as FieldWidgetType })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden bg-white"
                      >
                        <option value="text">Text Input</option>
                        <option value="number">Numeric Input</option>
                        <option value="select">Dropdown Select</option>
                        <option value="boolean">Boolean Switch</option>
                        <option value="date">Date Picker</option>
                        <option value="textarea">Textarea Notes</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Target Dealer Module</label>
                      <select
                        value={draftRule.targetModule}
                        onChange={(e) =>
                          setDraftRule({ ...draftRule, targetModule: e.target.value as DealerTargetModule })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden bg-white"
                      >
                        <option value="vehicle_journey">Vehicle Journey Screen</option>
                        <option value="job_card">Job Card Creation</option>
                        <option value="reception">Reception &amp; Transit</option>
                        <option value="workshop_floor">Workshop Bay Dispatch</option>
                        <option value="general">All Dealer Views (General)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Default Value</label>
                      <input
                        type="text"
                        value={String(draftRule.defaultValue ?? '')}
                        onChange={(e) => setDraftRule({ ...draftRule, defaultValue: e.target.value })}
                        placeholder="e.g. PLATINUM, 95, etc."
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {draftRule.widgetType === 'select' && (
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Dropdown Options (comma separated)
                      </label>
                      <input
                        type="text"
                        value={draftRule.options?.join(', ') || ''}
                        onChange={(e) =>
                          setDraftRule({
                            ...draftRule,
                            options: e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="e.g. PLATINUM, GOLD, SILVER, STANDARD"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono focus:outline-hidden"
                      />
                    </div>
                  )}
                </div>

                {/* Section 2: Dynamic Validation Rules */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                      <span className="h-4 w-1 bg-purple-600 rounded-full" />
                      <span>2. Dynamic Validation Rules (Regex, Range, Mandatory)</span>
                    </div>

                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(draftRule.validation?.required)}
                        onChange={(e) =>
                          setDraftRule({
                            ...draftRule,
                            validation: {
                              ...draftRule.validation,
                              required: e.target.checked,
                            },
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                      <span>Strictly Mandatory (Always Required)</span>
                    </label>
                  </div>

                  {/* Regex Pattern Configurator */}
                  <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/40 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-950 flex items-center gap-1.5">
                        <FileCode className="h-3.5 w-3.5 text-purple-700" />
                        <span>RegEx Pattern Validation</span>
                      </span>

                      {/* Quick Presets Dropdown */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-purple-800 font-semibold">Load Automotive Preset:</span>
                        <select
                          onChange={(e) => {
                            if (e.target.value) handleLoadPresetRegex(e.target.value);
                          }}
                          defaultValue=""
                          className="px-2 py-1 text-[11px] font-semibold bg-white border border-purple-300 rounded text-purple-900 focus:outline-hidden"
                        >
                          <option value="" disabled>
                            -- Select Preset --
                          </option>
                          <option value="VIN_NUMBER">Chassis VIN (17 chars)</option>
                          <option value="INDIAN_VEHICLE_REG">Registration Plate (MH02...)</option>
                          <option value="BATTERY_SERIAL_NUMBER">EV Battery Serial</option>
                          <option value="FASTAG_16_DIGIT">FASTag 16-Digit RFID</option>
                          <option value="INSURANCE_POLICY">Insurance Policy/Claim ID</option>
                          <option value="INDIAN_MOBILE">10-Digit Mobile Number</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Regex Expression (ECMAScript syntax)
                        </label>
                        <input
                          type="text"
                          value={draftRule.validation?.regex?.pattern || ''}
                          onChange={(e) =>
                            setDraftRule({
                              ...draftRule,
                              validation: {
                                ...draftRule.validation,
                                regex: {
                                  pattern: e.target.value,
                                  message:
                                    draftRule.validation?.regex?.message ||
                                    `Invalid format for ${draftRule.label}`,
                                },
                              },
                            })
                          }
                          placeholder="e.g. ^[A-HJ-NPR-Z0-9]{17}$"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-purple-200 bg-white font-mono text-xs focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Inline Error Message
                        </label>
                        <input
                          type="text"
                          value={draftRule.validation?.regex?.message || ''}
                          onChange={(e) =>
                            setDraftRule({
                              ...draftRule,
                              validation: {
                                ...draftRule.validation,
                                regex: {
                                  pattern: draftRule.validation?.regex?.pattern || '',
                                  message: e.target.value,
                                },
                              },
                            })
                          }
                          placeholder="Message shown to dealer advisor when invalid"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-purple-200 bg-white text-xs focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Range Configurator (Numbers) */}
                  {draftRule.widgetType === 'number' && (
                    <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2 text-xs">
                      <span className="font-bold text-blue-950">Numeric Range Boundaries</span>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block">Min Value</label>
                          <input
                            type="number"
                            value={draftRule.validation?.range?.min ?? ''}
                            onChange={(e) =>
                              setDraftRule({
                                ...draftRule,
                                validation: {
                                  ...draftRule.validation,
                                  range: {
                                    ...draftRule.validation?.range,
                                    min: e.target.value === '' ? undefined : Number(e.target.value),
                                  },
                                },
                              })
                            }
                            className="w-full px-2 py-1 text-xs border border-blue-200 rounded bg-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block">Max Value</label>
                          <input
                            type="number"
                            value={draftRule.validation?.range?.max ?? ''}
                            onChange={(e) =>
                              setDraftRule({
                                ...draftRule,
                                validation: {
                                  ...draftRule.validation,
                                  range: {
                                    ...draftRule.validation?.range,
                                    max: e.target.value === '' ? undefined : Number(e.target.value),
                                  },
                                },
                              })
                            }
                            className="w-full px-2 py-1 text-xs border border-blue-200 rounded bg-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold block">Step Precision</label>
                          <input
                            type="number"
                            value={draftRule.validation?.range?.step ?? ''}
                            onChange={(e) =>
                              setDraftRule({
                                ...draftRule,
                                validation: {
                                  ...draftRule.validation,
                                  range: {
                                    ...draftRule.validation?.range,
                                    step: e.target.value === '' ? undefined : Number(e.target.value),
                                  },
                                },
                              })
                            }
                            placeholder="e.g. 0.1, 1"
                            className="w-full px-2 py-1 text-xs border border-blue-200 rounded bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 3: Dynamic UI Logic (Conditional Visibility & Value Mappings) */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <span className="h-4 w-1 bg-emerald-600 rounded-full" />
                    <span>3. Dynamic UI Rendering Logic (Conditional Visibility &amp; Value Mappings)</span>
                  </div>

                  {/* Conditional Visibility Preset */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Conditional Visibility (`visibleIf`)</span>
                      <span className="text-[11px] text-slate-500">
                        Field only renders when these runtime conditions match
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDraftRule({
                            ...draftRule,
                            uiLogic: {
                              ...draftRule.uiLogic,
                              visibleIf: {
                                logicalOperator: 'OR',
                                conditions: [
                                  { field: 'fuel_type', operator: 'equals', value: 'EV' },
                                  { field: 'isEvVehicle', operator: 'isTrue' },
                                ],
                              },
                            },
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 font-bold text-left hover:bg-emerald-100 transition-colors"
                      >
                        ⚡ EV Only Condition
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDraftRule({
                            ...draftRule,
                            uiLogic: {
                              ...draftRule.uiLogic,
                              visibleIf: {
                                logicalOperator: 'OR',
                                conditions: [
                                  { field: 'isInsuranceClaim', operator: 'isTrue' },
                                  { field: 'serviceType', operator: 'contains', value: 'Bodyshop' },
                                ],
                              },
                            },
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-900 font-bold text-left hover:bg-rose-100 transition-colors"
                      >
                        📑 Insurance Claim Only
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDraftRule({
                            ...draftRule,
                            uiLogic: {
                              ...draftRule.uiLogic,
                              visibleIf: undefined, // Always visible
                            },
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold text-left hover:bg-slate-50 transition-colors"
                      >
                        🌐 Always Visible (No Condition)
                      </button>
                    </div>

                    {draftRule.uiLogic?.visibleIf && (
                      <div className="bg-white p-2 rounded border border-slate-200 font-mono text-[10px] text-slate-700 overflow-x-auto">
                        {JSON.stringify(draftRule.uiLogic.visibleIf)}
                      </div>
                    )}
                  </div>

                  {/* Value Mapping Dictionary */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Value Mapping Presentation Dictionary</span>
                      <span className="text-[11px] text-slate-500">
                        Translates raw ERP codes to user-friendly dealer badges
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {draftRule.options?.map((opt) => (
                        <div key={opt} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                          <span className="font-mono text-slate-700 font-bold text-[11px] w-28 shrink-0">
                            {opt}
                          </span>
                          <span className="text-slate-400">→</span>
                          <input
                            type="text"
                            value={draftRule.uiLogic?.valueMapping?.[opt] || ''}
                            onChange={(e) => {
                              const nextMap = { ...(draftRule.uiLogic?.valueMapping || {}) };
                              nextMap[opt] = e.target.value;
                              setDraftRule({
                                ...draftRule,
                                uiLogic: {
                                  ...draftRule.uiLogic,
                                  valueMapping: nextMap,
                                },
                              });
                            }}
                            placeholder={`e.g. 🛡️ ${opt} Verified Badge`}
                            className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-hidden"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Save Bar */}
                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save &amp; Deploy Rule to Dealer App</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                Select a rule on the left to edit its schema and dynamic logic.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 2: LIVE INTERACTIVE SANDBOX SIMULATOR                               */}
      {/* ======================================================================= */}
      {activeTab === 'sandbox' && (
        <div className="space-y-4">
          {/* Simulator Control Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <Play className="h-4 w-4 text-emerald-600" />
                  <span>Dealer Application Runtime Simulator</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Change vehicle fuel type or service context below to watch the Rules Engine conditionally
                  show/hide fields and validate regex/ranges in real time!
                </p>
              </div>

              {/* Context Presets */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Test Preset:</span>
                <button
                  type="button"
                  onClick={() =>
                    setSandboxContext({
                      fuel_type: 'EV',
                      model: 'Nexon EV Max',
                      isEvVehicle: true,
                      isInsuranceClaim: false,
                      serviceType: 'EV Periodic Maintenance',
                    })
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sandboxContext.fuel_type === 'EV'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  ⚡ Nexon EV Context
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSandboxContext({
                      fuel_type: 'DIESEL',
                      model: 'Harrier Dark Edition',
                      isEvVehicle: false,
                      isInsuranceClaim: false,
                      serviceType: 'Periodic 30,000 km Service',
                    })
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sandboxContext.fuel_type === 'DIESEL' && !sandboxContext.isInsuranceClaim
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🚗 Harrier Diesel Context
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSandboxContext({
                      fuel_type: 'PETROL',
                      model: 'Altroz Racer',
                      isEvVehicle: false,
                      isInsuranceClaim: true,
                      serviceType: 'Accidental Bodyshop Repair',
                      claimStatus: 'APPROVED_SURVEYOR',
                    })
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sandboxContext.isInsuranceClaim
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  📑 Insurance Bodyshop Claim
                </button>
              </div>
            </div>

            {/* Simulated Vehicle Context Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 font-semibold block">Fuel Type (`fuel_type`)</label>
                <select
                  value={sandboxContext.fuel_type}
                  onChange={(e) =>
                    setSandboxContext({
                      ...sandboxContext,
                      fuel_type: e.target.value,
                      isEvVehicle: e.target.value === 'EV',
                    })
                  }
                  className="w-full px-2 py-1 border border-slate-300 rounded font-bold bg-white text-slate-900"
                >
                  <option value="EV">EV (Electric)</option>
                  <option value="DIESEL">Diesel</option>
                  <option value="PETROL">Petrol</option>
                  <option value="CNG">CNG</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-semibold block">Vehicle Model</label>
                <input
                  type="text"
                  value={sandboxContext.model}
                  onChange={(e) => setSandboxContext({ ...sandboxContext, model: e.target.value })}
                  className="w-full px-2 py-1 border border-slate-300 rounded font-medium bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-semibold block">Service Type</label>
                <input
                  type="text"
                  value={sandboxContext.serviceType}
                  onChange={(e) => setSandboxContext({ ...sandboxContext, serviceType: e.target.value })}
                  className="w-full px-2 py-1 border border-slate-300 rounded font-medium bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-semibold block">Insurance Claim Active?</label>
                <select
                  value={sandboxContext.isInsuranceClaim ? 'YES' : 'NO'}
                  onChange={(e) =>
                    setSandboxContext({
                      ...sandboxContext,
                      isInsuranceClaim: e.target.value === 'YES',
                    })
                  }
                  className="w-full px-2 py-1 border border-slate-300 rounded font-bold bg-white text-slate-900"
                >
                  <option value="NO">No (Standard Cash / Customer Paid)</option>
                  <option value="YES">Yes (Bodyshop Insurance Claim)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Actual Rendered Dynamic Component inside Dealer Screen Simulation */}
          <DynamicFieldRenderer
            targetModule="vehicle_journey"
            values={sandboxDynamicValues}
            onChange={(k, v) => setSandboxDynamicValues((prev) => ({ ...prev, [k]: v }))}
            contextData={sandboxContext}
            showInspector={true}
            title="Vehicle Journey & Job Card Dynamic Parameters"
            subtitle="Testing live conditional visibility and regex/range validation rules"
          />
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 3: RAW JSON DEFINITIONS & IMPORT/EXPORT PAYLOAD                     */}
      {/* ======================================================================= */}
      {activeTab === 'raw_json' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <FileCode className="h-4 w-4 text-indigo-600" />
                <span>Declarative JSON Rules Definition Payload</span>
              </h3>
              <p className="text-xs text-slate-500">
                You can export this JSON to backup rules or import new rule definitions directly without compiling code.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(jsonText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadJson}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download .json</span>
              </button>

              <button
                type="button"
                onClick={handleApplyJson}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Apply / Import JSON</span>
              </button>
            </div>
          </div>

          {jsonError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{jsonError}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 block">
              JSON Configuration (Array of CustomFieldRuleDefinition)
            </label>
            <textarea
              rows={18}
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setJsonError(null);
              }}
              className="w-full p-4 rounded-xl border border-slate-300 bg-slate-950 text-indigo-300 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};
