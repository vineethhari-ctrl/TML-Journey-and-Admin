import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { AuditTrailMiddleware } from '../../middleware/auditTrailMiddleware';
import { masterExportUtil } from '../../utils/masterExportUtil';
import { MasterDataImportModal } from './MasterDataImportModal';
import { BatchUndoModal, MasterChangeSnapshot } from './BatchUndoModal';
import { BulkEditModal } from './BulkEditModal';

interface MasterTableEditorProps {
  master: MasterConfig;
  onUpdateMaster: (updated: MasterConfig) => void;
  isAdminTml: boolean;
  readOnly?: boolean;
}

export const MasterTableEditor: React.FC<MasterTableEditorProps> = ({
  master,
  onUpdateMaster,
  isAdminTml,
  readOnly = false,
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

  // Form generator state
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const canEdit = !readOnly && (master.owner === 'TML_ADMIN' ? isAdminTml : true);

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
    const initial: Record<string, any> = {
      id: `REC-${Date.now().toString().slice(-4)}`,
    };
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
    const errors: Record<string, string> = {};

    master.fields.forEach((f) => {
      if (f.mandatory) {
        const val = formData[f.key];
        if (val === undefined || val === null || String(val).trim() === '') {
          errors[f.key] = `${f.label} is required.`;
        }
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast('Please fix the validation errors in the form.', 'error');
      return;
    }

    let updatedRecords: Array<Record<string, any>>;
    if (editingRecordId) {
      const oldRecord = master.records.find((r) => r.id === editingRecordId) || {};
      updatedRecords = master.records.map((r) =>
        r.id === editingRecordId ? { ...formData } : r
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
        newRecord: formData,
        user: { userId: currentUser.userId, userName: currentUser.name },
        logAudit,
      });

      onUpdateMaster(newMaster);
      showToast(`Record ${editingRecordId} updated successfully.`, 'success');
    } else {
      updatedRecords = [formData, ...master.records];
      const newMaster = { ...master, records: updatedRecords };

      recordSnapshot(
        'CREATE_RECORD',
        `Added record ${formData.id || 'New Record'}`,
        1,
        newMaster,
        `Inserted new row into ${master.name}`
      );

      // Automatically log row creation via AuditTrailMiddleware
      AuditTrailMiddleware.logCreateRow({
        masterName: master.name,
        masterId: master.id,
        record: formData,
        user: { userId: currentUser.userId, userName: currentUser.name },
        logAudit,
      });

      onUpdateMaster(newMaster);
      showToast(`New record added to ${master.name}.`, 'success');
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

    if (master.fields.some((f) => f.key === key)) {
      showToast(`Parameter key "${key}" already exists in this schema.`, 'error');
      return;
    }

    const newField: MasterFieldDef = {
      key,
      label: newFieldLabel.trim(),
      type: newFieldType,
      mandatory: newFieldMandatory,
      options:
        newFieldType === 'select'
          ? newFieldOptions.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
    };

    const defaultValue =
      newFieldDefaultVal.trim() ||
      (newFieldType === 'select' && newField.options && newField.options.length > 0
        ? newField.options[0]
        : newFieldType === 'number'
        ? 0
        : newFieldType === 'boolean'
        ? false
        : '—');

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
      `Added parameter "${newField.label}" (${newField.type})`,
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
    showToast(`Schema updated! Added custom parameter "${newField.label}".`, 'success');
  };

  // Handle bulk import completion from MasterDataImportModal
  const handleImportComplete = (
    importedRows: Array<Record<string, any>>,
    mode: 'append' | 'upsert'
  ) => {
    let updatedRecords: Array<Record<string, any>>;

    if (mode === 'upsert') {
      const importedMap = new Map(importedRows.map((r) => [r.id, r]));
      const existingUpdated = master.records.map((r) =>
        importedMap.has(r.id) ? { ...r, ...importedMap.get(r.id) } : r
      );
      const existingIds = new Set(master.records.map((r) => r.id));
      const brandNew = importedRows.filter((r) => !existingIds.has(r.id));
      updatedRecords = [...brandNew, ...existingUpdated];
    } else {
      updatedRecords = [...importedRows, ...master.records];
    }

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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                title="Bulk upload master data from Excel or CSV with schema field mapping"
              >
                <Upload className="h-3.5 w-3.5 text-blue-600" />
                <span>⬆ Import Data</span>
              </button>
            )}

            {canEdit && (
              <button
                onClick={() => setIsAddFieldModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                title="Add a custom parameter to this entity schema without code changes"
              >
                <Sliders className="h-3.5 w-3.5 text-blue-600" />
                <span>+ Add Field / Parameter</span>
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
                  onClick={() => handleBulkDelete(selectedRowIds)}
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
                      onClick={() => handleSortToggle(f.key)}
                      className="py-3 px-3.5 cursor-pointer hover:bg-[#003B66] transition-colors select-none group"
                      title={`Click to sort by ${f.label}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{f.label}</span>
                        {f.mandatory && <span className="text-amber-300 font-bold">*</span>}
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

                        return (
                          <td key={f.key} className="py-2.5 px-3.5 text-slate-700">
                            {val !== undefined && val !== null ? String(val) : '—'}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-fade-in text-xs max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-[#002B49] text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-sm">
                  {editingRecordId ? 'Edit Master Record' : 'Add New Master Row'}
                </h3>
                <p className="text-[11px] text-blue-200">{master.name}</p>
              </div>
              <button
                onClick={() => setIsRecordModalOpen(false)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="p-5 space-y-3.5 overflow-y-auto flex-1">
              {master.fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center justify-between text-xs">
                    <span>
                      {f.label} {f.mandatory && <span className="text-rose-500">*</span>}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-normal">
                      [{f.type}]
                    </span>
                  </label>

                  {/* Dropdown Input */}
                  {f.type === 'select' && f.options ? (
                    <select
                      value={formData[f.key] !== undefined ? formData[f.key] : f.options[0]}
                      onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden bg-white"
                    >
                      {f.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'number' ? (
                    /* Number Input */
                    <input
                      type="number"
                      step="any"
                      value={formData[f.key] !== undefined ? formData[f.key] : ''}
                      onChange={(e) =>
                        setFormData({ ...formData, [f.key]: Number(e.target.value) })
                      }
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                      placeholder={`Enter ${f.label}`}
                    />
                  ) : f.type === 'date' ? (
                    /* Date Input */
                    <input
                      type="date"
                      value={formData[f.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                    />
                  ) : f.type === 'boolean' ? (
                    /* Boolean Toggle */
                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={Boolean(formData[f.key])}
                        onChange={(e) => setFormData({ ...formData, [f.key]: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-slate-600 font-semibold">Enabled / Active</span>
                    </label>
                  ) : (
                    /* Text Input */
                    <input
                      type="text"
                      value={formData[f.key] !== undefined ? formData[f.key] : ''}
                      onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                      placeholder={`Enter ${f.label}`}
                    />
                  )}

                  {formErrors[f.key] && (
                    <p className="text-[10px] text-rose-500 font-semibold">
                      {formErrors[f.key]}
                    </p>
                  )}
                </div>
              ))}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold cursor-pointer hover:bg-blue-800 transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-fade-in text-xs">
            <div className="px-5 py-4 bg-[#002B49] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Add Custom Schema Parameter</h3>
                <p className="text-[11px] text-blue-200">
                  Dynamically expand schema for {master.name}
                </p>
              </div>
              <button
                onClick={() => setIsAddFieldModalOpen(false)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomParameter} className="p-5 space-y-3.5">
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
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
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
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Default Value for Existing Rows
                </label>
                <input
                  type="text"
                  placeholder="e.g. Standard"
                  value={newFieldDefaultVal}
                  onChange={(e) => setNewFieldDefaultVal(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-hidden"
                />
              </div>

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
                  className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold cursor-pointer hover:bg-blue-800 transition-colors"
                >
                  Add Field to Schema
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION MODAL */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 text-xs text-center space-y-3 animate-fade-in">
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
                onClick={() => setDeletingRecord(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-lg bg-rose-600 text-white font-bold cursor-pointer hover:bg-rose-700 transition-colors"
              >
                Delete Row
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: AUDIT TRAIL MODAL (Automated Middleware Log View) */}
      {isAuditTrailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-fade-in text-xs max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 bg-[#002B49] text-white flex items-center justify-between shrink-0">
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
                onClick={() => setIsAuditTrailModalOpen(false)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
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

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsAuditTrailModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold cursor-pointer hover:bg-blue-800"
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
