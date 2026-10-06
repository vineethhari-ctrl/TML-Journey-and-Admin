import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import { generateInitialData, buildJourneyForCase } from '../data/mockDataGenerator';
import { auditService } from '../services/auditService';
import { diffConfiguration } from '../utils/configUtil';
import { applyMasterImport } from '../utils/masterWorkbook';
import { userService } from '../services/userService';
import {
  MASTER_COLLECTIONS,
  MasterConfig,
  MasterFieldDef,
} from '../data/masterCatalogue';

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

  // Master Data & Dynamic Field Customization
  masterConfigs: MasterConfig[];
  updateMasterConfig: (updated: MasterConfig) => void;
  addCustomMasterField: (masterId: string, fieldDef: MasterFieldDef, defaultValue?: any) => void;
  updateMasterFieldMapping: (masterId: string, fieldKey: string, updates: Partial<MasterFieldDef>) => void;
  resetMasterConfigs: () => void;
  createMaster: (config: MasterConfig) => boolean;
  importMasters: (configs: MasterConfig[], source: string) => void;

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
  addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
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

const DEFAULT_ROUTE = '/dashboard';
const MASTER_CONFIG_STORAGE_KEY = 'tml_master_configs_v2';
const ACTIVE_ROLE_STORAGE_KEY = 'tml_active_role_v1';
const PLATFORM_ROLE_IDS: PlatformRoleId[] = [
  'superAdmin',
  'serviceAdvisor',
  'receptionist',
  'securityGuard',
  'driver',
  'dgm',
  'dealerAdmin',
  'cro',
];

