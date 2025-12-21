import { cosmosDBService } from '../config/cosmosdb';

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
  const transactionsContainer = await cosmosDBService.getTransactionsContainer();
  
  const filter: any = {
    userId,
    type: 'debit',
    date: { $gte: startDate, $lte: endDate },
  };
  
  if (reviewStatus) {
    filter.reviewStatus = reviewStatus;
  }
  
  const transactions = await transactionsContainer.find(filter).toArray();
  
  if (transactions.length === 0) return [];
  
  // Get splits for these transactions
  const splitsContainer = await cosmosDBService.getTransactionSplitsContainer();
  const transactionIds = transactions.map((t: any) => t.id);
  
  const splits = await splitsContainer
    .find({ transactionId: { $in: transactionIds } })
    .toArray();
  
  // Create expense-like objects from splits with transaction data
  const expenses: ExpenseFromSplit[] = splits.map((split: any) => {
    const transaction = transactions.find((t: any) => t.id === split.transactionId);
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
export async function getExpenseById(userId: string, expenseId: string): Promise<ExpenseFromSplit | null> {
  const splitsContainer = await cosmosDBService.getTransactionSplitsContainer();
  const split = await splitsContainer.findOne({ id: expenseId, userId });
  
  if (!split) return null;
  
  const transactionsContainer = await cosmosDBService.getTransactionsContainer();
  const transaction = await transactionsContainer.findOne({ id: split.transactionId, userId });
  
  if (!transaction) return null;
  
  return {
    id: split.id,
    userId: split.userId,
    amount: split.amount,
    categoryId: split.categoryId,
    date: transaction.date,
    description: transaction.description,
    reviewStatus: transaction.reviewStatus,
    createdAt: transaction.createdAt,
    accountId: transaction.accountId,
    transactionId: split.transactionId,
    tags: split.tags || [], // Include tags from the split
    type: transaction.type, // Include transaction type
  };
}

/**
 * Count expenses (debit transaction splits) matching criteria
 */
export async function countExpenses(userId: string, filter: any = {}): Promise<number> {
  const transactionsContainer = await cosmosDBService.getTransactionsContainer();
  
  const txFilter: any = {
    userId,
    type: 'debit',
    ...filter,
  };
  
  // First get matching transactions
  const transactions = await transactionsContainer.find(txFilter).toArray();
  
  if (transactions.length === 0) return 0;
  
  // Count splits for these transactions
  const splitsContainer = await cosmosDBService.getTransactionSplitsContainer();
  const transactionIds = transactions.map((t: any) => t.id);
  
  const count = await splitsContainer.countDocuments({
    transactionId: { $in: transactionIds },
  });
  
  return count;
}
