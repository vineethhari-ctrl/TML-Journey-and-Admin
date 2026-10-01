import React from 'react';
import {
  LayoutDashboard,
  Compass,
  Search,
  Users,
  Shield,
  Smartphone,
  Clock,
  Sliders,
  FileSpreadsheet,
  ChevronRight,
  Database,
  Layers,
  BookOpen,
  ClipboardCheck,
  ListChecks,
  Flame,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBays } from '../../context/BayContext';

export const Sidebar: React.FC = () => {
  const { currentRoute, navigate, canAccessRoute, activeRoleId } = useApp();
  const pendingBayRequests = useBays().requests.filter((r) => r.status === 'PENDING').length;

  const eqcOpen = currentRoute.startsWith('/admin/masters?') && currentRoute.includes('open=eqc');
  const bodyshopOpen = currentRoute.startsWith('/admin/masters?') && currentRoute.includes('open=bodyshop');
  const isCurrent = (route: string) => {
    if (route === '/admin/masters' && (eqcOpen || bodyshopOpen)) return false;
    if (route === '/journey' && (currentRoute === '/journey' || currentRoute.startsWith('/journey?'))) return true;
    if (route === '/journey/JC20260930001234' && currentRoute.startsWith('/journey/')) return true;
    return currentRoute.split('?')[0] === route;
  };

  const navItemClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
      active
        ? 'bg-blue-900 text-white font-semibold shadow-xs'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  const hasAnyAdminAccess =
    canAccessRoute('/admin/masters') ||
    canAccessRoute('/admin/users') ||
    canAccessRoute('/admin/roles') ||
    canAccessRoute('/admin/devices') ||
    canAccessRoute('/admin/sessions') ||
    canAccessRoute('/admin/config') ||
    canAccessRoute('/admin/audit');

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden select-none">
      {/* Scrollable navigation list - enables full scrolling with visible scrollbar */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Main Dashboard */}
        {canAccessRoute('/dashboard') && (
          <div>
            <button
              onClick={() => navigate('/dashboard')}
              className={`w-full cursor-pointer ${navItemClass(isCurrent('/dashboard'))}`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="flex-1 text-left">Dashboard</span>
            </button>
          </div>
        )}

        {/* Section 1: TML JOURNEY */}
        {(canAccessRoute('/journey') || canAccessRoute('/journey/JC20260930001234')) && (
          <div className="space-y-1">
            <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>TML Journey</span>
              <Compass className="h-3 w-3 text-blue-500" />
            </div>
            <p className="px-3 text-[10px] text-slate-400 mb-1.5">Cross-Module Visibility</p>

            {canAccessRoute('/journey/JC20260930001234') && (
              <button
                onClick={() => navigate('/journey/JC20260930001234')}
                className={`w-full cursor-pointer ${navItemClass(currentRoute.startsWith('/journey/JC'))}`}
              >
                <Layers className="h-4 w-4" />
                <span className="flex-1 text-left">Vehicle Journey</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-blue-100/60 text-blue-800 rounded font-mono">
                  MH01AB
                </span>
              </button>
            )}

            {canAccessRoute('/journey') && (
              <button
                onClick={() => navigate('/journey')}
                className={`w-full cursor-pointer ${navItemClass(currentRoute === '/journey' || currentRoute.startsWith('/journey?'))}`}
              >
                <Search className="h-4 w-4" />
                <span className="flex-1 text-left">Journey Search</span>
                <ChevronRight className="h-3 w-3 opacity-40" />
              </button>
            )}
          </div>
        )}

        {/* Section 2: ADMINISTRATION */}
        {hasAnyAdminAccess && (
          <div className="space-y-1">
            <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Administration</span>
              <Shield className="h-3 w-3 text-indigo-500" />
            </div>
            <p className="px-3 text-[10px] text-slate-400 mb-1.5">Access &amp; System Control</p>

            {canAccessRoute('/admin/masters') && (
              <button
                onClick={() => navigate('/admin/masters')}
                className={`w-full cursor-pointer ${navItemClass(isCurrent('/admin/masters'))}`}
              >
                <Database className="h-4 w-4" />
                <span className="flex-1 text-left">Masters Maintenance</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-900 rounded">
                  OEM/DLR
                </span>
              </button>
            )}

            {canAccessRoute('/admin/masters') && (
              <button
                onClick={() => {
                  navigate('/admin/masters?open=eqc');
                  // Re-open EQC even when the URL is already ?open=eqc (no route change to react to)
                  window.dispatchEvent(new CustomEvent('tml:open-masters', { detail: 'eqc' }));
                }}
                className={`w-full cursor-pointer ${navItemClass(eqcOpen)}`}
              >
                <ListChecks className="h-4 w-4" />
                <span className="flex-1 text-left">EQC Masters</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-teal-100 text-teal-900 rounded">EQC</span>
              </button>
            )}

            {canAccessRoute('/admin/masters') && (
              <button
                onClick={() => {
                  navigate('/admin/masters?open=bodyshop');
                  window.dispatchEvent(new CustomEvent('tml:open-masters', { detail: 'bodyshop' }));
                }}
                className={`w-full cursor-pointer ${navItemClass(bodyshopOpen)}`}
              >
                <Flame className="h-4 w-4" />
                <span className="flex-1 text-left">Bodyshop Masters</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded">BS</span>
              </button>
            )}

            {canAccessRoute('/admin/bay-approvals') && (
              <button
                onClick={() => navigate('/admin/bay-approvals')}
                className={`w-full cursor-pointer ${navItemClass(isCurrent('/admin/bay-approvals'))}`}
              >
                <ClipboardCheck className="h-4 w-4" />
                <span className="flex-1 text-left">Bay Approvals</span>
                {pendingBayRequests > 0 && (
                  <span data-testid="bay-approvals-count" className="text-[10px] font-bold px-1.5 rounded-full bg-amber-500 text-white">
                    {pendingBayRequests}
                  </span>
                )}
              </button>
            )}

            {canAccessRoute('/admin/masters-guide') && (
              <button
                onClick={() => navigate('/admin/masters-guide')}
                className={`w-full cursor-pointer ${navItemClass(isCurrent('/admin/masters-guide'))}`}
              >
                <BookOpen className="h-4 w-4" />
                <span className="flex-1 text-left">BA Guide: Masters</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-900 rounded">HELP</span>
              </button>
            )}

            {canAccessRoute('/admin/users') && (
              <button
                onClick={() => navigate('/admin/users')}
                className={`w-full cursor-pointer ${navItemClass(isCurrent('/admin/users'))}`}
              >
                <Users className="h-4 w-4" />
                <span className="flex-1 text-left">Employee / Users</span>
              </button>
            )}

            {canAccessRoute('/admin/roles') && (
              <button
                onClick={() => navigate('/admin/roles')}
                className={`w-full cursor-pointer ${navItemClass(isCurrent('/admin/roles'))}`}
              >
                <Shield className="h-4 w-4" />
                <span className="flex-1 text-left">Roles &amp; Access</span>
              </button>
            )}

            {canAccessRoute('/admin/devices') && (
              <button
                onClick={() => navigate('/admin/devices')}
                className={`w-full cursor-pointer ${navItemClass(isCurrent('/admin/devices'))}`}
              >
                <Smartphone className="h-4 w-4" />
                <span className="flex-1 text-left">Devices</span>
              </button>
            )}

            {canAccessRoute('/admin/sessions') && (
              <button
                onClick={() => navigate('/admin/sessions')}
                className={`w-full cursor-pointer ${navItemClass(isCurrent('/admin/sessions'))}`}
              >
                <Clock className="h-4 w-4" />
                <span className="flex-1 text-left">Sessions</span>
              </button>
            )}

            {canAccessRoute('/admin/config') && (
              <button
                onClick={() => navigate('/admin/config')}
                className={`w-full cursor-pointer ${navItemClass(isCurrent('/admin/config'))}`}
              >
                <Sliders className="h-4 w-4" />
                <span className="flex-1 text-left">Configuration</span>
              </button>
            )}

            {canAccessRoute('/admin/audit') && (
              <button
                onClick={() => navigate('/admin/audit')}
                className={`w-full cursor-pointer ${navItemClass(isCurrent('/admin/audit'))}`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span className="flex-1 text-left">Audit Log</span>
              </button>
            )}
          </div>
        )}

        {/* If Role has no permitted routes (like CRO) */}
        {!canAccessRoute('/dashboard') && !canAccessRoute('/journey') && !hasAnyAdminAccess && (
          <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800 space-y-1">
            <span className="font-bold block">Role: Not Configured</span>
            <p className="text-[11px] text-rose-700 leading-tight">
              Users in role <span className="font-bold">{activeRoleId}</span> have zero granted permissions in the baseline.
            </p>
          </div>
        )}

        {/* Footer System Status Information inside the scrollable container */}
        <div className="pt-2">
          <div className="p-3 border border-slate-200 bg-slate-50/80 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                <Database className="h-3 w-3 text-emerald-600" /> Service Modules Sync
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Aggregating 12 service modules across 580+ dealership workshops.
            </p>
            <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>v2.4.0-PROTOTYPE</span>
              <span>100% ONLINE</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
