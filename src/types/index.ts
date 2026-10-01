export type ModuleType =
  | 'Appointment'
  | 'P&D / Reception'
  | 'Security'
  | 'JC Creation'
  | 'JC Tracking'
  | 'SPD'
  | 'THD'
  | 'EQC'
  | 'Claim'
  | 'BodyShop'
  | 'IRA'
  | 'Closure';

export type StageStatus = 'COMPLETED' | 'IN PROGRESS' | 'PENDING' | 'SKIPPED' | 'BLOCKED';

export type ExceptionSeverity = 'HIGH' | 'MEDIUM' | 'LOW';
export type ExceptionStatus = 'OPEN' | 'IN PROGRESS' | 'RESOLVED';

export type UserType = 'CRM' | 'NON-CRM' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LOCKED' | 'PENDING';

export type DeviceType = 'Desktop' | 'Laptop' | 'Tablet' | 'Mobile' | 'Workshop Device';
export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export type SessionStatus = 'ACTIVE' | 'IDLE' | 'TERMINATED';

export interface Vehicle {
  vehicleId: string;
  registrationNumber: string;
  vin: string;
  model: string;
  fuelType: 'EV' | 'Petrol' | 'Diesel' | 'CNG';
  color: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerEmail: string;
}

export interface ServiceCase {
  jcNumber: string;
  vehicleId: string;
  vehicleRegistration: string;
  vin: string;
  customerName: string;
  customerMobile: string;
  dealerId: string;
  dealerName: string;
  workshopName: string;
  zone: string;
  region: string;
  createdAt: string;
  currentStage: ModuleType;
  overallStatus: 'IN PROGRESS' | 'COMPLETED' | 'DELAYED' | 'BLOCKED';
  serviceType: 'Periodic Maintenance' | 'Running Repair' | 'Accident / BodyShop' | 'Warranty Claim' | 'EV Battery Health Check';
  serviceAdvisor: string;
  estimatedDelivery: string;
  elapsedTimeFormatted: string;
  pendingActionsCount: number;
}

export interface JourneyStage {
  stageId: string;
  jcNumber: string;
  module: ModuleType;
  name: string;
  sequence: number;
  status: StageStatus;
  startedAt?: string;
  completedAt?: string;
  duration?: string;
  responsibleUser: string;
  responsibleRole: string;
  referenceNumber?: string;
  remarks: string;
}

export interface JourneyEvent {
  eventId: string;
  vehicleNumber: string;
  vin: string;
  jcNumber: string;
  module: ModuleType;
  stage: string;
  eventType: string;
  status: string;
  timestamp: string;
  userId: string;
  userName: string;
  employeeId: string;
  dealer: string;
  referenceNumber: string;
  previousStatus: string;
  newStatus: string;
  remarks: string;
}

export interface JourneyException {
  id: string;
  jcNumber: string;
  vehicleRegistration: string;
  module: ModuleType;
  title: string;
  description: string;
  severity: ExceptionSeverity;
  raisedTime: string;
  age: string;
  owner: string;
  status: ExceptionStatus;
}

export interface AppUser {
  employeeId: string;
  name: string;
  userId: string;
  email: string;
  mobile: string;
  userType: UserType;
  department: string;
  zone: string;
  region: string;
  dealer: string;
  workshop: string;
  role: string;
  status: UserStatus;
  createdDate: string;
  lastLogin: string;
  avatarUrl?: string;
}

export interface RolePermission {
  module: ModuleType | 'Dashboard' | 'Administration' | 'TML Journey';
  view: boolean;
  create: boolean;
  edit: boolean;
  approve: boolean;
  delete: boolean;
  export: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  userCount: number;
  status: 'ACTIVE' | 'INACTIVE';
  lastUpdated: string;
  permissions: RolePermission[];
}

export interface Device {
  deviceId: string;
  assignedUser: string;
  assignedUserName: string;
  deviceType: DeviceType;
  operatingSystem: string;
  browser: string;
  ipAddress: string;
  macAddress: string;
  location: string;
  firstRegistered: string;
  lastSeen: string;
  status: DeviceStatus;
}

export interface Session {
  sessionId: string;
  userId: string;
  userName: string;
  employeeId: string;
  userType: UserType;
  deviceId: string;
  deviceType: string;
  ipAddress: string;
  location: string;
  loginTime: string;
  lastActivity: string;
  status: SessionStatus;
}

export interface SystemConfiguration {
  // Session Configuration
  sessionTimeoutMinutes: number;
  idleTimeoutMinutes: number;
  maxConcurrentSessions: number;
  forceLogoutOnPasswordChange: boolean;

  // Security Configuration
  maxLoginAttempts: number;
  accountLockDurationMinutes: number;
  passwordExpiryDays: number;
  deviceRegistrationRequired: boolean;

  // Notification Configuration
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  urgentExceptionAlerts: boolean;

  // Journey Configuration
  journeyEventRetentionDays: number;
  exceptionThresholdMinutes: number;
  stageTimeoutThresholdHours: number;
  autoEscalateExceptions: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  entity: string;
  oldValue: string;
  newValue: string;
  ipAddress: string;
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'EXCEPTION' | 'SECURITY' | 'USER' | 'DEVICE' | 'CONFIG' | 'APPROVAL';
  timestamp: string;
  read: boolean;
  targetPath: string;
  metadata?: Record<string, string>;
}
