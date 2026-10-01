import React, { useState, useEffect, useMemo } from 'react';
import {
  rulesEngineService,
  CustomFieldRuleDefinition,
  DealerTargetModule,
  FieldValidationResult,
} from '../../services/rulesEngineService';
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Info,
  Shield,
  Zap,
  Calendar,
  Lock,
  Eye,
  Check,
} from 'lucide-react';

interface DynamicFieldRendererProps {
  targetModule: DealerTargetModule;
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  contextData?: Record<string, any>; // background context like vehicle info, fuel_type, etc.
  readOnly?: boolean;
  showInspector?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
}

// Stable default: a fresh `{}` per render would re-run validation (which sets state) every render
const EMPTY_CONTEXT: Record<string, any> = {};

export const DynamicFieldRenderer: React.FC<DynamicFieldRendererProps> = ({
  targetModule,
  values,
  onChange,
  contextData = EMPTY_CONTEXT,
  readOnly = false,
  showInspector = false,
  title = 'Dynamic Custom Parameters (Rules Engine Driven)',
  subtitle = 'Configured dynamically in Master Admin with dynamic validations & conditional visibility',
  className = '',
}) => {
  // Subscribe to Rules Engine Service changes (so when admin updates rules, dealer UI refreshes immediately!)
  const [rules, setRules] = useState<CustomFieldRuleDefinition[]>(() =>
    rulesEngineService.getRulesForModule(targetModule)
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [showRuleTrace, setShowRuleTrace] = useState(false);

  useEffect(() => {
    setRules(rulesEngineService.getRulesForModule(targetModule));
    const unsubscribe = rulesEngineService.subscribe(() => {
      setRules(rulesEngineService.getRulesForModule(targetModule));
    });
    return unsubscribe;
  }, [targetModule]);

  // Merge current values with context data for comprehensive rule condition evaluation
  const evaluationContext = useMemo(() => {
    return { ...contextData, ...values };
  }, [contextData, values]);

  // Evaluate visibility for all rules in this module
  const evaluatedFields = useMemo(() => {
    return rules.map((rule) => {
      const isVisible = rulesEngineService.evaluateVisibility(rule, evaluationContext);
      const isRequired = rulesEngineService.evaluateIsRequired(rule, evaluationContext);
      const isDisabled = readOnly || rulesEngineService.evaluateDisabled(rule, evaluationContext);
      const currentValue = values[rule.key] !== undefined ? values[rule.key] : rule.defaultValue ?? '';
      const mappedDisplay = rulesEngineService.resolveMappedDisplayValue(rule, currentValue);

      return {
        rule,
        isVisible,
        isRequired,
        isDisabled,
        currentValue,
        mappedDisplay,
      };
    });
  }, [rules, evaluationContext, values, readOnly]);

  // Validate fields whenever values or rules change
  useEffect(() => {
    const nextErrors: Record<string, string[]> = {};
    evaluatedFields.forEach(({ rule, isVisible, currentValue }) => {
      if (isVisible) {
        const valRes: FieldValidationResult = rulesEngineService.validateField(
          rule,
          currentValue,
          evaluationContext
        );
        if (!valRes.isValid) {
          nextErrors[rule.key] = valRes.errors;
        }
      }
    });
    setFieldErrors(nextErrors);
  }, [evaluatedFields, evaluationContext]);

  const handleFieldChange = (key: string, val: any) => {
    setTouchedFields((prev) => ({ ...prev, [key]: true }));
    onChange(key, val);
  };

  const visibleFields = evaluatedFields.filter((f) => f.isVisible);
  const hiddenCount = evaluatedFields.length - visibleFields.length;

  if (rules.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden ${className}`}>
      {/* Header Bar */}
      <div className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-800/80 border border-blue-400/30 flex items-center justify-center text-blue-200 shadow-inner">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-xs tracking-tight text-white">{title}</h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900 text-blue-200 font-mono font-bold border border-blue-500/30">
                Rules Engine Active
              </span>
            </div>
            <p className="text-[11px] text-slate-300">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hiddenCount > 0 && (
            <span
              className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono"
              title="Fields dynamically hidden by conditional visibility rules"
            >
              👁️‍🗨️ {hiddenCount} conditional field{hiddenCount > 1 ? 's' : ''} hidden
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowRuleTrace(!showRuleTrace)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors cursor-pointer border border-white/20"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>{showRuleTrace ? 'Hide Rule Trace' : 'Inspect Rules'}</span>
          </button>
        </div>
      </div>

      {/* Real-time Rule Execution Trace Inspector */}
      {showRuleTrace && (
        <div className="bg-slate-950 text-slate-200 p-4 border-b border-slate-800 text-xs space-y-3 font-mono">
          <div className="flex items-center justify-between text-[11px] text-blue-300 border-b border-slate-800 pb-2">
            <span className="font-bold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              <span>Rules Engine Real-Time Evaluation Trace</span>
            </span>
            <span>Module: {targetModule}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
            {evaluatedFields.map(({ rule, isVisible, isRequired, isDisabled, currentValue, mappedDisplay }) => (
              <div
                key={rule.id}
                className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-1 text-[11px]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{rule.key}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      isVisible ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {isVisible ? 'VISIBLE' : 'HIDDEN BY RULE'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Required: <span className={isRequired ? 'text-amber-400 font-bold' : 'text-slate-500'}>{isRequired ? 'YES' : 'NO'}</span> | Locked: {isDisabled ? 'YES' : 'NO'}
                </div>
                {rule.validation?.regex && (
                  <div className="text-[10px] text-slate-400 truncate">
                    Regex: <code className="text-purple-300">{rule.validation.regex.pattern}</code>
                  </div>
                )}
                {rule.validation?.range && (
                  <div className="text-[10px] text-slate-400">
                    Range: [{rule.validation.range.min ?? '-∞'}, {rule.validation.range.max ?? '+∞'}]
                  </div>
                )}
                <div className="text-[10px] text-blue-300 pt-1 border-t border-slate-800/80 truncate">
                  Value: <span className="font-bold text-white">&quot;{String(currentValue)}&quot;</span>
                  {mappedDisplay !== String(currentValue) && (
                    <span className="text-emerald-400 ml-1">→ {mappedDisplay}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dynamic Fields Grid */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleFields.map(({ rule, isRequired, isDisabled, currentValue, mappedDisplay }) => {
            const errors = fieldErrors[rule.key] || [];
            const isTouched = touchedFields[rule.key];
            const hasError = errors.length > 0;
            const gridClass =
              rule.uiLogic?.gridSpan === 'full'
                ? 'col-span-full'
                : rule.uiLogic?.gridSpan === 2
                ? 'md:col-span-2'
                : 'col-span-1';

            return (
              <div key={rule.key} className={`space-y-1.5 ${gridClass}`}>
                {/* Field Label & Indicators */}
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>{rule.dealerDisplayLabel || rule.label}</span>
                    {isRequired && <span className="text-rose-500 font-bold" title="Mandatory field">*</span>}
                    {isDisabled && (
                      <span title="Read-only">
                        <Lock className="h-3 w-3 text-slate-400" />
                      </span>
                    )}
                  </label>

                  {/* Value Mapping Badge Preview */}
                  {mappedDisplay && mappedDisplay !== String(currentValue) && (
                    <span className="text-[10px] font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Mapped
                    </span>
                  )}
                </div>

                {/* Field Widget Rendering */}
                <div>
                  {rule.widgetType === 'select' ? (
                    <select
                      value={String(currentValue ?? '')}
                      disabled={isDisabled}
                      onChange={(e) => handleFieldChange(rule.key, e.target.value)}
                      className={`w-full px-3 py-2 text-xs rounded-xl border transition-all font-semibold ${
                        hasError
                          ? 'border-rose-300 bg-rose-50/50 text-rose-950 focus:border-rose-500'
                          : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-900'
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
                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                      <span className="text-xs text-slate-600 font-medium">
                        {rule.description || 'Enable / Disable toggle'}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(currentValue)}
                          disabled={isDisabled}
                          onChange={(e) => handleFieldChange(rule.key, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ) : rule.widgetType === 'date' ? (
                    <input
                      type="date"
                      value={String(currentValue ?? '')}
                      disabled={isDisabled}
                      onChange={(e) => handleFieldChange(rule.key, e.target.value)}
                      className={`w-full px-3 py-2 text-xs rounded-xl border transition-all ${
                        hasError
                          ? 'border-rose-300 bg-rose-50/50 text-rose-950 focus:border-rose-500'
                          : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-900 font-medium'
                      }`}
                    />
                  ) : rule.widgetType === 'textarea' ? (
                    <textarea
                      rows={2}
                      value={String(currentValue ?? '')}
                      placeholder={rule.uiLogic?.placeholder || 'Enter notes...'}
                      disabled={isDisabled}
                      onChange={(e) => handleFieldChange(rule.key, e.target.value)}
                      className={`w-full px-3 py-2 text-xs rounded-xl border transition-all ${
                        hasError
                          ? 'border-rose-300 bg-rose-50/50 text-rose-950 focus:border-rose-500'
                          : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-900 font-medium'
                      }`}
                    />
                  ) : (
                    <input
                      type={rule.widgetType === 'number' ? 'number' : 'text'}
                      step={rule.validation?.range?.step}
                      min={rule.validation?.range?.min}
                      max={rule.validation?.range?.max}
                      value={String(currentValue ?? '')}
                      placeholder={rule.uiLogic?.placeholder || `Enter ${rule.dealerDisplayLabel || rule.label}...`}
                      disabled={isDisabled}
                      onChange={(e) =>
                        handleFieldChange(
                          rule.key,
                          rule.widgetType === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value
                        )
                      }
                      className={`w-full px-3 py-2 text-xs rounded-xl border transition-all ${
                        hasError
                          ? 'border-rose-300 bg-rose-50/50 text-rose-950 focus:border-rose-500'
                          : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-900 font-medium'
                      }`}
                    />
                  )}
                </div>

                {/* Applied Mapped Value Presentation (if mapping exists) */}
                {mappedDisplay && mappedDisplay !== String(currentValue) && (
                  <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-200/80 text-[11px] font-semibold text-blue-950 flex items-center gap-1.5 shadow-2xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{mappedDisplay}</span>
                  </div>
                )}

                {/* Helper text or description */}
                {rule.uiLogic?.helperText && !hasError && (
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Info className="h-3 w-3 text-slate-400 shrink-0" />
                    <span>{rule.uiLogic.helperText}</span>
                  </p>
                )}

                {/* Live Inline Validation Error Messages */}
                {hasError && (
                  <div className="space-y-0.5">
                    {errors.map((err, errIdx) => (
                      <p key={errIdx} className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-rose-500 shrink-0" />
                        <span>{err}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
