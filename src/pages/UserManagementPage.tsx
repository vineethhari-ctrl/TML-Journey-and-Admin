import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useRouteSearchParam } from '../hooks/useRouteSearchParam';
import { AppUser, UserType, UserStatus } from '../types';
import { UserModal } from '../components/administration/UserModal';
import { UserDetailDrawer } from '../components/administration/UserDetailDrawer';
import { Pagination } from '../components/common/Pagination';
import { SkillsMatrixPanel, AvailabilityPanel } from '../components/administration/EmployeeInsightPanels';
import { useEmployeeProfiles } from '../hooks/useEmployeeProfiles';
import { gapsFor, roleOfUser } from '../utils/employeeProfile';
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
  Award,
  BookOpen,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

// --- Types based on LMS SOW & Completion Report Schema ---
interface EmployeeProficiency {
  employeeId: string;
  name: string;
  role: 'Service Advisor' | 'Technician' | 'Team Leader' | 'Quality Inspector';
  currentTier: string;
  nextTierTarget: string;
  department: string;
  dealerCode: string;
  dealershipName: string;
  attendancePercentage: number;
  assessmentScore: number;
  assessmentResult: 'PASSED' | 'FAILED' | 'PENDING';
  prerequisitesCleared: boolean;
  practicalOjeStatus: 'CLEARED' | 'PENDING' | 'NOT REQUIRED';
  psychometricFit: 'FIT' | 'CONDITIONAL' | 'NOT FIT';
  latestCourseCode: string;
  latestCourseTitle: string;
  completionDate: string;
  certValidity: string;
  upgradeStatus: 'ELIGIBLE' | 'IN_REVIEW' | 'COMPLETED' | 'ACTION_REQUIRED';
}

const INITIAL_PROFICIENCY_DATA: EmployeeProficiency[] = [
  {
    employeeId: 'EMP-1001',
    name: 'Test Technician A',
    role: 'Technician',
    currentTier: 'PVBU Service_Trainee Technician',
    nextTierTarget: 'PVBU Service_L1 Technician',
    department: 'Body Shop / Technical',
    dealerCode: 'DLR1001',
    dealershipName: 'Sample Motors Hyderabad',
    attendancePercentage: 100,
    assessmentScore: 84,
    assessmentResult: 'PASSED',
    prerequisitesCleared: true,
    practicalOjeStatus: 'CLEARED',
    psychometricFit: 'FIT',
    latestCourseCode: 'BP-BT-L1-01',
    latestCourseTitle: 'BODY LEVEL -1 (BASIC)',
    completionDate: '2026-09-11',
    certValidity: '2028-09-11',
    upgradeStatus: 'ELIGIBLE',
  },
  {
    employeeId: 'EMP-1002',
    name: 'Test Advisor B',
    role: 'Service Advisor',
    currentTier: 'PVBU Service_Trainee SA',
    nextTierTarget: 'PVBU Service_Advisor',
    department: 'Customer Care & Reception',
    dealerCode: 'DLR1002',
    dealershipName: 'Rudra Motors South',
    attendancePercentage: 100,
    assessmentScore: 78,
    assessmentResult: 'PASSED',
    prerequisitesCleared: true,
    practicalOjeStatus: 'CLEARED',
    psychometricFit: 'FIT',
    latestCourseCode: 'BP-SA-L1-07',
    latestCourseTitle: 'SERVICE ADVISOR LEVEL 1',
    completionDate: '2026-09-18',
    certValidity: '2028-09-18',
    upgradeStatus: 'ELIGIBLE',
  },
  {
    employeeId: 'EMP-1003',
    name: 'Test Technician C',
    role: 'Technician',
    currentTier: 'PVBU Service_L1 Technician',
    nextTierTarget: 'PVBU Service_L2 Technician (EV)',
    department: 'Mechanical / EV Fleet',
    dealerCode: 'DLR1003',
    dealershipName: 'Demo Auto Pune',
    attendancePercentage: 100,
    assessmentScore: 76,
    assessmentResult: 'PASSED',
    prerequisitesCleared: true,
    practicalOjeStatus: 'PENDING',
    psychometricFit: 'FIT',
    latestCourseCode: 'EV-TECH-L2-01',
    latestCourseTitle: 'EV TECHNICIAN LEVEL 2',
    completionDate: '2026-09-24',
    certValidity: '2028-09-24',
    upgradeStatus: 'IN_REVIEW',
  },
  {
    employeeId: 'EMP-1004',
    name: 'Test Technician D',
    role: 'Technician',
    currentTier: 'PVBU Service_L1 Technician',
    nextTierTarget: 'PVBU Service_L2 Technician',
    department: 'Mechanical & Diagnostic',
    dealerCode: 'DLR1004',
    dealershipName: 'Example Cars Delhi',
    attendancePercentage: 90,
    assessmentScore: 64,
    assessmentResult: 'FAILED',
    prerequisitesCleared: true,
    practicalOjeStatus: 'CLEARED',
    psychometricFit: 'FIT',
    latestCourseCode: 'BP-BT-L2-02',
    latestCourseTitle: 'BODY LEVEL -2 (ADVANCE)',
    completionDate: '2026-09-11',
    certValidity: 'N/A',
    upgradeStatus: 'ACTION_REQUIRED',
  },
  {
    employeeId: 'EMP-1005',
    name: 'Test Technician E',
    role: 'Technician',
    currentTier: 'PVBU Service_L2 Technician',
    nextTierTarget: 'PVBU Service_L2 AC / Electrician',
    department: 'Electrical & AC',
    dealerCode: 'DLR1005',
    dealershipName: 'Test Wheels Chandigarh',
    attendancePercentage: 100,
    assessmentScore: 88,
    assessmentResult: 'PASSED',
    prerequisitesCleared: true,
    practicalOjeStatus: 'CLEARED',
    psychometricFit: 'FIT',
    latestCourseCode: 'HVAC-SPEC-02',
    latestCourseTitle: 'HVAC SPECIALIZATION',
    completionDate: '2026-09-29',
    certValidity: '2028-09-29',
    upgradeStatus: 'ELIGIBLE',
  },
];

