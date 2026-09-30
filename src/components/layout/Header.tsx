import React, { useState } from 'react';
import { Search, Bell, ShieldCheck, ChevronDown, Sparkles, UserCheck } from 'lucide-react';
import { useApp, PlatformRoleId } from '../../context/AppContext';
import { NotificationCenter } from './NotificationCenter';
import { UserProfileDrawer } from './UserProfileDrawer';
import { GlobalSearchModal } from './GlobalSearchModal';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const { currentUser, unreadNotificationCount, activeRoleId, setActiveRoleId, showToast } = useApp();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6 shadow-2xs">
        {/* Left branding */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-2.5">
            {/* Tata Motors Enterprise Emblem */}
            <div className="flex items-center bg-[#002B49] text-white px-2.5 py-1 rounded-md font-bold tracking-wider text-xs shadow-xs border border-[#003B66]">
              TATA MOTORS
            </div>
            <div className="h-5 w-px bg-slate-300" />
            <div className="flex items-baseline gap-2">
              <span className="text-base font-extrabold text-slate-900 tracking-tight">
                Service Transformation
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                SERVICE PLATFORM
              </span>
            </div>
          </div>

          {/* Prototype Demo Banner */}
          <div className="hidden xl:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>LIVE RBAC ACTIVE</span>
          </div>
        </div>

        {/* Center Search Input Trigger */}
        <div className="flex-1 max-w-sm mx-3 hidden lg:block">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80 text-xs text-slate-500 hover:bg-slate-100/80 hover:border-slate-300 transition-all text-left shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <span>Search vehicle, JC, VIN...</span>
            </div>
            <kbd className="hidden xl:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Action Icons & Live Role Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Role Simulation Switcher (Enables live testing of screen visibility) */}
          <div className="flex items-center gap-1.5 bg-blue-50/80 px-2 py-1 rounded-lg border border-blue-200 text-xs">
            <UserCheck className="h-3.5 w-3.5 text-blue-700" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 hidden sm:inline">
              Role View:
            </span>
            <select
              value={activeRoleId}
              onChange={(e) => {
                const r = e.target.value as PlatformRoleId;
                setActiveRoleId(r);
                showToast(`Switched active view to: ${r}`, 'info');
              }}
              className="bg-white border border-blue-300 rounded px-2 py-0.5 text-xs font-bold text-blue-950 focus:outline-hidden cursor-pointer"
            >
              <option value="superAdmin">Super Administrator</option>
              <option value="serviceAdvisor">Service Advisor</option>
              <option value="receptionist">Receptionist</option>
              <option value="securityGuard">Security Guard</option>
              <option value="driver">Driver</option>
              <option value="dgm">DGM</option>
              <option value="dealerAdmin">Dealer Admin</option>
              <option value="cro">CRO (Telecaller)</option>
            </select>
          </div>

          {/* Mobile search button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Notifications bell */}
          <div className="relative">
            <button
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                setIsProfileOpen(false);
              }}
              className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
                  {unreadNotificationCount}
                </span>
              )}
            </button>
            <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* User Profile dropdown button */}
          <button
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-slate-100 transition-colors text-left cursor-pointer"
          >
            <div className="h-8 w-8 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-xs ring-2 ring-blue-100">
              {currentUser.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-900">{currentUser.name}</span>
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <span className="text-[10px] font-medium text-slate-500 block truncate max-w-[140px]">
                {currentUser.role}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
          </button>
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* User Profile Drawer */}
      <UserProfileDrawer isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
};
