import React, { useState } from 'react';
import { Drawer } from '../common/Drawer';
import { AppUser } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  User,
  Shield,
  Smartphone,
  Clock,
  Activity,
  FileSpreadsheet,
  AlertOctagon,
  CheckCircle,
  RefreshCw,
  Edit,
} from 'lucide-react';

interface UserDetailDrawerProps {
  user: AppUser | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (user: AppUser) => void;
}

export const UserDetailDrawer: React.FC<UserDetailDrawerProps> = ({
  user,
  isOpen,
  onClose,
  onEdit,
}) => {
  const { devices, sessions, auditLogs, suspendUser, activateUser, resetUserSessions } = useApp();
  const [activeTab, setActiveTab] = useState<'profile' | 'access' | 'devices' | 'sessions' | 'activity' | 'audit'>('profile');

  if (!user) return null;

  const userDevices = devices.filter((d) => d.assignedUser === user.userId);
  const userSessions = sessions.filter((s) => s.userId === user.userId);
  const userAudits = auditLogs.filter((a) => a.userId === user.userId || a.entity.includes(user.userId));

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`${user.name}`}
      subtitle={`Employee ID: ${user.employeeId} • ${user.userId}`}
      width="2xl"
    >
      <div className="space-y-5 text-xs">
        {/* Top Identity Ribbon */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-base shadow-xs">
              {user.name.split(' ').map((n) => n[0]).join('')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900">{user.name}</h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  user.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : user.status === 'SUSPENDED'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {user.status}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                  {user.userType}
                </span>
              </div>
              <p className="text-slate-500 mt-0.5">{user.role} • {user.department}</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onEdit(user);
                onClose();
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
            >
              <Edit className="h-3 w-3" /> Edit
            </button>

            {user.status === 'ACTIVE' ? (
              <button
                onClick={() => suspendUser(user.userId)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-semibold"
              >
                <AlertOctagon className="h-3 w-3" /> Suspend
              </button>
            ) : (
              <button
                onClick={() => activateUser(user.userId)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-semibold"
              >
                <CheckCircle className="h-3 w-3" /> Activate
              </button>
            )}

            <button
              onClick={() => resetUserSessions(user.userId)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
              title="Reset all sessions"
            >
              <RefreshCw className="h-3 w-3" /> Reset Session
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 pb-1 overflow-x-auto">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'access', label: 'Access & Roles', icon: Shield },
            { id: 'devices', label: `Devices (${userDevices.length})`, icon: Smartphone },
            { id: 'sessions', label: `Sessions (${userSessions.length})`, icon: Clock },
            { id: 'activity', label: 'Activity Trace', icon: Activity },
            { id: 'audit', label: `Audit Log (${userAudits.length})`, icon: FileSpreadsheet },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-blue-50 text-blue-900 border border-blue-200 shadow-2xs'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Profile */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Employee ID</span>
                <span className="font-mono font-bold text-slate-800">{user.employeeId}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">User ID</span>
                <span className="font-mono font-bold text-blue-900">{user.userId}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">User Type</span>
                <span className="font-semibold text-slate-800">{user.userType}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Corporate Email</span>
                <span className="font-medium text-slate-800 truncate block">{user.email}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Mobile Number</span>
                <span className="font-medium text-slate-800">{user.mobile}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Department</span>
                <span className="font-medium text-slate-800">{user.department}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Zone & Region</span>
                <span className="font-medium text-slate-800">{user.zone} / {user.region}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Dealer Facility</span>
                <span className="font-medium text-slate-800 truncate block">{user.dealer}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Workshop / Bay</span>
                <span className="font-medium text-slate-800">{user.workshop}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Account Created</span>
                <span className="font-medium text-slate-800">{user.createdDate}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200 col-span-2">
                <span className="text-slate-400 block text-[11px]">Last Activity / Login</span>
                <span className="font-medium text-slate-800">{user.lastLogin}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Access & Roles */}
        {activeTab === 'access' && (
          <div className="space-y-4">
            <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-1">
              <h5 className="font-bold text-blue-950">Assigned Primary Role: {user.role}</h5>
              <p className="text-blue-800 text-[11px]">
                Inherited permissions configured by Super Administrators for module execution.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Service Module</th>
                    <th className="py-2 px-2 text-center">View</th>
                    <th className="py-2 px-2 text-center">Create</th>
                    <th className="py-2 px-2 text-center">Edit</th>
                    <th className="py-2 px-2 text-center">Approve</th>
                    <th className="py-2 px-2 text-center">Export</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {[
                    'Dashboard',
                    'TML Journey',
                    'JC Creation',
                    'JC Tracking',
                    'SPD',
                    'THD',
                    'EQC',
                    'Claim',
                    'BodyShop',
                    'IRA',
                  ].map((mod) => (
                    <tr key={mod} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-800">{mod}</td>
                      <td className="py-2 px-2 text-center">✓</td>
                      <td className="py-2 px-2 text-center">✓</td>
                      <td className="py-2 px-2 text-center">✓</td>
                      <td className="py-2 px-2 text-center">
                        {['JC Tracking', 'EQC'].includes(mod) ? '✓' : '—'}
                      </td>
                      <td className="py-2 px-2 text-center">✓</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Devices */}
        {activeTab === 'devices' && (
          <div className="space-y-3">
            {userDevices.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
                No enrolled devices registered for this user account.
              </div>
            ) : (
              userDevices.map((d) => (
                <div key={d.deviceId} className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 font-mono">{d.deviceId}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        d.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {d.status}
                      </span>
                    </div>
                    <p className="text-slate-500 mt-0.5">{d.deviceType} • {d.operatingSystem}</p>
                    <p className="text-slate-400 font-mono text-[10px]">IP: {d.ipAddress} • {d.location}</p>
                  </div>
                  <span className="text-[11px] text-slate-400">Seen: {d.lastSeen}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Sessions */}
        {activeTab === 'sessions' && (
          <div className="space-y-3">
            {userSessions.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
                No active or recent sessions recorded.
              </div>
            ) : (
              userSessions.map((s) => (
                <div key={s.sessionId} className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 font-mono">{s.sessionId}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-slate-500 mt-0.5">{s.deviceType} • {s.ipAddress}</p>
                    <p className="text-slate-400 text-[10px]">Login: {s.loginTime}</p>
                  </div>
                  <span className="text-[11px] text-slate-400">{s.lastActivity}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 5: Activity */}
        {activeTab === 'activity' && (
          <div className="p-6 bg-white rounded-xl border border-slate-200 space-y-3 font-mono text-[11px] text-slate-600">
            <div className="flex justify-between border-b pb-2">
              <span>[2026-09-30 14:15:00]</span>
              <span>Updated EQC inspection checkpoints for JC20260930001234</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span>[2026-09-30 11:57:00]</span>
              <span>Triggered THD diagnostic test sweep on EV transaxle</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span>[2026-09-30 09:12:00]</span>
              <span>Authenticated via Workshop Device DEV-AND-TAB-01</span>
            </div>
          </div>
        )}

        {/* Tab 6: Audit */}
        {activeTab === 'audit' && (
          <div className="space-y-2">
            {userAudits.map((a) => (
              <div key={a.id} className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">{a.action}</span>
                  <p className="text-slate-500 text-[10px]">{a.entity} • Status: {a.newValue}</p>
                </div>
                <span className="font-mono text-[10px] text-slate-400">{a.timestamp}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
};