/** Routes are mirrored into the URL hash so refresh, back/forward and shareable deep links work. */
const readRouteFromHash = (): string => {
  const raw = window.location.hash.replace(/^#/, '');
  return raw.startsWith('/') ? raw : DEFAULT_ROUTE;
};

/**
 * Saved master configs are merged with the built-in catalogue so masters (and
 * fields) shipped in newer builds show up for users who already have saved data.
 */
const mergeWithCatalogue = (saved: MasterConfig[]): MasterConfig[] => {
  const savedById = new Map(saved.map((m) => [m.id, m]));
  const merged = MASTER_COLLECTIONS.map((builtIn) => {
    const existing = savedById.get(builtIn.id);
    if (!existing) return builtIn;
    const knownKeys = new Set(existing.fields.map((f) => f.key));
    const missingFields = builtIn.fields.filter((f) => !knownKeys.has(f.key));
    // Where a master sits in the catalogue (group / module) is owned by the product, not by saved edits
    const placed = { ...existing, logicalGroup: builtIn.logicalGroup, moduleCode: builtIn.moduleCode, moduleName: builtIn.moduleName };
    return missingFields.length ? { ...placed, fields: [...existing.fields, ...missingFields] } : placed;
  });
  const builtInIds = new Set(MASTER_COLLECTIONS.map((m) => m.id));
  return [...merged, ...saved.filter((m) => !builtInIds.has(m.id))];
};

const persistMasterConfigs = (configs: MasterConfig[]) => {
  try {
    localStorage.setItem(MASTER_CONFIG_STORAGE_KEY, JSON.stringify(configs));
  } catch {
    // storage unavailable or quota exceeded — keep in-memory state only
  }
};

let idCounter = 0;
/** Collision-free id for records created during the session. */
const uniqueId = (prefix: string) => `${prefix}-${Date.now().toString(36).toUpperCase()}${(++idCounter).toString(36).toUpperCase()}`;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = useMemo(() => generateInitialData(), []);

  const [currentRoute, setCurrentRoute] = useState<string>(readRouteFromHash);
  const [users, setUsers] = useState<AppUser[]>(initial.users);
  const [devices, setDevices] = useState<Device[]>(initial.devices);
  const [sessions, setSessions] = useState<Session[]>(initial.sessions);
  const [vehicles] = useState<Vehicle[]>(initial.vehicles);
  const [serviceCases] = useState<ServiceCase[]>(initial.serviceCases);
  // Every JC gets its own derived journey; the flagship demo JC keeps its hand-crafted timeline.
  const initialJourneys = useMemo(() => {
    const stagesByJc: Record<string, JourneyStage[]> = {};
    const eventsByJc: Record<string, JourneyEvent[]> = {};
    initial.serviceCases.forEach((sc) => {
      const built = buildJourneyForCase(sc);
      stagesByJc[sc.jcNumber] = built.stages;
      eventsByJc[sc.jcNumber] = built.events;
    });
    stagesByJc.JC20260930001234 = initial.demoStages;
    eventsByJc.JC20260930001234 = initial.demoEvents;
    return { stagesByJc, eventsByJc };
  }, [initial]);
  const [stages] = useState<Record<string, JourneyStage[]>>(initialJourneys.stagesByJc);
  const [events, setEvents] = useState<Record<string, JourneyEvent[]>>(initialJourneys.eventsByJc);
  const [exceptions, setExceptions] = useState<JourneyException[]>(initial.exceptions);
  const [roles, setRoles] = useState<Role[]>(initial.roles);
  const [configuration, setConfiguration] = useState<SystemConfiguration>(initial.configuration);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(initial.auditLogs);
  const [notifications, setNotifications] = useState<AppNotification[]>(initial.notifications);
  const [toast, setToast] = useState<ToastInfo | null>(null);

  // Master Data & Custom Field Schema Configuration (persisted across sessions)
  const [masterConfigs, setMasterConfigs] = useState<MasterConfig[]>(() => {
    try {
      const saved = localStorage.getItem(MASTER_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return mergeWithCatalogue(parsed);
      }
    } catch {
      // fallback to built-in catalogue
    }
    return MASTER_COLLECTIONS;
  });

  // Active Role State for Dynamic RBAC simulation
  const [activeRoleId, setActiveRoleIdState] = useState<PlatformRoleId>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY) as PlatformRoleId | null;
      if (saved && PLATFORM_ROLE_IDS.includes(saved)) return saved;
    } catch {
      // ignore
    }
    return 'superAdmin';
  });
  const setActiveRoleId = useCallback((roleId: PlatformRoleId) => {
    setActiveRoleIdState(roleId);
    try {
      localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, roleId);
    } catch {
      // ignore
    }
  }, []);

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
          'pii.unmask',
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
          'pii.unmask',
          'pii.export',
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
          'pii.unmask',
          'pii.export',
        ],
        cro: [],
      };

      const allowed = permissionsByRole[activeRoleId] || [];
      return allowed.includes(code) || allowed.includes('*');
    },
    [activeRoleId]
  );

  const canAccessRoute = useCallback(
    (fullRoute: string): boolean => {
      const route = fullRoute.split('?')[0];
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
      // Approving bays is a TML Network Manager / TML Admin task (super admin in this prototype)
      if (route === '/admin/bay-approvals') {
        return false;
      }
      if (route === '/admin/masters' || route === '/admin/masters-guide') {
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
      // Default views (tabs, cards, fields per role) are set by the TML admin only
      if (route === '/admin/workshop-policy') {
        return false;
      }
      if (route === '/admin/audit') {
        return ['superAdmin', 'dgm'].includes(activeRoleId);
      }
      return true;
    },
    [activeRoleId]
  );

  const toastSeq = useRef(0);
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = ++toastSeq.current;
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
    if (readRouteFromHash() !== route) {
      window.location.hash = route;
    }
  }, []);

  // Keep state in sync with browser back/forward and manually edited URLs
  useEffect(() => {
    const onHashChange = () => setCurrentRoute(readRouteFromHash());
    window.addEventListener('hashchange', onHashChange);
    if (!window.location.hash) {
      window.history.replaceState(null, '', `#${DEFAULT_ROUTE}`);
    }
    return () => window.removeEventListener('hashchange', onHashChange);
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

  // NOTE: audit entries are written outside of state updaters — React may invoke
  // updater functions more than once, which would otherwise duplicate audit rows.
  const updateUser = useCallback((userId: string, updates: Partial<AppUser>) => {
    const u = users.find((x) => x.userId === userId);
    if (!u) return;
    const updated = { ...u, ...updates };
    setUsers((prev) => prev.map((x) => (x.userId === userId ? { ...x, ...updates } : x)));
    logAudit('User Updated', 'Administration', `${u.userId} (${u.name})`, `Role: ${u.role}, Status: ${u.status}`, `Role: ${updated.role}, Status: ${updated.status}`);
    showToast(`User ${userId} details updated`, 'success');
  }, [users, logAudit, showToast]);

  const suspendUser = useCallback((userId: string) => {
    const u = users.find((x) => x.userId === userId);
    if (!u) return;
    if (userId === currentUser.userId) {
      showToast('You cannot suspend your own account', 'error');
      return;
    }
    setUsers((prev) => prev.map((x) => (x.userId === userId ? { ...x, status: 'SUSPENDED' as UserStatus } : x)));
    logAudit('User Suspended', 'Administration', `${u.userId} (${u.name})`, u.status, 'SUSPENDED');
    // Also terminate their sessions
    setSessions((prev) =>
      prev.map((s) => (s.userId === userId ? { ...s, status: 'TERMINATED' as SessionStatus } : s))
    );
    showToast(`User ${userId} has been suspended & sessions terminated`, 'info');
  }, [users, currentUser.userId, logAudit, showToast]);

  const activateUser = useCallback((userId: string) => {
    const u = users.find((x) => x.userId === userId);
    if (!u) return;
    setUsers((prev) => prev.map((x) => (x.userId === userId ? { ...x, status: 'ACTIVE' as UserStatus } : x)));
    logAudit('User Activated', 'Administration', `${u.userId} (${u.name})`, u.status, 'ACTIVE');
    showToast(`User ${userId} account activated successfully`, 'success');
  }, [users, logAudit, showToast]);

  const resetUserSessions = useCallback((userId: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.userId === userId ? { ...s, status: 'TERMINATED' as SessionStatus } : s))
    );
    logAudit('Reset Session', 'Administration', `User ${userId}`, 'Active Sessions', 'Terminated');
    showToast(`All active sessions terminated for user ${userId}`, 'success');
  }, [logAudit, showToast]);

  // Device Actions
  const blockDevice = useCallback((deviceId: string) => {
    const d = devices.find((x) => x.deviceId === deviceId);
    if (!d) return;
    setDevices((prev) => prev.map((x) => (x.deviceId === deviceId ? { ...x, status: 'BLOCKED' as DeviceStatus } : x)));
    logAudit('Device Blocked', 'Administration', `${d.deviceId} (${d.assignedUserName})`, d.status, 'BLOCKED');
    // Terminate active sessions for that device
    setSessions((prev) =>
      prev.map((s) => (s.deviceId === deviceId ? { ...s, status: 'TERMINATED' as SessionStatus } : s))
    );
    showToast(`Device ${deviceId} blocked and removed from trust store`, 'info');
  }, [devices, logAudit, showToast]);

  const unblockDevice = useCallback((deviceId: string) => {
    const d = devices.find((x) => x.deviceId === deviceId);
    if (!d) return;
    setDevices((prev) => prev.map((x) => (x.deviceId === deviceId ? { ...x, status: 'ACTIVE' as DeviceStatus } : x)));
    logAudit('Device Unblocked', 'Administration', `${d.deviceId} (${d.assignedUserName})`, d.status, 'ACTIVE');
    showToast(`Device ${deviceId} unblocked successfully`, 'success');
  }, [devices, logAudit, showToast]);

  const forceLogoutDevice = useCallback((deviceId: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.deviceId === deviceId ? { ...s, status: 'TERMINATED' as SessionStatus } : s))
    );
    logAudit('Force Logout', 'Administration', `Device ${deviceId}`, 'Active', 'Terminated');
    showToast(`Forced logout for device ${deviceId}`, 'info');
  }, [logAudit, showToast]);

  // Session Actions
  const terminateSession = useCallback((sessionId: string) => {
    const s = sessions.find((x) => x.sessionId === sessionId);
    if (!s) return;
    setSessions((prev) => prev.map((x) => (x.sessionId === sessionId ? { ...x, status: 'TERMINATED' as SessionStatus } : x)));
    logAudit('Session Terminated', 'Administration', `${s.sessionId} (${s.userName})`, s.status, 'TERMINATED');
    showToast(`Session ${sessionId} terminated successfully`, 'success');
  }, [sessions, logAudit, showToast]);

  const terminateAllSessions = useCallback(() => {
    // Count only the sessions that will actually be terminated (the admin's own sessions are kept)
    const isTerminable = (s: Session) =>
      (s.status === 'ACTIVE' || s.status === 'IDLE') && s.userId !== currentUser.userId;
    const activeCount = sessions.filter(isTerminable).length;
    setSessions((prev) =>
      prev.map((s) => (isTerminable(s) ? { ...s, status: 'TERMINATED' as SessionStatus } : s))
    );
    logAudit('Session Terminated All', 'Administration', 'Global Active Sessions', `${activeCount} Sessions`, 'All non-admin terminated');
    showToast(`Terminated ${activeCount} active user sessions`, 'info');
  }, [sessions, currentUser.userId, logAudit, showToast]);

  // Role Actions
  const updateRolePermissions = useCallback((roleId: string, permissions: Role['permissions']) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const lastUpdated = new Date().toISOString().replace('T', ' ').slice(0, 16);
    setRoles((prev) => prev.map((r) => (r.id === roleId ? { ...r, permissions, lastUpdated } : r)));
    logAudit('Role Updated', 'Administration', role.name, 'Previous Matrix', 'Updated Module Permissions');
    showToast(`Role permissions updated successfully`, 'success');
  }, [roles, logAudit, showToast]);

  // Config Actions
  const updateConfiguration = useCallback((newConfig: SystemConfiguration) => {
    const changes = diffConfiguration(configuration, newConfig);
    if (changes.length === 0) {
      showToast('No configuration changes to save', 'info');
      return;
    }
    setConfiguration(newConfig);
    logAudit(
      'Configuration Changed',
      'Administration',
      'System Parameters',
      changes.map((c) => c.split(' → ')[0]).join('; '),
      changes.join('; ')
    );
    showToast(`Saved ${changes.length} configuration change(s)`, 'success');
  }, [configuration, logAudit, showToast]);

  // Exceptions Actions
  const updateExceptionStatus = useCallback((exceptionId: string, status: ExceptionStatus) => {
    const exc = exceptions.find((e) => e.id === exceptionId);
    if (!exc) return;
    setExceptions((prev) => prev.map((e) => (e.id === exceptionId ? { ...e, status } : e)));
    logAudit('Exception Updated', exc.module, `${exc.id} (${exc.title})`, exc.status, status);
    showToast(`Exception ${exceptionId} status updated to ${status}`, 'success');
  }, [exceptions, logAudit, showToast]);

  const addJourneyEvent = useCallback((event: Omit<JourneyEvent, 'eventId'>) => {
    const newEvent: JourneyEvent = {
      ...event,
      eventId: uniqueId('EVT'),
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

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications((prev) => [{ ...n, id: uniqueId('NOTIF'), timestamp: 'Just now', read: false }, ...prev]);
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

  const updateMasterConfig = useCallback((updated: MasterConfig) => {
    setMasterConfigs((prev) => {
      const next = prev.map((m) => (m.id === updated.id ? updated : m));
      persistMasterConfigs(next);
      return next;
    });
  }, []);

  const addCustomMasterField = useCallback((masterId: string, fieldDef: MasterFieldDef, defaultValue?: any) => {
    setMasterConfigs((prev) => {
      const next = prev.map((m) => {
        if (m.id !== masterId) return m;

        // Check if field exists
        if (m.fields.some((f) => f.key === fieldDef.key)) return m;

        const effectiveDefault =
          defaultValue !== undefined
            ? defaultValue
            : fieldDef.type === 'select' && fieldDef.options && fieldDef.options.length > 0
            ? fieldDef.options[0]
            : fieldDef.type === 'number'
            ? 0
            : fieldDef.type === 'boolean'
            ? false
            : '—';

        const updatedRecords = m.records.map((r) => ({
          ...r,
          [fieldDef.key]: r[fieldDef.key] !== undefined ? r[fieldDef.key] : effectiveDefault,
        }));

        return {
          ...m,
          fields: [...m.fields, { ...fieldDef, isCustom: true }],
          records: updatedRecords,
        };
      });

      persistMasterConfigs(next);
      return next;
    });
  }, []);

  const updateMasterFieldMapping = useCallback(
    (masterId: string, fieldKey: string, updates: Partial<MasterFieldDef>) => {
      setMasterConfigs((prev) => {
        const next = prev.map((m) => {
          if (m.id !== masterId) return m;
          const updatedFields = m.fields.map((f) => {
            if (f.key !== fieldKey) return f;
            return { ...f, ...updates };
          });
          return { ...m, fields: updatedFields };
        });

        persistMasterConfigs(next);
        return next;
      });
    },
    []
  );

  const createMaster = useCallback(
    (config: MasterConfig): boolean => {
      if (masterConfigs.some((m) => m.id.toLowerCase() === config.id.toLowerCase())) {
        showToast(`A master with ID "${config.id}" already exists`, 'error');
        return false;
      }
      setMasterConfigs((prev) => {
        const next = [...prev, config];
        persistMasterConfigs(next);
        return next;
      });
      logAudit(
        'Master Created',
        'Masters Maintenance',
        `${config.name} (${config.id})`,
        'None (New Master)',
        `Module: ${config.moduleCode}, Owner: ${config.owner}, Fields: ${config.fields.map((f) => f.key).join(', ')}`
      );
      showToast(`Master "${config.name}" created — no deployment needed`, 'success');
      return true;
    },
    [masterConfigs, logAudit, showToast]
  );

  const importMasters = useCallback(
    (configs: MasterConfig[], source: string) => {
      if (configs.length === 0) return;
      const existingIds = new Set(masterConfigs.map((m) => m.id));
      setMasterConfigs((prev) => {
        const next = applyMasterImport(prev, configs);
        persistMasterConfigs(next);
        return next;
      });
      const created = configs.filter((c) => !existingIds.has(c.id));
      const updated = configs.filter((c) => existingIds.has(c.id));
      logAudit(
        'Masters Imported from BA Workbook',
        'Masters Maintenance',
        source,
        `${updated.length} existing master(s) updated`,
        `Created: ${created.map((c) => c.id).join(', ') || 'none'}; Updated: ${updated.map((c) => c.id).join(', ') || 'none'}`
      );
      showToast(`Imported ${created.length} new and ${updated.length} updated master(s)`, 'success');
    },
    [masterConfigs, logAudit, showToast]
  );

  const resetMasterConfigs = useCallback(() => {
    setMasterConfigs(MASTER_COLLECTIONS);
    try {
      localStorage.removeItem(MASTER_CONFIG_STORAGE_KEY);
    } catch {}
    showToast('Reset all master schemas and value mappings to factory default', 'info');
  }, [showToast]);

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
        masterConfigs,
        updateMasterConfig,
        addCustomMasterField,
        updateMasterFieldMapping,
        resetMasterConfigs,
        createMaster,
        importMasters,
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
        addNotification,
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
