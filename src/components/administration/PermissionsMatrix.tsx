import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Shield,
  Search,
  CheckSquare,
  Square,
  MinusSquare,
  Check,
  X,
  RotateCcw,
  Save,
  Filter,
  Layers,
  Wrench,
  Building2,
  Sparkles,
  Info,
  Sliders,
  ChevronRight,
  Eye,
  PlusCircle,
  Edit3,
  Trash2,
} from 'lucide-react';

export interface CrudPermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface ModuleDefinition {
  id: string;
  name: string;
  category: 'Overview' | 'VS1 Operations' | 'VS2 Workshop' | 'Administration';
  description: string;
  icon?: string;
  badge?: string;
}

export interface RoleMatrixRecord {
  roleId: string;
  roleName: string;
  userCount: string;
  permissions: Record<string, CrudPermission>;
}

export const ALL_SYSTEM_MODULES: ModuleDefinition[] = [
  // Overview
  {
    id: 'dashboard',
    name: 'Dashboard',
    category: 'Overview',
    description: 'Executive KPI cards, workshop load metrics, live TAT SLA breaches, and Pan-India tracking',
    badge: 'Core',
  },
  {
    id: 'journey',
    name: 'TML Journey & Search',
    category: 'Overview',
    description: 'End-to-end unified customer vehicle timeline, stage transit logs, and dossier search',
    badge: 'Core',
  },

  // VS1 Operations
  {
    id: 'appointment',
    name: 'Appointment Scheduling',
    category: 'VS1 Operations',
    description: 'Service appointment bookings, slot intake allocation, emergency buffer caps',
    badge: 'VS1',
  },
  {
    id: 'reception',
    name: 'P&D and Reception',
    category: 'VS1 Operations',
    description: 'Pick & Drop transit queues, driver allocation, lounge customer greeting checklists',
    badge: 'VS1',
  },
  {
    id: 'security',
    name: 'Security & Gate Operations',
    category: 'VS1 Operations',
    description: 'Physical inward/outward vehicle check-in, barrier automation, visitor & pass logs',
    badge: 'VS1',
  },

  // VS2 Workshop
  {
    id: 'jc_creation',
    name: 'JC Creation',
    category: 'VS2 Workshop',
    description: 'Open repair orders, customer complaint capture, demanded work line codes, manual estimates',
    badge: 'VS2',
  },
  {
    id: 'jc_tracking',
    name: 'JC Tracking & Bay Dispatch',
    category: 'VS2 Workshop',
    description: 'Real-time bay occupancy, technician skill dispatch, stage transitions, bay transit',
    badge: 'VS2',
  },
  {
    id: 'spd',
    name: 'SPD (Spare Parts Dispatch)',
    category: 'VS2 Workshop',
    description: 'Spare parts requisition, stock bin checks, picking slip generation, counter issue',
    badge: 'VS2',
  },
  {
    id: 'thd',
    name: 'THD (Technical Help Desk)',
    category: 'VS2 Workshop',
    description: 'Field technical issue tickets to Tata Motors plant, TIB bulletin advisories, diagnostics',
    badge: 'VS2',
  },
  {
    id: 'eqc',
    name: 'EQC (Electronic Quality Check)',
    category: 'VS2 Workshop',
    description: 'Quality inspection checklists, road test records, torque verifications, rework routing',
    badge: 'VS2',
  },
  {
    id: 'claim',
    name: 'Claim & Warranty',
    category: 'VS2 Workshop',
    description: 'Warranty defect submissions, causal part tagging, insurance surveyor claims, AMC schemes',
    badge: 'VS2',
  },
  {
    id: 'bodyshop',
    name: 'BodyShop & Paint Operations',
    category: 'VS2 Workshop',
    description: 'Accident estimates, panel denting, heated spray booth schedules, paint formulation',
    badge: 'VS2',
  },
  {
    id: 'ira',
    name: 'IRA Connected Vehicle & EV',
    category: 'VS2 Workshop',
    description: 'Telematics alerts, high-voltage battery state-of-health, DTC fault codes, FOTA firmware',
    badge: 'VS2',
  },

  // Administration
  {
    id: 'masters',
    name: 'Masters Maintenance',
    category: 'Administration',
    description: 'Workshop bay configurations, dealer holiday calendars, hourly booking slot quotas',
    badge: 'Admin',
  },
  {
    id: 'users',
    name: 'User & Employee Management',
    category: 'Administration',
    description: 'Platform user provisioning, dealership employee rosters, credentials, account locking',
    badge: 'Admin',
  },
  {
    id: 'roles',
    name: 'Role & Access Control (RBAC)',
    category: 'Administration',
    description: 'Permission catalogue, position types, baseline ratification, tiered security rules',
    badge: 'Admin',
  },
  {
    id: 'devices',
    name: 'Device Management',
    category: 'Administration',
    description: 'Workshop tablets, IoT camera bindings, biometrics, hardware status authorizations',
    badge: 'Admin',
  },
  {
    id: 'sessions',
    name: 'Session Management',
    category: 'Administration',
    description: 'Active employee sessions, concurrent IP monitoring, remote session termination',
    badge: 'Admin',
  },
  {
    id: 'audit',
    name: 'Audit Log & Governance',
    category: 'Administration',
    description: 'Immutable system audit trail, security events, policy overrides, change histories',
    badge: 'Admin',
  },
];

