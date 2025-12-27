/**
 * Transaction Filter Utilities
 *
 * Centralized utilities for building MongoDB filters following industry best practices:
 * - DRY (Don't Repeat Yourself) principle
 * - Single Responsibility Principle
 * - Type safety with TypeScript
 * - Consistent filtering across all calculation endpoints
 */

import { MongoFilter } from '../models/types';

/**
 * Review status enum for type safety
 */
export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Transaction type enum for type safety
 */
export enum TransactionType {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

/**
 * Base filter interface for transaction queries
 */
export interface TransactionFilterOptions {
  userId: string;
  type?: TransactionType | TransactionType[];
  reviewStatus?: ReviewStatus | ReviewStatus[];
  startDate?: Date;
  endDate?: Date;
  accountId?: string | string[];
  categoryIds?: string[];
  tags?: string[];
}

/**
 * Build a MongoDB filter for approved transactions only
 *
 * This is the default filter for ALL financial calculations including:
 * - Dashboard totals and summaries
 * - Account balances
 * - Budget spending calculations
 * - Analytics and reports
 * - Category/tag statistics
 *
 * @param userId - User ID to filter by
 * @param additionalFilters - Additional MongoDB filter criteria
 * @returns MongoDB filter object
 *
 * @example
 * const filter = buildApprovedTransactionsFilter(userId, {
 *   type: 'debit',
 *   date: { $gte: startDate, $lte: endDate }
 * });
 */
export function buildApprovedTransactionsFilter(
  userId: string,
  additionalFilters: MongoFilter<any> = {}
): MongoFilter<any> {
  return {
    userId,
    reviewStatus: ReviewStatus.APPROVED,
    ...additionalFilters,
  };
}

/**
 * Build a flexible MongoDB filter for transaction queries
 *
 * Use this for listing transactions where users can filter by any review status.
 * For financial calculations, prefer buildApprovedTransactionsFilter instead.
 *
 * @param options - Filter options
 * @returns MongoDB filter object
 *
 * @example
 * // Filter for pending debits in date range
 * const filter = buildTransactionFilter({
 *   userId,
 *   type: TransactionType.DEBIT,
 *   reviewStatus: ReviewStatus.PENDING,
 *   startDate: new Date('2025-01-01'),
 *   endDate: new Date('2025-01-31')
 * });
 */
export function buildTransactionFilter(options: TransactionFilterOptions): MongoFilter<any> {
  const { userId, type, reviewStatus, startDate, endDate, accountId, categoryIds, tags } = options;

  const filter: MongoFilter<any> = { userId };

  // Add type filter
  if (type) {
    filter.type = Array.isArray(type) ? { $in: type } : type;
  }

  // Add review status filter
  if (reviewStatus) {
    filter.reviewStatus = Array.isArray(reviewStatus) ? { $in: reviewStatus } : reviewStatus;
  }

  // Add date range filter
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) {
      filter.date.$gte = startDate;
    }
    if (endDate) {
      filter.date.$lte = endDate;
    }
  }

  // Add account filter
  if (accountId) {
    filter.accountId = Array.isArray(accountId) ? { $in: accountId } : accountId;
  }

  // Note: categoryIds and tags are typically filtered at the split level,
  // not at the transaction level. These are included for completeness.
  if (categoryIds && categoryIds.length > 0) {
    filter.categoryId = { $in: categoryIds };
  }

  if (tags && tags.length > 0) {
    filter.tags = { $in: tags };
  }

  return filter;
}

/**
 * Build filter specifically for expense calculations (debit transactions only)
 * Always uses approved status for accurate financial reporting.
 *
 * @param userId - User ID
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @param additionalFilters - Additional filter criteria
 * @returns MongoDB filter object
 *
 * @example
 * const filter = buildExpenseFilter(userId, startDate, endDate);
 */
export function buildExpenseFilter(
  userId: string,
  startDate: Date,
  endDate: Date,
  additionalFilters: MongoFilter<any> = {}
): MongoFilter<any> {
  return buildApprovedTransactionsFilter(userId, {
    type: TransactionType.DEBIT,
    date: { $gte: startDate, $lte: endDate },
    ...additionalFilters,
  });
}

/**
 * Build filter specifically for income calculations (credit transactions only)
 * Always uses approved status for accurate financial reporting.
 *
 * @param userId - User ID
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @param additionalFilters - Additional filter criteria
 * @returns MongoDB filter object
 *
 * @example
 * const filter = buildIncomeFilter(userId, startDate, endDate);
 */
export function buildIncomeFilter(
  userId: string,
  startDate: Date,
  endDate: Date,
  additionalFilters: MongoFilter<any> = {}
): MongoFilter<any> {
  return buildApprovedTransactionsFilter(userId, {
    type: TransactionType.CREDIT,
    date: { $gte: startDate, $lte: endDate },
    ...additionalFilters,
  });
}
