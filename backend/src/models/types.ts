export interface User {
  id: string;
  email?: string; // Optional - at least email or phone required
  phone?: string; // Optional - at least email or phone required
  username: string; // Required - unique identifier
  password: string;
  fullName: string; // Replaces firstName/lastName
  dateOfBirth?: Date; // Optional
  currency: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  emailIntegration?: EmailIntegration;

  createdAt: Date;
  updatedAt: Date;
}

// MongoDB filter helper type (simplified for flexibility)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MongoFilter<T> = Partial<Record<keyof T, any>> & {
  $or?: MongoFilter<T>[];
  $and?: MongoFilter<T>[];
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export interface EmailIntegration {
  enabled: boolean;
  provider: 'gmail' | 'outlook' | null;
  email: string; // User's connected email address
  accessToken: string;
  refreshToken: string;
  tokenExpiry: Date;
  lastProcessedAt?: Date;
  lastHistoryId?: string; // Gmail History ID for incremental delta sync
  totalEmailsProcessed: number;
  customBankPatterns?: BankPattern[];
}

export interface BankPattern {
  id: string;
  bankName: string;
  senderPattern: string;
  amountPattern: string;
  merchantPattern: string;
  datePattern: string;
  isActive: boolean;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
  isFolder: boolean;
  icon?: string;
  color?: string;
  path: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  name: string; // e.g., "HDFC Credit Card", "ICICI Debit Card", "Cash"
  type: 'credit_card' | 'debit_card' | 'bank_account' | 'cash' | 'upi' | 'wallet' | 'other';
  bankName?: string; // e.g., "HDFC Bank", "ICICI Bank"
  last4?: string; // Last 4 digits of card
  icon?: string;
  color?: string;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  userId: string;
  categoryId: string;
  paymentMethodId?: string; // Optional: which card/bank was used
  amount: number;
  description: string;
  date: Date;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  tags?: string[];
  notes?: string;
  source?: 'manual' | 'email' | 'sms';
  sourceEmailId?: string;
  merchantName?: string;
  parsedData?: ParsedTransactionData;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface ParsedTransactionData {
  rawText: string;
  bankName: string;
  cardLast4?: string;
  transactionId?: string;
  confidence: number;
}

export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  day?: number; // Day of month (for monthly/yearly)
  endDate?: Date;
  lastCreated?: Date; // Track last time recurring transaction was created
}

export interface Budget {
  id: string;
  userId: string;
  name?: string; // Optional user-defined name for the budget

  // Budget scope - what to track (AND logic between types, OR logic within each type)
  categoryIds?: string[]; // Track these categories (OR logic: cat1 OR cat2 OR cat3)
  includeTagIds?: string[]; // Transactions MUST have at least one of these tags (OR logic)
  excludeTagIds?: string[]; // Transactions must NOT have any of these tags (OR logic)
  accountIds?: string[]; // Track these accounts (OR logic: acc1 OR acc2)

  // Budget calculation type
  calculationType: 'debit' | 'net'; // debit=total expenses, net=expenses after refunds (debit-credit)

  amount: number;
  period: 'this-month' | 'next-month' | 'this-year' | 'custom';
  startDate: Date;
  endDate?: Date;

  // Alert configuration
  alertThreshold: number; // Primary threshold (percentage)
  alertThresholds?: number[]; // Multiple thresholds (e.g., [50, 80, 100])
  notificationChannels?: ('in-app' | 'email')[]; // Where to send alerts

  // Rollover configuration
  enableRollover?: boolean; // Allow unused budget to roll over to next period
  rolloverLimit?: number; // Max amount that can roll over (optional cap)
  rolledOverAmount?: number; // Amount rolled over from previous period

  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetAlert {
  budgetId: string;
  currentSpending: number;
  budgetAmount: number;
  percentageUsed: number;
  isExceeded: boolean;
}

// Account types for managing multiple accounts
export interface Account {
  id: string;
  userId: string;
  name: string; // e.g., "HDFC Checking", "Savings Account", "Cash Wallet"
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash' | 'loan' | 'other';
  bankName?: string;
  accountNumber?: string; // Encrypted or last 4 digits
  currency: string;
  balance: number; // Current balance
  initialBalance?: number; // Starting balance when account was added
  icon?: string;
  color?: string;
  isDefault?: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// New Transaction model (replaces/extends Expense)
export interface Transaction {
  id: string;
  userId: string;

  // CORE FIELDS
  type: 'credit' | 'debit'; // Money IN or OUT
  amount: number; // Always positive (total amount - sum of all splits)
  accountId: string; // Which account this affects

  // CLASSIFICATION (DEPRECATED - use splits instead, kept for backwards compatibility)
  categoryId?: string; // @deprecated Use splits[0].categoryId instead
  tags?: string[]; // @deprecated Use splits[].tags instead

  description: string;
  date: Date;

  // RECURRENCE
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;

  // SOURCE & PARSING (for email/SMS imports)
  source?: 'manual' | 'email' | 'sms' | 'api' | 'transfer';
  sourceEmailId?: string;
  merchantName?: string;
  parsedData?: ParsedTransactionData;

  // REVIEW & APPROVAL
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewedAt?: Date;
  rejectionReason?: string;
  confidence?: number; // Parser confidence score (0-100)
  originalContent?: string; // Original email/SMS for reference

  // LINKED TRANSACTIONS (for transfers between accounts)
  linkedTransactionId?: string;

  createdAt: Date;
  updatedAt: Date;
}

// Transaction Split - allows splitting one transaction across multiple categories
export interface TransactionSplit {
  id: string;
  transactionId: string; // References Transaction.id
  userId: string; // Denormalized for faster queries

  // CLASSIFICATION
  categoryId: string; // Each split has its own category
  amount: number; // Amount for this split (must be positive)

  // TAGS - Each split can have its own tags
  tags: string[]; // Flexible labels per split

  // OPTIONAL
  notes?: string; // Split-specific notes
  order: number; // Display order (1, 2, 3...)

  createdAt: Date;
  updatedAt: Date;
}

// Tag management
export interface Tag {
  id: string;
  userId: string;
  name: string;
  color?: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Merchant Learning - Remembers user's category/account choices for merchants
export interface MerchantLearning {
  id: string;
  userId: string;
  merchantName: string; // Normalized merchant name (lowercase, trimmed)
  categoryId: string; // Learned category
  accountId?: string; // Learned account (optional)
  usageCount: number; // How many times this mapping was used
  lastUsedAt: Date; // Most recent usage
  createdAt: Date;
  updatedAt: Date;
}
