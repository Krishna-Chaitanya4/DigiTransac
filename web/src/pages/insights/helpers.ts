import { formatCurrency } from '../../services/currencyService';
import { getDateRangeForPreset } from '../../hooks/useTransactionFilters';
import type { PeriodPreset } from './types';

// Helper to convert and format currency - ensures proper conversion from source to target currency
export const convertAndFormat = (
  amount: number,
  sourceCurrency: string | undefined,
  targetCurrency: string,
  convert: (amount: number, fromCurrency: string) => number
): string => {
  if (!sourceCurrency || sourceCurrency === targetCurrency) {
    return formatCurrency(amount, targetCurrency);
  }
  const convertedAmount = convert(amount, sourceCurrency);
  return formatCurrency(convertedAmount, targetCurrency);
};

// Helper to calculate percentage change
export function calculatePercentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null; // Can't calculate % change from 0
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

// Format percentage change with sign
export function formatPercentChange(change: number | null): string {
  if (change === null) return 'New';
  if (change === 0) return '0%';
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(0)}%`;
}

// Get color class for percentage change badge
export function getPercentChangeColor(change: number | null, invertColors = false): string {
  if (change === null) return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  if (change === 0) return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  
  // For expenses, increase is bad (red), decrease is good (green)
  // For income, increase is good (green), decrease is bad (red)
  const isPositive = change > 0;
  const isGood = invertColors ? !isPositive : isPositive;
  
  if (isGood) {
    return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
  } else {
    return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
  }
}

// Calculate previous period date range
export function getPreviousPeriodRange(start: Date, end: Date): { start: Date; end: Date } {
  const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - periodDays + 1);
  return { start: prevStart, end: prevEnd };
}

// Helper to get date range for a preset
export function getDateRange(preset: PeriodPreset) {
  const now = new Date();
  
  switch (preset) {
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    }
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start, end };
    }
    case 'last3Months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    }
    case 'last6Months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    }
    case 'thisYear': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    }
    case 'custom':
      // For custom, return null to indicate custom dates should be used
      return null;
    default:
      return getDateRangeForPreset('thisMonth');
  }
}

// Format date for API
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
