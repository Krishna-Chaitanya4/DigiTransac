// Budget types matching backend DTOs

export type BudgetPeriod = 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly' | 'Custom';

export interface BudgetAlert {
  thresholdPercent: number;  // 0-100
  notifyEnabled: boolean;
  triggered: boolean;
  lastTriggeredAt?: string;
}

export interface LabelInfo {
  id: string;
  name: string;
  color?: string;
  icon?: string;
}

export interface AccountInfo {
  id: string;
  name: string;
  currency: string;
}

/**
 * Currency breakdown for budget spending.
 * Shows original amount in each currency and converted amount to budget currency.
 */
export interface BudgetCurrencyBreakdown {
  originalAmount: number;     // Amount in this currency
  convertedAmount: number;    // Amount converted to budget currency
  transactionCount: number;   // Number of transactions in this currency
}

export interface Budget {
  id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  period: BudgetPeriod;
  startDate: string;
  endDate?: string;
  labelIds: string[];
  labels: LabelInfo[];
  accountIds: string[];
  accounts: AccountInfo[];
  alerts: BudgetAlert[];
  isActive: boolean;
  color?: string;
  icon?: string;
  // Computed spending info
  amountSpent: number;
  amountRemaining: number;
  percentUsed: number;
  periodStart: string;
  periodEnd: string;
  daysRemaining: number;
  isOverBudget: boolean;
  // Multi-currency support
  spendingByCurrency?: Record<string, BudgetCurrencyBreakdown>;  // Only present if multiple currencies
  primaryCurrency?: string;   // User's primary currency for conversion display
  createdAt: string;
  updatedAt: string;
}

export interface BudgetSummary {
  totalBudgets: number;
  activeBudgets: number;
  overBudgetCount: number;
  nearLimitCount: number;  // Within 80% of budget
  totalBudgetAmount: number;
  totalSpent: number;
  totalRemaining: number;
  primaryCurrency: string;
  budgets: Budget[];
}

export interface BudgetNotification {
  id: string;
  budgetId: string;
  budgetName: string;
  thresholdPercent: number;
  percentUsed: number;
  amountSpent: number;
  budgetAmount: number;
  currency: string;
  createdAt: string;
  isRead: boolean;
}

export interface BudgetNotificationList {
  notifications: BudgetNotification[];
  unreadCount: number;
  totalCount: number;
}

export interface DailySpending {
  date: string;
  amount: number;
  cumulativeAmount: number;
  budgetProrated: number;  // Prorated budget amount for the day
}

export interface CategorySpending {
  labelId: string;
  labelName: string;
  labelColor?: string;
  labelIcon?: string;
  amount: number;
  percentage: number;
  transactionCount: number;
}

export interface BudgetSpendingBreakdown {
  budgetId: string;
  budgetName: string;
  budgetAmount: number;
  totalSpent: number;
  percentUsed: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  byCategory: CategorySpending[];
  dailySpending: DailySpending[];
}

// Request types
export interface BudgetAlertRequest {
  thresholdPercent: number;  // 0-100
  notifyEnabled: boolean;
}

export interface CreateBudgetRequest {
  name: string;
  description?: string;
  amount: number;
  currency?: string;
  period: string;  // BudgetPeriod as string
  startDate?: string;
  endDate?: string;
  labelIds?: string[];
  accountIds?: string[];
  alerts?: BudgetAlertRequest[];
  color?: string;
  icon?: string;
}

export interface UpdateBudgetRequest {
  name?: string;
  description?: string;
  amount?: number;
  currency?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  labelIds?: string[];
  accountIds?: string[];
  alerts?: BudgetAlertRequest[];
  isActive?: boolean;
  color?: string;
  icon?: string;
}

// Budget period configuration
export const budgetPeriodConfig: Record<BudgetPeriod, { label: string; description: string }> = {
  Weekly: { label: 'Weekly', description: 'Resets every week' },
  Monthly: { label: 'Monthly', description: 'Resets every month' },
  Quarterly: { label: 'Quarterly', description: 'Resets every 3 months' },
  Yearly: { label: 'Yearly', description: 'Resets every year' },
  Custom: { label: 'Custom', description: 'Custom date range' },
};

// Default alert thresholds
export const defaultAlerts: BudgetAlertRequest[] = [
  { thresholdPercent: 50, notifyEnabled: false },
  { thresholdPercent: 80, notifyEnabled: true },
  { thresholdPercent: 100, notifyEnabled: true },
];

// Budget status helper — green <70%, amber 70-90%, red >90%
export function getBudgetStatus(budget: Budget): 'healthy' | 'warning' | 'danger' | 'exceeded' {
  if (budget.percentUsed >= 100) return 'exceeded';
  if (budget.percentUsed >= 90) return 'danger';
  if (budget.percentUsed >= 70) return 'warning';
  return 'healthy';
}

// Budget status colors
export const budgetStatusColors = {
  healthy: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', bar: 'bg-green-500', badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  danger: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  exceeded: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-600', badge: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
};

// Get the budget spending pace (daily burn rate vs expected)
export function getBudgetPace(budget: Budget): 'under' | 'on' | 'over' {
  // Calculate what percentage should have been spent by now based on elapsed time
  const start = new Date(budget.periodStart);
  const end = new Date(budget.periodEnd);
  const now = new Date();
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const expectedPercent = (elapsedDays / totalDays) * 100;
  
  const diff = budget.percentUsed - expectedPercent;
  if (diff > 10) return 'over';
  if (diff < -10) return 'under';
  return 'on';
}