export const UserManagementPage: React.FC = () => {
  const { users, suspendUser, activateUser, resetUserSessions } = useApp();

  // Added 'proficiency' to the tab type union
  const [activeTab, setActiveTab] = useState<'users' | 'employees' | 'pending' | 'suspended' | 'proficiency' | 'skills' | 'availability'>('users');
  const insightTab = activeTab === 'skills' || activeTab === 'availability';
  const { profileFor } = useEmployeeProfiles();
  const [searchQuery, setSearchQuery] = useState('');
  useRouteSearchParam(setSearchQuery);
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

  // LMS Module State
  const [proficiencyData, setProficiencyData] = useState<EmployeeProficiency[]>(INITIAL_PROFICIENCY_DATA);
  const [lmsFilter, setLmsFilter] = useState<'ALL' | 'ELIGIBLE' | 'ACTION_REQUIRED'>('ALL');
  const [selectedAuditUser, setSelectedAuditUser] = useState<EmployeeProficiency | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Trigger monthly LMS delta sync
  const handleTriggerMonthlySync = () => {
    setIsSyncing(true);
    setSyncStatusMsg('Ingesting delta records from LMS (AllCoursesCompletionReport_Sep 30,2026.xlsx)...');
    setTimeout(() => {
      setIsSyncing(false);
      setSyncStatusMsg('Sync Complete: 5 records ingested. 3 personnel verified for automated role progression.');
      setTimeout(() => setSyncStatusMsg(null), 5000);
    }, 1200);
  };

  // Section 6.4: Execute Role Upgrade in CRM-DMS
  const handleApproveRoleProgression = (empId: string) => {
    setProficiencyData((prev) =>
      prev.map((emp) =>
        emp.employeeId === empId
          ? { ...emp, currentTier: emp.nextTierTarget, upgradeStatus: 'COMPLETED' }
          : emp
      )
    );
  };

  // Filtered users for standard tabs
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (activeTab === 'pending' && u.status !== 'PENDING') return false;
      if (activeTab === 'suspended' && u.status !== 'SUSPENDED') return false;

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

  // Filtered LMS proficiency records
  const filteredProficiency = useMemo(() => {
    return proficiencyData.filter((emp) => {
      if (lmsFilter === 'ELIGIBLE' && emp.upgradeStatus !== 'ELIGIBLE') return false;
      if (lmsFilter === 'ACTION_REQUIRED' && emp.upgradeStatus !== 'ACTION_REQUIRED') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          emp.name.toLowerCase().includes(q) ||
          emp.employeeId.toLowerCase().includes(q) ||
          emp.dealershipName.toLowerCase().includes(q) ||
          emp.latestCourseTitle.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [proficiencyData, lmsFilter, searchQuery]);

  const handleEditClick = (u: AppUser) => {
    setUserToEdit(u);
    setIsCreateModalOpen(true);
  };

  const handleViewClick = (u: AppUser) => {
    setSelectedUserForDetail(u);
  };

  const eligibleUpgradesCount = proficiencyData.filter((d) => d.upgradeStatus === 'ELIGIBLE').length;

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

        <div className="flex items-center gap-2">
          {activeTab === 'proficiency' ? (
            <button
              onClick={handleTriggerMonthlySync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#002244] hover:bg-[#001730] text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Ingesting Batch...' : 'Run Monthly LMS Sync'}</span>
            </button>
          ) : (
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
          )}
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatusMsg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            <span className="font-semibold">{syncStatusMsg}</span>
          </div>
          <span className="text-[10px] font-mono text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
            SCHEDULED_MONTHLY_JOB
          </span>
        </div>
      )}

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
          <span className="text-[10px] font-bold text-slate-400 uppercase">LMS Certified</span>
          <p className="text-lg font-bold text-emerald-600 mt-0.5">
            {proficiencyData.filter((d) => d.assessmentResult === 'PASSED').length}
          </p>
          <span className="text-[10px] text-emerald-700 font-semibold">Passed &ge;70% Mandate</span>
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

              {/* NEW 5TH TAB: LMS & PROFICIENCY */}
              <button
                onClick={() => {
                  setActiveTab('proficiency');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'proficiency'
                    ? 'bg-blue-900 text-white shadow-2xs font-bold'
                    : 'text-blue-900 hover:text-blue-950 font-bold'
                }`}
              >
                <Award className="h-3.5 w-3.5" />
                <span>Proficiency &amp; LMS</span>
                {eligibleUpgradesCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-500 text-white font-bold">
                    {eligibleUpgradesCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setActiveTab('skills');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'skills' ? 'bg-blue-900 text-white shadow-2xs font-bold' : 'text-blue-900 hover:text-blue-950 font-bold'
                }`}
              >
                <Award className="h-3.5 w-3.5" />
                <span>Skills &amp; Certificates</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('availability');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'availability' ? 'bg-blue-900 text-white shadow-2xs font-bold' : 'text-blue-900 hover:text-blue-950 font-bold'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Availability</span>
              </button>
            </div>

            {/* Quick search input */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder={
                  activeTab === 'proficiency'
                    ? 'Search name, emp code, course...'
                    : 'Search user, ID, email...'
                }
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
          {insightTab ? null : activeTab === 'proficiency' ? (
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                <Filter className="h-3 w-3" /> Progression Filter:
              </span>
              <button
                onClick={() => setLmsFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
                  lmsFilter === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                All LMS Tracked ({proficiencyData.length})
              </button>
              <button
                onClick={() => setLmsFilter('ELIGIBLE')}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition flex items-center gap-1 ${
                  lmsFilter === 'ELIGIBLE'
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <span>Eligible for Upgrade (Sec 6.4)</span>
                <span className="bg-emerald-200 text-emerald-900 text-[10px] px-1.5 rounded-full font-bold">
                  {eligibleUpgradesCount}
                </span>
              </button>
              <button
                onClick={() => setLmsFilter('ACTION_REQUIRED')}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
                  lmsFilter === 'ACTION_REQUIRED'
                    ? 'bg-rose-700 text-white border-rose-700'
                    : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                }`}
              >
                Score &lt; 70% / Retest Required
              </button>
            </div>
          ) : (
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
          )}
        </div>

        {/* VIEW 0: SKILLS MATRIX / AVAILABILITY (employee skills, certificates, who is available) */}
        {activeTab === 'skills' ? (
          <SkillsMatrixPanel searchQuery={searchQuery} onOpenEmployee={setSelectedUserForDetail} />
        ) : activeTab === 'availability' ? (
          <AvailabilityPanel searchQuery={searchQuery} onOpenEmployee={setSelectedUserForDetail} />
        ) : /* VIEW 1: LMS & PROFICIENCY VIEW */ activeTab === 'proficiency' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Emp ID</th>
                  <th className="py-3 px-3">Employee Name</th>
                  <th className="py-3 px-3">Current CRM Profile</th>
                  <th className="py-3 px-3">Latest Course Ingested</th>
                  <th className="py-3 px-3 text-center">Score &amp; Attendance</th>
                  <th className="py-3 px-3 text-center">OJE Mandate</th>
                  <th className="py-3 px-3 text-center">Progression Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProficiency.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-700">
                      {emp.employeeId}
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block">{emp.name}</span>
                      <span className="text-[11px] text-slate-400 block truncate max-w-[150px]">
                        {emp.dealershipName}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-mono">
                        {emp.currentTier}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800 block">{emp.latestCourseTitle}</span>
                      <span className="text-[10px] text-slate-400 font-mono block">{emp.latestCourseCode}</span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`font-bold block ${
                          emp.assessmentScore >= 70 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {emp.assessmentScore}% ({emp.assessmentResult})
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Att: {emp.attendancePercentage}% | Req: &ge;70%
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          emp.practicalOjeStatus === 'CLEARED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {emp.practicalOjeStatus}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      {emp.upgradeStatus === 'ELIGIBLE' && (
                        <span className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-2xs animate-pulse">
                          Eligible for {emp.nextTierTarget.split('_')[1]}
                        </span>
                      )}
                      {emp.upgradeStatus === 'IN_REVIEW' && (
                        <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                          Pending Practical OJE
                        </span>
                      )}
                      {emp.upgradeStatus === 'ACTION_REQUIRED' && (
                        <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                          Score &lt; 70% (Retest Req)
                        </span>
                      )}
                      {emp.upgradeStatus === 'COMPLETED' && (
                        <span className="bg-blue-100 text-blue-800 border border-blue-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                          Upgraded in CRM
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedAuditUser(emp)}
                          className="px-2 py-1 rounded text-blue-700 hover:bg-blue-50 font-semibold text-xs transition"
                          title="View Section 6.1 Audit Details"
                        >
                          Audit
                        </button>
                        {emp.upgradeStatus === 'ELIGIBLE' && (
                          <button
                            onClick={() => handleApproveRoleProgression(emp.employeeId)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-[10px] font-bold shadow-2xs transition"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* VIEW 2: STANDARD USER TABLE (EXISTING CODE) */
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
                  <th className="py-3 px-3">Designation / Expertise</th>
                  <th className="py-3 px-3">Skills</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Last Login</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedUsers.map((u) => (
                  <tr key={u.userId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-700">
                      {u.employeeId}
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block">{u.name}</span>
                      <span className="text-[11px] text-slate-400 truncate max-w-[140px] block">{u.email}</span>
                    </td>

                    <td className="py-3 px-3 font-mono font-medium text-blue-900">
                      {u.userId}
                    </td>

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

                    <td className="py-3 px-3 text-slate-600 truncate max-w-[130px]">
                      {u.department}
                    </td>

                    <td className="py-3 px-3 text-slate-600 truncate max-w-[140px]">
                      {u.dealer}
                    </td>

                    <td className="py-3 px-3 font-medium text-slate-800">
                      {u.role}
                    </td>

                    <td className="py-3 px-3 text-slate-700" data-testid="designation-cell">
                      {(() => {
                        const p = profileFor(u);
                        return (
                          <>
                            <span className="block">{p.designation}</span>
                            {p.expertise && <span className="mt-0.5 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">{p.expertise}</span>}
                          </>
                        );
                      })()}
                    </td>

                    <td className="py-3 px-3">
                      {(() => {
                        const p = profileFor(u);
                        const gaps = gapsFor(p, roleOfUser(u), new Date().toISOString().slice(0, 10));
                        return (
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${gaps.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`} title={gaps.ok ? 'Meets the role requirements' : 'Has skill / certificate gaps'}>
                            {p.skills.length} skills{gaps.ok ? '' : ' · gap'}
                          </span>
                        );
                      })()}
                    </td>

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

                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                      {u.lastLogin}
                    </td>

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
        )}

        {activeTab !== 'proficiency' && (
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Drawer: Section 6.1 Mandate Audit Trail */}
      {selectedAuditUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex justify-end z-50">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-base text-slate-900">{selectedAuditUser.name}</h3>
                  <span className="text-xs text-slate-400 font-mono">
                    ID: {selectedAuditUser.employeeId} | {selectedAuditUser.dealershipName}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedAuditUser(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {/* SOW Section 6.1 Mandate Checklist */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Governance Checklist (Section 6.1)
                </span>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">1. Pre-requisites Cleared</span>
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> YES
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">2. Attendance Requirement (100%)</span>
                    <span
                      className={`font-bold flex items-center gap-1 ${
                        selectedAuditUser.attendancePercentage === 100
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {selectedAuditUser.attendancePercentage === 100 ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> 100%
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5" /> {selectedAuditUser.attendancePercentage}%
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">3. Assessment Score (&ge; 70%)</span>
                    <span
                      className={`font-bold flex items-center gap-1 ${
                        selectedAuditUser.assessmentScore >= 70
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {selectedAuditUser.assessmentScore}% ({selectedAuditUser.assessmentResult})
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                    <span className="text-slate-600">4. Practical OJE Clearance</span>
                    <span className="font-bold text-slate-800">
                      {selectedAuditUser.practicalOjeStatus}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">5. Psychometric Role-Fit</span>
                    <span className="font-bold text-indigo-700">
                      {selectedAuditUser.psychometricFit} (Customer Orientation)
                    </span>
                  </div>
                </div>
              </div>

              {/* Direct LMS Link (Section 5.2 Remediation) */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 space-y-1.5">
                <span className="font-bold block">LMS Course Remediation Link:</span>
                <span className="font-mono text-[11px] text-blue-700 block break-all">
                  https://lms.tatamotors.com/course/{selectedAuditUser.latestCourseCode}
                </span>
                <span className="text-[10px] text-slate-500 block pt-1 border-t border-blue-200">
                  *Section 6.3 Retest Rule: Max 1 standard retest. 2nd retest requires CCM approval.
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex gap-2">
              <button
                onClick={() => setSelectedAuditUser(null)}
                className="flex-1 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              {selectedAuditUser.upgradeStatus === 'ELIGIBLE' && (
                <button
                  onClick={() => {
                    handleApproveRoleProgression(selectedAuditUser.employeeId);
                    setSelectedAuditUser(null);
                  }}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Approve Progression
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Create / Edit Modal (Existing) */}
      <UserModal
        isOpen={isCreateModalOpen}
        userToEdit={userToEdit}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* User Detail Drawer (Existing) */}
      <UserDetailDrawer
        isOpen={Boolean(selectedUserForDetail)}
        user={selectedUserForDetail}
        onClose={() => setSelectedUserForDetail(null)}
        onEdit={(u) => handleEditClick(u)}
      />
    </div>
  );
};