import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Session, SessionStatus } from '../types';
import { TerminateSessionModal } from '../components/administration/TerminateSessionModal';
import { Pagination } from '../components/common/Pagination';
import {
  Clock,
  LogOut,
  AlertOctagon,
  Search,
  Laptop,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const SessionManagementPage: React.FC = () => {
  const { sessions, terminateSession, terminateAllSessions } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'ALL'>('ALL');
  const [sessionToTerminate, setSessionToTerminate] = useState<Session | null>(null);
  const [isTerminateAllConfirmOpen, setIsTerminateAllConfirmOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          s.sessionId.toLowerCase().includes(q) ||
          s.userName.toLowerCase().includes(q) ||
          s.userId.toLowerCase().includes(q) ||
          s.ipAddress.includes(q) ||
          s.deviceType.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;

      return true;
    });
  }, [sessions, searchQuery, statusFilter]);

  const totalItems = filteredSessions.length;
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Active Session Control
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-medium text-slate-500">Live Enterprise Interventions</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
            Session Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time telemetry and immediate session revocation across workshop terminals and corporate portals
          </p>
        </div>

        <button
          onClick={() => setIsTerminateAllConfirmOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs shadow-2xs transition-all"
        >
          <AlertOctagon className="h-4 w-4" />
          <span>Terminate All User Sessions</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase">Active Sessions</span>
          <p className="text-2xl font-extrabold text-emerald-950 mt-1">276</p>
          <span className="text-[11px] text-emerald-700 font-medium">Encrypted JWT tokens</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-700 uppercase">Idle Sessions</span>
          <p className="text-2xl font-extrabold text-amber-950 mt-1">31</p>
          <span className="text-[11px] text-amber-700">No activity &gt; 15m</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Expired Today</span>
          <p className="text-2xl font-extrabold text-slate-700 mt-1">48</p>
          <span className="text-[11px] text-slate-400">Natural SLA timeout</span>
        </div>
        <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-200 shadow-2xs">
          <span className="text-[11px] font-bold text-rose-700 uppercase">Forced Logout</span>
          <p className="text-2xl font-extrabold text-rose-950 mt-1">7</p>
          <span className="text-[11px] text-rose-700 font-medium">Admin intervened</span>
        </div>
      </div>

      {/* Session Table Container */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Filter controls */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Search user, session ID, IP..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2" />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as SessionStatus | 'ALL');
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium text-xs cursor-pointer"
            >
              <option value="ALL">All Session Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="IDLE">IDLE</option>
              <option value="TERMINATED">TERMINATED</option>
            </select>
          </div>

          <span className="text-xs text-slate-400">
            Showing {paginatedSessions.length} of {totalItems} active records
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">User & Identity</th>
                <th className="py-3 px-3">Session ID</th>
                <th className="py-3 px-3">Device & Client</th>
                <th className="py-3 px-3">Login Time</th>
                <th className="py-3 px-3">Last Activity</th>
                <th className="py-3 px-3">IP Address</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedSessions.map((s) => (
                <tr key={s.sessionId} className="hover:bg-slate-50/80 transition-colors">
                  {/* User */}
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-900 block">{s.userName}</span>
                    <span className="font-mono text-[11px] text-slate-400">{s.userId}</span>
                  </td>

                  {/* Session ID */}
                  <td className="py-3 px-3 font-mono font-medium text-blue-900">
                    {s.sessionId}
                  </td>

                  {/* Device */}
                  <td className="py-3 px-3">
                    <span className="text-slate-800 font-medium block truncate max-w-[150px]">
                      {s.deviceType}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{s.deviceId}</span>
                  </td>

                  {/* Login Time */}
                  <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                    {s.loginTime}
                  </td>

                  {/* Last Activity */}
                  <td className="py-3 px-3 text-slate-600 whitespace-nowrap font-medium">
                    {s.lastActivity}
                  </td>

                  {/* IP */}
                  <td className="py-3 px-3 font-mono text-slate-600">
                    {s.ipAddress}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.status === 'IDLE'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="py-3 px-3 text-right">
                    {s.status !== 'TERMINATED' ? (
                      <button
                        onClick={() => setSessionToTerminate(s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold text-[11px] transition-colors"
                      >
                        <LogOut className="h-3 w-3" />
                        <span>Terminate</span>
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[11px] italic">Terminated</span>
                    )}
                  </td>
                </tr>
              ))}
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

      {/* Confirmation Modal for Individual Session */}
      <TerminateSessionModal
        session={sessionToTerminate}
        isOpen={Boolean(sessionToTerminate)}
        onClose={() => setSessionToTerminate(null)}
        onConfirm={() => {
          if (sessionToTerminate) terminateSession(sessionToTerminate.sessionId);
        }}
      />

      {/* Confirmation Dialog for Terminate All Sessions */}
      {isTerminateAllConfirmOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setIsTerminateAllConfirmOpen(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle className="h-6 w-6" />
                <h4 className="text-base font-bold text-slate-900">Terminate All User Sessions?</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                This will immediately invalidate active tokens for all connected dealership personnel, technicians, and advisors nationwide. Your current administrator session will remain protected.
              </p>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setIsTerminateAllConfirmOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    terminateAllSessions();
                    setIsTerminateAllConfirmOpen(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-rose-600 text-xs font-bold text-white hover:bg-rose-700"
                >
                  Confirm Mass Revocation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
