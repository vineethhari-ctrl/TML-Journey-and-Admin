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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface MasterDataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  master: MasterConfig;
  onImportComplete: (importedRecords: Array<Record<string, any>>, mode: 'append' | 'upsert') => void;
}

interface ValidationResult {
  rowIndex: number;
  data: Record<string, any>;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  isValid: boolean;
}

export const MasterDataImportModal: React.FC<MasterDataImportModalProps> = ({
  isOpen,
  onClose,
  master,
  onImportComplete,
}) => {
  const { showToast, currentUser, logAudit } = useApp();

  // Step 1: Upload, Step 2: Field Mapping, Step 3: Validation & Preview
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Uploaded file info
  const [file, setFile] = useState<File | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Array<Record<string, any>>>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Field Mapping: mapping schema key -> file header name
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

  // Import options
  const [importMode, setImportMode] = useState<'append' | 'upsert'>('append');
  const [skipInvalidRows, setSkipInvalidRows] = useState(true);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'errors'>('all');

  if (!isOpen) return null;

  // Reset modal state
  const handleReset = () => {
    setCurrentStep(1);
    setFile(null);
    setFileHeaders([]);
    setRawRows([]);
    setFieldMapping({});
    setIsProcessingFile(false);
  };

  // Helper to normalize string for fuzzy matching
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Step 1: Read File (Excel or CSV)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setIsProcessingFile(true);
    setFile(uploadedFile);

    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Parse rows as raw JSON objects with header array
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
          defval: '',
          raw: false,
        });

        if (jsonData.length === 0) {
          showToast('The uploaded file contains no data rows.', 'error');
          setIsProcessingFile(false);
          return;
        }

        // Extract file headers from the first row or sheet range
        const headers: string[] = Object.keys(jsonData[0] || {});
        setFileHeaders(headers);
        setRawRows(jsonData);

        // Auto-map fields
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

        setFieldMapping(initialMapping);
        setCurrentStep(2);
        showToast(
          `Parsed ${jsonData.length} rows and ${headers.length} columns from ${uploadedFile.name}`,
          'success'
        );
      } catch (err) {
        console.error('File parsing error:', err);
        showToast('Failed to parse file. Please ensure it is a valid .xlsx, .xls, or .csv file.', 'error');
      } finally {
        setIsProcessingFile(false);
      }
    };

    reader.onerror = () => {
      showToast('Error reading the uploaded file.', 'error');
      setIsProcessingFile(false);
    };

    reader.readAsArrayBuffer(uploadedFile);
  };

  // Download Sample Template with master's current schema
  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    const sampleHeaders: Record<string, any> = {
      ID: `${master.id.slice(0, 3).toUpperCase()}-101`,
    };

    master.fields.forEach((f) => {
      if (f.key === 'id') return;

      if (f.type === 'select' && f.options && f.options.length > 0) {
        sampleHeaders[f.label] = f.options[0];
      } else if (f.type === 'number') {
        sampleHeaders[f.label] = 10;
      } else if (f.type === 'boolean') {
        sampleHeaders[f.label] = 'Y';
      } else if (f.type === 'date') {
        sampleHeaders[f.label] = new Date().toISOString().split('T')[0];
      } else {
        sampleHeaders[f.label] = `Sample ${f.label}`;
      }
    });

    const worksheet = XLSX.utils.json_to_sheet([sampleHeaders]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MasterTemplate');

    if (format === 'csv') {
      XLSX.writeFile(workbook, `TML_${master.id}_import_template.csv`, { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, `TML_${master.id}_import_template.xlsx`, { bookType: 'xlsx' });
    }

    showToast(`Downloaded sample import template (${format.toUpperCase()})`, 'success');
  };

  // Check which mandatory schema fields are missing mapping
  const missingMandatoryFields = useMemo(() => {
    return master.fields.filter((f) => f.mandatory && !fieldMapping[f.key]);
  }, [master.fields, fieldMapping]);

  // Step 3: Validate mapped data rows against master schema
  const validationResults: ValidationResult[] = useMemo(() => {
    if (currentStep !== 3) return [];

    return rawRows.map((rawRow, idx) => {
      const mappedRecord: Record<string, any> = {};
      const errors: Record<string, string> = {};
      const warnings: Record<string, string> = {};

      // Handle ID
      if (fieldMapping['id'] && rawRow[fieldMapping['id']]) {
        mappedRecord['id'] = String(rawRow[fieldMapping['id']]).trim();
      } else {
        mappedRecord['id'] = `REC-IMP-${Date.now().toString().slice(-4)}-${idx + 1}`;
      }

      // Map each schema field
      master.fields.forEach((field) => {
        const fileCol = fieldMapping[field.key];
        const rawValue = fileCol ? rawRow[fileCol] : undefined;

        // Mandatory check
        if (field.mandatory) {
          if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
            errors[field.key] = `${field.label} is required.`;
            return;
          }
        }

        if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
          // If not mandatory, assign default or empty
          if (field.type === 'boolean') mappedRecord[field.key] = false;
          else if (field.type === 'number') mappedRecord[field.key] = 0;
          else mappedRecord[field.key] = '';
          return;
        }

        const strVal = String(rawValue).trim();

        // Data type integrity checks
        if (field.type === 'number') {
          const num = Number(strVal);
          if (isNaN(num)) {
            errors[field.key] = `Invalid number: "${strVal}"`;
          } else {
            mappedRecord[field.key] = num;
          }
        } else if (field.type === 'boolean') {
          const lower = strVal.toLowerCase();
          if (['y', 'yes', 'true', '1', 'active'].includes(lower)) {
            mappedRecord[field.key] = field.key === 'active' ? 'Y' : true;
          } else if (['n', 'no', 'false', '0', 'inactive'].includes(lower)) {
            mappedRecord[field.key] = field.key === 'active' ? 'N' : false;
          } else {
            warnings[field.key] = `Expected boolean, inferred: ${strVal}`;
            mappedRecord[field.key] = strVal;
          }
        } else if (field.type === 'select') {
          if (field.options && field.options.length > 0) {
            const match = field.options.find(
              (opt) => opt.toLowerCase() === strVal.toLowerCase()
            );
            if (match) {
              mappedRecord[field.key] = match;
            } else {
              errors[field.key] = `Value "${strVal}" not in allowed options: [${field.options.join(', ')}]`;
            }
          } else {
            mappedRecord[field.key] = strVal;
          }
        } else if (field.type === 'date') {
          const parsedDate = Date.parse(strVal);
          if (isNaN(parsedDate)) {
            errors[field.key] = `Invalid date format: "${strVal}"`;
          } else {
            mappedRecord[field.key] = new Date(parsedDate).toISOString().split('T')[0];
          }
        } else {
          // Standard text
          mappedRecord[field.key] = strVal;
        }
      });

      return {
        rowIndex: idx + 1,
        data: mappedRecord,
        errors,
        warnings,
        isValid: Object.keys(errors).length === 0,
      };
    });
  }, [currentStep, rawRows, fieldMapping, master.fields]);

  // Counts
  const validCount = useMemo(
    () => validationResults.filter((r) => r.isValid).length,
    [validationResults]
  );
  const errorCount = useMemo(
    () => validationResults.filter((r) => !r.isValid).length,
    [validationResults]
  );

  // Filtered rows for Step 3 preview
  const displayRows = useMemo(() => {
    if (previewFilter === 'valid') return validationResults.filter((r) => r.isValid);
    if (previewFilter === 'errors') return validationResults.filter((r) => !r.isValid);
    return validationResults;
  }, [validationResults, previewFilter]);

  // Execute Import
  const handleCommitImport = () => {
    const rowsToImport = skipInvalidRows
      ? validationResults.filter((r) => r.isValid).map((r) => r.data)
      : validationResults.map((r) => r.data);

    if (rowsToImport.length === 0) {
      showToast('No valid rows available to import.', 'error');
      return;
    }

    onImportComplete(rowsToImport, importMode);

    logAudit(
      'Master Data Bulk Imported',
      'Masters Maintenance',
      `${master.name} (Bulk Import)`,
      'File Upload Pipeline',
      `Imported ${rowsToImport.length} records from "${file?.name}". Mode: ${importMode.toUpperCase()}. Skipped errors: ${errorCount}.`,
      'SUCCESS'
    );

    showToast(
      `Successfully imported ${rowsToImport.length} records into ${master.name}!`,
      'success'
    );
    handleReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in text-xs">
        {/* Header */}
        <div className="px-6 py-4 bg-[#002B49] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-800/80 border border-blue-400/30 flex items-center justify-center">
              <Upload className="h-5 w-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">Bulk Import Master Data</h3>
                <span className="px-2 py-0.5 rounded bg-blue-700/80 text-[10px] font-mono text-blue-100">
                  {master.name}
                </span>
              </div>
              <p className="text-[11px] text-blue-200">
                Excel/CSV schema-validated bulk data ingestion
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="text-white/60 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper Wizard Progress */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-6">
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
              <span>Upload Excel / CSV</span>
            </div>

            <div className="h-0.5 w-8 bg-slate-200" />

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
              <span>Field Mapping &amp; Alignment</span>
            </div>

            <div className="h-0.5 w-8 bg-slate-200" />

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
              <span>Integrity Validation &amp; Ingestion</span>
            </div>
          </div>

          {/* Quick template actions */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-semibold">Templates:</span>
            <button
              onClick={() => handleDownloadTemplate('xlsx')}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Excel Template</span>
            </button>
            <button
              onClick={() => handleDownloadTemplate('csv')}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              <span>CSV Template</span>
            </button>
          </div>
        </div>

        {/* STEP 1: UPLOAD FILE */}
        {currentStep === 1 && (
          <div className="p-8 space-y-6 flex-1 overflow-y-auto">
            <div className="max-w-xl mx-auto text-center space-y-2">
              <h4 className="text-base font-bold text-slate-900">
                Upload Dataset for {master.name}
              </h4>
              <p className="text-slate-500 text-xs">
                Select a Microsoft Excel (.xlsx, .xls) or comma-separated (.csv) file to import into
                the system. All data rows will be validated against the active schema.
              </p>
            </div>

            <div className="max-w-xl mx-auto border-2 border-dashed border-slate-300 hover:border-blue-500 transition-colors rounded-2xl p-8 bg-slate-50/50 hover:bg-blue-50/20 text-center relative cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={isProcessingFile}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-blue-100 text-blue-900 mx-auto flex items-center justify-center">
                  {isProcessingFile ? (
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-700" />
                  ) : (
                    <Upload className="h-6 w-6 text-blue-700" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">
                    {isProcessingFile
                      ? 'Parsing and verifying file structure...'
                      : 'Click to browse or drag and drop your file'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Supports Microsoft Excel (.xlsx, .xls) or CSV up to 10MB
                  </p>
                </div>
              </div>
            </div>

            {/* Schema preview notice */}
            <div className="max-w-xl mx-auto bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                <Info className="h-4 w-4 text-blue-700 shrink-0" />
                <span>Expected Target Schema ({master.fields.length} Fields)</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {master.fields.map((f) => (
                  <span
                    key={f.key}
                    className="px-2 py-0.5 bg-white border border-blue-200 rounded-md text-[11px] font-semibold text-slate-700 flex items-center gap-1"
                  >
                    <span>{f.label}</span>
                    <span className="text-[9px] text-slate-400 font-mono">[{f.type}]</span>
                    {f.mandatory && <span className="text-rose-500 font-bold">*</span>}
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
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold text-slate-800">
                  File: <strong className="font-bold">{file?.name}</strong> ({rawRows.length} rows, {fileHeaders.length} columns)
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Verify each target schema field is mapped to the corresponding column in your file.
              </div>
            </div>

            {missingMandatoryFields.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-center gap-2 text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <div>
                  <strong>Mandatory Mapping Warning:</strong> Please map the required field(s):{' '}
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
                    <th className="py-2.5 px-4">Master Target Field (Schema)</th>
                    <th className="py-2.5 px-4">Data Type &amp; Requirements</th>
                    <th className="py-2.5 px-4">File Source Column</th>
                    <th className="py-2.5 px-4 w-32">Match Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Optional ID mapping */}
                  <tr className="bg-slate-50/40">
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      Record Unique ID (Optional)
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                        ID Key
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <select
                        value={fieldMapping['id'] || ''}
                        onChange={(e) => setFieldMapping({ ...fieldMapping, id: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-hidden"
                      >
                        <option value="">-- Auto-generate Unique IDs --</option>
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
                        <span className="text-slate-400 italic text-[11px]">Auto-ID</span>
                      )}
                    </td>
                  </tr>

                  {/* Schema Fields */}
                  {master.fields.map((field) => {
                    const isMapped = Boolean(fieldMapping[field.key]);
                    return (
                      <tr key={field.key} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span>{field.label}</span>
                            {field.mandatory && (
                              <span className="text-rose-500 font-bold" title="Mandatory Field">
                                *
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
                            <option value="">-- Do Not Map / Use Default --</option>
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

        {/* STEP 3: INTEGRITY VALIDATION & INGESTION PREVIEW */}
        {currentStep === 3 && (
          <div className="p-6 space-y-4 flex-1 overflow-y-auto">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
                <span className="text-slate-500 block text-[11px] font-semibold">Total Rows</span>
                <span className="text-lg font-bold text-slate-800">
                  {validationResults.length}
                </span>
              </div>
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
                <span className="text-emerald-700 block text-[11px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Valid &amp; Ready
                </span>
                <span className="text-lg font-bold text-emerald-800">{validCount}</span>
              </div>
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50">
                <span className="text-rose-700 block text-[11px] font-semibold flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5" /> Rows with Errors
                </span>
                <span className="text-lg font-bold text-rose-800">{errorCount}</span>
              </div>
              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50">
                <span className="text-blue-700 block text-[11px] font-semibold">
                  Import Ingestion Mode
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <select
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value as any)}
                    className="text-xs font-bold text-blue-900 bg-transparent focus:outline-hidden"
                  >
                    <option value="append">Append Rows</option>
                    <option value="upsert">Upsert / Merge by ID</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Validation Controls and Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Filter Preview:</span>
                <button
                  onClick={() => setPreviewFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    previewFilter === 'all'
                      ? 'bg-blue-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({validationResults.length})
                </button>
                <button
                  onClick={() => setPreviewFilter('valid')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    previewFilter === 'valid'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Valid ({validCount})
                </button>
                <button
                  onClick={() => setPreviewFilter('errors')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                    previewFilter === 'errors'
                      ? 'bg-rose-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Errors ({errorCount})
                </button>
              </div>

              {errorCount > 0 && (
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={skipInvalidRows}
                    onChange={(e) => setSkipInvalidRows(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Skip rows with errors and import only valid rows ({validCount})</span>
                </label>
              )}
            </div>

            {/* Preview Data Grid */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#002B49] text-white uppercase text-[10px] tracking-wider font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="py-2 px-3 w-12 text-center">Row</th>
                    <th className="py-2 px-3 w-24">Status</th>
                    <th className="py-2 px-3">Record ID</th>
                    {master.fields.map((f) => (
                      <th key={f.key} className="py-2 px-3">
                        {f.label}
                      </th>
                    ))}
                    <th className="py-2 px-3">Validation Diagnostic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={master.fields.length + 4}
                        className="py-8 text-center text-slate-400 italic"
                      >
                        No rows match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    displayRows.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={row.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/40'}
                      >
                        <td className="py-2 px-3 text-center font-mono text-slate-400 text-[11px]">
                          {row.rowIndex}
                        </td>
                        <td className="py-2 px-3">
                          {row.isValid ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                              <Check className="h-3 w-3" /> Valid
                            </span>
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
                                hasErr ? 'text-rose-700 font-bold bg-rose-100/50' : 'text-slate-700'
                              }`}
                              title={row.errors[f.key] || ''}
                            >
                              {val !== undefined && val !== null ? String(val) : '—'}
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 text-[11px]">
                          {row.isValid ? (
                            <span className="text-emerald-700">Schema compliant</span>
                          ) : (
                            <span className="text-rose-600 font-semibold">
                              {Object.values(row.errors).join('; ')}
                            </span>
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
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer text-xs"
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
              className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 font-semibold cursor-pointer text-xs"
            >
              Cancel
            </button>

            {currentStep === 1 && (
              <button
                type="button"
                disabled={!file || isProcessingFile}
                onClick={() => setCurrentStep(2)}
                className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold cursor-pointer hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs shadow-xs"
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
                className="px-4 py-1.5 rounded-lg bg-blue-900 text-white font-bold cursor-pointer hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs shadow-xs"
              >
                <span>Validate &amp; Preview Rows</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                disabled={validCount === 0}
                onClick={handleCommitImport}
                className="px-5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs shadow-xs"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Confirm &amp; Ingest{' '}
                  {skipInvalidRows ? validCount : validationResults.length} Records
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
