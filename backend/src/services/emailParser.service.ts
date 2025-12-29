/**
 * Email Parser Service
 * Parses bank transaction emails using centralized base parser
 * Extends BaseTransactionParser for email-specific logic
 */

import { BaseTransactionParser } from './parsers/base/BaseTransactionParser';
import { logger } from '../utils/logger';

/**
 * Email-specific parsed transaction with required fields
 * Compatible with existing email routes
 */
export interface ParsedTransaction {
  amount: number;
  merchant: string;
  date: Date;
  bankName: string;
  cardLast4?: string;
  transactionId?: string;
  rawText: string;
  confidence: number;
  tags?: string[];
  learnedCategoryId?: string;
  learnedAccountId?: string;
  matchedAccountId?: string;
}

/**
 * Email-specific transaction parser
 * Inherits common parsing logic from BaseTransactionParser
 */
export class EmailParserService extends BaseTransactionParser {
  /**
   * Parse transaction from email text
   * @param text - Email body text
   * @param sender - Email sender (e.g., 'HDFCBK', 'ICICIB') - optional
   * @param userId - User ID for learning and matching - optional
   * @returns Parsed transaction or null if parsing fails
   */
  override async parseTransaction(
    text: string,
    sender?: string,
    userId?: string
  ): Promise<ParsedTransaction | null> {
    const baseTransaction = await super.parseTransaction(
      text, 
      sender || '', // Empty string means no sender info, UNKNOWN means explicitly unknown
      userId || 'unknown-user',
      {
        enableLearning: !!userId, // Only enable if userId provided
        enableTagging: !!userId,
        enableAccountMatching: !!userId,
      }
    );

    if (!baseTransaction) {
      return null;
    }

    // Validate required fields for email transactions
    // Amount, merchant, and bankName are required; date is optional
    if (!baseTransaction.merchant || !baseTransaction.bankName) {
      logger.warn('Email transaction missing required fields');
      return null;
    }

    // Convert base transaction to email-specific format
    const emailTransaction: ParsedTransaction = {
      amount: baseTransaction.amount,
      merchant: baseTransaction.merchant,
      date: baseTransaction.date || new Date(), // Default to current date if not parsed
      bankName: baseTransaction.bankName,
      cardLast4: baseTransaction.cardLast4,
      transactionId: baseTransaction.transactionId,
      rawText: baseTransaction.rawText,
      confidence: typeof baseTransaction.confidence === 'number' 
        ? baseTransaction.confidence 
        : 0.8, // Default numeric confidence
      tags: baseTransaction.tags,
      learnedCategoryId: baseTransaction.learnedCategoryId,
      learnedAccountId: baseTransaction.learnedAccountId,
      matchedAccountId: baseTransaction.matchedAccountId,
    };

    return emailTransaction;
  }

  /**
   * Check if email text is a transaction message
   * @param text - Email body text
   * @returns true if text contains transaction information
   */
  public isTransactionSMS(text: string): boolean {
    return this.isTransactionMessage(text);
  }

  /**
   * Suggest category based on merchant name (fallback)
   * Used when learned category is not available
   * @param merchant - Merchant name
   * @returns Suggested category name or null if unknown
   */
  public suggestCategory(merchant: string): string | null {
    if (!merchant) {
      return 'Uncategorized';
    }

    const lowerMerchant = merchant.toLowerCase();

    // Category patterns with keywords
    const categories = [
      {
        category: 'Food & Dining',
        keywords: [
          'swiggy',
          'zomato',
          'restaurant',
          'cafe',
          'food',
          'dining',
          'pizza',
          'burger',
          'mcdonald',
          'kfc',
          'dominos',
          'subway',
        ],
      },
      {
        category: 'Groceries',
        keywords: [
          'bigbasket',
          'grofers',
          'blinkit',
          'zepto',
          'dunzo',
          'dmart',
          'reliance fresh',
          'more',
          'supermarket',
          'grocery',
        ],
      },
      {
        category: 'Transport',
        keywords: [
          'uber',
          'ola',
          'rapido',
          'metro',
          'bus',
          'taxi',
          'petrol',
          'diesel',
          'fuel',
          'parking',
        ],
      },
      {
        category: 'Shopping',
        keywords: [
          'amazon',
          'flipkart',
          'myntra',
          'ajio',
          'nykaa',
          'mall',
          'shop',
          'meesho',
          'snapdeal',
        ],
      },
      {
        category: 'Utilities',
        keywords: [
          'electricity',
          'water',
          'gas cylinder',
          'broadband',
          'internet',
          'mobile recharge',
          'recharge',
          'airtel',
          'jio',
          'vodafone',
          'bsnl',
        ],
      },
      {
        category: 'Entertainment',
        keywords: [
          'netflix',
          'prime',
          'hotstar',
          'spotify',
          'movie',
          'cinema',
          'theatre',
          'pvr',
          'inox',
        ],
      },
      {
        category: 'Healthcare',
        keywords: [
          'hospital',
          'clinic',
          'doctor',
          'pharmacy',
          'medicine',
          'apollo',
          '1mg',
          'pharmeasy',
          'netmeds',
          'medplus',
          'hospital',
        ],
      },
      {
        category: 'Education',
        keywords: ['school', 'college', 'university', 'course', 'tuition', 'exam', 'fees'],
      },
    ];

    // Find matching category
    for (const { category, keywords } of categories) {
      if (keywords.some((keyword) => lowerMerchant.includes(keyword))) {
        return category;
      }
    }

    return null; // Return null for unknown merchants
  }
}

// Export singleton instance for backward compatibility
export const emailParserService = new EmailParserService();