// Initial default granular permissions mapped against roles
const INITIAL_ROLE_DATA: RoleMatrixRecord[] = [
  {
    roleId: 'serviceAdvisor',
    roleName: 'Service Advisor',
    userCount: '5,420 users',
    permissions: {
      dashboard: { view: true, create: false, edit: false, delete: false },
      journey: { view: true, create: false, edit: true, delete: false },
      appointment: { view: true, create: true, edit: true, delete: true },
      reception: { view: true, create: true, edit: true, delete: false },
      security: { view: true, create: false, edit: false, delete: false },
      jc_creation: { view: true, create: true, edit: true, delete: false },
      jc_tracking: { view: true, create: false, edit: true, delete: false },
      spd: { view: true, create: true, edit: false, delete: false },
      thd: { view: true, create: true, edit: true, delete: false },
      eqc: { view: true, create: false, edit: false, delete: false },
      claim: { view: true, create: true, edit: true, delete: false },
      bodyshop: { view: true, create: true, edit: true, delete: false },
      ira: { view: true, create: false, edit: false, delete: false },
      masters: { view: false, create: false, edit: false, delete: false },
      users: { view: false, create: false, edit: false, delete: false },
      roles: { view: false, create: false, edit: false, delete: false },
      devices: { view: false, create: false, edit: false, delete: false },
      sessions: { view: false, create: false, edit: false, delete: false },
      audit: { view: false, create: false, edit: false, delete: false },
    },
  },
  {
    roleId: 'receptionist',
    roleName: 'Receptionist',
    userCount: '1,180 users',
    permissions: {
      dashboard: { view: false, create: false, edit: false, delete: false },
      journey: { view: true, create: false, edit: false, delete: false },
      appointment: { view: true, create: true, edit: true, delete: true },
      reception: { view: true, create: true, edit: true, delete: false },
      security: { view: true, create: false, edit: false, delete: false },
      jc_creation: { view: true, create: false, edit: false, delete: false },
      jc_tracking: { view: true, create: false, edit: false, delete: false },
      spd: { view: false, create: false, edit: false, delete: false },
      thd: { view: false, create: false, edit: false, delete: false },
      eqc: { view: false, create: false, edit: false, delete: false },
      claim: { view: false, create: false, edit: false, delete: false },
      bodyshop: { view: false, create: false, edit: false, delete: false },
      ira: { view: false, create: false, edit: false, delete: false },
      masters: { view: false, create: false, edit: false, delete: false },
      users: { view: false, create: false, edit: false, delete: false },
      roles: { view: false, create: false, edit: false, delete: false },
      devices: { view: false, create: false, edit: false, delete: false },
      sessions: { view: false, create: false, edit: false, delete: false },
      audit: { view: false, create: false, edit: false, delete: false },
    },
  },
  {
    roleId: 'securityGuard',
    roleName: 'Security Guard',
    userCount: '1,060 users',
    permissions: {
      dashboard: { view: false, create: false, edit: false, delete: false },
      journey: { view: true, create: false, edit: false, delete: false },
      appointment: { view: true, create: false, edit: false, delete: false },
      reception: { view: false, create: false, edit: false, delete: false },
      security: { view: true, create: true, edit: true, delete: false },
      jc_creation: { view: false, create: false, edit: false, delete: false },
      jc_tracking: { view: false, create: false, edit: false, delete: false },
      spd: { view: false, create: false, edit: false, delete: false },
      thd: { view: false, create: false, edit: false, delete: false },
      eqc: { view: false, create: false, edit: false, delete: false },
      claim: { view: false, create: false, edit: false, delete: false },
      bodyshop: { view: false, create: false, edit: false, delete: false },
      ira: { view: false, create: false, edit: false, delete: false },
      masters: { view: false, create: false, edit: false, delete: false },
      users: { view: false, create: false, edit: false, delete: false },
      roles: { view: false, create: false, edit: false, delete: false },
      devices: { view: false, create: false, edit: false, delete: false },
      sessions: { view: false, create: false, edit: false, delete: false },
      audit: { view: false, create: false, edit: false, delete: false },
    },
  },
  {
    roleId: 'driver',
    roleName: 'Driver',
    userCount: '3,300 users',
    permissions: {
      dashboard: { view: false, create: false, edit: false, delete: false },
      journey: { view: true, create: false, edit: false, delete: false },
      appointment: { view: false, create: false, edit: false, delete: false },
      reception: { view: true, create: false, edit: true, delete: false },
      security: { view: true, create: false, edit: false, delete: false },
      jc_creation: { view: false, create: false, edit: false, delete: false },
      jc_tracking: { view: true, create: false, edit: false, delete: false },
      spd: { view: false, create: false, edit: false, delete: false },
      thd: { view: false, create: false, edit: false, delete: false },
      eqc: { view: false, create: false, edit: false, delete: false },
      claim: { view: false, create: false, edit: false, delete: false },
      bodyshop: { view: false, create: false, edit: false, delete: false },
      ira: { view: false, create: false, edit: false, delete: false },
      masters: { view: false, create: false, edit: false, delete: false },
      users: { view: false, create: false, edit: false, delete: false },
      roles: { view: false, create: false, edit: false, delete: false },
      devices: { view: false, create: false, edit: false, delete: false },
      sessions: { view: false, create: false, edit: false, delete: false },
      audit: { view: false, create: false, edit: false, delete: false },
    },
  },
  {
    roleId: 'dgm',
    roleName: 'DGM (Deputy General Manager)',
    userCount: '410 users',
    permissions: {
      dashboard: { view: true, create: false, edit: true, delete: false },
      journey: { view: true, create: false, edit: true, delete: false },
      appointment: { view: true, create: true, edit: true, delete: true },
      reception: { view: true, create: false, edit: true, delete: false },
      security: { view: true, create: false, edit: false, delete: false },
      jc_creation: { view: true, create: true, edit: true, delete: false },
      jc_tracking: { view: true, create: false, edit: true, delete: false },
      spd: { view: true, create: false, edit: true, delete: false },
      thd: { view: true, create: true, edit: true, delete: false },
      eqc: { view: true, create: true, edit: true, delete: false },
      claim: { view: true, create: true, edit: true, delete: true },
      bodyshop: { view: true, create: true, edit: true, delete: false },
      ira: { view: true, create: false, edit: false, delete: false },
      masters: { view: true, create: false, edit: true, delete: false },
      users: { view: true, create: false, edit: true, delete: false },
      roles: { view: true, create: false, edit: false, delete: false },
      devices: { view: true, create: false, edit: false, delete: false },
      sessions: { view: true, create: false, edit: false, delete: false },
      audit: { view: true, create: false, edit: false, delete: false },
    },
  },
  {
    roleId: 'dealerAdmin',
    roleName: 'Dealer Admin',
    userCount: '480 users',
    permissions: {
      dashboard: { view: true, create: false, edit: true, delete: false },
      journey: { view: true, create: false, edit: true, delete: false },
      appointment: { view: true, create: true, edit: true, delete: true },
      reception: { view: true, create: true, edit: true, delete: true },
      security: { view: true, create: true, edit: true, delete: false },
      jc_creation: { view: true, create: true, edit: true, delete: false },
      jc_tracking: { view: true, create: true, edit: true, delete: false },
      spd: { view: true, create: true, edit: true, delete: false },
      thd: { view: true, create: true, edit: true, delete: false },
      eqc: { view: true, create: true, edit: true, delete: false },
      claim: { view: true, create: true, edit: true, delete: false },
      bodyshop: { view: true, create: true, edit: true, delete: false },
      ira: { view: true, create: true, edit: true, delete: false },
      masters: { view: true, create: true, edit: true, delete: true },
      users: { view: true, create: true, edit: true, delete: true },
      roles: { view: true, create: false, edit: true, delete: false },
      devices: { view: true, create: true, edit: true, delete: true },
      sessions: { view: true, create: false, edit: true, delete: true },
      audit: { view: true, create: false, edit: false, delete: false },
    },
  },
  {
    roleId: 'superAdmin',
    roleName: 'Super Administrator (OEM)',
    userCount: '25 users',
    permissions: Object.fromEntries(
      ALL_SYSTEM_MODULES.map((m) => [m.id, { view: true, create: true, edit: true, delete: true }])
    ),
  },
];

