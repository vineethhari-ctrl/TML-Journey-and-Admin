import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  MASTER_COLLECTIONS,
  LOGICAL_MODULES,
  WORKSHOP_MODULES,
  LogicalModuleGroup,
  MasterConfig,
  ModuleCode,
} from '../data/masterCatalogue';
import { MasterTableEditor } from '../components/administration/MasterTableEditor';
import { MasterDataImportModal } from '../components/administration/MasterDataImportModal';
import { MasterChangeLogView } from '../components/administration/MasterChangeLogView';
import { RulesEngineStudio } from '../components/administration/RulesEngineStudio';
import { DealerAppPreviewSimulator } from '../components/administration/DealerAppPreviewSimulator';
import { CreateMasterModal } from '../components/administration/CreateMasterModal';
import { MasterWorkbookImportModal } from '../components/administration/MasterWorkbookImportModal';
import { SmartExcelImportModal } from '../components/administration/SmartExcelImportModal';
import { BayManagementConsole } from '../components/administration/BayManagementConsole';
import { EqcRuleTester } from '../components/administration/EqcRuleTester';
import { BodyshopCapturePreview } from '../components/administration/BodyshopCapturePreview';
import { ThdRuleTester } from '../components/administration/ThdRuleTester';
import { HolidayCalendarConsole } from '../components/administration/HolidayCalendarConsole';
import { BodyshopMaster } from '../components/administration/BodyshopMaster';
import { ServiceTransformationPortal } from '../components/common/ServiceTransformationPortal';
import { calendarKey, createSeedCalendars } from '../data/holidayData';
import { DEALER_DIVISIONS } from '../data/bayData';
import { DivisionCalendar, effectiveHours, toIsoDate } from '../utils/holidayCalendar';
import { useBays } from '../context/BayContext';
import { Actor, Bay } from '../utils/bayGovernance';
import {
  Building2,
  Wrench,
  Calendar,
  Clock,
  History,
  Smartphone,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Layers,
  MapPin,
  Sparkles,
  Edit,
  Trash2,
  RefreshCw,
  Bell,
  Upload,
  Send,
  Sliders,
  Check,
  X,
  User,
  Database,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Package,
  ClipboardCheck,
  Flame,
  HelpCircle,
  CheckSquare,
  Award,
  Paintbrush,
  Zap,
  Car,
  FileText,
  Filter,
  ArrowRight,
  Grid,
  Shield,
  Briefcase,
  ListFilter,
  ChevronLeft,
  LayoutGrid,
  ChevronDown,
  Table2,
} from 'lucide-react';
import { masterExportUtil } from '../utils/masterExportUtil';
import { mergeImportedRecords } from '../utils/recordMerge';

// Icon helper function for rendering module icons
const getGroupIcon = (iconName: string, className = 'h-4 w-4') => {
  switch (iconName) {
    case 'Calendar':
      return <Calendar className={className} />;
    case 'Car':
      return <Car className={className} />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} />;
    case 'FileText':
      return <FileText className={className} />;
    case 'Wrench':
      return <Wrench className={className} />;
    case 'Package':
      return <Package className={className} />;
    case 'HelpCircle':
      return <HelpCircle className={className} />;
    case 'CheckSquare':
      return <CheckSquare className={className} />;
    case 'Award':
      return <Award className={className} />;
    case 'Paintbrush':
      return <Paintbrush className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    case 'Building2':
      return <Building2 className={className} />;
    case 'ClipboardCheck':
      return <ClipboardCheck className={className} />;
    case 'Flame':
      return <Flame className={className} />;
    default:
      return <Database className={className} />;
  }
};

interface ToolbarMenuItem {
  label: string;
  hint: string;
  icon: React.ElementType;
  onClick: () => void;
}

