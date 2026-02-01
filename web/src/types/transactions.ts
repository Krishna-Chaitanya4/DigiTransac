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
  // Chat integration
  chatMessageId?: string; // Reference to chat message for "View in Chat" action
  // Timezone-aware date fields (for global travel support)
  dateLocal?: string;     // "YYYY-MM-DD" - the human-intended calendar date (always display this if available)
  dateTimezone?: string;  // IANA timezone e.g., "Asia/Kolkata" (original timezone at creation)
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
  // Timezone-aware date fields (for global travel support)
  dateLocal?: string;     // "YYYY-MM-DD" - the human-intended calendar date
  dateTimezone?: string;  // IANA timezone e.g., "Asia/Kolkata"
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
  // Timezone-aware date fields (for global travel support)
  dateLocal?: string;     // "YYYY-MM-DD" - the human-intended calendar date
  dateTimezone?: string;  // IANA timezone e.g., "Asia/Kolkata"
}

export interface TransactionFilter {
  startDate?: string;
  endDate?: string;
  accountIds?: string[];
  types?: TransactionUIType[];  // Uses UI types including Transfer (for detecting linked transactions)
  labelIds?: string[];
  folderIds?: string[];  // UI-only: selected folders (expanded to labelIds for API)
  tagIds?: string[];
  counterpartyUserIds?: string[];  // Filter by counterparty users
  minAmount?: number;
  maxAmount?: number;
  searchText?: string;
  status?: TransactionStatus;
  isRecurring?: boolean;
  page?: number;
  pageSize?: number;
}

// Counterparty info from API
export interface CounterpartyInfo {
  userId: string;
  email: string;
  name: string | null;
  transactionCount: number;
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

// ============ Extended Analytics Types ============

// Top Counterparties (Payees) Response
export interface TopCounterpartiesResponse {
  counterparties: CounterpartySpending[];
  currency: string;
}

export interface CounterpartySpending {
  name: string;
  userId?: string;
  email?: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
  type: 'Payee' | 'P2P';
}

// Spending by Account Response
export interface SpendingByAccountResponse {
  accounts: AccountSpending[];
  currency: string;
}

export interface AccountSpending {
  accountId: string;
  accountName: string;
  accountCurrency: string;
  totalDebits: number;
  totalCredits: number;
  netChange: number;
  transactionCount: number;
  percentage: number;
}

// Spending Patterns Response
export interface SpendingPatternsResponse {
  byDayOfWeek: DayOfWeekSpending[];
  byHourOfDay: HourOfDaySpending[];
  currency: string;
}

export interface DayOfWeekSpending {
  dayOfWeek: number;  // 0 = Sunday, 6 = Saturday
  dayName: string;
  totalAmount: number;
  transactionCount: number;
  averageAmount: number;
}

export interface HourOfDaySpending {
  hour: number;       // 0-23
  label: string;      // "12 AM", "1 PM", etc.
  totalAmount: number;
  transactionCount: number;
  averageAmount: number;
}

// Spending Anomalies Response
export interface SpendingAnomaliesResponse {
  anomalies: SpendingAnomaly[];
  currency: string;
}

export type AnomalyType = 'HighTransaction' | 'UnusualCategory' | 'SpendingSpike' | 'NewPayee';
export type AnomalySeverity = 'Low' | 'Medium' | 'High';

export interface SpendingAnomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  amount?: number;
  transactionId?: string;
  categoryName?: string;
  payeeName?: string;
  detectedAt: string;
}
