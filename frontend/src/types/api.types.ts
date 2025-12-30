/**
 * Centralized API Type Definitions
 * Single source of truth for all API-related types
 */

// ===========================
// Common Types
// ===========================

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// ===========================
// Transaction Types
// ===========================

export type TransactionType = 'credit' | 'debit';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface TransactionSplit {
  id?: string;
  transactionId?: string;
  userId?: string;
  categoryId: string;
  amount: number;
  tags: string[];
  notes?: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  day?: number;
  endDate?: string;
  lastCreated?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  accountId: string;
  categoryId?: string; // Deprecated - use splits
  description: string;
  tags?: string[]; // Deprecated - use splits
  date: string;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  source?: string;
  merchantName?: string;
  reviewStatus: ReviewStatus;
  linkedTransactionId?: string;
  splits?: TransactionSplit[];
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
  reviewedAt?: string;
}

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  categoryIds?: string;
  type?: TransactionType | 'all';
  tags?: string;
  includeTags?: string;
  excludeTags?: string;
  startDate?: string;
  endDate?: string;
  reviewStatus?: ReviewStatus | 'all';
  search?: string;
  minAmount?: string;
  maxAmount?: string;
  limit?: string;
  skip?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeSplits?: string;
  isRecurring?: string;
}

// ===========================
// Category Types
// ===========================

export interface Category {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  isFolder: boolean;
  icon?: string;
  color?: string;
  path: string[];
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryStats {
  categoryId: string;
  name: string;
  totalSpent: number;
  transactionCount: number;
  avgAmount: number;
  color?: string;
}

// ===========================
// Account Types
// ===========================

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash' | 'loan' | 'other';

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType; // Using 'type' for consistency with existing code
  accountType?: AccountType; // Alias for backward compatibility
  balance: number;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
  bankName?: string; // Using bankName for consistency
  institution?: string; // Alias for backward compatibility
  accountNumber?: string;
  initialBalance?: number; // Initial balance when account was created
  color?: string;
  icon?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountBalance {
  currentBalance: number;
  availableBalance: number;
  lastUpdated: string;
}

// ===========================
// Budget Types
// ===========================

export type BudgetPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type BudgetScopeType = 'category' | 'tag' | 'account';

export interface Budget {
  id: string;
  userId: string;
  name: string;
  amount: number;
  spent?: number;
  period: BudgetPeriod;
  startDate: string;
  endDate?: string;
  scopeType: BudgetScopeType;
  categoryId?: string;
  accountId?: string;
  includeTagIds?: string[];
  excludeTagIds?: string[];
  rolloverEnabled: boolean;
  rolledOverAmount?: number;
  alertThreshold?: number;
  alertsEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===========================
// Tag Types
// ===========================

export interface Tag {
  id: string;
  userId: string;
  name: string;
  color?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

// ===========================
// Analytics Types
// ===========================

export interface SpendingByCategory {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  color: string;
  transactionCount: number;
}

export interface SpendingTrend {
  date: string;
  amount: number;
  type: TransactionType;
}

export interface MonthlyComparison {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

export interface AnalyticsData {
  spendingByCategory: SpendingByCategory[];
  spendingTrends: SpendingTrend[];
  monthlyComparison: MonthlyComparison[];
  topMerchants: Array<{ merchant: string; amount: number; count: number }>;
  budgetUtilization: Array<{ budgetName: string; utilized: number; total: number }>;
}

// ===========================
// User & Auth Types
// ===========================

export interface User {
  id: string;
  email: string;
  name: string;
  currency: string;
  timezone?: string;
  dateFormat?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  currency?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ===========================
// Config Types
// ===========================

export interface AppConfig {
  features: {
    emailSync: boolean;
    smsSync: boolean;
    budgetAlerts: boolean;
    recurringTransactions: boolean;
  };
  limits: {
    maxTransactionsPerMonth: number;
    maxCategories: number;
    maxBudgets: number;
  };
}

// ===========================
// Dashboard Types
// ===========================

export interface DashboardStats {
  totalSpent: number;
  monthSpent: number;
  monthIncome: number;
  netSavings: number;
  budgetLeft: number;
  categoryCount: number;
  expenseCount: number;
  incomeCount: number;
  avgDailySpending: number;
  percentChange: number;
  incomePercentChange: number;
}
