import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { masterExportUtil } from '../../utils/masterExportUtil';
import {
  MasterConfig,
  MasterFieldDef,
} from '../../data/masterCatalogue';
import { masterValidationSchema } from '../../utils/masterValidationSchema';
import {
  Plus,
  Search,
  Filter,
  Sliders,
  Download,
  Edit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Building2,
  Wrench,
  Check,
  X,
  Sparkles,
  Layers,
  AlertCircle,
} from 'lucide-react';

interface ConfigurableMasterViewProps {
  master: MasterConfig;
  onUpdateMaster: (updated: MasterConfig) => void;
  isAdminTml: boolean;
}

export const ConfigurableMasterView: React.FC<ConfigurableMasterViewProps> = ({
  master,
  onUpdateMaster,
  isAdminTml,
}) => {
  const { showToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [buFilter, setBuFilter] = useState('All');
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  // New Parameter state
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'select' | 'boolean' | 'date'>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldMandatory, setNewFieldMandatory] = useState(false);

  // Record Form state
  const [recordFormData, setRecordFormData] = useState<Record<string, any>>({});
  const [recordFormErrors, setRecordFormErrors] = useState<Record<string, string>>({});

  const isEditableByCurrentRole = master.owner === 'TML_ADMIN' ? isAdminTml : true;

  // Filter records
  const filteredRecords = master.records.filter((rec) => {
    if (buFilter !== 'All' && rec.bu && rec.bu !== buFilter && !rec.bu.includes(buFilter)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return Object.values(rec).some((val) => String(val).toLowerCase().includes(q));
    }
    return true;
  });

  // Handle adding custom dynamic parameter / field
  const handleAddNewParameter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim()) return;

    const key =
      newFieldKey.trim().toLowerCase().replace(/\s+/g, '_') ||
      newFieldLabel.trim().toLowerCase().replace(/\s+/g, '_');

    if (master.fields.some((f) => f.key === key)) {
      showToast('A field with this parameter key already exists.', 'error');
      return;
    }

    const defValidation = masterValidationSchema.validateCustomFieldDefinition({
      label: newFieldLabel.trim(),
      key,
      type: newFieldType,
      optionsString: newFieldOptions,
    });

    if (!defValidation.isValid && defValidation.error) {
      showToast(defValidation.error, 'error');
      return;
    }

    const fieldDef: MasterFieldDef = {
      key,
      label: newFieldLabel.trim(),
      type: newFieldType,
      mandatory: newFieldMandatory,
      isCustom: true,
      options:
        newFieldType === 'select'
          ? newFieldOptions.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
    };

    const updatedMaster: MasterConfig = {
      ...master,
      fields: [...master.fields, fieldDef],
      records: master.records.map((r) => ({
        ...r,
        [key]:
          newFieldType === 'select' && fieldDef.options
            ? fieldDef.options[0]
            : newFieldType === 'number'
            ? 0
            : newFieldType === 'date'
            ? new Date().toISOString().split('T')[0]
            : newFieldType === 'boolean'
            ? false
            : '—',
      })),
    };

    onUpdateMaster(updatedMaster);
    setIsAddFieldModalOpen(false);
    setNewFieldLabel('');
    setNewFieldKey('');
    setNewFieldOptions('');
    setNewFieldMandatory(false);
    showToast(`Added custom parameter "${fieldDef.label}" with ${fieldDef.type} validation!`, 'success');
  };

  // Open add record modal
  const handleOpenAddRecord = () => {
    const initData: Record<string, any> = { id: `REC-${Date.now().toString().slice(-4)}` };
    master.fields.forEach((f) => {
      initData[f.key] =
        f.type === 'select' && f.options
          ? f.options[0]
          : f.type === 'number'
          ? 0
          : f.type === 'date'
          ? new Date().toISOString().split('T')[0]
          : f.type === 'boolean'
          ? false
          : '';
    });
    setRecordFormData(initData);
    setRecordFormErrors({});
    setEditingRecordId(null);
    setIsAddRecordModalOpen(true);
  };

  // Open edit record modal
  const handleOpenEditRecord = (record: Record<string, any>) => {
    setRecordFormData({ ...record });
    setRecordFormErrors({});
    setEditingRecordId(record.id);
    setIsAddRecordModalOpen(true);
  };

  // Save record with validation
  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();

    const validationResult = masterValidationSchema.validateRecord(master.fields, recordFormData, master.id);
    if (!validationResult.isValid) {
      setRecordFormErrors(validationResult.errors);
      showToast('Validation failed: Please correct invalid field values.', 'error');
      return;
    }

    const sanitizedData = validationResult.sanitizedRecord;
    let updatedRecords: Array<Record<string, any>>;

    if (editingRecordId) {
      updatedRecords = master.records.map((r) =>
        r.id === editingRecordId ? { ...sanitizedData } : r
      );
      showToast('Record validated & updated successfully', 'success');
    } else {
      updatedRecords = [...master.records, { ...sanitizedData }];
      showToast('New record validated & created in master catalogue', 'success');
    }

    onUpdateMaster({ ...master, records: updatedRecords });
    setIsAddRecordModalOpen(false);
  };

  // Toggle active/inactive
  const handleToggleActive = (recId: string) => {
    const updated = master.records.map((r) => {
      if (r.id === recId) {
        const nextVal = r.active === 'Y' ? 'N' : 'Y';
        return { ...r, active: nextVal };
      }
      return r;
    });
    onUpdateMaster({ ...master, records: updated });
    showToast('Record status updated (Historical audit retained)', 'info');
  };

  return (
    <div className="space-y-4">
      {/* Master Overview Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{master.name}</h2>
              {master.owner === 'TML_ADMIN' ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200 flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-blue-700" />
                  <span>Tata Motors OEM Master</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 flex items-center gap-1">
                  <Wrench className="h-3 w-3 text-emerald-700" />
                  <span>Dealership Service Master</span>
                </span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold font-mono">
                {master.category}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">{master.description}</p>
          </div>

          {/* Action Buttons: Add Custom Parameter & Add Record */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddFieldModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs"
              title="Add a configurable custom attribute to this master schema"
            >
              <Sliders className="h-3.5 w-3.5 text-blue-600" />
              <span>+ Configure Fields</span>
            </button>

            {isEditableByCurrentRole ? (
              <button
                onClick={handleOpenAddRecord}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add Record</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 flex items-center gap-1 italic">
                <Lock className="h-3.5 w-3.5" /> Read-Only for Dealership
              </span>
            )}
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500">Filter BU:</span>
              <select
                value={buFilter}
                onChange={(e) => setBuFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-semibold text-slate-700 focus:outline-hidden"
              >
                <option value="All">All Business Units</option>
                <option value="PV">Passenger Vehicles (PV)</option>
                <option value="EV">Electric Vehicles (EV)</option>
                <option value="CV">Commercial Vehicles (CV)</option>
              </select>
            </div>

            <div className="relative min-w-[220px]">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search master records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">
              {filteredRecords.length} / {master.records.length} records • {master.fields.length} schema fields
            </span>
            <button
              onClick={() => {
                masterExportUtil.exportToCSV({
                  masterName: master.name,
                  columns: master.fields.map((f) => ({ key: f.key, label: f.label })),
                  data: filteredRecords,
                });
                showToast(`Exported ${filteredRecords.length} ${master.name} records as CSV`, 'success');
              }}
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Export CSV"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Master Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#002B49] text-white font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                {master.fields.map((f) => (
                  <th key={f.key} className="py-3 px-3.5">
                    <span className="flex items-center gap-1">
                      <span>{f.label}</span>
                      {f.mandatory && <span className="text-amber-300">*</span>}
                    </span>
                  </th>
                ))}
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                  {master.fields.map((f) => {
                    const val = row[f.key];

                    if (f.key === 'active') {
                      return (
                        <td key={f.key} className="py-2.5 px-3.5">
                          <button
                            disabled={!isEditableByCurrentRole}
                            onClick={() => handleToggleActive(row.id)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                              val === 'Y'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {val === 'Y' ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                      );
                    }

                    return (
                      <td key={f.key} className="py-2.5 px-3.5 text-slate-700">
                        {val !== undefined && val !== null ? String(val) : '—'}
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3.5 text-right">
                    {isEditableByCurrentRole ? (
                      <button
                        onClick={() => handleOpenEditRecord(row)}
                        className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Edit Record"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className="text-slate-300 font-mono text-[10px]">Read-only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD CONFIGURABLE CUSTOM PARAMETER / SCHEMA FIELD */}
      {isAddFieldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-fade-in text-xs">
            <div className="px-5 py-4 bg-[#002B49] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Add Configurable Schema Parameter</h3>
                <p className="text-[11px] text-blue-200">Expand {master.name} with new attributes</p>
              </div>
              <button
                onClick={() => setIsAddFieldModalOpen(false)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewParameter} className="p-5 space-y-3.5">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Parameter Display Label *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Failure Root Cause / Warranty Limit"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Field Key (Internal ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. failure_root_cause"
                  value={newFieldKey}
                  onChange={(e) => setNewFieldKey(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Data Type</label>
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden"
                  >
                    <option value="text">Text String</option>
                    <option value="number">Number</option>
                    <option value="select">Dropdown LOV</option>
                    <option value="boolean">Boolean</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={newFieldMandatory}
                      onChange={(e) => setNewFieldMandatory(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Is Mandatory</span>
                  </label>
                </div>
              </div>

              {newFieldType === 'select' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Dropdown Options (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="Option 1, Option 2, Option 3"
                    value={newFieldOptions}
                    onChange={(e) => setNewFieldOptions(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddFieldModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold cursor-pointer"
                >
                  Add Field to Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT MASTER RECORD */}
      {isAddRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-fade-in text-xs max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 bg-[#002B49] text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-sm">
                  {editingRecordId ? 'Edit Master Record' : 'Add New Record'}
                </h3>
                <p className="text-[11px] text-blue-200">{master.name}</p>
              </div>
              <button
                onClick={() => setIsAddRecordModalOpen(false)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Validation Errors Summary Banner */}
            {Object.keys(recordFormErrors).length > 0 && (
              <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 shrink-0">
                <AlertCircle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold">
                    Validation required: {Object.keys(recordFormErrors).length} error{Object.keys(recordFormErrors).length > 1 ? 's' : ''} found
                  </div>
                  <div className="text-[11px] text-rose-700">
                    Ensure Date (YYYY-MM-DD), Number, and Dropdown values comply with the schema.
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveRecord} className="p-5 space-y-3 overflow-y-auto flex-1">
              {master.fields.map((f) => {
                const hasError = Boolean(recordFormErrors[f.key]);
                return (
                  <div key={f.key} className="space-y-1">
                    <label className="font-bold text-slate-700 flex items-center justify-between text-xs">
                      <span>
                        {f.label} {f.mandatory && <span className="text-rose-500">*</span>}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-normal">
                        [{f.type}]
                      </span>
                    </label>

                    {f.type === 'select' && f.options ? (
                      <select
                        value={recordFormData[f.key] !== undefined ? recordFormData[f.key] : f.options[0]}
                        onChange={(e) =>
                          setRecordFormData({ ...recordFormData, [f.key]: e.target.value })
                        }
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs font-semibold focus:outline-hidden bg-white transition-colors cursor-pointer ${
                          hasError
                            ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-500'
                            : 'border-slate-200 focus:border-blue-400'
                        }`}
                      >
                        {!f.mandatory && <option value="">-- Select {f.label} --</option>}
                        {f.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : f.type === 'number' ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={recordFormData[f.key] !== undefined ? recordFormData[f.key] : ''}
                        onChange={(e) =>
                          setRecordFormData({
                            ...recordFormData,
                            [f.key]: e.target.value,
                          })
                        }
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-hidden font-mono transition-colors ${
                          hasError
                            ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-500'
                            : 'border-slate-200 focus:border-blue-400'
                        }`}
                        placeholder={`Enter numeric ${f.label}`}
                      />
                    ) : f.type === 'date' ? (
                      <input
                        type="date"
                        value={recordFormData[f.key] || ''}
                        onChange={(e) =>
                          setRecordFormData({ ...recordFormData, [f.key]: e.target.value })
                        }
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-hidden font-mono transition-colors ${
                          hasError
                            ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-500'
                            : 'border-slate-200 focus:border-blue-400'
                        }`}
                      />
                    ) : f.type === 'boolean' ? (
                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={Boolean(recordFormData[f.key])}
                          onChange={(e) =>
                            setRecordFormData({ ...recordFormData, [f.key]: e.target.checked })
                          }
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-slate-600 font-semibold">Enabled / Active</span>
                      </label>
                    ) : (
                      <input
                        type="text"
                        value={recordFormData[f.key] !== undefined ? recordFormData[f.key] : ''}
                        onChange={(e) =>
                          setRecordFormData({ ...recordFormData, [f.key]: e.target.value })
                        }
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-hidden transition-colors ${
                          hasError
                            ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-500'
                            : 'border-slate-200 focus:border-blue-400'
                        }`}
                        placeholder={`Enter ${f.label}`}
                      />
                    )}

                    {hasError && (
                      <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium pt-0.5">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>{recordFormErrors[f.key]}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddRecordModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold cursor-pointer"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
