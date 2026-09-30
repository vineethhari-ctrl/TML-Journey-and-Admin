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

  validateEmail(email: string): boolean {
    return /\S+@\S+\.\S+/.test(email);
  },
};
