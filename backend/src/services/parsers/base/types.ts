/**
 * Shared types for transaction parsing across all channels (SMS, Email, etc.)
 */

/**
 * Transaction type
 */
export type TransactionType = 'debit' | 'credit';

/**
 * Confidence level for parsed transactions
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Parsed transaction data - unified interface for all channels
 */
export interface ParsedTransaction {
  amount: number;
  type?: TransactionType; // Optional for email (always debit for card transactions)
  merchant?: string;
  date?: Date;
  bankName?: string;
  
  // Channel-specific fields
  cardLast4?: string; // Email: card transactions
  accountNumber?: string; // SMS: account-based transactions
  transactionId?: string; // Email: TXN ID, REF
  referenceNumber?: string; // SMS: reference number
  
  // Metadata
  rawText: string;
  confidence: number | ConfidenceLevel; // Number (0-1) or level string
  originalText?: string; // Alias for rawText (for SMS compatibility)
  
  // Integration fields
  tags?: string[]; // Auto-detected tags
  learnedCategoryId?: string; // Auto-filled from learning
  learnedAccountId?: string; // Auto-filled from learning
  matchedAccountId?: string; // Auto-matched from account info
}

/**
 * Bank pattern configuration for parsing
 */
export interface BankPattern {
  name: string;
  senders: string[]; // Email senders or SMS sender IDs
  patterns: PatternConfig[];
  cardPattern?: RegExp; // Optional: for extracting card numbers
  accountPattern?: RegExp; // Optional: for extracting account numbers
  datePattern?: RegExp; // Optional: bank-specific date format
}

/**
 * Pattern configuration for transaction extraction
 */
export interface PatternConfig {
  regex: RegExp;
  amountGroup?: number; // Capture group index for amount
  merchantGroup?: number; // Capture group index for merchant
  extract?: (match: RegExpMatchArray) => Partial<ParsedTransaction>; // Custom extractor for complex patterns
}

/**
 * Parser configuration options
 */
export interface ParserOptions {
  userId: string;
  bankName?: string;
  enableLearning?: boolean; // Enable merchant learning integration
  enableTagging?: boolean; // Enable auto-tagging
  enableAccountMatching?: boolean; // Enable account matching
}

/**
 * Parser result with metadata
 */
export interface ParserResult {
  success: boolean;
  transaction?: ParsedTransaction;
  error?: string;
  warnings?: string[];
}
