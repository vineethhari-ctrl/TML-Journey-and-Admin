import React from 'react';
import { Modal } from '../common/Modal';
import { Device } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  Smartphone,
  Laptop,
  Monitor,
  Tablet,
  Wrench,
  ShieldAlert,
  ShieldCheck,
  LogOut,
  MapPin,
  Calendar,
  Activity,
} from 'lucide-react';

interface DeviceDetailModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({ device, isOpen, onClose }) => {
  const { blockDevice, unblockDevice, forceLogoutDevice, navigate } = useApp();

  if (!device) return null;

  const getDeviceIcon = (type: Device['deviceType']) => {
    switch (type) {
      case 'Laptop':
        return <Laptop className="h-5 w-5 text-blue-600" />;
      case 'Tablet':
        return <Tablet className="h-5 w-5 text-purple-600" />;
      case 'Mobile':
        return <Smartphone className="h-5 w-5 text-emerald-600" />;
      case 'Workshop Device':
        return <Wrench className="h-5 w-5 text-amber-600" />;
      default:
        return <Monitor className="h-5 w-5 text-indigo-600" />;
    }
  };

  const isBlocked = device.status === 'BLOCKED';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Device Specifications & Security"
      subtitle={`Enrolled Endpoint • ${device.deviceId}`}
      maxWidth="lg"
    >
      <div className="space-y-5 text-xs">
        {/* Device summary header */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
              {getDeviceIcon(device.deviceType)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{device.deviceId}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    device.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : isBlocked
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {device.status}
                </span>
              </div>
              <p className="text-slate-500 mt-0.5">{device.deviceType} • {device.operatingSystem}</p>
            </div>
          </div>
        </div>

        {/* Detailed Specs Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Assigned User</span>
            <span className="font-bold text-slate-800 text-sm block mt-0.5">
              {device.assignedUserName}
            </span>
            <span className="font-mono text-slate-500 text-[11px]">{device.assignedUser}</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Operating System</span>
            <span className="font-semibold text-slate-800 block mt-0.5">
              {device.operatingSystem}
            </span>
            <span className="text-slate-500 text-[11px]">{device.browser}</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Network IP & MAC</span>
            <span className="font-mono font-bold text-slate-800 block mt-0.5">
              {device.ipAddress}
            </span>
            <span className="font-mono text-slate-500 text-[11px]">{device.macAddress}</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px] flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Workshop Location
            </span>
            <span className="font-semibold text-slate-800 block mt-0.5">
              {device.location}
            </span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px] flex items-center gap-1">
              <Calendar className="h-3 w-3" /> First Enrolled
            </span>
            <span className="font-medium text-slate-700 block mt-0.5">
              {device.firstRegistered}
            </span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px] flex items-center gap-1">
              <Activity className="h-3 w-3" /> Last Active Heartbeat
            </span>
            <span className="font-medium text-slate-700 block mt-0.5">
              {device.lastSeen}
            </span>
          </div>
        </div>

        {/* Security Actions Bar */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            Administrative Device Actions
          </h5>
          <div className="flex flex-wrap gap-2.5">
            {isBlocked ? (
              <button
                onClick={() => {
                  unblockDevice(device.deviceId);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Unblock Device
              </button>
            ) : (
              <button
                onClick={() => {
                  blockDevice(device.deviceId);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Block Device
              </button>
            )}

            <button
              onClick={() => {
                forceLogoutDevice(device.deviceId);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-500" />
              Force Logout
            </button>

            <button
              onClick={() => {
                onClose();
                navigate(`/admin/audit?search=${encodeURIComponent(device.deviceId)}`);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
            >
              <Activity className="h-3.5 w-3.5 text-slate-500" />
              View Activity
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
