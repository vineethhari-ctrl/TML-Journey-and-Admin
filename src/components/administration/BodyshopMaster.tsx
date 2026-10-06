import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Wrench,
  Building2,
  Users,
  ShieldAlert,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Zap,
  Check,
  X,
  Layers,
  ChevronRight,
  Shield,
  Gauge,
  Thermometer,
  Car,
  Settings,
  Flame,
  Award,
  Phone,
  Clock,
  Calendar,
  Paintbrush,
} from 'lucide-react';

// =========================================================================
// DATA INTERFACES
// =========================================================================

export interface BodyshopFacility {
  id: string;
  facilityCode: string;
  dealerId: string;
  dealerName: string;
  divisionName: string;
  bu: 'PV' | 'EV' | 'CV';
  totalBays: number;
  dentingStalls: number;
  paintBooths: number;
  prepBays: number;
  chassisJigs: number;
  maxSimultaneousRepairs: number;
  monthlyTargetThroughput: number;
  supervisorName: string;
  contactPhone: string;
  status: 'Active' | 'Maintenance' | 'Capacity Constrained';
  lastAuditDate: string;
}

export interface SpecializedTool {
  id: string;
  facilityId: string;
  toolCode: string;
  toolName: string;
  category:
    | 'Chassis & Frame Alignment'
    | 'Spray Booth & Curing'
    | 'Welding & Dent Pulling'
    | 'Coating & Diagnostics'
    | 'Aluminum Structural Repair';
  manufacturerModel: string;
  serialNumber: string;
  bayAssigned: string;
  calibrationFrequencyMonths: number;
  lastCalibratedDate: string;
  nextCalibrationDue: string;
  leadTechAssigned: string;
  conditionStatus: 'Operational' | 'Calibration Due' | 'Under Repair' | 'Standby';
  safetyCertification: string;
}

export interface LeadTechnician {
  id: string;
  facilityId: string;
  empCode: string;
  name: string;
  role:
    | 'Master Painter'
    | 'Chassis & Frame Alignment Lead'
    | 'Senior Panel Beater'
    | 'Paint Prep Specialist'
    | 'Bodyshop Estimator / Surveyor'
    | 'Bodyshop Floor Supervisor';
  certificationLevel:
    | 'Tata Gold Master Bodyshop'
    | 'Tata Silver Bodyshop Tech'
    | 'EV High-Voltage Bodyshop Certified'
    | 'Axalta/PPG Paint Master';
  shift: 'Morning (08:00 - 17:00)' | 'General (09:30 - 18:30)' | 'Evening (14:00 - 22:30)';
  bayAssigned: string;
  experienceYears: number;
  activeJobsCount: number;
  phone: string;
  status: 'On Duty' | 'In Bay' | 'On Leave';
}

// =========================================================================
// DEFAULT SEED DATA (ALIGNED WITH TATA MOTORS WORKSHOPS & USER'S EXCEL SPECS)
// =========================================================================

const SEED_FACILITIES: BodyshopFacility[] = [
  {
    id: 'BF-01',
    facilityCode: 'BS-HYD-01',
    dealerId: 'DLR-1001',
    dealerName: 'Sample Motors Hyderabad',
    divisionName: 'D1 - South Main Workshop (Basement Bodyshop Complex)',
    bu: 'PV',
    totalBays: 8,
    dentingStalls: 4,
    paintBooths: 2,
    prepBays: 2,
    chassisJigs: 1,
    maxSimultaneousRepairs: 14,
    monthlyTargetThroughput: 110,
    supervisorName: 'Ramachandran M',
    contactPhone: '+91 98490 28471',
    status: 'Active',
    lastAuditDate: '2026-09-15',
  },
  {
    id: 'BF-02',
    facilityCode: 'BS-HYD-02',
    dealerId: 'DLR-1001',
    dealerName: 'Sample Motors Hyderabad',
    divisionName: 'D2 - Express Hub Bodyshop Annex',
    bu: 'PV',
    totalBays: 6,
    dentingStalls: 3,
    paintBooths: 1,
    prepBays: 1,
    chassisJigs: 1,
    maxSimultaneousRepairs: 10,
    monthlyTargetThroughput: 80,
    supervisorName: 'K. S. Narayanan',
    contactPhone: '+91 94401 92831',
    status: 'Active',
    lastAuditDate: '2026-08-20',
  },
  {
    id: 'BF-03',
    facilityCode: 'BS-MUM-01',
    dealerId: 'DLR-MUM-01',
    dealerName: 'Fortune Cars Worli',
    divisionName: 'Central Mumbai Crash Repair Center',
    bu: 'EV',
    totalBays: 12,
    dentingStalls: 6,
    paintBooths: 3,
    prepBays: 2,
    chassisJigs: 2,
    maxSimultaneousRepairs: 22,
    monthlyTargetThroughput: 160,
    supervisorName: 'Vinod Shinde',
    contactPhone: '+91 98200 48291',
    status: 'Active',
    lastAuditDate: '2026-09-28',
  },
];

