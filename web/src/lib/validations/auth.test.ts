import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  twoFactorCodeSchema,
  updateProfileSchema,
} from './auth';

describe('loginSchema', () => {
  it('accepts valid login', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'abc',
    });
    expect(result.success).toBe(false);
  });

  it('defaults rememberMe to false', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.rememberMe).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts valid registration', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'SecureP1',
      confirmPassword: 'SecureP1',
      fullName: 'John Doe',
    });
    expect(result.success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'SecureP1',
      confirmPassword: 'DifferentP1',
      fullName: 'John Doe',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(i => i.path.join('.'));
      expect(paths).toContain('confirmPassword');
    }
  });

  it('rejects weak password', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'simple',
      confirmPassword: 'simple',
      fullName: 'John Doe',
    });
    expect(result.success).toBe(false);
  });

  it('defaults primaryCurrency to USD', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'SecureP1',
      confirmPassword: 'SecureP1',
      fullName: 'John Doe',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.primaryCurrency).toBe('USD');
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'user@example.com' }).success).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'bad' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts valid reset', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'abc123',
      password: 'NewPass1',
      confirmPassword: 'NewPass1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty token', () => {
    const result = resetPasswordSchema.safeParse({
      token: '',
      password: 'NewPass1',
      confirmPassword: 'NewPass1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'abc123',
      password: 'NewPass1',
      confirmPassword: 'Different1',
    });
    expect(result.success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('accepts valid change', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldpass1',
      newPassword: 'NewPass1',
      confirmPassword: 'NewPass1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects same old and new password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'SecureP1',
      newPassword: 'SecureP1',
      confirmPassword: 'SecureP1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched confirm', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldpass1',
      newPassword: 'NewPass1',
      confirmPassword: 'Different1',
    });
    expect(result.success).toBe(false);
  });
});

describe('twoFactorCodeSchema', () => {
  it('accepts 6-digit code', () => {
    expect(twoFactorCodeSchema.safeParse({ code: '123456' }).success).toBe(true);
  });

  it('rejects non-digit code', () => {
    expect(twoFactorCodeSchema.safeParse({ code: 'abcdef' }).success).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(twoFactorCodeSchema.safeParse({ code: '12345' }).success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('accepts valid update', () => {
    const result = updateProfileSchema.safeParse({
      fullName: 'Jane Doe',
      primaryCurrency: 'EUR',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty update (all optional)', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });
});
