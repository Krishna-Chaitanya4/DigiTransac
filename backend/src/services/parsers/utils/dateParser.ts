/**
 * Shared date parsing utilities for transaction parsers
 * Handles multiple date formats used by Indian banks
 */

import { logger } from '../../../utils/logger';

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
 * Parse date from various formats used by Indian banks
 * Supports: DD-MMM-YY, DD/MM/YYYY, DD-MM-YYYY, etc.
 */
export function parseDate(dateStr: string): Date | undefined {
  if (!dateStr?.trim()) {
    return undefined;
  }

  try {
    // Format 1: DD-MMM-YY or DD-MMM-YYYY (e.g., "23-Dec-25", "23-Dec-2025")
    const format1 = /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/i;
    const match1 = dateStr.match(format1);
    if (match1) {
      const day = parseInt(match1[1], 10);
      const monthStr = match1[2].toLowerCase();
      let year = parseInt(match1[3], 10);

      // Convert 2-digit year to 4-digit
      if (year < 100) {
        year += year > 50 ? 1900 : 2000;
      }

      const month = MONTH_MAP[monthStr];
      if (month === undefined) {
        logger.warn(`Invalid month name: ${monthStr}`);
        return undefined;
      }

      // Validate day range
      if (day < 1 || day > 31) {
        logger.warn(`Invalid day: ${day}`);
        return undefined;
      }

      // Validate year range (reasonable range: 2000-2100)
      if (year < 2000 || year > 2100) {
        logger.warn(`Invalid year: ${year}`);
        return undefined;
      }

      const date = new Date(year, month, day);
      
      // Verify the date is valid (handles invalid dates like Feb 31)
      if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
        logger.warn(`Invalid date: ${dateStr} resulted in ${date.toISOString()}`);
        return undefined;
      }

      return date;
    }

    // Format 2: DD/MM/YYYY (e.g., "23/12/2025")
    const format2 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match2 = dateStr.match(format2);
    if (match2) {
      const day = parseInt(match2[1], 10);
      const month = parseInt(match2[2], 10) - 1; // JavaScript months are 0-indexed
      const year = parseInt(match2[3], 10);

      // Validate ranges
      if (day < 1 || day > 31 || month < 0 || month > 11 || year < 2000 || year > 2100) {
        logger.warn(`Invalid date components: day=${day}, month=${month + 1}, year=${year}`);
        return undefined;
      }

      const date = new Date(year, month, day);
      
      // Verify the date is valid
      if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
        logger.warn(`Invalid date: ${dateStr} resulted in ${date.toISOString()}`);
        return undefined;
      }

      return date;
    }

    // Format 3: DD-MM-YYYY (e.g., "23-12-2025")
    const format3 = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
    const match3 = dateStr.match(format3);
    if (match3) {
      const day = parseInt(match3[1], 10);
      const month = parseInt(match3[2], 10) - 1;
      const year = parseInt(match3[3], 10);

      // Validate ranges
      if (day < 1 || day > 31 || month < 0 || month > 11 || year < 2000 || year > 2100) {
        logger.warn(`Invalid date components: day=${day}, month=${month + 1}, year=${year}`);
        return undefined;
      }

      const date = new Date(year, month, day);
      
      // Verify the date is valid
      if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
        logger.warn(`Invalid date: ${dateStr} resulted in ${date.toISOString()}`);
        return undefined;
      }

      return date;
    }

    // Format 4: DD/MM/YY (e.g., "23/12/25")
    const format4 = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;
    const match4 = dateStr.match(format4);
    if (match4) {
      const day = parseInt(match4[1], 10);
      const month = parseInt(match4[2], 10) - 1;
      let year = parseInt(match4[3], 10);

      // Convert 2-digit year to 4-digit
      year += year > 50 ? 1900 : 2000;

      // Validate ranges
      if (day < 1 || day > 31 || month < 0 || month > 11) {
        logger.warn(`Invalid date components: day=${day}, month=${month + 1}, year=${year}`);
        return undefined;
      }

      const date = new Date(year, month, day);
      
      // Verify the date is valid
      if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
        logger.warn(`Invalid date: ${dateStr} resulted in ${date.toISOString()}`);
        return undefined;
      }

      return date;
    }

    logger.warn(`Unrecognized date format: ${dateStr}`);
    return undefined;
  } catch (error) {
    logger.error({ err: error }, `Error parsing date: ${dateStr}`);
    return undefined;
  }
}

/**
 * Check if a date is within a reasonable range (past 5 years to future 1 year)
 */
export function isReasonableTransactionDate(date: Date): boolean {
  const now = new Date();
  const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
  const oneYearLater = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  return date >= fiveYearsAgo && date <= oneYearLater;
}
