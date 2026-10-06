import { useCallback, useEffect, useState } from 'react';
import type { FleetVehicle } from '../utils/fleetRegister';

/**
 * The fleet list (Admin Portal → Fleet Register) and which roles hold the fleet-upload privilege.
 * Prototype storage: this browser. In production: `fleet_vehicle` + `role_permission` (see docs/backend).
 * Test data only — the chassis numbers match the portal's mock vehicles.
 */

export interface FleetSettings {
  /** Roles granted the fleet-upload privilege besides the TML admin (who always has it). */
  uploadRoles: string[];
}

export interface FleetRegisterState {
  vehicles: FleetVehicle[];
  settings: FleetSettings;
}

export const FLEET_STORAGE_KEY = 'tml_fleet_register_v1';
const CHANGE_EVENT = 'tml:fleet-register';

const seeded = (chassisNo: string, fleetAccount: string, extra: Partial<FleetVehicle> = {}): FleetVehicle => ({
  chassisNo,
  fleetAccount,
  validFrom: '',
  validTo: '',
  active: true,
  remarks: '',
  uploadedBy: 'TML-PO-VH01',
  uploadedAt: '2026-10-01T10:00:00.000Z',
  ...extra,
});

export const DEFAULT_FLEET_REGISTER: FleetRegisterState = {
  vehicles: [
    seeded('MAT700222K1000984', 'Test Fleet Logistics Pvt Ltd', { validFrom: '2026-04-01', validTo: '2027-03-31' }),
    seeded('MAT700555K1002460', 'Test Cab Aggregator'),
    seeded('MAT700999K1004428', 'Test Fleet Logistics Pvt Ltd'),
    seeded('MAT701332K1005904', 'Test Rental Cars', { validTo: '2026-06-30', remarks: 'Contract ended (test row)' }),
  ],
  settings: { uploadRoles: [] },
};

function read(): FleetRegisterState {
  try {
    const raw = localStorage.getItem(FLEET_STORAGE_KEY);
    if (!raw) return DEFAULT_FLEET_REGISTER;
    const parsed = JSON.parse(raw) as Partial<FleetRegisterState>;
    return {
      vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : DEFAULT_FLEET_REGISTER.vehicles,
      settings: { ...DEFAULT_FLEET_REGISTER.settings, ...parsed.settings },
    };
  } catch {
    return DEFAULT_FLEET_REGISTER;
  }
}

/** The fleet list, kept in sync across screens and browser tabs. */
export function useFleetRegister() {
  const [state, setState] = useState<FleetRegisterState>(read);
  useEffect(() => {
    const reload = () => setState(read());
    window.addEventListener(CHANGE_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(CHANGE_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const save = useCallback((next: FleetRegisterState) => {
    try {
      localStorage.setItem(FLEET_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: the change still applies for this page view.
    }
    setState(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const setVehicles = useCallback((vehicles: FleetVehicle[]) => save({ ...read(), vehicles }), [save]);
  const setUploadRoles = useCallback((uploadRoles: string[]) => save({ ...read(), settings: { uploadRoles } }), [save]);

  return { vehicles: state.vehicles, settings: state.settings, setVehicles, setUploadRoles };
}
