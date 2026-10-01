import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  MASTER_COLLECTIONS,
  LOGICAL_MODULES,
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
  Table2,
} from 'lucide-react';
import { masterExportUtil } from '../utils/masterExportUtil';
import { mergeImportedRecords } from '../utils/recordMerge';

interface BayRecord {
  id: string;
  no: number;
  region: 'South' | 'North' | 'West' | 'East';
  dealerCode: string;
  dealerName: string;
  bayName: string;
  bayType: 'Mechanical' | 'Electrical' | 'EV' | 'Fleet' | 'Speedo' | 'AC' | 'BodyShop';
  bayStatus: 'Active' | 'Inactive';
  inactiveFrom?: string;
  inactiveTo?: string;
  approvalStatus: 'Approved' | 'Pending Approval' | 'Draft' | 'Rejected';
  floor: 'Floor 1' | 'Floor 2' | 'Ground' | 'Basement';
  liftAvailability: 'No Lift' | '2 post lift' | '4 post lift';
  specialEquipments: string[];
  techSupervisor: string;
  tech1: string;
  tech2: string;
}

interface HolidayOverride {
  id: string;
  date: string;
  name: string;
  type: string;
  hours: string;
  isClosed: boolean;
}

// Icon helper function for rendering module icons
const getGroupIcon = (iconName: string, className = 'h-4 w-4') => {
  switch (iconName) {
    case 'Car':
      return <Car className={className} />;
    case 'Building2':
      return <Building2 className={className} />;
    case 'Wrench':
      return <Wrench className={className} />;
    case 'Package':
    default:
      return <Package className={className} />;
  }
};

