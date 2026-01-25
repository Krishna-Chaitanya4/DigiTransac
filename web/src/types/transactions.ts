// Transaction types
// Note: 'Transfer' is a UI-only concept. Backend only uses Send/Receive.
// A transfer creates a linked Send (source) + Receive (destination) pair.

export type TransactionType = 'Receive' | 'Send';

// UI type includes Transfer for form display
export type TransactionUIType = TransactionType | 'Transfer';

export type TransactionRole = 'Sender' | 'Receiver';

export type TransactionStatus = 'Pending' | 'Confirmed' | 'Declined';

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

export interface TagInfo {
  id: string;
  name: string;
  color?: string;
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
  tags: TagInfo[];
  location?: TransactionLocation;
  transferToAccountId?: string;
  transferToAccountName?: string;
  linkedTransactionId?: string;
  recurringRule?: RecurringRule;
  parentTransactionId?: string;
  isRecurringTemplate: boolean;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
  // P2P fields
  transactionLinkId?: string;
  counterpartyEmail?: string;
  counterpartyUserId?: string;
  role?: TransactionRole;
  lastSyncedAt?: string;
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
  // P2P fields (optional for Send/Receive types)
  counterpartyEmail?: string;
  counterpartyAmount?: number;
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
  status?: TransactionStatus;
  transferToAccountId?: string;
  accountId?: string;
}

export interface TransactionFilter {
  startDate?: string;
  endDate?: string;
  accountIds?: string[];
  types?: TransactionUIType[];  // Uses UI types including Transfer (for detecting linked transactions)
  labelIds?: string[];
  folderIds?: string[];  // UI-only: selected folders (expanded to labelIds for API)
  tagIds?: string[];
  minAmount?: number;
  maxAmount?: number;
  searchText?: string;
  status?: TransactionStatus;
  isRecurring?: boolean;
  page?: number;
  pageSize?: number;
}

// Transaction type configuration (for API types)
export const transactionTypeConfig: Record<TransactionType, { label: string; icon: string; color: string }> = {
  Receive: { label: 'Receive', icon: '↓', color: '#10B981' },   // Green - money in
  Send: { label: 'Send', icon: '↑', color: '#EF4444' },     // Red - money out
};

// UI type configuration (includes Transfer for forms)
export const transactionUITypeConfig: Record<TransactionUIType, { label: string; icon: string; color: string }> = {
  Receive: { label: 'Receive', icon: '↓', color: '#10B981' },   // Green - money in
  Send: { label: 'Send', icon: '↑', color: '#EF4444' },     // Red - money out
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

// P2P Pending Transaction types
export interface PendingP2PTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  date: string;
  title?: string;
  counterpartyEmail?: string;
  role?: TransactionRole;
  transactionLinkId?: string;
}

export interface PendingP2PListResponse {
  transactions: PendingP2PTransaction[];
  totalCount: number;
}

export interface AcceptP2PRequest {
  accountId: string;
  amount: number; // The actual amount received (may differ from sender's amount due to currency conversion)
  splits: TransactionSplitRequest[];
  tagIds?: string[];
  notes?: string;
}

export interface RejectP2PRequest {
  reason?: string;
}