const SEED_TOOLS: SpecializedTool[] = [
  {
    id: 'TOOL-01',
    facilityId: 'BF-01',
    toolCode: 'BS-JIG-01',
    toolName: 'Car-O-Liner BenchRack Hydraulic Frame Straightener',
    category: 'Chassis & Frame Alignment',
    manufacturerModel: 'Car-O-Liner BenchRack 5500 with Vision X3 Measuring',
    serialNumber: 'COL-5500-HYD-2024-089',
    bayAssigned: 'Bay 09 (Denting & Frame Alignment)',
    calibrationFrequencyMonths: 6,
    lastCalibratedDate: '2026-08-10',
    nextCalibrationDue: '2027-02-10',
    leadTechAssigned: 'Ram (Chassis Master)',
    conditionStatus: 'Operational',
    safetyCertification: 'TML-STRUCTURAL-CERT-2026',
  },
  {
    id: 'TOOL-02',
    facilityId: 'BF-01',
    toolCode: 'BS-OVEN-01',
    toolName: 'Blowtherm Extra Downdraft Heated Paint Spray Booth',
    category: 'Spray Booth & Curing',
    manufacturerModel: 'Blowtherm Extra 7000 / 60°C Gas Burner Cycle',
    serialNumber: 'BLW-7000-2023-1124',
    bayAssigned: 'Paint Booth 01',
    calibrationFrequencyMonths: 3,
    lastCalibratedDate: '2026-09-01',
    nextCalibrationDue: '2026-12-01',
    leadTechAssigned: 'Premchand (Paint Specialist)',
    conditionStatus: 'Operational',
    safetyCertification: 'POLLUTION-CONTROL-GREEN-PASS',
  },
  {
    id: 'TOOL-03',
    facilityId: 'BF-01',
    toolCode: 'BS-SPOT-01',
    toolName: 'Wieländer+Schill Inverter Resistance Spot Welder',
    category: 'Welding & Dent Pulling',
    manufacturerModel: 'Wieländer InvertaSpot GT 14,000A (Ultra High Strength Steel)',
    serialNumber: 'WS-GT14-2025-044',
    bayAssigned: 'Bay 08 (Body Prep & Panel Assembly)',
    calibrationFrequencyMonths: 12,
    lastCalibratedDate: '2026-05-15',
    nextCalibrationDue: '2027-05-15',
    leadTechAssigned: 'Farhan Ali (Welding Lead)',
    conditionStatus: 'Operational',
    safetyCertification: 'TATA-UHSS-BORON-WELD-PASS',
  },
  {
    id: 'TOOL-04',
    facilityId: 'BF-01',
    toolCode: 'BS-CUR-01',
    toolName: 'IRT Hyperion Shortwave Infrared Curing Lamp',
    category: 'Coating & Diagnostics',
    manufacturerModel: 'IRT 4-2 PcAuto Temperature-Controlled IR Dryer',
    serialNumber: 'IRT-PC4-2024-883',
    bayAssigned: 'Bay 08 (Paint Prep 01)',
    calibrationFrequencyMonths: 6,
    lastCalibratedDate: '2026-04-10',
    nextCalibrationDue: '2026-10-10',
    leadTechAssigned: 'Premchand (Paint Specialist)',
    conditionStatus: 'Calibration Due',
    safetyCertification: 'CE-THERMAL-SAFETY-2025',
  },
  {
    id: 'TOOL-05',
    facilityId: 'BF-01',
    toolCode: 'BS-ALU-01',
    toolName: 'Dedicated Aluminum Dent Repair Workstation with Isolation Curtain',
    category: 'Aluminum Structural Repair',
    manufacturerModel: 'GYS Proliner ALU Pro Station with Stud Welder',
    serialNumber: 'GYS-ALU-2025-102',
    bayAssigned: 'Bay 10 (Specialty Denting)',
    calibrationFrequencyMonths: 12,
    lastCalibratedDate: '2026-06-20',
    nextCalibrationDue: '2027-06-20',
    leadTechAssigned: 'Sanjay Rawat (Aluminum Panel Master)',
    conditionStatus: 'Operational',
    safetyCertification: 'ANTI-CORROSION-ISOLATION-COMPLIANT',
  },
];

