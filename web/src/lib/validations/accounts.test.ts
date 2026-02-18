import { describe, it, expect } from 'vitest';
import {
  createAccountSchema,
  updateAccountSchema,
  adjustBalanceSchema,
  accountTypeSchema,
} from './accounts';

describe('accountTypeSchema', () => {
  it.each(['Cash', 'Bank', 'CreditCard', 'Investment', 'Loan', 'Wallet', 'Other'])(
    'accepts %s',
    (type) => {
      expect(accountTypeSchema.safeParse(type).success).toBe(true);
    }
  );

  it('rejects invalid type', () => {
    expect(accountTypeSchema.safeParse('Crypto').success).toBe(false);
  });
});

describe('createAccountSchema', () => {
  const validAccount = {
    name: 'Savings Account',
    type: 'Bank' as const,
    currency: 'USD',
  };

  it('accepts valid account', () => {
    expect(createAccountSchema.safeParse(validAccount).success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createAccountSchema.safeParse({ ...validAccount, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name over 100 chars', () => {
    const result = createAccountSchema.safeParse({ ...validAccount, name: 'A'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rejects invalid currency', () => {
    const result = createAccountSchema.safeParse({ ...validAccount, currency: 'US' });
    expect(result.success).toBe(false);
  });

  it('defaults initialBalance to 0', () => {
    const result = createAccountSchema.safeParse(validAccount);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.initialBalance).toBe(0);
  });

  it('defaults isDefault to false', () => {
    const result = createAccountSchema.safeParse(validAccount);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isDefault).toBe(false);
  });

  it('accepts credit card fields', () => {
    const result = createAccountSchema.safeParse({
      ...validAccount,
      type: 'CreditCard',
      creditLimit: 5000,
      billingDay: 15,
    });
    expect(result.success).toBe(true);
  });

  it('rejects billingDay > 31', () => {
    const result = createAccountSchema.safeParse({
      ...validAccount,
      billingDay: 32,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid hex color', () => {
    const result = createAccountSchema.safeParse({
      ...validAccount,
      color: 'red',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid hex color', () => {
    const result = createAccountSchema.safeParse({
      ...validAccount,
      color: '#FF5733',
    });
    expect(result.success).toBe(true);
  });
});

describe('updateAccountSchema', () => {
  it('accepts empty update (all optional)', () => {
    expect(updateAccountSchema.safeParse({}).success).toBe(true);
  });

  it('accepts partial update', () => {
    expect(updateAccountSchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });

  it('rejects invalid interest rate', () => {
    expect(updateAccountSchema.safeParse({ interestRate: 101 }).success).toBe(false);
  });
});

describe('adjustBalanceSchema', () => {
  it('accepts valid adjustment', () => {
    expect(adjustBalanceSchema.safeParse({ newBalance: 500 }).success).toBe(true);
  });

  it('accepts negative balance', () => {
    expect(adjustBalanceSchema.safeParse({ newBalance: -100 }).success).toBe(true);
  });

  it('rejects notes over 500 chars', () => {
    const result = adjustBalanceSchema.safeParse({
      newBalance: 100,
      notes: 'N'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});
