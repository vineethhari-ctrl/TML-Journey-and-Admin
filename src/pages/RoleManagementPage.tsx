import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Shield,
  Search,
  MoreVertical,
  ChevronDown,
  Download,
  GitCompare,
  History,
  RotateCcw,
  Info,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sliders,
  Users,
  X,
  Check,
  FileText,
  Lock,
} from 'lucide-react';

import { PermissionsMatrix } from '../components/administration/PermissionsMatrix';

type PermissionTier = 'REQUIRED' | 'DEFAULT' | 'GRANTABLE' | 'NEVER';

interface RoleColumn {
  id: string;
  name: string;
  userCount: string;
  isNotConfigured?: boolean;
  description: string;
}

interface PermissionRow {
  code: string;
  description: string;
  group: 'Appointment' | 'Gate' | 'Job Card' | 'Estimation' | 'Bay' | 'Configuration & Admin';
  domain: string;
  service: string;
  roles: {
    serviceAdvisor: PermissionTier;
    receptionist: PermissionTier;
    securityGuard: PermissionTier;
    driver: PermissionTier;
    dgm: PermissionTier;
    dealerAdmin: PermissionTier;
    cro: PermissionTier;
  };
  baselineRoles?: {
    serviceAdvisor?: PermissionTier;
    receptionist?: PermissionTier;
    securityGuard?: PermissionTier;
    driver?: PermissionTier;
    dgm?: PermissionTier;
    dealerAdmin?: PermissionTier;
    cro?: PermissionTier;
  };
}

