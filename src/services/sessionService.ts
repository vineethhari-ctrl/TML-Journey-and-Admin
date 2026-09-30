import { Session, SessionStatus } from '../types';

export const sessionService = {
  getStatusBadge(status: SessionStatus) {
    switch (status) {
      case 'ACTIVE':
        return { label: 'Active', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'IDLE':
        return { label: 'Idle', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'TERMINATED':
        return { label: 'Terminated', bg: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
  },
};
