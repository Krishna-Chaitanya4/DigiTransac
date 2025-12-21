export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  currency: string;
  emailIntegration?: EmailIntegration;

  // FUTURE: Multi-user settings (optional, for future expansion)
  upiId?: string; // For UPI payments between users
  phoneNumber?: string; // For notifications and UPI

  // FUTURE: Location tracking preferences (optional, for geo features)
  locationSettings?: {
    enabled: boolean; // Master toggle
    captureMode: 'always' | 'ask' | 'never'; // When to capture
    precision: 'exact' | 'approximate'; // Privacy level (exact GPS or rounded)
    saveHistory: boolean; // Whether to store location data
    sharePrecision?: 'exact' | 'city' | 'none'; // For future group features
  };

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
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  day?: number; // Day of month (for monthly/yearly)
  endDate?: Date;
  lastCreated?: Date; // Track last time recurring transaction was created
}

export interface Budget {
  id: string;
  userId: string;
  
  // Budget scope - what to track
  scopeType: 'category' | 'tag' | 'account'; // Which dimension to track
  categoryId?: string; // For category-based budgets (can be folder or leaf category)
  includeTagIds?: string[]; // For tag-based budgets: transactions MUST have these tags (OR logic)
  excludeTagIds?: string[]; // For tag-based budgets: transactions must NOT have these tags
  accountId?: string; // For account-based budgets
  
  // Budget calculation type
  calculationType: 'debit' | 'credit' | 'net'; // debit=expenses, credit=income, net=income-expenses
  
  amount: number;
  period: 'monthly' | 'yearly' | 'custom';
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

  // TRANSACTION DETAILS
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
  reviewedAt?: Date; // When transaction was approved/rejected
  rejectionReason?: string; // Why transaction was rejected
  confidence?: number; // 0-100, parser confidence score
  originalContent?: string; // Original email/SMS content for reference

  // LINKED TRANSACTIONS (for transfers)
  linkedTransactionId?: string; // If this is part of a transfer, links to the other side

  // FUTURE: MULTI-USER & COLLABORATION (Optional fields for future expansion)
  organizationId?: string; // For shared expenses in organizations/groups
  paidBy?: string; // userId who actually paid (defaults to userId for single-user mode)
  sharedWith?: string[]; // Array of userIds this transaction is shared with

  // FUTURE: PAYMENT INTEGRATION (Optional fields for future UPI/payment tracking)
  paymentMethodType?: 'upi' | 'card' | 'bank' | 'cash' | 'other';
  upiTransactionId?: string; // UPI transaction reference ID
  paymentStatus?: 'pending' | 'processing' | 'completed' | 'failed';

  // FUTURE: INTER-USER TRANSACTIONS (Optional fields for send/receive between users)
  counterpartyUserId?: string; // The other user in a send/receive transaction
  settlementStatus?: 'pending_approval' | 'approved' | 'rejected' | 'settled';
  settlementProof?: string; // URL to payment proof/receipt

  // FUTURE: LOCATION TRACKING (Optional fields for geo-based analytics)
  location?: {
    latitude: number;
    longitude: number;
    address?: string; // Full address
    placeName?: string; // Merchant/place name (e.g., "Starbucks")
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    accuracy?: number; // GPS accuracy in meters
    source?: 'gps' | 'manual' | 'ip' | 'email'; // How location was obtained
  };
  locationCapturedAt?: Date; // Timestamp when location was captured

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

// FUTURE: Organization/Group support (for multi-user features)
// These interfaces are ready but not yet implemented in the API
export interface Organization {
  id: string;
  name: string;
  ownerId: string; // User who created the organization
  memberCount: number;
  plan: 'free' | 'premium' | 'enterprise';
  settings: {
    allowMemberInvites: boolean;
    requireApprovalForExpenses: boolean;
    currency: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: string[];
  invitedBy?: string;
  joinedAt: Date;
}

// FUTURE: Settlement tracking (for split expenses between users)
export interface Settlement {
  id: string;
  transactionId: string; // Original transaction being settled
  fromUserId: string; // Who owes money
  toUserId: string; // Who is owed money
  amount: number;
  currency: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'completed';
  paymentMethod?: 'upi' | 'bank_transfer' | 'cash' | 'other';
  upiTransactionId?: string;
  proofUrl?: string; // Receipt/screenshot URL
  notes?: string;
  dueDate?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// FUTURE: Pending actions/notifications queue
export interface PendingAction {
  id: string;
  userId: string; // Who needs to take action
  type:
    | 'transaction_approval'
    | 'settlement_request'
    | 'organization_invite'
    | 'split_expense_invite';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  priority: 'low' | 'medium' | 'high';

  // Related entities
  relatedTransactionId?: string;
  relatedSettlementId?: string;
  relatedOrganizationId?: string;
  fromUserId?: string; // Who initiated this action

  data: any; // Flexible payload for action-specific data
  expiresAt?: Date;
  actionTakenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