const SEED_TECHNICIANS: LeadTechnician[] = [
  {
    id: 'TECH-01',
    facilityId: 'BF-01',
    empCode: 'TML-BS-101',
    name: 'Ramachandran M (Ram)',
    role: 'Chassis & Frame Alignment Lead',
    certificationLevel: 'Tata Gold Master Bodyshop',
    shift: 'General (09:30 - 18:30)',
    bayAssigned: 'Bay 09 (Denting 01)',
    experienceYears: 16,
    activeJobsCount: 2,
    phone: '+91 98490 11928',
    status: 'In Bay',
  },
  {
    id: 'TECH-02',
    facilityId: 'BF-01',
    empCode: 'TML-BS-102',
    name: 'Premchand S',
    role: 'Master Painter',
    certificationLevel: 'Axalta/PPG Paint Master',
    shift: 'Morning (08:00 - 17:00)',
    bayAssigned: 'Paint Booth 01',
    experienceYears: 12,
    activeJobsCount: 3,
    phone: '+91 98491 88392',
    status: 'In Bay',
  },
  {
    id: 'TECH-03',
    facilityId: 'BF-01',
    empCode: 'TML-BS-103',
    name: 'Farhan Ali',
    role: 'Senior Panel Beater',
    certificationLevel: 'EV High-Voltage Bodyshop Certified',
    shift: 'General (09:30 - 18:30)',
    bayAssigned: 'Bay 08 (Body Prep 01)',
    experienceYears: 9,
    activeJobsCount: 1,
    phone: '+91 97001 44521',
    status: 'On Duty',
  },
  {
    id: 'TECH-04',
    facilityId: 'BF-01',
    empCode: 'TML-BS-104',
    name: 'Sanjay Rawat',
    role: 'Senior Panel Beater',
    certificationLevel: 'Tata Silver Bodyshop Tech',
    shift: 'Evening (14:00 - 22:30)',
    bayAssigned: 'Bay 10 (Specialty Denting)',
    experienceYears: 8,
    activeJobsCount: 2,
    phone: '+91 98495 66710',
    status: 'On Duty',
  },
  {
    id: 'TECH-05',
    facilityId: 'BF-01',
    empCode: 'TML-BS-105',
    name: 'Madhu K',
    role: 'Bodyshop Estimator / Surveyor',
    certificationLevel: 'Tata Gold Master Bodyshop',
    shift: 'General (09:30 - 18:30)',
    bayAssigned: 'Surveyor Bay / Gate 02',
    experienceYears: 14,
    activeJobsCount: 4,
    phone: '+91 98492 77102',
    status: 'On Duty',
  },
];

// Direct transcript from User's Excel Images 2, 3, 4!
const STORAGE_PREFIX = 'tata_motors_bodyshop_master_v1';

