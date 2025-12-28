import { mongoDBService } from '../config/mongodb';
import { decryptTransaction } from './transactionEncryption';
import { buildExpenseFilter } from './transactionFilters';
import { Transaction } from '../models/types';

/**
 * Helper functions to work with the new transaction/splits model
 * while providing backward compatibility with the old expense model
 */

export interface ExpenseFromSplit {
  id: string;
  userId: string;
  amount: number;
  categoryId: string;
  date: Date;
  description: string;
  reviewStatus: string;
  createdAt: Date;
  accountId?: string;
  transactionId: string;
  tags?: string[]; // Tags from the split
  type?: string; // Transaction type (debit/credit)
}

/**
 * Get debit transactions as "expenses" for backward compatibility
 * Converts transaction splits into expense-like objects
 */
export async function getExpensesFromTransactions(
  userId: string,
  startDate: Date,
  endDate: Date,
  reviewStatus?: string
): Promise<ExpenseFromSplit[]> {
  const transactionsContainer = await mongoDBService.getTransactionsContainer();

  // Use centralized filter builder - defaults to approved if reviewStatus provided
  const filter = reviewStatus
    ? buildExpenseFilter(userId, startDate, endDate)
    : { userId, type: 'debit', date: { $gte: startDate, $lte: endDate } };

  const transactions = await transactionsContainer.find(filter).toArray();

  if (transactions.length === 0) return [];

  // Decrypt transactions
  const decryptedTransactions = transactions.map((t) =>
    decryptTransaction(t as unknown as Transaction)
  );

  // Get splits for these transactions
  const splitsContainer = await mongoDBService.getTransactionSplitsContainer();
  const transactionIds = decryptedTransactions.map((t) => t.id);

  const splits = await splitsContainer.find({ transactionId: { $in: transactionIds } }).toArray();

  // Create expense-like objects from splits with transaction data
  const expenses: ExpenseFromSplit[] = splits.map((split) => {
    const transaction = decryptedTransactions.find((t) => t.id === split.transactionId);
    return {
      id: split.id,
      userId: split.userId,
      amount: split.amount,
      categoryId: split.categoryId,
      date: transaction?.date || new Date(),
      description: transaction?.description || '',
      reviewStatus: transaction?.reviewStatus || 'pending',
      createdAt: transaction?.createdAt || new Date(),
      accountId: transaction?.accountId,
      transactionId: split.transactionId,
      tags: split.tags || [], // Include tags from the split
      type: transaction?.type || 'debit', // Include transaction type
    };
  });

  return expenses;
}

/**
 * Get single expense by ID (searches through transaction splits)
 */
export async function getExpenseById(
  userId: string,
  expenseId: string
): Promise<ExpenseFromSplit | null> {
  const splitsContainer = await mongoDBService.getTransactionSplitsContainer();
  const split = await splitsContainer.findOne({ id: expenseId, userId });

  if (!split) return null;

  const transactionsContainer = await mongoDBService.getTransactionsContainer();
  const transaction = await transactionsContainer.findOne({ id: split.transactionId, userId });

  if (!transaction) return null;

  // Decrypt transaction
  const decryptedTransaction = decryptTransaction(transaction as unknown as Transaction);

  return {
    id: split.id,
    userId: split.userId,
    amount: split.amount,
    categoryId: split.categoryId,
    date: decryptedTransaction.date,
    description: decryptedTransaction.description,
    reviewStatus: decryptedTransaction.reviewStatus,
    createdAt: decryptedTransaction.createdAt,
    accountId: decryptedTransaction.accountId,
    transactionId: split.transactionId,
    tags: split.tags || [], // Include tags from the split
    type: decryptedTransaction.type, // Include transaction type
  };
}

/**
 * Count expenses (debit transaction splits) matching criteria
 */
export async function countExpenses(
  userId: string,
  filter: Record<string, unknown> = {}
): Promise<number> {
  const transactionsContainer = await mongoDBService.getTransactionsContainer();

  const txFilter = {
    userId,
    type: 'debit',
    ...filter,
  };

  // First get matching transactions
  const transactions = await transactionsContainer.find(txFilter).toArray();

  if (transactions.length === 0) return 0;

  // Count splits for these transactions
  const splitsContainer = await mongoDBService.getTransactionSplitsContainer();
  const transactionIds = transactions.map((t) => (t as unknown as Transaction).id);

  const count = await splitsContainer.countDocuments({
    transactionId: { $in: transactionIds },
  });

  return count;
}
