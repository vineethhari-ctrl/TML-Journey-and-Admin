import React, { useState, useMemo } from 'react';
import { MasterConfig, MasterFieldDef } from '../../data/masterCatalogue';
import { masterValidationSchema } from '../../utils/masterValidationSchema';
import {
  CheckSquare,
  X,
  AlertTriangle,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle2,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface BulkEditFieldChange {
  fieldKey: string;
  enabled: boolean;
  value: any;
}

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRowIds: string[];
  master: MasterConfig;
  onApplyBulkEdit: (
    updatedFields: Record<string, any>,
    selectedIds: string[],
    actionSummary: string
  ) => void;
  onBulkDelete?: (selectedIds: string[]) => void;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  onClose,
  selectedRowIds,
  master,
  onApplyBulkEdit,
  onBulkDelete,
}) => {
  // We allow modifying editable fields (excluding 'id')
  const editableFields = useMemo(() => {
    return master.fields.filter((f) => f.key !== 'id');
  }, [master.fields]);

  // Track enabled modifications per field
  const [fieldChanges, setFieldChanges] = useState<Record<string, { enabled: boolean; value: any }>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize fieldChanges when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const initial: Record<string, { enabled: boolean; value: any }> = {};
      editableFields.forEach((f) => {
        let defaultVal: any = '';
        if (f.type === 'boolean') defaultVal = false;
        else if (f.type === 'select') defaultVal = f.options && f.options.length > 0 ? f.options[0] : '';
        else if (f.type === 'number') defaultVal = '';
        else if (f.key === 'active' || f.key === 'status') defaultVal = 'Y';
        initial[f.key] = { enabled: false, value: defaultVal };
      });
      setFieldChanges(initial);
      setShowDeleteConfirm(false);
      setSubmitError(null);
    }
  }, [isOpen, editableFields]);

  if (!isOpen) return null;

  const selectedCount = selectedRowIds.length;
  const activeFieldsToUpdate = Object.entries(fieldChanges).filter(
    ([_, state]) => state.enabled
  );

  const handleToggleField = (key: string, enabled: boolean) => {
    setFieldChanges((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        enabled,
      },
    }));
  };

  const handleFieldValueChange = (key: string, value: any) => {
    setFieldChanges((prev) => ({
      ...prev,
      [key]: {
        enabled: true, // auto-enable field when admin edits value
        value,
      },
    }));
  };

  // Quick Preset Handlers
  const handlePresetStatus = (statusValue: 'Y' | 'N') => {
    const statusField = editableFields.find(
      (f) =>
        f.key.toLowerCase() === 'active' ||
        f.key.toLowerCase() === 'status' ||
        f.key.toLowerCase() === 'isactive'
    );
    if (!statusField) return;

    let targetVal: any = statusValue;
    if (statusField.type === 'boolean') {
      targetVal = statusValue === 'Y';
    } else if (statusField.type === 'select') {
      // check if options has 'Active' / 'Inactive' or 'Y' / 'N'
      const hasActiveWord = statusField.options?.some(
        (o) => o.toLowerCase() === (statusValue === 'Y' ? 'active' : 'inactive')
      );
      if (hasActiveWord) {
        targetVal = statusValue === 'Y' ? 'Active' : 'Inactive';
      }
    }

    setFieldChanges((prev) => ({
      ...prev,
      [statusField.key]: {
        enabled: true,
        value: targetVal,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeFieldsToUpdate.length === 0) return;

    const updates: Record<string, any> = {};
    const summaryParts: string[] = [];

    const errors: string[] = [];

    activeFieldsToUpdate.forEach(([key, state]) => {
      const fieldDef = master.fields.find((f) => f.key === key);
      const label = fieldDef?.label || key;
      // Same schema rules as single-row edits, so bulk edits can't store invalid values
      if (fieldDef) {
        const res = masterValidationSchema.validateField(fieldDef, state.value);
        if (!res.isValid) {
          errors.push(res.error || `${label} is invalid.`);
          return;
        }
        updates[key] = res.sanitizedValue;
      } else {
        updates[key] = state.value;
      }
      summaryParts.push(`${label} ➔ "${String(updates[key])}"`);
    });

    if (errors.length > 0) {
      setSubmitError(errors.join(' '));
      return;
    }

    const summary = `Bulk updated ${selectedCount} record(s): ${summaryParts.join(', ')}`;
    onApplyBulkEdit(updates, selectedRowIds, summary);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in text-xs">
        {/* Header */}
        <div className="px-6 py-4 bg-[#002B49] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center">
              <CheckSquare className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">Bulk Edit Records</h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 font-mono text-[10px] font-bold">
                  {selectedCount} rows selected
                </span>
              </div>
              <p className="text-[11px] text-blue-200">
                Apply shared attributes or status updates across selected items in{' '}
                <strong className="text-white">{master.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Action Presets Bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500">Quick Presets:</span>
            <button
              type="button"
              onClick={() => handlePresetStatus('Y')}
              className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-[11px] cursor-pointer flex items-center gap-1 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Mark All Active</span>
            </button>
            <button
              type="button"
              onClick={() => handlePresetStatus('N')}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold text-[11px] cursor-pointer flex items-center gap-1 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-slate-500" />
              <span>Mark All Inactive</span>
            </button>
          </div>

          {onBulkDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-[11px] cursor-pointer flex items-center gap-1 transition-colors ml-auto"
            >
              <Trash2 className="h-3 w-3 text-rose-600" />
              <span>Delete {selectedCount} Selected</span>
            </button>
          )}
        </div>

        {/* Bulk Delete Confirmation Banner if active */}
        {showDeleteConfirm && (
          <div className="px-6 py-3 bg-rose-50 border-b border-rose-200 flex items-center justify-between gap-3 text-rose-900 animate-fade-in shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <div className="text-[11px]">
                <strong>Warning:</strong> Are you sure you want to permanently delete these{' '}
                <strong>{selectedCount}</strong> records from {master.name}?
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (onBulkDelete) {
                    onBulkDelete(selectedRowIds);
                    onClose();
                  }
                }}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer text-xs shadow-2xs"
              >
                Yes, Delete Rows
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg cursor-pointer text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Form Body: Select which fields to modify */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 space-y-4 flex-1 overflow-y-auto">
            <div className="p-3 bg-blue-50/60 border border-blue-200/70 rounded-xl flex items-start gap-2.5 text-blue-900">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                Check the toggle next to any field you wish to overwrite. Only toggled fields will
                be modified; all unselected columns will preserve their original values.
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-100">
                <span>Field To Overwrite</span>
                <span>Target Value for {selectedCount} rows</span>
              </div>

              {editableFields.map((field) => {
                const changeState = fieldChanges[field.key] || {
                  enabled: false,
                  value: '',
                };
                const isEnabled = changeState.enabled;

                return (
                  <div
                    key={field.key}
                    className={`p-3 rounded-xl border transition-all ${
                      isEnabled
                        ? 'border-blue-300 bg-blue-50/20 shadow-2xs'
                        : 'border-slate-200/80 bg-white hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Field Toggle Checkbox & Label */}
                      <label className="flex items-center gap-2.5 cursor-pointer select-none min-w-[200px]">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => handleToggleField(field.key, e.target.checked)}
                          className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <div>
                          <span
                            className={`font-semibold text-xs ${
                              isEnabled ? 'text-blue-900' : 'text-slate-700'
                            }`}
                          >
                            {field.label}
                          </span>
                          <span className="block font-mono text-[10px] text-slate-400">
                            {field.key} • {field.type}
                          </span>
                        </div>
                      </label>

                      {/* Field Value Input (enabled / disabled) */}
                      <div className="flex-1 sm:max-w-xs">
                        {field.type === 'select' ? (
                          <select
                            disabled={!isEnabled}
                            value={changeState.value}
                            onChange={(e) =>
                              handleFieldValueChange(field.key, e.target.value)
                            }
                            className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-hidden transition-colors ${
                              isEnabled
                                ? 'bg-white border-blue-300 text-slate-800 focus:ring-1 focus:ring-blue-500'
                                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <option value="">-- Select Value --</option>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'boolean' || field.key === 'active' ? (
                          <select
                            disabled={!isEnabled}
                            value={String(changeState.value)}
                            onChange={(e) => {
                              const val =
                                field.type === 'boolean'
                                  ? e.target.value === 'true'
                                  : e.target.value;
                              handleFieldValueChange(field.key, val);
                            }}
                            className={`w-full px-3 py-1.5 rounded-lg border text-xs font-semibold focus:outline-hidden transition-colors ${
                              isEnabled
                                ? 'bg-white border-blue-300 text-slate-800 focus:ring-1 focus:ring-blue-500'
                                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <option value="Y">Active / Yes (Y)</option>
                            <option value="N">Inactive / No (N)</option>
                          </select>
                        ) : field.type === 'number' ? (
                          <input
                            type="number"
                            disabled={!isEnabled}
                            value={changeState.value}
                            placeholder="Enter new numeric value..."
                            onChange={(e) =>
                              handleFieldValueChange(
                                field.key,
                                e.target.value === '' ? '' : Number(e.target.value)
                              )
                            }
                            className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-hidden transition-colors ${
                              isEnabled
                                ? 'bg-white border-blue-300 text-slate-800 focus:ring-1 focus:ring-blue-500'
                                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          />
                        ) : (
                          <input
                            type="text"
                            disabled={!isEnabled}
                            value={changeState.value}
                            placeholder={`Enter new ${field.label.toLowerCase()}...`}
                            onChange={(e) =>
                              handleFieldValueChange(field.key, e.target.value)
                            }
                            className={`w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-hidden transition-colors ${
                              isEnabled
                                ? 'bg-white border-blue-300 text-slate-800 focus:ring-1 focus:ring-blue-500'
                                : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <div className="text-[11px] text-slate-500 font-medium">
              {activeFieldsToUpdate.length > 0 ? (
                <span className="text-blue-800 font-semibold">
                  Modifying {activeFieldsToUpdate.length} attribute
                  {activeFieldsToUpdate.length > 1 ? 's' : ''} across {selectedCount} row
                  {selectedCount > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="text-slate-400">
                  Select at least one field to update
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {submitError && (
                <span className="text-rose-700 font-semibold max-w-xs text-[11px]" role="alert">
                  {submitError}
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={activeFieldsToUpdate.length === 0}
                className={`px-4 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors ${
                  activeFieldsToUpdate.length > 0
                    ? 'bg-blue-900 hover:bg-blue-800 text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                <span>Apply to {selectedCount} Rows</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
