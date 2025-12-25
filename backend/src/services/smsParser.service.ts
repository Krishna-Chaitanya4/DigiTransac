/**
 * SMS Parser Service
 * Parses bank SMS messages and extracts transaction details
 * Supports major Indian banks with confidence scoring
 */

import { detectTransactionTags } from '../utils/transactionTags';
import { getLearnedMapping } from './merchantLearning.service';
import { normalizeMerchantName, matchAccount } from '../utils/accountMatcher';
import { cosmosDBService } from '../config/cosmosdb';

export interface ParsedTransaction {
  amount: number;
  type: 'debit' | 'credit';
  merchant?: string;
  date?: Date;
  accountNumber?: string;
  referenceNumber?: string;
  confidence: 'high' | 'medium' | 'low';
  originalText: string;
  bankName?: string;
  tags?: string[]; // Auto-detected tags
  learnedCategoryId?: string; // Auto-filled from learning
  learnedAccountId?: string; // Auto-filled from learning
  matchedAccountId?: string; // Auto-matched from SMS account info
}

interface BankPattern {
  name: string;
  patterns: {
    regex: RegExp;
    extract: (match: RegExpMatchArray) => Partial<ParsedTransaction>;
  }[];
}

export class SMSParserService {
  private bankPatterns: BankPattern[] = [
    // HDFC Bank
    {
      name: 'HDFC',
      patterns: [
        {
          // Standard: Rs.500.00 debited from A/c **1234/XX1234/....1234 on 23-Dec-25 to/at Swiggy
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:debited|withdrawn).*?(?:A\/c|account).*?([xX*.]{2,}\d{4}|\d{4}).*?on\s+(\d{1,2}[-/]\w{3}[-/]\d{2,4}).*?(?:at|to|for)\s+([A-Z][A-Za-z0-9\s*]+?)(?:\s*\.|Avl|Ref|$)/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'debit',
            accountNumber: match[2],
            date: this.parseDate(match[3]),
            merchant: match[4].trim(),
            confidence: 'high',
            bankName: 'HDFC',
          }),
        },
        {
          // Alternative format: INR 500 debited for MERCHANT on 23-Dec-25 from **1234
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:debited|withdrawn).*?(?:for|at)\s+([A-Z][A-Za-z0-9\s*]+?)\s+on\s+(\d{1,2}[-/]\w{3}[-/]\d{2,4}).*?(?:A\/c|from).*?([xX*.]{2,}\d{4}|\d{4})/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'debit',
            merchant: match[2].trim(),
            date: this.parseDate(match[3]),
            accountNumber: match[4],
            confidence: 'high',
            bankName: 'HDFC',
          }),
        },
        {
          // Credit: Rs.1000.00 credited to A/c **1234/XX1234/....1234 on 23-Dec-25
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+credited.*?(?:A\/c|account|to).*?([xX*.]{2,}\d{4}|\d{4}).*?on\s+(\d{1,2}[-/]\w{3}[-/]\d{2,4})/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'credit',
            accountNumber: match[2],
            date: this.parseDate(match[3]),
            confidence: 'high',
            bankName: 'HDFC',
          }),
        },
        {
          // Credit from: Rs 5000 credited from SALARY on 25-Dec-24 to **1234
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+credited.*?from\s+([A-Z][A-Za-z0-9\s]+?)\s+on\s+(\d{1,2}[-/]\w{3}[-/]\d{2,4}).*?(?:to|A\/c).*?([xX*.]{2,}\d{4}|\d{4})/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'credit',
            merchant: match[2].trim(),
            date: this.parseDate(match[3]),
            accountNumber: match[4],
            confidence: 'high',
            bankName: 'HDFC',
          }),
        },
      ],
    },

    // ICICI Bank
    {
      name: 'ICICI',
      patterns: [
        {
          // Standard: Your A/c **5678/XX5678/....5678 is debited with Rs 250 on 23-12-25. Info: UPI-Zomato
          regex:
            /(?:A\/c|account).*?([xX*.]{2,}\d{4}|\d{4}).*?(?:debited|withdrawn).*?(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+on\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}).*?(?:Info|for|at):?\s*(.+?)(?:\s*\.|Ref|Avl|$)/i,
          extract: (match) => ({
            amount: parseFloat(match[2].replace(/,/g, '')),
            type: 'debit',
            accountNumber: match[1],
            date: this.parseDate(match[3]),
            merchant: match[4].trim(),
            confidence: 'high',
            bankName: 'ICICI',
          }),
        },
        {
          // Alternative: Rs 250 debited from **5678 on 23-12-25 for MERCHANT
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:debited|withdrawn).*?(?:from|A\/c).*?([xX*.]{2,}\d{4}|\d{4}).*?on\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}).*?(?:for|at)\s*(.+?)(?:\s*\.|Ref|Avl|$)/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'debit',
            accountNumber: match[2],
            date: this.parseDate(match[3]),
            merchant: match[4].trim(),
            confidence: 'high',
            bankName: 'ICICI',
          }),
        },
        {
          // Credit: Your A/c **5678 is credited with Rs 1000 on 23-12-25
          regex:
            /(?:A\/c|account).*?([xX*.]{2,}\d{4}|\d{4}).*?credited.*?(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+on\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
          extract: (match) => ({
            amount: parseFloat(match[2].replace(/,/g, '')),
            type: 'credit',
            accountNumber: match[1],
            date: this.parseDate(match[3]),
            confidence: 'high',
            bankName: 'ICICI',
          }),
        },
        {
          // Credit from: Rs 5000 credited from SALARY to **5678 on 23-12-25
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+credited.*?from\s+([A-Z][A-Za-z0-9\s]+?)(?:to|A\/c).*?([xX*.]{2,}\d{4}|\d{4}).*?on\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'credit',
            merchant: match[2].trim(),
            accountNumber: match[3],
            date: this.parseDate(match[4]),
            confidence: 'high',
            bankName: 'ICICI',
          }),
        },
      ],
    },

    // SBI (State Bank of India)
    {
      name: 'SBI',
      patterns: [
        {
          // Card: Rs 1000.00 spent on SBI Card **9012/XX9012/....9012 at AMAZON on 23/12/25
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:spent|debited).*?(?:card|A\/c).*?([xX*.]{2,}\d{4}|\d{4}).*?at\s+([A-Z][A-Za-z0-9\s*]+?)\s+on\s+(\d{1,2}[/]\d{1,2}[/]\d{2,4})/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'debit',
            accountNumber: match[2],
            merchant: match[3].trim(),
            date: this.parseDate(match[4]),
            confidence: 'high',
            bankName: 'SBI',
          }),
        },
        {
          // Standard debit: Rs.500 debited from A/c ....1234/**1234/XX1234 on 23-12-25 via UPI/IMPS/NEFT
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:debited|withdrawn).*?(?:A\/c|account|from).*?([xX*.]{2,}\d{4}|\d{4}).*?on\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}).*?(?:via|for|to|Info)\s*(.+?)(?:\s*\.|Ref|Avl|$)/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'debit',
            accountNumber: match[2],
            date: this.parseDate(match[3]),
            merchant: match[4].trim(),
            confidence: 'high',
            bankName: 'SBI',
          }),
        },
        {
          // Debit without merchant: Rs 500 debited from ....1234 on 23/12/25
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:debited|withdrawn).*?(?:from|A\/c).*?([xX*.]{2,}\d{4}|\d{4}).*?on\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'debit',
            accountNumber: match[2],
            date: this.parseDate(match[3]),
            confidence: 'medium',
            bankName: 'SBI',
          }),
        },
        {
          // Credit: Rs 2000 credited to A/c ....1234/**1234/XX1234 on 23/12/25
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+credited.*?(?:A\/c|account|to).*?([xX*.]{2,}\d{4}|\d{4}).*?on\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'credit',
            accountNumber: match[2],
            date: this.parseDate(match[3]),
            confidence: 'high',
            bankName: 'SBI',
          }),
        },
      ],
    },

    // Axis Bank
    {
      name: 'Axis',
      patterns: [
        {
          // Debit: INR 750.00 debited from **3456/XX3456/....3456 on 23Dec for PAYTM
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:debited|withdrawn).*?(?:from|A\/c).*?([xX*.]{2,}\d{4}|\d{4}).*?on\s+(\d{1,2}\s*\w{3}\s*\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}).*?(?:for|at)\s+([A-Z][A-Za-z0-9\s*]+?)(?:\s*\.|Avl|Ref|$)/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'debit',
            accountNumber: match[2],
            date: this.parseDate(match[3]),
            merchant: match[4].trim(),
            confidence: 'high',
            bankName: 'Axis',
          }),
        },
        {
          // Debit without merchant: Rs 500 debited from **3456 on 23-Dec-25
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:debited|withdrawn).*?(?:from|A\/c).*?([xX*.]{2,}\d{4}|\d{4}).*?on\s+(\d{1,2}[-/]\w{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'debit',
            accountNumber: match[2],
            date: this.parseDate(match[3]),
            confidence: 'medium',
            bankName: 'Axis',
          }),
        },
        {
          // Credit: INR 5000 credited to **3456/XX3456/....3456 on 23-Dec-25
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+credited.*?(?:to|A\/c).*?([xX*.]{2,}\d{4}|\d{4}).*?on\s+(\d{1,2}[-/]\w{3}[-/]\d{2,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'credit',
            accountNumber: match[2],
            date: this.parseDate(match[3]),
            confidence: 'high',
            bankName: 'Axis',
          }),
        },
      ],
    },

    // Kotak Mahindra Bank
    {
      name: 'Kotak',
      patterns: [
        {
          // Debit: Rs.300.00 debited from A/c **7890/XX7890/....7890 on 23-12-25 at/for Uber
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:debited|withdrawn).*?(?:A\/c|account|from).*?([xX*.]{2,}\d{4}|\d{4}).*?on\s+(\d{1,2}[/\d{1,2}[/\d{2,4}).*?(?:at|to|for)\s+([A-Z][A-Za-z0-9\s*]+?)(?:\s*\.|Avl|Ref|$)/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'debit',
            accountNumber: match[2],
            date: this.parseDate(match[3]),
            merchant: match[4].trim(),
            confidence: 'high',
            bankName: 'Kotak',
          }),
        },
        {
          // Credit: Rs 1000 credited to **7890/XX7890/....7890 on 23-12-25
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+credited.*?(?:to|A\/c).*?([xX*.]{2,}\d{4}|\d{4}).*?on\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'credit',
            accountNumber: match[2],
            date: this.parseDate(match[3]),
            confidence: 'high',
            bankName: 'Kotak',
          }),
        },
      ],
    },

    // Punjab National Bank (PNB)
    {
      name: 'PNB',
      patterns: [
        {
          // Debit: Rs 400 debited from A/c **2345/XX2345/....2345 on 23/12/25 for UPI/Phonepe
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:debited|withdrawn).*?(?:A\/c|account|from).*?([xX*.]{2,}\d{4}|\d{4}).*?on\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}).*?(?:for|Info|via)\s*(.+?)(?:\s*\.|Ref|Avl|$)/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'debit',
            accountNumber: match[2],
            date: this.parseDate(match[3]),
            merchant: match[4].trim(),
            confidence: 'high',
            bankName: 'PNB',
          }),
        },
        {
          // Credit: Rs 2000 credited to **2345/XX2345/....2345 on 23/12/25
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+credited.*?(?:to|A\/c).*?([xX*.]{2,}\d{4}|\d{4}).*?on\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'credit',
            accountNumber: match[2],
            date: this.parseDate(match[3]),
            confidence: 'high',
            bankName: 'PNB',
          }),
        },
      ],
    },

    // Generic UPI pattern (fallback for any bank)
    {
      name: 'Generic',
      patterns: [
        {
          // Generic debit with merchant: Rs/INR amount debited from **1234/XX1234/....1234/1234 for/at MERCHANT
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:debited|withdrawn|spent).*?(?:from|on|A\/c|account|card).*?([xX*.]{2,}\d{4}|\d{4}).*?(?:for|at|to|via)\s+([A-Z][A-Za-z0-9\s*]+?)(?:\s*\.|Ref|Avl|$)/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'debit',
            accountNumber: match[2],
            merchant: match[3].trim(),
            confidence: 'medium',
          }),
        },
        {
          // Generic debit without merchant: Rs/INR amount debited from account
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:debited|withdrawn|spent).*?(?:from|on|A\/c|account|card).*?([xX*.]{2,}\d{4}|\d{4})/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'debit',
            accountNumber: match[2],
            confidence: 'low',
          }),
        },
        {
          // Generic credit with source: Rs/INR amount credited from SOURCE to **1234
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+credited.*?from\s+([A-Z][A-Za-z0-9\s]+?)(?:to|in|A\/c).*?([xX*.]{2,}\d{4}|\d{4})/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'credit',
            merchant: match[2].trim(),
            accountNumber: match[3],
            confidence: 'medium',
          }),
        },
        {
          // Generic credit without source: Rs/INR amount credited to account
          regex:
            /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+credited.*?(?:to|in|A\/c|account).*?([xX*.]{2,}\d{4}|\d{4})/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'credit',
            accountNumber: match[2],
            confidence: 'low',
          }),
        },
      ],
    },
  ];

  /**
   * Parse single SMS message
   */
  async parseSMS(smsText: string, userId?: string): Promise<ParsedTransaction | null> {
    if (!smsText || smsText.trim().length === 0) {
      return null;
    }

    const cleanText = smsText.trim();

    // Try each bank pattern
    for (const bankPattern of this.bankPatterns) {
      for (const pattern of bankPattern.patterns) {
        const match = cleanText.match(pattern.regex);
        if (match) {
          const parsed = pattern.extract(match);

          // Normalize merchant name for consistency
          const normalizedMerchant = parsed.merchant
            ? normalizeMerchantName(parsed.merchant)
            : undefined;

          // Auto-detect and assign tags based on transaction type and content
          const tagDetection = detectTransactionTags(
            parsed.type || 'debit',
            cleanText,
            normalizedMerchant
          );

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

          // Match SMS account info to user's accounts
          let matchedAccountId: string | undefined;

          if (userId && (parsed.bankName || parsed.accountNumber)) {
            try {
              const accountsContainer = await cosmosDBService.getAccountsContainer();
              matchedAccountId =
                (await matchAccount(
                  userId,
                  accountsContainer as any,
                  parsed.bankName,
                  parsed.accountNumber
                )) || undefined;
            } catch (error) {
              // Account matching failed, continue without it
            }
          }

          return {
            ...parsed,
            merchant: normalizedMerchant,
            originalText: cleanText,
            // Default to today if no date found
            date: parsed.date || new Date(),
            tags: tagDetection.tags,
            learnedCategoryId,
            learnedAccountId,
            matchedAccountId,
          } as ParsedTransaction;
        }
      }
    }

    return null;
  }

  /**
   * Parse multiple SMS messages (batch)
   */
  async parseMultipleSMS(smsTexts: string[], userId?: string): Promise<ParsedTransaction[]> {
    const results = await Promise.all(smsTexts.map((text) => this.parseSMS(text, userId)));
    return results.filter((parsed): parsed is ParsedTransaction => parsed !== null);
  }

  /**
   * Parse date from various formats
   */
  private parseDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;

    // Try different date formats
    const formats = [
      // 23-Dec-25 or 23-Dec-2025
      /(\d{1,2})[/](\w{3})[/](\d{2,4})/,
      // 23/12/25 or 23/12/2025 or 23-12-25
      /(\d{1,2})[/](\d{1,2})[/](\d{2,4})/,
      // 23Dec25 or 23Dec2025
      /(\d{1,2})(\w{3})(\d{2,4})/,
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        const [, day, monthOrDay, year] = match;

        // Check if month is text (Jan, Feb, etc.)
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

        let month: number;
        let actualDay: number;

        if (monthMap[monthOrDay.toLowerCase()] !== undefined) {
          month = monthMap[monthOrDay.toLowerCase()];
          actualDay = parseInt(day);
        } else {
          month = parseInt(monthOrDay) - 1;
          actualDay = parseInt(day);
        }

        // Handle 2-digit years
        let fullYear = parseInt(year);
        if (fullYear < 100) {
          fullYear = 2000 + fullYear;
        }

        const date = new Date(fullYear, month, actualDay);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract merchant name from description
   * Cleans up common prefixes and suffixes
   */
  extractMerchant(description: string): string {
    if (!description) return 'Unknown';

    let merchant = description.trim();

    // Remove common prefixes
    merchant = merchant.replace(/^(UPI-|UPI\/|IMPS-|NEFT-|RTGS-)/i, '');

    // Remove reference numbers
    merchant = merchant.replace(/Ref.*$/i, '');
    merchant = merchant.replace(/\d{12,}/g, '');

    // Clean up
    merchant = merchant.trim();
    merchant = merchant.replace(/\s+/g, ' ');

    return merchant || 'Unknown';
  }

  /**
   * Detect duplicate transactions
   */
  isDuplicate(
    parsed: ParsedTransaction,
    existingTransactions: Array<{
      amount: number;
      date: Date;
      description?: string;
    }>
  ): boolean {
    return existingTransactions.some((existing) => {
      const sameAmount = Math.abs(existing.amount - parsed.amount) < 0.01;
      const sameDay = existing.date.toDateString() === parsed.date?.toDateString();
      const similarDescription =
        existing.description &&
        parsed.merchant &&
        existing.description.toLowerCase().includes(parsed.merchant.toLowerCase());

      return sameAmount && sameDay && similarDescription;
    });
  }

  /**
   * Get supported banks list
   */
  getSupportedBanks(): string[] {
    return this.bankPatterns.filter((bp) => bp.name !== 'Generic').map((bp) => bp.name);
  }
}

export const smsParserService = new SMSParserService();
