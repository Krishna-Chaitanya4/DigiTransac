// Transaction types

export type TransactionType = 'Credit' | 'Debit' | 'Transfer';

export type RecurrenceFrequency = 
  | 'Daily' 
  | 'Weekly' 
  | 'Biweekly' 
  | 'Monthly' 
  | 'Quarterly' 
  | 'Yearly';

export interface TransactionSplit {
  labelId: string;
  labelName?: string;
  labelColor?: string;
  labelIcon?: string;
  amount: number;
  notes?: string;
}

export interface TransactionLocation {
  latitude: number;
  longitude: number;
  placeName?: string;
  city?: string;
  country?: string;
}

export interface RecurringRule {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate?: string;
  nextOccurrence: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  accountName?: string;
  type: TransactionType;
  amount: number;
  currency: string;
  date: string;
  title?: string;
  payee?: string;
  notes?: string;
  splits: TransactionSplit[];
  tagIds: string[];
  location?: TransactionLocation;
  transferToAccountId?: string;
  transferToAccountName?: string;
  linkedTransactionId?: string;
  recurringRule?: RecurringRule;
  parentTransactionId?: string;
  isRecurringTemplate: boolean;
  isCleared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TransactionSummary {
  totalCredits: number;
  totalDebits: number;
  netChange: number;
  transactionCount: number;
  byCategory: Record<string, number>;
  byTag: Record<string, number>;
  currency: string;
}

export interface RecurringTransaction {
  id: string;
  accountId: string;
  accountName?: string;
  type: TransactionType;
  amount: number;
  currency: string;
  title?: string;
  payee?: string;
  splits: TransactionSplit[];
  recurringRule: RecurringRule;
  createdAt: string;
}

// Request types
export interface TransactionSplitRequest {
  labelId: string;
  amount: number;
  notes?: string;
}

export interface TransactionLocationRequest {
  latitude: number;
  longitude: number;
  placeName?: string;
  city?: string;
  country?: string;
}

export interface RecurringRuleRequest {
  frequency: RecurrenceFrequency;
  interval?: number;
  endDate?: string;
}

export interface CreateTransactionRequest {
  accountId: string;
  type: TransactionType;
  amount: number;
  date: string;
  title?: string;
  payee?: string;
  notes?: string;
  splits: TransactionSplitRequest[];
  tagIds?: string[];
  location?: TransactionLocationRequest;
  transferToAccountId?: string;
  recurringRule?: RecurringRuleRequest;
}

export interface UpdateTransactionRequest {
  type?: TransactionType;
  amount?: number;
  date?: string;
  title?: string;
  payee?: string;
  notes?: string;
  splits?: TransactionSplitRequest[];
  tagIds?: string[];
  location?: TransactionLocationRequest;
  isCleared?: boolean;
  transferToAccountId?: string;
}

export interface TransactionFilter {
  startDate?: string;
  endDate?: string;
  accountId?: string;
  type?: TransactionType;
  labelId?: string;
  tagId?: string;
  minAmount?: number;
  maxAmount?: number;
  searchText?: string;
  isCleared?: boolean;
  isRecurring?: boolean;
  page?: number;
  pageSize?: number;
}

// Transaction type configuration
export const transactionTypeConfig: Record<TransactionType, { label: string; icon: string; color: string }> = {
  Credit: { label: 'Credit', icon: '↓', color: '#10B981' },   // Green - money in
  Debit: { label: 'Debit', icon: '↑', color: '#EF4444' },     // Red - money out
  Transfer: { label: 'Transfer', icon: '↔', color: '#3B82F6' }, // Blue - between accounts
};

// Recurrence frequency configuration
export const recurrenceFrequencyConfig: Record<RecurrenceFrequency, { label: string; description: string }> = {
  Daily: { label: 'Daily', description: 'Every day' },
  Weekly: { label: 'Weekly', description: 'Every week' },
  Biweekly: { label: 'Biweekly', description: 'Every 2 weeks' },
  Monthly: { label: 'Monthly', description: 'Every month' },
  Quarterly: { label: 'Quarterly', description: 'Every 3 months' },
  Yearly: { label: 'Yearly', description: 'Every year' },
};
