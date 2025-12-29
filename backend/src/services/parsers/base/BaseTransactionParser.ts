/**
 * Base Transaction Parser
 * Abstract base class for all transaction parsers (SMS, Email, etc.)
 * Implements common parsing logic and integration with utilities
 */

import { ParsedTransaction, ParserOptions, BankPattern } from './types';
import { detectTransactionTags } from '../../../utils/transactionTags';
import { getLearnedMapping } from '../../merchantLearning.service';
import { normalizeMerchantName, matchAccount } from '../../../utils/accountMatcher';
import { mongoDBService } from '../../../config/mongodb';
import { logger } from '../../../utils/logger';
import { parseDate } from '../utils/dateParser';
import { cleanMerchantName, isValidMerchantName } from '../utils/merchantNormalizer';
import { calculateConfidenceScore } from '../utils/confidenceScorer';
import { BANK_PATTERNS, getBankPatternBySender } from '../patterns/bankPatterns';

/**
 * Abstract base parser for financial transactions
 * Provides common functionality for SMS, Email, and other channels
 */
export abstract class BaseTransactionParser {
  protected bankPatterns: readonly BankPattern[] = BANK_PATTERNS;

  /**
   * Parse transaction from text
   * Template method - subclasses can override specific steps
   */
  async parseTransaction(
    text: string,
    sender: string,
    userId: string,
    options?: Partial<ParserOptions>
  ): Promise<ParsedTransaction | null> {
    if (!text?.trim()) {
      logger.warn('Empty text provided for parsing');
      return null;
    }

    // Find matching bank pattern
    const bankPattern = this.findBankPattern(text, sender);
    if (!bankPattern) {
      logger.debug(`No matching bank pattern found for sender: ${sender}`);
      return null;
    }

    // Try to extract transaction data using bank patterns
    const extracted = this.extractTransactionData(text, bankPattern);
    if (!extracted || !extracted.amount) {
      logger.debug('Failed to extract transaction data');
      return null;
    }

    // Build parsed transaction
    const transaction: ParsedTransaction = {
      amount: extracted.amount,
      merchant: extracted.merchant,
      date: extracted.date,
      bankName: extracted.bankName || bankPattern.name,
      cardLast4: extracted.cardLast4,
      accountNumber: extracted.accountNumber,
      transactionId: extracted.transactionId,
      referenceNumber: extracted.referenceNumber,
      type: extracted.type,
      rawText: text,
      confidence: calculateConfidenceScore(extracted),
    };

    // Clean merchant name if present
    if (transaction.merchant) {
      transaction.merchant = cleanMerchantName(transaction.merchant);
      
      // Validate cleaned merchant name
      if (!isValidMerchantName(transaction.merchant)) {
        transaction.merchant = undefined;
      }
    }

    // Apply integrations if enabled
    if (options?.enableTagging !== false && transaction.merchant) {
      await this.applyTagDetection(transaction);
    }

    if (options?.enableLearning !== false && transaction.merchant) {
      await this.applyLearning(transaction, userId);
    }

    if (options?.enableAccountMatching !== false) {
      await this.applyAccountMatching(transaction, userId);
    }

    return transaction;
  }

