/**
 * Who can do what in the portal — one source of truth used by the app (AppContext) and by the Role Catalogue
 * (Roles & Access), so the screens listed for a role are exactly the screens it can open.
 */

export type PlatformRoleId = 'superAdmin' | 'serviceAdvisor' | 'receptionist' | 'securityGuard' | 'driver' | 'dgm' | 'dealerAdmin' | 'cro';

/** Permission codes of each portal view role ('*' = everything). */
export const PLATFORM_PERMISSIONS: Record<PlatformRoleId, string[]> = {
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

export function hasPlatformPermission(roleId: PlatformRoleId, code: string): boolean {
  if (roleId === 'superAdmin') return true;
  if (roleId === 'cro') return false; // not configured
  const allowed = PLATFORM_PERMISSIONS[roleId] || [];
  return allowed.includes(code) || allowed.includes('*');
}

/** Can this portal view role open the route? */
export function canRoleAccessRoute(roleId: PlatformRoleId, fullRoute: string): boolean {

  const route = fullRoute.split('?')[0];
  if (roleId === 'superAdmin') return true;
  if (roleId === 'cro') return false;

  if (route === '/dashboard') {
    return ['superAdmin', 'dgm', 'dealerAdmin', 'serviceAdvisor'].includes(roleId);
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
    ].includes(roleId);
  }
  // Approving bays is a TML Network Manager / TML Admin task (super admin in this prototype)
  if (route === '/admin/bay-approvals') {
    return false;
  }
  if (route === '/admin/masters' || route === '/admin/masters-guide' || route === '/admin/upload-master') {
    return ['superAdmin', 'dealerAdmin'].includes(roleId);
  }
  if (
    route === '/admin/users' ||
    route === '/admin/devices' ||
    route === '/admin/sessions' ||
    route === '/admin/config'
  ) {
    return ['superAdmin', 'dealerAdmin'].includes(roleId);
  }
  if (route === '/admin/roles') {
    return ['superAdmin', 'dealerAdmin', 'dgm'].includes(roleId);
  }
  // Default views (tabs, cards, fields per role) are set by the TML admin only
  if (route === '/admin/workshop-policy') {
    return false;
  }
  // Fleet Register: admins view it; uploading needs the fleet-upload privilege (checked on the page)
  if (route === '/admin/fleet') {
    return ['superAdmin', 'dealerAdmin', 'dgm'].includes(roleId);
  }
  if (route === '/admin/audit') {
    return ['superAdmin', 'dgm'].includes(roleId);
  }
  return true;
}
