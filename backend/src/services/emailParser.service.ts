import { detectTransactionTags } from '../utils/transactionTags';
import { getLearnedMapping } from './merchantLearning.service';

interface ParsedTransaction {
  amount: number;
  merchant: string;
  date: Date;
  bankName: string;
  cardLast4?: string;
  transactionId?: string;
  rawText: string;
  confidence: number;
  tags?: string[]; // Auto-detected tags
  learnedCategoryId?: string; // Auto-filled from learning
  learnedAccountId?: string; // Auto-filled from learning
}

// Top 10 Indian Bank SMS Patterns
const BANK_PATTERNS = [
  {
    name: 'HDFC Bank',
    senders: ['HDFCBK', 'HDFC'],
    patterns: [
      {
        regex:
          /(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s*(?:debited|spent|paid).*?(?:at|on)\s*([A-Z][A-Za-z0-9\s&-]+?)(?:\s+on|\s+at|\s*\.|\s+Avl)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
      {
        regex:
          /(?:debited|spent).*?(?:Rs\.?|INR)\s*([\d,]+\.?\d*).*?(?:at|on)\s*([A-Z][A-Za-z0-9\s&-]+)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
    ],
    cardPattern: /XX(\d{4})/,
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
        regex:
          /(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s*(?:debited|withdrawn).*?(?:at|from)\s*([A-Z][A-Za-z0-9\s&-]+)/i,
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
          /(?:Rs|INR)\s*([\d,]+\.?\d*)\s*(?:spent|debited).*?(?:at|on)\s*([A-Z][A-Za-z0-9\s&-]+)/i,
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
  public async parseTransaction(text: string, sender?: string, userId?: string): Promise<ParsedTransaction | null> {
    // Try to identify bank from sender or text
    const bank = this.identifyBank(text, sender);

    if (!bank) {
      console.log('Could not identify bank from text:', text.substring(0, 100));
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

          // Extract card last 4 digits
          const cardMatch = text.match(bank.cardPattern);
          const cardLast4 = cardMatch ? cardMatch[1] : undefined;

          // Extract date
          const dateMatch = text.match(bank.datePattern);
          const date = dateMatch ? this.parseDate(dateMatch[1]) : new Date();

          // Extract transaction ID if present
          const transactionId = this.extractTransactionId(text);

          // Auto-detect and assign tags (email transactions are typically debits)
          const tagDetection = detectTransactionTags('debit', text, merchant);

          // Check if we have learned category/account for this merchant
          let learnedCategoryId: string | undefined;
          let learnedAccountId: string | undefined;
          
          if (userId && merchant) {
            const learned = await getLearnedMapping(userId, merchant);
            if (learned) {
              learnedCategoryId = learned.categoryId;
              learnedAccountId = learned.accountId;
            }
          }

          return {
            amount,
            merchant,
            date,
            bankName: bank.name,
            cardLast4,
            transactionId,
            rawText: text,
            confidence: this.calculateConfidence(amount, merchant, bank.name),
            tags: tagDetection.tags,
            learnedCategoryId,
            learnedAccountId,
          };
        } catch (error) {
          console.error('Error parsing transaction:', error);
          continue;
        }
      }
    }

    console.log('No pattern matched for bank:', bank.name);
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
   * Clean merchant name
   */
  private cleanMerchantName(merchant: string): string {
    // Remove common suffixes
    merchant = merchant
      .replace(/\s+(PVT\.?|LTD\.?|LIMITED|INC\.?|CORP\.?)$/i, '')
      .replace(/\s+ON\s+\d{2}.*$/i, '')
      .replace(/\s+AT\s+\d{2}.*$/i, '')
      .trim();

    // Capitalize properly
    merchant = merchant
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return merchant;
  }

  /**
   * Parse date from various formats
   */
  private parseDate(dateStr: string): Date {
    // Handle DD-MMM-YY or DD-MMM-YYYY
    const monthMap: { [key: string]: number } = {
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
    };

    const match = dateStr.match(/(\d{2})-([A-Za-z]{3})-(\d{2,4})/i);
    if (match) {
      const day = parseInt(match[1]);
      const month = monthMap[match[2].toLowerCase()];
      let year = parseInt(match[3]);

      // Handle 2-digit year
      if (year < 100) {
        year += 2000;
      }

      return new Date(year, month, day);
    }

    // Handle DD/MM/YYYY or DD-MM-YYYY
    const match2 = dateStr.match(/(\d{2})[/-](\d{2})[/-](\d{2,4})/);
    if (match2) {
      const day = parseInt(match2[1]);
      const month = parseInt(match2[2]) - 1;
      let year = parseInt(match2[3]);

      if (year < 100) {
        year += 2000;
      }

      return new Date(year, month, day);
    }

    // Default to today
    return new Date();
  }

  /**
   * Extract transaction ID if present
   */
  private extractTransactionId(text: string): string | undefined {
    const match = text.match(/(?:TXN|REF|ID|REFERENCE)[\s:]*([A-Z0-9]{8,})/i);
    return match ? match[1] : undefined;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(amount: number, merchant: string, bankName: string): number {
    let confidence = 0.5; // Base confidence

    // Has valid amount
    if (amount > 0) confidence += 0.2;

    // Has merchant name
    if (merchant && merchant.length > 2) confidence += 0.2;

    // Identified bank
    if (bankName) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Suggest category based on merchant name using generic keyword patterns
   * This is a fallback when MerchantLearning has no data
   */
  public suggestCategory(merchant: string): string | null {
    const merchantLower = merchant.toLowerCase();

    // Generic category suggestions based on common keywords
    const categoryKeywords: { [key: string]: string[] } = {
      'Food & Dining': [
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
      ],
      Groceries: ['bigbasket', 'grofer', 'dmart', 'reliance', 'more', 'supermarket', 'grocery'],
      Transport: ['uber', 'ola', 'rapido', 'fuel', 'petrol', 'diesel', 'gas', 'parking'],
      Shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'mall', 'shop'],
      Utilities: ['electricity', 'water', 'gas', 'broadband', 'internet', 'mobile', 'recharge'],
      Entertainment: ['netflix', 'prime', 'hotstar', 'spotify', 'movie', 'cinema', 'pvr', 'inox'],
      Healthcare: ['pharmacy', 'hospital', 'clinic', 'doctor', 'medical', 'apollo', 'netmeds'],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      for (const keyword of keywords) {
        if (merchantLower.includes(keyword)) {
          return category;
        }
      }
    }

    return null;
  }

  /**
   * Test if text looks like a transaction SMS
   */
  public isTransactionSMS(text: string): boolean {
    // Check for common transaction keywords
    const keywords = [
      'debited',
      'spent',
      'withdrawn',
      'paid',
      'payment',
      'rs',
      'inr',
      'rupees',
      'card',
      'account',
    ];

    const lowerText = text.toLowerCase();
    return keywords.some((keyword) => lowerText.includes(keyword));
  }
}

export const emailParserService = new EmailParserService();
