import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { PII_PERMISSIONS, PiiKind, buildUnmaskAudit } from '../utils/dpdp';

/**
 * DPDP permissions and audit for the current user.
 * In production the reveal and CTI calls go to the backend, which returns the value / places the call and records the
 * audit row with the real session IP; here the portal's audit log stands in for it.
 */
export function useDpdp() {
  const { hasPermission, logAudit, currentUser, showToast } = useApp();

  const logUnmask = useCallback(
    (vehicleRegNo: string, field: PiiKind) => {
      const payload = buildUnmaskAudit({ userId: currentUser.userId, vehicleRegNo, field });
      // The revealed value is never written to the log.
      logAudit('UNMASK_PII', 'DPDP', vehicleRegNo, 'masked', JSON.stringify(payload), 'WARNING');
    },
    [currentUser.userId, logAudit],
  );

  const callCustomer = useCallback(
    (vehicleRegNo: string) => {
      logAudit('CTI_CALL', 'DPDP', vehicleRegNo, '', 'Click-to-call placed via CTI; number not shown', 'SUCCESS');
      showToast(`Calling the customer of ${vehicleRegNo} through CTI…`, 'info');
    },
    [logAudit, showToast],
  );

  return {
    viewer: { userId: currentUser.userId, name: currentUser.name },
    canUnmask: hasPermission(PII_PERMISSIONS.unmask),
    canExportPlainPii: hasPermission(PII_PERMISSIONS.exportPlain),
    logUnmask,
    callCustomer,
  };
}
