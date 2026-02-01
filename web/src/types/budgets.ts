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

// Budget status helper
export function getBudgetStatus(budget: Budget): 'healthy' | 'warning' | 'danger' | 'exceeded' {
  if (budget.percentUsed >= 100) return 'exceeded';
  if (budget.percentUsed >= 80) return 'danger';
  if (budget.percentUsed >= 50) return 'warning';
  return 'healthy';
}

// Budget status colors
export const budgetStatusColors = {
  healthy: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', bar: 'bg-green-500' },
  warning: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', bar: 'bg-yellow-500' },
  danger: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', bar: 'bg-orange-500' },
  exceeded: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500' },
};