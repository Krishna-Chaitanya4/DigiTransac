/**
 * SMS Parser Service
 * Parses bank SMS messages using centralized base parser
 * Extends BaseTransactionParser for SMS-specific logic
 */

import { BaseTransactionParser } from './parsers/base/BaseTransactionParser';
import { ParsedTransaction } from './parsers/base/types';
import { logger } from '../utils/logger';
import { cleanMerchantName } from './parsers/utils/merchantNormalizer';
import { confidenceToLevel } from './parsers/utils/confidenceScorer';

// Re-export for backward compatibility
export type { ParsedTransaction };

/**
 * SMS-specific transaction parser
 * Inherits common parsing logic from BaseTransactionParser
 * Adds SMS-specific pattern handling
 */
export class SMSParserService extends BaseTransactionParser {
  /**
   * Parse transaction from SMS text
   * @param smsText - SMS message text
   * @param senderOrUserId - SMS sender ID or userId (for backward compatibility) - optional
   * @param userIdOptional - User ID (optional, for backward compatibility with 2-param calls)
   * @returns Parsed transaction or null if parsing fails
   */
  async parseSMS(
    smsText: string,
    senderOrUserId?: string,
    userIdOptional?: string
  ): Promise<ParsedTransaction | null> {
    // Handle backward compatibility:
    // - parseSMS(text) - no auth, detect sender
    // - parseSMS(text, userId) - auth, detect sender
    // - parseSMS(text, sender, userId) - full explicit
    let sender: string;
    let userId: string;

    if (!senderOrUserId) {
      // 1-param call: parseSMS(text) - no auth
      sender = this.detectSender(smsText) || 'UNKNOWN';
      userId = 'anonymous';
    } else if (userIdOptional) {
      // 3-param call: parseSMS(text, sender, userId)
      sender = senderOrUserId;
      userId = userIdOptional;
    } else {
      // 2-param call: parseSMS(text, userId) - detect sender from text
      userId = senderOrUserId;
      sender = this.detectSender(smsText) || 'UNKNOWN';
    }

    const transaction = await super.parseTransaction(smsText, sender, userId, {
      enableLearning: userId !== 'anonymous',
      enableTagging: userId !== 'anonymous',
      enableAccountMatching: userId !== 'anonymous',
    });

    if (!transaction) {
      return null;
    }

    // Convert numeric confidence to level string for SMS compatibility
    if (typeof transaction.confidence === 'number') {
      const confidenceLevel = confidenceToLevel(transaction.confidence);
      // Create a new object with the SMS-specific format
      return {
        ...transaction,
        confidence: confidenceLevel as any, // Keep numeric internally but expose as level
        originalText: transaction.rawText, // Add alias for backward compatibility
        type: transaction.type || 'debit', // Default to debit for SMS
      };
    }

    return transaction;
  }

  /**
   * Check if SMS text is a transaction message
   * @param text - SMS message text
   * @returns true if text contains transaction information
   */
  public isTransactionSMS(text: string): boolean {
    return this.isTransactionMessage(text);
  }

  /**
   * Get list of supported banks
   * @returns Array of bank names
   */
  public getSupportedBanks(): string[] {
    return this.bankPatterns.map((bp) => bp.name);
  }

  /**
   * Parse multiple SMS messages in batch
   * @param smsTexts - Array of SMS message texts
   * @param userId - User ID for learning and matching
   * @returns Array of parsed transactions
   */
  public async parseMultipleSMS(smsTexts: string[], userId: string): Promise<ParsedTransaction[]> {
    const results: ParsedTransaction[] = [];

    for (const text of smsTexts) {
      try {
        // Try to detect sender from text content (fallback to 'UNKNOWN')
        const sender = this.detectSender(text) || 'UNKNOWN';
        const parsed = await this.parseSMS(text, sender, userId);
        if (parsed) {
          results.push(parsed);
        }
      } catch (error) {
        logger.error({ err: error }, 'Error parsing SMS');
      }
    }

    return results;
  }

  /**
   * Detect sender/bank from SMS text content
   */
  private detectSender(text: string): string | undefined {
    const lowerText = text.toLowerCase();

    // Try to detect bank from common keywords
    if (lowerText.includes('hdfc')) return 'HDFCBK';
    if (lowerText.includes('icici')) return 'ICICIB';
    if (lowerText.includes('sbi') || lowerText.includes('state bank')) return 'SBIIN';
    if (lowerText.includes('axis')) return 'AXISBK';
    if (lowerText.includes('kotak')) return 'KOTAKB';
    if (lowerText.includes('pnb') || lowerText.includes('punjab')) return 'PNBSMS';
    if (lowerText.includes('bob') || lowerText.includes('baroda')) return 'BOBIN';
    if (lowerText.includes('canara')) return 'CANBNK';
    if (lowerText.includes('union bank')) return 'UBOI';
    if (lowerText.includes('idbi')) return 'IDBIBN';

    return undefined;
  }

  /**
   * Check if transaction is duplicate
   * @param parsed - Parsed transaction
   * @param existing - Existing transactions
   * @returns true if duplicate found
   */
  public isDuplicate(
    parsed: ParsedTransaction,
    existing: Array<{ amount: number; date: Date; description?: string }>
  ): boolean {
    const parsedAmount = Math.abs(parsed.amount);
    const parsedDate = parsed.date;

    if (!parsedDate) {
      return false;
    }

    // Check for exact match within same day
    for (const existingTxn of existing) {
      const existingAmount = Math.abs(existingTxn.amount);
      const existingDate = existingTxn.date;

      // Same amount check
      if (Math.abs(existingAmount - parsedAmount) < 0.01) {
        // Same day check
        if (
          existingDate.getFullYear() === parsedDate.getFullYear() &&
          existingDate.getMonth() === parsedDate.getMonth() &&
          existingDate.getDate() === parsedDate.getDate()
        ) {
          // Same merchant check (if available)
          if (parsed.merchant && existingTxn.description) {
            const normalizedParsed = parsed.merchant.toLowerCase();
            const normalizedExisting = existingTxn.description.toLowerCase();
            if (
              normalizedExisting.includes(normalizedParsed) ||
              normalizedParsed.includes(normalizedExisting)
            ) {
              return true;
            }
          } else {
            // If no merchant info, consider it duplicate based on amount + date
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Extract clean merchant name
   * @param merchant - Raw merchant name
   * @returns Cleaned merchant name
   */
  public extractMerchant(merchant: string): string {
    return cleanMerchantName(merchant);
  }
}

// Export singleton instance for backward compatibility
export const smsParserService = new SMSParserService();
