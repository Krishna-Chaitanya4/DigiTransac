import { describe, it, expect } from 'vitest';
import {
  formatAmount,
  formatPercentage,
  formatDisplayDate,
  formatDateRange,
  truncate,
  formatCompact,
} from './formatters';

describe('formatAmount', () => {
  it('formats basic amount with 2 decimal places', () => {
    const result = formatAmount(1000);
    expect(result).toMatch(/1[,.]000\.00/); // locale-dependent separator
  });

  it('formats with USD locale', () => {
    const result = formatAmount(1234.56, 'USD');
    expect(result).toBe('1,234.56');
  });

  it('formats with INR locale', () => {
    const result = formatAmount(100000, 'INR');
    expect(result).toBe('1,00,000.00');
  });

  it('handles zero', () => {
    const result = formatAmount(0, 'USD');
    expect(result).toBe('0.00');
  });

  it('shows positive sign when showSign is true', () => {
    const result = formatAmount(50, 'USD', { showSign: true });
    expect(result).toMatch(/^\+/);
  });

  it('shows negative sign when showSign is true', () => {
    const result = formatAmount(-50, 'USD', { showSign: true });
    expect(result).toMatch(/^-/);
  });

  it('does not show sign for zero', () => {
    const result = formatAmount(0, 'USD', { showSign: true });
    expect(result).toBe('0.00');
  });

  it('respects custom fraction digits', () => {
    const result = formatAmount(1234.5678, 'USD', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    expect(result).toBe('1,235'); // rounded
  });
});

describe('formatPercentage', () => {
  it('formats with default 1 decimal', () => {
    expect(formatPercentage(75.5)).toBe('75.5%');
  });

  it('formats with custom decimals', () => {
    expect(formatPercentage(33.333, 2)).toBe('33.33%');
  });

  it('formats zero', () => {
    expect(formatPercentage(0)).toBe('0.0%');
  });

  it('formats 100', () => {
    expect(formatPercentage(100, 0)).toBe('100%');
  });
});

describe('formatDisplayDate', () => {
  it('formats Date object', () => {
    const result = formatDisplayDate(new Date('2024-06-15'));
    expect(result).toContain('Jun');
    expect(result).toContain('2024');
  });

  it('formats date string', () => {
    const result = formatDisplayDate('2024-01-01T00:00:00Z');
    expect(result).toContain('2024');
  });
});

describe('formatDateRange', () => {
  it('formats range with different dates', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-12-31');
    const result = formatDateRange(start, end);
    expect(result).toContain(' - ');
  });

  it('returns single date for same day', () => {
    const day = new Date('2024-06-15');
    const result = formatDateRange(day, day);
    expect(result).not.toContain(' - ');
  });
});

describe('truncate', () => {
  it('does not truncate short text', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long text with ellipsis', () => {
    const result = truncate('this is a very long text', 10);
    expect(result.length).toBe(10);
    expect(result).toMatch(/…$/);
  });

  it('handles exact length', () => {
    expect(truncate('exact', 5)).toBe('exact');
  });
});

describe('formatCompact', () => {
  it('formats thousands', () => {
    const result = formatCompact(1200);
    expect(result).toMatch(/1\.2K/);
  });

  it('formats millions', () => {
    const result = formatCompact(3500000);
    expect(result).toMatch(/3\.5M/);
  });

  it('formats small numbers as-is', () => {
    expect(formatCompact(42)).toBe('42');
  });
});