interface PermissionsMatrixProps {
  onSaved?: () => void;
}

export const PermissionsMatrix: React.FC<PermissionsMatrixProps> = ({ onSaved }) => {
  const { showToast, logAudit } = useApp();

  const [roleMatrix, setRoleMatrix] = useState<RoleMatrixRecord[]>(INITIAL_ROLE_DATA);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('serviceAdvisor');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Active selected role data
  const currentRoleRecord = useMemo(() => {
    return roleMatrix.find((r) => r.roleId === selectedRoleId) || roleMatrix[0];
  }, [roleMatrix, selectedRoleId]);

  // Filtered Modules
  const filteredModules = useMemo(() => {
    return ALL_SYSTEM_MODULES.filter((mod) => {
      if (selectedCategory !== 'All' && mod.category !== selectedCategory) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesName = mod.name.toLowerCase().includes(q);
        const matchesDesc = mod.description.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [selectedCategory, searchFilter]);

  // Toggle single CRUD permission
  const handleToggle = (moduleId: string, action: keyof CrudPermission) => {
    setRoleMatrix((prev) =>
      prev.map((role) => {
        if (role.roleId !== selectedRoleId) return role;

        const currentPerm = role.permissions[moduleId] || {
          view: false,
          create: false,
          edit: false,
          delete: false,
        };

        const updatedPerm: CrudPermission = {
          ...currentPerm,
          [action]: !currentPerm[action],
        };

        // If action is create, edit, or delete, auto-enable view if turned on
        if (action !== 'view' && updatedPerm[action] && !updatedPerm.view) {
          updatedPerm.view = true;
        }

        // If view is disabled, disable create, edit, delete as well
        if (action === 'view' && !updatedPerm.view) {
          updatedPerm.create = false;
          updatedPerm.edit = false;
          updatedPerm.delete = false;
        }

        return {
          ...role,
          permissions: {
            ...role.permissions,
            [moduleId]: updatedPerm,
          },
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Bulk actions for entire column
  const handleToggleColumn = (action: keyof CrudPermission, value: boolean) => {
    setRoleMatrix((prev) =>
      prev.map((role) => {
        if (role.roleId !== selectedRoleId) return role;

        const newPermissions = { ...role.permissions };
        filteredModules.forEach((mod) => {
          const existing = newPermissions[mod.id] || {
            view: false,
            create: false,
            edit: false,
            delete: false,
          };
          const updated = { ...existing, [action]: value };

          if (action !== 'view' && value && !updated.view) {
            updated.view = true;
          }
          if (action === 'view' && !value) {
            updated.create = false;
            updated.edit = false;
            updated.delete = false;
          }
          newPermissions[mod.id] = updated;
        });

        return { ...role, permissions: newPermissions };
      })
    );
    setHasUnsavedChanges(true);
    showToast(`Set ${action.toUpperCase()} to ${value ? 'ON' : 'OFF'} for ${currentRoleRecord.roleName}`, 'info');
  };

  // Preset Grants
  const handleApplyPreset = (preset: 'FULL_CRUD' | 'READ_ONLY' | 'REVOKE_ALL') => {
    setRoleMatrix((prev) =>
      prev.map((role) => {
        if (role.roleId !== selectedRoleId) return role;

        const newPermissions = { ...role.permissions };
        filteredModules.forEach((mod) => {
          if (preset === 'FULL_CRUD') {
            newPermissions[mod.id] = { view: true, create: true, edit: true, delete: true };
          } else if (preset === 'READ_ONLY') {
            newPermissions[mod.id] = { view: true, create: false, edit: false, delete: false };
          } else {
            newPermissions[mod.id] = { view: false, create: false, edit: false, delete: false };
          }
        });

        return { ...role, permissions: newPermissions };
      })
    );
    setHasUnsavedChanges(true);
    showToast(`Applied preset: ${preset} to ${currentRoleRecord.roleName}`, 'success');
  };

  // Save changes
  const handleSaveMatrix = () => {
    setHasUnsavedChanges(false);
    logAudit(
      'Permissions Matrix Saved',
      'Administration',
      `Role Permission Matrix (${currentRoleRecord.roleName})`,
      'Previous Matrix',
      `${stats.viewCount} view / ${stats.createCount} create / ${stats.editCount} edit / ${stats.deleteCount} delete grants`
    );
    showToast(`Permissions Matrix ratified for ${currentRoleRecord.roleName}!`, 'success');
    if (onSaved) onSaved();
  };

  // Calculation stats for current role
  const stats = useMemo(() => {
    let viewCount = 0;
    let createCount = 0;
    let editCount = 0;
    let deleteCount = 0;

    ALL_SYSTEM_MODULES.forEach((m) => {
      const p = currentRoleRecord.permissions[m.id];
      if (p?.view) viewCount++;
      if (p?.create) createCount++;
      if (p?.edit) editCount++;
      if (p?.delete) deleteCount++;
    });

    return {
      total: ALL_SYSTEM_MODULES.length,
      viewCount,
      createCount,
      editCount,
      deleteCount,
    };
  }, [currentRoleRecord]);

  return (
    <div className="space-y-4 text-slate-800">
      {/* Top Banner: Role Selector & Quick Presets */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                Granular RBAC Architecture
              </span>
              <span className="h-1 w-1 rounded-full bg-blue-400" />
              <span className="text-xs text-blue-200 font-mono">Module-Level CRUD Matrix</span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              Permissions Matrix
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Configure granular View, Create, Edit, and Delete privileges for each system module mapped against user roles across VS1 and VS2.
            </p>
          </div>

          {/* Role Selector Pill Box */}
          <div className="flex items-center gap-2 bg-slate-950/80 p-2 rounded-xl border border-blue-400/30">
            <label className="text-xs font-bold text-blue-200">Role:</label>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="bg-blue-900/90 text-white border border-blue-400/50 rounded-lg px-3 py-1.5 font-bold text-xs focus:outline-hidden cursor-pointer"
            >
              {roleMatrix.map((r) => (
                <option key={r.roleId} value={r.roleId}>
                  {r.roleName} ({r.userCount})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Role Tabs & Summary Meters */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {roleMatrix.map((r) => (
              <button
                key={r.roleId}
                onClick={() => setSelectedRoleId(r.roleId)}
                className={`px-3 py-1 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                  selectedRoleId === r.roleId
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {r.roleName}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-blue-200">
            <span>
              View: <strong className="text-white">{stats.viewCount}</strong>/{stats.total}
            </span>
            <span>•</span>
            <span>
              Create: <strong className="text-white">{stats.createCount}</strong>/{stats.total}
            </span>
            <span>•</span>
            <span>
              Edit: <strong className="text-white">{stats.editCount}</strong>/{stats.total}
            </span>
            <span>•</span>
            <span>
              Delete: <strong className="text-white">{stats.deleteCount}</strong>/{stats.total}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Presets Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-800 focus:outline-hidden"
            >
              <option value="All">All Modules ({ALL_SYSTEM_MODULES.length})</option>
              <option value="Overview">Overview &amp; Analytics (2)</option>
              <option value="VS1 Operations">VS1 Service Operations (3)</option>
              <option value="VS2 Workshop">VS2 Workshop Core (8)</option>
              <option value="Administration">Administration &amp; Masters (6)</option>
            </select>
          </div>

          <div className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter modules..."
              className="w-full pl-8 pr-3 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs placeholder:text-slate-400 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Preset Action Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">Presets:</span>
          <button
            onClick={() => handleApplyPreset('FULL_CRUD')}
            className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] cursor-pointer"
          >
            Grant Full CRUD
          </button>
          <button
            onClick={() => handleApplyPreset('READ_ONLY')}
            className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] cursor-pointer"
          >
            Read Only
          </button>
          <button
            onClick={() => handleApplyPreset('REVOKE_ALL')}
            className="px-2.5 py-1 rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] cursor-pointer"
          >
            Revoke All
          </button>

          <button
            onClick={handleSaveMatrix}
            disabled={!hasUnsavedChanges}
            className={`flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-bold shadow-xs transition-all ${
              hasUnsavedChanges
                ? 'bg-blue-900 hover:bg-blue-800 text-white cursor-pointer'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Matrix {hasUnsavedChanges ? '*' : ''}</span>
          </button>
        </div>
      </div>

      {/* Main CRUD Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#002B49] text-white font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 min-w-[280px]">Module Name &amp; Functional Scope</th>
                <th className="py-3 px-3 w-32">Classification</th>
                <th className="py-3 px-4 text-center w-28">
                  <div className="flex flex-col items-center gap-1">
                    <span className="flex items-center gap-1 font-bold">
                      <Eye className="h-3.5 w-3.5 text-blue-300" />
                      View
                    </span>
                    <div className="flex items-center gap-1 text-[9px] font-normal lowercase">
                      <button
                        onClick={() => handleToggleColumn('view', true)}
                        className="hover:underline text-blue-200 cursor-pointer"
                      >
                        all
                      </button>
                      <span>/</span>
                      <button
                        onClick={() => handleToggleColumn('view', false)}
                        className="hover:underline text-blue-200 cursor-pointer"
                      >
                        none
                      </button>
                    </div>
                  </div>
                </th>

                <th className="py-3 px-4 text-center w-28">
                  <div className="flex flex-col items-center gap-1">
                    <span className="flex items-center gap-1 font-bold">
                      <PlusCircle className="h-3.5 w-3.5 text-emerald-300" />
                      Create
                    </span>
                    <div className="flex items-center gap-1 text-[9px] font-normal lowercase">
                      <button
                        onClick={() => handleToggleColumn('create', true)}
                        className="hover:underline text-blue-200 cursor-pointer"
                      >
                        all
                      </button>
                      <span>/</span>
                      <button
                        onClick={() => handleToggleColumn('create', false)}
                        className="hover:underline text-blue-200 cursor-pointer"
                      >
                        none
                      </button>
                    </div>
                  </div>
                </th>

                <th className="py-3 px-4 text-center w-28">
                  <div className="flex flex-col items-center gap-1">
                    <span className="flex items-center gap-1 font-bold">
                      <Edit3 className="h-3.5 w-3.5 text-amber-300" />
                      Edit
                    </span>
                    <div className="flex items-center gap-1 text-[9px] font-normal lowercase">
                      <button
                        onClick={() => handleToggleColumn('edit', true)}
                        className="hover:underline text-blue-200 cursor-pointer"
                      >
                        all
                      </button>
                      <span>/</span>
                      <button
                        onClick={() => handleToggleColumn('edit', false)}
                        className="hover:underline text-blue-200 cursor-pointer"
                      >
                        none
                      </button>
                    </div>
                  </div>
                </th>

                <th className="py-3 px-4 text-center w-28">
                  <div className="flex flex-col items-center gap-1">
                    <span className="flex items-center gap-1 font-bold">
                      <Trash2 className="h-3.5 w-3.5 text-rose-300" />
                      Delete
                    </span>
                    <div className="flex items-center gap-1 text-[9px] font-normal lowercase">
                      <button
                        onClick={() => handleToggleColumn('delete', true)}
                        className="hover:underline text-blue-200 cursor-pointer"
                      >
                        all
                      </button>
                      <span>/</span>
                      <button
                        onClick={() => handleToggleColumn('delete', false)}
                        className="hover:underline text-blue-200 cursor-pointer"
                      >
                        none
                      </button>
                    </div>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredModules.map((mod) => {
                const perm = currentRoleRecord.permissions[mod.id] || {
                  view: false,
                  create: false,
                  edit: false,
                  delete: false,
                };

                return (
                  <tr key={mod.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Module Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{mod.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">
                          {mod.id}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-normal mt-0.5 line-clamp-1">
                        {mod.description}
                      </p>
                    </td>

                    {/* Category Badge */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          mod.category === 'VS1 Operations'
                            ? 'bg-blue-100 text-blue-800'
                            : mod.category === 'VS2 Workshop'
                            ? 'bg-indigo-100 text-indigo-800'
                            : mod.category === 'Administration'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {mod.category}
                      </span>
                    </td>

                    {/* VIEW Checkbox */}
                    <td
                      onClick={() => handleToggle(mod.id, 'view')}
                      className="py-3 px-4 text-center cursor-pointer hover:bg-blue-50/50 transition-colors"
                    >
                      <div className="inline-flex items-center justify-center p-1 rounded-md hover:bg-slate-200/60">
                        {perm.view ? (
                          <div className="h-5 w-5 rounded bg-blue-600 text-white flex items-center justify-center shadow-2xs">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded border-2 border-slate-300 bg-white" />
                        )}
                      </div>
                    </td>

                    {/* CREATE Checkbox */}
                    <td
                      onClick={() => handleToggle(mod.id, 'create')}
                      className="py-3 px-4 text-center cursor-pointer hover:bg-emerald-50/50 transition-colors"
                    >
                      <div className="inline-flex items-center justify-center p-1 rounded-md hover:bg-slate-200/60">
                        {perm.create ? (
                          <div className="h-5 w-5 rounded bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded border-2 border-slate-300 bg-white" />
                        )}
                      </div>
                    </td>

                    {/* EDIT Checkbox */}
                    <td
                      onClick={() => handleToggle(mod.id, 'edit')}
                      className="py-3 px-4 text-center cursor-pointer hover:bg-amber-50/50 transition-colors"
                    >
                      <div className="inline-flex items-center justify-center p-1 rounded-md hover:bg-slate-200/60">
                        {perm.edit ? (
                          <div className="h-5 w-5 rounded bg-amber-500 text-white flex items-center justify-center shadow-2xs">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded border-2 border-slate-300 bg-white" />
                        )}
                      </div>
                    </td>

                    {/* DELETE Checkbox */}
                    <td
                      onClick={() => handleToggle(mod.id, 'delete')}
                      className="py-3 px-4 text-center cursor-pointer hover:bg-rose-50/50 transition-colors"
                    >
                      <div className="inline-flex items-center justify-center p-1 rounded-md hover:bg-slate-200/60">
                        {perm.delete ? (
                          <div className="h-5 w-5 rounded bg-rose-600 text-white flex items-center justify-center shadow-2xs">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded border-2 border-slate-300 bg-white" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">
              Active Role: {currentRoleRecord.roleName}
            </span>
            <span>•</span>
            <span>Showing {filteredModules.length} of {ALL_SYSTEM_MODULES.length} system modules</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRoleMatrix(INITIAL_ROLE_DATA);
                setHasUnsavedChanges(false);
                showToast('Reset permissions to system factory defaults', 'info');
              }}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset to Defaults</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
