import { describe, it, expect } from 'vitest';
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionFilterSchema,
  transactionTypeSchema,
  transactionSplitSchema,
  transactionLocationSchema,
  recurringRuleSchema,
} from './transactions';

describe('transactionTypeSchema', () => {
  it.each(['Receive', 'Send'])('accepts %s', (type) => {
    expect(transactionTypeSchema.safeParse(type).success).toBe(true);
  });

  it('rejects Transfer', () => {
    expect(transactionTypeSchema.safeParse('Transfer').success).toBe(false);
  });
});

describe('transactionSplitSchema', () => {
  it('accepts valid split', () => {
    const result = transactionSplitSchema.safeParse({
      labelId: '507f1f77bcf86cd799439011',
      amount: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects zero amount', () => {
    const result = transactionSplitSchema.safeParse({
      labelId: '507f1f77bcf86cd799439011',
      amount: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid labelId', () => {
    const result = transactionSplitSchema.safeParse({
      labelId: 'bad-id',
      amount: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejects notes over 500 chars', () => {
    const result = transactionSplitSchema.safeParse({
      labelId: '507f1f77bcf86cd799439011',
      amount: 50,
      notes: 'N'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe('transactionLocationSchema', () => {
  it('accepts valid coordinates', () => {
    const result = transactionLocationSchema.safeParse({
      latitude: 40.7128,
      longitude: -74.006,
    });
    expect(result.success).toBe(true);
  });

  it('rejects latitude > 90', () => {
    const result = transactionLocationSchema.safeParse({
      latitude: 91,
      longitude: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects longitude > 180', () => {
    const result = transactionLocationSchema.safeParse({
      latitude: 0,
      longitude: 181,
    });
    expect(result.success).toBe(false);
  });
});

describe('recurringRuleSchema', () => {
  it('accepts valid rule', () => {
    const result = recurringRuleSchema.safeParse({ frequency: 'Monthly' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.interval).toBe(1); // default
  });

  it('rejects invalid frequency', () => {
    expect(recurringRuleSchema.safeParse({ frequency: 'Hourly' }).success).toBe(false);
  });

  it('rejects interval < 1', () => {
    expect(recurringRuleSchema.safeParse({ frequency: 'Monthly', interval: 0 }).success).toBe(false);
  });
});

describe('createTransactionSchema', () => {
  const validTransaction = {
    accountId: '507f1f77bcf86cd799439011',
    type: 'Send' as const,
    amount: 100,
    date: '2024-01-15',
    splits: [{ labelId: '507f1f77bcf86cd799439012', amount: 100 }],
  };

  it('accepts valid transaction', () => {
    expect(createTransactionSchema.safeParse(validTransaction).success).toBe(true);
  });

  it('rejects zero amount', () => {
    const result = createTransactionSchema.safeParse({ ...validTransaction, amount: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects missing accountId', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { accountId: _, ...rest } = validTransaction;
    expect(createTransactionSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid date format', () => {
    const result = createTransactionSchema.safeParse({ ...validTransaction, date: 'Jan 15' });
    expect(result.success).toBe(false);
  });

  it('rejects splits that do not sum to amount', () => {
    const result = createTransactionSchema.safeParse({
      ...validTransaction,
      splits: [
        { labelId: '507f1f77bcf86cd799439012', amount: 60 },
        { labelId: '507f1f77bcf86cd799439013', amount: 30 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts splits that sum to amount', () => {
    const result = createTransactionSchema.safeParse({
      ...validTransaction,
      splits: [
        { labelId: '507f1f77bcf86cd799439012', amount: 60 },
        { labelId: '507f1f77bcf86cd799439013', amount: 40 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty splits array', () => {
    const result = createTransactionSchema.safeParse({
      ...validTransaction,
      splits: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects title over 200 chars', () => {
    const result = createTransactionSchema.safeParse({
      ...validTransaction,
      title: 'T'.repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe('updateTransactionSchema', () => {
  it('accepts empty update', () => {
    expect(updateTransactionSchema.safeParse({}).success).toBe(true);
  });

  it('accepts partial update', () => {
    expect(updateTransactionSchema.safeParse({ amount: 200 }).success).toBe(true);
  });

  it('rejects invalid status', () => {
    expect(updateTransactionSchema.safeParse({ status: 'Invalid' }).success).toBe(false);
  });

  it('accepts valid status', () => {
    expect(updateTransactionSchema.safeParse({ status: 'Confirmed' }).success).toBe(true);
  });
});

describe('transactionFilterSchema', () => {
  it('accepts empty filter', () => {
    expect(transactionFilterSchema.safeParse({}).success).toBe(true);
  });

  it('rejects start date after end date', () => {
    const result = transactionFilterSchema.safeParse({
      startDate: '2024-03-01',
      endDate: '2024-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects minAmount > maxAmount', () => {
    const result = transactionFilterSchema.safeParse({
      minAmount: 100,
      maxAmount: 50,
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid filter with all fields', () => {
    const result = transactionFilterSchema.safeParse({
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      minAmount: 10,
      maxAmount: 1000,
      types: ['Send', 'Receive'],
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative minAmount', () => {
    expect(transactionFilterSchema.safeParse({ minAmount: -1 }).success).toBe(false);
  });
});
