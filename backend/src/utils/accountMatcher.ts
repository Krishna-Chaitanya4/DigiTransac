import { Collection } from 'mongodb';
import { Account } from '../models/types';
import { logger } from './logger';

/**
 * Normalize merchant name for consistency
 * Examples:
 * - "SWIGGY*BANGALORE" → "Swiggy"
 * - "AMAZON PAY*" → "Amazon Pay"
 * - "ZOMATO BANGALORE" → "Zomato"
 */
export function normalizeMerchantName(merchantName: string): string {
  if (!merchantName) return merchantName;

  let normalized = merchantName.trim();

  // Remove common suffixes and patterns
  normalized = normalized
    .replace(/\*.*$/, '') // Remove everything after *
    .replace(/\s+(BANGALORE|MUMBAI|DELHI|CHENNAI|KOLKATA|HYDERABAD|PUNE|INDIA)$/i, '') // Remove city names
    .replace(/\s+(PVT|LTD|LIMITED|INC|CORP|LLC)$/i, '') // Remove company suffixes
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // Replace special chars with space
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();

  // Title case (first letter of each word capitalized)
  normalized = normalized
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return normalized;
}

/**
 * Match SMS/email account information to user's accounts
 *
 * Matching hierarchy:
 * 1. Bank name + last 4 digits (most accurate)
 * 2. Bank name only (if user has only 1 account with that bank)
 * 3. Account number contains parsed number (fallback)
 * 4. null (no match, user must select manually)
 */
export async function matchAccount(
  userId: string,
  accountsCollection: Collection<Account>,
  bankName?: string,
  accountNumber?: string
): Promise<string | null> {
  try {
    if (!bankName && !accountNumber) {
      return null; // No info to match on
    }

    // Get all user's accounts
    const userAccounts = (await accountsCollection
      .find({ userId, isActive: true })
      .toArray()) as unknown as Account[];

    if (userAccounts.length === 0) {
      logger.info(`No active accounts found for user ${userId}`);
      return null;
    }

    // Normalize bank name for matching
    const normalizedBankName = bankName?.toLowerCase().trim();

    // Extract last 4 digits if available
    const last4Match = accountNumber?.match(/(\d{4})$/);
    const last4 = last4Match ? last4Match[1] : null;

    // Priority 1: Bank name + last 4 digits match
    if (normalizedBankName && last4) {
      const exactMatch = userAccounts.find((account) => {
        const accountBankLower = account.bankName?.toLowerCase().trim();
        const accountLast4 = account.accountNumber?.slice(-4);

        return accountBankLower?.includes(normalizedBankName) && accountLast4 === last4;
      });

      if (exactMatch) {
        logger.info(`Matched account by bank+last4: ${exactMatch.name} (${bankName} ${last4})`);
        return exactMatch.id;
      }
    }

    // Priority 2: Bank name only (if user has single account with that bank)
    if (normalizedBankName) {
      const bankMatches = userAccounts.filter((account) => {
        const accountBankLower = account.bankName?.toLowerCase().trim();
        return accountBankLower?.includes(normalizedBankName);
      });

      if (bankMatches.length === 1) {
        logger.info(`Matched account by bank name only: ${bankMatches[0].name} (${bankName})`);
        return bankMatches[0].id;
      }

      if (bankMatches.length > 1) {
        logger.info(`Multiple accounts found for ${bankName}, need last 4 digits to disambiguate`);
      }
    }

    // Priority 3: Last 4 digits only (fallback)
    if (last4 && !normalizedBankName) {
      const last4Matches = userAccounts.filter((account) => {
        const accountLast4 = account.accountNumber?.slice(-4);
        return accountLast4 === last4;
      });

      if (last4Matches.length === 1) {
        logger.info(`Matched account by last 4 digits only: ${last4Matches[0].name} (${last4})`);
        return last4Matches[0].id;
      }
    }

    logger.info(`No account match found for bank=${bankName}, account=${accountNumber}`);
    return null;
  } catch (error) {
    logger.error({ error }, 'Failed to match account');
    return null;
  }
}