export const RoleManagementPage: React.FC = () => {
  const { showToast } = useApp();

  // Left Sub-navigation state
  const [activeSubNav, setActiveSubNav] = useState<'permissions' | 'matrix' | 'catalogue' | 'roles' | 'approval_rules' | 'attendance' | 'approvals' | 'elevated' | 'history'>('permissions');

  // Filters
  const [selectedDomain, setSelectedDomain] = useState<string>('All');
  const [selectedService, setSelectedService] = useState<string>('All');
  const [searchCode, setSearchCode] = useState<string>('');
  const [onlyDiffersFromBaseline, setOnlyDiffersFromBaseline] = useState<boolean>(false);

  // More menu dropdown
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);

  // Edit Role Drawer state
  const [drawerRole, setDrawerRole] = useState<RoleColumn | null>(null);

  // Active hover tooltip state
  const [hoveredCell, setHoveredCell] = useState<{
    permCode: string;
    roleId: string;
    tier: PermissionTier;
    baselineTier: PermissionTier;
  } | null>(null);

  // Roles Definition
  const roles: RoleColumn[] = [
    {
      id: 'serviceAdvisor',
      name: 'Service Advisor',
      userCount: '5,420 users',
      description: 'Customer greeting, Job Card creation, initial estimation, repair tracking, and customer handovers.',
    },
    {
      id: 'receptionist',
      name: 'Receptionist',
      userCount: '1,180 users',
      description: 'Appointment desk handling, customer reception, courtesy services, and gate schedule coordination.',
    },
    {
      id: 'securityGuard',
      name: 'Security Guard',
      userCount: '1,060 users',
      description: 'Main workshop gate operations, physical inward/outward vehicle logs, and security checks.',
    },
    {
      id: 'driver',
      name: 'Driver',
      userCount: '3,300 users',
      description: 'Pick & Drop customer vehicle transit, road tests, and workshop inter-bay vehicle movement.',
    },
    {
      id: 'dgm',
      name: 'DGM',
      userCount: '410 users',
      description: 'Deputy General Manager supervising workshop performance, escalations, high-value estimates, and audits.',
    },
    {
      id: 'dealerAdmin',
      name: 'Dealer Admin',
      userCount: '480 users',
      description: 'Dealership service operations administrator managing local staff permissions, bays, and calendar.',
    },
    {
      id: 'cro',
      name: 'CRO (Telecaller)',
      userCount: '1,600 users',
      isNotConfigured: true,
      description: 'Customer Relationship Officer handling outbound reminder calls and service feedback.',
    },
  ];

  // Permission Rows
  const [permissions, setPermissions] = useState<PermissionRow[]>([
    // Appointment
    {
      code: 'appointment.read',
      description: 'View appointments',
      group: 'Appointment',
      domain: 'Service Operations',
      service: 'Appointment',
      roles: {
        serviceAdvisor: 'REQUIRED',
        receptionist: 'REQUIRED',
        securityGuard: 'DEFAULT',
        driver: 'NEVER',
        dgm: 'REQUIRED',
        dealerAdmin: 'DEFAULT',
        cro: 'NEVER',
      },
    },
    {
      code: 'appointment.create',
      description: 'Create a booking',
      group: 'Appointment',
      domain: 'Service Operations',
      service: 'Appointment',
      roles: {
        serviceAdvisor: 'GRANTABLE',
        receptionist: 'REQUIRED',
        securityGuard: 'NEVER',
        driver: 'NEVER',
        dgm: 'NEVER',
        dealerAdmin: 'NEVER',
        cro: 'NEVER',
      },
    },
    {
      code: 'appointment.update',
      description: 'Modify an appointment',
      group: 'Appointment',
      domain: 'Service Operations',
      service: 'Appointment',
      roles: {
        serviceAdvisor: 'GRANTABLE',
        receptionist: 'DEFAULT',
        securityGuard: 'NEVER',
        driver: 'NEVER',
        dgm: 'NEVER',
        dealerAdmin: 'NEVER',
        cro: 'NEVER',
      },
    },
    {
      code: 'appointment.cancel',
      description: 'Cancel an appointment',
      group: 'Appointment',
      domain: 'Service Operations',
      service: 'Appointment',
      roles: {
        serviceAdvisor: 'GRANTABLE',
        receptionist: 'DEFAULT',
        securityGuard: 'NEVER',
        driver: 'NEVER',
        dgm: 'NEVER',
        dealerAdmin: 'NEVER',
        cro: 'NEVER',
      },
    },

    // Gate
    {
      code: 'gate.checkin',
      description: 'Record vehicle gate-in',
      group: 'Gate',
      domain: 'Security & Gate',
      service: 'Gate',
      roles: {
        serviceAdvisor: 'NEVER',
        receptionist: 'GRANTABLE',
        securityGuard: 'REQUIRED',
        driver: 'NEVER',
        dgm: 'NEVER',
        dealerAdmin: 'NEVER',
        cro: 'NEVER',
      },
    },
    {
      code: 'gate.checkout',
      description: 'Record vehicle gate-out',
      group: 'Gate',
      domain: 'Security & Gate',
      service: 'Gate',
      roles: {
        serviceAdvisor: 'NEVER',
        receptionist: 'GRANTABLE',
        securityGuard: 'REQUIRED',
        driver: 'NEVER',
        dgm: 'NEVER',
        dealerAdmin: 'NEVER',
        cro: 'NEVER',
      },
    },
    {
      code: 'gate.read',
      description: 'View gate status',
      group: 'Gate',
      domain: 'Security & Gate',
      service: 'Gate',
      roles: {
        serviceAdvisor: 'NEVER',
        receptionist: 'DEFAULT',
        securityGuard: 'REQUIRED',
        driver: 'DEFAULT',
        dgm: 'REQUIRED',
        dealerAdmin: 'DEFAULT',
        cro: 'NEVER',
      },
    },

    // Job Card
    {
      code: 'jobcard.read',
      description: 'View job cards',
      group: 'Job Card',
      domain: 'Workshop',
      service: 'Job Card',
      roles: {
        serviceAdvisor: 'REQUIRED',
        receptionist: 'DEFAULT',
        securityGuard: 'NEVER',
        driver: 'REQUIRED',
        dgm: 'REQUIRED',
        dealerAdmin: 'DEFAULT',
        cro: 'NEVER',
      },
    },
    {
      code: 'jobcard.create',
      description: 'Open a job card',
      group: 'Job Card',
      domain: 'Workshop',
      service: 'Job Card',
      roles: {
        serviceAdvisor: 'REQUIRED',
        receptionist: 'NEVER',
        securityGuard: 'NEVER',
        driver: 'NEVER',
        dgm: 'NEVER',
        dealerAdmin: 'NEVER',
        cro: 'NEVER',
      },
    },
    {
      code: 'jobcard.update',
      description: 'Edit job card contents',
      group: 'Job Card',
      domain: 'Workshop',
      service: 'Job Card',
      roles: {
        serviceAdvisor: 'DEFAULT',
        receptionist: 'NEVER',
        securityGuard: 'NEVER',
        driver: 'NEVER',
        dgm: 'NEVER',
        dealerAdmin: 'NEVER',
        cro: 'NEVER',
      },
    },
    {
      code: 'jobcard.status',
      description: 'Change job card status',
      group: 'Job Card',
      domain: 'Workshop',
      service: 'Job Card',
      roles: {
        serviceAdvisor: 'DEFAULT',
        receptionist: 'NEVER',
        securityGuard: 'NEVER',
        driver: 'NEVER',
        dgm: 'NEVER',
        dealerAdmin: 'NEVER',
        cro: 'NEVER',
      },
    },

    // Estimation
    {
      code: 'estimation.read',
      description: 'View estimates',
      group: 'Estimation',
      domain: 'Billing & Accounts',
      service: 'Estimation',
      roles: {
        serviceAdvisor: 'DEFAULT',
        receptionist: 'DEFAULT',
        securityGuard: 'NEVER',
        driver: 'NEVER',
        dgm: 'REQUIRED',
        dealerAdmin: 'DEFAULT',
        cro: 'NEVER',
      },
    },
    {
      code: 'estimation.create',
      description: 'Create / share an estimate',
      group: 'Estimation',
      domain: 'Billing & Accounts',
      service: 'Estimation',
      roles: {
        serviceAdvisor: 'DEFAULT',
        receptionist: 'NEVER',
        securityGuard: 'NEVER',
        driver: 'NEVER',
        dgm: 'NEVER',
        dealerAdmin: 'NEVER',
        cro: 'NEVER',
      },
    },
    {
      code: 'estimation.approve',
      description: 'Approve or reject an estimate',
      group: 'Estimation',
      domain: 'Billing & Accounts',
      service: 'Estimation',
      roles: {
        serviceAdvisor: 'NEVER',
        receptionist: 'NEVER',
        securityGuard: 'NEVER',
        driver: 'NEVER',
        dgm: 'NEVER',
        dealerAdmin: 'NEVER',
        cro: 'NEVER',
      },
    },

    // Bay
    {
      code: 'bay.read',
      description: 'View bay status & queue',
      group: 'Bay',
      domain: 'Workshop',
      service: 'Bay',
      roles: {
        serviceAdvisor: 'DEFAULT',
        receptionist: 'REQUIRED',
        securityGuard: 'NEVER',
        driver: 'NEVER',
        dgm: 'REQUIRED',
        dealerAdmin: 'DEFAULT',
        cro: 'NEVER',
      },
    },
    {
      code: 'bay.assign',
      description: 'Assign / override a bay',
      group: 'Bay',
      domain: 'Workshop',
      service: 'Bay',
      roles: {
        serviceAdvisor: 'GRANTABLE',
        receptionist: 'DEFAULT',
        securityGuard: 'NEVER',
        driver: 'NEVER',
        dgm: 'NEVER',
        dealerAdmin: 'NEVER',
        cro: 'NEVER',
      },
    },

    // Configuration & Admin
    {
      code: 'config.read',
      description: 'Read division configuration',
      group: 'Configuration & Admin',
      domain: 'Administration',
      service: 'Configuration & Admin',
      roles: {
        serviceAdvisor: 'NEVER',
        receptionist: 'NEVER',
        securityGuard: 'NEVER',
        driver: 'NEVER',
        dgm: 'REQUIRED',
        dealerAdmin: 'REQUIRED',
        cro: 'NEVER',
      },
    },
    {
      code: 'config.write',
      description: 'Modify configuration',
      group: 'Configuration & Admin',
      domain: 'Administration',
      service: 'Configuration & Admin',
      roles: {
        serviceAdvisor: 'NEVER',
        receptionist: 'NEVER',
        securityGuard: 'NEVER',
        driver: 'NEVER',
        dgm: 'NEVER',
        dealerAdmin: 'REQUIRED',
        cro: 'NEVER',
      },
    },
    {
      code: 'user.provision',
      description: 'Provision platform users',
      group: 'Configuration & Admin',
      domain: 'Administration',
      service: 'Configuration & Admin',
      roles: {
        serviceAdvisor: 'NEVER',
        receptionist: 'NEVER',
        securityGuard: 'NEVER',
        driver: 'NEVER',
        dgm: 'NEVER',
        dealerAdmin: 'REQUIRED',
        cro: 'NEVER',
      },
    },
    {
      code: 'permission.manage',
      description: 'Grant / revoke staff permissions',
      group: 'Configuration & Admin',
      domain: 'Administration',
      service: 'Configuration & Admin',
      roles: {
        serviceAdvisor: 'NEVER',
        receptionist: 'NEVER',
        securityGuard: 'NEVER',
        driver: 'NEVER',
        dgm: 'NEVER',
        dealerAdmin: 'REQUIRED',
        cro: 'NEVER',
      },
    },
  ]);

  // Filter Logic
  const filteredPermissions = useMemo(() => {
    return permissions.filter((p) => {
      if (selectedDomain !== 'All' && p.domain !== selectedDomain) return false;
      if (selectedService !== 'All' && p.service !== selectedService) return false;
      if (searchCode.trim()) {
        const q = searchCode.toLowerCase();
        const matchesCode = p.code.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        if (!matchesCode && !matchesDesc) return false;
      }
      return true;
    });
  }, [permissions, selectedDomain, selectedService, searchCode]);

  // Grouped Permissions
  const groupedPermissions = useMemo(() => {
    const groups: { [key: string]: PermissionRow[] } = {};
    filteredPermissions.forEach((p) => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });
    return groups;
  }, [filteredPermissions]);

  // Cycle / Toggle Tier for dealer admin action
  const handleCellClick = (permCode: string, roleKey: keyof PermissionRow['roles']) => {
    const row = permissions.find((p) => p.code === permCode);
    if (!row) return;

    const currentTier = row.roles[roleKey];

    if (currentTier === 'REQUIRED') {
      showToast(`${permCode} is REQUIRED for this role. Dealers cannot revoke it.`, 'info');
      return;
    }

    if (currentTier === 'NEVER') {
      showToast(`${permCode} is never permitted for this role per TML baseline.`, 'error');
      return;
    }

    // Toggle between DEFAULT and GRANTABLE
    const newTier: PermissionTier = currentTier === 'DEFAULT' ? 'GRANTABLE' : 'DEFAULT';
    setPermissions(
      permissions.map((p) => {
        if (p.code === permCode) {
          return {
            ...p,
            roles: {
              ...p.roles,
              [roleKey]: newTier,
            },
          };
        }
        return p;
      })
    );
    showToast(`Updated ${permCode} to ${newTier} for this role`, 'success');
  };

  // Render Pill according to exact styling in image
  const renderTierPill = (tier: PermissionTier) => {
    switch (tier) {
      case 'REQUIRED':
        return (
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#1a202c] text-white tracking-wider">
            REQUIRED
          </span>
        );
      case 'DEFAULT':
        return (
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100/90 text-blue-700 tracking-wider">
            DEFAULT
          </span>
        );
      case 'GRANTABLE':
        return (
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold border border-blue-400 bg-white text-blue-600 tracking-wider">
            GRANTABLE
          </span>
        );
      case 'NEVER':
      default:
        return <span className="text-slate-300 font-bold">—</span>;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-140px)] text-slate-800">
      {/* ========================================================================= */}
      {/* 1. LEFT SUB-NAVIGATION SIDEBAR (Exact match from screenshot)             */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-56 shrink-0 space-y-6 text-xs border-b lg:border-b-0 lg:border-r border-slate-200 pr-0 lg:pr-5 pb-5 lg:pb-0">
        <div className="space-y-1">
          <button
            onClick={() => setActiveSubNav('permissions')}
            className={`w-full text-left px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer ${
              activeSubNav === 'permissions'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Role Permissions
          </button>

          <button
            onClick={() => setActiveSubNav('matrix')}
            className={`w-full text-left px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer flex items-center justify-between ${
              activeSubNav === 'matrix'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span>Permissions Matrix</span>
            <span className="text-[9px] px-1.5 py-0.2 bg-blue-100 text-blue-900 rounded font-bold">
              CRUD
            </span>
          </button>

          <button
            onClick={() => {
              setActiveSubNav('catalogue');
              showToast('Navigating to Permission Catalogue...', 'info');
            }}
            className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeSubNav === 'catalogue'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Permission Catalogue
          </button>

          <button
            onClick={() => {
              setActiveSubNav('roles');
              showToast('Navigating to Roles & Position Types...', 'info');
            }}
            className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeSubNav === 'roles'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Roles &amp; Position Types
          </button>

          <button
            onClick={() => {
              setActiveSubNav('approval_rules');
              showToast('Navigating to Approval Rules...', 'info');
            }}
            className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              activeSubNav === 'approval_rules'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Approval Rules
          </button>
        </div>

        {/* ATTENDANCE SECTION */}
        <div className="space-y-1 pt-2">
          <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            ATTENDANCE
          </div>
          <button
            onClick={() => {
              setActiveSubNav('attendance');
              showToast('Navigating to Attendance Defaults...', 'info');
            }}
            className={`w-full text-left px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeSubNav === 'attendance'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Attendance Defaults
          </button>
        </div>

        {/* GOVERNANCE SECTION */}
        <div className="space-y-1 pt-2">
          <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            GOVERNANCE
          </div>

          <button
            onClick={() => {
              setActiveSubNav('approvals');
              showToast('Navigating to Approvals...', 'info');
            }}
            className={`w-full text-left px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeSubNav === 'approvals'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Approvals
          </button>

          <button
            onClick={() => {
              setActiveSubNav('elevated');
              showToast('Navigating to Elevated Users Report...', 'info');
            }}
            className={`w-full text-left px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeSubNav === 'elevated'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Elevated Users Report
          </button>

          <button
            onClick={() => {
              setActiveSubNav('history');
              showToast('Navigating to Change History...', 'info');
            }}
            className={`w-full text-left px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              activeSubNav === 'history'
                ? 'bg-blue-50 text-blue-800 font-bold'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Change History
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN ROLE PERMISSIONS MATRIX CONTENT (Exact match from screenshot)    */}
      {/* ========================================================================= */}
      <div className="flex-1 space-y-4 overflow-hidden">
        {activeSubNav === 'matrix' ? (
          <PermissionsMatrix onSaved={() => showToast('Granular module permissions ratified', 'success')} />
        ) : (
          <>
            {/* Main Title and Action Buttons */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={() => setActiveSubNav('permissions')}
                    className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-900 text-white cursor-pointer"
                  >
                    Role Permissions (Baseline)
                  </button>
                  <button
                    onClick={() => setActiveSubNav('matrix')}
                    className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 hover:bg-blue-50 text-blue-900 border border-slate-200 cursor-pointer"
                  >
                    Module CRUD Matrix ↗
                  </button>
                </div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  Role Permissions
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  What each role may do at every dealership. Dealers can only grant or revoke within these tiers.
                </p>
              </div>

          <div className="flex items-center gap-2 relative">
            {/* More Menu Button */}
            <div className="relative">
              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
              >
                <span>More</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {isMoreMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-30 text-xs">
                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      showToast('Exporting Role Permissions CSV (Ratified Baseline)...', 'success');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 text-left cursor-pointer"
                  >
                    <Download className="h-4 w-4 text-slate-400" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      showToast('Opening comparison with Ratified Baseline v1.0.0', 'info');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 text-left cursor-pointer"
                  >
                    <GitCompare className="h-4 w-4 text-slate-400" />
                    <span>Compare with ratified baseline</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      showToast('Opening audit log change history...', 'info');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 text-left cursor-pointer"
                  >
                    <History className="h-4 w-4 text-slate-400" />
                    <span>Change History for Permissions</span>
                  </button>
                  <div className="h-px bg-slate-100 my-1" />
                  <button
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      showToast('Reset all modified cells to baseline defaults', 'info');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 text-left cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4 text-rose-400" />
                    <span>Reset to Ratified Defaults</span>
                  </button>
                </div>
              )}
            </div>

            {/* Edit role... Button (Solid blue primary) */}
            <button
              onClick={() => {
                setDrawerRole(roles[0]);
                showToast(`Opening Edit Role drawer for ${roles[0].name}`, 'info');
              }}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
            >
              Edit role...
            </button>
          </div>
        </div>

        {/* Filter Strip with Dropdowns, Search Input, and Diff Toggle */}
        <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-600">Domain:</label>
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 focus:outline-hidden"
            >
              <option value="All">All</option>
              <option value="Service Operations">Service Operations</option>
              <option value="Security & Gate">Security &amp; Gate</option>
              <option value="Workshop">Workshop</option>
              <option value="Billing & Accounts">Billing &amp; Accounts</option>
              <option value="Administration">Administration</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-slate-600">Service:</label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 focus:outline-hidden"
            >
              <option value="All">All</option>
              <option value="Appointment">Appointment</option>
              <option value="Gate">Gate</option>
              <option value="Job Card">Job Card</option>
              <option value="Estimation">Estimation</option>
              <option value="Bay">Bay</option>
              <option value="Configuration & Admin">Configuration &amp; Admin</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Search permission code..."
              className="w-full pl-8 pr-3 py-1 rounded-lg border border-slate-200 bg-white text-xs font-mono placeholder:font-sans focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 pl-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={onlyDiffersFromBaseline}
                onChange={(e) => setOnlyDiffersFromBaseline(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className="text-[11px] font-medium text-slate-600">
              Only rows that differ from baseline
            </span>
          </div>
        </div>

        {/* Legend Bar (Exact text & badge pills from screenshot) */}
        <div className="flex flex-wrap items-center gap-5 text-xs py-1 px-1 text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1a202c] text-white tracking-wider">
              REQUIRED
            </span>
            <span className="text-[11px] text-slate-500">Always on — dealers can't change</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100/90 text-blue-700 tracking-wider">
              DEFAULT
            </span>
            <span className="text-[11px] text-slate-500">On by default — dealers may revoke</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-blue-400 bg-white text-blue-600 tracking-wider">
              GRANTABLE
            </span>
            <span className="text-[11px] text-slate-500">Off by default — dealers may grant</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-400 text-sm">—</span>
            <span className="text-[11px] text-slate-500">Never allowed for this role</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MATRIX TABLE (Pixel-perfect columns, headers, groupings, and cells)       */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              {/* Table Header: Roles with User Counts */}
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="py-3 px-4 min-w-[220px] font-semibold text-slate-600 uppercase text-[11px] tracking-wider">
                    Permission
                  </th>
                  {roles.map((r) => (
                    <th
                      key={r.id}
                      onClick={() => setDrawerRole(r)}
                      className="py-3 px-3 min-w-[120px] text-center hover:bg-blue-50/60 transition-colors cursor-pointer group"
                      title="Click role column header to open the Edit role drawer (0-2)"
                    >
                      <div className="font-bold text-blue-900 group-hover:text-blue-600 transition-colors">
                        {r.name}
                      </div>
                      <div
                        className={`text-[10px] font-medium mt-0.5 ${
                          r.isNotConfigured ? 'text-rose-600 font-bold' : 'text-slate-400'
                        }`}
                      >
                        {r.isNotConfigured ? 'Not configured' : r.userCount}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {Object.entries(groupedPermissions).map(([groupName, rowList]) => (
                  <React.Fragment key={groupName}>
                    {/* Group Header Row (e.g. Appointment, Gate, Job Card, Estimation, Bay, Configuration & Admin) */}
                    <tr className="bg-slate-50/90 font-bold text-slate-900 text-[11px] uppercase tracking-wider">
                      <td colSpan={roles.length + 1} className="py-2.5 px-4 bg-slate-100/60 text-slate-800">
                        {groupName}
                      </td>
                    </tr>

                    {/* Permissions in this group */}
                    {rowList.map((row) => (
                      <tr key={row.code} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-900 text-xs">
                            {row.code}
                          </div>
                          <div className="text-[11px] text-slate-500 font-normal">
                            {row.description}
                          </div>
                        </td>

                        {/* Role Columns */}
                        {roles.map((r) => {
                          const tier = row.roles[r.id as keyof PermissionRow['roles']];
                          return (
                            <td
                              key={r.id}
                              onClick={() => handleCellClick(row.code, r.id as keyof PermissionRow['roles'])}
                              onMouseEnter={() =>
                                setHoveredCell({
                                  permCode: row.code,
                                  roleId: r.id,
                                  tier,
                                  baselineTier: tier,
                                })
                              }
                              onMouseLeave={() => setHoveredCell(null)}
                              className="py-3 px-3 text-center cursor-pointer hover:bg-slate-100/60 transition-colors"
                            >
                              {renderTierPill(tier)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
            <div>
              <span>
                Showing {filteredPermissions.length} of 23 permissions
              </span>
              <span className="mx-2">•</span>
              <span className="text-slate-400">
                3 SA Assignment permissions hidden by filter
              </span>
            </div>

            <div className="font-mono text-[11px] text-slate-400">
              Ratified baseline v1.0.0 • Last change: Rohan Mehta, 29 Sep 2026 16:42
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DESIGNER NOTES CARD (Yellow callout box exactly matching screenshot)     */}
        {/* ========================================================================= */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 space-y-1 shadow-2xs">
          <div className="font-bold text-amber-950 mb-1">
            Designer notes
          </div>
          <ul className="space-y-1 text-[11px] text-amber-900/90 list-disc list-inside">
            <li>
              Click a role column header <span className="font-mono font-bold">→</span> opens the Edit role drawer (0-2) for that role.
            </li>
            <li>
              Hover a cell <span className="font-mono font-bold">→</span> tooltip with the tier meaning and the ratified baseline value when different.
            </li>
            <li>
              CRO has no Required permission yet <span className="font-mono font-bold">→</span> column shows "Not configured" (users in this role can do nothing).
            </li>
            <li>
              Export CSV and "Compare with ratified baseline" live in the More menu.
            </li>
          </ul>
        </div>
        </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. EDIT ROLE DRAWER (Opens when clicking any role header or Edit role...) */}
      {/* ========================================================================= */}
      {drawerRole && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-2xs animate-fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between border-l border-slate-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900">
                    ROLE DRAWER (0-2)
                  </span>
                  {drawerRole.isNotConfigured && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                      NOT CONFIGURED
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {drawerRole.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {drawerRole.userCount} across dealership network
                </p>
              </div>

              <button
                onClick={() => setDrawerRole(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-5 space-y-5 overflow-y-auto text-xs text-slate-700 flex-1">
              <div>
                <label className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block mb-1">
                  Role Description &amp; Scope
                </label>
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {drawerRole.description}
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block mb-1.5">
                  Assigned Platform Position Types
                </label>
                <div className="space-y-1.5">
                  {drawerRole.id === 'serviceAdvisor' && (
                    <>
                      <div className="p-2 rounded-lg border border-slate-200 bg-slate-50/50 flex justify-between items-center">
                        <span className="font-semibold text-slate-800">Senior Service Advisor (POS-SA-01)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Active</span>
                      </div>
                      <div className="p-2 rounded-lg border border-slate-200 bg-slate-50/50 flex justify-between items-center">
                        <span className="font-semibold text-slate-800">Junior Service Advisor (POS-SA-02)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Active</span>
                      </div>
                      <div className="p-2 rounded-lg border border-slate-200 bg-slate-50/50 flex justify-between items-center">
                        <span className="font-semibold text-slate-800">Express Care Advisor (POS-SA-03)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Active</span>
                      </div>
                    </>
                  )}
                  {drawerRole.id !== 'serviceAdvisor' && (
                    <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-500">
                      Standard platform position mapping active per HRMS synchronization.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block mb-1.5">
                  Tier Governance Policy
                </label>
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-start gap-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#1a202c] text-white">
                      REQUIRED
                    </span>
                    <span className="text-[11px] text-slate-600">
                      Cannot be turned off at the dealership level. Mandatory for audit compliance.
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-start gap-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700">
                      DEFAULT
                    </span>
                    <span className="text-[11px] text-slate-600">
                      Enabled automatically upon employee onboarding; dealership admin may revoke if needed.
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-start gap-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold border border-blue-400 bg-white text-blue-600">
                      GRANTABLE
                    </span>
                    <span className="text-[11px] text-slate-600">
                      Off by default; dealership admin may grant on an as-needed basis.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => setDrawerRole(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close Drawer
              </button>
              <button
                onClick={() => {
                  showToast(`Role changes ratified for ${drawerRole.name}`, 'success');
                  setDrawerRole(null);
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Save Role Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
