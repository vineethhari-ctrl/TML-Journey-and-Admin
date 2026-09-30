import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import {
  AppUser,
  Device,
  Session,
  Vehicle,
  ServiceCase,
  JourneyStage,
  JourneyEvent,
  JourneyException,
  Role,
  SystemConfiguration,
  AuditLogEntry,
  AppNotification,
  UserStatus,
  DeviceStatus,
  SessionStatus,
  ExceptionStatus,
} from '../types';
import { generateInitialData } from '../data/mockDataGenerator';
import { auditService } from '../services/auditService';
import { userService } from '../services/userService';

export type PlatformRoleId =
  | 'superAdmin'
  | 'serviceAdvisor'
  | 'receptionist'
  | 'securityGuard'
  | 'driver'
  | 'dgm'
  | 'dealerAdmin'
  | 'cro';

interface ToastInfo {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  // Navigation
  currentRoute: string;
  navigate: (route: string) => void;

  // Active Role and Screen Visibility RBAC
  activeRoleId: PlatformRoleId;
  setActiveRoleId: (roleId: PlatformRoleId) => void;
  hasPermission: (permissionCode: string) => boolean;
  canAccessRoute: (route: string) => boolean;

  // Current logged in user
  currentUser: {
    name: string;
    role: string;
    title: string;
    department: string;
    userId: string;
    employeeId: string;
    email: string;
  };

  // State
  users: AppUser[];
  devices: Device[];
  sessions: Session[];
  vehicles: Vehicle[];
  serviceCases: ServiceCase[];
  stages: Record<string, JourneyStage[]>;
  events: Record<string, JourneyEvent[]>;
  exceptions: JourneyException[];
  roles: Role[];
  configuration: SystemConfiguration;
  auditLogs: AuditLogEntry[];
  notifications: AppNotification[];
  unreadNotificationCount: number;

  // Toast
  toast: ToastInfo | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;

  // Actions
  logAudit: (action: string, module: string, entity: string, oldValue: string, newValue: string, status?: 'SUCCESS' | 'FAILED' | 'WARNING') => void;
  createUser: (userData: Omit<AppUser, 'createdDate' | 'lastLogin'>) => void;
  updateUser: (userId: string, updates: Partial<AppUser>) => void;
  suspendUser: (userId: string) => void;
  activateUser: (userId: string) => void;
  resetUserSessions: (userId: string) => void;

  blockDevice: (deviceId: string) => void;
  unblockDevice: (deviceId: string) => void;
  forceLogoutDevice: (deviceId: string) => void;

  terminateSession: (sessionId: string) => void;
  terminateAllSessions: () => void;

  updateRolePermissions: (roleId: string, permissions: Role['permissions']) => void;
  updateConfiguration: (newConfig: SystemConfiguration) => void;

  updateExceptionStatus: (exceptionId: string, status: ExceptionStatus) => void;
  addJourneyEvent: (event: Omit<JourneyEvent, 'eventId'>) => void;

  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;

