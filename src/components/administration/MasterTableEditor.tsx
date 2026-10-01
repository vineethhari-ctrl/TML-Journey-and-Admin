import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MasterConfig, MasterFieldDef } from '../../data/masterCatalogue';
import {
  Plus,
  Search,
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
  Calendar,
  Layers,
  ChevronDown,
  Info,
  RefreshCw,
  History,
  ShieldCheck,
  Clock,
  CheckSquare,
  FileSpreadsheet,
  Upload,
  Filter,
  FilterX,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  SlidersHorizontal,
  Undo2,
  Redo2,
  Settings,
  Sparkles,
  ExternalLink,
  Eye,
  EyeOff,
  AlertCircle,
  Smartphone,
} from 'lucide-react';
import { AuditTrailMiddleware } from '../../middleware/auditTrailMiddleware';
import { masterExportUtil } from '../../utils/masterExportUtil';
import { masterValidationSchema } from '../../utils/masterValidationSchema';
import { MasterDataImportModal } from './MasterDataImportModal';
import { BatchUndoModal, MasterChangeSnapshot } from './BatchUndoModal';
import { BulkEditModal } from './BulkEditModal';
import { mergeImportedRecords } from '../../utils/recordMerge';

interface MasterTableEditorProps {
  master: MasterConfig;
  onUpdateMaster: (updated: MasterConfig) => void;
  isAdminTml: boolean;
  readOnly?: boolean;
  onOpenChangeLog?: () => void;
  onOpenDealerPreview?: () => void;
}

