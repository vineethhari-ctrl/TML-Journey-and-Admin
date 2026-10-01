import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { parseDateTime } from '../../utils/dateUtil';
import { MasterConfig } from '../../data/masterCatalogue';
import {
  History,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  Sliders,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ShieldCheck,
  FileCode,
  FileSpreadsheet,
  X,
  ExternalLink,
  Code2,
  Workflow,
  Cpu,
} from 'lucide-react';
import { auditService } from '../../services/auditService';

interface MasterChangeLogViewProps {
  masterConfigs: MasterConfig[];
  selectedMasterId?: string;
  onLaunchMaster?: (masterId: string) => void;
}

interface EnrichedChangeLogItem {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'SCHEMA_EXTEND' | 'MAPPING' | 'BULK';
  module: string;
  entity: string;
  masterId?: string;
  oldValue: string;
  newValue: string;
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
  ipAddress: string;
}

export const MasterChangeLogView: React.FC<MasterChangeLogViewProps> = ({
  masterConfigs,
  selectedMasterId,
  onLaunchMaster,
}) => {
  const { auditLogs, currentUser, showToast } = useApp();

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityFilter, setSelectedEntityFilter] = useState<string>(
    selectedMasterId || 'ALL'
  );
  const [selectedActionType, setSelectedActionType] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<'ALL' | 'TODAY' | '7DAYS' | '30DAYS'>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Helper to determine action type
  const categorizeAction = (action: string): EnrichedChangeLogItem['actionType'] => {
    const act = action.toLowerCase();
    if (act.includes('custom parameter') || act.includes('schema') || act.includes('add field')) {
      return 'SCHEMA_EXTEND';
    }
    if (act.includes('mapping') || act.includes('dealer app')) {
      return 'MAPPING';
    }
    if (act.includes('bulk') || act.includes('ingest') || act.includes('import')) {
      return 'BULK';
    }
    if (act.includes('create') || act.includes('insert') || act.includes('added')) {
      return 'CREATE';
    }
    if (act.includes('delete') || act.includes('remove')) {
      return 'DELETE';
    }
    return 'UPDATE';
  };

  // Pre-seeded comprehensive master parameter change history if user has fresh session
  const defaultMasterLogs: EnrichedChangeLogItem[] = useMemo(() => {
    return [
      {
        id: 'LOG-MTR-8091',
        timestamp: '2026-09-30 15:42:10',
        userId: 'TML-PO-VH01',
        userName: 'Vineeth Hari',
        action: 'Custom Parameter Added',
        actionType: 'SCHEMA_EXTEND',
        module: 'Masters Maintenance',
        entity: 'PPL Master > extended_warranty_tier',
        masterId: 'ppl_master',
        oldValue: 'None (Schema Extension)',
        newValue:
          'Added custom parameter "Extended Warranty Tier" (key: extended_warranty_tier, type: select, options: [PLATINUM, GOLD, SILVER, STANDARD], displayInDealerApp: true, targetModule: vehicle_journey)',
        status: 'SUCCESS',
        ipAddress: '192.168.1.108',
      },
      {
        id: 'LOG-MTR-8090',
        timestamp: '2026-09-30 15:35:22',
        userId: 'TML-PO-VH01',
        userName: 'Vineeth Hari',
        action: 'Dealer Value Mapping Configured',
        actionType: 'MAPPING',
        module: 'Masters Maintenance',
        entity: 'PPL Master > extended_warranty_tier',
        masterId: 'ppl_master',
        oldValue: 'Raw Codes: [PLATINUM, GOLD, SILVER]',
        newValue:
          'PLATINUM -> "🛡️ Platinum 5-Yr Comprehensive Cover" | GOLD -> "⭐ Gold 3-Yr Drivetrain & Labour" | SILVER -> "🥈 Silver 2-Yr Basic Scheduled Plan"',
        status: 'SUCCESS',
        ipAddress: '192.168.1.108',
      },
      {
        id: 'LOG-MTR-8089',
        timestamp: '2026-09-30 14:12:05',
        userId: 'TML-DLR-ADM01',
        userName: 'K. Venkatesh',
        action: 'Master Parameter Row Updated',
        actionType: 'UPDATE',
        module: 'Masters Maintenance',
        entity: 'PPL Master (PPL-NEXON-01)',
        masterId: 'ppl_master',
        oldValue: 'extended_warranty_tier: "GOLD" | telematics_ota_status: "NON_CONNECTED"',
        newValue:
          'extended_warranty_tier: "PLATINUM" | telematics_ota_status: "OTA_ACTIVE" (Updated for Nexon EV Empowered+ customer allocation)',
        status: 'SUCCESS',
        ipAddress: '10.24.8.42',
      },
      {
        id: 'LOG-MTR-8088',
        timestamp: '2026-09-30 12:45:30',
        userId: 'TML-PO-VH01',
        userName: 'Vineeth Hari',
        action: 'Custom Parameter Added',
        actionType: 'SCHEMA_EXTEND',
        module: 'Masters Maintenance',
        entity: 'PPL Master > telematics_ota_status',
        masterId: 'ppl_master',
        oldValue: 'None (Schema Extension)',
        newValue:
          'Added custom parameter "Telematics OTA Status" (key: telematics_ota_status, type: select, displayInDealerApp: true, label: "iRA Connected Telematics Status")',
        status: 'SUCCESS',
        ipAddress: '192.168.1.108',
      },
      {
        id: 'LOG-MTR-8087',
        timestamp: '2026-09-30 11:20:18',
        userId: 'TML-PO-VH01',
        userName: 'Vineeth Hari',
        action: 'Master Parameter Row Created',
        actionType: 'CREATE',
        module: 'Masters Maintenance',
        entity: 'Service Type Master (ST-EV-60K)',
        masterId: 'service_type_master',
        oldValue: 'None (New Entry)',
        newValue:
          'Record [ST-EV-60K] created: { code: "ST-EV-60K", name: "60,000 km EV Periodic Comprehensive Service", standardFrtHours: 4.5, bayType: "EV", active: "Y" }',
        status: 'SUCCESS',
        ipAddress: '192.168.1.108',
      },
      {
        id: 'LOG-MTR-8086',
        timestamp: '2026-09-30 10:05:44',
        userId: 'TML-PO-VH01',
        userName: 'Vineeth Hari',
        action: 'Bulk Parameter Records Ingested',
        actionType: 'BULK',
        module: 'Masters Maintenance',
        entity: 'PPL Master (Bulk Upload)',
        masterId: 'ppl_master',
        oldValue: 'Pre-ingestion catalogue size: 12 records',
        newValue:
          'Committed 5 parameter records via JSON Ingestion Pipeline. Ingestion Mode: UPSERT. All records validated against schema constraints.',
        status: 'SUCCESS',
        ipAddress: '192.168.1.108',
      },
      {
        id: 'LOG-MTR-8085',
        timestamp: '2026-09-29 17:30:11',
        userId: 'TML-DLR-ADM01',
        userName: 'K. Venkatesh',
        action: 'Master Parameter Row Updated',
        actionType: 'UPDATE',
        module: 'Masters Maintenance',
        entity: 'Labour Schedule Master (FRT-BRK-04)',
        masterId: 'frt_labour_master',
        oldValue: 'frtHours: 1.2 | skillLevel: "Level 2 Technician"',
        newValue:
          'frtHours: 1.4 | skillLevel: "Level 3 EV Specialist" (Updated for Regenerative High-Voltage Brake Caliper Overhaul)',
        status: 'SUCCESS',
        ipAddress: '10.24.8.42',
      },
      {
        id: 'LOG-MTR-8084',
        timestamp: '2026-09-29 14:15:02',
        userId: 'TML-PO-VH01',
        userName: 'Vineeth Hari',
        action: 'Master Parameter Row Created',
        actionType: 'CREATE',
        module: 'Masters Maintenance',
        entity: 'Bay Management (BAY-07)',
        masterId: 'bay_management_interactive',
        oldValue: 'None (New Entry)',
        newValue:
          'Record [BAY-07] created: { bayName: "High-Voltage EV Fast Diagnostics Bay 07", bayType: "EV", liftAvailability: "4 post lift", status: "Active" }',
        status: 'SUCCESS',
        ipAddress: '192.168.1.108',
      },
    ];
  }, []);

  // Merge real audit logs from AppContext with pre-seeded master parameter logs
  const allMasterLogs = useMemo(() => {
    // Filter AppContext auditLogs for Master Maintenance module
    const contextMasterLogs: EnrichedChangeLogItem[] = auditLogs
      .filter(
        (l) =>
          l.module === 'Masters Maintenance' ||
          l.action.toLowerCase().includes('master') ||
          l.action.toLowerCase().includes('parameter') ||
          l.action.toLowerCase().includes('field') ||
          masterConfigs.some((m) => l.entity.includes(m.name) || l.entity.includes(m.id))
      )
      .map((l) => ({
        id: l.id,
        timestamp: l.timestamp,
        userId: l.userId,
        userName: l.userName,
        action: l.action,
        actionType: categorizeAction(l.action),
        module: l.module,
        entity: l.entity,
        masterId: masterConfigs.find((m) => l.entity.includes(m.name) || l.entity.includes(m.id))?.id,
        oldValue: l.oldValue,
        newValue: l.newValue,
        status: l.status,
        ipAddress: l.ipAddress,
      }));

    // Deduplicate IDs
    const seenIds = new Set<string>();
    const combined: EnrichedChangeLogItem[] = [];

    // Prioritize newest context logs
    contextMasterLogs.forEach((l) => {
      if (!seenIds.has(l.id)) {
        seenIds.add(l.id);
        combined.push(l);
      }
    });

    defaultMasterLogs.forEach((l) => {
      if (!seenIds.has(l.id)) {
        seenIds.add(l.id);
        combined.push(l);
      }
    });

    return combined.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }, [auditLogs, defaultMasterLogs, masterConfigs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return allMasterLogs.filter((log) => {
      // 1. Entity / Master filter
      if (selectedEntityFilter !== 'ALL') {
        const matchesSelected =
          log.masterId === selectedEntityFilter ||
          log.entity.toLowerCase().includes(selectedEntityFilter.toLowerCase());
        if (!matchesSelected) return false;
      }

      // 2. Action Type filter
      if (selectedActionType !== 'ALL' && log.actionType !== selectedActionType) {
        return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch =
          log.action.toLowerCase().includes(q) ||
          log.entity.toLowerCase().includes(q) ||
          log.userId.toLowerCase().includes(q) ||
          log.userName.toLowerCase().includes(q) ||
          log.oldValue.toLowerCase().includes(q) ||
          log.newValue.toLowerCase().includes(q) ||
          log.id.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // 4. Time Range Filter
      if (timeRange !== 'ALL') {
        const logDate = parseDateTime(log.timestamp);
        const now = new Date();
        if (timeRange === 'TODAY') {
          if (logDate.toDateString() !== now.toDateString()) return false;
        } else if (timeRange === '7DAYS') {
          const diffDays = (now.getTime() - logDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7) return false;
        } else if (timeRange === '30DAYS') {
          const diffDays = (now.getTime() - logDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 30) return false;
        }
      }

      return true;
    });
  }, [allMasterLogs, selectedEntityFilter, selectedActionType, searchQuery, timeRange]);

  // Aggregate KPI Stats
  const stats = useMemo(() => {
    const total = allMasterLogs.length;
    const additions = allMasterLogs.filter(
      (l) => l.actionType === 'CREATE' || l.actionType === 'SCHEMA_EXTEND'
    ).length;
    const modifications = allMasterLogs.filter((l) => l.actionType === 'UPDATE').length;
    const schemaExtensions = allMasterLogs.filter(
      (l) => l.actionType === 'SCHEMA_EXTEND' || l.actionType === 'MAPPING'
    ).length;
    const uniqueUsers = new Set(allMasterLogs.map((l) => l.userId)).size;

    return { total, additions, modifications, schemaExtensions, uniqueUsers };
  }, [allMasterLogs]);

  // Action badge styling
  const renderActionBadge = (type: EnrichedChangeLogItem['actionType'], label: string) => {
    switch (type) {
      case 'CREATE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            <span>Addition</span>
          </span>
        );
      case 'UPDATE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            <span>Modification</span>
          </span>
        );
      case 'SCHEMA_EXTEND':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200 flex items-center gap-1 w-fit">
            <Sparkles className="h-3 w-3 text-purple-600" />
            <span>Schema Extension</span>
          </span>
        );
      case 'MAPPING':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 flex items-center gap-1 w-fit">
            <Workflow className="h-3 w-3 text-indigo-600" />
            <span>Dealer Mapping</span>
          </span>
        );
      case 'BULK':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1 w-fit">
            <Layers className="h-3 w-3 text-amber-600" />
            <span>Bulk Ingestion</span>
          </span>
        );
      case 'DELETE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
            <span>Deletion</span>
          </span>
        );
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Change ID',
      'Timestamp',
      'User ID',
      'Author Name',
      'Action Description',
      'Classification',
      'Entity / Target Master',
      'Previous Value (Before)',
      'New Value (After)',
      'IP Address',
      'Status',
    ];

    const rows = filteredLogs.map((l) => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.userId}"`,
      `"${l.userName.replace(/"/g, '""')}"`,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.actionType}"`,
      `"${l.entity.replace(/"/g, '""')}"`,
      `"${l.oldValue.replace(/"/g, '""')}"`,
      `"${l.newValue.replace(/"/g, '""')}"`,
      `"${l.ipAddress}"`,
      `"${l.status}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TML_Masters_Change_Log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${filteredLogs.length} change log entries to CSV`, 'success');
  };

  // Export to JSON
  const handleExportJSON = () => {
    const report = {
      exportMetadata: {
        system: 'Tata Motors Service Transformation CRM (sWorkshop)',
        module: 'Masters Maintenance Governance Change Log',
        exportedAt: new Date().toISOString(),
        exportedBy: `${currentUser.name} (${currentUser.userId})`,
        totalEntries: filteredLogs.length,
      },
      changeLogs: filteredLogs,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TML_Masters_Change_Log_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredLogs.length} change log records to JSON`, 'success');
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs">
      {/* 1. TOP ARCHITECTURAL NO-CODE EXPLANATION CALLOUT */}
      <div className="rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-900 via-[#002B49] to-indigo-950 text-white p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-200">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm tracking-tight text-white">
                  Metadata-Driven Architecture: Zero-Code Custom Fields
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-400/30">
                  No Code Deployments Needed
                </span>
              </div>
              <p className="text-xs text-blue-200/90 mt-0.5">
                Every master parameter addition, value mapping, and validation rule is dynamically evaluated at runtime.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-white/20 transition-all shadow-2xs"
              title="Download Change Log CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-300" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-white/20 transition-all shadow-2xs"
              title="Download Change Log JSON"
            >
              <FileCode className="h-3.5 w-3.5 text-purple-300" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-white/10 text-[11px] text-blue-100">
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 space-y-1">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Workflow className="h-3.5 w-3.5 text-blue-300" />
              <span>1. How it appears in Dealer App:</span>
            </span>
            <p className="text-blue-200/80 leading-relaxed">
              When toggled with <strong>&quot;Expose to Dealer App&quot;</strong>, the dynamic renderer in <code className="font-mono bg-black/30 px-1 py-0.2 rounded text-[10px]">JourneyDetailPage</code> automatically inspects active master schemas and renders the parameter cards live without any hardcoding.
            </p>
          </div>

          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 space-y-1">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5 text-purple-300" />
              <span>2. Where the logic is written:</span>
            </span>
            <p className="text-blue-200/80 leading-relaxed">
              Business rules and friendly display translations are stored as <strong>Declarative Value Mapping Dictionaries</strong> directly in the UI. No code files are modified.
            </p>
          </div>

          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 space-y-1">
            <span className="font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              <span>3. Immutable Audit Tracking:</span>
            </span>
            <p className="text-blue-200/80 leading-relaxed">
              Every parameter addition, value diff, and bulk operation is automatically captured in this <strong>Change Log</strong> with User ID, Timestamp, and Before vs. After values.
            </p>
          </div>
        </div>
      </div>

      {/* 2. 5 SUMMARY KPI METRICS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
            Total Changes Logged
          </span>
          <span className="text-2xl font-extrabold text-slate-800">{stats.total}</span>
          <span className="block text-[10px] text-slate-400 mt-0.5">Across all masters</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-2xs">
          <span className="text-emerald-700 block text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Parameter Additions
          </span>
          <span className="text-2xl font-extrabold text-emerald-800">{stats.additions}</span>
          <span className="block text-[10px] text-emerald-600 mt-0.5">New parameters &amp; rows</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-blue-200/80 bg-blue-50/20 shadow-2xs">
          <span className="text-blue-700 block text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
            <RotateCcw className="h-3 w-3" /> Modifications / Diffs
          </span>
          <span className="text-2xl font-extrabold text-blue-900">{stats.modifications}</span>
          <span className="block text-[10px] text-blue-600 mt-0.5">Values updated</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-purple-200/80 bg-purple-50/20 shadow-2xs">
          <span className="text-purple-700 block text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Schema Extensions
          </span>
          <span className="text-2xl font-extrabold text-purple-900">{stats.schemaExtensions}</span>
          <span className="block text-[10px] text-purple-600 mt-0.5">Custom fields &amp; mappings</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
            <User className="h-3 w-3" /> Admin Authors
          </span>
          <span className="text-2xl font-extrabold text-slate-800">{stats.uniqueUsers}</span>
          <span className="block text-[10px] text-slate-400 mt-0.5">Authorized users</span>
        </div>
      </div>

      {/* 3. ADVANCED SEARCH & FILTER STRIP */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-blue-600" />
            <input
              type="text"
              placeholder="Search change logs by User ID, Name, Master, Parameter Key, or Value change..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-20 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-hidden focus:border-blue-500 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-200 rounded cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Master Entity Dropdown Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold text-[11px] hidden sm:inline">Entity:</span>
            <select
              value={selectedEntityFilter}
              onChange={(e) => setSelectedEntityFilter(e.target.value)}
              className="px-2.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50/60 focus:bg-white focus:outline-hidden"
            >
              <option value="ALL">All Masters ({allMasterLogs.length})</option>
              {masterConfigs.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Action Classification Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold text-[11px] hidden sm:inline">Action:</span>
            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value)}
              className="px-2.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50/60 focus:bg-white focus:outline-hidden"
            >
              <option value="ALL">All Action Types</option>
              <option value="CREATE">Additions (New Rows / Parameters)</option>
              <option value="UPDATE">Modifications (Value Updates)</option>
              <option value="SCHEMA_EXTEND">Schema Extensions (Custom Fields)</option>
              <option value="MAPPING">Dealer Value Mappings</option>
              <option value="BULK">Bulk Upload / Edits</option>
              <option value="DELETE">Deletions</option>
            </select>
          </div>

          {/* Timeframe */}
          <div className="flex rounded-xl border border-slate-200 p-0.5 bg-slate-50 text-[11px]">
            <button
              onClick={() => setTimeRange('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                timeRange === 'ALL' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeRange('TODAY')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                timeRange === 'TODAY' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange('7DAYS')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                timeRange === '7DAYS' ? 'bg-blue-900 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              7 Days
            </button>
          </div>
        </div>

        {/* Live Filter Indicator */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Showing <strong>{filteredLogs.length}</strong> of {allMasterLogs.length} parameter change records
          </span>
          {(searchQuery || selectedEntityFilter !== 'ALL' || selectedActionType !== 'ALL' || timeRange !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedEntityFilter('ALL');
                setSelectedActionType('ALL');
                setTimeRange('ALL');
              }}
              className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. CHANGE LOG DATA TABLE WITH PREVIOUS VS NEW VALUE DIFFS */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#002B49] text-white uppercase text-[10px] tracking-wider font-semibold">
            <tr>
              <th className="py-3 px-4 w-40">Timestamp</th>
              <th className="py-3 px-4 w-48">Admin User (User ID)</th>
              <th className="py-3 px-4 w-52">Target Entity / Parameter</th>
              <th className="py-3 px-4 w-36">Change Type</th>
              <th className="py-3 px-4">Previous Value (Before) vs. New Value (After)</th>
              <th className="py-3 px-4 w-28 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 space-y-2">
                  <History className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="font-semibold text-slate-600">No change log records matched your query.</p>
                  <p className="text-[11px]">Try adjusting your search criteria or resetting filters.</p>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isExpanded ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-slate-700 font-medium">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{log.timestamp}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                          ID: {log.id}
                        </span>
                      </td>

                      {/* User Info */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>{log.userName}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-blue-100 text-blue-900">
                            {log.userId}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {log.ipAddress}
                          </span>
                        </div>
                      </td>

                      {/* Entity / Master */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 leading-snug">{log.entity}</div>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          Module: {log.module}
                        </span>
                      </td>

                      {/* Change Type Badge */}
                      <td className="py-3 px-4">
                        {renderActionBadge(log.actionType, log.action)}
                      </td>

                      {/* Previous vs New Values Diff */}
                      <td className="py-3 px-4">
                        <div className="space-y-1.5 max-w-xl">
                          {/* Previous Value */}
                          <div className="flex items-start gap-2 bg-rose-50/70 border border-rose-200/80 rounded-lg p-2 text-[11px]">
                            <span className="px-1.5 py-0.2 rounded bg-rose-200 text-rose-900 font-bold text-[9px] uppercase tracking-wider shrink-0 mt-0.5">
                              Previous
                            </span>
                            <span className="font-mono text-rose-950 break-all leading-relaxed">
                              {log.oldValue || '— None —'}
                            </span>
                          </div>

                          {/* New Value */}
                          <div className="flex items-start gap-2 bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-2 text-[11px]">
                            <span className="px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-900 font-bold text-[9px] uppercase tracking-wider shrink-0 mt-0.5">
                              New / Current
                            </span>
                            <span className="font-mono text-emerald-950 break-all font-semibold leading-relaxed">
                              {log.newValue}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Action: Expand & Jump */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                            title={isExpanded ? 'Collapse Diff' : 'View Full Details'}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {log.masterId && onLaunchMaster && (
                            <button
                              type="button"
                              onClick={() => onLaunchMaster(log.masterId!)}
                              className="p-1.5 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800 transition-colors cursor-pointer"
                              title="Jump to Master Workspace"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Delta Diff Details Drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={6} className="p-4 border-t border-b border-slate-200">
                          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                <span className="font-bold text-slate-800">
                                  Complete Audit Record: {log.id}
                                </span>
                                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  Status: {log.status}
                                </span>
                              </div>
                              <span className="font-mono text-slate-400 text-[10px]">
                                Logged via AuditTrailMiddleware
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                  State Prior to Change (Previous):
                                </span>
                                <pre className="p-3 rounded-lg bg-rose-50/40 border border-rose-200 font-mono text-[11px] text-rose-950 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                                  {log.oldValue}
                                </pre>
                              </div>

                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                  Committed State (New Value Delta):
                                </span>
                                <pre className="p-3 rounded-lg bg-emerald-50/40 border border-emerald-200 font-mono text-[11px] text-emerald-950 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                                  {log.newValue}
                                </pre>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500">
                              <span>
                                Author: <strong>{log.userName}</strong> ({log.userId}) · IP: {log.ipAddress} · Target: {log.entity}
                              </span>
                              {log.masterId && onLaunchMaster && (
                                <button
                                  type="button"
                                  onClick={() => onLaunchMaster(log.masterId!)}
                                  className="text-blue-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Configure {log.entity.split('>')[0].trim()}</span>
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
