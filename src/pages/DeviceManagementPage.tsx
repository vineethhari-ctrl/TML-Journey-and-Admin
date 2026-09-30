import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Device, DeviceStatus, DeviceType } from '../types';
import { DeviceDetailModal } from '../components/administration/DeviceDetailModal';
import { Pagination } from '../components/common/Pagination';
import {
  Smartphone,
  Laptop,
  Monitor,
  Tablet,
  Wrench,
  Search,
  Filter,
  ShieldAlert,
  ShieldCheck,
  LogOut,
  Eye,
} from 'lucide-react';

export const DeviceManagementPage: React.FC = () => {
  const { devices, blockDevice, unblockDevice, forceLogoutDevice } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<DeviceType | 'ALL'>('ALL');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  // Filtered devices
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          d.deviceId.toLowerCase().includes(q) ||
          d.assignedUserName.toLowerCase().includes(q) ||
          d.assignedUser.toLowerCase().includes(q) ||
          d.ipAddress.includes(q) ||
          d.location.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && d.deviceType !== typeFilter) return false;

      return true;
    });
  }, [devices, searchQuery, statusFilter, typeFilter]);

  const totalItems = filteredDevices.length;
  const paginatedDevices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDevices.slice(start, start + pageSize);
  }, [filteredDevices, currentPage, pageSize]);

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'Laptop':
        return <Laptop className="h-4 w-4 text-blue-600" />;
      case 'Tablet':
        return <Tablet className="h-4 w-4 text-purple-600" />;
      case 'Mobile':
        return <Smartphone className="h-4 w-4 text-emerald-600" />;
      case 'Workshop Device':
        return <Wrench className="h-4 w-4 text-amber-600" />;
      default:
        return <Monitor className="h-4 w-4 text-indigo-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
              Zero-Trust Device Registry
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-medium text-slate-500">Hardware Access Control</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
            Device Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authorize workshop tablets, diagnostic laptops, mobile scanners, and office workstations
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Registered Devices</span>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">391</p>
          <span className="text-[11px] text-slate-500">Enrolled in MDM</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase">Active</span>
          <p className="text-2xl font-extrabold text-emerald-950 mt-1">362</p>
          <span className="text-[11px] text-emerald-700 font-medium">Valid trust tokens</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Inactive</span>
          <p className="text-2xl font-extrabold text-slate-700 mt-1">21</p>
          <span className="text-[11px] text-slate-400">No activity &gt; 30d</span>
        </div>
        <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-200 shadow-2xs">
          <span className="text-[11px] font-bold text-rose-700 uppercase">Blocked</span>
          <p className="text-2xl font-extrabold text-rose-950 mt-1">8</p>
          <span className="text-[11px] text-rose-700 font-medium">Quarantined endpoints</span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Table filter controls */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Search device ID, user, IP..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2" />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value as DeviceType | 'ALL');
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium text-xs cursor-pointer"
              >
                <option value="ALL">All Device Types</option>
                <option value="Workshop Device">Workshop Device</option>
                <option value="Tablet">Tablet</option>
                <option value="Laptop">Laptop</option>
                <option value="Desktop">Desktop</option>
                <option value="Mobile">Mobile</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as DeviceStatus | 'ALL');
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium text-xs cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="BLOCKED">BLOCKED</option>
              </select>
            </div>
          </div>

          <span className="text-xs text-slate-400">
            Showing {paginatedDevices.length} of {totalItems} devices
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Device ID</th>
                <th className="py-3 px-3">Assigned User</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">OS & Browser</th>
                <th className="py-3 px-3">Last Seen</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedDevices.map((d) => {
                const isBlocked = d.status === 'BLOCKED';

                return (
                  <tr key={d.deviceId} className="hover:bg-slate-50/80 transition-colors">
                    {/* Device ID */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {d.deviceId}
                    </td>

                    {/* User */}
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-800 block">{d.assignedUserName}</span>
                      <span className="font-mono text-[11px] text-slate-400">{d.assignedUser}</span>
                    </td>

                    {/* Type */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        {getDeviceIcon(d.deviceType)}
                        <span className="font-medium text-slate-700">{d.deviceType}</span>
                      </div>
                    </td>

                    {/* OS & Browser */}
                    <td className="py-3 px-3">
                      <span className="text-slate-800 font-medium block truncate max-w-[150px]">
                        {d.operatingSystem}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate max-w-[150px] block">
                        {d.browser}
                      </span>
                    </td>

                    {/* Last seen */}
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {d.lastSeen}
                    </td>

                    {/* Location */}
                    <td className="py-3 px-3 text-slate-600 truncate max-w-[140px]">
                      {d.location}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : isBlocked
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedDevice(d)}
                          className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-slate-100"
                          title="View device specifications"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {isBlocked ? (
                          <button
                            onClick={() => unblockDevice(d.deviceId)}
                            className="p-1 rounded text-slate-400 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Unblock device"
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => blockDevice(d.deviceId)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Block device"
                          >
                            <ShieldAlert className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          onClick={() => forceLogoutDevice(d.deviceId)}
                          className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                          title="Force logout active sessions"
                        >
                          <LogOut className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Device Detail Modal */}
      <DeviceDetailModal
        device={selectedDevice}
        isOpen={Boolean(selectedDevice)}
        onClose={() => setSelectedDevice(null)}
      />
    </div>
  );
};
