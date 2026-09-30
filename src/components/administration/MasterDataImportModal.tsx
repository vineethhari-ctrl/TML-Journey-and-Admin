import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { MasterConfig, MasterFieldDef } from '../../data/masterCatalogue';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  ArrowRight,
  Download,
  Info,
  Check,
  RefreshCw,
  Layers,
  HelpCircle,
  FileCheck,
  FileCode,
  FileJson,
  Search,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  RotateCcw,
  Sliders,
  Filter,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { masterValidationSchema } from '../../utils/masterValidationSchema';

interface MasterDataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  master: MasterConfig;
  onImportComplete: (
    importedRecords: Array<Record<string, any>>,
    mode: 'append' | 'upsert' | 'replace'
  ) => void;
}

export interface ValidationResult {
  rowIndex: number;
  data: Record<string, any>;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  isValid: boolean;
  isExistingMatch: boolean;
  existingId?: string;
}

export const MasterDataImportModal: React.FC<MasterDataImportModalProps> = ({
  isOpen,
  onClose,
  master,
  onImportComplete,
}) => {
  const { showToast, logAudit } = useApp();

  // Step 1: Upload, Step 2: Field Mapping, Step 3: Validation Summary Report & Ingestion
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Uploaded file info
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'excel' | 'json' | 'csv' | 'sample'>('excel');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Array<Record<string, any>>>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Field Mapping: mapping schema key -> file header name
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

  // Step 3 Ingestion options
  const [importMode, setImportMode] = useState<'append' | 'upsert' | 'replace'>('append');
  const [skipInvalidRows, setSkipInvalidRows] = useState(true);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'errors' | 'warnings' | 'existing'>('all');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);

  if (!isOpen) return null;

  // Reset modal state
  const handleReset = () => {
    setCurrentStep(1);
    setFile(null);
    setFileType('excel');
    setFileHeaders([]);
    setRawRows([]);
    setFieldMapping({});
    setIsProcessingFile(false);
    setIsDragging(false);
    setPreviewFilter('all');
    setTableSearchQuery('');
    setConfirmReplace(false);
    setImportMode('append');
  };

  // Helper to normalize string for fuzzy matching
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Helper to initialize field mapping given file headers
  const autoMapHeaders = (headers: string[]) => {
    const initialMapping: Record<string, string> = {};
    master.fields.forEach((field) => {
      const normKey = normalize(field.key);
      const normLabel = normalize(field.label);

      const matchedHeader = headers.find((h) => {
        const normH = normalize(h);
        return (
          normH === normKey ||
          normH === normLabel ||
          normH.includes(normKey) ||
          normKey.includes(normH) ||
          normH.includes(normLabel) ||
          normLabel.includes(normH)
        );
      });

      if (matchedHeader) {
        initialMapping[field.key] = matchedHeader;
      } else {
        initialMapping[field.key] = '';
      }
    });

    // Also check if there's an ID column
    const matchedIdHeader = headers.find((h) => {
      const normH = normalize(h);
      return normH === 'id' || normH === 'code' || normH.includes('id');
    });
    if (matchedIdHeader) {
      initialMapping['id'] = matchedIdHeader;
    }

    return initialMapping;
  };

  // Process JSON content
  const processJsonData = (jsonText: string, fileName: string) => {
    try {
      const parsed = JSON.parse(jsonText);
      let records: Array<Record<string, any>> = [];

      if (Array.isArray(parsed)) {
        records = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.records)) {
          records = parsed.records;
        } else if (Array.isArray(parsed.parameters)) {
          records = parsed.parameters;
        } else if (Array.isArray(parsed.data)) {
          records = parsed.data;
        } else if (Array.isArray(parsed.items)) {
          records = parsed.items;
        } else {
          // If object has key-value objects like { "PARAM_1": {...}, "PARAM_2": {...} }
          const values = Object.values(parsed);
          if (values.length > 0 && typeof values[0] === 'object' && values[0] !== null) {
            records = Object.entries(parsed).map(([key, val]) => ({
              id: key,
              ...(val as Record<string, any>),
            }));
          } else {
            records = [parsed];
          }
        }
      }

      if (records.length === 0) {
        showToast('JSON file contains no record entries.', 'error');
        setIsProcessingFile(false);
        return;
      }

      // Collect all unique keys from all rows
      const headersSet = new Set<string>();
      records.forEach((rec) => {
        if (rec && typeof rec === 'object') {
          Object.keys(rec).forEach((k) => headersSet.add(k));
        }
      });
      const headers = Array.from(headersSet);

      setFileHeaders(headers);
      setRawRows(records);
      setFileType('json');
      setFieldMapping(autoMapHeaders(headers));
      setCurrentStep(2);

      showToast(
        `Parsed ${records.length} parameter records and ${headers.length} attributes from JSON file: "${fileName}"`,
        'success'
      );
    } catch (err: any) {
      console.error('JSON parse error:', err);
      showToast(`Invalid JSON file format: ${err?.message || 'Parse error'}`, 'error');
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Process Excel/CSV binary buffer
  const processSpreadsheetData = (buffer: any, fileName: string, isCsv = false) => {
    try {
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: '',
        raw: false,
      });

      if (jsonData.length === 0) {
        showToast('The uploaded spreadsheet contains no data rows.', 'error');
        setIsProcessingFile(false);
        return;
      }

      const headers: string[] = Object.keys(jsonData[0] || {});
      setFileHeaders(headers);
      setRawRows(jsonData);
      setFileType(isCsv ? 'csv' : 'excel');
      setFieldMapping(autoMapHeaders(headers));
      setCurrentStep(2);

      showToast(
        `Parsed ${jsonData.length} parameter rows and ${headers.length} columns from ${fileName}`,
        'success'
      );
    } catch (err) {
      console.error('Spreadsheet parsing error:', err);
      showToast('Failed to parse file. Please ensure it is a valid .xlsx, .xls, or .csv file.', 'error');
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Step 1: Handle File Selection (JSON or Excel / CSV)
  const handleFileProcess = (uploadedFile: File) => {
    setIsProcessingFile(true);
    setFile(uploadedFile);

    const isJson =
      uploadedFile.name.toLowerCase().endsWith('.json') ||
      uploadedFile.type === 'application/json';
    const isCsv =
      uploadedFile.name.toLowerCase().endsWith('.csv') ||
      uploadedFile.type === 'text/csv';

    const reader = new FileReader();

    if (isJson) {
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        processJsonData(text, uploadedFile.name);
      };
      reader.onerror = () => {
        showToast('Error reading the uploaded JSON file.', 'error');
        setIsProcessingFile(false);
      };
      reader.readAsText(uploadedFile);
    } else {
      reader.onload = (evt) => {
        const buffer = evt.target?.result;
        processSpreadsheetData(buffer, uploadedFile.name, isCsv);
      };
      reader.onerror = () => {
        showToast('Error reading the uploaded spreadsheet file.', 'error');
        setIsProcessingFile(false);
      };
      reader.readAsArrayBuffer(uploadedFile);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      handleFileProcess(uploadedFile);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // Quick Preset: Load realistic sample dataset for the active master
  const handleLoadSampleDataset = (format: 'json' | 'excel') => {
    setIsProcessingFile(true);

    // Generate 5 realistic records tailored to current master
    const sampleData: Array<Record<string, any>> = [];
    const prefix = master.id.slice(0, 3).toUpperCase();

    // Default sample values generator
    for (let i = 1; i <= 5; i++) {
      const rec: Record<string, any> = {
        id: `${prefix}-SAMPLE-${100 + i}`,
      };

      master.fields.forEach((f) => {
        if (f.key === 'id') return;

        if (f.type === 'number') {
          rec[f.key] = (i * 10) + (f.validation?.min || 5);
        } else if (f.type === 'boolean') {
          rec[f.key] = i % 2 === 0 ? 'Y' : 'N';
        } else if (f.type === 'date') {
          const d = new Date();
          d.setDate(d.getDate() + i * 5);
          rec[f.key] = d.toISOString().split('T')[0];
        } else if (f.type === 'select' && f.options && f.options.length > 0) {
          rec[f.key] = f.options[(i - 1) % f.options.length];
        } else {
          // Contextual Tata Motors strings
          if (f.key.toLowerCase().includes('model') || f.key.toLowerCase().includes('variant')) {
            const models = ['Nexon EV Fearless+ LR', 'Harrier Dark Edition XZA+', 'Safari Adventure Persona', 'Punch Creative Flagship', 'Curvv EV Empowered+'];
            rec[f.key] = models[(i - 1) % models.length];
          } else if (f.key.toLowerCase().includes('tier') || f.key.toLowerCase().includes('warranty')) {
            rec[f.key] = i === 1 ? 'PLATINUM' : i === 2 ? 'GOLD' : 'SILVER';
          } else if (f.key.toLowerCase().includes('status')) {
            rec[f.key] = i === 5 ? 'INACTIVE' : 'ACTIVE';
          } else if (f.key.toLowerCase().includes('code')) {
            rec[f.key] = `TC-${prefix}-${1000 + i}`;
          } else if (f.key.toLowerCase().includes('desc') || f.key.toLowerCase().includes('name')) {
            rec[f.key] = `Tata Standard Parameter Spec ${i} - High Reliability`;
          } else {
            rec[f.key] = `Param Val ${i}`;
          }
        }
      });

      sampleData.push(rec);
    }

    const headers = Object.keys(sampleData[0]);
    setFileHeaders(headers);
    setRawRows(sampleData);
    setFileType(format);
    setFile(new File([JSON.stringify(sampleData)], `Sample_${master.name.replace(/\s+/g, '_')}_Records.${format === 'json' ? 'json' : 'xlsx'}`));
    setFieldMapping(autoMapHeaders(headers));
    setCurrentStep(2);
    setIsProcessingFile(false);

    showToast(
      `Loaded ${sampleData.length} sample parameter records formatted for ${master.name}. Ready for review!`,
      'success'
    );
  };

  // Download Sample Template with master's current schema
  const handleDownloadTemplate = (format: 'xlsx' | 'csv' | 'json') => {
    const sampleRecord: Record<string, any> = {
      id: `${master.id.slice(0, 3).toUpperCase()}-101`,
    };

    master.fields.forEach((f) => {
      if (f.key === 'id') return;

      if (f.type === 'select' && f.options && f.options.length > 0) {
        sampleRecord[f.key] = f.options[0];
      } else if (f.type === 'number') {
        sampleRecord[f.key] = f.validation?.min || 10;
      } else if (f.type === 'boolean') {
        sampleRecord[f.key] = 'Y';
      } else if (f.type === 'date') {
        sampleRecord[f.key] = new Date().toISOString().split('T')[0];
      } else {
        sampleRecord[f.key] = `Sample ${f.label}`;
      }
    });

    if (format === 'json') {
      const jsonTemplate = {
        metadata: {
          masterId: master.id,
          masterName: master.name,
          category: master.category,
          schemaVersion: '2.4.0',
          exportedAt: new Date().toISOString(),
          description: `Bulk Upload Template for ${master.name}. Populate multiple parameter records in the 'records' array below.`,
        },
        schemaDefinition: master.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          mandatory: Boolean(f.mandatory),
          allowedOptions: f.options || [],
          isCustomParameter: Boolean(f.isCustom),
          displayInDealerApp: Boolean(f.displayInDealerApp),
        })),
        records: [
          sampleRecord,
          {
            ...sampleRecord,
            id: `${master.id.slice(0, 3).toUpperCase()}-102`,
            ...(master.fields.some((f) => f.key === 'active') ? { active: 'Y' } : {}),
          },
        ],
      };

      const blob = new Blob([JSON.stringify(jsonTemplate, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TML_${master.id}_bulk_upload_template.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded JSON Bulk Upload Template (.json)', 'success');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet([sampleRecord]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MasterTemplate');

    if (format === 'csv') {
      XLSX.writeFile(workbook, `TML_${master.id}_bulk_upload_template.csv`, { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, `TML_${master.id}_bulk_upload_template.xlsx`, { bookType: 'xlsx' });
    }

    showToast(`Downloaded sample template (${format.toUpperCase()})`, 'success');
  };

  // Check which mandatory schema fields are missing mapping
  const missingMandatoryFields = useMemo(() => {
    return master.fields.filter((f) => f.mandatory && !fieldMapping[f.key]);
  }, [master.fields, fieldMapping]);

  // Existing Master Record IDs set (for conflict / upsert detection)
  const existingMasterIdsSet = useMemo(() => {
    return new Set(master.records.map((r) => String(r.id || '').trim().toLowerCase()));
  }, [master.records]);

  // Step 3: Comprehensive Validation Summary Report against master schema
  const validationResults: ValidationResult[] = useMemo(() => {
    if (currentStep !== 3) return [];

    const seenIdsInUpload = new Set<string>();

    return rawRows.map((rawRow, idx) => {
      const mappedRecord: Record<string, any> = {};
      const errors: Record<string, string> = {};
      const warnings: Record<string, string> = {};

      // 1. Handle Record ID
      let recordId = '';
      if (fieldMapping['id'] && rawRow[fieldMapping['id']]) {
        recordId = String(rawRow[fieldMapping['id']]).trim();
      } else if (rawRow['id'] || rawRow['ID'] || rawRow['code'] || rawRow['CODE']) {
        recordId = String(rawRow['id'] || rawRow['ID'] || rawRow['code'] || rawRow['CODE']).trim();
      } else {
        recordId = `${master.id.slice(0, 3).toUpperCase()}-IMP-${Date.now().toString().slice(-4)}-${idx + 1}`;
      }

      mappedRecord['id'] = recordId;

      // Duplicate check within upload payload
      const normId = recordId.toLowerCase();
      if (seenIdsInUpload.has(normId)) {
        errors['id'] = `Duplicate ID within upload: "${recordId}" is repeated.`;
      } else {
        seenIdsInUpload.add(normId);
      }

      // Check if matches an existing record in the master
      const isExistingMatch = existingMasterIdsSet.has(normId);
      if (isExistingMatch && importMode === 'append') {
        warnings['id'] = `ID "${recordId}" already exists in ${master.name}. Will duplicate unless using Upsert mode.`;
      }

      // 2. Validate each schema field using masterValidationSchema
      master.fields.forEach((field) => {
        const fileCol = fieldMapping[field.key];
        const rawValue = fileCol ? rawRow[fileCol] : rawRow[field.key];

        // Empty check
        const isValueEmpty =
          rawValue === undefined ||
          rawValue === null ||
          (typeof rawValue === 'string' && rawValue.trim() === '');

        if (field.mandatory && isValueEmpty) {
          errors[field.key] = `Required field "${field.label}" is missing.`;
          return;
        }

        if (isValueEmpty) {
          if (field.type === 'boolean') mappedRecord[field.key] = false;
          else if (field.type === 'number') mappedRecord[field.key] = 0;
          else mappedRecord[field.key] = '';
          return;
        }

        // Apply strict field validator
        const validation = masterValidationSchema.validateField(field, rawValue);
        if (!validation.isValid && validation.error) {
          errors[field.key] = validation.error;
        } else {
          mappedRecord[field.key] = validation.sanitizedValue;
        }

        // Noticeable auto-coercions as warnings
        if (
          field.type === 'boolean' &&
          typeof rawValue === 'string' &&
          ['y', 'yes', '1', 'true', 'n', 'no', '0', 'false'].includes(rawValue.trim().toLowerCase())
        ) {
          // clean conversion
        } else if (field.type === 'number' && typeof rawValue === 'string') {
          // numerical string converted
        }
      });

      return {
        rowIndex: idx + 1,
        data: mappedRecord,
        errors,
        warnings,
        isValid: Object.keys(errors).length === 0,
        isExistingMatch,
        existingId: recordId,
      };
    });
  }, [currentStep, rawRows, fieldMapping, master.fields, existingMasterIdsSet, importMode, master.id]);

  // Validation Metrics Breakdown
  const totalCount = validationResults.length;
  const validCount = useMemo(() => validationResults.filter((r) => r.isValid).length, [validationResults]);
  const errorCount = useMemo(() => validationResults.filter((r) => !r.isValid).length, [validationResults]);
  const warningCount = useMemo(
    () => validationResults.filter((r) => Object.keys(r.warnings).length > 0).length,
    [validationResults]
  );
  const existingMatchesCount = useMemo(
    () => validationResults.filter((r) => r.isExistingMatch).length,
    [validationResults]
  );

  const healthScore = totalCount > 0 ? Math.round((validCount / totalCount) * 100) : 100;

  // Group errors by category for the Validation Summary Report
  const diagnosticSummary = useMemo(() => {
    const missingMandatory: Array<{ row: number; field: string }> = [];
    const typeMismatches: Array<{ row: number; field: string; error: string }> = [];
    const lovViolations: Array<{ row: number; field: string; error: string }> = [];
    const duplicateKeys: Array<{ row: number; id: string }> = [];

    validationResults.forEach((res) => {
      Object.entries(res.errors).forEach(([fieldKey, err]) => {
        if (fieldKey === 'id') {
          duplicateKeys.push({ row: res.rowIndex, id: res.data.id });
        } else if (err.toLowerCase().includes('required') || err.toLowerCase().includes('missing')) {
          missingMandatory.push({ row: res.rowIndex, field: fieldKey });
        } else if (err.toLowerCase().includes('option') || err.toLowerCase().includes('allowed')) {
          lovViolations.push({ row: res.rowIndex, field: fieldKey, error: err });
        } else {
          typeMismatches.push({ row: res.rowIndex, field: fieldKey, error: err });
        }
      });
    });

    return {
      missingMandatory,
      typeMismatches,
      lovViolations,
      duplicateKeys,
    };
  }, [validationResults]);

  // Filtered rows for Step 3 preview
  const displayRows = useMemo(() => {
    let rows = validationResults;

    if (previewFilter === 'valid') {
      rows = rows.filter((r) => r.isValid);
    } else if (previewFilter === 'errors') {
      rows = rows.filter((r) => !r.isValid);
    } else if (previewFilter === 'warnings') {
      rows = rows.filter((r) => Object.keys(r.warnings).length > 0);
    } else if (previewFilter === 'existing') {
      rows = rows.filter((r) => r.isExistingMatch);
    }

    if (tableSearchQuery.trim()) {
      const q = tableSearchQuery.trim().toLowerCase();
      rows = rows.filter((r) => {
        const rowNumMatch = String(r.rowIndex).includes(q);
        const idMatch = String(r.data.id || '').toLowerCase().includes(q);
        const dataMatch = Object.values(r.data).some((val) =>
          String(val).toLowerCase().includes(q)
        );
        const errorMatch = Object.values(r.errors).some((err) =>
          err.toLowerCase().includes(q)
        );
        return rowNumMatch || idMatch || dataMatch || errorMatch;
      });
    }

    return rows;
  }, [validationResults, previewFilter, tableSearchQuery]);

  // Download Validation Summary Report
  const handleExportValidationReport = () => {
    const reportData = {
      summary: {
        masterName: master.name,
        masterId: master.id,
        analyzedAt: new Date().toISOString(),
        totalRecords: totalCount,
        validRecords: validCount,
        errorRecords: errorCount,
        warningRecords: warningCount,
        complianceRate: `${healthScore}%`,
        ingestionModeSelected: importMode,
      },
      diagnosticBreakdown: {
        missingMandatoryCount: diagnosticSummary.missingMandatory.length,
        typeMismatchCount: diagnosticSummary.typeMismatches.length,
        lovViolationCount: diagnosticSummary.lovViolations.length,
        duplicateKeyCount: diagnosticSummary.duplicateKeys.length,
      },
      rows: validationResults.map((r) => ({
        rowNumber: r.rowIndex,
        recordId: r.data.id,
        status: r.isValid ? 'VALID' : 'ERROR',
        hasWarnings: Object.keys(r.warnings).length > 0,
        errors: r.errors,
        warnings: r.warnings,
        payload: r.data,
      })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Validation_Report_${master.id}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded Validation Summary Diagnostic Report', 'success');
  };

  // Execute Commit Import
  const handleCommitImport = () => {
    if (importMode === 'replace' && !confirmReplace) {
      showToast('Please check the confirmation box to replace all existing records.', 'error');
      return;
    }

    const rowsToImport = skipInvalidRows
      ? validationResults.filter((r) => r.isValid).map((r) => r.data)
      : validationResults.map((r) => r.data);

    if (rowsToImport.length === 0) {
      showToast('No valid parameter records available to commit.', 'error');
      return;
    }

    onImportComplete(rowsToImport, importMode);

    logAudit(
      'Bulk Parameter Records Uploaded',
      'Masters Maintenance',
      `${master.name} (Bulk Upload)`,
      `${fileType.toUpperCase()} Ingestion Pipeline`,
      `Committed ${rowsToImport.length} parameter records. File: "${file?.name || 'Dataset'}". Mode: ${importMode.toUpperCase()}. Skipped invalid rows: ${errorCount}. Health Score: ${healthScore}%.`,
      'SUCCESS'
    );

    showToast(
      `Successfully committed ${rowsToImport.length} parameter records into ${master.name}! (${importMode.toUpperCase()} mode)`,
      'success'
    );
    handleReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-3">
      <div className="bg-white rounded-2xl max-w-5xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-fade-in text-xs">
        {/* Header */}
        <div className="px-6 py-4 bg-[#002B49] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-800/80 border border-blue-400/30 flex items-center justify-center shadow-inner">
              <Upload className="h-5 w-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm tracking-tight">Bulk Upload Parameter Records</h3>
                <span className="px-2 py-0.5 rounded-md bg-blue-700/80 text-[10px] font-mono text-blue-100 border border-blue-500/30">
                  {master.name}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-600/80 text-[9px] font-bold text-white uppercase tracking-wider">
                  JSON / Excel
                </span>
              </div>
              <p className="text-[11px] text-blue-200 mt-0.5">
                Upload JSON or Excel files to populate multiple parameter records with pre-commit validation summary
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper Wizard Progress */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-5">
            {/* Step 1 */}
            <div
              className={`flex items-center gap-2 ${
                currentStep >= 1 ? 'font-bold text-blue-900' : 'text-slate-400'
              }`}
            >
              <div
                className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep > 1
                    ? 'bg-emerald-600 text-white'
                    : currentStep === 1
                    ? 'bg-blue-900 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {currentStep > 1 ? <Check className="h-3 w-3" /> : '1'}
              </div>
              <span>Upload JSON / Excel</span>
            </div>

            <div className="h-0.5 w-6 bg-slate-200" />

            {/* Step 2 */}
            <div
              className={`flex items-center gap-2 ${
                currentStep >= 2 ? 'font-bold text-blue-900' : 'text-slate-400'
              }`}
            >
              <div
                className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep > 2
                    ? 'bg-emerald-600 text-white'
                    : currentStep === 2
                    ? 'bg-blue-900 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {currentStep > 2 ? <Check className="h-3 w-3" /> : '2'}
              </div>
              <span>Parameter Schema Mapping</span>
            </div>

            <div className="h-0.5 w-6 bg-slate-200" />

            {/* Step 3 */}
            <div
              className={`flex items-center gap-2 ${
                currentStep === 3 ? 'font-bold text-blue-900' : 'text-slate-400'
              }`}
            >
              <div
                className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep === 3
                    ? 'bg-blue-900 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                3
              </div>
              <span>Validation Summary Report &amp; Commit</span>
            </div>
          </div>

          {/* Quick template actions */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-semibold hidden sm:inline">Templates:</span>
            <button
              onClick={() => handleDownloadTemplate('json')}
              className="px-2 py-1 rounded-md border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Download JSON bulk template with schema annotations"
            >
              <FileJson className="h-3.5 w-3.5 text-purple-600" />
              <span>JSON</span>
            </button>
            <button
              onClick={() => handleDownloadTemplate('xlsx')}
              className="px-2 py-1 rounded-md border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Download Excel (.xlsx) bulk template"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => handleDownloadTemplate('csv')}
              className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Download CSV template"
            >
              <Download className="h-3.5 w-3.5 text-slate-600" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* STEP 1: UPLOAD FILE & PRESETS */}
        {currentStep === 1 && (
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            <div className="max-w-xl mx-auto text-center space-y-1.5">
              <h4 className="text-sm font-extrabold text-slate-900">
                Bulk Upload Parameter Dataset for {master.name}
              </h4>
              <p className="text-slate-500 text-xs">
                Upload a <strong>JSON (.json)</strong> or <strong>Excel (.xlsx, .xls, .csv)</strong> file to populate multiple records at once. Each record will be rigorously checked against type, range, and mandatory requirements.
              </p>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`max-w-xl mx-auto border-2 border-dashed rounded-2xl p-6 text-center relative cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
                  : 'border-slate-300 hover:border-blue-400 bg-slate-50/40 hover:bg-blue-50/20'
              }`}
            >
              <input
                type="file"
                accept=".json,.xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={isProcessingFile}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-11 w-11 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center shadow-xs">
                    <FileJson className="h-5 w-5 text-purple-700" />
                  </div>
                  <div className="h-11 w-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
                  </div>
                  <div className="h-11 w-11 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center shadow-xs">
                    {isProcessingFile ? (
                      <RefreshCw className="h-5 w-5 animate-spin text-blue-700" />
                    ) : (
                      <Upload className="h-5 w-5 text-blue-700" />
                    )}
                  </div>
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    {isProcessingFile
                      ? 'Parsing parameter records and validating payload structure...'
                      : 'Drop your JSON or Excel file here, or click to browse'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Supports JSON (.json) and Excel (.xlsx, .xls, .csv) files up to 15MB
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Test Demo Presets */}
            <div className="max-w-xl mx-auto bg-gradient-to-r from-blue-50 via-purple-50 to-indigo-50 border border-blue-200/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-blue-950 font-bold text-xs">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span>Instant Test: Load Sample Parameter Records</span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium">No file required</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Immediately populate realistic Tata Motors parameter records (including active custom fields and value mappings) into the ingestion pipeline:
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleLoadSampleDataset('json')}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-white border border-purple-300 text-purple-900 font-bold text-xs hover:bg-purple-100/60 transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <FileJson className="h-3.5 w-3.5 text-purple-600" />
                  <span>Load Sample JSON Records (5)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSampleDataset('excel')}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-white border border-emerald-300 text-emerald-900 font-bold text-xs hover:bg-emerald-100/60 transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Load Sample Excel Records (5)</span>
                </button>
              </div>
            </div>

            {/* Expected Master Parameter Schema Card */}
            <div className="max-w-xl mx-auto bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-slate-700 font-bold text-xs">
                <div className="flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-slate-600" />
                  <span>Target Parameter Schema ({master.fields.length} Parameters Configured)</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal">
                  Auto-aligned upon upload
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {master.fields.map((f) => (
                  <span
                    key={f.key}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 border ${
                      f.isCustom
                        ? 'bg-purple-50 text-purple-900 border-purple-200'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className="text-[9px] text-slate-400 font-mono">[{f.type}]</span>
                    {f.mandatory && <span className="text-rose-500 font-bold">*</span>}
                    {f.isCustom && (
                      <span className="text-[8px] bg-purple-200 text-purple-800 px-1 py-0.2 rounded font-bold">
                        Custom
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: FIELD MAPPING */}
        {currentStep === 2 && (
          <div className="p-6 space-y-4 flex-1 overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  {fileType === 'json' ? <FileJson className="h-4 w-4" /> : <FileCheck className="h-4 w-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-xs">
                      {file?.name || 'Dataset'}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono text-[10px] uppercase font-bold">
                      {fileType}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Detected <strong>{rawRows.length} parameter records</strong> with {fileHeaders.length} attributes.
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                Confirm attribute mapping from source file into {master.name} schema.
              </div>
            </div>

            {missingMandatoryFields.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-center gap-2 text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <div>
                  <strong>Mandatory Mapping Warning:</strong> Please map the required parameter(s):{' '}
                  <span className="font-bold underline">
                    {missingMandatoryFields.map((f) => f.label).join(', ')}
                  </span>
                </div>
              </div>
            )}

            {/* Mapping Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#002B49] text-white uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Master Target Parameter (Schema)</th>
                    <th className="py-2.5 px-4">Data Type &amp; Constraints</th>
                    <th className="py-2.5 px-4">Uploaded File Attribute</th>
                    <th className="py-2.5 px-4 w-36">Mapping Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Optional Record ID mapping */}
                  <tr className="bg-slate-50/50">
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      Record Unique ID (Key)
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                        Identifier
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <select
                        value={fieldMapping['id'] || ''}
                        onChange={(e) => setFieldMapping({ ...fieldMapping, id: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden"
                      >
                        <option value="">-- Auto-generate Unique Identifier --</option>
                        {fileHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-4">
                      {fieldMapping['id'] ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                          <Check className="h-3 w-3" /> Mapped
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Auto-Generated</span>
                      )}
                    </td>
                  </tr>

                  {/* Schema Parameters */}
                  {master.fields.map((field) => {
                    const isMapped = Boolean(fieldMapping[field.key]);
                    return (
                      <tr key={field.key} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span>{field.label}</span>
                            {field.mandatory && (
                              <span className="text-rose-500 font-bold" title="Mandatory Parameter">
                                *
                              </span>
                            )}
                            {field.isCustom && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 text-[9px] font-bold">
                                Custom
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-slate-400 font-normal">
                            key: {field.key}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-mono text-[10px] uppercase font-bold">
                              {field.type}
                            </span>
                            {field.mandatory && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold">
                                Required
                              </span>
                            )}
                          </div>
                          {field.options && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-xs mt-0.5">
                              LOV: {field.options.join(', ')}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            value={fieldMapping[field.key] || ''}
                            onChange={(e) =>
                              setFieldMapping({ ...fieldMapping, [field.key]: e.target.value })
                            }
                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white focus:outline-hidden ${
                              field.mandatory && !isMapped
                                ? 'border-amber-400 bg-amber-50/20'
                                : 'border-slate-200'
                            }`}
                          >
                            <option value="">-- Do Not Map / Use Empty Default --</option>
                            {fileHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-4">
                          {isMapped ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Mapped
                            </span>
                          ) : field.mandatory ? (
                            <span className="text-amber-600 font-bold flex items-center gap-1 text-[11px]">
                              <AlertTriangle className="h-3.5 w-3.5" /> Required
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Unmapped</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 3: COMPREHENSIVE VALIDATION SUMMARY REPORT & INGESTION HUB */}
        {currentStep === 3 && (
          <div className="p-6 space-y-4 flex-1 overflow-y-auto">
            {/* EXECUTIVE HEALTH BANNER */}
            <div
              className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 shadow-2xs ${
                errorCount === 0
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                  : validCount > 0
                  ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                  : 'bg-rose-50/80 border-rose-300 text-rose-950'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                    errorCount === 0
                      ? 'bg-emerald-600 text-white'
                      : validCount > 0
                      ? 'bg-amber-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {errorCount === 0 ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : validCount > 0 ? (
                    <AlertTriangle className="h-6 w-6" />
                  ) : (
                    <XCircle className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-sm">
                      {errorCount === 0
                        ? 'Validation Passed: 100% Ready for Master Ingestion'
                        : `Validation Summary: ${errorCount} Row${errorCount !== 1 ? 's' : ''} with Errors Detected`}
                    </h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        healthScore === 100
                          ? 'bg-emerald-200 text-emerald-900'
                          : healthScore >= 70
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-rose-200 text-rose-900'
                      }`}
                    >
                      {healthScore}% Schema Compliant
                    </span>
                  </div>
                  <p className="text-xs opacity-90 mt-0.5">
                    {errorCount === 0
                      ? `All ${totalCount} parameter records fully adhere to ${master.name} schema definitions and type constraints.`
                      : skipInvalidRows
                      ? `You can safely commit the ${validCount} valid records. The ${errorCount} invalid rows will be skipped.`
                      : `Action required: Resolve errors or enable skipping invalid rows before committing.`}
                  </p>
                </div>
              </div>

              {/* Action: Export Diagnostic Report */}
              <button
                type="button"
                onClick={handleExportValidationReport}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Download full JSON diagnostic log of this validation run"
              >
                <Download className="h-3.5 w-3.5 text-blue-600" />
                <span>Export Diagnostic Report</span>
              </button>
            </div>

            {/* 5 SUMMARY KPI CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {/* Total Records */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60">
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                  Total Payload
                </span>
                <span className="text-xl font-extrabold text-slate-800">{totalCount}</span>
                <span className="block text-[10px] text-slate-400 mt-0.5">Records in file</span>
              </div>

              {/* Valid & Ready */}
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
                <span className="text-emerald-700 block text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Ready to Ingest
                </span>
                <span className="text-xl font-extrabold text-emerald-800">{validCount}</span>
                <span className="block text-[10px] text-emerald-600 mt-0.5">
                  {totalCount > 0 ? Math.round((validCount / totalCount) * 100) : 0}% compliant
                </span>
              </div>

              {/* Blocking Errors */}
              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/50">
                <span className="text-rose-700 block text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                  <XCircle className="h-3 w-3" /> Rows with Errors
                </span>
                <span className="text-xl font-extrabold text-rose-800">{errorCount}</span>
                <span className="block text-[10px] text-rose-600 mt-0.5">
                  {errorCount > 0 ? 'Action required' : 'Zero errors'}
                </span>
              </div>

              {/* Warnings / Inferred */}
              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50">
                <span className="text-amber-700 block text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Inferred Warnings
                </span>
                <span className="text-xl font-extrabold text-amber-800">{warningCount}</span>
                <span className="block text-[10px] text-amber-600 mt-0.5">Coerced / Fallback</span>
              </div>

              {/* Existing ID Matches */}
              <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50">
                <span className="text-blue-700 block text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                  <Layers className="h-3 w-3" /> Existing IDs
                </span>
                <span className="text-xl font-extrabold text-blue-900">{existingMatchesCount}</span>
                <span className="block text-[10px] text-blue-600 mt-0.5">
                  {importMode === 'upsert' ? 'Will update' : 'May duplicate'}
                </span>
              </div>
            </div>

            {/* DIAGNOSTIC CATEGORY BREAKDOWN (IF ANY ERRORS EXIST) */}
            {errorCount > 0 && (
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-700" />
                    <span>Validation Diagnostics Breakdown</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Click any card to filter rows</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  {/* Missing Mandatory */}
                  <div
                    onClick={() => setPreviewFilter('errors')}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:border-blue-400 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">Missing Mandatory</span>
                      <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-rose-100 text-rose-800">
                        {diagnosticSummary.missingMandatory.length}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Required parameter values left empty
                    </span>
                  </div>

                  {/* Type Mismatch */}
                  <div
                    onClick={() => setPreviewFilter('errors')}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:border-blue-400 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">Type / Number Mismatch</span>
                      <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-rose-100 text-rose-800">
                        {diagnosticSummary.typeMismatches.length}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Failed strict type/range validation
                    </span>
                  </div>

                  {/* LOV Violations */}
                  <div
                    onClick={() => setPreviewFilter('errors')}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:border-blue-400 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">Dropdown LOV Violations</span>
                      <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-amber-100 text-amber-800">
                        {diagnosticSummary.lovViolations.length}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Value not in allowed master options
                    </span>
                  </div>

                  {/* Duplicate Keys */}
                  <div
                    onClick={() => setPreviewFilter('errors')}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:border-blue-400 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">Duplicate IDs in File</span>
                      <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-purple-100 text-purple-800">
                        {diagnosticSummary.duplicateKeys.length}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Identical key appears more than once
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* PRE-COMMIT CONFIGURATION & INGESTION MODE */}
            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <span className="font-extrabold text-blue-950 block">
                  Select Ingestion &amp; Merge Mode
                </span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-bold text-slate-800">Append New Rows</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="upsert"
                      checked={importMode === 'upsert'}
                      onChange={() => setImportMode('upsert')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-bold text-slate-800">
                      Upsert / Merge by ID ({existingMatchesCount} match{existingMatchesCount !== 1 ? 'es' : ''})
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-rose-700">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-bold">Replace Entire Table</span>
                  </label>
                </div>
              </div>

              {/* Skip invalid rows toggle */}
              {errorCount > 0 && (
                <div className="bg-white p-2 rounded-lg border border-amber-300">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-900">
                    <input
                      type="checkbox"
                      checked={skipInvalidRows}
                      onChange={(e) => setSkipInvalidRows(e.target.checked)}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span>Skip {errorCount} invalid rows &amp; commit {validCount} valid records</span>
                  </label>
                </div>
              )}

              {/* Replace warning checkbox */}
              {importMode === 'replace' && (
                <div className="w-full p-2 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="confirmReplace"
                    checked={confirmReplace}
                    onChange={(e) => setConfirmReplace(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <label htmlFor="confirmReplace" className="font-bold text-xs cursor-pointer">
                    I confirm overwriting all {master.records.length} existing records in {master.name} with this upload.
                  </label>
                </div>
              )}
            </div>

            {/* PREVIEW FILTER & SEARCH STRIP */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-500">Filter Records:</span>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    previewFilter === 'all'
                      ? 'bg-blue-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({validationResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('valid')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    previewFilter === 'valid'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Valid ({validCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter('errors')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    previewFilter === 'errors'
                      ? 'bg-rose-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Errors ({errorCount})
                </button>
                {existingMatchesCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('existing')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      previewFilter === 'existing'
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Existing IDs ({existingMatchesCount})
                  </button>
                )}
              </div>

              {/* Table search filter */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search in uploaded rows..."
                  value={tableSearchQuery}
                  onChange={(e) => setTableSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 rounded-lg border border-slate-200 text-xs w-52 bg-white focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            {/* PREVIEW DATA GRID */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#002B49] text-white uppercase text-[10px] tracking-wider font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">Row</th>
                    <th className="py-2.5 px-3 w-28">Validation Status</th>
                    <th className="py-2.5 px-3">Record ID</th>
                    {master.fields.map((f) => (
                      <th key={f.key} className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <span>{f.label}</span>
                          {f.isCustom && (
                            <span className="text-[8px] bg-purple-200 text-purple-900 px-1 py-0.2 rounded font-bold">
                              Custom
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="py-2.5 px-3 min-w-[220px]">Validation Diagnostic Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={master.fields.length + 4}
                        className="py-10 text-center text-slate-400 italic"
                      >
                        No parameter records match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    displayRows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={
                          !row.isValid
                            ? 'bg-rose-50/60 hover:bg-rose-50'
                            : row.isExistingMatch
                            ? 'bg-blue-50/40 hover:bg-blue-50/70'
                            : 'hover:bg-slate-50'
                        }
                      >
                        <td className="py-2 px-3 text-center font-mono text-slate-400 text-[11px]">
                          {row.rowIndex}
                        </td>
                        <td className="py-2 px-3">
                          {row.isValid ? (
                            <div className="flex items-center gap-1">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                                <Check className="h-3 w-3" /> Valid
                              </span>
                              {row.isExistingMatch && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800" title="Matches existing record ID in master">
                                  Update
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1 w-fit">
                              <XCircle className="h-3 w-3" /> Error
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold text-slate-700">
                          {row.data.id}
                        </td>
                        {master.fields.map((f) => {
                          const val = row.data[f.key];
                          const hasErr = Boolean(row.errors[f.key]);
                          return (
                            <td
                              key={f.key}
                              className={`py-2 px-3 ${
                                hasErr
                                  ? 'text-rose-700 font-bold bg-rose-100/60 border-l border-r border-rose-200'
                                  : 'text-slate-700'
                              }`}
                              title={row.errors[f.key] || ''}
                            >
                              {val !== undefined && val !== null && val !== '' ? (
                                String(val)
                              ) : (
                                <span className="text-slate-300 italic">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 text-[11px]">
                          {row.isValid ? (
                            <span className="text-emerald-700 font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Schema compliant &amp; ready
                            </span>
                          ) : (
                            <div className="text-rose-700 font-semibold space-y-0.5">
                              {Object.entries(row.errors).map(([k, err]) => (
                                <div key={k} className="flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3 text-rose-600 shrink-0" />
                                  <span>{err}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer text-xs transition-colors"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-semibold cursor-pointer text-xs transition-colors"
            >
              Cancel
            </button>

            {currentStep === 1 && (
              <button
                type="button"
                disabled={!file || isProcessingFile}
                onClick={() => setCurrentStep(2)}
                className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold cursor-pointer hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs shadow-xs transition-colors"
              >
                <span>Continue to Field Mapping</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {currentStep === 2 && (
              <button
                type="button"
                disabled={missingMandatoryFields.length > 0}
                onClick={() => setCurrentStep(3)}
                className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold cursor-pointer hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs shadow-xs transition-colors"
              >
                <span>Run Validation &amp; Generate Report</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                disabled={validCount === 0 || (importMode === 'replace' && !confirmReplace)}
                onClick={handleCommitImport}
                className="px-5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs shadow-xs transition-all"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Commit Changes (
                  {skipInvalidRows ? validCount : totalCount} Records)
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
