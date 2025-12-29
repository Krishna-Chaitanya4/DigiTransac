/**
 * Centralized bank patterns for transaction parsing
 * Supports major Indian banks with comprehensive coverage
 */

import { BankPattern } from '../base/types';

/**
 * Bank patterns for parsing transactions
 * Includes patterns for SMS and email transactions
 */
export const BANK_PATTERNS: Readonly<BankPattern[]> = [
  // SBI - Real examples validated
  {
    name: 'SBI',
    senders: ['SBIIN', 'SBI', 'SBICARD'],
    patterns: [
      {
        // Pattern 1: SBI Account Credit (NEFT/IMPS) - Real example from user
        // Example: "Dear Customer, INR 93,316.00 credited to your A/c No XX0265 on 26/12/2025 through NEFT with UTR CITIN25674965960 by MIRPL-1190-SALARY PAYMENT"
        regex:
          /INR\s+([\d,]+\.?\d*)\s+credited.*?A\/c\s+No\s+([X\d]+).*?on\s+(\d{2}\/\d{2}\/\d{4}).*?(?:by|from)\s+(.+?)(?:,\s*INFO|$)/i,
        amountGroup: 1,
        merchantGroup: 4,
      },
      {
        // Pattern 2: SBI Card Debit - Real example from user
        // Example: "Rs.829.86 spent on your SBI Credit Card ending 3619 at BOOKMYSHOW on 13/12/25"
        regex:
          /Rs\.?([\d,]+\.?\d*)\s+spent.*?ending\s+(\d{4})\s+at\s+([A-Z][A-Za-z0-9\s]+?)\s+on\s+(\d{2}\/\d{2}\/\d{2})/i,
        amountGroup: 1,
        merchantGroup: 3,
      },
      {
        // Pattern 3: SBI withdrawn - from email patterns
        regex:
          /(?:Rs\.?|INR)\s*([\d,]+\.?\d*)\s*(?:withdrawn|debited)\s+from\s+([A-Z][A-Za-z0-9\s&-]+?)(?=\.|Card|$)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
    ],
    cardPattern: /ending\s+(\d{4})|XX(\d{4})/i,
    accountPattern: /A\/c\s+No\s+([X\d]+)|A\/c\s+([X.]{2,}\d{4})/i,
    datePattern: /on\s+(\d{2}\/\d{2}\/\d{2,4})|(\d{2}-\d{2}-\d{4})/i,
  },
  // ICICI - Real examples validated
  {
    name: 'ICICI Bank',
    senders: ['ICICIB', 'ICICI'],
    patterns: [
      {
        // Pattern 1: ICICI Card Debit with UPI - Real example from user
        // Example: "ICICI Bank Credit Card XX5005 debited for INR 1,234.00 on 28-Dec-25 for UPI-215018029879-SWIGGY"
        regex:
          /(?:Credit Card|Card)\s+([X\d]+)\s+debited.*?INR\s+([\d,]+\.?\d*)\s+on\s+([\d-A-Za-z]+).*?UPI-\d+-([A-Z][A-Za-z0-9\s]+)/i,
        amountGroup: 2,
        merchantGroup: 4,
      },
      {
        // Pattern 2: ICICI Card Debit without UPI
        regex:
          /(?:Credit Card|Card)\s+([X\d]+)\s+debited.*?INR\s+([\d,]+\.?\d*)\s+on\s+([\d-A-Za-z]+).*?(?:at|for)\s+([A-Z][A-Za-z0-9\s]+)/i,
        amountGroup: 2,
        merchantGroup: 4,
      },
      {
        // Pattern 3: ICICI spent/debited at merchant
        regex:
          /(?:Rs|INR)\s*([\d,]+\.?\d*)\s*(?:spent|debited).*?(?:at|on)\s*([A-Z][A-Za-z0-9\s&-]+?)(?:\s+on|\.|Card)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
    ],
    cardPattern: /(?:Credit Card|Card)\s+([X\d]+)|XX(\d{4})/i,
    datePattern: /on\s+([\d-A-Za-z]+)|(\d{2}\/\d{2}\/\d{4})/i,
  },
  // HDFC Bank - Email parser support
  {
    name: 'HDFC Bank',
    senders: ['HDFCBK', 'HDFC'],
    patterns: [
      {
        // Standard debit with merchant
        regex:
          /(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)\s+(?:debited|spent|paid).*?(?:at|on)\s+([A-Z][A-Za-z0-9][A-Za-z0-9\s&*-]*?)(?=\s+on\s+\d{2}|\s+Avl|\.|\s*$)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
      {
        // Alternative format
        regex:
          /(?:debited|spent)\s+(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?).*?(?:at|on)\s+([A-Z][A-Za-z0-9][A-Za-z0-9\s&*-]+?)(?=\s+on\s+\d{2}|\.)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
      {
        // Credit transactions
        regex:
          /(?:Rs\.?|INR)\s*([\d,]+(?:\.\d{2})?)\s+credited.*?(?:from)\s+([A-Z][A-Za-z0-9\s]+?)(?=\s+on|\.|$)/i,
        amountGroup: 1,
        merchantGroup: 2,
      },
    ],
    cardPattern: /(?:Card\s+)?XX(\d{4})/i,
    datePattern: /(\d{2}-[A-Z][a-z]{2}-\d{2,4})/i,
  },
  // Axis Bank - Email parser support
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
  // Kotak Bank - Email parser support
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
  // Punjab National Bank
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
  // Bank of Baroda
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
  // Canara Bank
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
  // Union Bank
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
  // IDBI Bank
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

/**
 * Get bank pattern by sender ID
 */
export function getBankPatternBySender(sender: string): BankPattern | undefined {
  const normalizedSender = sender.toUpperCase().replace(/[^A-Z]/g, '');
  return BANK_PATTERNS.find((pattern) =>
    pattern.senders.some((s) => normalizedSender.includes(s.toUpperCase()))
  );
}
