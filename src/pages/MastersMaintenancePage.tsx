import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { MASTER_COLLECTIONS, MasterConfig } from '../data/masterCatalogue';
import { ConfigurableMasterView } from '../components/administration/ConfigurableMasterView';
import { MasterTableEditor } from '../components/administration/MasterTableEditor';
import { MasterDataImportModal } from '../components/administration/MasterDataImportModal';
import {
  Building2,
  Wrench,
  Calendar,
  Clock,
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
} from 'lucide-react';
import { masterExportUtil } from '../utils/masterExportUtil';

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
  // Detailed specs matching Excel & HTML
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

export const MastersMaintenancePage: React.FC = () => {
  const { showToast, currentUser, logAudit } = useApp();

  // Top Scope: [Dealer Admin] vs [TML Admin] as shown in bay-management-master (1).html
  const [adminRole, setAdminRole] = useState<'Dealer Admin' | 'TML Admin'>('Dealer Admin');
  const [activeTab, setActiveTab] = useState<'bays' | 'calendar' | 'dealers' | 'timeslots' | 'catalogue'>('catalogue');

  // Configurable Master Collections State
  const [masterConfigs, setMasterConfigs] = useState<MasterConfig[]>(MASTER_COLLECTIONS);
  const [selectedMasterId, setSelectedMasterId] = useState<string>('pause_reasons');

  // Filters for Bay Management
  const [filterRegion, setFilterRegion] = useState('South');
  const [filterDealer, setFilterDealer] = useState('DLR1001 - Sample Motors Hyderabad');
  const [filterBayType, setFilterBayType] = useState('All');
  const [filterBayStatus, setFilterBayStatus] = useState('All');
  const [filterBayName, setFilterBayName] = useState('');
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('All');

  // Selected row checkboxes for Send for Approval
  const [selectedBayIds, setSelectedBayIds] = useState<string[]>([]);
  // Selected bay for detail inspection / editing in Bay Details section
  const [activeSelectedBayId, setActiveSelectedBayId] = useState<string>('BAY-01');
  const [isCreatingNewBay, setIsCreatingNewBay] = useState(false);

  // Bays Data (matching Image 1 Excel & Image 3 HTML)
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

  // Bay Import Modal State & Schema Adapter
  const [isBayImportModalOpen, setIsBayImportModalOpen] = useState(false);

  const bayMasterConfig: MasterConfig = useMemo(() => ({
    id: 'bay_management',
    name: 'Bay Management Master',
    owner: 'DEALER_ADMIN',
    category: 'Dealership Operations',
    description: 'Workshop floor service bay operational and capacity definitions.',
    fields: [
      { key: 'region', label: 'Region', type: 'select', options: ['South', 'North', 'West', 'East'], mandatory: true },
      { key: 'dealerCode', label: 'Dealer Code', type: 'text', mandatory: true },
      { key: 'dealerName', label: 'Dealer Name', type: 'text', mandatory: true },
      { key: 'bayName', label: 'Bay Name', type: 'text', mandatory: true },
      { key: 'bayType', label: 'Bay Type', type: 'select', options: ['Mechanical', 'Electrical', 'EV', 'Fleet', 'Speedo', 'AC', 'BodyShop'], mandatory: true },
      { key: 'floor', label: 'Floor', type: 'text', mandatory: true },
      { key: 'liftAvailability', label: 'Lift Availability', type: 'select', options: ['Available', 'Not Available', '2 post lift', 'No Lift'], mandatory: true },
      { key: 'bayStatus', label: 'Bay Status', type: 'select', options: ['Active', 'Inactive'], mandatory: true },
      { key: 'techSupervisor', label: 'Tech Supervisor', type: 'text', mandatory: false },
      { key: 'tech1', label: 'Technician 1', type: 'text', mandatory: false },
      { key: 'tech2', label: 'Technician 2', type: 'text', mandatory: false },
    ],
    records: bays,
  }), [bays]);

  const handleBayImportComplete = (importedRows: Array<Record<string, any>>) => {
    const newBays: BayRecord[] = importedRows.map((r, idx) => ({
      id: r.id || `BAY-${bays.length + idx + 10}`,
      no: bays.length + idx + 1,
      region: (r.region as any) || 'South',
      dealerCode: r.dealerCode || 'DLR1001',
      dealerName: r.dealerName || 'Sample Motors Hyderabad',
      bayName: r.bayName || `Bay ${bays.length + idx + 1}`,
      bayType: (r.bayType as any) || 'Mechanical',
      bayStatus: (r.bayStatus as any) || 'Active',
      inactiveFrom: '',
      inactiveTo: '',
      approvalStatus: 'Approved',
      floor: r.floor || 'Ground Floor',
      liftAvailability: (r.liftAvailability as any) || 'Available',
      specialEquipments: [],
      techSupervisor: r.techSupervisor || 'Suresh Kumar',
      tech1: r.tech1 || 'M. Rajesh',
      tech2: r.tech2 || 'P. Vinay',
    }));
    setBays([...newBays, ...bays]);
  };

  // Skill Matrix Table matching Image 1 Excel
  const skillMatrix = [
    { bayType: 'Mech', l0: 'n', l1: 'y', l2: 'y', electri: 'y', ac: 'y', diag: 'y' },
    { bayType: 'Elec', l0: 'n', l1: 'y', l2: 'y', electri: 'y', ac: 'n', diag: 'y' },
    { bayType: 'EV', l0: 'n', l1: 'n', l2: 'y', electri: 'y', ac: 'n', diag: 'y' },
    { bayType: 'Fleet', l0: 'y', l1: 'y', l2: 'y', electri: 'n', ac: 'n', diag: 'n' },
    { bayType: 'Speedo', l0: 'y', l1: 'y', l2: 'n', electri: 'n', ac: 'n', diag: 'n' },
    { bayType: 'AC', l0: 'a', l1: 'y', l2: 'a', electri: 'n', ac: 'y', diag: 'y' },
  ];

  // Holiday Calendar State (Image 2)
  const [selectedDivision, setSelectedDivision] = useState('Rudra Motors — South');
  const [selectedMonth, setSelectedMonth] = useState('September 2026');

  // Weekly Pattern 7 Days
  const [weeklyPattern, setWeeklyPattern] = useState([
    { day: 'Monday', isWeekOff: false, open: '09:00', close: '19:00' },
    { day: 'Tuesday', isWeekOff: false, open: '09:00', close: '19:00' },
    { day: 'Wednesday', isWeekOff: false, open: '09:00', close: '19:00' },
    { day: 'Thursday', isWeekOff: false, open: '09:00', close: '19:00' },
    { day: 'Friday', isWeekOff: false, open: '09:00', close: '19:00' },
    { day: 'Saturday', isWeekOff: false, open: '09:00', close: '19:00' },
    { day: 'Sunday', isWeekOff: true, open: '09:00', close: '13:00' },
  ]);

  // Date Specific Holidays
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

  // Filtered Bays
  const filteredBays = bays.filter((b) => {
    if (filterRegion !== 'All' && b.region !== filterRegion) return false;
    if (filterBayType !== 'All' && b.bayType !== filterBayType) return false;
    if (filterBayStatus !== 'All' && b.bayStatus !== filterBayStatus) return false;
    if (filterApprovalStatus !== 'All' && b.approvalStatus !== filterApprovalStatus) return false;
    if (filterBayName.trim() && !b.bayName.toLowerCase().includes(filterBayName.toLowerCase())) return false;
    return true;
  });

  const selectedBay = bays.find((b) => b.id === activeSelectedBayId) || bays[0];

  const handleToggleSelectBay = (id: string, approvalStatus: string) => {
    // Only Draft and Rejected bays can be selected (per rule in image 3)
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

  const handleSendForApproval = () => {
    if (selectedBayIds.length === 0) return;
    setBays(
      bays.map((b) =>
        selectedBayIds.includes(b.id)
          ? { ...b, approvalStatus: 'Pending Approval' }
          : b
      )
    );
    showToast(`Sent ${selectedBayIds.length} bay(s) for TML Admin approval!`, 'success');
    setSelectedBayIds([]);
  };

  const handleToggleWeeklyOff = (dayName: string) => {
    setWeeklyPattern(
      weeklyPattern.map((d) => (d.day === dayName ? { ...d, isWeekOff: !d.isWeekOff } : d))
    );
  };

  return (
    <div className="space-y-5 text-slate-800">
      {/* Top Header Strip matching HTML spec */}
      <div className="bg-[#002B49] text-white px-5 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm border border-[#003B66]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm tracking-wider bg-white/10 px-2.5 py-1 rounded-md border border-white/20">
              TATA MOTORS
            </span>
            <span className="text-xs text-blue-200 italic font-medium">sWorkshop</span>
          </div>
          <div className="h-4 w-px bg-blue-300/30" />
          <div className="flex items-center gap-1.5 bg-blue-900/60 px-2.5 py-1 rounded-lg border border-blue-400/30 text-xs font-bold">
            {activeTab === 'bays' && <span>Bay Management</span>}
            {activeTab === 'calendar' && <span>Holiday Calendar</span>}
            {activeTab === 'dealers' && <span>Dealer Network</span>}
            {activeTab === 'timeslots' && <span>Time Slot Quotas</span>}
          </div>
        </div>

        {/* Dual Admin Toggle: [Dealer Admin] [TML Admin] as in image 3 */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-950/90 p-1 rounded-lg border border-blue-400/40 flex items-center shadow-inner">
            <button
              onClick={() => {
                setAdminRole('Dealer Admin');
                showToast('Switched context to Dealer Admin view', 'info');
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
                showToast('Switched context to TML Central Admin (Pan-India)', 'info');
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

          {/* Notification Icon with Badge */}
          <div className="relative cursor-pointer p-1.5 rounded-lg bg-blue-900/40 border border-blue-400/30 hover:bg-blue-800">
            <Bell className="h-4 w-4 text-blue-200" />
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
              1
            </span>
          </div>

          {/* Active Dealer Badge */}
          <div className="flex items-center gap-2 text-xs bg-blue-900/50 px-3 py-1.5 rounded-lg border border-blue-400/30">
            <div className="h-6 w-6 rounded-full bg-blue-700 flex items-center justify-center text-[10px] font-bold">
              <User className="h-3.5 w-3.5 text-blue-100" />
            </div>
            <div>
              <div className="font-semibold text-white leading-tight">
                {adminRole === 'Dealer Admin' ? 'DLR1001 - Sample Motors Hyderabad' : 'Tata Motors HQ (Pan-India)'}
              </div>
              <div className="text-[10px] text-blue-300">
                {adminRole === 'Dealer Admin' ? 'Dealer Service Admin' : 'Super Administrator'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Masters Navigation Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('catalogue')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'catalogue'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Database className="h-3.5 w-3.5 text-blue-300" />
            <span>Enterprise Masters (OEM &amp; Dealer)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-700/60 text-white font-mono font-bold">
              10 Masters
            </span>
          </button>

          <button
            onClick={() => setActiveTab('bays')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'bays'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>Bay Management Master</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Non-Operational Hours &amp; Holiday Calendar</span>
          </button>

          <button
            onClick={() => setActiveTab('dealers')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dealers'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Dealer Details Master</span>
          </button>

          <button
            onClick={() => setActiveTab('timeslots')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'timeslots'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Time Slot Quotas</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
          <span>Masters</span>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="font-semibold text-slate-800">
            {activeTab === 'catalogue' && 'Enterprise Process Masters (OEM & Dealer)'}
            {activeTab === 'bays' && 'Bay Management & Skill Matrix'}
            {activeTab === 'calendar' && 'Non-Operational Hours & Holiday Calendar'}
            {activeTab === 'dealers' && 'PAN India Dealer Registry'}
            {activeTab === 'timeslots' && 'Intake Time Slots'}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 0: ENTERPRISE PROCESS MASTERS (OEM & DEALERSHIP OWNERSHIP)            */}
      {/* ========================================================================= */}
      {activeTab === 'catalogue' && (
        <div className="space-y-4">
          {/* Master Selector Bar grouped by OEM vs Dealership Ownership */}
          <div className="bg-slate-50/90 p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-blue-700" />
                <span>Enterprise Masters Directory ({masterConfigs.length} Standard Masters)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Click any master to manage records, configure custom BU fields, or export CSV
              </span>
            </div>

            {/* Masters Buttons Grouped */}
            <div className="space-y-2">
              {/* Group 1: OEM Owned */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900">
                    Tata Motors OEM Admin Masters (Central Standard Governance):
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {masterConfigs
                    .filter((m) => m.owner === 'TML_ADMIN')
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMasterId(m.id)}
                        className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          selectedMasterId === m.id
                            ? 'bg-blue-900 text-white shadow-xs font-bold'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        <span>{m.name}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                            selectedMasterId === m.id
                              ? 'bg-blue-800 text-blue-100'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {m.records.length}
                        </span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Group 2: Dealership Owned */}
              <div className="pt-1.5 border-t border-slate-200/60">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                    Dealership Service Admin Masters (Workshop Floor Management):
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {masterConfigs
                    .filter((m) => m.owner === 'DEALER_ADMIN')
                    .map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMasterId(m.id)}
                        className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          selectedMasterId === m.id
                            ? 'bg-emerald-800 text-white shadow-xs font-bold'
                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        <span>{m.name}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                            selectedMasterId === m.id
                              ? 'bg-emerald-900 text-emerald-100'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {m.records.length}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* MasterTableEditor: Dynamic CRUD & Schema-driven Form Generator */}
          {(() => {
            const currentMaster =
              masterConfigs.find((m) => m.id === selectedMasterId) || masterConfigs[0];
            return (
              <MasterTableEditor
                master={currentMaster}
                isAdminTml={adminRole === 'TML Admin'}
                onUpdateMaster={(updated) => {
                  setMasterConfigs(
                    masterConfigs.map((m) => (m.id === updated.id ? updated : m))
                  );
                }}
              />
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: BAY MANAGEMENT MASTER (Matches image 1 & image 3 exactly)          */}
      {/* ========================================================================= */}
      {activeTab === 'bays' && (
        <div className="space-y-5">
          {/* Filter Bar (exact fields from bay-management-master (1).html) */}
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
                  <option value="DLR1001 - Sample Motors Hyderabad">DLR1001 - Sample Motors Hyderabad</option>
                  <option value="DLR1002 - Rudra Motors South">DLR1002 - Rudra Motors South</option>
                  <option value="DLR1003 - Concorde Motors Mumbai">DLR1003 - Concorde Motors Mumbai</option>
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

          {/* Bays Table Card matching bay-management-master (1).html */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="flex flex-wrap items-center justify-between p-4 border-b border-slate-200 gap-3">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Bays</h2>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsCreatingNewBay(true);
                    showToast('Ready to configure new bay below', 'info');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-blue-600" />
                  <span>+ New Bay</span>
                </button>

                <button
                  onClick={() => {
                    masterExportUtil.exportToExcel({
                      masterName: 'Bay Management Master',
                      category: 'Dealership Operations',
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
                    logAudit(
                      'Master Data Exported',
                      'Masters Maintenance',
                      'Bay Management Master (Excel Export)',
                      'Active Filtered Bays',
                      `Exported ${filteredBays.length} bay records to Excel`,
                      'SUCCESS'
                    );
                    showToast(`Exported ${filteredBays.length} bays to Excel (.xls/.xlsx)`, 'success');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
                  title="Export filtered bays to Microsoft Excel"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Export to Excel</span>
                </button>

                <button
                  onClick={() => setIsBayImportModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
                  title="Bulk upload workshop bays via Excel or CSV"
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
                  <span>Send for Approval {selectedBayIds.length > 0 ? `(${selectedBayIds.length})` : ''}</span>
                </button>
              </div>
            </div>

            {/* Table */}
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
                    <th className="px-3 py-3">Inactive From</th>
                    <th className="px-3 py-3">Inactive To</th>
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
                        <td className="px-3 py-3 font-mono text-slate-500">{b.inactiveFrom || '—'}</td>
                        <td className="px-3 py-3 font-mono text-slate-500">{b.inactiveTo || '—'}</td>
                        <td className="px-3 py-3">
                          {b.approvalStatus === 'Approved' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                              Approved
                            </span>
                          )}
                          {b.approvalStatus === 'Pending Approval' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                              Pending Approval
                            </span>
                          )}
                          {b.approvalStatus === 'Draft' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                              Draft
                            </span>
                          )}
                          {b.approvalStatus === 'Rejected' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                              Rejected
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
              <span className="italic">Only Draft and Rejected bays can be selected.</span>
              <span className="font-mono font-medium">{filteredBays.length} records</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BAY DETAILS FORM & TECHNICIAN SKILL MATRIX (Matches Image 1 Excel spec) */}
          {/* ========================================================================= */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Bay Details: {selectedBay.bayName}</span>
                  <span className="text-[11px] px-2 py-0.2 rounded bg-blue-100 text-blue-900 font-mono font-bold">
                    {selectedBay.dealerCode}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Configure physical equipment, hydraulic lifts, technician supervisor, and bay-to-skill eligibility matrix.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => showToast(`Saved changes for ${selectedBay.bayName}`, 'success')}
                  className="px-4 py-1.5 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer"
                >
                  Save Bay Configuration
                </button>
              </div>
            </div>

            {/* Excel Row 1-4 fields: Floor, Lift availability, Special equipments */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Floor <span className="text-amber-600 font-normal">(e.g. Floor 1)</span>
                </label>
                <select
                  value={selectedBay.floor}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setBays(bays.map((b) => (b.id === selectedBay.id ? { ...b, floor: val } : b)));
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-hidden"
                >
                  <option value="Floor 1">Floor 1</option>
                  <option value="Floor 2">Floor 2</option>
                  <option value="Ground">Ground Floor</option>
                  <option value="Basement">Basement Workshop</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Lift Availability <span className="text-amber-600 font-normal">(No Lift / 2 post / 4 post)</span>
                </label>
                <select
                  value={selectedBay.liftAvailability}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setBays(bays.map((b) => (b.id === selectedBay.id ? { ...b, liftAvailability: val } : b)));
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-hidden"
                >
                  <option value="No Lift">No Lift</option>
                  <option value="2 post lift">2 post lift</option>
                  <option value="4 post lift">4 post lift</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Special Equipments <span className="text-amber-600 font-normal">(Nut Runner, EV Charger, etc.)</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {['Nut Runner', 'EV Charger', 'Brake rivet machine', 'Oil Dispensing Unit'].map((eq) => {
                    const hasEq = selectedBay.specialEquipments.includes(eq);
                    return (
                      <button
                        key={eq}
                        type="button"
                        onClick={() => {
                          const updated = hasEq
                            ? selectedBay.specialEquipments.filter((x) => x !== eq)
                            : [...selectedBay.specialEquipments, eq];
                          setBays(bays.map((b) => (b.id === selectedBay.id ? { ...b, specialEquipments: updated } : b)));
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                          hasEq
                            ? 'bg-blue-100 text-blue-900 border-blue-300 font-bold'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {hasEq ? '✓ ' : '+ '} {eq}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Excel Row: Bay ID, Bay Name, Bay type, Tech Sup, Tech 1, Tech 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Bay Type</label>
                <select
                  value={selectedBay.bayType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setBays(bays.map((b) => (b.id === selectedBay.id ? { ...b, bayType: val } : b)));
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium focus:outline-hidden"
                >
                  <option value="Mechanical">Mechanical (Mech)</option>
                  <option value="Electrical">Electrical (Elec)</option>
                  <option value="EV">Electric Vehicle (EV)</option>
                  <option value="Fleet">Fleet</option>
                  <option value="Speedo">Speedo Express</option>
                  <option value="AC">Air Conditioning (AC)</option>
                  <option value="BodyShop">BodyShop</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Tech Sup (Supervisor)</label>
                <input
                  type="text"
                  value={selectedBay.techSupervisor}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBays(bays.map((b) => (b.id === selectedBay.id ? { ...b, techSupervisor: val } : b)));
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-900 focus:outline-hidden"
                  placeholder="e.g. Ram / Madhu"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Tech 1 (Primary Technician)</label>
                <input
                  type="text"
                  value={selectedBay.tech1}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBays(bays.map((b) => (b.id === selectedBay.id ? { ...b, tech1: val } : b)));
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-blue-900 focus:outline-hidden"
                  placeholder="e.g. Shyam"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Tech 2 (Secondary Technician)</label>
                <input
                  type="text"
                  value={selectedBay.tech2}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBays(bays.map((b) => (b.id === selectedBay.id ? { ...b, tech2: val } : b)));
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-900 focus:outline-hidden"
                  placeholder="e.g. Rohit"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Bay Operational Status</label>
                <select
                  value={selectedBay.bayStatus}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setBays(bays.map((b) => (b.id === selectedBay.id ? { ...b, bayStatus: val } : b)));
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-900 focus:outline-hidden"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Technician Skill Matrix Table (Matching Excel image 1) */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-blue-600" />
                    <span>Technician Skill Eligibility Matrix by Bay Type</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Defines technician certification levels required to work in each specialized bay type.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">y = Allowed</span>
                  <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">n = Prohibited</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">a = Alternate</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-center text-xs">
                  <thead className="bg-[#002B49] text-white font-bold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Bay Type</th>
                      <th className="px-4 py-2.5">L0 (Apprentice)</th>
                      <th className="px-4 py-2.5">L1 (Certified Tech)</th>
                      <th className="px-4 py-2.5">L2 (Master Tech)</th>
                      <th className="px-4 py-2.5">Electri (Electrical)</th>
                      <th className="px-4 py-2.5">AC (Air Conditioning)</th>
                      <th className="px-4 py-2.5">Diag. (Diagnostic Expert)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {skillMatrix.map((row) => {
                      const isRowActive = selectedBay.bayType.toLowerCase().startsWith(row.bayType.toLowerCase());

                      const renderPill = (val: string) => {
                        if (val === 'y') {
                          return <span className="inline-block px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px] bg-emerald-100 text-emerald-800">y</span>;
                        }
                        if (val === 'n') {
                          return <span className="inline-block px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px] bg-rose-100 text-rose-800">n</span>;
                        }
                        return <span className="inline-block px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px] bg-amber-100 text-amber-800">a</span>;
                      };

                      return (
                        <tr
                          key={row.bayType}
                          className={`transition-colors ${isRowActive ? 'bg-blue-50 font-bold' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-4 py-2 text-left font-bold text-slate-800">
                            {row.bayType}
                            {isRowActive && <span className="text-[10px] text-blue-600 ml-1.5">(Current Bay)</span>}
                          </td>
                          <td className="px-4 py-2">{renderPill(row.l0)}</td>
                          <td className="px-4 py-2">{renderPill(row.l1)}</td>
                          <td className="px-4 py-2">{renderPill(row.l2)}</td>
                          <td className="px-4 py-2">{renderPill(row.electri)}</td>
                          <td className="px-4 py-2">{renderPill(row.ac)}</td>
                          <td className="px-4 py-2">{renderPill(row.diag)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: NON-OPERATIONAL HOURS & HOLIDAY CALENDAR (Matches image 2 exactly) */}
      {/* ========================================================================= */}
      {activeTab === 'calendar' && (
        <div className="space-y-5">
          {/* Header Title as in image 2 */}
          <div className="space-y-1">
            <h2 className="text-xl font-black tracking-tight text-slate-900">
              Non-Operational Hours &amp; Holiday Calendar
            </h2>
          </div>

          {/* SCOPE Card matching image 2 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              SCOPE
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-[240px]">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    DIVISION *
                  </label>
                  <select
                    value={selectedDivision}
                    onChange={(e) => setSelectedDivision(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-hidden"
                  >
                    <option value="Rudra Motors — South">Rudra Motors — South</option>
                    <option value="Sample Motors — Hyderabad">Sample Motors — Hyderabad</option>
                    <option value="Concorde Motors — Mumbai">Concorde Motors — Mumbai</option>
                    <option value="Arya Motors — New Delhi">Arya Motors — New Delhi</option>
                  </select>
                </div>

                <div className="min-w-[180px]">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    MONTH *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-hidden"
                    />
                    <Calendar className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <button
                  onClick={() => showToast(`Calendar loaded for ${selectedDivision} (${selectedMonth})`, 'success')}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Load Calendar
                </button>
              </div>

              {/* Legend on right */}
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs border border-rose-400 bg-rose-100" />
                  <span>Holiday</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs border border-slate-300 bg-slate-100" />
                  <span>Weekend (per weekly pattern)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs border border-slate-300 bg-slate-200" />
                  <span>Past date (locked)</span>
                </span>
              </div>
            </div>
          </div>

          {/* WEEKLY OPERATING PATTERN Card (7 days cards, image 2) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                WEEKLY OPERATING PATTERN
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Applies to every date in this Division unless a specific date below overrides it
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {weeklyPattern.map((p) => (
                <div
                  key={p.day}
                  className={`rounded-xl border p-3.5 space-y-3 transition-all ${
                    p.isWeekOff
                      ? 'bg-rose-50/70 border-rose-200'
                      : 'bg-white border-slate-200 shadow-2xs'
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
                      <div className="relative">
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
                            p.isWeekOff
                              ? 'bg-rose-100/40 border-rose-200 text-rose-700 opacity-60'
                              : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        />
                        <Clock className="absolute right-1.5 top-1.5 h-3 w-3 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <span className="text-slate-500 text-[11px]">Close</span>
                      <div className="relative">
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
                            p.isWeekOff
                              ? 'bg-rose-100/40 border-rose-200 text-rose-700 opacity-60'
                              : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        />
                        <Clock className="absolute right-1.5 top-1.5 h-3 w-3 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DATE-SPECIFIC HOLIDAYS & OVERRIDES Card (image 2 bottom) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  DATE-SPECIFIC HOLIDAYS &amp; OVERRIDES — {selectedMonth.toUpperCase()}
                </h3>
                <p className="text-xs text-slate-500">
                  Overrides weekly pattern for festivals, state holidays, or audit maintenance days.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600 font-mono">
                  {dateHolidays.length} holiday(s) set this month
                </span>
                <button
                  onClick={() => showToast('Opening Add Holiday Modal...', 'info')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Date Override</span>
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Occasion / Holiday Name</th>
                    <th className="px-4 py-3">Classification</th>
                    <th className="px-4 py-3">Operating Hours</th>
                    <th className="px-4 py-3">Workshop Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dateHolidays.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{h.date}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{h.name}</td>
                      <td className="px-4 py-3 text-slate-600">{h.type}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{h.hours}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            h.isClosed
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {h.isClosed ? 'CLOSED (Full Day)' : 'HALF DAY OVERRIDE'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => showToast(`Edit override: ${h.name}`, 'info')}
                          className="p-1 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer mr-2"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setDateHolidays(dateHolidays.filter((x) => x.id !== h.id));
                            showToast(`Removed override: ${h.name}`, 'info');
                          }}
                          className="p-1 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DEALER DETAILS (PAN-INDIA OEM ADMIN)                                */}
      {/* ========================================================================= */}
      {activeTab === 'dealers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="font-bold text-slate-900">
                Tata Motors Central Dealership Registry
              </span>
              <p className="text-[11px] text-slate-500">
                Manage authorized workshop facilities, dealer codes, and zone allocations for all PAN India dealers.
              </p>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">582 Dealers Managed</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Dealer Code</th>
                  <th className="px-4 py-3">Dealership &amp; Workshop</th>
                  <th className="px-4 py-3">Location &amp; Zone</th>
                  <th className="px-4 py-3">Facility Type</th>
                  <th className="px-4 py-3">Workshop Bays</th>
                  <th className="px-4 py-3">Service Head</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  {
                    code: 'DLR1001',
                    name: 'Sample Motors Hyderabad',
                    branch: 'Hitec City Service Hub',
                    city: 'Hyderabad',
                    state: 'Telangana',
                    zone: 'South',
                    type: '3S Integrated + EV Certified',
                    bays: '9 Active / 10 Total',
                    head: 'Srinivas Murthy',
                    phone: '+91 98480 22341',
                    status: 'Active',
                  },
                  {
                    code: 'DLR1002',
                    name: 'Rudra Motors South',
                    branch: 'Electronic City Phase 1',
                    city: 'Bengaluru',
                    state: 'Karnataka',
                    zone: 'South',
                    type: '3S Integrated',
                    bays: '18 Active / 20 Total',
                    head: 'C. Ramanathan',
                    phone: '+91 98450 77123',
                    status: 'Active',
                  },
                  {
                    code: 'DLR1003',
                    name: 'Concorde Motors Mumbai',
                    branch: 'Worli Central Workshop',
                    city: 'Mumbai',
                    state: 'Maharashtra',
                    zone: 'West',
                    type: '3S Integrated + EV High-Voltage',
                    bays: '22 Active / 24 Total',
                    head: 'Vikramaditya Shinde',
                    phone: '+91 98201 44521',
                    status: 'Active',
                  },
                ].map((d) => (
                  <tr key={d.code} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-900">{d.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{d.name}</div>
                      <div className="text-[11px] text-slate-500">{d.branch}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{d.city}, {d.state}</div>
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
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => showToast(`Edit dealer ${d.code}`, 'info')}
                        className="p-1 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TIME SLOT QUOTAS                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'timeslots' && (
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
            {[
              { slot: '09:00 AM - 10:00 AM', cap: 12, booked: 12, buffer: 3, bays: 8, status: 'FULLY BOOKED' },
              { slot: '10:00 AM - 11:00 AM', cap: 14, booked: 13, buffer: 4, bays: 9, status: 'HIGH DEMAND' },
              { slot: '11:00 AM - 12:00 PM', cap: 12, booked: 9, buffer: 3, bays: 8, status: 'AVAILABLE' },
              { slot: '12:00 PM - 01:00 PM', cap: 10, booked: 6, buffer: 2, bays: 7, status: 'AVAILABLE' },
              { slot: '02:00 PM - 03:00 PM', cap: 10, booked: 8, buffer: 2, bays: 7, status: 'AVAILABLE' },
              { slot: '03:00 PM - 04:00 PM', cap: 8, booked: 5, buffer: 2, bays: 6, status: 'AVAILABLE' },
              { slot: '04:00 PM - 05:00 PM', cap: 8, booked: 4, buffer: 2, bays: 6, status: 'AVAILABLE' },
              { slot: '05:00 PM - 06:30 PM', cap: 6, booked: 5, buffer: 2, bays: 5, status: 'HIGH DEMAND' },
            ].map((s) => (
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
      )}
      {/* Bulk Import Modal for Bay Management */}
      <MasterDataImportModal
        isOpen={isBayImportModalOpen}
        onClose={() => setIsBayImportModalOpen(false)}
        master={bayMasterConfig}
        onImportComplete={(imported) => handleBayImportComplete(imported)}
      />
    </div>
  );
};
