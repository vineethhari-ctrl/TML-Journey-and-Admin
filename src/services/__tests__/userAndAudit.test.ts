import { describe, it, expect } from 'vitest';
import { userService } from '../userService';
import { auditService } from '../auditService';

describe('userService', () => {
  it('validates Indian mobile numbers in common formats', () => {
    for (const ok of ['+91 98200 12345', '9820012345', '09820012345', '+91-98200-12345']) {
      expect(userService.validateIndianMobile(ok)).toBe(true);
    }
    for (const bad of ['+91 98200 ', '12345', '+91 18200 12345', '98200123456']) {
      expect(userService.validateIndianMobile(bad)).toBe(false);
    }
  });

  it('validates emails', () => {
    expect(userService.validateEmail('a.b@tatamotors.com')).toBe(true);
    expect(userService.validateEmail('a b@x.com')).toBe(false);
    expect(userService.validateEmail('nope@')).toBe(false);
  });

  it('generateUniqueUserId avoids ids that are already taken', () => {
    const taken = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const id = userService.generateUniqueUserId('ADMIN', 'MH', taken);
      expect(taken.has(id)).toBe(false);
      taken.add(id);
    }
  });
});

describe('auditService', () => {
  it('creates entries with unique ids', () => {
    const ids = new Set(Array.from({ length: 500 }, () => auditService.createEntry('a', 'm', 'e', 'o', 'n').id));
    expect(ids.size).toBe(500);
  });
});