  exportAuditLogs: () => void;
  searchGlobal: (query: string) => {
    vehicles: Vehicle[];
    serviceCases: ServiceCase[];
    users: AppUser[];
    devices: Device[];
    sessions: Session[];
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = useMemo(() => generateInitialData(), []);

  const [currentRoute, setCurrentRoute] = useState<string>('/dashboard');
  const [users, setUsers] = useState<AppUser[]>(initial.users);
  const [devices, setDevices] = useState<Device[]>(initial.devices);
  const [sessions, setSessions] = useState<Session[]>(initial.sessions);
  const [vehicles] = useState<Vehicle[]>(initial.vehicles);
  const [serviceCases, setServiceCases] = useState<ServiceCase[]>(initial.serviceCases);
  const [stages, setStages] = useState<Record<string, JourneyStage[]>>({
    JC20260930001234: initial.demoStages,
  });
  const [events, setEvents] = useState<Record<string, JourneyEvent[]>>({
    JC20260930001234: initial.demoEvents,
  });
  const [exceptions, setExceptions] = useState<JourneyException[]>(initial.exceptions);
  const [roles, setRoles] = useState<Role[]>(initial.roles);
  const [configuration, setConfiguration] = useState<SystemConfiguration>(initial.configuration);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(initial.auditLogs);
  const [notifications, setNotifications] = useState<AppNotification[]>(initial.notifications);
  const [toast, setToast] = useState<ToastInfo | null>(null);

  // Active Role State for Dynamic RBAC simulation
  const [activeRoleId, setActiveRoleId] = useState<PlatformRoleId>('superAdmin');

  // Dynamic User Profile based on role
  const currentUser = useMemo(() => {
    switch (activeRoleId) {
      case 'serviceAdvisor':
        return {
          name: 'Vikramaditya S.',
          role: 'Service Advisor',
          title: 'Senior Service Advisor',
          department: 'Customer Service Front Desk',
          userId: 'TML-SA-4011',
          employeeId: 'EMP-4011',
          email: 'vikram.shinde@dealers.tatamotors.com',
        };
      case 'receptionist':
        return {
          name: 'Pooja Hegde',
          role: 'Receptionist',
          title: 'Customer Reception Lead',
          department: 'Front Desk & Appointments',
          userId: 'TML-REC-2041',
          employeeId: 'EMP-2041',
          email: 'pooja.hegde@dealers.tatamotors.com',
        };
      case 'securityGuard':
        return {
          name: 'Balwinder Singh',
          role: 'Security Guard',
          title: 'Chief Gate Marshall',
          department: 'Workshop Gate & Security',
          userId: 'TML-SEC-1092',
          employeeId: 'EMP-1092',
          email: 'gate.security@dealers.tatamotors.com',
        };
      case 'driver':
        return {
          name: 'Manoj Kumar',
          role: 'Driver',
          title: 'Lead P&D Transit Driver',
          department: 'Pick & Drop Operations',
          userId: 'TML-DRV-3310',
          employeeId: 'EMP-3310',
          email: 'manoj.kumar@dealers.tatamotors.com',
        };
      case 'dgm':
        return {
          name: 'Sanjay Singhal',
          role: 'DGM',
          title: 'Deputy General Manager',
          department: 'Regional Service Operations',
          userId: 'TML-DGM-084',
          employeeId: 'EMP-0084',
          email: 'sanjay.singhal@tatamotors.com',
        };
      case 'dealerAdmin':
        return {
          name: 'K. Venkatesh',
          role: 'Dealer Admin',
          title: 'Workshop Service Administrator',
          department: 'Dealership Operations Management',
          userId: 'TML-DLR-ADM01',
          employeeId: 'EMP-0101',
          email: 'k.venkatesh@prerana.tatamotors.com',
        };
      case 'cro':
        return {
          name: 'Neha Sharma',
          role: 'CRO (Telecaller)',
          title: 'Customer Relationship Officer',
          department: 'Telecalling & Feedback',
          userId: 'TML-CRO-1602',
          employeeId: 'EMP-1602',
          email: 'neha.sharma@dealers.tatamotors.com',
        };
      case 'superAdmin':
      default:
        return {
          name: 'Vineeth Hari',
          role: 'Super Administrator',
          title: 'BA / Product Owner',
          department: 'Service Transformation',
          userId: 'TML-PO-VH01',
          employeeId: 'TML00101',
          email: 'vineeth.hari@tatamotors.com',
        };
    }
  }, [activeRoleId]);

  const hasPermission = useCallback(
    (code: string): boolean => {
      if (activeRoleId === 'superAdmin') return true;
      if (activeRoleId === 'cro') return false; // not configured

      const permissionsByRole: Record<PlatformRoleId, string[]> = {
        superAdmin: ['*'],
        serviceAdvisor: [
          'appointment.read',
          'appointment.create',
          'appointment.update',
          'appointment.cancel',
          'jobcard.read',
          'jobcard.create',
          'jobcard.update',
          'jobcard.status',
          'estimation.read',
          'estimation.create',
          'bay.read',
          'bay.assign',
          'journey.read',
          'journey.search',
          'dashboard.read',
        ],
        receptionist: [
          'appointment.read',
          'appointment.create',
          'appointment.update',
          'appointment.cancel',
          'gate.checkin',
          'gate.checkout',
          'gate.read',
          'jobcard.read',
          'estimation.read',
          'bay.read',
          'bay.assign',
          'journey.read',
          'journey.search',
        ],
        securityGuard: [
          'gate.checkin',
          'gate.checkout',
          'gate.read',
          'appointment.read',
          'journey.read',
        ],
        driver: ['gate.read', 'jobcard.read', 'journey.read'],
        dgm: [
          'appointment.read',
          'gate.read',
          'jobcard.read',
          'estimation.read',
          'bay.read',
          'config.read',
          'journey.read',
          'journey.search',
          'dashboard.read',
        ],
        dealerAdmin: [
          'appointment.read',
          'gate.read',
          'jobcard.read',
          'estimation.read',
          'bay.read',
          'config.read',
          'config.write',
          'user.provision',
          'permission.manage',
          'masters.read',
          'masters.write',
          'journey.read',
          'journey.search',
          'dashboard.read',
        ],
        cro: [],
      };

      const allowed = permissionsByRole[activeRoleId] || [];
      return allowed.includes(code) || allowed.includes('*');
    },
    [activeRoleId]
  );

  const canAccessRoute = useCallback(
    (route: string): boolean => {
      if (activeRoleId === 'superAdmin') return true;
      if (activeRoleId === 'cro') return false;

      if (route === '/dashboard') {
        return ['superAdmin', 'dgm', 'dealerAdmin', 'serviceAdvisor'].includes(activeRoleId);
      }
      if (route.startsWith('/journey')) {
        return [
          'superAdmin',
          'dgm',
          'dealerAdmin',
          'serviceAdvisor',
          'receptionist',
          'driver',
          'securityGuard',
        ].includes(activeRoleId);
      }
      if (route === '/admin/masters') {
        return ['superAdmin', 'dealerAdmin'].includes(activeRoleId);
      }
      if (
        route === '/admin/users' ||
        route === '/admin/devices' ||
        route === '/admin/sessions' ||
        route === '/admin/config'
      ) {
        return ['superAdmin', 'dealerAdmin'].includes(activeRoleId);
      }
      if (route === '/admin/roles') {
        return ['superAdmin', 'dealerAdmin', 'dgm'].includes(activeRoleId);
      }
      if (route === '/admin/audit') {
        return ['superAdmin', 'dgm'].includes(activeRoleId);
      }
      return true;
    },
    [activeRoleId]
  );

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 4000);
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const navigate = useCallback((route: string) => {
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const logAudit = useCallback((action: string, module: string, entity: string, oldValue: string, newValue: string, status: 'SUCCESS' | 'FAILED' | 'WARNING' = 'SUCCESS') => {
    const entry = auditService.createEntry(action, module, entity, oldValue, newValue, {
      userId: currentUser.userId,
      userName: currentUser.name,
    }, status);
    setAuditLogs((prev) => [entry, ...prev]);
  }, [currentUser.userId, currentUser.name]);

  // User Actions
  const createUser = useCallback((userData: Omit<AppUser, 'createdDate' | 'lastLogin'>) => {
    const newUser: AppUser = {
      ...userData,
      createdDate: new Date().toISOString().slice(0, 10),
      lastLogin: 'Never logged in',
    };
    setUsers((prev) => [newUser, ...prev]);
    logAudit('User Created', 'Administration', `${newUser.userId} (${newUser.name})`, 'None', `Status: ${newUser.status}, Role: ${newUser.role}`);
    showToast(`✓ User created successfully: ${newUser.userId}`, 'success');
  }, [logAudit, showToast]);

  const updateUser = useCallback((userId: string, updates: Partial<AppUser>) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.userId === userId) {
          const updated = { ...u, ...updates };
          logAudit('User Updated', 'Administration', `${u.userId} (${u.name})`, `Role: ${u.role}, Status: ${u.status}`, `Role: ${updated.role}, Status: ${updated.status}`);
          return updated;
        }
        return u;
      })
    );
    showToast(`User ${userId} details updated`, 'success');
  }, [logAudit, showToast]);

  const suspendUser = useCallback((userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.userId === userId) {
          logAudit('User Suspended', 'Administration', `${u.userId} (${u.name})`, u.status, 'SUSPENDED');
          return { ...u, status: 'SUSPENDED' as UserStatus };
        }
        return u;
      })
    );
    // Also terminate their sessions
    setSessions((prev) =>
      prev.map((s) => (s.userId === userId ? { ...s, status: 'TERMINATED' as SessionStatus } : s))
    );
    showToast(`User ${userId} has been suspended & sessions terminated`, 'info');
  }, [logAudit, showToast]);

  const activateUser = useCallback((userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.userId === userId) {
          logAudit('User Activated', 'Administration', `${u.userId} (${u.name})`, u.status, 'ACTIVE');
          return { ...u, status: 'ACTIVE' as UserStatus };
        }
        return u;
      })
    );
    showToast(`User ${userId} account activated successfully`, 'success');
  }, [logAudit, showToast]);

  const resetUserSessions = useCallback((userId: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.userId === userId ? { ...s, status: 'TERMINATED' as SessionStatus } : s))
    );
    logAudit('Reset Session', 'Administration', `User ${userId}`, 'Active Sessions', 'Terminated');
    showToast(`All active sessions terminated for user ${userId}`, 'success');
  }, [logAudit, showToast]);

  // Device Actions
  const blockDevice = useCallback((deviceId: string) => {
    let devName = deviceId;
    setDevices((prev) =>
      prev.map((d) => {
        if (d.deviceId === deviceId) {
          devName = `${d.deviceId} (${d.assignedUserName})`;
          logAudit('Device Blocked', 'Administration', devName, d.status, 'BLOCKED');
          return { ...d, status: 'BLOCKED' as DeviceStatus };
        }
        return d;
      })
    );
    // Terminate active sessions for that device
    setSessions((prev) =>
      prev.map((s) => (s.deviceId === deviceId ? { ...s, status: 'TERMINATED' as SessionStatus } : s))
    );
    showToast(`Device ${deviceId} blocked and removed from trust store`, 'info');
  }, [logAudit, showToast]);

  const unblockDevice = useCallback((deviceId: string) => {
    setDevices((prev) =>
      prev.map((d) => {
        if (d.deviceId === deviceId) {
          logAudit('Device Unblocked', 'Administration', `${d.deviceId} (${d.assignedUserName})`, d.status, 'ACTIVE');
          return { ...d, status: 'ACTIVE' as DeviceStatus };
        }
        return d;
      })
    );
    showToast(`Device ${deviceId} unblocked successfully`, 'success');
  }, [logAudit, showToast]);

  const forceLogoutDevice = useCallback((deviceId: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.deviceId === deviceId ? { ...s, status: 'TERMINATED' as SessionStatus } : s))
    );
    logAudit('Force Logout', 'Administration', `Device ${deviceId}`, 'Active', 'Terminated');
    showToast(`Forced logout for device ${deviceId}`, 'info');
  }, [logAudit, showToast]);

  // Session Actions
  const terminateSession = useCallback((sessionId: string) => {
    let sessUser = sessionId;
    setSessions((prev) =>
      prev.map((s) => {
        if (s.sessionId === sessionId) {
          sessUser = `${s.sessionId} (${s.userName})`;
          logAudit('Session Terminated', 'Administration', sessUser, s.status, 'TERMINATED');
          return { ...s, status: 'TERMINATED' as SessionStatus };
        }
        return s;
      })
    );
    showToast(`Session ${sessionId} terminated successfully`, 'success');
  }, [logAudit, showToast]);

  const terminateAllSessions = useCallback(() => {
    const activeCount = sessions.filter((s) => s.status === 'ACTIVE' || s.status === 'IDLE').length;
    setSessions((prev) =>
      prev.map((s) => (s.userId !== currentUser.userId ? { ...s, status: 'TERMINATED' as SessionStatus } : s))
    );
    logAudit('Session Terminated All', 'Administration', 'Global Active Sessions', `${activeCount} Sessions`, 'All non-admin terminated');
    showToast(`Terminated ${activeCount} active user sessions`, 'info');
  }, [sessions, currentUser.userId, logAudit, showToast]);

  // Role Actions
  const updateRolePermissions = useCallback((roleId: string, permissions: Role['permissions']) => {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id === roleId) {
          logAudit('Role Updated', 'Administration', r.name, 'Previous Matrix', 'Updated Module Permissions');
          return { ...r, permissions, lastUpdated: new Date().toISOString().replace('T', ' ').slice(0, 16) };
        }
        return r;
      })
    );
    showToast(`Role permissions updated successfully`, 'success');
  }, [logAudit, showToast]);

  // Config Actions
  const updateConfiguration = useCallback((newConfig: SystemConfiguration) => {
    setConfiguration(newConfig);
    logAudit('Configuration Changed', 'Administration', 'System Parameters', 'Previous Settings', 'Updated Thresholds & Policies');
    showToast(`System configurations saved successfully`, 'success');
  }, [logAudit, showToast]);

  // Exceptions Actions
  const updateExceptionStatus = useCallback((exceptionId: string, status: ExceptionStatus) => {
    setExceptions((prev) =>
      prev.map((exc) => {
        if (exc.id === exceptionId) {
          logAudit('Exception Updated', exc.module, `${exc.id} (${exc.title})`, exc.status, status);
          return { ...exc, status };
        }
        return exc;
      })
    );
    showToast(`Exception ${exceptionId} status updated to ${status}`, 'success');
  }, [logAudit, showToast]);

  const addJourneyEvent = useCallback((event: Omit<JourneyEvent, 'eventId'>) => {
    const newEvent: JourneyEvent = {
      ...event,
      eventId: `EVT-${Date.now().toString().slice(-4)}`,
    };
    setEvents((prev) => ({
      ...prev,
      [event.jcNumber]: [newEvent, ...(prev[event.jcNumber] || [])],
    }));
    logAudit('Journey Event Created', event.module, event.jcNumber, 'Previous State', event.newStatus);
    showToast(`Journey event recorded: ${event.eventType}`, 'success');
  }, [logAudit, showToast]);

  // Notifications
  const markNotificationAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast(`All notifications marked as read`, 'info');
  }, [showToast]);

  const unreadNotificationCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Export
  const exportAuditLogs = useCallback(() => {
    auditService.exportToCSV(auditLogs);
    showToast(`Audit log exported to CSV (${auditLogs.length} rows)`, 'success');
  }, [auditLogs, showToast]);

  // Global search
  const searchGlobal = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) {
        return {
          vehicles: [],
          serviceCases: [],
          users: [],
          devices: [],
          sessions: [],
        };
      }
      return {
        vehicles: vehicles.filter(
          (v) =>
            v.registrationNumber.toLowerCase().includes(q) ||
            v.vin.toLowerCase().includes(q) ||
            v.customerName.toLowerCase().includes(q)
        ),
        serviceCases: serviceCases.filter(
          (sc) =>
            sc.jcNumber.toLowerCase().includes(q) ||
            sc.vehicleRegistration.toLowerCase().includes(q) ||
            sc.vin.toLowerCase().includes(q) ||
            sc.customerName.toLowerCase().includes(q) ||
            sc.customerMobile.includes(q)
        ),
        users: users.filter(
          (u) =>
            u.employeeId.toLowerCase().includes(q) ||
            u.userId.toLowerCase().includes(q) ||
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q)
        ),
        devices: devices.filter(
          (d) =>
            d.deviceId.toLowerCase().includes(q) ||
            d.assignedUserName.toLowerCase().includes(q) ||
            d.ipAddress.includes(q)
        ),
        sessions: sessions.filter(
          (s) =>
            s.sessionId.toLowerCase().includes(q) ||
            s.userName.toLowerCase().includes(q) ||
            s.userId.toLowerCase().includes(q) ||
            s.ipAddress.includes(q)
        ),
      };
    },
    [vehicles, serviceCases, users, devices, sessions]
  );

  return (
    <AppContext.Provider
      value={{
        currentRoute,
        navigate,
        activeRoleId,
        setActiveRoleId,
        hasPermission,
        canAccessRoute,
        currentUser,
        users,
        devices,
        sessions,
        vehicles,
        serviceCases,
        stages,
        events,
        exceptions,
        roles,
        configuration,
        auditLogs,
        notifications,
        unreadNotificationCount,
        toast,
        showToast,
        clearToast,
        logAudit,
        createUser,
        updateUser,
        suspendUser,
        activateUser,
        resetUserSessions,
        blockDevice,
        unblockDevice,
        forceLogoutDevice,
        terminateSession,
        terminateAllSessions,
        updateRolePermissions,
        updateConfiguration,
        updateExceptionStatus,
        addJourneyEvent,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        exportAuditLogs,
        searchGlobal,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
