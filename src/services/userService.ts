import { AppUser, UserType, UserStatus } from '../types';

export interface CreateUserInput {
  employeeId: string;
  name: string;
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
}

export const userService = {
  generateUserId(userType: UserType, regionCode = 'MH'): string {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    if (userType === 'CRM') {
      return `TML-CRM-${Math.floor(60000 + Math.random() * 30000)}`;
    } else if (userType === 'ADMIN') {
      return `TML-ADM-${Math.floor(5000 + Math.random() * 4000)}`;
    } else {
      return `TML-NC-${regionCode.substring(0, 2).toUpperCase()}-${String(randomNum).slice(0, 6)}`;
    }
  },

  /** Generates an id that is not already in `taken` (ids are random, so collisions are possible). */
  generateUniqueUserId(userType: UserType, regionCode: string, taken: Iterable<string>): string {
    const used = new Set(Array.from(taken, (t) => t.toUpperCase()));
    let id = this.generateUserId(userType, regionCode);
    for (let i = 0; i < 50 && used.has(id.toUpperCase()); i++) {
      id = this.generateUserId(userType, regionCode);
    }
    return id;
  },

  validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  },

  /** Accepts an Indian mobile with optional +91/0 prefix, spaces or dashes (e.g. "+91 98200 12345"). */
  validateIndianMobile(mobile: string): boolean {
    const digits = mobile.replace(/[\s-]/g, '').replace(/^(\+91|0)/, '');
    return /^[6-9]\d{9}$/.test(digits);
  },
};
