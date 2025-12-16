export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  currency: string;
  emailIntegration?: EmailIntegration;
  createdAt: Date;
  updatedAt: Date;
}

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
  merchantMappings?: MerchantCategoryMapping[];
  customBankPatterns?: BankPattern[];
}

export interface MerchantCategoryMapping {
  merchantKeyword: string;
  categoryId: string;
  createdAt: Date;
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
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval: number;
  endDate?: Date;
  customDays?: number[];
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  period: 'monthly' | 'yearly' | 'custom';
  startDate: Date;
  endDate?: Date;
  alertThreshold: number;
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
  amount: number; // Always positive
  accountId: string; // Which account this affects
  
  // CLASSIFICATION
  categoryId: string;
  description: string;
  tags: string[]; // Flexible labels: ['investment', 'tax-deductible', 'recurring', etc.]
  
  // PAYMENT DETAILS
  paymentMethodId?: string; // How was it paid (card, UPI, cash, etc.)
  date: Date;
  notes?: string;
  
  // RECURRENCE
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  
  // SOURCE & PARSING
  source?: 'manual' | 'email' | 'sms' | 'api';
  sourceEmailId?: string;
  merchantName?: string;
  parsedData?: ParsedTransactionData;
  
  // REVIEW & APPROVAL
  reviewStatus: 'pending' | 'approved' | 'rejected';
  
  // LINKED TRANSACTIONS (for transfers)
  linkedTransactionId?: string; // If this is part of a transfer, links to the other side
  
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

