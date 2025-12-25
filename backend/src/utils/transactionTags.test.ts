/**
 * Jest test suite for transaction tag detection
 */

import { detectTransactionTags } from './transactionTags';

describe('Transaction Tag Detection', () => {
  it('should detect expense tags for Swiggy', () => {
    const result = detectTransactionTags('debit', 'Rs 500 debited for Swiggy order', 'Swiggy');
    expect(result.tags).toContain('expense');
    expect(['high', 'medium', 'low']).toContain(result.confidence);
  });

  it('should detect investment tags for Zerodha', () => {
    const result = detectTransactionTags(
      'debit',
      'Rs 50000 debited for Stock purchase at Zerodha',
      'Zerodha'
    );
    expect(result.tags).toContain('investment');
    expect(['high', 'medium', 'low']).toContain(result.confidence);
  });

  it('should detect loan tags for loan payments', () => {
    const result = detectTransactionTags(
      'debit',
      'Your A/c debited Rs 15000 for Home Loan EMI payment',
      'HDFC Home Loan'
    );
    expect(result.tags).toContain('loan');
    expect(['high', 'medium', 'low']).toContain(result.confidence);
  });

  it('should detect transfer tags for NEFT', () => {
    const result = detectTransactionTags(
      'debit',
      'Rs 10000 transferred via NEFT to savings account',
      'Self Transfer'
    );
    expect(result.tags).toContain('transfer');
    expect(result.confidence).toBe('high');
  });

  it('should detect refund tags for Amazon', () => {
    const result = detectTransactionTags(
      'credit',
      'Rs 1500 refund from Amazon order cancellation',
      'Amazon'
    );
    expect(result.tags).toContain('refund');
    expect(result.confidence).toBe('high');
  });

  it('should detect savings tags for Fixed Deposit', () => {
    const result = detectTransactionTags('debit', 'Rs 100000 debited for FD opening', 'SBI FD');
    expect(result.tags).toContain('savings');
    expect(['high', 'medium', 'low']).toContain(result.confidence);
  });

  it('should detect income tags for salary', () => {
    const result = detectTransactionTags('credit', 'Rs 80000 credited to your account', 'Salary');
    expect(result.tags).toContain('income');
    expect(['high', 'medium', 'low']).toContain(result.confidence);
  });

  it('should detect investment tags for crypto purchase', () => {
    const result = detectTransactionTags(
      'debit',
      'Rs 25000 debited for Bitcoin purchase at WazirX',
      'WazirX'
    );
    expect(result.tags).toContain('investment');
    expect(['high', 'medium', 'low']).toContain(result.confidence);
  });

  it('should detect investment tags for SIP', () => {
    const result = detectTransactionTags('debit', 'Rs 5000 debited for Mutual Fund SIP', 'Groww');
    expect(result.tags).toContain('investment');
    expect(['high', 'medium', 'low']).toContain(result.confidence);
  });

  it('should detect loan tags for credit card payment', () => {
    const result = detectTransactionTags(
      'debit',
      'Rs 12000 debited for Credit Card Bill payment',
      'HDFC Credit Card'
    );
    expect(result.tags).toContain('loan');
    expect(['high', 'medium', 'low']).toContain(result.confidence);
  });
});
