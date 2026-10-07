import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppUser } from '../types';
import { useApp } from '../context/AppContext';
import { seedProfile, type EmployeeProfile, type ProfileMasters } from '../utils/employeeProfile';

const KEY = 'tml_employee_profiles_v1';
const EVENT = 'tml:employee-profiles';

const read = (): Record<string, EmployeeProfile> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
};

/** Profile masters (skills, certificates, designations, shifts) as the admin has them now. */
export function useProfileMasters(): ProfileMasters {
  const { masterConfigs } = useApp();
  return useMemo(() => {
    const rows = (id: string) => masterConfigs.find((m) => m.id === id)?.records ?? [];
    return { skills: rows('skill_master'), certs: rows('certification_master'), designations: rows('designation_master'), shifts: rows('shift_master') };
  }, [masterConfigs]);
}

/**
 * Employee profiles: a believable profile is derived for every user; what an admin edits is saved in this browser
 * (prototype) and wins over the derived one. Production: employee_profile / employee_skill / employee_certification.
 */
export function useEmployeeProfiles() {
  const { users } = useApp();
  const masters = useProfileMasters();
  const [saved, setSaved] = useState<Record<string, EmployeeProfile>>(read);

  useEffect(() => {
    const sync = () => setSaved(read());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const profileFor = useCallback((user: AppUser): EmployeeProfile => saved[user.employeeId] ?? seedProfile(user, masters, new Date().toISOString().slice(0, 10)), [saved, masters]);

  const rows = useMemo(() => users.map((user) => ({ user, profile: profileFor(user) })), [users, profileFor]);

  const saveProfile = useCallback((profile: EmployeeProfile) => {
    const next = { ...read(), [profile.employeeId]: profile };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage unavailable — keep in memory only
    }
    setSaved(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { rows, masters, profileFor, saveProfile };
}
