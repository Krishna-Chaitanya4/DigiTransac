import { describe, it, expect } from 'vitest';

/**
 * Password validation helper - mirrors frontend RegisterPage validation
 */
function validatePassword(pwd: string): { isValid: boolean; message: string } {
  if (pwd.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(pwd)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(pwd)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(pwd)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  if (!/[^A-Za-z0-9]/.test(pwd)) {
    return { isValid: false, message: 'Password must contain at least one special character' };
  }
  return { isValid: true, message: '' };
}

describe('Password Validation', () => {
  describe('Valid passwords', () => {
    it.each([
      'Test@123',
      'Password@1',
      'MyP@ssw0rd!',
      'Ab1!xxxx',
    ])('should accept valid password: %s', (password) => {
      const result = validatePassword(password);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Invalid passwords', () => {
    it('should reject passwords shorter than 8 characters', () => {
      const result = validatePassword('Ab1!xxx');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('at least 8 characters');
    });

    it('should reject passwords without uppercase', () => {
      const result = validatePassword('test@123');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('uppercase');
    });

    it('should reject passwords without lowercase', () => {
      const result = validatePassword('TEST@123');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('lowercase');
    });

    it('should reject passwords without numbers', () => {
      const result = validatePassword('TestTest@');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('number');
    });

    it('should reject passwords without special characters', () => {
      const result = validatePassword('TestTest1');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('special character');
    });
  });
});
