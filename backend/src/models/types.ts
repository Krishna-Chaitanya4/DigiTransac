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
