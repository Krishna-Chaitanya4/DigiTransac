import { describe, it, expect } from 'vitest';
import {
  createBudgetSchema,
  updateBudgetSchema,
  budgetAlertSchema,
  budgetPeriodSchema,
} from './budgets';

describe('budgetPeriodSchema', () => {
  it.each(['Weekly', 'Monthly', 'Quarterly', 'Yearly', 'Custom'])(
    'accepts %s',
    (period) => {
      expect(budgetPeriodSchema.safeParse(period).success).toBe(true);
    }
  );

  it('rejects invalid period', () => {
    expect(budgetPeriodSchema.safeParse('Biweekly').success).toBe(false);
  });
});

describe('budgetAlertSchema', () => {
  it('accepts valid alert', () => {
    expect(budgetAlertSchema.safeParse({ thresholdPercent: 80, notifyEnabled: true }).success).toBe(true);
  });

  it('rejects threshold > 100', () => {
    expect(budgetAlertSchema.safeParse({ thresholdPercent: 101, notifyEnabled: true }).success).toBe(false);
  });

  it('rejects negative threshold', () => {
    expect(budgetAlertSchema.safeParse({ thresholdPercent: -1, notifyEnabled: true }).success).toBe(false);
  });
});

describe('createBudgetSchema', () => {
  const validBudget = {
    name: 'Groceries',
    amount: 500,
    period: 'Monthly' as const,
  };

  it('accepts valid budget', () => {
    expect(createBudgetSchema.safeParse(validBudget).success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createBudgetSchema.safeParse({ ...validBudget, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects zero amount', () => {
    const result = createBudgetSchema.safeParse({ ...validBudget, amount: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects name over 100 chars', () => {
    const result = createBudgetSchema.safeParse({ ...validBudget, name: 'A'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('requires dates for Custom period', () => {
    const result = createBudgetSchema.safeParse({
      ...validBudget,
      period: 'Custom',
    });
    expect(result.success).toBe(false);
  });

  it('accepts Custom period with dates', () => {
    const result = createBudgetSchema.safeParse({
      ...validBudget,
      period: 'Custom',
      startDate: '2024-01-01',
      endDate: '2024-03-31',
    });
    expect(result.success).toBe(true);
  });

  it('rejects end date before start date', () => {
    const result = createBudgetSchema.safeParse({
      ...validBudget,
      startDate: '2024-03-01',
      endDate: '2024-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate alert thresholds', () => {
    const result = createBudgetSchema.safeParse({
      ...validBudget,
      alerts: [
        { thresholdPercent: 80, notifyEnabled: true },
        { thresholdPercent: 80, notifyEnabled: false },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid hex color', () => {
    const result = createBudgetSchema.safeParse({ ...validBudget, color: 'blue' });
    expect(result.success).toBe(false);
  });
});

describe('updateBudgetSchema', () => {
  it('accepts empty update', () => {
    expect(updateBudgetSchema.safeParse({}).success).toBe(true);
  });

  it('accepts partial update', () => {
    expect(updateBudgetSchema.safeParse({ name: 'Updated' }).success).toBe(true);
  });

  it('rejects invalid amount', () => {
    expect(updateBudgetSchema.safeParse({ amount: -100 }).success).toBe(false);
  });
});
