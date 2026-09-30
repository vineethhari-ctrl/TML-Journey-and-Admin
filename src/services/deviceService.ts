import { Device, DeviceStatus } from '../types';

export const deviceService = {
  formatLastSeen(timestamp: string): string {
    return timestamp;
  },

  getStatusBadge(status: DeviceStatus) {
    switch (status) {
      case 'ACTIVE':
        return { label: 'Active', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'INACTIVE':
        return { label: 'Inactive', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
      case 'BLOCKED':
        return { label: 'Blocked', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
    }
  },
};