  /**
   * Find matching bank pattern for the transaction
   * Can be overridden by subclasses for channel-specific logic
   */
  protected findBankPattern(text: string, sender: string): BankPattern | undefined {
    // Explicitly unknown bank - don't try to match
    if (sender === 'UNKNOWN') {
      return undefined;
    }

    // First try to match by sender (if sender is provided and meaningful)
    if (sender && sender !== 'unknown-user') {
      let pattern = getBankPatternBySender(sender);
      if (pattern) {
        return pattern;
      }
    }

    // Fallback: Try to detect bank from text content
    // This allows parsing when sender is missing/unknown but text contains bank info
    for (const bankPattern of this.bankPatterns) {
      for (const patternConfig of bankPattern.patterns) {
        if (patternConfig.regex.test(text)) {
          return bankPattern;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract transaction data using bank patterns
   * Uses custom extractor if available, otherwise uses capture groups
   */
  protected extractTransactionData(
    text: string,
    bankPattern: BankPattern
  ): Partial<ParsedTransaction> | null {
    for (const patternConfig of bankPattern.patterns) {
      const match = text.match(patternConfig.regex);
      if (!match) {
        continue;
      }

      // Use custom extractor if provided
      if (patternConfig.extract) {
        const extracted = patternConfig.extract(match);
        return this.enrichTransactionData(extracted, text, bankPattern);
      }

      // Use standard capture group extraction
      const extracted: Partial<ParsedTransaction> = {};

      if (patternConfig.amountGroup && match[patternConfig.amountGroup]) {
        const amountStr = match[patternConfig.amountGroup].replace(/,/g, '');
        extracted.amount = parseFloat(amountStr);
      }

      if (patternConfig.merchantGroup && match[patternConfig.merchantGroup]) {
        extracted.merchant = match[patternConfig.merchantGroup].trim();
      }

      return this.enrichTransactionData(extracted, text, bankPattern);
    }

    return null;
  }

  /**
   * Enrich transaction data with additional extracted fields
   * Extracts card number, date, transaction ID, transaction type, etc.
   */
  protected enrichTransactionData(
    extracted: Partial<ParsedTransaction>,
    text: string,
    bankPattern: BankPattern
  ): Partial<ParsedTransaction> {
    // Extract transaction type if not already set
    if (!extracted.type) {
      const lowerText = text.toLowerCase();
      if (lowerText.includes('credited') || lowerText.includes('received') || lowerText.includes('deposit')) {
        extracted.type = 'credit';
      } else if (lowerText.includes('debited') || lowerText.includes('spent') || lowerText.includes('withdrawn') || lowerText.includes('paid')) {
        extracted.type = 'debit';
      }
    }

    // Extract card number
    if (bankPattern.cardPattern) {
      const cardMatch = text.match(bankPattern.cardPattern);
      if (cardMatch && cardMatch[1]) {
        extracted.cardLast4 = cardMatch[1];
      }
    }

    // Extract account number
    if (bankPattern.accountPattern) {
      const accountMatch = text.match(bankPattern.accountPattern);
      if (accountMatch && accountMatch[1]) {
        extracted.accountNumber = accountMatch[1];
      }
    }

    // Extract date
    if (bankPattern.datePattern) {
      const dateMatch = text.match(bankPattern.datePattern);
      if (dateMatch && dateMatch[1]) {
        extracted.date = parseDate(dateMatch[1]);
      }
    }

    // Extract transaction ID (channel-specific, can be overridden)
    if (!extracted.transactionId && !extracted.referenceNumber) {
      const txnId = this.extractTransactionId(text);
      if (txnId) {
        extracted.transactionId = txnId;
      }
    }

    return extracted;
  }

  /**
   * Extract transaction ID from text
   * Can be overridden by subclasses for channel-specific patterns
   */
  protected extractTransactionId(text: string): string | undefined {
    const patterns = [
      /(?:TXN\s+ID|TXN|TRANSACTION|REF|REFERENCE)\s*[:#]?\s*([A-Z0-9]{8,})/i,
      /(?:UPI|IMPS|NEFT)\s*REF\s*[:#]?\s*([A-Z0-9]{8,})/i,
      /Reference\s*No\.?\s*[:#]?\s*([A-Z0-9]{8,})/i,
      /\bID\s+([A-Z0-9]{8,})\b/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].toUpperCase();
      }
    }

    return undefined;
  }

  /**
   * Apply tag detection to transaction
   */
  protected async applyTagDetection(transaction: ParsedTransaction): Promise<void> {
    try {
      const type = transaction.type || 'debit';
      const tagResult = await detectTransactionTags(
        type,
        transaction.rawText,
        transaction.merchant || ''
      );
      if (tagResult && tagResult.tags && tagResult.tags.length > 0) {
        transaction.tags = tagResult.tags;
      }
    } catch (error) {
      logger.error({ err: error }, 'Error detecting tags');
    }
  }

  /**
   * Apply learned merchant mapping
   */
  protected async applyLearning(transaction: ParsedTransaction, userId: string): Promise<void> {
    try {
      if (!transaction.merchant) {
        return;
      }

      const normalizedMerchant = normalizeMerchantName(transaction.merchant);
      const learned = await getLearnedMapping(userId, normalizedMerchant);

      if (learned?.categoryId) {
        transaction.learnedCategoryId = learned.categoryId;
      }

      if (learned?.accountId) {
        transaction.learnedAccountId = learned.accountId;
      }
    } catch (error) {
      logger.error({ err: error }, 'Error applying learned mapping');
    }
  }

  /**
   * Apply account matching
   */
  protected async applyAccountMatching(
    transaction: ParsedTransaction,
    userId: string
  ): Promise<void> {
    try {
      if (!transaction.accountNumber && !transaction.cardLast4) {
        return;
      }

      const accountsContainer = await mongoDBService.getAccountsContainer();
      const identifier = transaction.accountNumber || transaction.cardLast4 || '';
      const matchedAccount = await matchAccount(
        userId,
        accountsContainer as any, // Type assertion needed due to MongoDB Collection type complexity
        transaction.bankName,
        identifier
      );

      if (matchedAccount) {
        transaction.matchedAccountId = matchedAccount;
      }
    } catch (error) {
      logger.error({ err: error }, 'Error matching account');
    }
  }

  /**
   * Detect if text is a transaction message
   * Can be overridden by subclasses for channel-specific logic
   */
  public isTransactionMessage(text: string): boolean {
    if (!text?.trim()) {
      return false;
    }

    const lowerText = text.toLowerCase();

    // Must contain transaction-related keywords
    const transactionKeywords = [
      'debited',
      'credited',
      'spent',
      'withdrawn',
      'paid',
      'payment',
      'purchase',
      'transaction',
      'received',
      'used',
    ];

    const hasTransactionKeyword = transactionKeywords.some((keyword) =>
      lowerText.includes(keyword)
    );

    if (!hasTransactionKeyword) {
      return false;
    }

    // Check for amount indicator
    const hasAmount = /(?:rs\.?|inr|rupees?)\s*[\d,]+/i.test(text);

    // Check for financial context
    const hasFinancialContext = /card|account|wallet|upi|bank/i.test(text) || hasAmount;

    // Strong transaction phrases don't need additional financial context
    const strongTransactionPhrases = [
      'payment received',
      'payment sent',
      'card was used',
      'transaction successful',
      'money debited',
      'money credited',
    ];

    const hasStrongPhrase = strongTransactionPhrases.some((phrase) =>
      lowerText.includes(phrase)
    );

    if (!hasFinancialContext && !hasStrongPhrase) {
      return false;
    }

    // Exclude promotional emails
    const promotionalPatterns = [
      /congratulations/i,
      /offer/i,
      /discount/i,
      /cashback.*upto/i,
      /get.*free/i,
      /limited.*time/i,
      /subscribe/i,
      /unsubscribe/i,
    ];

    const isPromotional = promotionalPatterns.some((pattern) => pattern.test(text));

    if (isPromotional) {
      return false;
    }

    return true;
  }
}
