/**
 * DigiTransac Frontend Types
 * Shared TypeScript interfaces for the React frontend
 */

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: Record<string, unknown>;
}

// Pagination
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

// User
export interface User {
  id: string;
  email: string;
  username: string;
  fullName: string;
  currency?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Category
export type CategoryType = 'Category' | 'Folder';

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
  parentId?: string;
  transactionCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
  // Frontend only
  children?: Category[];
  isExpanded?: boolean;
}

// Account
export type AccountType = 'bank_account' | 'credit_card' | 'debit_card' | 'cash' | 'upi' | 'wallet';

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  balance: number;
  currency?: string;
  bankName?: string;
  lastFour?: string;
  isDefault?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Transaction
export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string;
  amount: number;
  date: Date;
  type: 'income' | 'expense' | 'transfer';
  description?: string;
  merchantName?: string;
  tags?: string[];
  notes?: string;
  isRecurring?: boolean;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  createdAt?: Date;
  updatedAt?: Date;
}

// Budget
export interface Budget {
  id: string;
  userId: string;
  name: string;
  amount: number;
  period: 'monthly' | 'yearly' | 'custom';
  categoryIds?: string[];
  tagIds?: string[];
  startDate?: Date;
  endDate?: Date;
  enableRollover?: boolean;
  alertThresholds?: number[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Tag
export interface Tag {
  id: string;
  userId: string;
  name: string;
  color?: string;
  usageCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Auth
export interface AuthContext {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, fullName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// API Requests
export interface CreateCategoryRequest {
  name: string;
  type: CategoryType;
  parentId?: string;
  icon?: string;
  color?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  icon?: string;
  color?: string;
  parentId?: string;
  type?: CategoryType;
}

export interface CreateAccountRequest {
  name: string;
  type: AccountType;
  balance: number;
  currency?: string;
  bankName?: string;
  lastFour?: string;
}

export interface UpdateAccountRequest {
  name?: string;
  balance?: number;
  isDefault?: boolean;
}