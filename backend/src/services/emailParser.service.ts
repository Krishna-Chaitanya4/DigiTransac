import { detectTransactionTags } from '../utils/transactionTags';
import { getLearnedMapping } from './merchantLearning.service';
import { normalizeMerchantName, matchAccount } from '../utils/accountMatcher';
import { mongoDBService } from '../config/mongodb';
import { logger } from '../utils/logger';

/**
 * Parsed transaction data from email
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
 * Bank pattern configuration
 */
interface BankPattern {
  name: string;
  senders: string[];
  patterns: {
    regex: RegExp;
    amountGroup: number;
    merchantGroup: number;
  }[];
  cardPattern: RegExp;
  datePattern: RegExp;
}

/**
 * Month name to number mapping
 */
const MONTH_MAP: Readonly<Record<string, number>> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
} as const;

/**
 * Bank transaction patterns for major Indian banks
 * Patterns ordered by specificity to avoid false matches
 */
const BANK_PATTERNS: Readonly<BankPattern[]> = [
  {
    name: 'HDFC Bank',
    senders: ['HDFCBK', 'HDFC'],
    patterns: [
      {
        // Rs.500.00 debited from Card XX1234 on 01-Jan-25 at SWIGGY BANGALORE
        regex:
          /(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)\s+(?:debited|spent|paid).*?(?:at|on)\s+([A-Z][A-Za-z0-9][A-Za-z0-9\s&*-]*?)(?=\s+on\s+\d{2}|\s+Avl|\.|\s*$)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
      {
        // Alternative: debited Rs.500 at MERCHANT
        regex:
          /(?:debited|spent)\s+(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?).*?(?:at|on)\s+([A-Z][A-Za-z0-9][A-Za-z0-9\s&*-]+?)(?=\s+on\s+\d{2}|\.)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
    ],
    cardPattern: /(?:Card\s+)?XX(\d{4})/i,
    datePattern: /(\d{2}-[A-Z][a-z]{2}-\d{2,4})/i,
  },
  {
    name: 'ICICI Bank',
    senders: ['ICICIB', 'ICICI'],
    patterns: [
      {
        regex:
          /(?:Rs|INR)\s*([\d,]+\.?\d*)\s*(?:spent|debited).*?(?:at|on)\s*([A-Z][A-Za-z0-9\s&-]+?)(?:\s+on|\.|Card)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
    ],
    cardPattern: /XX(\d{4})/,
    datePattern: /(\d{2}\/\d{2}\/\d{4})/,
  },
  {
    name: 'SBI',
    senders: ['SBIIN', 'SBI'],
    patterns: [
      {
        // Prioritize "at MERCHANT" pattern first
        regex:
          /(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s*(?:debited|withdrawn).*?\s+at\s+([A-Z][A-Za-z0-9\s&-]+?)(?=\s+on|\.|$)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
      {
        // Fallback: "from MERCHANT" pattern (for emails without "at")
        regex:
          /(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s*(?:withdrawn|debited)\s+from\s+([A-Z][A-Za-z0-9\s&-]+?)(?=\.|Card|$)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
    ],
    cardPattern: /XX(\d{4})/,
    datePattern: /(\d{2}-\d{2}-\d{4})/,
  },
  {
    name: 'Axis Bank',
    senders: ['AXISBK', 'AXIS'],
    patterns: [
      {
        regex:
          /(?:Rs|INR)\s*([\d,]+\.?\d*)\s*(?:spent|debited).*?\s+at\s+([A-Z][A-Za-z0-9\s&-]+?)(?=\s+on|\.|$)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
    ],
    cardPattern: /XX(\d{4})/,
    datePattern: /(\d{2}\/\d{2}\/\d{2})/,
  },
  {
    name: 'Kotak Bank',
    senders: ['KOTAKB', 'KOTAK'],
    patterns: [
      {
        regex:
          /(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s*(?:debited|spent).*?(?:at|on)\s*([A-Z][A-Za-z0-9\s&-]+)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
    ],
    cardPattern: /XX(\d{4})/,
    datePattern: /(\d{2}-\d{2}-\d{4})/,
  },
  {
    name: 'PNB',
    senders: ['PNBSMS', 'PNB'],
    patterns: [
      {
        regex:
          /(?:Rs|INR)\s*([\d,]+\.?\d*)\s*(?:debited|spent).*?(?:at|on)\s*([A-Z][A-Za-z0-9\s&-]+)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
    ],
    cardPattern: /XX(\d{4})/,
    datePattern: /(\d{2}\/\d{2}\/\d{4})/,
  },
  {
    name: 'Bank of Baroda',
    senders: ['BOBIN', 'BOB'],
    patterns: [
      {
        regex:
          /(?:Rs|INR)\s*([\d,]+\.?\d*)\s*(?:debited|spent).*?(?:at|on)\s*([A-Z][A-Za-z0-9\s&-]+)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
    ],
    cardPattern: /XX(\d{4})/,
    datePattern: /(\d{2}-\d{2}-\d{4})/,
  },
  {
    name: 'Canara Bank',
    senders: ['CANBNK', 'CANARA'],
    patterns: [
      {
        regex:
          /(?:Rs|INR)\s*([\d,]+\.?\d*)\s*(?:debited|spent).*?(?:at|on)\s*([A-Z][A-Za-z0-9\s&-]+)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
    ],
    cardPattern: /XX(\d{4})/,
    datePattern: /(\d{2}\/\d{2}\/\d{4})/,
  },
  {
    name: 'Union Bank',
    senders: ['UBOI', 'UNION'],
    patterns: [
      {
        regex:
          /(?:Rs|INR)\s*([\d,]+\.?\d*)\s*(?:debited|spent).*?(?:at|on)\s*([A-Z][A-Za-z0-9\s&-]+)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
    ],
    cardPattern: /XX(\d{4})/,
    datePattern: /(\d{2}-\d{2}-\d{4})/,
  },
  {
    name: 'IDBI Bank',
    senders: ['IDBIBN', 'IDBI'],
    patterns: [
      {
        regex:
          /(?:Rs|INR)\s*([\d,]+\.?\d*)\s*(?:debited|spent).*?(?:at|on)\s*([A-Z][A-Za-z0-9\s&-]+)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
    ],
    cardPattern: /XX(\d{4})/,
    datePattern: /(\d{2}\/\d{2}\/\d{4})/,
  },
];

export class EmailParserService {
  /**
   * Parse transaction SMS/email text
   */
  public async parseTransaction(
    text: string,
    sender?: string,
    userId?: string
  ): Promise<ParsedTransaction | null> {
    // Try to identify bank from sender or text
    const bank = this.identifyBank(text, sender);

    if (!bank) {
      logger.debug({ text: text.substring(0, 100) }, 'Could not identify bank from text');
      return null;
    }

    // Try each pattern for this bank
    for (const pattern of bank.patterns) {
      const match = text.match(pattern.regex);

      if (match) {
        try {
          // Extract amount
          const amountStr = match[pattern.amountGroup].replace(/,/g, '');
          const amount = parseFloat(amountStr);

          if (isNaN(amount) || amount <= 0) {
            continue;
          }

          // Extract merchant
          let merchant = match[pattern.merchantGroup].trim();
          merchant = this.cleanMerchantName(merchant);

          // Normalize merchant name for consistency
          const normalizedMerchant = normalizeMerchantName(merchant);

          // Extract card last 4 digits
          const cardMatch = text.match(bank.cardPattern);
          const cardLast4 = cardMatch ? cardMatch[1] : undefined;

          // Extract date
          const dateMatch = text.match(bank.datePattern);
          const date = dateMatch ? this.parseDate(dateMatch[1]) : new Date();

          // Extract transaction ID if present
          const transactionId = this.extractTransactionId(text);

          // Auto-detect and assign tags (email transactions are typically debits)
          const tagDetection = detectTransactionTags('debit', text, normalizedMerchant);

          // Check if we have learned category/account for this merchant
          let learnedCategoryId: string | undefined;
          let learnedAccountId: string | undefined;

          if (userId && normalizedMerchant) {
            const learned = await getLearnedMapping(userId, normalizedMerchant);
            if (learned) {
              learnedCategoryId = learned.categoryId;
              learnedAccountId = learned.accountId;
            }
          }

          // Match email account info to user's accounts
          let matchedAccountId: string | undefined;

          if (userId && (bank.name || cardLast4)) {
            try {
              const accountsContainer = await mongoDBService.getAccountsContainer();
              matchedAccountId =
                (await matchAccount(userId, accountsContainer as any, bank.name, cardLast4)) ||
                undefined;
            } catch {
              // Account matching failed, continue without it
            }
          }

          return {
            amount,
            merchant: normalizedMerchant,
            date,
            bankName: bank.name,
            cardLast4,
            transactionId,
            rawText: text,
            confidence: this.calculateConfidence(amount, normalizedMerchant, bank.name),
            tags: tagDetection.tags,
            learnedCategoryId,
            learnedAccountId,
            matchedAccountId,
          };
        } catch (error) {
          logger.error(
            { error, bankName: bank.name, textSample: text.substring(0, 100) },
            'Error parsing transaction with pattern'
          );
          continue;
        }
      }
    }

    logger.debug({ bankName: bank.name }, 'No pattern matched for bank');
    return null;
  }

  /**
   * Identify bank from sender or text content
   */
  private identifyBank(text: string, sender?: string): (typeof BANK_PATTERNS)[0] | null {
    const searchText = (sender || '') + ' ' + text;

    for (const bank of BANK_PATTERNS) {
      for (const senderPattern of bank.senders) {
        if (searchText.toUpperCase().includes(senderPattern)) {
          return bank;
        }
      }
    }

    return null;
  }

  /**
   * Clean and normalize merchant name
   * Removes noise, standardizes format
   */
  private cleanMerchantName(merchant: string): string {
    if (!merchant?.trim()) {
      return 'Unknown';
    }

    let cleaned = merchant.trim();

    // Remove trailing noise patterns (dates, times, balances)
    cleaned = cleaned
      .replace(/\s+(?:on|at)\s+\d{2}[-/].*$/i, '') // Remove "on 01-Jan-25"
      .replace(/\s+Avl.*$/i, '') // Remove "Avl Bal: ..."
      .replace(/\s+Card\s+XX\d{4}.*$/i, '') // Remove "Card XX1234"
      .replace(/\s+Ref.*$/i, '') // Remove "Ref: ..."
      .trim();

    // Remove common company suffixes
    cleaned = cleaned.replace(
      /\s+(PVT\.?\s*LTD\.?|LTD\.?|LIMITED|INC\.?|CORP\.?|LLC|PVT)$/i,
      ''
    );

    // Remove location suffixes (cities)
    cleaned = cleaned.replace(
      /\s+(BANGALORE|MUMBAI|DELHI|CHENNAI|KOLKATA|HYDERABAD|PUNE|INDIA)$/i,
      ''
    );

    // Remove special characters but keep spaces and hyphens
    cleaned = cleaned.replace(/[^a-zA-Z0-9\s-]/g, ' ');

    // Collapse multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Capitalize properly (Title Case)
    if (cleaned.length > 0) {
      cleaned = cleaned
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    return cleaned || 'Unknown';
  }

  /**
   * Parse date from various formats with validation
   * Supports: DD-MMM-YY, DD-MMM-YYYY, DD/MM/YYYY, DD-MM-YYYY
   */
  private parseDate(dateStr: string | undefined): Date {
    if (!dateStr?.trim()) {
      return new Date();
    }

    const trimmed = dateStr.trim();

    // Format 1: DD-MMM-YY or DD-MMM-YYYY (e.g., 01-Jan-25)
    const monthMatch = trimmed.match(/(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/i);
    if (monthMatch) {
      const day = parseInt(monthMatch[1], 10);
      const monthKey = monthMatch[2].toLowerCase();
      let year = parseInt(monthMatch[3], 10);

      const month = MONTH_MAP[monthKey];
      if (month === undefined) {
        logger.warn({ dateStr, monthKey }, 'Invalid month name in date');
        return new Date();
      }

      // Handle 2-digit year (assume 2000s)
      if (year < 100) {
        year = 2000 + year;
      }

      // Validate ranges
      if (day < 1 || day > 31 || year < 2000 || year > 2100) {
        logger.warn({ dateStr, day, month, year }, 'Date out of valid range');
        return new Date();
      }

      const parsed = new Date(year, month, day);
      
      // Validate the date is actually valid (e.g., not Feb 30)
      if (isNaN(parsed.getTime()) || parsed.getDate() !== day) {
        logger.warn({ dateStr, day, month, year }, 'Invalid date constructed');
        return new Date();
      }

      return parsed;
    }

    // Format 2: DD/MM/YYYY or DD-MM-YYYY (e.g., 01/01/2025)
    const numericMatch = trimmed.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (numericMatch) {
      const day = parseInt(numericMatch[1], 10);
      const month = parseInt(numericMatch[2], 10) - 1; // 0-indexed
      let year = parseInt(numericMatch[3], 10);

      if (year < 100) {
        year = 2000 + year;
      }

      // Validate ranges
      if (day < 1 || day > 31 || month < 0 || month > 11 || year < 2000 || year > 2100) {
        logger.warn({ dateStr, day, month, year }, 'Date out of valid range');
        return new Date();
      }

      const parsed = new Date(year, month, day);
      
      if (isNaN(parsed.getTime()) || parsed.getDate() !== day) {
        logger.warn({ dateStr, day, month, year }, 'Invalid date constructed');
        return new Date();
      }

      return parsed;
    }

    logger.debug({ dateStr }, 'Could not parse date, defaulting to current date');
    return new Date();
  }

  /**
   * Extract transaction/reference ID from text
   * Looks for common transaction ID patterns
   */
  private extractTransactionId(text: string): string | undefined {
    // Try multiple patterns for transaction IDs
    const patterns = [
      /(?:TXN\s+ID|TXN|TRANSACTION|REF|REFERENCE)\s*[:#]?\s*([A-Z0-9]{8,})/i,
      /(?:UPI|IMPS|NEFT)\s*REF\s*[:#]?\s*([A-Z0-9]{8,})/i,
      /Reference\s*No\.?\s*[:#]?\s*([A-Z0-9]{8,})/i,
      /\bID\s+([A-Z0-9]{8,})\b/i, // Added for "ID DEF456789012"
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
   * Calculate confidence score for parsed transaction
   * Based on completeness and quality of extracted data
   */
  private calculateConfidence(amount: number, merchant: string, bankName: string): number {
    let confidence = 0.4; // Base confidence for successful pattern match

    // Valid amount (required)
    if (amount > 0 && amount < 1000000) {
      confidence += 0.2;
    } else if (amount > 0) {
      confidence += 0.1; // Large amount, might be suspicious
    }

    // Merchant name quality
    if (merchant && merchant !== 'Unknown') {
      if (merchant.length > 3) {
        confidence += 0.2;
      }
      // Bonus for reasonable merchant name length (not just noise)
      if (merchant.length > 5 && merchant.length < 50) {
        confidence += 0.1;
      }
    }

    // Bank identified
    if (bankName) {
      confidence += 0.1;
    }

    return Math.min(Math.max(confidence, 0), 1.0);
  }

  /**
   * Suggest category based on merchant name using keyword patterns
   * This is a fallback when MerchantLearning has no data
   * Uses industry-standard merchant categorization
   */
  public suggestCategory(merchant: string): string | null {
    if (!merchant?.trim()) {
      return null;
    }

    const merchantLower = merchant.toLowerCase();

    // Ordered by specificity - more specific patterns first
    const categoryKeywords: ReadonlyArray<{
      category: string;
      keywords: readonly string[];
    }> = [
      {
        category: 'Food & Dining',
        keywords: [
          'swiggy',
          'zomato',
          'restaurant',
          'cafe',
          'coffee',
          'pizza',
          'burger',
          'mcdonald',
          'kfc',
          'dominos',
          'subway',
          'starbucks',
          'dunkin',
          'food',
          'dine',
          'bistro',
          'eatery',
        ],
      },
      {
        category: 'Groceries',
        keywords: [
          'bigbasket',
          'grofer',
          'dmart',
          'reliance fresh',
          'more supermarket',
          'grocery',
          'supermarket',
          'blinkit',
          'zepto',
          'instamart',
        ],
      },
      {
        category: 'Transport',
        keywords: [
          'uber',
          'ola',
          'rapido',
          'fuel',
          'petrol',
          'diesel',
          'gas',
          'parking',
          'toll',
          'metro',
          'railway',
          'irctc',
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
          'amazon prime',
          'hotstar',
          'disney',
          'spotify',
          'apple music',
          'youtube',
          'movie',
          'cinema',
          'pvr',
          'inox',
          'sony liv',
          'zee5',
        ],
      },
      {
        category: 'Healthcare',
        keywords: [
          'pharmacy',
          'hospital',
          'clinic',
          'doctor',
          'medical',
          'apollo',
          'netmeds',
          'pharmeasy',
          'health',
        ],
      },
      {
        category: 'Education',
        keywords: [
          'school',
          'college',
          'university',
          'course',
          'udemy',
          'coursera',
          'book',
          'education',
          'tuition',
        ],
      },
    ];

    // Check each category's keywords
    for (const { category, keywords } of categoryKeywords) {
      for (const keyword of keywords) {
        if (merchantLower.includes(keyword)) {
          logger.debug(
            { merchant, category, keyword },
            'Category suggested from keyword match'
          );
          return category;
        }
      }
    }

    return null;
  }

  /**
   * Check if text looks like a transaction notification
   * Uses heuristics to filter out promotional/non-transaction emails
   */
  public isTransactionSMS(text: string): boolean {
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
      'received', // Added for "payment received"
      'used', // Added for "card was used"
    ];

    const hasTransactionKeyword = transactionKeywords.some((keyword) =>
      lowerText.includes(keyword)
    );

    if (!hasTransactionKeyword) {
      return false;
    }

    // Check for amount indicator (optional but increases confidence)
    const hasAmount = /(?:rs\.?|inr|rupees?)\s*[\d,]+/i.test(text);

    // Check for card/account related terms
    const hasFinancialContext =
      /card|account|wallet|upi|bank/i.test(text) || hasAmount;

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

    // Exclude promotional emails (common patterns)
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

export const emailParserService = new EmailParserService();
