import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { AppUser, UserType, UserStatus } from '../types';
import { UserModal } from '../components/administration/UserModal';
import { UserDetailDrawer } from '../components/administration/UserDetailDrawer';
import { Pagination } from '../components/common/Pagination';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Eye,
  Edit,
  AlertOctagon,
  CheckCircle,
  RefreshCw,
  MoreVertical,
} from 'lucide-react';

export const UserManagementPage: React.FC = () => {
  const { users, suspendUser, activateUser, resetUserSessions } = useApp();

  const [activeTab, setActiveTab] = useState<'users' | 'employees' | 'pending' | 'suspended'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<UserType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modal / Drawer state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<AppUser | null>(null);
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<AppUser | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Tab filter
      if (activeTab === 'pending' && u.status !== 'PENDING') return false;
      if (activeTab === 'suspended' && u.status !== 'SUSPENDED') return false;

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          u.name.toLowerCase().includes(q) ||
          u.userId.toLowerCase().includes(q) ||
          u.employeeId.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.dealer.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Dropdown filters
      if (userTypeFilter !== 'ALL' && u.userType !== userTypeFilter) return false;
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;

      return true;
    });
  }, [users, activeTab, searchQuery, userTypeFilter, statusFilter, roleFilter]);

  const totalItems = filteredUsers.length;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const handleEditClick = (u: AppUser) => {
    setUserToEdit(u);
    setIsCreateModalOpen(true);
  };

  const handleViewClick = (u: AppUser) => {
    setSelectedUserForDetail(u);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
              Identity & Access Management
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-medium text-slate-500">Tata Motors Enterprise Directory</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
            Employee / User Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Provision, govern, and monitor workshop personnel, dealership advisors, and technicians
          </p>
        </div>

        <button
          onClick={() => {
            setUserToEdit(null);
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition-all"
        >
          <UserPlus className="h-4 w-4" />
          <span>Create User</span>
        </button>
      </div>

      {/* Administration Stat Ribbons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Total Employees</span>
          <p className="text-lg font-bold text-slate-900 mt-0.5">1,248</p>
          <span className="text-[10px] text-slate-400">All India</span>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Active Users</span>
          <p className="text-lg font-bold text-blue-900 mt-0.5">428</p>
          <span className="text-[10px] text-emerald-600 font-semibold">Live Authorized</span>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase">CRM Users</span>
          <p className="text-lg font-bold text-slate-900 mt-0.5">312</p>
          <span className="text-[10px] text-indigo-600 font-semibold">Linked Identity</span>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Non-CRM Users</span>
          <p className="text-lg font-bold text-slate-900 mt-0.5">116</p>
          <span className="text-[10px] text-cyan-600 font-semibold">TML Local ID</span>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Active Devices</span>
          <p className="text-lg font-bold text-slate-900 mt-0.5">391</p>
          <span className="text-[10px] text-slate-400">Workshop tabs</span>
        </div>
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Active Sessions</span>
          <p className="text-lg font-bold text-slate-900 mt-0.5">276</p>
          <span className="text-[10px] text-emerald-600 font-semibold">Online now</span>
        </div>
        <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200">
          <span className="text-[10px] font-bold text-rose-700 uppercase">Suspended Users</span>
          <p className="text-lg font-bold text-rose-950 mt-0.5">9</p>
          <span className="text-[10px] text-rose-700 font-semibold">Access revoked</span>
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Tabs & Search Filter Header */}
        <div className="p-4 border-b border-slate-200 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => {
                  setActiveTab('users');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === 'users' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Users ({users.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('employees');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === 'employees' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Employees (All)
              </button>
              <button
                onClick={() => {
                  setActiveTab('pending');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === 'pending' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pending Requests ({users.filter((u) => u.status === 'PENDING').length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('suspended');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === 'suspended' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Suspended ({users.filter((u) => u.status === 'SUSPENDED').length})
              </button>
            </div>

            {/* Quick search input */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search user, ID, email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
              />
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2" />
            </div>
          </div>

          {/* Sub Filters */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <Filter className="h-3 w-3" /> Filters:
            </span>

            <select
              value={userTypeFilter}
              onChange={(e) => {
                setUserTypeFilter(e.target.value as UserType | 'ALL');
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium"
            >
              <option value="ALL">All User Types</option>
              <option value="CRM">CRM Users</option>
              <option value="NON-CRM">Non-CRM Users</option>
              <option value="ADMIN">Administrators</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as UserStatus | 'ALL');
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="LOCKED">LOCKED</option>
              <option value="PENDING">PENDING</option>
            </select>
          </div>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Employee ID</th>
                <th className="py-3 px-3">Name</th>
                <th className="py-3 px-3">User ID</th>
                <th className="py-3 px-3">User Type</th>
                <th className="py-3 px-3">Department</th>
                <th className="py-3 px-3">Dealer</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Last Login</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedUsers.map((u) => (
                <tr key={u.userId} className="hover:bg-slate-50/80 transition-colors">
                  {/* Emp ID */}
                  <td className="py-3 px-3 font-mono font-bold text-slate-700">
                    {u.employeeId}
                  </td>

                  {/* Name */}
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-900 block">{u.name}</span>
                    <span className="text-[11px] text-slate-400 truncate max-w-[140px] block">{u.email}</span>
                  </td>

                  {/* User ID */}
                  <td className="py-3 px-3 font-mono font-medium text-blue-900">
                    {u.userId}
                  </td>

                  {/* User Type */}
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.userType === 'CRM'
                          ? 'bg-blue-100 text-blue-800'
                          : u.userType === 'ADMIN'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-cyan-100 text-cyan-800'
                      }`}
                    >
                      {u.userType}
                    </span>
                  </td>

                  {/* Department */}
                  <td className="py-3 px-3 text-slate-600 truncate max-w-[130px]">
                    {u.department}
                  </td>

                  {/* Dealer */}
                  <td className="py-3 px-3 text-slate-600 truncate max-w-[140px]">
                    {u.dealer}
                  </td>

                  {/* Role */}
                  <td className="py-3 px-3 font-medium text-slate-800">
                    {u.role}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : u.status === 'SUSPENDED'
                          ? 'bg-rose-100 text-rose-800'
                          : u.status === 'LOCKED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>

                  {/* Last Login */}
                  <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                    {u.lastLogin}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleViewClick(u)}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-700 hover:bg-slate-100"
                        title="View user details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleEditClick(u)}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="Edit user"
                      >
                        <Edit className="h-4 w-4" />
                      </button>

                      {u.status === 'ACTIVE' ? (
                        <button
                          onClick={() => suspendUser(u.userId)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Suspend user"
                        >
                          <AlertOctagon className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => activateUser(u.userId)}
                          className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                          title="Activate user"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        onClick={() => resetUserSessions(u.userId)}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        title="Reset session"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
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

      {/* User Create / Edit Modal */}
      <UserModal
        isOpen={isCreateModalOpen}
        userToEdit={userToEdit}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* User Detail Drawer */}
      <UserDetailDrawer
        isOpen={Boolean(selectedUserForDetail)}
        user={selectedUserForDetail}
        onClose={() => setSelectedUserForDetail(null)}
        onEdit={(u) => handleEditClick(u)}
      />
    </div>
  );
};