export const MasterTableEditor: React.FC<MasterTableEditorProps> = ({
  master,
  onUpdateMaster,
  isAdminTml,
  readOnly = false,
  onOpenChangeLog,
  onOpenDealerPreview,
}) => {
  const { showToast, currentUser, logAudit, auditLogs } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchColumnScope, setSearchColumnScope] = useState<string>('ALL');
  const [buFilter, setBuFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [columnTypeFilter, setColumnTypeFilter] = useState<'ALL' | 'text' | 'number' | 'select' | 'boolean' | 'date'>('ALL');
  const [selectedColumnKey, setSelectedColumnKey] = useState<string>('');
  const [selectedColumnValue, setSelectedColumnValue] = useState<string>('ALL');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isFilterPanelExpanded, setIsFilterPanelExpanded] = useState<boolean>(true);

  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isAuditTrailModalOpen, setIsAuditTrailModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<Record<string, any> | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBatchUndoModalOpen, setIsBatchUndoModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);

  // Bulk Selection State (row IDs)
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Selections and column-specific filters belong to one master; clear them when switching
  // tabs so bulk actions can never target rows the user can no longer see.
  useEffect(() => {
    setSelectedRowIds([]);
    setSearchColumnScope('ALL');
    setSelectedColumnKey('');
    setSelectedColumnValue('ALL');
    setSortColumn('');
    setRecentlyBulkImported(null);
  }, [master.id]);

  // Session Undo / Redo Stacks (isolated per master.id to guarantee data safety across tabs)
  const [undoStackMap, setUndoStackMap] = useState<Record<string, MasterChangeSnapshot[]>>({});
  const [redoStackMap, setRedoStackMap] = useState<Record<string, MasterChangeSnapshot[]>>({});
  const [recentlyBulkImported, setRecentlyBulkImported] = useState<{
    count: number;
    description: string;
    mode: string;
  } | null>(null);

  const currentUndoStack = useMemo(
    () => undoStackMap[master.id] || [],
    [undoStackMap, master.id]
  );
  const currentRedoStack = useMemo(
    () => redoStackMap[master.id] || [],
    [redoStackMap, master.id]
  );

  // Status key detection in master schema
  const statusFieldKey = useMemo(() => {
    const found = master.fields.find(
      (f) =>
        f.key.toLowerCase() === 'active' ||
        f.key.toLowerCase() === 'status' ||
        f.key.toLowerCase() === 'isactive' ||
        f.key.toLowerCase().includes('status')
    );
    return found ? found.key : null;
  }, [master.fields]);

  // Distinct values for chosen column filter
  const distinctColumnValues = useMemo(() => {
    if (!selectedColumnKey) return [];
    const valuesSet = new Set<string>();
    master.records.forEach((rec) => {
      const val = rec[selectedColumnKey];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        valuesSet.add(String(val));
      }
    });
    return Array.from(valuesSet).sort();
  }, [master.records, selectedColumnKey]);

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (searchColumnScope !== 'ALL') count++;
    if (buFilter !== 'All') count++;
    if (statusFilter !== 'ALL') count++;
    if (columnTypeFilter !== 'ALL') count++;
    if (selectedColumnKey && selectedColumnValue !== 'ALL') count++;
    return count;
  }, [searchQuery, searchColumnScope, buFilter, statusFilter, columnTypeFilter, selectedColumnKey, selectedColumnValue]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSearchColumnScope('ALL');
    setBuFilter('All');
    setStatusFilter('ALL');
    setColumnTypeFilter('ALL');
    setSelectedColumnKey('');
    setSelectedColumnValue('ALL');
    setSortColumn('');
    setSortDirection('asc');
  };

  // Header column click sort toggle
  const handleSortToggle = (colKey: string) => {
    if (sortColumn === colKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn('');
        setSortDirection('asc');
      }
    } else {
      setSortColumn(colKey);
      setSortDirection('asc');
    }
  };

  // Audit logs specific to this master
  const masterAuditLogs = useMemo(() => {
    return auditLogs.filter(
      (l) => l.entity.includes(master.name) || l.entity.includes(master.id)
    );
  }, [auditLogs, master.name, master.id]);

  // New Custom Parameter / Field state
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'select' | 'boolean' | 'date'>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldMandatory, setNewFieldMandatory] = useState(false);
  const [newFieldDefaultVal, setNewFieldDefaultVal] = useState('');
  const [newFieldMinNum, setNewFieldMinNum] = useState<string>('');
  const [newFieldMaxNum, setNewFieldMaxNum] = useState<string>('');
  const [newFieldMinDate, setNewFieldMinDate] = useState<string>('');
  const [newFieldMaxDate, setNewFieldMaxDate] = useState<string>('');
  const [newFieldDisplayInDealerApp, setNewFieldDisplayInDealerApp] = useState(true);
  const [newFieldDealerTargetModule, setNewFieldDealerTargetModule] = useState<'vehicle_journey' | 'job_card' | 'reception' | 'workshop_floor' | 'general'>('vehicle_journey');
  const [newFieldDealerDisplayLabel, setNewFieldDealerDisplayLabel] = useState('');
  const [newFieldValueMappings, setNewFieldValueMappings] = useState<Array<{ raw: string; mapped: string }>>([
    { raw: '', mapped: '' },
  ]);

  // Edit Existing Field Definition & Mapping Modal state
  const [editingFieldConfig, setEditingFieldConfig] = useState<MasterFieldDef | null>(null);
  const [editFieldDisplayInDealerApp, setEditFieldDisplayInDealerApp] = useState(false);
  const [editFieldDealerTargetModule, setEditFieldDealerTargetModule] = useState<'vehicle_journey' | 'job_card' | 'reception' | 'workshop_floor' | 'general'>('vehicle_journey');
  const [editFieldDealerDisplayLabel, setEditFieldDealerDisplayLabel] = useState('');
  const [editFieldValueMappings, setEditFieldValueMappings] = useState<Array<{ raw: string; mapped: string }>>([]);

  // Global ESC key listener to close any open modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddFieldModalOpen) setIsAddFieldModalOpen(false);
        if (editingFieldConfig) setEditingFieldConfig(null);
        if (isRecordModalOpen) setIsRecordModalOpen(false);
        if (deletingRecord) setDeletingRecord(null);
        if (isAuditTrailModalOpen) setIsAuditTrailModalOpen(false);
        if (isImportModalOpen) setIsImportModalOpen(false);
        if (isBatchUndoModalOpen) setIsBatchUndoModalOpen(false);
        if (isBulkEditModalOpen) setIsBulkEditModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isAddFieldModalOpen,
    editingFieldConfig,
    isRecordModalOpen,
    deletingRecord,
    isAuditTrailModalOpen,
    isImportModalOpen,
    isBatchUndoModalOpen,
    isBulkEditModalOpen,
  ]);

  // Form generator state
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Real-time Field change handler with live validation
  const handleFormFieldChange = (fieldKey: string, value: any) => {
    const updatedForm = { ...formData, [fieldKey]: value };
    setFormData(updatedForm);

    const targetField = master.fields.find((f) => f.key === fieldKey);
    if (targetField) {
      const fieldRes = masterValidationSchema.validateField(targetField, value);
      setFormErrors((prev) => {
        const next = { ...prev };
        if (!fieldRes.isValid && fieldRes.error) {
          next[fieldKey] = fieldRes.error;
        } else {
          delete next[fieldKey];
        }
        return next;
      });
    }
  };

  // Real-time Field blur handler
  const handleFormFieldBlur = (field: MasterFieldDef) => {
    const fieldRes = masterValidationSchema.validateField(field, formData[field.key]);
    setFormErrors((prev) => {
      const next = { ...prev };
      if (!fieldRes.isValid && fieldRes.error) {
        next[field.key] = fieldRes.error;
      } else {
        delete next[field.key];
      }
      return next;
    });
  };

  const canEdit = !readOnly && (master.owner === 'TML_ADMIN' ? isAdminTml : true);
  const canCustomizeSchema = !readOnly; // Administrators can customize schema parameters & value mappings across masters

  // Enhanced Filtered & Sorted records
  const filteredRecords = useMemo(() => {
    let result = master.records.filter((rec) => {
      // 1. BU Filter
      if (buFilter !== 'All' && rec.bu && rec.bu !== buFilter && !String(rec.bu).includes(buFilter)) {
        return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL') {
        const keyToCheck = statusFieldKey || 'active';
        const val = rec[keyToCheck] !== undefined ? rec[keyToCheck] : rec['status'];
        const strVal = String(val ?? '').toLowerCase();
        const isActive = strVal === 'y' || strVal === 'active' || strVal === 'true' || val === true;

        if (statusFilter === 'ACTIVE' && !isActive) return false;
        if (statusFilter === 'INACTIVE' && isActive) return false;
      }

      // 3. Dynamic Specific Column Value Filter
      if (selectedColumnKey && selectedColumnValue !== 'ALL') {
        const val = rec[selectedColumnKey];
        if (String(val ?? '') !== selectedColumnValue) {
          return false;
        }
      }

      // 4. Column Type Filter
      if (columnTypeFilter !== 'ALL') {
        const fieldsOfType = master.fields.filter((f) => f.type === columnTypeFilter);
        if (fieldsOfType.length > 0) {
          const hasValForType = fieldsOfType.some(
            (f) => rec[f.key] !== undefined && rec[f.key] !== null && String(rec[f.key]).trim() !== ''
          );
          if (!hasValForType) return false;
        }
      }

      // 5. Global or Scoped Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (searchColumnScope === 'ALL') {
          const matches =
            String(rec.id || '').toLowerCase().includes(q) ||
            Object.values(rec).some((val) => String(val ?? '').toLowerCase().includes(q));
          if (!matches) return false;
        } else {
          const val = searchColumnScope === 'id' ? rec.id : rec[searchColumnScope];
          if (!String(val ?? '').toLowerCase().includes(q)) {
            return false;
          }
        }
      }

      return true;
    });

    // 6. Sorting
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        const comp = String(valA).localeCompare(String(valB), undefined, { numeric: true });
        return sortDirection === 'asc' ? comp : -comp;
      });
    }

    return result;
  }, [
    master.records,
    buFilter,
    statusFilter,
    statusFieldKey,
    selectedColumnKey,
    selectedColumnValue,
    columnTypeFilter,
    master.fields,
    searchQuery,
    searchColumnScope,
    sortColumn,
    sortDirection,
  ]);

  // Open Add Record Modal
  const handleOpenAddRecord = () => {
    const existingIds = new Set(master.records.map((r) => String(r.id)));
    let newId = '';
    for (let n = master.records.length + 1; !newId || existingIds.has(newId); n++) {
      newId = `${master.id.slice(0, 3).toUpperCase()}-${String(n).padStart(3, '0')}`;
    }
    const initial: Record<string, any> = { id: newId };
    master.fields.forEach((f) => {
      if (f.type === 'select' && f.options && f.options.length > 0) {
        initial[f.key] = f.options[0];
      } else if (f.type === 'number') {
        initial[f.key] = 0;
      } else if (f.type === 'boolean') {
        initial[f.key] = false;
      } else if (f.type === 'date') {
        initial[f.key] = new Date().toISOString().split('T')[0];
      } else {
        initial[f.key] = '';
      }
    });
    setFormData(initial);
    setFormErrors({});
    setEditingRecordId(null);
    setIsRecordModalOpen(true);
  };

  // Open Edit Record Modal
  const handleOpenEditRecord = (rec: Record<string, any>) => {
    setFormData({ ...rec });
    setFormErrors({});
    setEditingRecordId(rec.id);
    setIsRecordModalOpen(true);
  };

  // Helper to record a snapshot of the master before making a mutation
  const recordSnapshot = (
    actionType: MasterChangeSnapshot['actionType'],
    description: string,
    affectedCount: number,
    newMasterState: MasterConfig,
    details?: string
  ) => {
    const now = new Date();
    const timeDisplay = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const snapshot: MasterChangeSnapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: now.toISOString(),
      timeDisplay,
      actionType,
      description,
      details,
      affectedCount,
      previousMaster: JSON.parse(JSON.stringify(master)),
      currentMaster: JSON.parse(JSON.stringify(newMasterState)),
      user: {
        userId: currentUser.userId,
        name: currentUser.name,
      },
    };

    setUndoStackMap((prev) => ({
      ...prev,
      [master.id]: [snapshot, ...(prev[master.id] || [])],
    }));
    setRedoStackMap((prev) => ({
      ...prev,
      [master.id]: [],
    }));
  };

  // Quick Undo: Revert the most recent modification
  const handleQuickUndo = () => {
    if (currentUndoStack.length === 0) {
      showToast('No changes in this session to undo.', 'info');
      return;
    }

    const [lastSnapshot, ...remainingUndo] = currentUndoStack;
    const restoredMaster = lastSnapshot.previousMaster;

    setUndoStackMap((prev) => ({
      ...prev,
      [master.id]: remainingUndo,
    }));
    setRedoStackMap((prev) => ({
      ...prev,
      [master.id]: [lastSnapshot, ...(prev[master.id] || [])],
    }));

    onUpdateMaster(restoredMaster);

    logAudit(
      'Master Data Batch Undo',
      'Masters Maintenance',
      `${master.name} (Undo Last Action)`,
      'Session Rollback Engine',
      `Reverted "${lastSnapshot.description}". Records restored from ${master.records.length} to ${restoredMaster.records.length}.`,
      'SUCCESS'
    );

    showToast(`Reverted: "${lastSnapshot.description}"`, 'success');
  };

  // Quick Redo: Reapply the reverted modification
  const handleQuickRedo = () => {
    if (currentRedoStack.length === 0) return;

    const [redoItem, ...remainingRedo] = currentRedoStack;
    setRedoStackMap((prev) => ({
      ...prev,
      [master.id]: remainingRedo,
    }));
    setUndoStackMap((prev) => ({
      ...prev,
      [master.id]: [redoItem, ...(prev[master.id] || [])],
    }));

    onUpdateMaster(redoItem.currentMaster);

    showToast(`Redo applied: "${redoItem.description}"`, 'info');
  };

  // Batch Rollback to a specific historical checkpoint
  const handleRevertSnapshot = (snapshot: MasterChangeSnapshot, reason: string) => {
    const targetMaster = snapshot.previousMaster;
    const targetIdx = currentUndoStack.findIndex((s) => s.id === snapshot.id);

    if (targetIdx === -1) return;

    const remainingUndo = currentUndoStack.slice(targetIdx + 1);
    setUndoStackMap((prev) => ({
      ...prev,
      [master.id]: remainingUndo,
    }));
    setRedoStackMap((prev) => ({
      ...prev,
      [master.id]: [],
    }));

    onUpdateMaster(targetMaster);

    logAudit(
      'Master Data Batch Rollback',
      'Masters Maintenance',
      `${master.name} (Batch Rollback)`,
      'Session Rollback Engine',
      `${reason}. Records restored from ${master.records.length} to ${targetMaster.records.length}.`,
      'SUCCESS'
    );

    showToast(
      `Batch rollback complete: Restored ${targetMaster.name} to state before "${snapshot.description}" (${targetMaster.records.length} records)`,
      'success'
    );
  };

  // Specifically revert the most recent bulk import in this session
  const handleRevertLastBulkImport = () => {
    const bulkImportSnapshot = currentUndoStack.find((s) => s.actionType === 'BULK_IMPORT');
    if (!bulkImportSnapshot) {
      showToast('No bulk import recorded in the current session.', 'info');
      return;
    }

    handleRevertSnapshot(
      bulkImportSnapshot,
      `Reverted bulk import "${bulkImportSnapshot.description}"`
    );
    setRecentlyBulkImported(null);
  };

  // Clear Session Undo History
  const handleClearUndoHistory = () => {
    setUndoStackMap((prev) => ({
      ...prev,
      [master.id]: [],
    }));
    setRedoStackMap((prev) => ({
      ...prev,
      [master.id]: [],
    }));
    setRecentlyBulkImported(null);
    showToast('Session rollback history cleared for this master.', 'info');
  };

  // Delete Record
  const handleConfirmDelete = () => {
    if (!deletingRecord) return;
    const updatedRecords = master.records.filter((r) => r.id !== deletingRecord.id);
    const newMaster = { ...master, records: updatedRecords };

    recordSnapshot(
      'DELETE_RECORD',
      `Deleted record ${deletingRecord.id}`,
      1,
      newMaster,
      `Removed record ID: ${deletingRecord.id}`
    );

    onUpdateMaster(newMaster);

    // Automatically log deletion via AuditTrailMiddleware
    AuditTrailMiddleware.logDeleteRow({
      masterName: master.name,
      masterId: master.id,
      record: deletingRecord,
      user: { userId: currentUser.userId, userName: currentUser.name },
      logAudit,
    });

    showToast(`Record ${deletingRecord.id} deleted successfully.`, 'info');
    setDeletingRecord(null);
  };

  // Save Record (Add / Edit) with Schema Validation & Audit Logging
  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();

    // Rigorous Schema Validation across all fields (Date, Number, Dropdown, Boolean, Text)
    const validationResult = masterValidationSchema.validateRecord(master.fields, formData);

    if (!validationResult.isValid) {
      setFormErrors(validationResult.errors);
      showToast('Validation failed: Please correct the invalid field values highlighted below.', 'error');
      return;
    }

    const sanitizedData = validationResult.sanitizedRecord;

    // Ids must stay unique — duplicates make edit/delete/bulk actions hit the wrong rows
    const idClash = master.records.some(
      (r) => String(r.id) === String(sanitizedData.id) && r.id !== editingRecordId
    );
    if (!sanitizedData.id || idClash) {
      showToast(`Record ID "${sanitizedData.id ?? ''}" is missing or already exists in ${master.name}.`, 'error');
      return;
    }

    let updatedRecords: Array<Record<string, any>>;
    if (editingRecordId) {
      const oldRecord = master.records.find((r) => r.id === editingRecordId) || {};
      updatedRecords = master.records.map((r) =>
        r.id === editingRecordId ? { ...sanitizedData } : r
      );
      const newMaster = { ...master, records: updatedRecords };

      recordSnapshot(
        'UPDATE_RECORD',
        `Updated record ${editingRecordId}`,
        1,
        newMaster,
        `Modified record: ${editingRecordId}`
      );

      // Automatically log update with delta diff via AuditTrailMiddleware
      AuditTrailMiddleware.logUpdateRow({
        masterName: master.name,
        masterId: master.id,
        oldRecord,
        newRecord: sanitizedData,
        user: { userId: currentUser.userId, userName: currentUser.name },
        logAudit,
      });

      onUpdateMaster(newMaster);
      showToast(`Record ${editingRecordId} validated & updated successfully.`, 'success');
    } else {
      updatedRecords = [sanitizedData, ...master.records];
      const newMaster = { ...master, records: updatedRecords };

      recordSnapshot(
        'CREATE_RECORD',
        `Added record ${sanitizedData.id || 'New Record'}`,
        1,
        newMaster,
        `Inserted new row into ${master.name}`
      );

      // Automatically log row creation via AuditTrailMiddleware
      AuditTrailMiddleware.logCreateRow({
        masterName: master.name,
        masterId: master.id,
        record: sanitizedData,
        user: { userId: currentUser.userId, userName: currentUser.name },
        logAudit,
      });

      onUpdateMaster(newMaster);
      showToast(`New record validated & added to ${master.name}.`, 'success');
    }

    setIsRecordModalOpen(false);
  };

  // Add Dynamic Parameter / Schema Field
  const handleAddCustomParameter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim()) return;

    const key =
      newFieldKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
      newFieldLabel.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (key === 'id' || !/[a-z0-9]/.test(key)) {
      showToast(`"${key}" cannot be used as a parameter key.`, 'error');
      return;
    }
    if (master.fields.some((f) => f.key === key)) {
      showToast(`Parameter key "${key}" already exists in this schema.`, 'error');
      return;
    }

    // Validate the custom field definition (e.g. at least 2 dropdown options, min <= max for numbers)
    const defValidation = masterValidationSchema.validateCustomFieldDefinition({
      label: newFieldLabel.trim(),
      key,
      type: newFieldType,
      optionsString: newFieldOptions,
      defaultValue: newFieldDefaultVal.trim() || undefined,
      min: newFieldMinNum !== '' ? Number(newFieldMinNum) : undefined,
      max: newFieldMaxNum !== '' ? Number(newFieldMaxNum) : undefined,
    });

    if (!defValidation.isValid && defValidation.error) {
      showToast(defValidation.error, 'error');
      return;
    }

    const mappingObj: Record<string, string> = {};
    newFieldValueMappings.forEach((m) => {
      if (m.raw.trim() && m.mapped.trim()) {
        mappingObj[m.raw.trim()] = m.mapped.trim();
      }
    });

    const parsedOptions =
      newFieldType === 'select'
        ? newFieldOptions.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

    const validationRules: any = {};
    if (newFieldType === 'number') {
      if (newFieldMinNum !== '') validationRules.min = Number(newFieldMinNum);
      if (newFieldMaxNum !== '') validationRules.max = Number(newFieldMaxNum);
    } else if (newFieldType === 'date') {
      if (newFieldMinDate !== '') validationRules.minDate = newFieldMinDate;
      if (newFieldMaxDate !== '') validationRules.maxDate = newFieldMaxDate;
    }

    const newField: MasterFieldDef = {
      key,
      label: newFieldLabel.trim(),
      type: newFieldType,
      mandatory: newFieldMandatory,
      isCustom: true,
      displayInDealerApp: newFieldDisplayInDealerApp,
      dealerTargetModule: newFieldDealerTargetModule,
      dealerDisplayLabel: newFieldDealerDisplayLabel.trim() || newFieldLabel.trim(),
      valueMapping: Object.keys(mappingObj).length > 0 ? mappingObj : undefined,
      options: parsedOptions,
      validation: Object.keys(validationRules).length > 0 ? validationRules : undefined,
    };

    let defaultValue: any = newFieldDefaultVal.trim();
    if (!defaultValue) {
      if (newFieldType === 'select' && parsedOptions && parsedOptions.length > 0) {
        defaultValue = parsedOptions[0];
      } else if (newFieldType === 'number') {
        defaultValue = validationRules.min !== undefined && validationRules.min > 0 ? validationRules.min : 0;
      } else if (newFieldType === 'date') {
        defaultValue = new Date().toISOString().split('T')[0];
      } else if (newFieldType === 'boolean') {
        defaultValue = false;
      } else {
        defaultValue = '—';
      }
    } else if (newFieldType === 'number') {
      defaultValue = Number(defaultValue);
    } else if (newFieldType === 'boolean') {
      defaultValue = ['true', 'y', 'yes', '1'].includes(String(defaultValue).toLowerCase());
    }

    // The default is back-filled into every existing row, so it must satisfy the new rule itself
    const defaultCheck = masterValidationSchema.validateField({ ...newField, mandatory: false }, defaultValue);
    if (!defaultCheck.isValid) {
      showToast(`Default value is invalid: ${defaultCheck.error}`, 'error');
      return;
    }

    const updatedRecords = master.records.map((r) => ({
      ...r,
      [key]: r[key] !== undefined ? r[key] : defaultValue,
    }));

    // Automatically log schema parameter extension via AuditTrailMiddleware
    AuditTrailMiddleware.logSchemaExtend({
      masterName: master.name,
      masterId: master.id,
      fieldDef: newField,
      defaultValue,
      user: { userId: currentUser.userId, userName: currentUser.name },
      logAudit,
    });

    const newMaster = {
      ...master,
      fields: [...master.fields, newField],
      records: updatedRecords,
    };

    recordSnapshot(
      'SCHEMA_EXTEND',
      `Added parameter "${newField.label}" (${newField.type})${newField.displayInDealerApp ? ' [Dealer Mapped]' : ''}`,
      updatedRecords.length,
      newMaster,
      `Schema extended with field: ${newField.key}`
    );

    onUpdateMaster(newMaster);

    setIsAddFieldModalOpen(false);
    setNewFieldLabel('');
    setNewFieldKey('');
    setNewFieldOptions('');
    setNewFieldMandatory(false);
    setNewFieldDefaultVal('');
    setNewFieldMinNum('');
    setNewFieldMaxNum('');
    setNewFieldMinDate('');
    setNewFieldMaxDate('');
    setNewFieldDisplayInDealerApp(true);
    setNewFieldDealerDisplayLabel('');
    setNewFieldValueMappings([{ raw: '', mapped: '' }]);
    showToast(
      `Schema updated! Added custom parameter "${newField.label}" with strictly enforced ${newField.type} validation.`,
      'success'
    );
  };

  // Open Field Configuration & Dealer Value Mapping Modal
  const handleOpenConfigureField = (field: MasterFieldDef) => {
    setEditingFieldConfig(field);
    setEditFieldDisplayInDealerApp(field.displayInDealerApp ?? false);
    setEditFieldDealerTargetModule(field.dealerTargetModule || 'vehicle_journey');
    setEditFieldDealerDisplayLabel(field.dealerDisplayLabel || field.label);

    const mappings: Array<{ raw: string; mapped: string }> = [];
    if (field.valueMapping && Object.keys(field.valueMapping).length > 0) {
      Object.entries(field.valueMapping).forEach(([raw, mapped]) => {
        mappings.push({ raw, mapped });
      });
    } else if (field.options && field.options.length > 0) {
      field.options.forEach((opt) => {
        mappings.push({ raw: opt, mapped: opt });
      });
    } else {
      mappings.push({ raw: '', mapped: '' });
    }
    setEditFieldValueMappings(mappings);
  };

  // Save Field Configuration & Value Mapping
  const handleSaveFieldConfiguration = () => {
    if (!editingFieldConfig) return;

    const mappingObj: Record<string, string> = {};
    editFieldValueMappings.forEach((m) => {
      if (m.raw.trim() && m.mapped.trim()) {
        mappingObj[m.raw.trim()] = m.mapped.trim();
      }
    });

    const updatedFields = master.fields.map((f) => {
      if (f.key !== editingFieldConfig.key) return f;
      return {
        ...f,
        displayInDealerApp: editFieldDisplayInDealerApp,
        dealerTargetModule: editFieldDealerTargetModule,
        dealerDisplayLabel: editFieldDealerDisplayLabel.trim() || f.label,
        valueMapping: Object.keys(mappingObj).length > 0 ? mappingObj : undefined,
      };
    });

    const newMaster = {
      ...master,
      fields: updatedFields,
    };

    onUpdateMaster(newMaster);

    logAudit(
      'Field Mapping Configured',
      'Masters Maintenance',
      `${master.name} > ${editingFieldConfig.label}`,
      'Updated Value Mapping',
      `Exposed to Dealer App: ${editFieldDisplayInDealerApp ? 'YES' : 'NO'}, Target: ${editFieldDealerTargetModule}, Mapped values: ${Object.keys(mappingObj).length}`,
      'SUCCESS'
    );

    showToast(
      `Saved field configuration & dealer value mapping for "${editingFieldConfig.label}"`,
      'success'
    );
    setEditingFieldConfig(null);
  };

  // Handle bulk import completion from MasterDataImportModal
  const handleImportComplete = (
    importedRows: Array<Record<string, any>>,
    mode: 'append' | 'upsert' | 'replace'
  ) => {
    const updatedRecords = mergeImportedRecords(master.records, importedRows, mode);

    const newMaster = { ...master, records: updatedRecords };

    recordSnapshot(
      'BULK_IMPORT',
      `Bulk imported ${importedRows.length} records (${mode.toUpperCase()})`,
      importedRows.length,
      newMaster,
      `Ingested ${importedRows.length} rows with mode: ${mode.toUpperCase()}`
    );

    setRecentlyBulkImported({
      count: importedRows.length,
      description: `Bulk imported ${importedRows.length} records (${mode.toUpperCase()})`,
      mode: mode.toUpperCase(),
    });

    onUpdateMaster(newMaster);
  };

  // Bulk Edit Handler: apply shared field changes to multiple selected rows
  const handleApplyBulkEdit = (
    updatedFields: Record<string, any>,
    selectedIds: string[],
    actionSummary: string
  ) => {
    const selectedSet = new Set(selectedIds);
    const updatedRecords = master.records.map((r) => {
      if (selectedSet.has(r.id)) {
        return { ...r, ...updatedFields };
      }
      return r;
    });

    const newMaster = { ...master, records: updatedRecords };

    recordSnapshot(
      'BULK_EDIT',
      `Bulk updated ${selectedIds.length} rows`,
      selectedIds.length,
      newMaster,
      actionSummary
    );

    onUpdateMaster(newMaster);

    logAudit(
      'Master Data Bulk Edit',
      'Masters Maintenance',
      `${master.name} (Bulk Edit)`,
      'Bulk Operations Engine',
      `${actionSummary}. Record IDs: [${selectedIds.slice(0, 5).join(', ')}${selectedIds.length > 5 ? '...' : ''}]`,
      'SUCCESS'
    );

    showToast(`Successfully updated ${selectedIds.length} records in ${master.name}.`, 'success');
    setSelectedRowIds([]);
  };

  // Bulk Delete Handler: permanently remove selected rows
  const handleBulkDelete = (selectedIds: string[]) => {
    const selectedSet = new Set(selectedIds);
    const updatedRecords = master.records.filter((r) => !selectedSet.has(r.id));
    const newMaster = { ...master, records: updatedRecords };

    recordSnapshot(
      'BULK_DELETE',
      `Bulk deleted ${selectedIds.length} rows`,
      selectedIds.length,
      newMaster,
      `Removed ${selectedIds.length} records from ${master.name}`
    );

    onUpdateMaster(newMaster);

    logAudit(
      'Master Data Bulk Delete',
      'Masters Maintenance',
      `${master.name} (Bulk Delete)`,
      'Bulk Operations Engine',
      `Deleted ${selectedIds.length} records from ${master.name}.`,
      'SUCCESS'
    );

    showToast(`Deleted ${selectedIds.length} records from ${master.name}.`, 'info');
    setSelectedRowIds([]);
  };

  // Toggle selection of all currently filtered rows
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allFilteredIds = filteredRecords.map((r) => r.id);
      setSelectedRowIds(Array.from(new Set([...selectedRowIds, ...allFilteredIds])));
    } else {
      const filteredSet = new Set(filteredRecords.map((r) => r.id));
      setSelectedRowIds(selectedRowIds.filter((id) => !filteredSet.has(id)));
    }
  };

  // Toggle selection of a single row
  const handleToggleSelectRow = (rowId: string, checked: boolean) => {
    if (checked) {
      setSelectedRowIds((prev) => [...prev, rowId]);
    } else {
      setSelectedRowIds((prev) => prev.filter((id) => id !== rowId));
    }
  };

  // Export to CSV with UTF-8 BOM
  const handleExportCSV = () => {
    masterExportUtil.exportToCSV({
      masterName: master.name,
      category: master.category,
      buFilter,
      currentUser: { userId: currentUser.userId, name: currentUser.name },
      columns: master.fields.map((f) => ({ key: f.key, label: f.label })),
      data: filteredRecords,
    });

    logAudit(
      'Master Data Exported',
      'Masters Maintenance',
      `${master.name} (CSV Export)`,
      'Current Filtered Grid',
      `Exported ${filteredRecords.length} records to UTF-8 CSV`,
      'SUCCESS'
    );

    showToast(`Exported ${filteredRecords.length} records of ${master.name} to CSV`, 'success');
    setShowExportMenu(false);
  };

  // Export to Styled Microsoft Excel (.xls / .xlsx format)
  const handleExportExcel = () => {
    masterExportUtil.exportToExcel({
      masterName: master.name,
      category: master.category,
      buFilter,
      currentUser: { userId: currentUser.userId, name: currentUser.name },
      columns: master.fields.map((f) => ({ key: f.key, label: f.label })),
      data: filteredRecords,
    });

    logAudit(
      'Master Data Exported',
      'Masters Maintenance',
      `${master.name} (Excel Export)`,
      'Current Filtered Grid',
      `Exported ${filteredRecords.length} records to formatted Excel spreadsheet`,
      'SUCCESS'
    );

    showToast(`Exported ${filteredRecords.length} records of ${master.name} to Excel (.xls/.xlsx)`, 'success');
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
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
                  <span>Dealership Master</span>
                </span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold font-mono">
                {master.category}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">{master.description}</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Batch Undo & Quick Revert Control Group */}
            {canEdit && (
              <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-2xs divide-x divide-slate-200">
                <button
                  disabled={currentUndoStack.length === 0}
                  onClick={handleQuickUndo}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    currentUndoStack.length > 0
                      ? 'text-amber-800 hover:bg-amber-50 cursor-pointer'
                      : 'text-slate-300 cursor-not-allowed'
                  }`}
                  title={
                    currentUndoStack.length > 0
                      ? `Undo last change: "${currentUndoStack[0]?.description}"`
                      : 'No changes in current session to undo'
                  }
                >
                  <Undo2 className="h-3.5 w-3.5 text-amber-600" />
                  <span>Undo</span>
                  {currentUndoStack.length > 0 && (
                    <span className="text-[10px] px-1 py-0.2 rounded-full bg-amber-100 text-amber-800 font-mono font-bold">
                      {currentUndoStack.length}
                    </span>
                  )}
                </button>

                {currentRedoStack.length > 0 && (
                  <button
                    onClick={handleQuickRedo}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50 cursor-pointer transition-colors"
                    title={`Redo: "${currentRedoStack[0]?.description}"`}
                  >
                    <Redo2 className="h-3.5 w-3.5 text-blue-600" />
                    <span>Redo</span>
                  </button>
                )}

                <button
                  onClick={() => setIsBatchUndoModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                  title="Open Batch Undo & Session History Rollback manager"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Batch Undo</span>
                </button>
              </div>
            )}

            {/* Audit Trail Button */}
            <button
              onClick={() => setIsAuditTrailModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
              title="View immutable audit trail for this master"
            >
              <History className="h-3.5 w-3.5 text-indigo-600" />
              <span>Audit Trail</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 font-mono font-bold">
                {masterAuditLogs.length}
              </span>
            </button>

            {canEdit && (
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100/80 text-blue-900 text-xs font-bold cursor-pointer shadow-2xs transition-all"
                title="Bulk upload parameter records from JSON or Excel files with validation summary report"
              >
                <Upload className="h-3.5 w-3.5 text-blue-700" />
                <span>⬆ Bulk Upload</span>
                <span className="text-[10px] bg-blue-200/80 text-blue-900 px-1 py-0.2 rounded font-mono font-bold">
                  JSON / Excel
                </span>
              </button>
            )}

            {canCustomizeSchema && (
              <button
                onClick={() => setIsAddFieldModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-all border border-purple-600"
                title="Add a custom parameter to this entity schema without code changes"
              >
                <Sliders className="h-3.5 w-3.5 text-purple-200" />
                <span>+ Add Custom Parameter</span>
              </button>
            )}

            {onOpenDealerPreview && (
              <button
                type="button"
                onClick={onOpenDealerPreview}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 text-xs font-bold shadow-2xs cursor-pointer transition-all"
                title="Preview configured dynamic fields & validation rules in the live Dealer App Simulator before publishing"
              >
                <Smartphone className="h-3.5 w-3.5 text-emerald-700" />
                <span>📱 Dealer Preview</span>
              </button>
            )}

            {canEdit ? (
              <button
                onClick={handleOpenAddRecord}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add Row</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400 flex items-center gap-1 italic">
                <Lock className="h-3.5 w-3.5" /> Read-Only for Current Role
              </span>
            )}
          </div>
        </div>

        {/* Bulk Import Notification & Quick Undo Banner */}
        {recentlyBulkImported && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                <Upload className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold text-purple-900">Bulk Ingestion Succeeded:</span>{' '}
                <span className="text-purple-800">
                  +{recentlyBulkImported.count} records added to {master.name} (Mode: {recentlyBulkImported.mode})
                </span>
                <span className="block text-[11px] text-purple-600 mt-0.5">
                  You can immediately revert this ingestion or review all changes in Batch Undo.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRevertLastBulkImport}
                className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                title="Immediately revert the master back to its pre-import state"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Revert Bulk Import</span>
              </button>
              <button
                onClick={() => setRecentlyBulkImported(null)}
                className="px-2.5 py-1.5 rounded-lg hover:bg-purple-100 text-purple-700 text-xs font-semibold cursor-pointer transition-colors"
              >
                Keep &amp; Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Global Search & Advanced Filter Toolbar */}
        <div className="pt-3 border-t border-slate-100 space-y-2.5 text-xs">
          {/* Row 1: Global Search Bar + Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-1 items-center gap-1.5 min-w-[280px] max-w-2xl">
              {/* Search Scope Dropdown */}
              <div className="relative shrink-0">
                <select
                  value={searchColumnScope}
                  onChange={(e) => setSearchColumnScope(e.target.value)}
                  className="h-8 pl-2.5 pr-6 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold focus:outline-hidden appearance-none cursor-pointer transition-colors"
                  title="Search scope"
                >
                  <option value="ALL">All Columns</option>
                  <option value="id">Record ID</option>
                  {master.fields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-2.5 h-3 w-3 text-slate-400 pointer-events-none" />
              </div>

              {/* Global Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Search records ${
                    searchColumnScope === 'ALL'
                      ? 'across all columns'
                      : `in "${master.fields.find((f) => f.key === searchColumnScope)?.label || searchColumnScope}"`
                  }...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-16 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
                {searchQuery && (
                  <div className="absolute right-2 top-1.5 flex items-center gap-1">
                    <span className="text-[10px] font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                      {filteredRecords.length} found
                    </span>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Toggle Filter Panel Button */}
              <button
                onClick={() => setIsFilterPanelExpanded(!isFilterPanelExpanded)}
                className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 font-semibold text-xs transition-colors cursor-pointer shrink-0 ${
                  activeFiltersCount > 0 || isFilterPanelExpanded
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="Toggle filter controls"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-blue-700" />
                <span>Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="h-4 w-4 rounded-full bg-blue-700 text-white text-[9px] font-bold flex items-center justify-center font-mono">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>

            {/* Right Side: Rows Count & Export */}
            <div className="flex items-center gap-2">
              {/* Bulk Edit Button (active when rows selected) */}
              {canEdit && selectedRowIds.length > 0 && (
                <button
                  onClick={() => setIsBulkEditModalOpen(true)}
                  className="h-8 flex items-center gap-1.5 px-3 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-sm cursor-pointer transition-all animate-fade-in"
                  title={`Bulk edit ${selectedRowIds.length} selected row(s)`}
                >
                  <CheckSquare className="h-3.5 w-3.5 text-blue-300" />
                  <span>Bulk Edit ({selectedRowIds.length})</span>
                </button>
              )}

              <span className="text-[11px] font-mono text-slate-400">
                {filteredRecords.length} / {master.records.length} rows
              </span>

              {/* Export Dropdown Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="h-8 flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer text-xs font-semibold shadow-2xs"
                  title="Export current view to Excel or CSV"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Export</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>

                {showExportMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setShowExportMenu(false)}
                    />
                    <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-fade-in text-xs">
                      <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Export Filtered View ({filteredRecords.length} rows)
                      </div>
                      <button
                        onClick={handleExportExcel}
                        className="w-full px-3 py-2 text-left hover:bg-emerald-50 text-slate-800 hover:text-emerald-900 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-semibold text-xs">Microsoft Excel (.xlsx / .xls)</div>
                          <div className="text-[10px] text-slate-400">Formatted with TML brand header</div>
                        </div>
                      </button>
                      <button
                        onClick={handleExportCSV}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 text-slate-800 hover:text-blue-900 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Download className="h-4 w-4 text-blue-600 shrink-0" />
                        <div>
                          <div className="font-semibold text-xs">Standard CSV (.csv)</div>
                          <div className="text-[10px] text-slate-400">UTF-8 comma-separated text</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Filter Dropdowns Panel (Status, Column, Column Type, BU) */}
          {isFilterPanelExpanded && (
            <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex flex-wrap items-center gap-2.5 text-xs animate-fade-in">
              <div className="flex items-center gap-1 text-slate-500 font-bold text-[10px] uppercase tracking-wider shrink-0">
                <Filter className="h-3 w-3 text-slate-400" />
                <span>Filters:</span>
              </div>

              {/* 1. Status Filter Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-600 text-[11px]">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className={`px-2 py-1 rounded-md border text-xs font-semibold focus:outline-hidden ${
                    statusFilter !== 'ALL'
                      ? 'bg-blue-100 border-blue-300 text-blue-900'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>

              {/* 2. Dynamic Column Selector Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-600 text-[11px]">Column:</span>
                <select
                  value={selectedColumnKey}
                  onChange={(e) => {
                    setSelectedColumnKey(e.target.value);
                    setSelectedColumnValue('ALL');
                  }}
                  className={`px-2 py-1 rounded-md border text-xs font-semibold focus:outline-hidden ${
                    selectedColumnKey
                      ? 'bg-blue-100 border-blue-300 text-blue-900'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <option value="">Filter by Any Column...</option>
                  {master.fields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label} ({f.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Distinct Value Dropdown for Chosen Column */}
              {selectedColumnKey && (
                <div className="flex items-center gap-1.5 animate-fade-in">
                  <span className="font-medium text-slate-600 text-[11px]">Value:</span>
                  <select
                    value={selectedColumnValue}
                    onChange={(e) => setSelectedColumnValue(e.target.value)}
                    className={`px-2 py-1 rounded-md border text-xs font-semibold focus:outline-hidden max-w-[200px] truncate ${
                      selectedColumnValue !== 'ALL'
                        ? 'bg-blue-100 border-blue-300 text-blue-900'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <option value="ALL">All Distinct Values ({distinctColumnValues.length})</option>
                    {distinctColumnValues.map((val) => (
                      <option key={val} value={val}>
                        {val}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 4. Column Type Filter Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-slate-600 text-[11px]">Field Type:</span>
                <select
                  value={columnTypeFilter}
                  onChange={(e) => setColumnTypeFilter(e.target.value as any)}
                  className={`px-2 py-1 rounded-md border text-xs font-semibold focus:outline-hidden ${
                    columnTypeFilter !== 'ALL'
                      ? 'bg-blue-100 border-blue-300 text-blue-900'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <option value="ALL">All Types</option>
                  <option value="text">Text (String)</option>
                  <option value="number">Numeric</option>
                  <option value="select">Dropdown LOV</option>
                  <option value="boolean">Boolean</option>
                  <option value="date">Date</option>
                </select>
              </div>

              {/* 5. BU Filter Dropdown (if present) */}
              {master.fields.some((f) => f.key === 'bu') && (
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-600 text-[11px]">BU:</span>
                  <select
                    value={buFilter}
                    onChange={(e) => setBuFilter(e.target.value)}
                    className={`px-2 py-1 rounded-md border text-xs font-semibold focus:outline-hidden ${
                      buFilter !== 'All'
                        ? 'bg-blue-100 border-blue-300 text-blue-900'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <option value="All">All BUs</option>
                    <option value="PV">PV</option>
                    <option value="EV">EV</option>
                    <option value="CV">CV</option>
                  </select>
                </div>
              )}

              {/* Clear All Filters Button */}
              {activeFiltersCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-1 rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1 ml-auto cursor-pointer transition-colors"
                  title="Clear all search queries and filters"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Clear All ({activeFiltersCount})</span>
                </button>
              )}
            </div>
          )}

          {/* Row 3: Active Filters Tags / Summary Pill Bar */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
              <span className="text-slate-400 font-medium">Applied:</span>

              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 font-medium">
                  <span>Search: &ldquo;{searchQuery}&rdquo;</span>
                  {searchColumnScope !== 'ALL' && (
                    <span className="text-[10px] text-blue-600">({searchColumnScope})</span>
                  )}
                  <button onClick={() => setSearchQuery('')} className="hover:text-blue-950 cursor-pointer">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {statusFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                  <span>Status: {statusFilter === 'ACTIVE' ? 'Active' : 'Inactive'}</span>
                  <button onClick={() => setStatusFilter('ALL')} className="hover:text-emerald-950 cursor-pointer">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {selectedColumnKey && selectedColumnValue !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-800 font-medium">
                  <span>
                    {master.fields.find((f) => f.key === selectedColumnKey)?.label || selectedColumnKey}: &ldquo;
                    {selectedColumnValue}&rdquo;
                  </span>
                  <button
                    onClick={() => {
                      setSelectedColumnKey('');
                      setSelectedColumnValue('ALL');
                    }}
                    className="hover:text-purple-950 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {columnTypeFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 font-medium">
                  <span>Type: {columnTypeFilter}</span>
                  <button onClick={() => setColumnTypeFilter('ALL')} className="hover:text-indigo-950 cursor-pointer">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {buFilter !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-medium">
                  <span>BU: {buFilter}</span>
                  <button onClick={() => setBuFilter('All')} className="hover:text-amber-950 cursor-pointer">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}

              {sortColumn && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px]">
                  <span>
                    Sorted: {master.fields.find((f) => f.key === sortColumn)?.label || sortColumn} (
                    {sortDirection.toUpperCase()})
                  </span>
                  <button onClick={() => setSortColumn('')} className="hover:text-slate-900 cursor-pointer">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Dynamic Data Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Bulk Action Header Pill if records selected */}
        {selectedRowIds.length > 0 && (
          <div className="bg-blue-50/90 border-b border-blue-200/80 px-4 py-2 flex items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-blue-900 text-white font-mono font-bold text-[10px] flex items-center justify-center">
                {selectedRowIds.length}
              </span>
              <span className="font-semibold text-blue-900">
                {selectedRowIds.length} of {filteredRecords.length} row(s) selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={() => setIsBulkEditModalOpen(true)}
                  className="px-3 py-1 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span>Bulk Edit</span>
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => {
                    const hidden = selectedRowIds.filter((id) => !filteredRecords.some((r) => r.id === id)).length;
                    if (
                      window.confirm(
                        `Delete ${selectedRowIds.length} selected record(s) from ${master.name}?` +
                          (hidden ? `\n${hidden} of them are hidden by the current filters.` : '') +
                          '\nYou can undo this during the current session.'
                      )
                    ) {
                      handleBulkDelete(selectedRowIds);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Selected</span>
                </button>
              )}
              <button
                onClick={() => setSelectedRowIds([])}
                className="px-2 py-1 rounded-lg hover:bg-slate-200/60 text-slate-600 font-medium text-xs cursor-pointer transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#002B49] text-white font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                {/* Bulk Select All Checkbox */}
                <th className="py-3 px-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredRecords.length > 0 &&
                      filteredRecords.every((r) => selectedRowIds.includes(r.id))
                    }
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    title={
                      filteredRecords.length > 0 &&
                      filteredRecords.every((r) => selectedRowIds.includes(r.id))
                        ? 'Deselect all rows'
                        : 'Select all visible rows'
                    }
                  />
                </th>
                {master.fields.map((f) => {
                  const isSorted = sortColumn === f.key;
                  return (
                    <th
                      key={f.key}
                      className="py-3 px-3.5 transition-colors select-none group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div
                          onClick={() => handleSortToggle(f.key)}
                          className="flex items-center gap-1.5 cursor-pointer hover:text-blue-200"
                          title={`Click to sort by ${f.label}`}
                        >
                          <span>{f.label}</span>
                          {f.mandatory && <span className="text-amber-300 font-bold">*</span>}
                          {f.isCustom && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/40 text-purple-100 border border-purple-300/50 font-mono font-bold tracking-wide uppercase shadow-2xs">
                              Custom
                            </span>
                          )}
                          {f.displayInDealerApp && (
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/40 text-emerald-100 border border-emerald-300/50 font-mono font-bold tracking-wide uppercase inline-flex items-center gap-0.5 shadow-2xs"
                              title={`Exposed in Dealer App (${f.dealerTargetModule || 'vehicle_journey'})`}
                            >
                              <Sparkles className="h-2.5 w-2.5 text-emerald-300" />
                              <span>Dealer</span>
                            </span>
                          )}
                          <span className="text-white/60 group-hover:text-white transition-colors">
                            {isSorted ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5 text-blue-300" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-blue-300" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </span>
                        </div>

                        {(f.isCustom || f.displayInDealerApp || canCustomizeSchema) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenConfigureField(f);
                            }}
                            className="p-1.5 rounded-md bg-white/20 hover:bg-white/40 text-blue-100 hover:text-white transition-all cursor-pointer border border-white/25 flex items-center gap-1 shadow-2xs"
                            title={`Configure Dealer Value Mapping & Exposure for ${f.label}`}
                          >
                            <Settings className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
                <th className="py-3 px-3.5 text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={master.fields.length + 2}
                    className="py-12 text-center text-slate-400 text-xs"
                  >
                    <div className="max-w-sm mx-auto space-y-2">
                      <FilterX className="h-8 w-8 mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-700">No matching records found</p>
                      <p className="text-[11px] text-slate-400">
                        {activeFiltersCount > 0
                          ? 'No rows match the applied search query or active filters.'
                          : `There are currently no rows stored in ${master.name}.`}
                      </p>
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Reset All Filters</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((row) => {
                  const isSelected = selectedRowIds.includes(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Row Checkbox */}
                      <td className="py-2.5 px-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelectRow(row.id, e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {master.fields.map((f) => {
                        const val = row[f.key];

                        if (f.key === 'active') {
                          return (
                            <td key={f.key} className="py-2.5 px-3.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  val === 'Y' || val === true
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {val === 'Y' || val === true ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          );
                        }

                        const hasMapping = f.valueMapping && val !== undefined && f.valueMapping[String(val)];

                        return (
                          <td key={f.key} className="py-2.5 px-3.5 text-slate-700">
                            {hasMapping ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 text-xs inline-flex items-center gap-1 shadow-2xs">
                                  <span>{f.valueMapping![String(val)]}</span>
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200" title="Raw Code Value">
                                  raw: {String(val)}
                                </span>
                              </div>
                            ) : val !== undefined && val !== null ? (
                              String(val)
                            ) : (
                              '—'
                            )}
                          </td>
                        );
                      })}

                      {/* Actions: Edit & Delete */}
                      <td className="py-2.5 px-3.5 text-right">
                        {canEdit ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditRecord(row)}
                              className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Edit Row"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingRecord(row)}
                              className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Delete Row"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono text-[10px]">Read-only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: SCHEMA-DRIVEN DYNAMIC FORM GENERATOR (Add / Edit Record) */}
      {isRecordModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsRecordModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-3 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-fade-in text-xs max-h-[92vh] flex flex-col my-auto">
            <div className="px-5 py-3.5 bg-[#002B49] text-white flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-xs">
              <div>
                <h3 className="font-bold text-sm">
                  {editingRecordId ? 'Edit Master Record' : 'Add New Master Row'}
                </h3>
                <p className="text-[11px] text-blue-200">{master.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer border border-white/20 transition-all shadow-2xs hover:scale-105"
                title="Close modal (Esc)"
              >
                <X className="h-4 w-4 text-white" />
                <span>Close</span>
              </button>
            </div>

            {/* Form Validation Summary Banner */}
            {Object.keys(formErrors).length > 0 && (
              <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-fade-in shrink-0">
                <AlertCircle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <div className="font-bold">
                    Validation required: {Object.keys(formErrors).length} field{Object.keys(formErrors).length > 1 ? 's have' : ' has'} issues
                  </div>
                  <div className="text-[11px] text-rose-700">
                    Data types (Number, Date, Dropdown) and mandatory constraints are strictly validated.
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveRecord} className="p-5 space-y-3.5 overflow-y-auto flex-1">
              {master.fields.map((f) => {
                const hasError = Boolean(formErrors[f.key]);
                return (
                  <div key={f.key} className="space-y-1">
                    <label className="font-bold text-slate-700 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1">
                        <span>{f.label}</span>
                        {f.mandatory && <span className="text-rose-500 font-bold">*</span>}
                        {f.isCustom && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 text-purple-800 font-mono">
                            Custom
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-normal">
                        [{f.type}]
                      </span>
                    </label>

                    {/* Dropdown Input */}
                    {f.type === 'select' && f.options ? (
                      <select
                        value={formData[f.key] ?? ''}
                        onChange={(e) => handleFormFieldChange(f.key, e.target.value)}
                        onBlur={() => handleFormFieldBlur(f)}
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs font-semibold focus:outline-hidden bg-white transition-colors cursor-pointer ${
                          hasError
                            ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-200'
                            : 'border-slate-200 focus:border-blue-400'
                        }`}
                      >
                        <option value="" disabled={f.mandatory}>-- Select {f.label} --</option>
                        {f.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : f.type === 'number' ? (
                      /* Number Input */
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formData[f.key] ?? ''}
                        onChange={(e) => handleFormFieldChange(f.key, e.target.value)}
                        onBlur={() => handleFormFieldBlur(f)}
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-hidden font-mono transition-colors ${
                          hasError
                            ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-200'
                            : 'border-slate-200 focus:border-blue-400'
                        }`}
                        placeholder={
                          f.validation?.min !== undefined && f.validation?.max !== undefined
                            ? `Enter numeric value (${f.validation.min} to ${f.validation.max})`
                            : f.validation?.min !== undefined
                            ? `Enter numeric value (min: ${f.validation.min})`
                            : `Enter ${f.label} (numeric)`
                        }
                      />
                    ) : f.type === 'date' ? (
                      /* Date Input */
                      <input
                        type="date"
                        min={f.validation?.minDate}
                        max={f.validation?.maxDate}
                        value={formData[f.key] || ''}
                        onChange={(e) => handleFormFieldChange(f.key, e.target.value)}
                        onBlur={() => handleFormFieldBlur(f)}
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-hidden font-mono transition-colors ${
                          hasError
                            ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-200'
                            : 'border-slate-200 focus:border-blue-400'
                        }`}
                      />
                    ) : f.type === 'boolean' ? (
                      /* Boolean Toggle */
                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={Boolean(formData[f.key])}
                          onChange={(e) => handleFormFieldChange(f.key, e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-slate-600 font-semibold">Enabled / Active</span>
                      </label>
                    ) : (
                      /* Text Input */
                      <input
                        type="text"
                        value={formData[f.key] ?? ''}
                        onChange={(e) => handleFormFieldChange(f.key, e.target.value)}
                        onBlur={() => handleFormFieldBlur(f)}
                        className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-hidden transition-colors ${
                          hasError
                            ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-200'
                            : 'border-slate-200 focus:border-blue-400'
                        }`}
                        placeholder={`Enter ${f.label}`}
                      />
                    )}

                    {/* Field Validation Error Badge */}
                    {hasError && (
                      <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium pt-0.5 animate-fade-in">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>{formErrors[f.key]}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 sticky bottom-0 bg-slate-50 p-4 -mx-5 -mb-5 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer shadow-2xs flex items-center gap-1.5 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Close / Cancel</span>
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold cursor-pointer hover:bg-blue-800 transition-colors shadow-xs"
                >
                  {editingRecordId ? 'Update Row' : 'Insert Row'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DYNAMIC SCHEMA FIELD BUILDER (Allows BUs to add custom fields) */}
      {isAddFieldModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddFieldModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-3 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-fade-in text-xs flex flex-col max-h-[92vh] my-auto">
            {/* Modal Header: Sticky at top with prominent Close button */}
            <div className="px-5 py-3.5 bg-[#002B49] text-white flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-xs">
              <div>
                <h3 className="font-bold text-sm">Add Custom Schema Parameter</h3>
                <p className="text-[11px] text-blue-200">
                  Dynamically expand schema for {master.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddFieldModalOpen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer border border-white/20 transition-all shadow-2xs hover:scale-105"
                title="Close modal (Esc)"
              >
                <X className="h-4 w-4 text-white" />
                <span>Close</span>
              </button>
            </div>

            {/* Quick Test Presets Bar */}
            <div className="bg-purple-50/90 border-b border-purple-200/80 px-5 py-2.5 flex items-center justify-between gap-2 shrink-0">
              <span className="text-[11px] font-bold text-purple-950 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                <span>Quick Test Templates:</span>
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setNewFieldLabel('Extended Warranty Tier');
                    setNewFieldKey('extended_warranty_tier');
                    setNewFieldType('select');
                    setNewFieldOptions('PLATINUM, GOLD, SILVER, STANDARD');
                    setNewFieldMandatory(false);
                    setNewFieldDefaultVal('PLATINUM');
                    setNewFieldDisplayInDealerApp(true);
                    setNewFieldDealerTargetModule('vehicle_journey');
                    setNewFieldDealerDisplayLabel('Warranty & AMC Coverage Tier');
                    setNewFieldValueMappings([
                      { raw: 'PLATINUM', mapped: '🛡️ Platinum 5-Yr Comprehensive Cover' },
                      { raw: 'GOLD', mapped: '⭐ Gold 3-Yr Drivetrain & Labour' },
                      { raw: 'SILVER', mapped: '🥈 Silver 2-Yr Basic Scheduled Plan' },
                      { raw: 'STANDARD', mapped: '🚗 Standard 1-Yr OEM Manufacturer Warranty' },
                    ]);
                  }}
                  className="px-2 py-0.5 rounded bg-purple-200/80 hover:bg-purple-300 text-purple-900 font-bold text-[10px] transition-colors cursor-pointer border border-purple-300"
                  title="Load Platinum Warranty Tier example"
                >
                  🛡️ Platinum Warranty
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewFieldLabel('Telematics Diagnostic Tier');
                    setNewFieldKey('telematics_ota_status');
                    setNewFieldType('select');
                    setNewFieldOptions('OTA_ACTIVE, ECU_FLASH_REQ, NON_CONNECTED');
                    setNewFieldMandatory(false);
                    setNewFieldDefaultVal('OTA_ACTIVE');
                    setNewFieldDisplayInDealerApp(true);
                    setNewFieldDealerTargetModule('vehicle_journey');
                    setNewFieldDealerDisplayLabel('iRA Connected Telematics Status');
                    setNewFieldValueMappings([
                      { raw: 'OTA_ACTIVE', mapped: '🟢 Connected Fleet OTA Active (v4.2)' },
                      { raw: 'ECU_FLASH_REQ', mapped: '⚠️ Manual Bay Flash Required' },
                      { raw: 'NON_CONNECTED', mapped: '⚪ Legacy Non-Telematics ECU' },
                    ]);
                  }}
                  className="px-2 py-0.5 rounded bg-emerald-200/80 hover:bg-emerald-300 text-emerald-900 font-bold text-[10px] transition-colors cursor-pointer border border-emerald-300"
                  title="Load Connected Telematics OTA example"
                >
                  🟢 Connected OTA
                </button>
              </div>
            </div>

            <form onSubmit={handleAddCustomParameter} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Parameter Display Label *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Failure Root Cause / Approval Date"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Internal Field Key (Optional)
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
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden bg-white"
                    >
                      <option value="text">Text String</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="select">Dropdown LOV</option>
                      <option value="boolean">Boolean (Toggle)</option>
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
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block text-xs">
                      Dropdown Options (Comma separated) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Option A, Option B, Option C"
                      value={newFieldOptions}
                      onChange={(e) => setNewFieldOptions(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                    />
                    <p className="text-[10px] text-blue-800">
                      Enter at least 2 distinct comma-separated options. User entries will be strictly validated against these options.
                    </p>
                  </div>
                )}

                {newFieldType === 'number' && (
                  <div className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                        Minimum Value (Optional)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 0"
                        value={newFieldMinNum}
                        onChange={(e) => setNewFieldMinNum(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-hidden font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                        Maximum Value (Optional)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 1000"
                        value={newFieldMaxNum}
                        onChange={(e) => setNewFieldMaxNum(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-hidden font-mono"
                      />
                    </div>
                  </div>
                )}

                {newFieldType === 'date' && (
                  <div className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                        Earliest Allowed Date
                      </label>
                      <input
                        type="date"
                        value={newFieldMinDate}
                        onChange={(e) => setNewFieldMinDate(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-hidden font-mono"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                        Latest Allowed Date
                      </label>
                      <input
                        type="date"
                        value={newFieldMaxDate}
                        onChange={(e) => setNewFieldMaxDate(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-md bg-white focus:outline-hidden font-mono"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Default Value for Existing Rows
                  </label>
                  <input
                    type="text"
                    placeholder={
                      newFieldType === 'number'
                        ? 'e.g. 0'
                        : newFieldType === 'date'
                        ? 'YYYY-MM-DD (e.g. 2026-09-30)'
                        : newFieldType === 'select'
                        ? 'Must match one of the dropdown options above'
                        : 'e.g. Standard'
                    }
                    value={newFieldDefaultVal}
                    onChange={(e) => setNewFieldDefaultVal(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                  />
                </div>

                {/* Dealer Application Exposure & Value Mapping Section */}
                <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-700" />
                      <div>
                        <div className="font-bold text-xs text-blue-950">
                          Dealer Application Visibility &amp; Value Mapping
                        </div>
                        <div className="text-[10px] text-blue-800">
                          Configure if and how this field appears in dealer workshop screens
                        </div>
                      </div>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-blue-950">
                      <input
                        type="checkbox"
                        checked={newFieldDisplayInDealerApp}
                        onChange={(e) => setNewFieldDisplayInDealerApp(e.target.checked)}
                        className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Expose to Dealer App</span>
                    </label>
                  </div>

                  {newFieldDisplayInDealerApp && (
                    <div className="space-y-3 pt-2 border-t border-blue-200/60 animate-fade-in">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                            Target Dealer Module
                          </label>
                          <select
                            value={newFieldDealerTargetModule}
                            onChange={(e) => setNewFieldDealerTargetModule(e.target.value as any)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden bg-white"
                          >
                            <option value="vehicle_journey">Vehicle Journey &amp; Job Card Detail</option>
                            <option value="job_card">JC Creation &amp; Demanded Work</option>
                            <option value="reception">Reception &amp; P&amp;D Transit</option>
                            <option value="workshop_floor">Shop Floor &amp; Bay Dispatch</option>
                            <option value="general">All Dealer Views (General)</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                            Dealer Display Label
                          </label>
                          <input
                            type="text"
                            placeholder={newFieldLabel || 'e.g. Protection Plan Tier'}
                            value={newFieldDealerDisplayLabel}
                            onChange={(e) => setNewFieldDealerDisplayLabel(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden bg-white"
                          />
                        </div>
                      </div>

                      {/* Value Mapping Key-Value Pairs */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="font-semibold text-slate-700 text-[11px] flex items-center gap-1">
                            <span>Value Mapping (Raw Master Code → Dealer Display Text)</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              if (newFieldType === 'select' && newFieldOptions.trim()) {
                                const opts = newFieldOptions.split(',').map((s) => s.trim()).filter(Boolean);
                                setNewFieldValueMappings(opts.map((o) => ({ raw: o, mapped: `${o} (Verified)` })));
                              } else {
                                setNewFieldValueMappings([...newFieldValueMappings, { raw: '', mapped: '' }]);
                              }
                            }}
                            className="text-[10px] font-bold text-blue-700 hover:text-blue-900 cursor-pointer"
                          >
                            {newFieldType === 'select' && newFieldOptions.trim()
                              ? '+ Auto-populate from options'
                              : '+ Add Mapping Row'}
                          </button>
                        </div>

                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {newFieldValueMappings.map((m, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Raw Code (e.g. Y, GOLD)"
                                value={m.raw}
                                onChange={(e) => {
                                  const next = [...newFieldValueMappings];
                                  next[idx].raw = e.target.value;
                                  setNewFieldValueMappings(next);
                                }}
                                className="w-1/3 px-2 py-1 text-xs border border-slate-200 rounded-md font-mono bg-white"
                              />
                              <span className="text-slate-400 font-bold">→</span>
                              <input
                                type="text"
                                placeholder="Dealer Display (e.g. Active Protection)"
                                value={m.mapped}
                                onChange={(e) => {
                                  const next = [...newFieldValueMappings];
                                  next[idx].mapped = e.target.value;
                                  setNewFieldValueMappings(next);
                                }}
                                className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-md bg-white font-medium"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setNewFieldValueMappings(newFieldValueMappings.filter((_, i) => i !== idx));
                                }}
                                className="text-slate-400 hover:text-rose-600 cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Sticky Footer with clear Close / Cancel and Submit buttons */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 sticky bottom-0 z-10">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddFieldModalOpen(false)}
                    className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer shadow-2xs flex items-center gap-1.5 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Close / Cancel</span>
                  </button>
                  {onOpenDealerPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddFieldModalOpen(false);
                        onOpenDealerPreview();
                      }}
                      className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
                      title="Test how this custom field looks and behaves in the live Dealer App Simulator"
                    >
                      <Smartphone className="h-3.5 w-3.5 text-emerald-700" />
                      <span>Test in Dealer Simulator →</span>
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-bold cursor-pointer text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Field to Schema</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2B: FIELD & VALUE MAPPING CONFIGURATION MODAL */}
      {editingFieldConfig && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingFieldConfig(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-3 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-fade-in text-xs flex flex-col max-h-[92vh] my-auto">
            {/* Modal Header: Sticky at top with prominent Close button */}
            <div className="px-5 py-3.5 bg-[#002B49] text-white flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-xs">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-blue-300" />
                <div>
                  <h3 className="font-bold text-sm">Dealer Value Mapping &amp; Configuration</h3>
                  <p className="text-[11px] text-blue-200">
                    Field: <span className="font-mono">{editingFieldConfig.key}</span> ({editingFieldConfig.label})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingFieldConfig(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer border border-white/20 transition-all shadow-2xs hover:scale-105"
                title="Close modal (Esc)"
              >
                <X className="h-4 w-4 text-white" />
                <span>Close</span>
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">Display in Dealer Application</div>
                  <div className="text-[11px] text-slate-500">
                    When enabled, this field appears on vehicle journey and dealer cards.
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-blue-900">
                  <input
                    type="checkbox"
                    checked={editFieldDisplayInDealerApp}
                    onChange={(e) => setEditFieldDisplayInDealerApp(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Active</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Dealer Module</label>
                  <select
                    value={editFieldDealerTargetModule}
                    onChange={(e) => setEditFieldDealerTargetModule(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden bg-white"
                  >
                    <option value="vehicle_journey">Vehicle Journey &amp; Job Card</option>
                    <option value="job_card">JC Creation &amp; Demanded Work</option>
                    <option value="reception">Reception &amp; P&amp;D Transit</option>
                    <option value="workshop_floor">Shop Floor &amp; Bay Dispatch</option>
                    <option value="general">All Dealer Views</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Dealer Display Label</label>
                  <input
                    type="text"
                    value={editFieldDealerDisplayLabel}
                    onChange={(e) => setEditFieldDealerDisplayLabel(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Value Mapping Editor */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    <span>Value Mapping Dictionary</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditFieldValueMappings([...editFieldValueMappings, { raw: '', mapped: '' }]);
                    }}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 cursor-pointer"
                  >
                    + Add Mapping Rule
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Maps raw internal codes in {master.name} to clear, human-readable labels in the dealer portal.
                </p>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {editFieldValueMappings.map((m, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <div className="w-1/3">
                        <label className="text-[10px] text-slate-400 block font-semibold">Raw Master Value</label>
                        <input
                          type="text"
                          placeholder="e.g. Y, PLATINUM"
                          value={m.raw}
                          onChange={(e) => {
                            const next = [...editFieldValueMappings];
                            next[idx].raw = e.target.value;
                            setEditFieldValueMappings(next);
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-mono bg-white"
                        />
                      </div>
                      <span className="text-slate-400 font-bold mt-3">→</span>
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-400 block font-semibold">Dealer Display Label</label>
                        <input
                          type="text"
                          placeholder="e.g. 🛡️ Platinum 5-Yr Comprehensive"
                          value={m.mapped}
                          onChange={(e) => {
                            const next = [...editFieldValueMappings];
                            next[idx].mapped = e.target.value;
                            setEditFieldValueMappings(next);
                          }}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded font-medium bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditFieldValueMappings(editFieldValueMappings.filter((_, i) => i !== idx));
                        }}
                        className="text-slate-400 hover:text-rose-600 mt-3 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {editFieldValueMappings.length === 0 && (
                    <div className="text-center py-4 text-slate-400 italic">
                      No custom mappings defined. The dealer application will display the raw record value directly.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Sticky Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 sticky bottom-0 z-10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingFieldConfig(null)}
                  className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer shadow-2xs flex items-center gap-1.5 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Close / Cancel</span>
                </button>
                {onOpenDealerPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFieldConfig(null);
                      onOpenDealerPreview();
                    }}
                    className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
                    title="Test how this custom field mapping looks and behaves in the live Dealer App Simulator"
                  >
                    <Smartphone className="h-3.5 w-3.5 text-emerald-700" />
                    <span>Test in Dealer Simulator →</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleSaveFieldConfiguration}
                className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold cursor-pointer hover:bg-blue-800 transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Save Configuration</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION MODAL */}
      {deletingRecord && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingRecord(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 text-xs text-center space-y-3 animate-fade-in my-auto">
            <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Delete Master Record?</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Are you sure you want to delete row <span className="font-bold font-mono">{deletingRecord.id}</span> from {master.name}? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingRecord(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer shadow-2xs"
              >
                Close / Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-lg bg-rose-600 text-white font-bold cursor-pointer hover:bg-rose-700 transition-colors shadow-xs"
              >
                Delete Row
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: AUDIT TRAIL MODAL (Automated Middleware Log View) */}
      {isAuditTrailModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAuditTrailModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-fade-in text-xs max-h-[88vh] flex flex-col my-auto">
            <div className="px-5 py-3.5 bg-[#002B49] text-white flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-300" />
                <div>
                  <h3 className="font-bold text-sm">Entity Audit Trail &amp; Compliance</h3>
                  <p className="text-[11px] text-blue-200">
                    Audit log history for {master.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditTrailModalOpen(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer border border-white/20 transition-all shadow-2xs hover:scale-105"
                title="Close modal (Esc)"
              >
                <X className="h-4 w-4 text-white" />
                <span>Close</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500 pb-2 border-b border-slate-100">
                <span>
                  Tracking user actions, timestamps, and row-level diffs via <strong>AuditTrailMiddleware</strong>.
                </span>
                <span className="font-mono">{masterAuditLogs.length} events logged</span>
              </div>

              {masterAuditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Clock className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="italic">No audit events recorded for {master.name} yet.</p>
                  <p className="text-[10px]">
                    Any Insert, Update, Delete, or Schema Parameter extension will automatically be tracked here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {masterAuditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.action.includes('Created')
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.action.includes('Deleted')
                                ? 'bg-rose-100 text-rose-800'
                                : log.action.includes('Extended')
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {log.action}
                          </span>
                          <span className="font-bold text-slate-900">{log.entity}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {log.timestamp}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200/80">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Author:</span>
                          <span className="font-semibold text-slate-700">
                            {log.userName} ({log.userId})
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">IP Address:</span>
                          <span className="font-mono text-slate-600">{log.ipAddress}</span>
                        </div>
                      </div>

                      <div className="text-[11px] space-y-1">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                          Changes Made (Delta Diff):
                        </span>
                        <p className="font-mono text-slate-800 bg-white p-2 rounded border border-slate-200/60 text-[11px] break-all">
                          {log.newValue}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              {onOpenChangeLog ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsAuditTrailModalOpen(false);
                    onOpenChangeLog();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                >
                  <History className="h-3.5 w-3.5 text-indigo-700" />
                  <span>Open Full Change Log Tab →</span>
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setIsAuditTrailModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold cursor-pointer hover:bg-blue-800 transition-colors shadow-xs"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: BULK IMPORT MODAL (Excel / CSV Ingestion Engine) */}
      <MasterDataImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        master={master}
        onImportComplete={handleImportComplete}
      />

      {/* MODAL 6: BATCH UNDO & SESSION ROLLBACK MANAGER */}
      <BatchUndoModal
        isOpen={isBatchUndoModalOpen}
        onClose={() => setIsBatchUndoModalOpen(false)}
        undoStack={currentUndoStack}
        currentMaster={master}
        onRevertSnapshot={handleRevertSnapshot}
        onRevertLastBulkImport={handleRevertLastBulkImport}
        onClearHistory={handleClearUndoHistory}
      />

      {/* MODAL 7: BULK EDIT MODAL */}
      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        selectedRowIds={selectedRowIds}
        master={master}
        onApplyBulkEdit={handleApplyBulkEdit}
        onBulkDelete={handleBulkDelete}
      />
    </div>
  );
};