export const MastersMaintenancePage: React.FC = () => {
  const {
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
  const [adminRole, setAdminRole] = useState<'Dealer Admin' | 'TML Admin'>('TML Admin');

  // Primary Navigation Tab: 'catalogues' (Parameter master tables) vs 'changelog' (Change Log) vs 'rules_engine' (Rules Engine Studio) vs 'dealer_preview' (Dealer App Preview Simulator)
  const [activeMainTab, setActiveMainTab] = useState<'catalogues' | 'changelog' | 'rules_engine' | 'dealer_preview'>('catalogues');

  // Active Logical Module Tab (Default: 'Vehicle Data' as requested by user)
  const [activeLogicalGroup, setActiveLogicalGroup] = useState<LogicalModuleGroup>('Vehicle Data');

  // Display Layout: 'workspace' (Tabbed editor workspace) by default so MasterTableEditor is immediately visible
  const [activeLayout, setActiveLayout] = useState<'grouped_cards' | 'workspace'>('workspace');

  // Currently Selected Master (for editing / detailed interactive view)
  const [selectedMasterId, setSelectedMasterId] = useState<string>('ppl_master');

  // Universal Bulk Upload Modal state for any master catalogue
  const [bulkUploadMaster, setBulkUploadMaster] = useState<MasterConfig | null>(null);

  // On-the-fly master creation (form) and BA workbook import
  const [isCreateMasterOpen, setIsCreateMasterOpen] = useState(false);
  const [isWorkbookImportOpen, setIsWorkbookImportOpen] = useState(false);

  // Deep links from the BA guide: #/admin/masters?open=create | ?open=import
  useEffect(() => {
    const open = new URLSearchParams(currentRoute.split('?')[1] || '').get('open');
    if (open === 'create') setIsCreateMasterOpen(true);
    if (open === 'import') {
      setAdminRole('TML Admin');
      setIsWorkbookImportOpen(true);
    }
  }, [currentRoute]);

  const openMasterInWorkspace = (m: MasterConfig) => {
    setActiveMainTab('catalogues');
    setActiveLogicalGroup(m.logicalGroup);
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
  const [filterRegion, setFilterRegion] = useState('South');
  const [filterDealer, setFilterDealer] = useState('All');
  const [filterBayType, setFilterBayType] = useState('All');
  const [filterBayStatus, setFilterBayStatus] = useState('All');
  const [filterBayName, setFilterBayName] = useState('');
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('All');

  const [selectedBayIds, setSelectedBayIds] = useState<string[]>([]);
  const [activeSelectedBayId, setActiveSelectedBayId] = useState<string>('BAY-01');
  const [isBayImportModalOpen, setIsBayImportModalOpen] = useState(false);

  const [bays, setBays] = useState<BayRecord[]>([
    {
      id: 'BAY-01',
      no: 1,
      region: 'South',
      dealerCode: 'DLR1001',
      dealerName: 'Sample Motors Hyderabad',
      bayName: 'Mechanical Bay 01',
      bayType: 'Mechanical',
      bayStatus: 'Active',
      inactiveFrom: '',
      inactiveTo: '',
      approvalStatus: 'Approved',
      floor: 'Floor 1',
      liftAvailability: '2 post lift',
      specialEquipments: ['Nut Runner', 'Oil Dispensing Unit'],
      techSupervisor: 'Ram',
      tech1: 'Shyam',
      tech2: 'Rohit',
    },
    {
      id: 'BAY-02',
      no: 2,
      region: 'South',
      dealerCode: 'DLR1001',
      dealerName: 'Sample Motors Hyderabad',
      bayName: 'Mechanical Bay 02',
      bayType: 'Mechanical',
      bayStatus: 'Active',
      inactiveFrom: '',
      inactiveTo: '',
      approvalStatus: 'Approved',
      floor: 'Floor 1',
      liftAvailability: '2 post lift',
      specialEquipments: ['Nut Runner', 'Brake rivet machine'],
      techSupervisor: 'Ram',
      tech1: 'Sunil Kumar',
      tech2: 'Anil Rao',
    },
    {
      id: 'BAY-03',
      no: 3,
      region: 'South',
      dealerCode: 'DLR1001',
      dealerName: 'Sample Motors Hyderabad',
      bayName: 'Electrical Bay 01',
      bayType: 'Electrical',
      bayStatus: 'Active',
      inactiveFrom: '',
      inactiveTo: '',
      approvalStatus: 'Pending Approval',
      floor: 'Floor 1',
      liftAvailability: 'No Lift',
      specialEquipments: ['Nut Runner', 'EV Charger'],
      techSupervisor: 'Madhu',
      tech1: 'Raghavan K',
      tech2: 'Venkat S',
    },
    {
      id: 'BAY-04',
      no: 4,
      region: 'South',
      dealerCode: 'DLR1001',
      dealerName: 'Sample Motors Hyderabad',
      bayName: 'EV High-Voltage Bay 01',
      bayType: 'EV',
      bayStatus: 'Active',
      inactiveFrom: '',
      inactiveTo: '',
      approvalStatus: 'Approved',
      floor: 'Floor 1',
      liftAvailability: '2 post lift',
      specialEquipments: ['EV Charger', 'Nut Runner', 'Oil Dispensing Unit'],
      techSupervisor: 'Madhu',
      tech1: 'Arjun Das (EV Level 3)',
      tech2: 'Kiran Verma',
    },
    {
      id: 'BAY-05',
      no: 5,
      region: 'South',
      dealerCode: 'DLR1001',
      dealerName: 'Sample Motors Hyderabad',
      bayName: 'Fleet Service Bay 01',
      bayType: 'Fleet',
      bayStatus: 'Active',
      inactiveFrom: '',
      inactiveTo: '',
      approvalStatus: 'Draft',
      floor: 'Floor 1',
      liftAvailability: '4 post lift',
      specialEquipments: ['Nut Runner', 'Brake rivet machine'],
      techSupervisor: 'Ram',
      tech1: 'Gopal S',
      tech2: 'Manoj P',
    },
    {
      id: 'BAY-06',
      no: 6,
      region: 'South',
      dealerCode: 'DLR1001',
      dealerName: 'Sample Motors Hyderabad',
      bayName: 'Speedo Express Bay 01',
      bayType: 'Speedo',
      bayStatus: 'Active',
      inactiveFrom: '',
      inactiveTo: '',
      approvalStatus: 'Approved',
      floor: 'Floor 1',
      liftAvailability: '2 post lift',
      specialEquipments: ['Oil Dispensing Unit', 'Nut Runner'],
      techSupervisor: 'Madhu',
      tech1: 'Mahesh Reddy',
      tech2: 'Devendra T',
    },
    {
      id: 'BAY-07',
      no: 7,
      region: 'South',
      dealerCode: 'DLR1001',
      dealerName: 'Sample Motors Hyderabad',
      bayName: 'Air Conditioning Bay 01',
      bayType: 'AC',
      bayStatus: 'Active',
      inactiveFrom: '',
      inactiveTo: '',
      approvalStatus: 'Approved',
      floor: 'Floor 1',
      liftAvailability: 'No Lift',
      specialEquipments: ['Nut Runner'],
      techSupervisor: 'Ram',
      tech1: 'Santosh Kumar',
      tech2: 'Naveen B',
    },
    {
      id: 'BAY-08',
      no: 8,
      region: 'South',
      dealerCode: 'DLR1001',
      dealerName: 'Sample Motors Hyderabad',
      bayName: 'BodyShop Paint Prep 01',
      bayType: 'BodyShop',
      bayStatus: 'Inactive',
      inactiveFrom: '2026-09-25',
      inactiveTo: '2026-10-05',
      approvalStatus: 'Rejected',
      floor: 'Basement',
      liftAvailability: 'No Lift',
      specialEquipments: ['Brake rivet machine'],
      techSupervisor: 'Madhu',
      tech1: 'Premchand',
      tech2: 'Farhan Ali',
    },
    {
      id: 'BAY-09',
      no: 9,
      region: 'South',
      dealerCode: 'DLR1001',
      dealerName: 'Sample Motors Hyderabad',
      bayName: 'BodyShop Denting 01',
      bayType: 'BodyShop',
      bayStatus: 'Active',
      inactiveFrom: '',
      inactiveTo: '',
      approvalStatus: 'Draft',
      floor: 'Basement',
      liftAvailability: '2 post lift',
      specialEquipments: ['Nut Runner', 'Brake rivet machine'],
      techSupervisor: 'Ram',
      tech1: 'Kishore J',
      tech2: 'Sanjay Rawat',
    },
  ]);

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
        { key: 'region', label: 'Region', type: 'select', options: ['South', 'North', 'West', 'East'], mandatory: true },
        { key: 'dealerCode', label: 'Dealer Code', type: 'text', mandatory: true },
        { key: 'dealerName', label: 'Dealer Name', type: 'text', mandatory: true },
        { key: 'bayName', label: 'Bay Name', type: 'text', mandatory: true },
        { key: 'bayType', label: 'Bay Type', type: 'select', options: ['Mechanical', 'Electrical', 'EV', 'Fleet', 'Speedo', 'AC', 'BodyShop'], mandatory: true },
        { key: 'floor', label: 'Floor', type: 'select', options: ['Ground', 'Floor 1', 'Floor 2', 'Basement'], mandatory: true },
        { key: 'liftAvailability', label: 'Lift Availability', type: 'select', options: ['No Lift', '2 post lift', '4 post lift'], mandatory: true },
        { key: 'bayStatus', label: 'Bay Status', type: 'select', options: ['Active', 'Inactive'], mandatory: true },
        { key: 'techSupervisor', label: 'Tech Supervisor', type: 'text' },
        { key: 'tech1', label: 'Technician 1', type: 'text' },
        { key: 'tech2', label: 'Technician 2', type: 'text' },
      ],
      records: bays,
    }),
    [bays]
  );

  const nextBayNumber = () => bays.reduce((max, b) => Math.max(max, b.no), 0) + 1;

  const handleBayImportComplete = (importedRows: Array<Record<string, any>>) => {
    const existingIds = new Set(bays.map((b) => b.id));
    const startNo = nextBayNumber();
    const newBays: BayRecord[] = importedRows.map((r, idx) => ({
      // Never reuse an id that already exists (duplicate ids break selection & approval)
      id: r.id && !existingIds.has(r.id) ? r.id : `BAY-${String(startNo + idx).padStart(2, '0')}`,
      no: startNo + idx,
      region: (r.region as any) || 'South',
      dealerCode: r.dealerCode || 'DLR1001',
      dealerName: r.dealerName || 'Sample Motors Hyderabad',
      bayName: r.bayName || `Bay ${bays.length + idx + 1}`,
      bayType: (r.bayType as any) || 'Mechanical',
      bayStatus: (r.bayStatus as any) || 'Active',
      inactiveFrom: '',
      inactiveTo: '',
      approvalStatus: 'Approved',
      floor: r.floor || 'Ground',
      liftAvailability: (r.liftAvailability as any) || 'No Lift',
      specialEquipments: [],
      techSupervisor: r.techSupervisor || 'Suresh Kumar',
      tech1: r.tech1 || 'M. Rajesh',
      tech2: r.tech2 || 'P. Vinay',
    }));
    setBays((prev) => [...newBays, ...prev]);
    showToast(`Successfully imported ${newBays.length} bays into workshop layout`, 'success');
  };

  const filteredBays = bays.filter((b) => {
    if (filterRegion !== 'All' && b.region !== filterRegion) return false;
    if (filterDealer !== 'All' && b.dealerCode !== filterDealer) return false;
    if (filterBayType !== 'All' && b.bayType !== filterBayType) return false;
    if (filterBayStatus !== 'All' && b.bayStatus !== filterBayStatus) return false;
    if (filterApprovalStatus !== 'All' && b.approvalStatus !== filterApprovalStatus) return false;
    if (filterBayName.trim() && !b.bayName.toLowerCase().includes(filterBayName.toLowerCase())) return false;
    return true;
  });

  const selectedBay = bays.find((b) => b.id === activeSelectedBayId) || bays[0];

  const handleToggleSelectBay = (id: string, approvalStatus: string) => {
    if (approvalStatus !== 'Draft' && approvalStatus !== 'Rejected') {
      showToast('Only Draft and Rejected bays can be selected for approval.', 'error');
      return;
    }
    if (selectedBayIds.includes(id)) {
      setSelectedBayIds(selectedBayIds.filter((item) => item !== id));
    } else {
      setSelectedBayIds([...selectedBayIds, id]);
    }
  };

  // Editable copy of the bay open in the inspector; saved explicitly via "Save Bay Setup"
  const [bayDraft, setBayDraft] = useState<BayRecord | null>(null);
  useEffect(() => {
    setBayDraft(selectedBay ? { ...selectedBay } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSelectedBayId, selectedBay?.id]);

  const handleCreateBay = () => {
    const no = nextBayNumber();
    const dealer = dealersList.find((d) => d.code === filterDealer) || dealersList[0];
    const newBay: BayRecord = {
      id: `BAY-${String(no).padStart(2, '0')}`,
      no,
      region: (filterRegion !== 'All' ? filterRegion : dealer.zone) as BayRecord['region'],
      dealerCode: dealer.code,
      dealerName: dealer.name,
      bayName: `New Bay ${no}`,
      bayType: 'Mechanical',
      bayStatus: 'Active',
      inactiveFrom: '',
      inactiveTo: '',
      approvalStatus: 'Draft',
      floor: 'Ground',
      liftAvailability: 'No Lift',
      specialEquipments: [],
      techSupervisor: '',
      tech1: '',
      tech2: '',
    };
    setBays((prev) => [newBay, ...prev]);
    setActiveSelectedBayId(newBay.id);
    // Make sure the new draft isn't hidden by the current filters
    setFilterBayType('All');
    setFilterBayStatus('All');
    setFilterApprovalStatus('All');
    setFilterBayName('');
    logAudit('Bay Created', 'Masters Maintenance', `${newBay.id} (${newBay.dealerCode})`, 'None', 'Draft bay created');
    showToast(`Draft ${newBay.id} created — edit its details below and save`, 'info');
  };

  const handleSaveBay = () => {
    if (!bayDraft) return;
    if (!bayDraft.bayName.trim()) {
      showToast('Bay name is required', 'error');
      return;
    }
    const before = bays.find((b) => b.id === bayDraft.id);
    setBays((prev) => prev.map((b) => (b.id === bayDraft.id ? { ...bayDraft, bayName: bayDraft.bayName.trim() } : b)));
    logAudit(
      'Bay Updated',
      'Masters Maintenance',
      `${bayDraft.id} (${bayDraft.dealerCode})`,
      before ? `${before.bayName} / ${before.bayType} / ${before.floor} / ${before.liftAvailability}` : '—',
      `${bayDraft.bayName} / ${bayDraft.bayType} / ${bayDraft.floor} / ${bayDraft.liftAvailability}`
    );
    showToast(`Saved changes for ${bayDraft.bayName}`, 'success');
  };

  const handleSendForApproval = () => {
    if (selectedBayIds.length === 0) return;
    setBays((prev) =>
      prev.map((b) => (selectedBayIds.includes(b.id) ? { ...b, approvalStatus: 'Pending Approval' } : b))
    );
    logAudit('Bays Sent for Approval', 'Masters Maintenance', selectedBayIds.join(', '), 'Draft / Rejected', 'Pending Approval');
    showToast(`Sent ${selectedBayIds.length} bay(s) for TML Admin approval!`, 'success');
    setSelectedBayIds([]);
  };

  // ---------------------------------------------------------------------------
  // HOLIDAY CALENDAR STATE (Dealer Network & Facilities)
  // ---------------------------------------------------------------------------
  const [weeklyPattern, setWeeklyPattern] = useState([
    { day: 'Monday', isWeekOff: false, open: '09:00', close: '19:00' },
    { day: 'Tuesday', isWeekOff: false, open: '09:00', close: '19:00' },
    { day: 'Wednesday', isWeekOff: false, open: '09:00', close: '19:00' },
    { day: 'Thursday', isWeekOff: false, open: '09:00', close: '19:00' },
    { day: 'Friday', isWeekOff: false, open: '09:00', close: '19:00' },
    { day: 'Saturday', isWeekOff: false, open: '09:00', close: '19:00' },
    { day: 'Sunday', isWeekOff: true, open: '09:00', close: '13:00' },
  ]);

  const [dateHolidays, setDateHolidays] = useState<HolidayOverride[]>([
    {
      id: 'HOL-SEP-01',
      date: '2026-09-17',
      name: 'Vishwakarma Jayanti',
      type: 'Workshop Puja & Half Day',
      hours: '09:00 - 13:00',
      isClosed: false,
    },
    {
      id: 'HOL-SEP-02',
      date: '2026-09-28',
      name: 'Anant Chaturdashi / Ganesh Visarjan',
      type: 'Festival Closure',
      hours: 'Closed',
      isClosed: true,
    },
  ]);

  const [holidayDraft, setHolidayDraft] = useState<{ date: string; name: string; isClosed: boolean; hours: string } | null>(null);

  const handleAddHoliday = () => {
    if (!holidayDraft) return;
    if (!holidayDraft.date || !holidayDraft.name.trim()) {
      showToast('Date and occasion name are required', 'error');
      return;
    }
    if (dateHolidays.some((h) => h.date === holidayDraft.date)) {
      showToast(`An override already exists for ${holidayDraft.date}`, 'error');
      return;
    }
    const entry: HolidayOverride = {
      id: `HOL-${holidayDraft.date}`,
      date: holidayDraft.date,
      name: holidayDraft.name.trim(),
      type: holidayDraft.isClosed ? 'Festival Closure' : 'Half Day Override',
      hours: holidayDraft.isClosed ? 'Closed' : holidayDraft.hours || '09:00 - 13:00',
      isClosed: holidayDraft.isClosed,
    };
    setDateHolidays((prev) => [...prev, entry].sort((a, b) => a.date.localeCompare(b.date)));
    logAudit('Holiday Override Added', 'Masters Maintenance', `${entry.date} (${entry.name})`, 'None', entry.hours);
    showToast(`Added ${entry.name} on ${entry.date}`, 'success');
    setHolidayDraft(null);
  };

  const handleToggleWeeklyOff = (dayName: string) => {
    setWeeklyPattern(
      weeklyPattern.map((d) => (d.day === dayName ? { ...d, isWeekOff: !d.isWeekOff } : d))
    );
  };

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
  // LOGICAL GROUP DERIVATIONS & SELECTIONS
  // ---------------------------------------------------------------------------
  const currentGroupMeta = useMemo(() => {
    return LOGICAL_MODULES.find((g) => g.id === activeLogicalGroup) || LOGICAL_MODULES[0];
  }, [activeLogicalGroup]);

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

  // Masters filtered by the active logical module
  const groupMasters = useMemo(() => {
    return masterConfigs.filter((m) => {
      if (m.logicalGroup !== activeLogicalGroup) return false;
      if (ownerFilter !== 'ALL' && m.owner !== ownerFilter) return false;
      if (searchQuery.trim() && !doesMasterMatchSearch(m, searchQuery.trim())) return false;
      return true;
    });
  }, [masterConfigs, activeLogicalGroup, ownerFilter, searchQuery]);

  // Real-time matches across all modules for quick discovery
  const crossModuleMatches = useMemo(() => {
    if (!searchQuery.trim()) return {};
    const q = searchQuery.trim();
    const result: Record<string, number> = {};

    LOGICAL_MODULES.forEach((mod) => {
      const count = masterConfigs.filter((m) => {
        if (m.logicalGroup !== mod.id) return false;
        if (ownerFilter !== 'ALL' && m.owner !== ownerFilter) return false;
        return doesMasterMatchSearch(m, q);
      }).length;

      if (count > 0) {
        result[mod.id] = count;
      }
    });

    return result;
  }, [masterConfigs, ownerFilter, searchQuery]);

  // Current active master config
  const currentMaster = useMemo(() => {
    const found = masterConfigs.find((m) => m.id === selectedMasterId);
    if (found && found.logicalGroup === activeLogicalGroup) return found;
    // Otherwise fallback to first master in active group
    const firstInGroup = masterConfigs.find((m) => m.logicalGroup === activeLogicalGroup);
    return firstInGroup || masterConfigs[0];
  }, [masterConfigs, selectedMasterId, activeLogicalGroup]);

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
  const CONSOLE_ONLY_MASTERS = ['holiday_calendar_master', 'time_slot_quotas_master', 'dealer_details_registry'];
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
        recordsData = dateHolidays.map((h) => ({ ...h, isClosed: h.isClosed ? 'Closed' : 'Half Day' }));
        fieldsData = [
          { key: 'date', label: 'Date' },
          { key: 'name', label: 'Occasion / Holiday Name' },
          { key: 'type', label: 'Classification' },
          { key: 'hours', label: 'Operating Hours' },
          { key: 'isClosed', label: 'Status' },
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
        data: filteredBays,
      });
    } else if (currentMaster.id === 'holiday_calendar_master') {
      masterExportUtil.exportToCSV({
        masterName: 'Non-Operational Hours & Holiday Calendar',
        category: 'Dealer Network',
        currentUser: { userId: currentUser.userId, name: currentUser.name },
        columns: [
          { key: 'date', label: 'Holiday Date' },
          { key: 'name', label: 'Occasion / Holiday Name' },
          { key: 'type', label: 'Classification' },
          { key: 'hours', label: 'Operating Hours' },
          { key: 'isClosed', label: 'Full Day Closed' },
        ],
        data: dateHolidays.map((h) => ({ ...h, isClosed: h.isClosed ? 'Yes' : 'No' })),
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
                <span className="underline">{currentGroupMeta.title}</span>
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
                {LOGICAL_MODULES.filter(
                  (mod) => mod.id !== activeLogicalGroup && crossModuleMatches[mod.id]
                ).map((mod) => (
                  <button
                    key={mod.id}
                    onClick={() => {
                      setActiveLogicalGroup(mod.id);
                      const firstMatch = masterConfigs.find(
                        (m) => m.logicalGroup === mod.id && doesMasterMatchSearch(m, searchQuery)
                      );
                      if (firstMatch) {
                        setSelectedMasterId(firstMatch.id);
                      }
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-200 transition-all cursor-pointer"
                  >
                    <span>{mod.title}</span>
                    <span className="bg-amber-200 px-1 py-0.2 rounded font-mono text-[9px]">
                      {crossModuleMatches[mod.id]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================================= */}
      {/* 3. PRIMARY TABBED INTERFACE: LOGICAL MODULES & CHANGE LOG                */}
      {/* ======================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-2xs">
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
                  // Auto pick first master in this logical module
                  const firstInMod = masterConfigs.find((m) => m.logicalGroup === mod.id);
                  if (firstInMod) {
                    setSelectedMasterId(firstInMod.id);
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

          {/* 5th Tab: Change Log */}
          <button
            onClick={() => setActiveMainTab('changelog')}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
              activeMainTab === 'changelog'
                ? 'bg-blue-900 border-blue-950 text-white shadow-sm ring-2 ring-blue-600/30'
                : 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-white hover:border-slate-300'
            }`}
          >
            <div
              className={`p-2 rounded-lg mt-0.5 ${
                activeMainTab === 'changelog'
                  ? 'bg-white/20 text-white'
                  : 'bg-white border border-slate-200 text-indigo-700 shadow-2xs'
              }`}
            >
              <History className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="font-bold text-xs truncate leading-snug">Change Log</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                    activeMainTab === 'changelog'
                      ? 'bg-blue-800 text-blue-100'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  Live Audit
                </span>
              </div>
              <div
                className={`text-[11px] truncate ${
                  activeMainTab === 'changelog' ? 'text-blue-200' : 'text-slate-400'
                }`}
              >
                Track modifications &amp; diffs
              </div>
            </div>
          </button>

          {/* 6th Tab: Rules Engine Studio */}
          <button
            onClick={() => setActiveMainTab('rules_engine')}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
              activeMainTab === 'rules_engine'
                ? 'bg-indigo-900 border-indigo-950 text-white shadow-sm ring-2 ring-indigo-600/30'
                : 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-white hover:border-slate-300'
            }`}
          >
            <div
              className={`p-2 rounded-lg mt-0.5 ${
                activeMainTab === 'rules_engine'
                  ? 'bg-white/20 text-white'
                  : 'bg-white border border-slate-200 text-indigo-700 shadow-2xs'
              }`}
            >
              <Zap className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="font-bold text-xs truncate leading-snug">Rules Engine</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                    activeMainTab === 'rules_engine'
                      ? 'bg-indigo-800 text-indigo-100'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  No-Code
                </span>
              </div>
              <div
                className={`text-[11px] truncate ${
                  activeMainTab === 'rules_engine' ? 'text-indigo-200' : 'text-slate-400'
                }`}
              >
                Regex, ranges &amp; visibility
              </div>
            </div>
          </button>

          {/* 7th Tab: Dealer App Preview Simulator */}
          <button
            onClick={() => setActiveMainTab('dealer_preview')}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
              activeMainTab === 'dealer_preview'
                ? 'bg-blue-900 border-blue-950 text-white shadow-sm ring-2 ring-blue-600/30'
                : 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-white hover:border-slate-300'
            }`}
          >
            <div
              className={`p-2 rounded-lg mt-0.5 ${
                activeMainTab === 'dealer_preview'
                  ? 'bg-white/20 text-white'
                  : 'bg-white border border-slate-200 text-emerald-700 shadow-2xs'
              }`}
            >
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="font-bold text-xs truncate leading-snug">Dealer Preview</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                    activeMainTab === 'dealer_preview'
                      ? 'bg-blue-800 text-blue-100'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  Simulator
                </span>
              </div>
              <div
                className={`text-[11px] truncate ${
                  activeMainTab === 'dealer_preview' ? 'text-blue-200' : 'text-slate-400'
                }`}
              >
                Test UI &amp; logic live
              </div>
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
        <RulesEngineStudio />
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
              if (targetMaster) {
                setActiveLogicalGroup(targetMaster.logicalGroup);
              }
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
            {getGroupIcon(currentGroupMeta.iconName, 'h-5 w-5')}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold tracking-tight text-white">
                {currentGroupMeta.title}
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-700/60 text-blue-200 font-mono font-bold border border-blue-500/30">
                {currentGroupMeta.badge}
              </span>
            </div>
            <p className="text-xs text-blue-200/90 mt-0.5">{currentGroupMeta.shortDesc}</p>
          </div>
        </div>

        {/* Layout Switcher & Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Grouped Cards vs Tabbed Workspace Toggle */}
          <div className="bg-blue-950/80 p-0.5 rounded-xl border border-blue-400/30 flex items-center text-xs">
            <button
              onClick={() => setActiveLayout('grouped_cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeLayout === 'grouped_cards'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Grouped Cards View</span>
            </button>
            <button
              onClick={() => setActiveLayout('workspace')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeLayout === 'workspace'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-blue-200 hover:text-white'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
              <span>Tabbed Workspace</span>
            </button>
          </div>

          <button
            onClick={() => navigate('/admin/masters-guide')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 text-xs font-bold border border-emerald-300/40 cursor-pointer transition-all"
            title="Step-by-step guide, templates and practice files for BAs"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>BA Guide</span>
          </button>

          {/* On-the-fly master definition: no code change or deployment needed */}
          <button
            onClick={() => setIsCreateMasterOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-blue-950 hover:bg-blue-50 text-xs font-bold border border-blue-200 cursor-pointer shadow-xs transition-all"
            title="Define a brand-new master and its fields"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create New Master</span>
          </button>
          <button
            onClick={() => {
              if (adminRole !== 'TML Admin') {
                showToast('Switch to TML Admin to import a BA master workbook', 'error');
                return;
              }
              setIsWorkbookImportOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold border border-indigo-300/40 cursor-pointer shadow-xs transition-all"
            title="Create or extend many masters at once from the BA Excel workbook"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Import BA Workbook</span>
          </button>

          {/* Module-Level Reporting Downloads & Bulk Upload */}
          <button
            onClick={() => openBulkUpload(currentMaster)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold border border-blue-400/40 cursor-pointer shadow-xs transition-all"
            title={`Bulk upload parameter records into ${currentMaster.name} (JSON or Excel)`}
          >
            <Upload className="h-3.5 w-3.5 text-blue-200" />
            <span>Bulk Upload (JSON / Excel)</span>
          </button>

          <button
            onClick={handleDownloadModuleCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border border-emerald-400/40 cursor-pointer shadow-xs transition-all"
            title={`Download consolidated CSV report for ${currentGroupMeta.title} module`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download CSV</span>
          </button>

          <button
            onClick={handleExportModuleExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-800/80 hover:bg-blue-700 text-white text-xs font-bold border border-blue-400/40 cursor-pointer shadow-2xs transition-all"
            title={`Export ${currentGroupMeta.title} module to Excel`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-blue-200" />
            <span>Export Excel</span>
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
              All Masters ({masterConfigs.filter((m) => m.logicalGroup === activeLogicalGroup).length})
            </button>
            <button
              onClick={() => setOwnerFilter('TML_ADMIN')}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                ownerFilter === 'TML_ADMIN' ? 'bg-blue-900 text-white shadow-xs font-bold' : 'text-slate-500'
              }`}
            >
              OEM Central ({masterConfigs.filter((m) => m.logicalGroup === activeLogicalGroup && m.owner === 'TML_ADMIN').length})
            </button>
            <button
              onClick={() => setOwnerFilter('DEALER_ADMIN')}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                ownerFilter === 'DEALER_ADMIN' ? 'bg-emerald-800 text-white shadow-xs font-bold' : 'text-slate-500'
              }`}
            >
              Dealership Floor ({masterConfigs.filter((m) => m.logicalGroup === activeLogicalGroup && m.owner === 'DEALER_ADMIN').length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={`Filter in ${currentGroupMeta.title}...`}
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

          <button
            onClick={handleDownloadModuleCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs transition-colors cursor-pointer shadow-2xs"
            title="Download CSV report of current master data module"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Download CSV</span>
          </button>
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
                    <div className="text-[11px] font-semibold text-blue-700 mb-0.5 flex items-center gap-1">
                      <span>{m.category}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500 font-mono text-[10px]">{m.moduleCode}</span>
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
          <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-2xs overflow-x-auto">
            <div className="flex gap-1.5 min-w-max">
              {masterConfigs
                .filter((m) => m.logicalGroup === activeLogicalGroup)
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
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-500">{currentGroupMeta.title}</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-extrabold text-blue-950 text-sm">{currentMaster.name}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  currentMaster.owner === 'TML_ADMIN'
                    ? 'bg-blue-100 text-blue-900'
                    : 'bg-emerald-100 text-emerald-900'
                }`}
              >
                {currentMaster.owner === 'TML_ADMIN' ? 'TML OEM Central' : 'Dealership Floor'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadCurrentMasterCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                title={`Download ${currentMaster.name} as CSV for reporting`}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download CSV</span>
              </button>

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
            // Case 1: Bay Management Interactive Console
            if (currentMaster.id === 'bay_management_interactive') {
              return (
                <div className="space-y-4">
                  {/* Filter Bar */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Region</label>
                        <select
                          value={filterRegion}
                          onChange={(e) => setFilterRegion(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-hidden"
                        >
                          <option value="All">All</option>
                          <option value="South">South</option>
                          <option value="North">North</option>
                          <option value="West">West</option>
                          <option value="East">East</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Dealer</label>
                        <select
                          value={filterDealer}
                          onChange={(e) => setFilterDealer(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-hidden"
                        >
                          <option value="All">All</option>
                          {dealersList.map((d) => (
                            <option key={d.code} value={d.code}>
                              {d.code} - {d.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Bay Type</label>
                        <select
                          value={filterBayType}
                          onChange={(e) => setFilterBayType(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-hidden"
                        >
                          <option value="All">All</option>
                          <option value="Mechanical">Mechanical</option>
                          <option value="Electrical">Electrical</option>
                          <option value="EV">EV</option>
                          <option value="Fleet">Fleet</option>
                          <option value="Speedo">Speedo</option>
                          <option value="AC">AC</option>
                          <option value="BodyShop">BodyShop</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Bay Status</label>
                        <select
                          value={filterBayStatus}
                          onChange={(e) => setFilterBayStatus(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-hidden"
                        >
                          <option value="All">All</option>
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Bay Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Mechanical"
                          value={filterBayName}
                          onChange={(e) => setFilterBayName(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Approval Status</label>
                        <select
                          value={filterApprovalStatus}
                          onChange={(e) => setFilterApprovalStatus(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-hidden"
                        >
                          <option value="All">All</option>
                          <option value="Approved">Approved</option>
                          <option value="Pending Approval">Pending Approval</option>
                          <option value="Draft">Draft</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setFilterRegion('All');
                          setFilterDealer('All');
                          setFilterBayType('All');
                          setFilterBayStatus('All');
                          setFilterBayName('');
                          setFilterApprovalStatus('All');
                        }}
                        className="px-4 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => showToast('Refreshed filtered bay list', 'info')}
                        className="px-5 py-1.5 rounded-lg bg-[#002B49] text-white text-xs font-bold hover:bg-[#003B66] shadow-xs cursor-pointer"
                      >
                        Search
                      </button>
                    </div>
                  </div>

                  {/* Bays Table */}
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between p-4 border-b border-slate-200 gap-3">
                      <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                        Workshop Bays ({filteredBays.length})
                      </h2>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCreateBay}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5 text-blue-600" />
                          <span>+ New Bay</span>
                        </button>

                        <button
                          onClick={() => {
                            masterExportUtil.exportToExcel({
                              masterName: 'Bay Management Master',
                              category: 'Dealer Network',
                              buFilter: filterBayType,
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
                              data: filteredBays,
                            });
                            showToast(`Exported ${filteredBays.length} bays to Excel`, 'success');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Export to Excel</span>
                        </button>

                        <button
                          onClick={() => setIsBayImportModalOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
                        >
                          <Upload className="h-3.5 w-3.5 text-blue-600" />
                          <span>⬆ Bulk Upload</span>
                        </button>

                        <button
                          disabled={selectedBayIds.length === 0}
                          onClick={handleSendForApproval}
                          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all ${
                            selectedBayIds.length > 0
                              ? 'bg-blue-900 hover:bg-blue-800 text-white cursor-pointer'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>
                            Send for Approval {selectedBayIds.length > 0 ? `(${selectedBayIds.length})` : ''}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                          <tr>
                            <th className="px-4 py-3 w-8">
                              <span className="sr-only">Select</span>
                            </th>
                            <th className="px-3 py-3">No.</th>
                            <th className="px-3 py-3">Region</th>
                            <th className="px-3 py-3">Dealer Code</th>
                            <th className="px-4 py-3">Dealer Name</th>
                            <th className="px-4 py-3">Bay Name</th>
                            <th className="px-3 py-3">Bay Type</th>
                            <th className="px-3 py-3">Bay Status</th>
                            <th className="px-3 py-3">Lift Type</th>
                            <th className="px-3 py-3">Floor</th>
                            <th className="px-3 py-3">Approval Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredBays.map((b) => {
                            const isSelectable = b.approvalStatus === 'Draft' || b.approvalStatus === 'Rejected';
                            const isSelected = selectedBayIds.includes(b.id);
                            const isInspecting = activeSelectedBayId === b.id;

                            return (
                              <tr
                                key={b.id}
                                onClick={() => setActiveSelectedBayId(b.id)}
                                className={`transition-colors cursor-pointer ${
                                  isInspecting
                                    ? 'bg-blue-50/70 border-l-4 border-l-blue-600'
                                    : 'hover:bg-slate-50/70'
                                }`}
                              >
                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={!isSelectable}
                                    onChange={() => handleToggleSelectBay(b.id, b.approvalStatus)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                                  />
                                </td>
                                <td className="px-3 py-3 font-mono font-medium text-slate-600">{b.no}</td>
                                <td className="px-3 py-3 text-slate-700">{b.region}</td>
                                <td className="px-3 py-3 font-mono font-bold text-blue-900">{b.dealerCode}</td>
                                <td className="px-4 py-3 font-medium text-slate-800">{b.dealerName}</td>
                                <td className="px-4 py-3 font-bold text-slate-900">
                                  <span className="flex items-center gap-1.5">
                                    {b.bayName}
                                    {isInspecting && (
                                      <span className="text-[10px] text-blue-600 font-normal">(Editing)</span>
                                    )}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-slate-700">{b.bayType}</td>
                                <td className="px-3 py-3">
                                  <span
                                    className={`font-semibold ${
                                      b.bayStatus === 'Active' ? 'text-emerald-700' : 'text-slate-400'
                                    }`}
                                  >
                                    {b.bayStatus}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-slate-600 font-medium">{b.liftAvailability}</td>
                                <td className="px-3 py-3 text-slate-600">{b.floor}</td>
                                <td className="px-3 py-3">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                      b.approvalStatus === 'Approved'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : b.approvalStatus === 'Pending Approval'
                                        ? 'bg-amber-100 text-amber-800'
                                        : b.approvalStatus === 'Draft'
                                        ? 'bg-slate-100 text-slate-700'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {b.approvalStatus}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Selected Bay Inspection Form (editable draft, saved explicitly) */}
                  {bayDraft && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                          <span>Bay Inspection &amp; Hardware: {selectedBay.bayName}</span>
                          <span className="text-[11px] px-2 py-0.2 rounded bg-blue-100 text-blue-900 font-mono font-bold">
                            {bayDraft.dealerCode}
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500">
                          Physical bay parameters, 2-post/4-post lift setup, special tooling, and floor assignments.
                        </p>
                      </div>
                      <button
                        onClick={handleSaveBay}
                        disabled={JSON.stringify(bayDraft) === JSON.stringify(selectedBay)}
                        className="px-4 py-1.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Save Bay Setup
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <label className="text-slate-500 font-semibold block mb-1">Bay Name</label>
                        <input
                          type="text"
                          value={bayDraft.bayName}
                          onChange={(e) => setBayDraft({ ...bayDraft, bayName: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-bold focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 font-semibold block mb-1">Bay Classification</label>
                        <select
                          value={bayDraft.bayType}
                          onChange={(e) => setBayDraft({ ...bayDraft, bayType: e.target.value as BayRecord['bayType'] })}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-bold focus:border-blue-500 focus:outline-hidden"
                        >
                          {['Mechanical', 'Electrical', 'EV', 'Fleet', 'Speedo', 'AC', 'BodyShop'].map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-500 font-semibold block mb-1">Floor Level</label>
                        <select
                          value={bayDraft.floor}
                          onChange={(e) => setBayDraft({ ...bayDraft, floor: e.target.value as BayRecord['floor'] })}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-bold focus:border-blue-500 focus:outline-hidden"
                        >
                          {['Ground', 'Floor 1', 'Floor 2', 'Basement'].map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-500 font-semibold block mb-1">Lift Availability</label>
                        <select
                          value={bayDraft.liftAvailability}
                          onChange={(e) =>
                            setBayDraft({ ...bayDraft, liftAvailability: e.target.value as BayRecord['liftAvailability'] })
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-bold focus:border-blue-500 focus:outline-hidden"
                        >
                          {['No Lift', '2 post lift', '4 post lift'].map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-500 font-semibold block mb-1">Bay Status</label>
                        <select
                          value={bayDraft.bayStatus}
                          onChange={(e) => setBayDraft({ ...bayDraft, bayStatus: e.target.value as BayRecord['bayStatus'] })}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-bold focus:border-blue-500 focus:outline-hidden"
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-500 font-semibold block mb-1">Technical Supervisor</label>
                        <input
                          type="text"
                          value={bayDraft.techSupervisor}
                          onChange={(e) => setBayDraft({ ...bayDraft, techSupervisor: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-bold focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 font-semibold block mb-1">Technician 1</label>
                        <input
                          type="text"
                          value={bayDraft.tech1}
                          onChange={(e) => setBayDraft({ ...bayDraft, tech1: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-bold focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 font-semibold block mb-1">Technician 2</label>
                        <input
                          type="text"
                          value={bayDraft.tech2}
                          onChange={(e) => setBayDraft({ ...bayDraft, tech2: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-bold focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              );
            }

            // Case 2: Holiday Calendar Console
            if (currentMaster.id === 'holiday_calendar_master') {
              return (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        WEEKLY OPERATING PATTERN (7 DAYS)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Standard dealership operating hours and regular weekly off schedule.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                      {weeklyPattern.map((p) => (
                        <div
                          key={p.day}
                          className={`rounded-xl border p-3.5 space-y-3 transition-all ${
                            p.isWeekOff ? 'bg-rose-50/70 border-rose-200' : 'bg-white border-slate-200 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="font-bold text-xs text-slate-900">{p.day}</span>
                          </div>

                          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={p.isWeekOff}
                              onChange={() => handleToggleWeeklyOff(p.day)}
                              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                            />
                            <span>Week Off</span>
                          </label>

                          <div className="space-y-2 pt-1 text-xs">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-500 text-[11px]">Open</span>
                              <input
                                type="text"
                                disabled={p.isWeekOff}
                                value={p.open}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setWeeklyPattern(
                                    weeklyPattern.map((d) => (d.day === p.day ? { ...d, open: val } : d))
                                  );
                                }}
                                className={`w-20 px-2 py-1 text-xs rounded border text-center font-mono ${
                                  p.isWeekOff ? 'bg-rose-100/40 border-rose-200 text-rose-700 opacity-60' : 'bg-slate-50 border-slate-200'
                                }`}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-500 text-[11px]">Close</span>
                              <input
                                type="text"
                                disabled={p.isWeekOff}
                                value={p.close}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setWeeklyPattern(
                                    weeklyPattern.map((d) => (d.day === p.day ? { ...d, close: val } : d))
                                  );
                                }}
                                className={`w-20 px-2 py-1 text-xs rounded border text-center font-mono ${
                                  p.isWeekOff ? 'bg-rose-100/40 border-rose-200 text-rose-700 opacity-60' : 'bg-slate-50 border-slate-200'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          DATE-SPECIFIC HOLIDAYS &amp; OVERRIDES
                        </h3>
                        <p className="text-xs text-slate-500">
                          Festival closures, local state holidays, and workshop plant audit days.
                        </p>
                      </div>
                      <button
                        onClick={() => setHolidayDraft({ date: '', name: '', isClosed: true, hours: '09:00 - 13:00' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Date Override</span>
                      </button>
                    </div>

                    {holidayDraft && (
                      <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50/50 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
                          <input
                            type="date"
                            value={holidayDraft.date}
                            onChange={(e) => setHolidayDraft({ ...holidayDraft, date: e.target.value })}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                        <div className="flex-1 min-w-[180px]">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Occasion / Holiday Name</label>
                          <input
                            type="text"
                            value={holidayDraft.name}
                            placeholder="e.g. Diwali"
                            onChange={(e) => setHolidayDraft({ ...holidayDraft, name: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                        <label className="flex items-center gap-1.5 font-semibold text-slate-700 pb-1.5">
                          <input
                            type="checkbox"
                            checked={holidayDraft.isClosed}
                            onChange={(e) => setHolidayDraft({ ...holidayDraft, isClosed: e.target.checked })}
                          />
                          Full day closed
                        </label>
                        {!holidayDraft.isClosed && (
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Operating Hours</label>
                            <input
                              type="text"
                              value={holidayDraft.hours}
                              onChange={(e) => setHolidayDraft({ ...holidayDraft, hours: e.target.value })}
                              className="w-32 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                            />
                          </div>
                        )}
                        <button
                          onClick={handleAddHoliday}
                          className="px-3 py-1.5 rounded-lg bg-blue-900 text-white font-bold hover:bg-blue-800 cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setHolidayDraft(null)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                          <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Occasion / Holiday Name</th>
                            <th className="px-4 py-3">Classification</th>
                            <th className="px-4 py-3">Operating Hours</th>
                            <th className="px-4 py-3">Workshop Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dateHolidays.map((h) => (
                            <tr key={h.id} className="hover:bg-slate-50/70">
                              <td className="px-4 py-3 font-mono font-bold text-slate-900">{h.date}</td>
                              <td className="px-4 py-3 font-bold text-slate-800">{h.name}</td>
                              <td className="px-4 py-3 text-slate-600">{h.type}</td>
                              <td className="px-4 py-3 font-mono text-slate-700">{h.hours}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    h.isClosed ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {h.isClosed ? 'CLOSED (Full Day)' : 'HALF DAY OVERRIDE'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
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

            // Default Case: Enterprise Schema-Driven Table Editor
            return (
              <MasterTableEditor
                master={currentMaster}
                isAdminTml={adminRole === 'TML Admin'}
                onUpdateMaster={(updated) => {
                  updateMasterConfig(updated);
                }}
                onOpenChangeLog={() => setActiveMainTab('changelog')}
                onOpenDealerPreview={() => setActiveMainTab('dealer_preview')}
              />
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
