import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useRouteSearchParam } from '../hooks/useRouteSearchParam';
import { AuditLogEntry } from '../types';
import { Pagination } from '../components/common/Pagination';
import {
  FileSpreadsheet,
  FileDown,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ShieldCheck,
} from 'lucide-react';

export const AuditLogPage: React.FC = () => {
  const { auditLogs, exportAuditLogs, currentRoute } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  useRouteSearchParam(setSearchQuery);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  // ?module=DPDP opens the DPDP access trail: who saw which customer's data, and when
  useEffect(() => {
    const m = new URLSearchParams(currentRoute.split('?')[1] || '').get('module');
    if (m) setModuleFilter(m);
  }, [currentRoute]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED' | 'WARNING'>('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          log.action.toLowerCase().includes(q) ||
          log.userName.toLowerCase().includes(q) ||
          log.userId.toLowerCase().includes(q) ||
          log.entity.toLowerCase().includes(q) ||
          log.ipAddress.includes(q);
        if (!match) return false;
      }

      if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
      if (moduleFilter !== 'ALL' && log.module !== moduleFilter) return false;
      if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;

      return true;
    });
  }, [auditLogs, searchQuery, actionFilter, moduleFilter, statusFilter]);

  const totalItems = filteredLogs.length;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const uniqueActions = Array.from(new Set(auditLogs.map((l) => l.action)));
  const uniqueModules = Array.from(new Set([...auditLogs.map((l) => l.module), 'DPDP']));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Enterprise Compliance & Audit
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-medium text-slate-500">Immutable Activity Records</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
            Audit Log
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete traceability of user actions, administrative policy interventions, and vehicle journey inspections
          </p>
        </div>

        <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setModuleFilter('DPDP');
            setCurrentPage(1);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs cursor-pointer"
          title="Who revealed, called or exported customer data, and when"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>DPDP access log</span>
        </button>
        <button
          onClick={exportAuditLogs}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
        >
          <FileDown className="h-4 w-4" />
          <span>Export Audit Log (CSV)</span>
        </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Filter controls */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Search user, action, entity, IP..."
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
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium text-xs cursor-pointer"
              >
                <option value="ALL">All Actions</option>
                {uniqueActions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>

              <select
                value={moduleFilter}
                onChange={(e) => {
                  setModuleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium text-xs cursor-pointer"
              >
                <option value="ALL">All Modules</option>
                {uniqueModules.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as typeof statusFilter);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium text-xs cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="WARNING">WARNING</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
          </div>

          <span className="text-xs text-slate-400">
            Total {totalItems} audit records
          </span>
        </div>

        {/* Audit Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">User & ID</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Module</th>
                <th className="py-3 px-3">Entity</th>
                <th className="py-3 px-3">Old Value</th>
                <th className="py-3 px-3">New Value</th>
                <th className="py-3 px-3">IP Address</th>
                <th className="py-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Timestamp */}
                  <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                    {log.timestamp}
                  </td>

                  {/* User */}
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-800 block">{log.userName}</span>
                    <span className="font-mono text-[10px] text-slate-400">{log.userId}</span>
                  </td>

                  {/* Action */}
                  <td className="py-3 px-3 font-semibold text-slate-900">
                    {log.action}
                  </td>

                  {/* Module */}
                  <td className="py-3 px-3">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {log.module}
                    </span>
                  </td>

                  {/* Entity */}
                  <td className="py-3 px-3 font-medium text-slate-800 truncate max-w-[150px]">
                    {log.entity}
                  </td>

                  {/* Old Value */}
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-500 truncate max-w-[110px]">
                    {log.oldValue}
                  </td>

                  {/* New Value */}
                  <td className="py-3 px-3 font-mono text-[11px] font-semibold text-blue-900 truncate max-w-[120px]">
                    {log.newValue}
                  </td>

                  {/* IP */}
                  <td className="py-3 px-3 font-mono text-slate-500">
                    {log.ipAddress}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === 'SUCCESS'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.status === 'WARNING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {log.status}
                    </span>
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
    </div>
  );
};
