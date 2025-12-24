/**
 * SMS Parser Service
 * Parses bank SMS messages and extracts transaction details
 * Supports major Indian banks with confidence scoring
 */

import { detectTransactionTags } from '../utils/transactionTags';

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
          // Rs.500.00 debited from A/c XX1234 on 23-Dec-25 at Swiggy
          regex: /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:debited|withdrawn).*?(?:A\/c|account).*?([xX]{2,}\d+).*?on\s+(\d{1,2}[-\/]\w{3}[-\/]\d{2,4}).*?(?:at|to)\s+([A-Z][A-Za-z0-9\s]+?)(?:\.|Avl|$)/i,
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
          // Rs.1000.00 credited to A/c XX1234 on 23-Dec-25
          regex: /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+credited.*?(?:A\/c|account).*?([xX]{2,}\d+).*?on\s+(\d{1,2}[-\/]\w{3}[-\/]\d{2,4})/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'credit',
            accountNumber: match[2],
            date: this.parseDate(match[3]),
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
          // Your A/c XX5678 is debited with Rs 250 on 23-12-25. Info: UPI-Zomato
          regex: /(?:A\/c|account).*?([xX]{2,}\d+).*?(?:debited|withdrawn).*?(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+on\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}).*?Info:?\s*(.+?)(?:\.|Ref|$)/i,
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
          // Your A/c XX5678 is credited with Rs 1000 on 23-12-25
          regex: /(?:A\/c|account).*?([xX]{2,}\d+).*?credited.*?(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+on\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
          extract: (match) => ({
            amount: parseFloat(match[2].replace(/,/g, '')),
            type: 'credit',
            accountNumber: match[1],
            date: this.parseDate(match[3]),
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
          // Rs 1000.00 spent on SBI Card XX9012 at AMAZON on 23/12/25
          regex: /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:spent|debited).*?(?:card|A\/c).*?([xX]{2,}\d+).*?at\s+([A-Z][A-Za-z0-9\s]+?)\s+on\s+(\d{1,2}[\/]\d{1,2}[\/]\d{2,4})/i,
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
          // Rs.500 debited from A/c XX1234 on 23-12-25 for UPI/IMPS
          regex: /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+debited.*?(?:A\/c|account).*?([xX]{2,}\d+).*?on\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}).*?(?:for|Info)\s*(.+?)(?:\.|Ref|$)/i,
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
          // Rs 2000 credited to A/c XX1234 on 23/12/25
          regex: /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+credited.*?(?:A\/c|account).*?([xX]{2,}\d+).*?on\s+(\d{1,2}[\/]\d{1,2}[\/]\d{2,4})/i,
          extract: (match) => ({
            amount: parseFloat(match[2].replace(/,/g, '')),
            type: 'credit',
            accountNumber: match[1],
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
          // INR 750.00 debited from XX3456 on 23Dec for PAYTM
          regex: /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+debited.*?([xX]{2,}\d+).*?on\s+(\d{1,2}\s*\w{3}\s*\d{2,4}).*?(?:for|at)\s+([A-Z][A-Za-z0-9\s]+?)(?:\.|Avl|$)/i,
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
          // INR 5000 credited to XX3456 on 23-Dec-25
          regex: /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+credited.*?([xX]{2,}\d+).*?on\s+(\d{1,2}[-\/]\w{3}[-\/]\d{2,4})/i,
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
          // Rs.300.00 debited from A/c XX7890 on 23-12-25 at Uber
          regex: /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+debited.*?(?:A\/c|account).*?([xX]{2,}\d+).*?on\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}).*?(?:at|to)\s+([A-Z][A-Za-z0-9\s]+?)(?:\.|Avl|$)/i,
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
      ],
    },

    // Punjab National Bank (PNB)
    {
      name: 'PNB',
      patterns: [
        {
          // Rs 400 debited from A/c XX2345 on 23/12/25 for UPI/Phonepe
          regex: /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:debited|withdrawn).*?(?:A\/c|account).*?([xX]{2,}\d+).*?on\s+(\d{1,2}[\/]\d{1,2}[\/]\d{2,4}).*?(?:for|Info)\s*(.+?)(?:\.|Ref|$)/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'debit',
            accountNumber: match[2],
            date: this.parseDate(match[3]),
            merchant: match[4].trim(),
            confidence: 'medium',
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
          // Generic debit pattern: Rs/INR amount debited/withdrawn from account
          regex: /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+(?:debited|withdrawn|spent).*?(?:from|on).*?(?:A\/c|account|card)?.*?([xX]{2,}\d+)/i,
          extract: (match) => ({
            amount: parseFloat(match[1].replace(/,/g, '')),
            type: 'debit',
            accountNumber: match[2],
            confidence: 'low',
          }),
        },
        {
          // Generic credit pattern: Rs/INR amount credited to account
          regex: /(?:Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s+credited.*?(?:to|in).*?(?:A\/c|account)?.*?([xX]{2,}\d+)/i,
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
  parseSMS(smsText: string): ParsedTransaction | null {
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
          
          // Auto-detect and assign tags based on transaction type and content
          const tagDetection = detectTransactionTags(
            parsed.type || 'debit',
            cleanText,
            parsed.merchant
          );
          
          return {
            ...parsed,
            originalText: cleanText,
            // Default to today if no date found
            date: parsed.date || new Date(),
            tags: tagDetection.tags,
          } as ParsedTransaction;
        }
      }
    }

    return null;
  }

  /**
   * Parse multiple SMS messages (batch)
   */
  parseMultipleSMS(smsTexts: string[]): ParsedTransaction[] {
    return smsTexts
      .map((text) => this.parseSMS(text))
      .filter((parsed): parsed is ParsedTransaction => parsed !== null);
  }

  /**
   * Parse date from various formats
   */
  private parseDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;

    // Try different date formats
    const formats = [
      // 23-Dec-25 or 23-Dec-2025
      /(\d{1,2})[-\/](\w{3})[-\/](\d{2,4})/,
      // 23/12/25 or 23/12/2025 or 23-12-25
      /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/,
      // 23Dec25 or 23Dec2025
      /(\d{1,2})(\w{3})(\d{2,4})/,
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        const [_, day, monthOrDay, year] = match;

        // Check if month is text (Jan, Feb, etc.)
        const monthMap: { [key: string]: number } = {
          jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
          jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
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
      const sameDay =
        existing.date.toDateString() === parsed.date?.toDateString();
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
    return this.bankPatterns
      .filter((bp) => bp.name !== 'Generic')
      .map((bp) => bp.name);
  }
}

export const smsParserService = new SMSParserService();