export const BodyshopMaster: React.FC<{ onOpenCatalogues?: () => void }> = () => {
  const { showToast, logAudit } = useApp();

  // Active Sub-Tab
  // Inventory Capture and Insurance Documents are catalogue masters (Bodyshop group), built from the BA workbook
  const [activeTab, setActiveTab] = useState<'facilities' | 'tools' | 'technicians'>('facilities');

  // Selected Facility Filter
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Persistent States
  const [facilities, setFacilities] = useState<BodyshopFacility[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}_facilities`);
      return saved ? JSON.parse(saved) : SEED_FACILITIES;
    } catch {
      return SEED_FACILITIES;
    }
  });

  const [tools, setTools] = useState<SpecializedTool[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}_tools`);
      return saved ? JSON.parse(saved) : SEED_TOOLS;
    } catch {
      return SEED_TOOLS;
    }
  });

  const [technicians, setTechnicians] = useState<LeadTechnician[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}_technicians`);
      return saved ? JSON.parse(saved) : SEED_TECHNICIANS;
    } catch {
      return SEED_TECHNICIANS;
    }
  });

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}_facilities`, JSON.stringify(facilities));
  }, [facilities]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}_tools`, JSON.stringify(tools));
  }, [tools]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}_technicians`, JSON.stringify(technicians));
  }, [technicians]);

  // Modal State for Adding / Editing Records
  const [modalType, setModalType] = useState<
    'facility' | 'tool' | 'technician' | null
  >(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form states
  const [facilityFormData, setFacilityFormData] = useState<Partial<BodyshopFacility>>({});
  const [toolFormData, setToolFormData] = useState<Partial<SpecializedTool>>({});
  const [techFormData, setTechFormData] = useState<Partial<LeadTechnician>>({});

  // Reset to Defaults
  const handleResetDefaults = () => {
    if (confirm('Reset all Bodyshop Master data back to factory Tata Motors seed parameters?')) {
      setFacilities(SEED_FACILITIES);
      setTools(SEED_TOOLS);
      setTechnicians(SEED_TECHNICIANS);
      logAudit(
        'Bodyshop Master Factory Reset',
        'Bodyshop Operations',
        'Bodyshop Master',
        'Custom Data',
        'Reset to baseline parameters'
      );
      showToast('Bodyshop Master reset to factory baseline', 'info');
    }
  };

  // Export current active view to CSV
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: Array<string[]> = [];
    let filename = `bodyshop_${activeTab}_${new Date().toISOString().substring(0, 10)}.csv`;

    if (activeTab === 'facilities') {
      headers = [
        'Facility ID',
        'Dealer Name',
        'Division',
        'BU',
        'Total Bays',
        'Denting Stalls',
        'Paint Booths',
        'Chassis Jigs',
        'Max Simultaneous Repairs',
        'Supervisor',
        'Status',
      ];
      rows = facilities.map((f) => [
        f.facilityCode,
        f.dealerName,
        f.divisionName,
        f.bu,
        String(f.totalBays),
        String(f.dentingStalls),
        String(f.paintBooths),
        String(f.chassisJigs),
        String(f.maxSimultaneousRepairs),
        f.supervisorName,
        f.status,
      ]);
    } else if (activeTab === 'tools') {
      headers = [
        'Tool Code',
        'Tool Name',
        'Category',
        'Model',
        'Serial No',
        'Bay Location',
        'Lead Tech',
        'Next Calibration',
        'Status',
      ];
      rows = tools.map((t) => [
        t.toolCode,
        t.toolName,
        t.category,
        t.manufacturerModel,
        t.serialNumber,
        t.bayAssigned,
        t.leadTechAssigned,
        t.nextCalibrationDue,
        t.conditionStatus,
      ]);
    } else if (activeTab === 'technicians') {
      headers = [
        'Emp Code',
        'Name',
        'Role',
        'Certification',
        'Shift',
        'Assigned Bay',
        'Experience (Yrs)',
        'Active Jobs',
        'Phone',
        'Status',
      ];
      rows = technicians.map((tech) => [
        tech.empCode,
        tech.name,
        tech.role,
        tech.certificationLevel,
        tech.shift,
        tech.bayAssigned,
        String(tech.experienceYears),
        String(tech.activeJobsCount),
        tech.phone,
        tech.status,
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${activeTab} records as CSV`, 'success');
  };

  // KPI Calculations
  const totalBaysAll = facilities.reduce((sum, f) => sum + f.totalBays, 0);
  const totalBooths = facilities.reduce((sum, f) => sum + f.paintBooths, 0);
  const totalJigs = facilities.reduce((sum, f) => sum + f.chassisJigs, 0);
  const activeTechs = technicians.filter((t) => t.status !== 'On Leave').length;
  const certifiedToolsCount = tools.filter((t) => t.conditionStatus === 'Operational').length;

  return (
    <div className="space-y-4">
      {/* Bodyshop Master Executive Header */}
      <div className="bg-gradient-to-r from-slate-900 via-orange-950 to-slate-900 text-white rounded-2xl p-5 border border-orange-900/60 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-orange-800/40 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-orange-600/80 border border-orange-400/40 flex items-center justify-center text-white shadow-inner">
              <Paintbrush className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight text-white">
                  Bodyshop Master Management Console
                </h2>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 font-mono font-bold border border-orange-500/40">
                  Crash &amp; Paint Governance
                </span>
              </div>
              <p className="text-xs text-orange-200 mt-1 max-w-2xl leading-relaxed">
                Centralized administration of body shop facilities, bay capacities, paint spray booths,
                hydraulic chassis jigs, specialized tool calibrations, and certified technician rosters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-orange-400/30 bg-slate-900/80 hover:bg-slate-800 text-orange-200 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
              title="Reset to factory baseline seed data"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>

        {/* 5 High-Impact Facility KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="bg-slate-900/60 rounded-xl p-3 border border-orange-900/40">
            <span className="text-orange-300 font-medium text-[11px] block">Bodyshop Bays</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white">{totalBaysAll}</span>
              <span className="text-[10px] text-slate-400 font-mono">Bays PAN-India</span>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-xl p-3 border border-orange-900/40">
            <span className="text-orange-300 font-medium text-[11px] block">Paint Spray Booths</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white">{totalBooths}</span>
              <span className="text-[10px] text-emerald-400 font-semibold">60°C Bake Ovens</span>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-xl p-3 border border-orange-900/40">
            <span className="text-orange-300 font-medium text-[11px] block">Chassis Alignment Jigs</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white">{totalJigs}</span>
              <span className="text-[10px] text-slate-400">Hydraulic Benches</span>
            </div>
          </div>

          <div className="bg-slate-900/60 rounded-xl p-3 border border-orange-900/40">
            <span className="text-orange-300 font-medium text-[11px] block">Certified Lead Techs</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-emerald-400">{activeTechs}</span>
              <span className="text-[10px] text-slate-400">On Active Duty</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveTab('facilities')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'facilities'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Facility Capacity &amp; Bays</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'facilities' ? 'bg-orange-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {facilities.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tools')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'tools'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Wrench className="h-4 w-4" />
            <span>Specialized Tools &amp; Jigs</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'tools' ? 'bg-orange-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {tools.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('technicians')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'technicians'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Lead Techs &amp; Rosters</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === 'technicians' ? 'bg-orange-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {technicians.length}
            </span>
          </button>

        </div>

        {/* Global Action: Add New Item in active tab */}
        <button
          onClick={() => {
            if (activeTab === 'facilities') {
              setFacilityFormData({
                bu: 'PV',
                totalBays: 6,
                dentingStalls: 3,
                paintBooths: 1,
                prepBays: 1,
                chassisJigs: 1,
                maxSimultaneousRepairs: 10,
                monthlyTargetThroughput: 80,
                status: 'Active',
              });
              setModalType('facility');
            } else if (activeTab === 'tools') {
              setToolFormData({
                category: 'Chassis & Frame Alignment',
                facilityId: facilities[0]?.id || 'BF-01',
                calibrationFrequencyMonths: 6,
                conditionStatus: 'Operational',
              });
              setModalType('tool');
            } else if (activeTab === 'technicians') {
              setTechFormData({
                facilityId: facilities[0]?.id || 'BF-01',
                role: 'Senior Panel Beater',
                certificationLevel: 'Tata Silver Bodyshop Tech',
                shift: 'General (09:30 - 18:30)',
                status: 'On Duty',
              });
              setModalType('technician');
            }
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-xs cursor-pointer transition-all border border-orange-400/40"
        >
          <Plus className="h-4 w-4" />
          <span>Add Record</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={`Search ${activeTab.replace('_', ' ')}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:border-orange-500 font-medium"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500">Filter Workshop Facility:</span>
          <select
            value={selectedFacilityId}
            onChange={(e) => setSelectedFacilityId(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-hidden cursor-pointer"
          >
            <option value="ALL">All Dealership Facilities ({facilities.length})</option>
            {facilities.map((fac) => (
              <option key={fac.id} value={fac.id}>
                {fac.facilityCode} - {fac.dealerName} ({fac.divisionName.split('(')[0]})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* SUB-TAB 1: FACILITY CAPACITY & BAYS                                      */}
      {/* ======================================================================= */}
      {activeTab === 'facilities' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Facility Code</th>
                  <th className="p-3">Dealership &amp; Division</th>
                  <th className="p-3">Powertrain Scope</th>
                  <th className="p-3 text-center">Total Bays</th>
                  <th className="p-3 text-center">Denting Stalls</th>
                  <th className="p-3 text-center">Paint Booths</th>
                  <th className="p-3 text-center">Chassis Jigs</th>
                  <th className="p-3 text-center">Max Simultaneous Repairs</th>
                  <th className="p-3">Bodyshop Supervisor</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {facilities
                  .filter((f) => {
                    if (selectedFacilityId !== 'ALL' && f.id !== selectedFacilityId) return false;
                    if (searchQuery.trim()) {
                      const q = searchQuery.toLowerCase();
                      return (
                        f.facilityCode.toLowerCase().includes(q) ||
                        f.dealerName.toLowerCase().includes(q) ||
                        f.divisionName.toLowerCase().includes(q) ||
                        f.supervisorName.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((fac) => (
                    <tr key={fac.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900">{fac.facilityCode}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{fac.dealerName}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {fac.divisionName}
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            fac.bu.includes('EV')
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-blue-100 text-blue-800 border border-blue-300'
                          }`}
                        >
                          {fac.bu}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold text-slate-900">{fac.totalBays}</td>
                      <td className="p-3 text-center font-bold text-orange-950">{fac.dentingStalls}</td>
                      <td className="p-3 text-center font-bold text-purple-950">{fac.paintBooths}</td>
                      <td className="p-3 text-center font-bold text-blue-950">{fac.chassisJigs}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-900">
                        {fac.maxSimultaneousRepairs} vehicles
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{fac.supervisorName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{fac.contactPhone}</div>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            fac.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {fac.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setEditingItem(fac);
                            setFacilityFormData(fac);
                            setModalType('facility');
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                          title="Edit Facility"
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

      {/* ======================================================================= */}
      {/* SUB-TAB 2: SPECIALIZED TOOLS & JIGS                                     */}
      {/* ======================================================================= */}
      {activeTab === 'tools' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Tool Code</th>
                  <th className="p-3">Equipment / Machine Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Assigned Bay Location</th>
                  <th className="p-3">Lead Technician</th>
                  <th className="p-3">Serial / Asset Number</th>
                  <th className="p-3">Next Calibration Due</th>
                  <th className="p-3 text-center">Operating Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tools
                  .filter((t) => {
                    if (selectedFacilityId !== 'ALL' && t.facilityId !== selectedFacilityId) return false;
                    if (searchQuery.trim()) {
                      const q = searchQuery.toLowerCase();
                      return (
                        t.toolCode.toLowerCase().includes(q) ||
                        t.toolName.toLowerCase().includes(q) ||
                        t.category.toLowerCase().includes(q) ||
                        t.leadTechAssigned.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900">{t.toolCode}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{t.toolName}</div>
                        <div className="text-[11px] text-slate-500">{t.manufacturerModel}</div>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {t.category}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-800">{t.bayAssigned}</td>
                      <td className="p-3">
                        <span className="font-medium text-slate-700">{t.leadTechAssigned}</span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">{t.serialNumber}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-700 font-semibold">
                        {t.nextCalibrationDue}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            t.conditionStatus === 'Operational'
                              ? 'bg-emerald-100 text-emerald-800'
                              : t.conditionStatus === 'Calibration Due'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {t.conditionStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setEditingItem(t);
                            setToolFormData(t);
                            setModalType('tool');
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                          title="Edit Tool"
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

      {/* ======================================================================= */}
      {/* SUB-TAB 3: LEAD TECHNICIANS & ROSTERS                                   */}
      {/* ======================================================================= */}
      {activeTab === 'technicians' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3">Emp Code</th>
                  <th className="p-3">Lead Technician Name</th>
                  <th className="p-3">Primary Bodyshop Role</th>
                  <th className="p-3">Certification Level</th>
                  <th className="p-3">Shift Timing</th>
                  <th className="p-3">Assigned Bay</th>
                  <th className="p-3 text-center">Experience</th>
                  <th className="p-3 text-center">Active Jobs</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {technicians
                  .filter((tech) => {
                    if (selectedFacilityId !== 'ALL' && tech.facilityId !== selectedFacilityId) return false;
                    if (searchQuery.trim()) {
                      const q = searchQuery.toLowerCase();
                      return (
                        tech.empCode.toLowerCase().includes(q) ||
                        tech.name.toLowerCase().includes(q) ||
                        tech.role.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((tech) => (
                    <tr key={tech.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900">{tech.empCode}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{tech.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{tech.phone}</div>
                      </td>
                      <td className="p-3 font-semibold text-slate-800">{tech.role}</td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            tech.certificationLevel.includes('Gold')
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : tech.certificationLevel.includes('EV')
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-purple-100 text-purple-900 border border-purple-300'
                          }`}
                        >
                          {tech.certificationLevel}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-slate-600 font-medium">{tech.shift}</td>
                      <td className="p-3 font-semibold text-slate-800">{tech.bayAssigned}</td>
                      <td className="p-3 text-center font-bold text-slate-900">
                        {tech.experienceYears} yrs
                      </td>
                      <td className="p-3 text-center font-black text-orange-950">
                        {tech.activeJobsCount}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            tech.status === 'In Bay'
                              ? 'bg-blue-100 text-blue-800'
                              : tech.status === 'On Duty'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {tech.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setEditingItem(tech);
                            setTechFormData(tech);
                            setModalType('technician');
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                          title="Edit Technician"
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

      {/* ======================================================================= */}
      {/* MODAL: ADD / EDIT DIALOG                                                */}
      {/* ======================================================================= */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 text-xs space-y-4 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-50 text-orange-700">
                  <Wrench className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    {editingItem ? 'Edit' : 'Add New'} {modalType.toUpperCase()} Record
                  </h3>
                  <p className="text-[11px] text-slate-500">Bodyshop Master Catalogue</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalType(null);
                  setEditingItem(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Facility Form */}
            {modalType === 'facility' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingItem) {
                    setFacilities(
                      facilities.map((f) => (f.id === editingItem.id ? ({ ...f, ...facilityFormData } as any) : f))
                    );
                    showToast('Facility record updated.', 'success');
                  } else {
                    const newF: BodyshopFacility = {
                      id: `BF-${Date.now().toString().slice(-4)}`,
                      facilityCode: facilityFormData.facilityCode || `BS-${Date.now().toString().slice(-3)}`,
                      dealerId: facilityFormData.dealerId || 'DLR-1001',
                      dealerName: facilityFormData.dealerName || 'Sample Motors Hyderabad',
                      divisionName: facilityFormData.divisionName || 'Bodyshop Division',
                      bu: facilityFormData.bu || 'PV',
                      totalBays: Number(facilityFormData.totalBays || 6),
                      dentingStalls: Number(facilityFormData.dentingStalls || 3),
                      paintBooths: Number(facilityFormData.paintBooths || 1),
                      prepBays: Number(facilityFormData.prepBays || 1),
                      chassisJigs: Number(facilityFormData.chassisJigs || 1),
                      maxSimultaneousRepairs: Number(facilityFormData.maxSimultaneousRepairs || 10),
                      monthlyTargetThroughput: Number(facilityFormData.monthlyTargetThroughput || 80),
                      supervisorName: facilityFormData.supervisorName || 'Supervisor',
                      contactPhone: facilityFormData.contactPhone || '+91 98490 00000',
                      status: facilityFormData.status || 'Active',
                      lastAuditDate: new Date().toISOString().substring(0, 10),
                    };
                    setFacilities([...facilities, newF]);
                    showToast('New Bodyshop Facility added.', 'success');
                  }
                  setModalType(null);
                  setEditingItem(null);
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Facility Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={facilityFormData.facilityCode || ''}
                      onChange={(e) =>
                        setFacilityFormData({ ...facilityFormData, facilityCode: e.target.value })
                      }
                      placeholder="e.g. BS-HYD-03"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">BU</label>
                    <select
                      value={facilityFormData.bu || 'PV'}
                      onChange={(e) =>
                        setFacilityFormData({ ...facilityFormData, bu: e.target.value as any })
                      }
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="PV">PV (Passenger Vehicles)</option>
                      <option value="EV">EV (Electric Vehicles)</option>
                      <option value="CV">CV (Commercial Vehicles)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Dealership Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={facilityFormData.dealerName || ''}
                    onChange={(e) =>
                      setFacilityFormData({ ...facilityFormData, dealerName: e.target.value })
                    }
                    placeholder="e.g. Sample Motors Hyderabad"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Division / Complex Location
                  </label>
                  <input
                    type="text"
                    value={facilityFormData.divisionName || ''}
                    onChange={(e) =>
                      setFacilityFormData({ ...facilityFormData, divisionName: e.target.value })
                    }
                    placeholder="e.g. D1 - South Main Workshop"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Total Bays</label>
                    <input
                      type="number"
                      value={facilityFormData.totalBays || 0}
                      onChange={(e) =>
                        setFacilityFormData({ ...facilityFormData, totalBays: Number(e.target.value) })
                      }
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Denting</label>
                    <input
                      type="number"
                      value={facilityFormData.dentingStalls || 0}
                      onChange={(e) =>
                        setFacilityFormData({
                          ...facilityFormData,
                          dentingStalls: Number(e.target.value),
                        })
                      }
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Booths</label>
                    <input
                      type="number"
                      value={facilityFormData.paintBooths || 0}
                      onChange={(e) =>
                        setFacilityFormData({
                          ...facilityFormData,
                          paintBooths: Number(e.target.value),
                        })
                      }
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Jigs</label>
                    <input
                      type="number"
                      value={facilityFormData.chassisJigs || 0}
                      onChange={(e) =>
                        setFacilityFormData({
                          ...facilityFormData,
                          chassisJigs: Number(e.target.value),
                        })
                      }
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Supervisor</label>
                    <input
                      type="text"
                      value={facilityFormData.supervisorName || ''}
                      onChange={(e) =>
                        setFacilityFormData({ ...facilityFormData, supervisorName: e.target.value })
                      }
                      placeholder="e.g. Ramachandran M"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={facilityFormData.contactPhone || ''}
                      onChange={(e) =>
                        setFacilityFormData({ ...facilityFormData, contactPhone: e.target.value })
                      }
                      placeholder="+91 98490 00000"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold shadow-xs"
                  >
                    Save Facility
                  </button>
                </div>
              </form>
            )}

            {/* Tool Form */}
            {modalType === 'tool' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingItem) {
                    setTools(
                      tools.map((t) => (t.id === editingItem.id ? ({ ...t, ...toolFormData } as any) : t))
                    );
                    showToast('Specialized tool updated.', 'success');
                  } else {
                    const newT: SpecializedTool = {
                      id: `TOOL-${Date.now().toString().slice(-4)}`,
                      facilityId: toolFormData.facilityId || facilities[0]?.id || 'BF-01',
                      toolCode: toolFormData.toolCode || `BS-TOOL-${Date.now().toString().slice(-3)}`,
                      toolName: toolFormData.toolName || 'Specialized Tool',
                      category: toolFormData.category || 'Chassis & Frame Alignment',
                      manufacturerModel: toolFormData.manufacturerModel || '',
                      serialNumber: toolFormData.serialNumber || 'SN-UNKNOWN',
                      bayAssigned: toolFormData.bayAssigned || 'Bay 09',
                      calibrationFrequencyMonths: Number(toolFormData.calibrationFrequencyMonths || 6),
                      lastCalibratedDate: new Date().toISOString().substring(0, 10),
                      nextCalibrationDue: '2027-04-01',
                      leadTechAssigned: toolFormData.leadTechAssigned || 'Lead Tech',
                      conditionStatus: toolFormData.conditionStatus || 'Operational',
                      safetyCertification: 'TATA-CERT-PASS',
                    };
                    setTools([...tools, newT]);
                    showToast('New specialized tool added.', 'success');
                  }
                  setModalType(null);
                  setEditingItem(null);
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Equipment / Machine Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={toolFormData.toolName || ''}
                    onChange={(e) => setToolFormData({ ...toolFormData, toolName: e.target.value })}
                    placeholder="e.g. Car-O-Liner Hydraulic Frame Straightener"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Tool Code *</label>
                    <input
                      type="text"
                      required
                      value={toolFormData.toolCode || ''}
                      onChange={(e) => setToolFormData({ ...toolFormData, toolCode: e.target.value })}
                      placeholder="e.g. BS-JIG-02"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Category</label>
                    <select
                      value={toolFormData.category || 'Chassis & Frame Alignment'}
                      onChange={(e) =>
                        setToolFormData({ ...toolFormData, category: e.target.value as any })
                      }
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="Chassis & Frame Alignment">Chassis & Frame Alignment</option>
                      <option value="Spray Booth & Curing">Spray Booth & Curing</option>
                      <option value="Welding & Dent Pulling">Welding & Dent Pulling</option>
                      <option value="Coating & Diagnostics">Coating & Diagnostics</option>
                      <option value="Aluminum Structural Repair">Aluminum Structural Repair</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Model &amp; Manufacturer
                  </label>
                  <input
                    type="text"
                    value={toolFormData.manufacturerModel || ''}
                    onChange={(e) =>
                      setToolFormData({ ...toolFormData, manufacturerModel: e.target.value })
                    }
                    placeholder="e.g. BenchRack 5500 with Vision X3 Measuring"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Bay Assigned</label>
                    <input
                      type="text"
                      value={toolFormData.bayAssigned || ''}
                      onChange={(e) =>
                        setToolFormData({ ...toolFormData, bayAssigned: e.target.value })
                      }
                      placeholder="e.g. Bay 09 (Denting 01)"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Lead Tech Responsible
                    </label>
                    <input
                      type="text"
                      value={toolFormData.leadTechAssigned || ''}
                      onChange={(e) =>
                        setToolFormData({ ...toolFormData, leadTechAssigned: e.target.value })
                      }
                      placeholder="e.g. Ram (Chassis Master)"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold shadow-xs"
                  >
                    Save Tool
                  </button>
                </div>
              </form>
            )}

            {/* Technician Form */}
            {modalType === 'technician' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editingItem) {
                    setTechnicians(
                      technicians.map((t) => (t.id === editingItem.id ? ({ ...t, ...techFormData } as any) : t))
                    );
                    showToast('Technician roster updated.', 'success');
                  } else {
                    const newTech: LeadTechnician = {
                      id: `TECH-${Date.now().toString().slice(-4)}`,
                      facilityId: techFormData.facilityId || facilities[0]?.id || 'BF-01',
                      empCode: techFormData.empCode || `TML-BS-${Date.now().toString().slice(-3)}`,
                      name: techFormData.name || 'Technician Name',
                      role: techFormData.role || 'Senior Panel Beater',
                      certificationLevel: techFormData.certificationLevel || 'Tata Silver Bodyshop Tech',
                      shift: techFormData.shift || 'General (09:30 - 18:30)',
                      bayAssigned: techFormData.bayAssigned || 'Bay 08',
                      experienceYears: Number(techFormData.experienceYears || 5),
                      activeJobsCount: Number(techFormData.activeJobsCount || 1),
                      phone: techFormData.phone || '+91 98000 00000',
                      status: techFormData.status || 'On Duty',
                    };
                    setTechnicians([...technicians, newTech]);
                    showToast('Lead Technician added.', 'success');
                  }
                  setModalType(null);
                  setEditingItem(null);
                }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Technician Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={techFormData.name || ''}
                      onChange={(e) => setTechFormData({ ...techFormData, name: e.target.value })}
                      placeholder="e.g. Ramachandran M"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Emp Code *</label>
                    <input
                      type="text"
                      required
                      value={techFormData.empCode || ''}
                      onChange={(e) => setTechFormData({ ...techFormData, empCode: e.target.value })}
                      placeholder="e.g. TML-BS-108"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Primary Role</label>
                    <select
                      value={techFormData.role || 'Senior Panel Beater'}
                      onChange={(e) => setTechFormData({ ...techFormData, role: e.target.value as any })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="Master Painter">Master Painter</option>
                      <option value="Chassis & Frame Alignment Lead">
                        Chassis & Frame Alignment Lead
                      </option>
                      <option value="Senior Panel Beater">Senior Panel Beater</option>
                      <option value="Paint Prep Specialist">Paint Prep Specialist</option>
                      <option value="Bodyshop Estimator / Surveyor">
                        Bodyshop Estimator / Surveyor
                      </option>
                      <option value="Bodyshop Floor Supervisor">Bodyshop Floor Supervisor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Certification Level
                    </label>
                    <select
                      value={techFormData.certificationLevel || 'Tata Silver Bodyshop Tech'}
                      onChange={(e) =>
                        setTechFormData({ ...techFormData, certificationLevel: e.target.value as any })
                      }
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="Tata Gold Master Bodyshop">Tata Gold Master Bodyshop</option>
                      <option value="Tata Silver Bodyshop Tech">Tata Silver Bodyshop Tech</option>
                      <option value="EV High-Voltage Bodyshop Certified">
                        EV High-Voltage Bodyshop Certified
                      </option>
                      <option value="Axalta/PPG Paint Master">Axalta/PPG Paint Master</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Shift</label>
                    <select
                      value={techFormData.shift || 'General (09:30 - 18:30)'}
                      onChange={(e) => setTechFormData({ ...techFormData, shift: e.target.value as any })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="Morning (08:00 - 17:00)">Morning (08:00 - 17:00)</option>
                      <option value="General (09:30 - 18:30)">General (09:30 - 18:30)</option>
                      <option value="Evening (14:00 - 22:30)">Evening (14:00 - 22:30)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Assigned Bay</label>
                    <input
                      type="text"
                      value={techFormData.bayAssigned || ''}
                      onChange={(e) =>
                        setTechFormData({ ...techFormData, bayAssigned: e.target.value })
                      }
                      placeholder="e.g. Bay 09 (Denting 01)"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold shadow-xs"
                  >
                    Save Technician
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