/** A toolbar button that opens a short list of related actions. */
const ToolbarMenu: React.FC<{ label: string; icon: React.ElementType; className: string; items: ToolbarMenuItem[] }> = ({
  label,
  icon: Icon,
  className,
  items,
}) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white text-xs font-bold border cursor-pointer shadow-xs transition-all ${className}`}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-80" />
      </button>
      {open && (
        <div role="menu" aria-label={label} className="absolute right-0 z-40 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-1 shadow-xl text-slate-800">
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-slate-50 cursor-pointer"
            >
              <item.icon className="h-4 w-4 mt-0.5 text-slate-500 shrink-0" />
              <span>
                <span className="block text-xs font-bold">{item.label}</span>
                <span className="block text-[11px] text-slate-500">{item.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const MastersMaintenancePage: React.FC = () => {
  const {
    activeRoleId,
    currentRoute,
    navigate,
    showToast,
    currentUser,
    logAudit,
    masterConfigs,
    updateMasterConfig,
    resetMasterConfigs,
  } = useApp();

  // Dual Admin Role Context: [Dealer Admin] vs [TML Admin] - default to TML Admin to enable full enterprise schema customization
  // A platform Dealer Admin always works in the Dealer Admin context; others default to TML Admin
  const [adminRole, setAdminRole] = useState<'Dealer Admin' | 'TML Admin'>(activeRoleId === 'dealerAdmin' ? 'Dealer Admin' : 'TML Admin');
  useEffect(() => {
    if (activeRoleId === 'dealerAdmin') setAdminRole('Dealer Admin');
  }, [activeRoleId]);

  // Primary Navigation Tab: 'catalogues' (Parameter master tables) vs 'changelog' (Change Log) vs 'rules_engine' (Rules Engine Studio) vs 'dealer_preview' (Dealer App Preview Simulator)
  const [activeMainTab, setActiveMainTab] = useState<'catalogues' | 'changelog' | 'rules_engine' | 'dealer_preview'>('catalogues');

  // Alignment View Mode: 'by_module' (Project's 12 Specific Modules) vs 'by_domain' (6 Enterprise Groups)
  const [alignmentMode, setAlignmentMode] = useState<'by_module' | 'by_domain'>('by_module');

  // Active Logical Module Tab (Default: 'Vehicle Data' as requested by user)
  const [activeLogicalGroup, setActiveLogicalGroup] = useState<LogicalModuleGroup>('Vehicle Data');

  // Active Project Workshop Module (Default: 'appointment')
  const [activeModuleCode, setActiveModuleCode] = useState<ModuleCode>('appointment');

  // Presentation style for the 12 modules: 'portal' (Official 3x4 Transformation Cards) vs 'compact' (Horizontal tab pills)
  const [moduleDisplayStyle, setModuleDisplayStyle] = useState<'portal' | 'compact'>('portal');

  // Display Layout: 'workspace' (Tabbed editor workspace) by default so MasterTableEditor is immediately visible
  const [activeLayout, setActiveLayout] = useState<'grouped_cards' | 'workspace'>('workspace');

  // Currently Selected Master (for editing / detailed interactive view)
  const [selectedMasterId, setSelectedMasterId] = useState<string>('time_slot_quotas_master');

  // Universal Bulk Upload Modal state for any master catalogue
  const [bulkUploadMaster, setBulkUploadMaster] = useState<MasterConfig | null>(null);

  // On-the-fly master creation (form) and BA workbook import
  const [isCreateMasterOpen, setIsCreateMasterOpen] = useState(false);
  const [isWorkbookImportOpen, setIsWorkbookImportOpen] = useState(false);
  const [isSmartImportOpen, setIsSmartImportOpen] = useState(false);

  const openEqc = () => {
    setActiveMainTab('catalogues');
    setActiveLogicalGroup('Electronic Quality Check');
    setActiveModuleCode('eqc');
    setSelectedMasterId('eqc_gc_mandate');
    setActiveLayout('workspace');
    setSearchQuery('');
    setOwnerFilter('ALL');
  };

  const openBodyshop = () => {
    setActiveMainTab('catalogues');
    setActiveLogicalGroup('Bodyshop');
    setActiveModuleCode('bodyshop');
    setSelectedMasterId('bs_inventory_sections');
    setActiveLayout('workspace');
    setSearchQuery('');
    setOwnerFilter('ALL');
  };

  // Sidebar "EQC Masters" / "Bodyshop Master" while the URL is already ?open=...
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'eqc') openEqc();
      if (detail === 'bodyshop') openBodyshop();
    };
    window.addEventListener('tml:open-masters', onOpen);
    return () => window.removeEventListener('tml:open-masters', onOpen);
  }, []);

  // Deep links from the BA guide: #/admin/masters?open=create | ?open=import | ?open=bays | ?open=eqc | ?open=bodyshop
  useEffect(() => {
    const open = new URLSearchParams(currentRoute.split('?')[1] || '').get('open');
    if (open === 'create') setIsCreateMasterOpen(true);
    if (open === 'bays') {
      setActiveMainTab('catalogues');
      setActiveLogicalGroup('Dealer Network');
      setActiveModuleCode('jc_tracking');
      setSelectedMasterId('bay_management_interactive');
      setActiveLayout('workspace');
    }
    if (open === 'bodyshop') openBodyshop();
    if (open === 'eqc') openEqc();
    if (open === 'smart-import') {
      if (activeRoleId === 'dealerAdmin') {
        showToast('Importing BA Excel files is a TML Admin task', 'error');
      } else {
        setAdminRole('TML Admin');
        setIsSmartImportOpen(true);
      }
    }
    if (open === 'import') {
      if (activeRoleId === 'dealerAdmin') {
        showToast('Importing BA master workbooks is a TML Admin task', 'error');
      } else {
        setAdminRole('TML Admin');
        setIsWorkbookImportOpen(true);
      }
    }
  }, [currentRoute]);

  /** Point both views at a master; masters outside the 12 app modules are shown by domain. */
  const focusMasterScope = (m: MasterConfig) => {
    setActiveLogicalGroup(m.logicalGroup);
    if (WORKSHOP_MODULES.some((mod) => mod.code === m.moduleCode)) setActiveModuleCode(m.moduleCode);
    else setAlignmentMode('by_domain');
  };

  const openMasterInWorkspace = (m: MasterConfig) => {
    setActiveMainTab('catalogues');
    focusMasterScope(m);
    setSelectedMasterId(m.id);
    setActiveLayout('workspace');
    setSearchQuery('');
    setOwnerFilter('ALL');
  };

  // Search & Governance Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<'ALL' | 'TML_ADMIN' | 'DEALER_ADMIN'>('ALL');

  // ---------------------------------------------------------------------------
  // BAY MANAGEMENT STATE (Dealer Network & Facilities)
  // ---------------------------------------------------------------------------
  const [isBayImportModalOpen, setIsBayImportModalOpen] = useState(false);
  const bayStore = useBays();
  const bays = bayStore.bays;
  const bayActor: Actor =
    adminRole === 'TML Admin'
      ? { name: currentUser.name, role: 'TML_ADMIN', email: currentUser.email }
      : { name: activeRoleId === 'dealerAdmin' ? currentUser.name : 'K. Venkatesh', role: 'DEALER_ADMIN' };

  const bayMasterConfig: MasterConfig = useMemo(
    () => ({
      id: 'bay_management_interactive',
      name: 'Bay Management Master & Lift Matrix',
      owner: 'DEALER_ADMIN',
      category: 'Bay Setup',
      logicalGroup: 'Dealer Network',
      moduleCode: 'jc_tracking',
      moduleName: 'JC Tracking & Bay Dispatch',
      description: 'Workshop floor service bay operational and capacity definitions.',
      fields: [
        { key: 'dealerCode', label: 'Dealer Code', type: 'select', options: ['DLR1001', 'DLR1002', 'DLR1003', 'DLR1004', 'DLR1005'], mandatory: true },
        { key: 'division', label: 'Division', type: 'text', mandatory: true },
        { key: 'bu', label: 'BU', type: 'select', options: ['PV', 'EV', 'CV'], mandatory: true },
        { key: 'bayName', label: 'Bay Name', type: 'text', mandatory: true },
        { key: 'bayType', label: 'Bay Type', type: 'select', options: ['Mechanical', 'Electrical', 'EV', 'Fleet', 'Speedo', 'AC', 'BodyShop'], mandatory: true },
        { key: 'floor', label: 'Floor', type: 'select', options: ['Ground', 'Floor 1', 'Floor 2', 'Basement'], mandatory: true },
        { key: 'liftAvailability', label: 'Lift Availability', type: 'select', options: ['No Lift', '2 post lift', '4 post lift'], mandatory: true },
        { key: 'techSupervisor', label: 'Tech Supervisor', type: 'text' },
        { key: 'tech1', label: 'Technician 1', type: 'text' },
        { key: 'tech2', label: 'Technician 2', type: 'text' },
      ],
      records: bays,
    }),
    [bays]
  );

  // Bulk-uploaded bays follow the same allocation rules as bays added one by one
  const handleBayImportComplete = (importedRows: Array<Record<string, any>>) => {
    const result = bayStore.importBays(
      importedRows.map((r) => {
        const dealer = dealersList.find((d) => d.code === r.dealerCode) || dealersList[0];
        return {
          dealerCode: dealer.code,
          dealerName: dealer.name,
          region: dealer.zone as Bay['region'],
          division: r.division,
          bu: r.bu,
          bayType: r.bayType,
          bayName: r.bayName,
          floor: r.floor,
          liftAvailability: r.liftAvailability,
          techSupervisor: r.techSupervisor,
          tech1: r.tech1,
          tech2: r.tech2,
        };
      }),
      bayActor
    );
    showToast(
      `Bays: ${result.added} added, ${result.pending} sent for TML approval${result.errors.length ? `, ${result.errors.length} rejected` : ''}`,
      result.errors.length ? 'error' : 'success'
    );
  };

  // ---------------------------------------------------------------------------
  // HOLIDAY CALENDAR STATE (Dealer Network & Facilities)
  // ---------------------------------------------------------------------------
  const HOLIDAY_STORAGE_KEY = 'tml_holiday_calendar_v1';
  const [calendars, setCalendars] = useState<Record<string, DivisionCalendar>>(() => {
    const seed = createSeedCalendars();
    try {
      const saved = JSON.parse(localStorage.getItem(HOLIDAY_STORAGE_KEY) || 'null');
      return saved && typeof saved === 'object' ? { ...seed, ...saved } : seed;
    } catch {
      return seed;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(HOLIDAY_STORAGE_KEY, JSON.stringify(calendars));
    } catch {
      // storage unavailable — keep in memory
    }
  }, [calendars]);

  /** Flat list of every date override, for CSV / Excel exports. */
  const holidayRows = Object.entries(calendars).flatMap(([key, cal]) => {
    const [dealerCode, division] = key.split('|');
    return Object.values(cal.dates)
      .sort((x, y) => x.date.localeCompare(y.date))
      .map((d) => ({
        dealerCode,
        division,
        date: d.date,
        name: d.name,
        isHoliday: d.isHoliday ? 'Yes' : 'No',
        hours: effectiveHours(d.date, cal).label,
        remark: d.remark,
      }));
  });

  // ---------------------------------------------------------------------------
  // DEALERS REGISTRY STATE (Dealer Network & Facilities)
  // ---------------------------------------------------------------------------
  const [dealersList] = useState([
    { code: 'DLR1001', name: 'Sample Motors Hyderabad', city: 'Hyderabad', zone: 'South', type: '3S (Sales, Service, Spares)', bays: 12, head: 'R. K. Sharma', phone: '+91 98490 12345', status: 'ACTIVE' },
    { code: 'DLR1002', name: 'Rudra Motors South', city: 'Bangalore', zone: 'South', type: '3S (Sales, Service, Spares)', bays: 18, head: 'M. Anand', phone: '+91 98450 67890', status: 'ACTIVE' },
    { code: 'DLR1003', name: 'Concorde Motors Mumbai', city: 'Mumbai', zone: 'West', type: '3S (Sales, Service, Spares)', bays: 24, head: 'Sunil Deshmukh', phone: '+91 98200 45678', status: 'ACTIVE' },
    { code: 'DLR1004', name: 'Lexicon Motors Delhi', city: 'New Delhi', zone: 'North', type: '3S (Sales, Service, Spares)', bays: 20, head: 'Jaspreet Singh', phone: '+91 98110 34567', status: 'ACTIVE' },
    { code: 'DLR1005', name: 'Austin Motors Kolkata', city: 'Kolkata', zone: 'East', type: '2S (Service & Spares)', bays: 14, head: 'Debasish Roy', phone: '+91 98300 89012', status: 'ACTIVE' },
  ]);

  // ---------------------------------------------------------------------------
  // TIME SLOTS STATE (Dealer Network & Facilities)
  // ---------------------------------------------------------------------------
  const [timeSlots] = useState([
    { slot: '09:00 AM - 10:00 AM', cap: 12, booked: 12, buffer: 3, bays: 8, status: 'FULLY BOOKED' },
    { slot: '10:00 AM - 11:00 AM', cap: 14, booked: 13, buffer: 4, bays: 9, status: 'HIGH DEMAND' },
    { slot: '11:00 AM - 12:00 PM', cap: 12, booked: 9, buffer: 3, bays: 8, status: 'AVAILABLE' },
    { slot: '12:00 PM - 01:00 PM', cap: 10, booked: 6, buffer: 2, bays: 7, status: 'AVAILABLE' },
    { slot: '02:00 PM - 03:00 PM', cap: 10, booked: 8, buffer: 2, bays: 7, status: 'AVAILABLE' },
    { slot: '03:00 PM - 04:00 PM', cap: 8, booked: 5, buffer: 2, bays: 6, status: 'AVAILABLE' },
    { slot: '04:00 PM - 05:00 PM', cap: 8, booked: 4, buffer: 2, bays: 6, status: 'AVAILABLE' },
    { slot: '05:00 PM - 06:30 PM', cap: 6, booked: 5, buffer: 2, bays: 5, status: 'HIGH DEMAND' },
  ]);

  // ---------------------------------------------------------------------------
  // SCOPE DERIVATIONS & SELECTIONS (PROJECT MODULES VS LOGICAL GROUPS)
  // ---------------------------------------------------------------------------
  const currentGroupMeta = useMemo(() => {
    return LOGICAL_MODULES.find((g) => g.id === activeLogicalGroup) || LOGICAL_MODULES[0];
  }, [activeLogicalGroup]);

  const currentModuleMeta = useMemo(() => {
    return WORKSHOP_MODULES.find((m) => m.code === activeModuleCode) || WORKSHOP_MODULES[0];
  }, [activeModuleCode]);

  // Scope filter: whether a master belongs to the active view scope
  const isMasterInActiveScope = (m: MasterConfig) => {
    if (alignmentMode === 'by_domain') {
      return m.logicalGroup === activeLogicalGroup;
    }
    // by_module alignment:
    if (m.moduleCode === activeModuleCode) return true;
    if (activeModuleCode === 'customer_journey' && (m.moduleCode === 'dealer_network' || m.logicalGroup === 'Dealer Network')) {
      return true;
    }
    if (activeModuleCode === 'dealer_network' && (m.moduleCode === 'customer_journey' || m.logicalGroup === 'Dealer Network')) {
      return true;
    }
    if (activeModuleCode === 'reception' && (m.moduleCode === 'reception' || m.id === 'driver_transit_roster')) {
      return true;
    }
    if (activeModuleCode === 'receptionist' && (m.moduleCode === 'receptionist' || m.id === 'lounge_reception_checklist')) {
      return true;
    }
    return false;
  };

  // Deep search matching across names, descriptions, field columns, and record values
  const doesMasterMatchSearch = (m: MasterConfig, q: string) => {
    if (!q) return true;
    const lowerQ = q.toLowerCase();
    const matchesName = m.name.toLowerCase().includes(lowerQ);
    const matchesDesc = m.description.toLowerCase().includes(lowerQ);
    const matchesCategory = m.category.toLowerCase().includes(lowerQ);
    const matchesModule = m.moduleName.toLowerCase().includes(lowerQ) || m.moduleCode.toLowerCase().includes(lowerQ);
    const matchesFields = m.fields.some(
      (f) => f.label.toLowerCase().includes(lowerQ) || f.key.toLowerCase().includes(lowerQ)
    );
    const matchesRecords = m.records.some((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(lowerQ))
    );
    return matchesName || matchesDesc || matchesCategory || matchesModule || matchesFields || matchesRecords;
  };

  // Masters filtered by the active scope (Project Module or Logical Group)
  const groupMasters = useMemo(() => {
    return masterConfigs.filter((m) => {
      if (!isMasterInActiveScope(m)) return false;
      if (ownerFilter !== 'ALL' && m.owner !== ownerFilter) return false;
      if (searchQuery.trim() && !doesMasterMatchSearch(m, searchQuery.trim())) return false;
      return true;
    });
  }, [masterConfigs, alignmentMode, activeLogicalGroup, activeModuleCode, ownerFilter, searchQuery]);

  // Real-time matches across all modules for quick discovery
  const crossModuleMatches = useMemo(() => {
    if (!searchQuery.trim()) return {};
    const q = searchQuery.trim();
    const result: Record<string, number> = {};

    if (alignmentMode === 'by_module') {
      WORKSHOP_MODULES.forEach((mod) => {
        const count = masterConfigs.filter((m) => {
          const inMod = m.moduleCode === mod.code || (mod.code === 'dealer_network' && m.logicalGroup === 'Dealer Network');
          if (!inMod) return false;
          if (ownerFilter !== 'ALL' && m.owner !== ownerFilter) return false;
          return doesMasterMatchSearch(m, q);
        }).length;
        if (count > 0) result[mod.code] = count;
      });
    } else {
      LOGICAL_MODULES.forEach((mod) => {
        const count = masterConfigs.filter((m) => {
          if (m.logicalGroup !== mod.id) return false;
          if (ownerFilter !== 'ALL' && m.owner !== ownerFilter) return false;
          return doesMasterMatchSearch(m, q);
        }).length;
        if (count > 0) result[mod.id] = count;
      });
    }

    return result;
  }, [masterConfigs, ownerFilter, searchQuery, alignmentMode]);

  // Current active master config
  const currentMaster = useMemo(() => {
    const found = masterConfigs.find((m) => m.id === selectedMasterId);
    if (found && isMasterInActiveScope(found)) return found;
    // Otherwise fallback to first master in active scope
    const firstInScope = masterConfigs.find((m) => isMasterInActiveScope(m));
    return firstInScope || masterConfigs[0];
  }, [masterConfigs, selectedMasterId, alignmentMode, activeLogicalGroup, activeModuleCode]);

  // Counts for workshop module tabs
  const moduleCounts = useMemo(() => {
    const counts: Record<string, { masters: number; records: number }> = {};
    WORKSHOP_MODULES.forEach((mod) => {
      const mastersInM = masterConfigs.filter((m) => {
        if (m.moduleCode === mod.code) return true;
        if (mod.code === 'customer_journey' && (m.moduleCode === 'dealer_network' || m.logicalGroup === 'Dealer Network')) return true;
        if (mod.code === 'dealer_network' && (m.moduleCode === 'customer_journey' || m.logicalGroup === 'Dealer Network')) return true;
        return false;
      });
      const totalRecs = mastersInM.reduce((acc, m) => acc + m.records.length, 0);
      counts[mod.code] = { masters: mastersInM.length, records: totalRecs };
    });
    return counts;
  }, [masterConfigs]);

  // Counts for logical group tabs
  const groupCounts = useMemo(() => {
    const counts: Record<string, { masters: number; records: number }> = {};
    LOGICAL_MODULES.forEach((g) => {
      const mastersInG = masterConfigs.filter((m) => m.logicalGroup === g.id);
      const totalRecs = mastersInG.reduce((acc, m) => acc + m.records.length, 0);
      counts[g.id] = { masters: mastersInG.length, records: totalRecs };
    });
    return counts;
  }, [masterConfigs]);

  // Masters rendered by a dedicated console keep their rows in local state, so a
  // generic upload into the catalogue copy would never show up on screen.
  const CONSOLE_ONLY_MASTERS = ['holiday_calendar_master', 'time_slot_quotas_master', 'dealer_details_registry', 'bodyshop_facility_master'];
  const openBulkUpload = (m: MasterConfig) => {
    // Same ownership rule the table editor applies to its own upload button
    if (m.owner === 'TML_ADMIN' && adminRole !== 'TML Admin') {
      showToast(`${m.name} is governed by TML Central — switch to TML Admin to upload`, 'error');
      return;
    }
    if (m.id === 'bay_management_interactive') {
      setIsBayImportModalOpen(true);
    } else if (CONSOLE_ONLY_MASTERS.includes(m.id)) {
      showToast(`Bulk upload is not available for ${m.name} — edit it directly in its console`, 'info');
    } else {
      setBulkUploadMaster(m);
    }
  };

  // Action: Launch a master from card into workspace
  const handleLaunchMaster = (masterId: string) => {
    setSelectedMasterId(masterId);
    setActiveLayout('workspace');
    const target = masterConfigs.find((m) => m.id === masterId);
    if (target) {
      setActiveLogicalGroup(target.logicalGroup);
      setActiveModuleCode(target.moduleCode);
    }
  };

  // Action: Export the entire active logical module to CSV for reporting
  const handleDownloadModuleCSV = () => {
    const moduleItems = groupMasters.map((m) => {
      let recordsData = m.records;
      let fieldsData = m.fields.map((f) => ({ key: f.key, label: f.label }));

      if (m.id === 'bay_management_interactive') {
        recordsData = bays;
        fieldsData = [
          { key: 'no', label: 'No' },
          { key: 'region', label: 'Region' },
          { key: 'dealerCode', label: 'Dealer Code' },
          { key: 'dealerName', label: 'Dealer Name' },
          { key: 'division', label: 'Division' },
          { key: 'bu', label: 'BU' },
          { key: 'bayName', label: 'Bay Name' },
          { key: 'bayType', label: 'Bay Type' },
          { key: 'floor', label: 'Floor' },
          { key: 'liftAvailability', label: 'Lift' },
          { key: 'bayStatus', label: 'Status' },
          { key: 'approvalStatus', label: 'Approval Status' },
          { key: 'techSupervisor', label: 'Tech Supervisor' },
          { key: 'tech1', label: 'Tech 1' },
          { key: 'tech2', label: 'Tech 2' },
        ];
      } else if (m.id === 'holiday_calendar_master') {
        recordsData = holidayRows;
        fieldsData = [
          { key: 'dealerCode', label: 'Dealer Code' },
          { key: 'division', label: 'Division' },
          { key: 'date', label: 'Date' },
          { key: 'name', label: 'Holiday Name' },
          { key: 'isHoliday', label: 'Holiday?' },
          { key: 'hours', label: 'Effective Hours' },
          { key: 'remark', label: 'Remark' },
        ];
      } else if (m.id === 'time_slot_quotas_master') {
        recordsData = timeSlots;
        fieldsData = [
          { key: 'slot', label: 'Time Window' },
          { key: 'cap', label: 'Max Capacity' },
          { key: 'booked', label: 'Booked' },
          { key: 'buffer', label: 'Walk-in Reserve' },
          { key: 'bays', label: 'Dedicated Bays' },
          { key: 'status', label: 'Status' },
        ];
      } else if (m.id === 'dealer_details_registry') {
        recordsData = dealersList;
        fieldsData = [
          { key: 'code', label: 'Dealer Code' },
          { key: 'name', label: 'Dealership Name' },
          { key: 'city', label: 'City' },
          { key: 'zone', label: 'Zone' },
          { key: 'type', label: 'Facility Type' },
          { key: 'bays', label: 'Total Bays' },
          { key: 'head', label: 'Works Manager' },
          { key: 'phone', label: 'Contact Phone' },
          { key: 'status', label: 'Status' },
        ];
      }

      return {
        masterName: m.name,
        moduleName: m.moduleName,
        category: m.category,
        owner: m.owner === 'TML_ADMIN' ? 'Tata Motors OEM Central' : 'Dealership Floor Admin',
        description: m.description,
        recordCount: recordsData.length,
        fieldsCount: fieldsData.length,
        records: recordsData,
        fields: fieldsData,
      };
    });

    masterExportUtil.exportModuleToCSV(currentGroupMeta.title, moduleItems, {
      userId: currentUser.userId,
      name: currentUser.name,
    });

    logAudit(
      'Master Data Module Exported to CSV',
      'Masters Maintenance',
      currentGroupMeta.title,
      'Download CSV',
      `Exported ${groupMasters.length} master tables in ${currentGroupMeta.title} module to CSV for reporting`,
      'SUCCESS'
    );
    showToast(`Downloaded consolidated CSV report for ${currentGroupMeta.title}`, 'success');
  };

  // Action: Export the currently active master table to CSV
  const handleDownloadCurrentMasterCSV = () => {
    if (currentMaster.id === 'bay_management_interactive') {
      masterExportUtil.exportToCSV({
        masterName: 'Bay Management Master',
        category: 'Dealer Network',
        currentUser: { userId: currentUser.userId, name: currentUser.name },
        columns: [
          { key: 'no', label: 'No' },
          { key: 'region', label: 'Region' },
          { key: 'dealerCode', label: 'Dealer Code' },
          { key: 'dealerName', label: 'Dealer Name' },
          { key: 'bayName', label: 'Bay Name' },
          { key: 'bayType', label: 'Bay Type' },
          { key: 'floor', label: 'Floor' },
          { key: 'liftAvailability', label: 'Lift' },
          { key: 'bayStatus', label: 'Status' },
          { key: 'approvalStatus', label: 'Approval Status' },
          { key: 'techSupervisor', label: 'Tech Supervisor' },
          { key: 'tech1', label: 'Tech 1' },
          { key: 'tech2', label: 'Tech 2' },
        ],
        data: bays,
      });
    } else if (currentMaster.id === 'bodyshop_facility_master') {
      masterExportUtil.exportToCSV({
        masterName: 'Bodyshop Facility Master',
        category: 'Dealer Network',
        currentUser: { userId: currentUser.userId, name: currentUser.name },
        columns: currentMaster.fields.map((f) => ({ key: f.key, label: f.label })),
        data: currentMaster.records,
      });
    } else if (currentMaster.id === 'holiday_calendar_master') {
      masterExportUtil.exportToCSV({
        masterName: 'Non-Operational Hours & Holiday Calendar',
        category: 'Dealer Network',
        currentUser: { userId: currentUser.userId, name: currentUser.name },
        columns: [
          { key: 'dealerCode', label: 'Dealer Code' },
          { key: 'division', label: 'Division' },
          { key: 'date', label: 'Date' },
          { key: 'name', label: 'Holiday Name' },
          { key: 'isHoliday', label: 'Holiday?' },
          { key: 'hours', label: 'Effective Hours' },
          { key: 'remark', label: 'Remark' },
        ],
        data: holidayRows,
      });
    } else if (currentMaster.id === 'time_slot_quotas_master') {
      masterExportUtil.exportToCSV({
        masterName: 'Time Slot Quotas & Hourly Capacity',
        category: 'Dealer Network',
        currentUser: { userId: currentUser.userId, name: currentUser.name },
        columns: [
          { key: 'slot', label: 'Time Slot' },
          { key: 'cap', label: 'Capacity' },
          { key: 'booked', label: 'Booked' },
          { key: 'buffer', label: 'Walk-in Reserve' },
          { key: 'bays', label: 'Dedicated Bays' },
          { key: 'status', label: 'Slot Status' },
        ],
        data: timeSlots,
      });
    } else if (currentMaster.id === 'dealer_details_registry') {
      masterExportUtil.exportToCSV({
        masterName: 'Authorized Dealership Facility Registry',
        category: 'Dealer Network',
        currentUser: { userId: currentUser.userId, name: currentUser.name },
        columns: [
          { key: 'code', label: 'Dealer Code' },
          { key: 'name', label: 'Dealership Name' },
          { key: 'city', label: 'City' },
          { key: 'zone', label: 'Zone' },
          { key: 'type', label: 'Facility Type' },
          { key: 'bays', label: 'Bays' },
          { key: 'head', label: 'Works Manager' },
          { key: 'phone', label: 'Contact Phone' },
          { key: 'status', label: 'Status' },
        ],
        data: dealersList,
      });
    } else {
      masterExportUtil.exportToCSV({
        masterName: currentMaster.name,
        category: currentMaster.category,
        currentUser: { userId: currentUser.userId, name: currentUser.name },
        columns: currentMaster.fields.map((f) => ({ key: f.key, label: f.label })),
        data: currentMaster.records,
      });
    }

    logAudit(
      'Master Data Exported',
      'Masters Maintenance',
      currentMaster.name,
      'Download CSV',
      `Admin exported ${currentMaster.name} data to CSV for reporting`,
      'SUCCESS'
    );
    showToast(`Downloaded CSV report for ${currentMaster.name}`, 'success');
  };

  const handleExportModuleExcel = () => {
    masterExportUtil.exportToExcel({
      masterName: `${currentGroupMeta.title} Masters`,
      category: currentGroupMeta.title,
      currentUser: { userId: currentUser.userId, name: currentUser.name },
      columns: [
        { key: 'name', label: 'Master Name' },
        { key: 'category', label: 'Sub-Category' },
        { key: 'owner', label: 'Governance Owner' },
        { key: 'description', label: 'Scope' },
        { key: 'records', label: 'Records' },
      ],
      data: groupMasters.map((m) => ({
        name: m.name,
        category: m.category,
        owner: m.owner === 'TML_ADMIN' ? 'OEM Central Standard' : 'Dealership Floor Admin',
        description: m.description,
        records: m.records.length,
      })),
    });
    logAudit(
      'Master Data Exported',
      'Masters Maintenance',
      currentGroupMeta.title,
      'Export to Excel',
      `Exported ${groupMasters.length} master tables in ${currentGroupMeta.title} module to Excel`,
      'SUCCESS'
    );
    showToast(`Exported all masters in ${currentGroupMeta.title} to Excel (.xlsx)`, 'success');
  };

  return (
    <div className="space-y-4 text-slate-800">
      {/* ======================================================================= */}
      {/* 1. TOP HEADER STRIP: TATA MOTORS sWORKSHOP DUAL GOVERNANCE              */}
      {/* ======================================================================= */}
      <div className="bg-[#002B49] text-white px-5 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm border border-[#003B66]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm tracking-wider bg-white/10 px-2.5 py-1 rounded-md border border-white/20">
              TATA MOTORS
            </span>
            <span className="text-xs text-blue-200 italic font-medium">sWorkshop Masters</span>
          </div>
          <div className="h-4 w-px bg-blue-300/30" />
          <div className="flex items-center gap-1.5 bg-blue-900/60 px-2.5 py-1 rounded-lg border border-blue-400/30 text-xs font-bold">
            <Database className="h-3.5 w-3.5 text-blue-300" />
            <span>Enterprise Master Governance</span>
          </div>
        </div>

        {/* Primary View Switcher: Master Catalogues vs Change Log vs Rules Engine Studio */}
        <div className="flex items-center gap-1 bg-blue-950/90 p-1 rounded-xl border border-blue-400/40">
          <button
            onClick={() => setActiveMainTab('catalogues')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMainTab === 'catalogues'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-blue-200 hover:text-white'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>Master Catalogues</span>
          </button>
          <button
            onClick={() => setActiveMainTab('changelog')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMainTab === 'changelog'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-blue-200 hover:text-white'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Change Log</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-900 text-blue-200 font-mono font-bold">
              Audit
            </span>
          </button>
          <button
            onClick={() => setActiveMainTab('rules_engine')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMainTab === 'rules_engine'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-indigo-200 hover:text-white'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Rules Engine Studio</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-900 text-indigo-200 font-mono font-bold">
              No-Code
            </span>
          </button>
          <button
            onClick={() => setActiveMainTab('dealer_preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMainTab === 'dealer_preview'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-blue-200 hover:text-white'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Dealer App Preview</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-900 text-emerald-200 font-mono font-bold">
              Simulator
            </span>
          </button>
        </div>

        {/* Dual Admin Toggle: [Dealer Admin] [TML Admin] */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-950/90 p-1 rounded-lg border border-blue-400/40 flex items-center shadow-inner">
            <button
              onClick={() => {
                setAdminRole('Dealer Admin');
                showToast('Switched context to Dealer Admin view (Workshop Floor)', 'info');
              }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                adminRole === 'Dealer Admin'
                  ? 'bg-white text-blue-950 shadow-xs'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              Dealer Admin
            </button>
            <button
              disabled={activeRoleId === 'dealerAdmin'}
              title={activeRoleId === 'dealerAdmin' ? 'Not available for the Dealer Admin role' : undefined}
              onClick={() => {
                setAdminRole('TML Admin');
                showToast('Switched context to TML Central OEM Governance', 'info');
              }}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                adminRole === 'TML Admin'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              TML Admin
            </button>
          </div>

          {/* Active Facility Context Badge */}
          <div className="flex items-center gap-2 text-xs bg-blue-900/50 px-3 py-1.5 rounded-lg border border-blue-400/30">
            <div className="h-6 w-6 rounded-full bg-blue-700 flex items-center justify-center text-[10px] font-bold">
              <User className="h-3.5 w-3.5 text-blue-100" />
            </div>
            <div>
              <div className="font-semibold text-white leading-tight">
                {adminRole === 'Dealer Admin'
                  ? 'DLR1001 - Sample Motors Hyderabad'
                  : 'Tata Motors Central HQ'}
              </div>
              <div className="text-[10px] text-blue-300">
                {adminRole === 'Dealer Admin' ? 'Dealer Service Admin' : 'Super Administrator'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 2. REAL-TIME MASTER SEARCH & FILTER BAR                                  */}
      {/* ======================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Real-time search input with live match feedback */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-blue-600" />
            <input
              type="text"
              placeholder="Real-Time Search: Type any master name, vehicle model (Nexon, Altroz), part, FRT code, bay, or pause reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-24 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 px-2 py-0.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-slate-200/70 hover:bg-slate-300 rounded-md transition-all cursor-pointer flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Governance Filter Pills */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold hidden sm:inline">Governance:</span>
            <div className="flex rounded-xl border border-slate-200 p-0.5 bg-slate-50 text-xs">
              <button
                onClick={() => setOwnerFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  ownerFilter === 'ALL'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Masters ({masterConfigs.length})
              </button>
              <button
                onClick={() => setOwnerFilter('TML_ADMIN')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  ownerFilter === 'TML_ADMIN'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                OEM Central ({masterConfigs.filter((m) => m.owner === 'TML_ADMIN').length})
              </button>
              <button
                onClick={() => setOwnerFilter('DEALER_ADMIN')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  ownerFilter === 'DEALER_ADMIN'
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dealership Floor ({masterConfigs.filter((m) => m.owner === 'DEALER_ADMIN').length})
              </button>
            </div>
          </div>
        </div>

        {/* Real-time search feedback banner with cross-module jumping */}
        {searchQuery.trim() && (
          <div className="pt-1 flex flex-wrap items-center justify-between text-xs gap-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-900">
                Found {groupMasters.length} master{groupMasters.length !== 1 ? 's' : ''} in{' '}
                <span className="underline">
                  {alignmentMode === 'by_module' ? currentModuleMeta.title : currentGroupMeta.title}
                </span>
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">
                Matching keyword: &quot;<span className="font-semibold text-slate-800">{searchQuery}</span>&quot;
              </span>
            </div>

            {/* Cross-Module Quick Jump Buttons */}
            {Object.keys(crossModuleMatches).length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 text-[11px]">Also matched in:</span>
                {(alignmentMode === 'by_module'
                  ? WORKSHOP_MODULES.filter((mod) => mod.code !== activeModuleCode && crossModuleMatches[mod.code])
                  : LOGICAL_MODULES.filter((mod) => mod.id !== activeLogicalGroup && crossModuleMatches[mod.id])
                ).map((mod: any) => {
                  const key = mod.code || mod.id;
                  const label = mod.title;
                  const matchCount = crossModuleMatches[key];
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (alignmentMode === 'by_module') {
                          setActiveModuleCode(mod.code);
                          const firstMatch = masterConfigs.find(
                            (m) =>
                              (m.moduleCode === mod.code || (mod.code === 'dealer_network' && m.logicalGroup === 'Dealer Network')) &&
                              doesMasterMatchSearch(m, searchQuery)
                          );
                          if (firstMatch) {
                            setSelectedMasterId(firstMatch.id);
                            setActiveLogicalGroup(firstMatch.logicalGroup);
                          }
                        } else {
                          setActiveLogicalGroup(mod.id);
                          const firstMatch = masterConfigs.find(
                            (m) => m.logicalGroup === mod.id && doesMasterMatchSearch(m, searchQuery)
                          );
                          if (firstMatch) {
                            setSelectedMasterId(firstMatch.id);
                            setActiveModuleCode(firstMatch.moduleCode);
                          }
                        }
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-200 transition-all cursor-pointer"
                    >
                      <span>{label}</span>
                      <span className="bg-amber-200 px-1 py-0.2 rounded font-mono text-[9px]">
                        {matchCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================================= */}
      {/* 3. PRIMARY TABBED INTERFACE: PROJECT MODULES & LOGICAL DOMAINS          */}
      {/* ======================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs space-y-3">
        {/* Top Alignment Bar: Switch between 12 Project Modules and 6 Logical Domains */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Masters Alignment:</span>
            <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-semibold" role="tablist">
              <button
                role="tab"
                aria-selected={alignmentMode === 'by_module'}
                onClick={() => {
                  setAlignmentMode('by_module');
                  setActiveMainTab('catalogues');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  alignmentMode === 'by_module' && activeMainTab === 'catalogues'
                    ? 'bg-blue-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid className="h-3.5 w-3.5" />
                <span>12 Project Modules</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${alignmentMode === 'by_module' ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'}`}>
                  12
                </span>
              </button>
              <button
                role="tab"
                aria-selected={alignmentMode === 'by_domain'}
                onClick={() => {
                  setAlignmentMode('by_domain');
                  setActiveMainTab('catalogues');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  alignmentMode === 'by_domain' && activeMainTab === 'catalogues'
                    ? 'bg-blue-900 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>6 Logical Domains</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${alignmentMode === 'by_domain' ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'}`}>
                  6
                </span>
              </button>
            </div>

            {alignmentMode === 'by_module' && (
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-semibold ml-1">
                <button
                  type="button"
                  onClick={() => setModuleDisplayStyle('portal')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    moduleDisplayStyle === 'portal'
                      ? 'bg-white text-blue-900 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Official 3x4 Transformation Portal Layout"
                >
                  <LayoutGrid className="h-3 w-3" />
                  <span>3x4 Portal Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModuleDisplayStyle('compact')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    moduleDisplayStyle === 'compact'
                      ? 'bg-white text-blue-900 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Compact Horizontal Tabs"
                >
                  <Grid className="h-3 w-3" />
                  <span>Compact Tabs</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Total System Masters:</span>
            <span className="font-bold text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded">
              {masterConfigs.length} masters
            </span>
            <span className="text-slate-300">|</span>
            <span className="font-bold text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded">
              {masterConfigs.reduce((acc, m) => acc + m.records.length, 0)} records
            </span>
          </div>
        </div>

        {/* Tab Cards Grid: Official 3x4 Transformation Cards vs Compact vs 6 Logical Domains */}
        {alignmentMode === 'by_module' ? (
          moduleDisplayStyle === 'portal' ? (
            <ServiceTransformationPortal
              modules={WORKSHOP_MODULES}
              activeModuleCode={activeModuleCode}
              moduleCounts={moduleCounts}
              matches={crossModuleMatches}
              searchQuery={searchQuery}
              onSelectModule={(code) => {
                setActiveMainTab('catalogues');
                setActiveModuleCode(code as ModuleCode);
                const firstInMod = masterConfigs.find(
                  (m) =>
                    m.moduleCode === code ||
                    (code === 'customer_journey' && (m.moduleCode === 'dealer_network' || m.logicalGroup === 'Dealer Network'))
                );
                if (firstInMod) {
                  setSelectedMasterId(firstInMod.id);
                  setActiveLogicalGroup(firstInMod.logicalGroup);
                }
              }}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {WORKSHOP_MODULES.map((mod) => {
                const isSelected = activeMainTab === 'catalogues' && activeModuleCode === mod.code;
                const count = moduleCounts[mod.code] || { masters: 0, records: 0 };
                const matchCount = crossModuleMatches[mod.code];
                return (
                  <button
                    key={mod.code}
                    onClick={() => {
                      setActiveMainTab('catalogues');
                      setActiveModuleCode(mod.code);
                      const firstInMod = masterConfigs.find(
                        (m) =>
                          m.moduleCode === mod.code ||
                          (mod.code === 'customer_journey' && (m.moduleCode === 'dealer_network' || m.logicalGroup === 'Dealer Network'))
                      );
                      if (firstInMod) {
                        setSelectedMasterId(firstInMod.id);
                        setActiveLogicalGroup(firstInMod.logicalGroup);
                      }
                    }}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-blue-900 border-blue-950 text-white shadow-sm ring-2 ring-blue-600/30'
                        : 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-white border border-slate-200 text-blue-700 shadow-2xs'
                      }`}
                    >
                      {getGroupIcon(mod.iconName, 'h-4 w-4')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-bold text-xs truncate leading-snug" title={mod.title}>
                          {mod.title}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {searchQuery && matchCount !== undefined && matchCount > 0 && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-amber-400 text-slate-950 shadow-2xs animate-pulse">
                              {matchCount}
                            </span>
                          )}
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                              isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-200/80 text-slate-600'
                            }`}
                          >
                            {count.masters}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`text-[10px] truncate ${
                          isSelected ? 'text-blue-200' : 'text-slate-400'
                        }`}
                      >
                        {mod.categoryTag}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {LOGICAL_MODULES.map((mod) => {
              const isSelected = activeMainTab === 'catalogues' && activeLogicalGroup === mod.id;
              const count = groupCounts[mod.id] || { masters: 0, records: 0 };
              const matchCount = crossModuleMatches[mod.id];
              return (
                <button
                  key={mod.id}
                  onClick={() => {
                    setActiveMainTab('catalogues');
                    setActiveLogicalGroup(mod.id);
                    const firstInMod = masterConfigs.find((m) => m.logicalGroup === mod.id);
                    if (firstInMod) {
                      setSelectedMasterId(firstInMod.id);
                      setActiveModuleCode(firstInMod.moduleCode);
                    }
                  }}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-blue-900 border-blue-950 text-white shadow-sm ring-2 ring-blue-600/30'
                      : 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-white border border-slate-200 text-blue-700 shadow-2xs'
                    }`}
                  >
                    {getGroupIcon(mod.iconName, 'h-4 w-4')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-bold text-xs truncate leading-snug">{mod.title}</span>
                      <div className="flex items-center gap-1">
                        {searchQuery && matchCount !== undefined && matchCount > 0 && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-amber-400 text-slate-950 shadow-2xs animate-pulse">
                            {matchCount} match{matchCount > 1 ? 'es' : ''}
                          </span>
                        )}
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                            isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-200/80 text-slate-600'
                          }`}
                        >
                          {count.masters}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`text-[11px] truncate ${
                        isSelected ? 'text-blue-200' : 'text-slate-400'
                      }`}
                    >
                      {count.records} configured records
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Global Admin Tools Row: Change Log | Rules Engine Studio | Dealer App Preview */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Change Log Button */}
          <button
            onClick={() => setActiveMainTab('changelog')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
              activeMainTab === 'changelog'
                ? 'bg-blue-900 border-blue-950 text-white shadow-xs ring-2 ring-blue-600/30'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
            }`}
          >
            <History className={`h-4 w-4 shrink-0 ${activeMainTab === 'changelog' ? 'text-white' : 'text-blue-600'}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold truncate">Audit Change Log</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${activeMainTab === 'changelog' ? 'bg-blue-800 text-blue-100' : 'bg-blue-100 text-blue-800'}`}>Live</span>
              </div>
              <div className={`text-[10px] truncate ${activeMainTab === 'changelog' ? 'text-blue-200' : 'text-slate-400'}`}>Track modifications &amp; diffs</div>
            </div>
          </button>

          {/* Rules Engine Button */}
          <button
            onClick={() => setActiveMainTab('rules_engine')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
              activeMainTab === 'rules_engine'
                ? 'bg-indigo-900 border-indigo-950 text-white shadow-xs ring-2 ring-indigo-600/30'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
            }`}
          >
            <Zap className={`h-4 w-4 shrink-0 ${activeMainTab === 'rules_engine' ? 'text-white' : 'text-indigo-600'}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold truncate">Rules Engine Studio</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${activeMainTab === 'rules_engine' ? 'bg-indigo-800 text-indigo-100' : 'bg-indigo-100 text-indigo-800'}`}>No-Code</span>
              </div>
              <div className={`text-[10px] truncate ${activeMainTab === 'rules_engine' ? 'text-indigo-200' : 'text-slate-400'}`}>Regex, ranges &amp; visibility</div>
            </div>
          </button>

          {/* Dealer Preview Simulator Button */}
          <button
            onClick={() => setActiveMainTab('dealer_preview')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
              activeMainTab === 'dealer_preview'
                ? 'bg-blue-900 border-blue-950 text-white shadow-xs ring-2 ring-blue-600/30'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
            }`}
          >
            <Smartphone className={`h-4 w-4 shrink-0 ${activeMainTab === 'dealer_preview' ? 'text-white' : 'text-emerald-600'}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold truncate">Dealer App Preview</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${activeMainTab === 'dealer_preview' ? 'bg-blue-800 text-blue-100' : 'bg-emerald-100 text-emerald-800'}`}>Simulator</span>
              </div>
              <div className={`text-[10px] truncate ${activeMainTab === 'dealer_preview' ? 'text-blue-200' : 'text-slate-400'}`}>Test UI &amp; logic live</div>
            </div>
          </button>
        </div>
      </div>

      {activeMainTab === 'dealer_preview' ? (
        <DealerAppPreviewSimulator
          currentMaster={currentMaster}
          onClose={() => setActiveMainTab('catalogues')}
          onOpenMastersMaintenance={() => setActiveMainTab('catalogues')}
        />
      ) : activeMainTab === 'rules_engine' ? (
        <RulesEngineStudio
          onNavigateToPreview={() => setActiveMainTab('dealer_preview')}
        />
      ) : activeMainTab === 'changelog' ? (
        <div className="space-y-4">
          <MasterChangeLogView
            masterConfigs={masterConfigs}
            selectedMasterId={selectedMasterId}
            onLaunchMaster={(mId) => {
              setActiveMainTab('catalogues');
              setSelectedMasterId(mId);
              setActiveLayout('workspace');
              const targetMaster = masterConfigs.find((m) => m.id === mId);
              if (targetMaster) focusMasterScope(targetMaster);
              showToast(`Jumped to master: ${mId}`, 'info');
            }}
          />
        </div>
      ) : (
        <>

      {/* ======================================================================= */}
      {/* 3. MODULE HEADER BANNER & LAYOUT SWITCHER                                */}
      {/* ======================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-4 border border-blue-900/60 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-800/80 border border-blue-400/30 flex items-center justify-center text-blue-200 shadow-inner">
            {getGroupIcon(
              alignmentMode === 'by_module' ? currentModuleMeta.iconName : currentGroupMeta.iconName,
              'h-5 w-5'
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-extrabold tracking-tight text-white">
                {alignmentMode === 'by_module' ? currentModuleMeta.title : currentGroupMeta.title}
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-700/60 text-blue-200 font-mono font-bold border border-blue-500/30">
                {alignmentMode === 'by_module' ? currentModuleMeta.badge : currentGroupMeta.badge}
              </span>
              {alignmentMode === 'by_module' && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-900/80 text-emerald-200 font-semibold border border-emerald-500/30">
                  {currentModuleMeta.categoryTag}
                </span>
              )}
            </div>
            <p className="text-xs text-blue-200/90 mt-0.5">
              {alignmentMode === 'by_module' ? currentModuleMeta.subtitle : currentGroupMeta.shortDesc}
            </p>
          </div>
        </div>

        {/* Layout Switcher & Action Controls — one button per job: create, import, export */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-blue-950/80 p-0.5 rounded-xl border border-blue-400/30 flex items-center text-xs" role="group" aria-label="Layout">
            {(
              [
                ['grouped_cards', LayoutGrid, 'Grouped cards view'],
                ['workspace', Table2, 'Tabbed workspace'],
              ] as const
            ).map(([layout, Icon, label]) => (
              <button
                key={layout}
                aria-label={label}
                title={label}
                aria-pressed={activeLayout === layout}
                onClick={() => setActiveLayout(layout)}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  activeLayout === layout ? 'bg-blue-600 text-white shadow-2xs' : 'text-blue-200 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          {/* On-the-fly master definition: no code change or deployment needed */}
          <button
            onClick={() => setIsCreateMasterOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-blue-950 hover:bg-blue-50 text-xs font-bold border border-blue-200 cursor-pointer shadow-xs transition-all"
            title="Define a brand-new master and its fields"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create New Master</span>
          </button>

          <ToolbarMenu
            label="Import"
            icon={Upload}
            className="bg-violet-700 hover:bg-violet-600 border-violet-300/40"
            items={[
              {
                label: 'Smart Excel Import',
                hint: "BA's own Excel, any layout → new masters (recommended)",
                icon: Sparkles,
                onClick: () => {
                  if (adminRole !== 'TML Admin') return showToast('Switch to TML Admin to import a BA Excel file', 'error');
                  setIsSmartImportOpen(true);
                },
              },
              {
                label: 'Import BA Workbook',
                hint: 'Template workbook → add fields / rows to existing masters',
                icon: FileSpreadsheet,
                onClick: () => {
                  if (adminRole !== 'TML Admin') return showToast('Switch to TML Admin to import a BA master workbook', 'error');
                  setIsWorkbookImportOpen(true);
                },
              },
            ]}
          />

          <ToolbarMenu
            label="Export"
            icon={Download}
            className="bg-emerald-600 hover:bg-emerald-500 border-emerald-400/40"
            items={[
              { label: `This master (CSV)`, hint: currentMaster.name, icon: Download, onClick: handleDownloadCurrentMasterCSV },
              { label: `Whole group (CSV)`, hint: alignmentMode === 'by_module' ? currentModuleMeta.title : currentGroupMeta.title, icon: Download, onClick: handleDownloadModuleCSV },
              { label: `Whole group (Excel)`, hint: alignmentMode === 'by_module' ? currentModuleMeta.title : currentGroupMeta.title, icon: FileSpreadsheet, onClick: handleExportModuleExcel },
            ]}
          />

          <button
            onClick={() => navigate('/admin/masters-guide')}
            aria-label="BA Guide"
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 border border-emerald-300/40 cursor-pointer transition-all"
            title="BA Guide: step-by-step help, templates and practice files"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 4. MODULE SUB-FILTER & SEARCH STRIP                                     */}
      {/* ======================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 p-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-semibold">Governance Filter:</span>
          <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            <button
              onClick={() => setOwnerFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                ownerFilter === 'ALL' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500'
              }`}
            >
              All Masters ({masterConfigs.filter(isMasterInActiveScope).length})
            </button>
            <button
              onClick={() => setOwnerFilter('TML_ADMIN')}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                ownerFilter === 'TML_ADMIN' ? 'bg-blue-900 text-white shadow-xs font-bold' : 'text-slate-500'
              }`}
            >
              OEM Central ({masterConfigs.filter((m) => isMasterInActiveScope(m) && m.owner === 'TML_ADMIN').length})
            </button>
            <button
              onClick={() => setOwnerFilter('DEALER_ADMIN')}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                ownerFilter === 'DEALER_ADMIN' ? 'bg-emerald-800 text-white shadow-xs font-bold' : 'text-slate-500'
              }`}
            >
              Dealership Floor ({masterConfigs.filter((m) => isMasterInActiveScope(m) && m.owner === 'DEALER_ADMIN').length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={`Filter in ${alignmentMode === 'by_module' ? currentModuleMeta.title : currentGroupMeta.title}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-blue-400 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 5. LAYOUT OPTION A: GROUPED CARD LAYOUT                                 */}
      {/* ======================================================================= */}
      {activeLayout === 'grouped_cards' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupMasters.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group hover:border-blue-400"
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        m.owner === 'TML_ADMIN'
                          ? 'bg-blue-100 text-blue-900 border border-blue-200'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                      }`}
                    >
                      {m.owner === 'TML_ADMIN' ? 'TML OEM Central' : 'Dealership Admin'}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {m.records.length} records
                    </span>
                  </div>

                  {/* Title & Sub-category */}
                  <div>
                    <div className="text-[11px] font-semibold text-blue-700 mb-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200 text-[10px]">
                        {m.moduleName}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>{m.category}</span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-900 transition-colors">
                      {m.name}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {m.description}
                  </p>

                  {/* Schema Fields Preview */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Configured Schema ({m.fields.length} Fields):
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {m.fields.slice(0, 4).map((f) => (
                        <span
                          key={f.key}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono"
                        >
                          {f.label}
                        </span>
                      ))}
                      {m.fields.length > 4 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                          +{m.fields.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        masterExportUtil.exportToCSV({
                          masterName: m.name,
                          category: m.category,
                          currentUser: { userId: currentUser.userId, name: currentUser.name },
                          columns: m.fields.map((f) => ({ key: f.key, label: f.label })),
                          data: m.records,
                        });
                        logAudit(
                          'Master Data Exported',
                          'Masters Maintenance',
                          m.name,
                          'Download CSV',
                          `Exported ${m.records.length} records to CSV for reporting`,
                          'SUCCESS'
                        );
                        showToast(`Downloaded CSV report for ${m.name}`, 'success');
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg transition-colors cursor-pointer border border-slate-200"
                      title="Download CSV for reporting"
                    >
                      <Download className="h-3 w-3 text-emerald-600" />
                      <span>CSV</span>
                    </button>

                    <button
                      onClick={() => {
                        masterExportUtil.exportToExcel({
                          masterName: m.name,
                          category: m.category,
                          currentUser: { userId: currentUser.userId, name: currentUser.name },
                          columns: m.fields.map((f) => ({ key: f.key, label: f.label })),
                          data: m.records,
                        });
                        logAudit(
                          'Master Data Exported',
                          'Masters Maintenance',
                          m.name,
                          'Export to Excel',
                          `Exported ${m.records.length} records to Excel spreadsheet`,
                          'SUCCESS'
                        );
                        showToast(`Exported ${m.name} to Excel (.xlsx)`, 'success');
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-800 rounded-lg transition-colors cursor-pointer border border-slate-200"
                      title="Export to Excel (.xlsx)"
                    >
                      <FileSpreadsheet className="h-3 w-3 text-blue-600" />
                      <span>Excel</span>
                    </button>

                    <button
                      onClick={() => openBulkUpload(m)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer border border-blue-200"
                      title="Bulk upload parameter records (JSON / Excel)"
                    >
                      <Upload className="h-3 w-3 text-blue-700" />
                      <span>Bulk Upload</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleLaunchMaster(m.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs cursor-pointer shadow-2xs"
                  >
                    <span>Open &amp; Configure</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {groupMasters.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
              <Database className="h-8 w-8 text-slate-400 mx-auto" />
              <div className="font-bold text-sm text-slate-700">No masters matched your query</div>
              <p className="text-xs text-slate-500">
                Try clearing your search query or switching governance filter pills.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================= */}
      {/* 6. LAYOUT OPTION B: TABBED MASTER WORKSPACE                              */}
      {/* ======================================================================= */}
      {activeLayout === 'workspace' && (
        <div className="space-y-4">
          {/* Sub-Tabs of all masters inside the active logical module */}
          <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-2xs">
            {/* Wrap instead of scrolling sideways, so every master in the group is visible */}
            <div className="flex flex-wrap gap-1.5">
              {masterConfigs
                .filter(isMasterInActiveScope)
                .map((m) => {
                  // currentMaster falls back to the group's first master, so highlight what's actually shown
                  const isSelected = currentMaster.id === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMasterId(m.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                      }`}
                    >
                      <span>{m.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                          isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {m.records.length}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Active Workspace Header Bar */}
          <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-500">
                {alignmentMode === 'by_module' ? currentModuleMeta.title : currentGroupMeta.title}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-extrabold text-blue-950 text-sm">{currentMaster.name}</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                Module: {currentMaster.moduleName}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {currentMaster.category}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  currentMaster.owner === 'TML_ADMIN'
                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}
              >
                {currentMaster.owner === 'TML_ADMIN' ? 'TML OEM Central' : 'Dealership Floor'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveLayout('grouped_cards')}
                className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer flex items-center gap-1 pl-2"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Back to Grouped Cards</span>
              </button>
            </div>
          </div>

          {/* MASTER CONTENT RENDERING */}
          {(() => {
            // Case 0: Bodyshop Master (facilities, specialized tools, lead technicians, inventory capture, insurance docs)
            if (currentMaster.id === 'bodyshop_facility_master') {
              return (
                <BodyshopMaster
                  onOpenCatalogues={() => setActiveLayout('grouped_cards')}
                />
              );
            }

            // Case 1: Bay Management (allocation, approvals, status governance)
            if (currentMaster.id === 'bay_management_interactive') {
              return (
                <BayManagementConsole
                  adminRole={adminRole}
                  dealers={dealersList}
                  onBulkUpload={() => setIsBayImportModalOpen(true)}
                />
              );
            }

            // Case 2: Non-Operational Hours & Holiday Calendar
            if (currentMaster.id === 'holiday_calendar_master') {
              const scopes = dealersList
                .filter((d) => adminRole === 'TML Admin' || d.code === dealersList[0].code)
                .flatMap((d) =>
                  (DEALER_DIVISIONS[d.code] ?? ['Main Workshop']).map((division) => ({
                    key: calendarKey(d.code, division),
                    label: `${d.name} — ${division}`,
                  }))
                );
              return (
                <HolidayCalendarConsole
                  key={adminRole}
                  scopes={scopes}
                  calendars={calendars}
                  onChange={(key, cal) => setCalendars((prev) => ({ ...prev, [key]: cal }))}
                  today={toIsoDate(new Date())}
                />
              );
            }

            // Case 3: Time Slot Quotas Console
            if (currentMaster.id === 'time_slot_quotas_master') {
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="font-bold text-slate-900">
                        Service Intake &amp; Appointment Time Slot Master: Sample Motors Hyderabad
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Regulates intake density, dedicated lift allocations, and walk-in buffers.
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                      Standard Hours: 09:00 - 19:00
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {timeSlots.map((s) => (
                      <div
                        key={s.slot}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 hover:border-blue-400 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="font-mono font-bold text-xs text-blue-900">{s.slot}</span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                s.status === 'FULLY BOOKED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : s.status === 'HIGH DEMAND'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {s.status}
                            </span>
                          </div>

                          <div className="pt-2 space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Max Capacity:</span>
                              <span className="font-bold text-slate-900">{s.cap} vehicles</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Booked:</span>
                              <span className="font-bold text-blue-900">{s.booked}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Walk-in Reserve:</span>
                              <span className="font-mono text-slate-700">{s.buffer} buffer</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Dedicated Bays:</span>
                              <span className="font-bold text-slate-900">{s.bays} bays</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>Intake Load</span>
                            <span>{Math.round((s.booked / s.cap) * 100)}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                s.booked >= s.cap
                                  ? 'bg-rose-500'
                                  : s.booked / s.cap > 0.8
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, (s.booked / s.cap) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            // Case 4: Dealership Registry Console
            if (currentMaster.id === 'dealer_details_registry') {
              return (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        PAN India Authorized Dealership Facility Registry
                      </h3>
                      <p className="text-xs text-slate-500">
                        Official registry of Tata Motors authorized 3S / 2S dealerships and regional service infrastructure.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="px-4 py-3">Dealer Code</th>
                          <th className="px-4 py-3">Dealership Name</th>
                          <th className="px-4 py-3">Location &amp; Zone</th>
                          <th className="px-4 py-3">Facility Type</th>
                          <th className="px-4 py-3">Physical Bays</th>
                          <th className="px-4 py-3">Works Manager</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dealersList.map((d) => (
                          <tr key={d.code} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 font-mono font-bold text-blue-900">{d.code}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{d.name}</td>
                            <td className="px-4 py-3">
                              <div className="text-slate-800 font-medium">{d.city}</div>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">
                                Zone: {d.zone}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{d.type}</td>
                            <td className="px-4 py-3 font-mono font-semibold text-slate-900">{d.bays}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800">{d.head}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{d.phone}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                {d.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }

            // Default Case: Enterprise Schema-Driven Table Editor (EQC masters get the rule tester on top)
            return (
              <div className="space-y-4">
                {currentMaster.logicalGroup === 'Electronic Quality Check' && <EqcRuleTester />}
                {currentMaster.logicalGroup === 'Bodyshop' && <BodyshopCapturePreview />}
                {currentMaster.moduleCode === 'thd' && <ThdRuleTester />}
                <MasterTableEditor
                  master={currentMaster}
                  isAdminTml={adminRole === 'TML Admin'}
                  onUpdateMaster={(updated) => {
                    updateMasterConfig(updated);
                  }}
                  onOpenChangeLog={() => setActiveMainTab('changelog')}
                  onOpenDealerPreview={() => setActiveMainTab('dealer_preview')}
                />
              </div>
            );
          })()}
        </div>
      )}
    </>
  )}

      <CreateMasterModal
        isOpen={isCreateMasterOpen}
        onClose={() => setIsCreateMasterOpen(false)}
        defaultGroup={activeLogicalGroup}
        isAdminTml={adminRole === 'TML Admin'}
        onCreated={openMasterInWorkspace}
      />
      <SmartExcelImportModal
        isOpen={isSmartImportOpen}
        onClose={() => setIsSmartImportOpen(false)}
        onImported={(masters) => masters[0] && openMasterInWorkspace(masters[0])}
      />

      <MasterWorkbookImportModal
        isOpen={isWorkbookImportOpen}
        onClose={() => setIsWorkbookImportOpen(false)}
        onImported={(masters) => masters[0] && openMasterInWorkspace(masters[0])}
      />

      {/* Bulk Import Modal for Bay Management */}
      <MasterDataImportModal
        isOpen={isBayImportModalOpen}
        onClose={() => setIsBayImportModalOpen(false)}
        master={bayMasterConfig}
        onImportComplete={(imported) => handleBayImportComplete(imported)}
      />

      {/* Universal Bulk Upload Modal for any Master Parameter Records */}
      {bulkUploadMaster && (
        <MasterDataImportModal
          isOpen={Boolean(bulkUploadMaster)}
          onClose={() => setBulkUploadMaster(null)}
          master={bulkUploadMaster}
          onImportComplete={(imported, mode) => {
            // Merge into the latest saved version, not the snapshot taken when the modal opened
            const latest = masterConfigs.find((m) => m.id === bulkUploadMaster.id) || bulkUploadMaster;
            const updated = {
              ...latest,
              records: mergeImportedRecords(latest.records, imported, mode),
            };
            updateMasterConfig(updated);
            showToast(
              `Committed ${imported.length} parameter records into ${bulkUploadMaster.name} (${mode.toUpperCase()})`,
              'success'
            );
            setBulkUploadMaster(null);
          }}
        />
      )}
    </div>
  );
};
