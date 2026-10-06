import React from 'react';
import { User, Shield, Laptop, LogOut, CheckCircle, Clock } from 'lucide-react';
import { Drawer } from '../common/Drawer';
import { useApp } from '../../context/AppContext';
import { clearPersonalisation, readPersonalisationSettings } from '../../utils/personalisationSettings';

interface UserProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileDrawer: React.FC<UserProfileDrawerProps> = ({ isOpen, onClose }) => {
  const { currentUser, showToast } = useApp();

  const handleLogout = () => {
    onClose();
    const kept = readPersonalisationSettings().keepAfterLogout;
    if (!kept) clearPersonalisation();
    showToast(
      kept
        ? 'Session logout simulated. Your personal layouts are kept for your next login.'
        : 'Session logout simulated. Tabs, cards and columns are back to the default view.',
      'info'
    );
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="User Profile & Session Details"
      subtitle="Authenticated Tata Motors Enterprise Identity"
      width="lg"
    >
      <div className="space-y-6 text-sm">
        {/* Profile Card */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="h-14 w-14 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {currentUser.name
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900">{currentUser.name}</h4>
            <p className="text-xs font-semibold text-blue-700">{currentUser.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{currentUser.department}</p>
          </div>
        </div>

        {/* Identity Details */}
        <div className="space-y-3">
          <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <User className="h-4 w-4 text-blue-600" />
            Identity Details
          </h5>
          <div className="grid grid-cols-2 gap-3 text-xs bg-white border border-slate-200 rounded-lg p-3.5">
            <div>
              <span className="text-slate-400 block text-[11px]">Employee ID</span>
              <span className="font-semibold text-slate-800 font-mono">{currentUser.employeeId}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">User ID</span>
              <span className="font-semibold text-slate-800 font-mono">{currentUser.userId}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Corporate Email</span>
              <span className="font-semibold text-slate-800 truncate block">{currentUser.email}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">User Type</span>
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                ADMIN (Enterprise)
              </span>
            </div>
          </div>
        </div>

        {/* Role & Privileges */}
        <div className="space-y-3">
          <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-emerald-600" />
            Assigned Role & Privileges
          </h5>
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950">{currentUser.role}</span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <CheckCircle className="h-3 w-3" /> Full Root Access
              </span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Authorized for end-to-end TML Journey lifecycle observation, user provisioning, access matrix changes, security policies, and real-time session interventions.
            </p>
          </div>
        </div>

        {/* Current Active Session */}
        <div className="space-y-3">
          <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Laptop className="h-4 w-4 text-purple-600" />
            Current Active Session
          </h5>
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Session ID</span>
              <span className="font-mono font-medium text-slate-800">SESS-20260930-9941</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Device</span>
              <span className="font-medium text-slate-800">Apple MacBook Pro (DEV-PO-LAPTOP-01)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Client IP</span>
              <span className="font-mono text-slate-800">192.168.1.108 (Corporate VPN)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Login Time</span>
              <span className="text-slate-800 flex items-center gap-1">
                <Clock className="h-3 w-3 text-slate-400" /> Today, 08:30 AM
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Session Status</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                Active & Encrypted
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-semibold text-xs transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Terminate Current Session & Logout
          </button>
        </div>
      </div>
    </Drawer>
  );
};
