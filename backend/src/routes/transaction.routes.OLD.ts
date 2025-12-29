import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { mongoDBService } from '../config/mongodb';
import { Transaction, TransactionSplit, MongoFilter } from '../models/types';
import { v4 as uuidv4 } from 'uuid';
import { learnFromTransaction } from '../services/merchantLearning.service';

// Extended Transaction type with splits
interface TransactionWithSplits extends Transaction {
  splits?: TransactionSplit[];
}

import {
  encryptTransaction,
  decryptTransaction,
  decryptTransactions,
} from '../utils/transactionEncryption';

const router = Router();

router.use(authenticate);

/**
 * GET /api/transactions - Get all transactions with filtering and search
 *
 * Performance Optimizations:
 * 1. Search on encrypted data: Fetches larger batches (10x limit, max 1000) since filtering
 *    happens post-decryption. Industry standard to prevent fetching entire dataset.
 * 2. In-memory pagination: For search queries, pagination applied after filtering to ensure
 *    accurate results while respecting limit/skip parameters.
 * 3. Early returns: Filter function checks fastest conditions first (amount > description > merchant).
 * 4. Database-level operations: Non-search queries use MongoDB's native skip/limit for efficiency.
 * 5. Conditional fetching: Only fetches splits when explicitly requested (includeSplits=true).
 *
 * Trade-offs:
 * - Search queries limited to 1000 recent transactions to prevent memory issues
 * - Users with >1000 transactions should use date filters to narrow search scope
 */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const {
      accountId,
      categoryId, // Deprecated: for backwards compatibility
      categoryIds, // New: multiple categories
      type,
      tags, // Deprecated: for backwards compatibility
      includeTags,
      excludeTags,
      startDate,
      endDate,
      reviewStatus,
      search,
      minAmount,
      maxAmount,
      limit = '100',
      skip = '0',
      sortBy = 'date',
      sortOrder = 'desc',
      includeSplits = 'true', // Option to include splits
    } = req.query;

    const transactionsContainer = await mongoDBService.getTransactionsContainer();
    const splitsContainer = await mongoDBService.getTransactionSplitsContainer();

    // Build filter
    const filter: MongoFilter<Transaction> = { userId };

    if (accountId) filter.accountId = accountId;
    // Note: categoryId and tags filtering now needs to look at splits
    // For backwards compatibility, also check transaction.categoryId
    if (type) filter.type = type;
    if (reviewStatus) filter.reviewStatus = reviewStatus;

    // Store search term and amount range for in-memory filtering after decryption
    // (can't search/filter encrypted fields with MongoDB)
    const searchStr = search as string;
    const minAmountNum = minAmount ? parseFloat(minAmount as string) : undefined;
    const maxAmountNum = maxAmount ? parseFloat(maxAmount as string) : undefined;

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate as string);
      if (endDate) filter.date.$lte = new Date(endDate as string);
    }

    // Use database-level sorting and pagination for better performance
    const sortField = sortBy as string;
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    const skipNum = parseInt(skip as string);
    const limitNum = parseInt(limit as string);

    // Performance optimization: When searching encrypted fields, we need to fetch more data
    // to account for post-decryption filtering. Fetch larger batches to ensure we get enough results.
    // Limit search to reasonable bounds to prevent memory issues with large datasets.
    const isSearchQuery = !!searchStr;
    const MAX_SEARCH_DOCUMENTS = 1000; // Industry standard: limit search scope
    const fetchLimit = isSearchQuery
      ? Math.min(MAX_SEARCH_DOCUMENTS, Math.max(limitNum * 10, 100))
      : limitNum;
    const fetchSkip = isSearchQuery ? 0 : skipNum; // When searching, fetch from start and skip in-memory

    let transactions = (await transactionsContainer
      .find(filter)
      .sort({ [sortField]: sortDirection })
      .skip(fetchSkip)
      .limit(fetchLimit)
      .toArray()) as unknown as Transaction[];

    // If includeSplits is true, fetch splits for each transaction
    if (includeSplits === 'true') {
      const transactionIds = transactions.map((t) => t.id);
      const allSplits = (await splitsContainer
        .find({ transactionId: { $in: transactionIds } })
        .toArray()) as unknown as TransactionSplit[];

      // Sort splits in-memory by order
      allSplits.sort((a, b) => a.order - b.order);

      // Group splits by transaction ID
      const splitsByTransaction = allSplits.reduce(
        (acc, split) => {
          if (!acc[split.transactionId]) {
            acc[split.transactionId] = [];
          }
          acc[split.transactionId]!.push(split);
          return acc;
        },
        {} as Record<string, TransactionSplit[]>
      );

      // Attach splits to transactions
      transactions = transactions.map((txn) => ({
        ...txn,
        splits: splitsByTransaction[txn.id] || [],
      })) as TransactionWithSplits[];
    }

    // Apply category and tag filtering AFTER fetching splits (if needed)
    if (categoryId || categoryIds || tags || includeTags || excludeTags) {
      transactions = transactions.filter((txn) => {
        const txnSplits = (txn as TransactionWithSplits).splits || [];

        // Handle multiple categories (OR logic: match any category)
        if (categoryIds) {
          const categoryArray = (categoryIds as string).split(',');
          const hasCategory =
            txnSplits.some((s: TransactionSplit) => categoryArray.includes(s.categoryId)) ||
            (txn.categoryId && categoryArray.includes(txn.categoryId));
          if (!hasCategory) return false;
        }

        // Backwards compatibility: single categoryId
        if (categoryId) {
          const hasCategory =
            txnSplits.some((s: TransactionSplit) => s.categoryId === categoryId) ||
            txn.categoryId === categoryId;
          if (!hasCategory) return false;
        }

        // Handle include tags (OR logic: transaction must have at least ONE of these tags)
        if (includeTags) {
          const includeArray = (includeTags as string).split(',');
          const hasIncludedTag =
            txnSplits.some((s: TransactionSplit) => s.tags.some((t) => includeArray.includes(t))) ||
            (txn.tags && txn.tags.some((t: string) => includeArray.includes(t)));
          if (!hasIncludedTag) return false;
        }

        // Handle exclude tags (OR logic: transaction must NOT have ANY of these tags)
        if (excludeTags) {
          const excludeArray = (excludeTags as string).split(',');
          const hasExcludedTag =
            txnSplits.some((s: TransactionSplit) => s.tags.some((t) => excludeArray.includes(t))) ||
            (txn.tags && txn.tags.some((t: string) => excludeArray.includes(t)));
          if (hasExcludedTag) return false; // Exclude this transaction
        }

        // Backwards compatibility: old 'tags' parameter (OR logic)
        if (tags) {
          const tagArray = (tags as string).split(',');
          const hasTags =
            txnSplits.some((s: TransactionSplit) => s.tags.some((t) => tagArray.includes(t))) ||
            (txn.tags && txn.tags.some((t: string) => tagArray.includes(t)));
          if (!hasTags) return false;
        }

        return true;
      });
    }

    // Decrypt transactions before filtering by search (since fields are encrypted)
    let decryptedTransactions = decryptTransactions(transactions);

    // Apply search filter on decrypted data
    if (searchStr) {
      const searchLower = searchStr.toLowerCase();
      const amountSearch = parseFloat(searchStr);
      const isNumericSearch = !isNaN(amountSearch);

      // Performance: Use filter with early returns
      decryptedTransactions = decryptedTransactions.filter((txn) => {
        // Search by exact amount if search term is a number (fastest check)
        if (isNumericSearch && Math.abs(txn.amount) === Math.abs(amountSearch)) {
          return true;
        }
        // Search in description (most common)
        if (txn.description && txn.description.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Search in merchantName
        if (txn.merchantName && txn.merchantName.toLowerCase().includes(searchLower)) {
          return true;
        }
        return false;
      });
    }

    // Apply amount range filter on decrypted data
    if (minAmountNum !== undefined || maxAmountNum !== undefined) {
      decryptedTransactions = decryptedTransactions.filter((txn) => {
        const absAmount = Math.abs(txn.amount);
        if (minAmountNum !== undefined && absAmount < minAmountNum) {
          return false;
        }
        if (maxAmountNum !== undefined && absAmount > maxAmountNum) {
          return false;
        }
        return true;
      });
    }

    // Apply pagination in-memory for filtered results (search or amount range)
    if (searchStr || minAmountNum !== undefined || maxAmountNum !== undefined) {
      const totalSearchResults = decryptedTransactions.length;
      decryptedTransactions = decryptedTransactions.slice(skipNum, skipNum + limitNum);

      res.json({
        success: true,
        transactions: decryptedTransactions,
        pagination: {
          total: totalSearchResults,
          limit: limitNum,
          skip: skipNum,
          hasMore: totalSearchResults > skipNum + limitNum,
        },
      });
      return;
    }

    // For non-search queries, use DB count
    const total = await transactionsContainer.countDocuments(filter);

    res.json({
      success: true,
      transactions: decryptedTransactions,
      pagination: {
        total,
        limit: limitNum,
        skip: skipNum,
        hasMore: total > skipNum + limitNum,
      },
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
    });
  }
});

// GET /api/transactions/:id - Get single transaction
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const transactionsContainer = await mongoDBService.getTransactionsContainer();
    const splitsContainer = await mongoDBService.getTransactionSplitsContainer();

    const transaction = await transactionsContainer.findOne({ id, userId });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
      return;
    }

    // Fetch splits for this transaction
    const splits = (await splitsContainer
      .find({ transactionId: id })
      .toArray()) as unknown as TransactionSplit[];

    // Sort splits in-memory by order
    splits.sort((a, b) => a.order - b.order);

    // Decrypt transaction before sending to client
    const decryptedTransaction = decryptTransaction(transaction as unknown as Transaction);

    res.json({
      success: true,
      transaction: {
        ...decryptedTransaction,
        splits,
      },
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction',
    });
  }
});

// POST /api/transactions - Create a new transaction
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const {
      type,
      amount,
      accountId,
      description,
      splits, // Array of splits
      date,
      isRecurring,
      recurrencePattern,
      source,
      merchantName,
      reviewStatus,
    } = req.body;

    // Validation
    if (!type || !amount || !accountId || !description) {
      res.status(400).json({
        success: false,
        message: 'Type, amount, accountId, and description are required',
      });
      return;
    }

    if (type !== 'credit' && type !== 'debit') {
      res.status(400).json({
        success: false,
        message: 'Type must be either "credit" or "debit"',
      });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({
        success: false,
        message: 'Amount must be positive',
      });
      return;
    }

    // Validate splits
    if (!splits || !Array.isArray(splits) || splits.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one split is required',
      });
      return;
    }

    // Validate each split has required fields
    for (const split of splits) {
      if (!split.categoryId || !split.amount || split.amount <= 0) {
        res.status(400).json({
          success: false,
          message: 'Each split must have a categoryId and positive amount',
        });
        return;
      }
    }

    // Validate sum of splits equals total amount
    const splitsTotal = splits.reduce((sum: number, split: any) => sum + split.amount, 0);
    if (Math.abs(splitsTotal - amount) > 0.01) {
      // Allow for small floating point differences
      res.status(400).json({
        success: false,
        message: `Sum of splits (${splitsTotal}) must equal total amount (${amount})`,
      });
      return;
    }

    const transactionsContainer = await mongoDBService.getTransactionsContainer();
    const splitsContainer = await mongoDBService.getTransactionSplitsContainer();
    const accountsContainer = await mongoDBService.getAccountsContainer();
    const tagsContainer = await mongoDBService.getTagsContainer();

    // Verify account exists
    const account = await accountsContainer.findOne({ id: accountId, userId });
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
      });
      return;
    }

    const transactionId = uuidv4();

    // Encrypt sensitive fields before storing
    const encryptedData = encryptTransaction({
      description,
      amount,
    });

    const newTransaction: Transaction = {
      id: transactionId,
      userId,
      type,
      amount,
      accountId,
      description: encryptedData.description || description,
      date: date ? new Date(date) : new Date(),
      isRecurring: isRecurring || false,
      recurrencePattern,
      source: source || 'manual',
      merchantName,
      reviewStatus: reviewStatus || 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create split records
    const splitRecords: TransactionSplit[] = splits.map((split: any, index: number) => ({
      id: uuidv4(),
      transactionId,
      userId,
      categoryId: split.categoryId,
      amount: split.amount,
      tags: split.tags || [],
      notes: split.notes,
      order: index + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Insert transaction and splits in sequence (MongoDB doesn't support multi-document transactions in all configs)
    await transactionsContainer.insertOne(newTransaction);
    await splitsContainer.insertMany(splitRecords);

    // Update account balance
    const balanceChange = type === 'credit' ? amount : -amount;
    await accountsContainer.updateOne(
      { id: accountId, userId },
      {
        $inc: { balance: balanceChange },
        $set: { updatedAt: new Date() },
      }
    );

    // Update tag usage counts from all splits
    // Count unique tags across all splits, but increment by 1 per transaction (not per split)
    const allTags = splitRecords.flatMap((split) => split.tags);
    const uniqueTags = [...new Set(allTags)];

    for (const tagName of uniqueTags) {
      // Increment by 1 for this transaction, regardless of how many splits use it
      await tagsContainer.updateOne(
        { userId, name: tagName },
        {
          $inc: { usageCount: 1 },
          $setOnInsert: {
            id: uuidv4(),
            userId,
            name: tagName,
            createdAt: new Date(),
          },
          $set: { updatedAt: new Date() },
        },
        { upsert: true }
      );
    }

    // Decrypt transaction before sending to client
    const decryptedTransaction = decryptTransaction(newTransaction);

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      transaction: {
        ...decryptedTransaction,
        splits: splitRecords,
      },
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating transaction',
    });
  }
});

// PUT /api/transactions/:id - Update a transaction
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const {
      type,
      amount,
      accountId,
      categoryId,
      description,
      tags,
      paymentMethodId,
      date,
      isRecurring,
      recurrencePattern,
      merchantName,
      reviewStatus,
      splits, // Add splits support
    } = req.body;

    const transactionsContainer = await mongoDBService.getTransactionsContainer();
    const accountsContainer = await mongoDBService.getAccountsContainer();
    const tagsContainer = await mongoDBService.getTagsContainer();

    const existingTransaction = (await transactionsContainer.findOne({
      id,
      userId,
    })) as unknown as Transaction;
    if (!existingTransaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
      return;
    }

    // If amount or type or account changed, update balances
    const oldAmount = existingTransaction.amount;
    const oldType = existingTransaction.type;
    const oldAccountId = existingTransaction.accountId;
    const newAmount = amount !== undefined ? amount : oldAmount;
    const newType = type || oldType;
    const newAccountId = accountId || oldAccountId;

    // Reverse old transaction effect on old account
    const oldBalanceChange = oldType === 'credit' ? -oldAmount : oldAmount;
    await accountsContainer.updateOne(
      { id: oldAccountId, userId },
      {
        $inc: { balance: oldBalanceChange },
        $set: { updatedAt: new Date() },
      }
    );

    // Apply new transaction effect on new account
    const newBalanceChange = newType === 'credit' ? newAmount : -newAmount;
    await accountsContainer.updateOne(
      { id: newAccountId, userId },
      {
        $inc: { balance: newBalanceChange },
        $set: { updatedAt: new Date() },
      }
    );

    // Update tag usage counts
    const oldTags = existingTransaction.tags || [];
    const newTags = tags !== undefined ? tags : oldTags;

    // Decrement old tags
    for (const tagName of oldTags) {
      if (!newTags.includes(tagName)) {
        await tagsContainer.updateOne({ userId, name: tagName }, { $inc: { usageCount: -1 } });
      }
    }

    // Increment new tags
    for (const tagName of newTags) {
      if (!oldTags.includes(tagName)) {
        await tagsContainer.updateOne(
          { userId, name: tagName },
          {
            $inc: { usageCount: 1 },
            $set: { updatedAt: new Date() },
          },
          { upsert: true }
        );
      }
    }

    // Encrypt sensitive fields if they're being updated
    const encryptedData = encryptTransaction({
      ...(description && { description }),
      ...(amount !== undefined && { amount }),
    });

    const updateData: Partial<Transaction> = {
      ...(type && { type }),
      ...(amount !== undefined && { amount }),
      ...(accountId && { accountId }),
      ...(categoryId && { categoryId }),
      ...(description && { description: encryptedData.description }),
      ...(tags !== undefined && { tags }),
      ...(paymentMethodId !== undefined && { paymentMethodId }),
      ...(date && { date: new Date(date) }),
      ...(isRecurring !== undefined && { isRecurring }),
      ...(recurrencePattern !== undefined && { recurrencePattern }),
      ...(merchantName !== undefined && { merchantName }),
      ...(reviewStatus && { reviewStatus }),
      updatedAt: new Date(),
    };

    await transactionsContainer.updateOne({ id, userId }, { $set: updateData });

    // Update splits if provided
    if (splits && Array.isArray(splits)) {
      const splitsContainer = await mongoDBService.getTransactionSplitsContainer();

      // Delete old splits
      await splitsContainer.deleteMany({ transactionId: id, userId });

      // Insert new splits
      const newSplits = splits.map((split: any, index: number) => ({
        id: uuidv4(),
        transactionId: id,
        userId: userId,
        categoryId: split.categoryId,
        amount: split.amount,
        tags: split.tags || [],
        notes: split.notes || '',
        order: split.order || index + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      if (newSplits.length > 0) {
        await splitsContainer.insertMany(newSplits);
      }
    }

    const updatedTransaction = await transactionsContainer.findOne({ id, userId });

    // Decrypt before sending to client
    const decryptedTransaction = decryptTransaction(updatedTransaction as unknown as Transaction);

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      transaction: decryptedTransaction,
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating transaction',
    });
  }
});

// DELETE /api/transactions/:id - Delete a transaction
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const transactionsContainer = await mongoDBService.getTransactionsContainer();
    const accountsContainer = await mongoDBService.getAccountsContainer();
    const tagsContainer = await mongoDBService.getTagsContainer();

    const transaction = (await transactionsContainer.findOne({
      id,
      userId,
    })) as unknown as Transaction;
    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
      return;
    }

    // Reverse transaction effect on account balance
    const balanceChange = transaction.type === 'credit' ? -transaction.amount : transaction.amount;
    await accountsContainer.updateOne(
      { id: transaction.accountId, userId },
      {
        $inc: { balance: balanceChange },
        $set: { updatedAt: new Date() },
      }
    );

    // Decrement tag usage counts
    if (transaction.tags && transaction.tags.length > 0) {
      for (const tagName of transaction.tags) {
        await tagsContainer.updateOne({ userId, name: tagName }, { $inc: { usageCount: -1 } });
      }
    }

    await transactionsContainer.deleteOne({ id, userId });

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting transaction',
    });
  }
});

// POST /api/transactions/bulk - Bulk create transactions
router.post('/bulk', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Transactions array is required',
      });
      return;
    }

    const transactionsContainer = await mongoDBService.getTransactionsContainer();
    const accountsContainer = await mongoDBService.getAccountsContainer();
    const tagsContainer = await mongoDBService.getTagsContainer();

    const newTransactions: Transaction[] = [];
    const accountBalanceChanges: { [accountId: string]: number } = {};
    const tagUpdates: { [tagName: string]: number } = {};

    for (const txn of transactions) {
      const newTransaction: Transaction = {
        id: uuidv4(),
        userId,
        type: txn.type,
        amount: txn.amount,
        accountId: txn.accountId,
        categoryId: txn.categoryId,
        description: txn.description,
        tags: txn.tags || [],
        date: txn.date ? new Date(txn.date) : new Date(),
        isRecurring: txn.isRecurring || false,
        recurrencePattern: txn.recurrencePattern,
        source: txn.source || 'manual',
        merchantName: txn.merchantName,
        reviewStatus: txn.reviewStatus || 'approved',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      newTransactions.push(newTransaction);

      // Track balance changes
      const balanceChange =
        newTransaction.type === 'credit' ? newTransaction.amount : -newTransaction.amount;
      accountBalanceChanges[newTransaction.accountId] =
        (accountBalanceChanges[newTransaction.accountId] || 0) + balanceChange;

      // Track tag usage
      if (newTransaction.tags) {
        for (const tag of newTransaction.tags) {
          tagUpdates[tag] = (tagUpdates[tag] || 0) + 1;
        }
      }
    }

    // Insert all transactions
    await transactionsContainer.insertMany(newTransactions);

    // Update account balances
    for (const [accountId, change] of Object.entries(accountBalanceChanges)) {
      await accountsContainer.updateOne(
        { id: accountId, userId },
        {
          $inc: { balance: change },
          $set: { updatedAt: new Date() },
        }
      );
    }

    // Update tag usage counts
    for (const [tagName, count] of Object.entries(tagUpdates)) {
      await tagsContainer.updateOne(
        { userId, name: tagName },
        {
          $inc: { usageCount: count },
          $set: { updatedAt: new Date() },
        },
        { upsert: true }
      );
    }

    res.status(201).json({
      success: true,
      message: `${newTransactions.length} transactions created successfully`,
      transactions: newTransactions,
    });
  } catch (error) {
    console.error('Error bulk creating transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk creating transactions',
    });
  }
});

// DELETE /api/transactions/bulk - Bulk delete transactions
router.delete('/bulk', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Transaction IDs array is required',
      });
      return;
    }

    const transactionsContainer = await mongoDBService.getTransactionsContainer();
    const accountsContainer = await mongoDBService.getAccountsContainer();
    const tagsContainer = await mongoDBService.getTagsContainer();
    const splitsContainer = await mongoDBService.getTransactionSplitsContainer();

    // Get all transactions to delete
    const transactions = (await transactionsContainer
      .find({ id: { $in: ids }, userId })
      .toArray()) as unknown as Transaction[];

    if (transactions.length === 0) {
      res.status(404).json({
        success: false,
        message: 'No transactions found',
      });
      return;
    }

    // Get splits for these transactions to update tag counts
    const splits = await splitsContainer.find({ transactionId: { $in: ids }, userId }).toArray();

    const accountBalanceChanges: { [accountId: string]: number } = {};
    const transactionTagsMap: { [transactionId: string]: Set<string> } = {};

    // Calculate reverse changes and collect tags per transaction
    for (const txn of transactions) {
      const balanceChange = txn.type === 'credit' ? -txn.amount : txn.amount;
      accountBalanceChanges[txn.accountId] =
        (accountBalanceChanges[txn.accountId] || 0) + balanceChange;
    }

    // Collect unique tags per transaction from splits
    for (const split of splits) {
      const txId = split.transactionId as string;
      if (!transactionTagsMap[txId]) {
        transactionTagsMap[txId] = new Set();
      }
      if (split.tags) {
        split.tags.forEach((tag: string) => transactionTagsMap[txId].add(tag));
      }
    }

    // Count how many transactions use each tag
    const tagUpdates: { [tagName: string]: number } = {};
    for (const tagSet of Object.values(transactionTagsMap)) {
      for (const tag of tagSet) {
        tagUpdates[tag] = (tagUpdates[tag] || 0) - 1; // Decrement by 1 per transaction
      }
    }

    // Delete splits first
    await splitsContainer.deleteMany({ transactionId: { $in: ids }, userId });

    // Delete transactions
    await transactionsContainer.deleteMany({ id: { $in: ids }, userId });

    // Update account balances
    for (const [accountId, change] of Object.entries(accountBalanceChanges)) {
      await accountsContainer.updateOne(
        { id: accountId, userId },
        {
          $inc: { balance: change },
          $set: { updatedAt: new Date() },
        }
      );
    }

    // Update tag usage counts
    for (const [tagName, count] of Object.entries(tagUpdates)) {
      await tagsContainer.updateOne({ userId, name: tagName }, { $inc: { usageCount: count } });
    }

    res.json({
      success: true,
      message: `${transactions.length} transactions deleted successfully`,
    });
  } catch (error) {
    console.error('Error bulk deleting transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk deleting transactions',
    });
  }
});

// GET /api/transactions/pending/count - Get count of pending transactions
router.get('/pending/count', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const transactionsContainer = await mongoDBService.getTransactionsContainer();

    const count = await transactionsContainer.countDocuments({
      userId,
      reviewStatus: 'pending',
    });

    res.json({ count });
  } catch (error) {
    console.error('Error getting pending count:', error);
    res.status(500).json({ error: 'Error getting pending count' });
  }
});

// PATCH /api/transactions/:id/approve - Approve a pending transaction
router.patch('/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const transactionsContainer = await mongoDBService.getTransactionsContainer();

    // Find the transaction
    const existingTransaction = (await transactionsContainer.findOne({
      id,
      userId,
    })) as unknown as Transaction | null;

    if (!existingTransaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    if (existingTransaction.reviewStatus !== 'pending') {
      res.status(400).json({ error: 'Transaction is not pending review' });
      return;
    }

    // Update review status
    await transactionsContainer.updateOne(
      { id, userId },
      {
        $set: {
          reviewStatus: 'approved',
          reviewedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    const updatedTransaction = (await transactionsContainer.findOne({
      id,
      userId,
    })) as unknown as Transaction;

    // Learn from approval: Save merchant → category/account mapping
    if (updatedTransaction.merchantName && updatedTransaction.accountId) {
      // Get the category from the first split or legacy categoryId
      const splitsContainer = await mongoDBService.getTransactionSplitsContainer();
      const splits = (await splitsContainer
        .find({ transactionId: id })
        .toArray()) as unknown as TransactionSplit[];

      const categoryId = splits.length > 0 ? splits[0].categoryId : updatedTransaction.categoryId;

      if (categoryId) {
        await learnFromTransaction(
          userId,
          updatedTransaction.merchantName,
          categoryId,
          updatedTransaction.accountId
        );
      }
    }

    res.json(decryptTransaction(updatedTransaction));
  } catch (error) {
    console.error('Error approving transaction:', error);
    res.status(500).json({ error: 'Error approving transaction' });
  }
});

// PATCH /api/transactions/:id/reject - Reject a pending transaction
router.patch('/:id/reject', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { reason } = req.body;
    const transactionsContainer = await mongoDBService.getTransactionsContainer();

    // Find the transaction
    const existingTransaction = (await transactionsContainer.findOne({
      id,
      userId,
    })) as unknown as Transaction | null;

    if (!existingTransaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    if (existingTransaction.reviewStatus !== 'pending') {
      res.status(400).json({ error: 'Transaction is not pending review' });
      return;
    }

    // Update review status
    await transactionsContainer.updateOne(
      { id, userId },
      {
        $set: {
          reviewStatus: 'rejected',
          reviewedAt: new Date(),
          rejectionReason: reason || 'Rejected by user',
          updatedAt: new Date(),
        },
      }
    );

    const updatedTransaction = (await transactionsContainer.findOne({
      id,
      userId,
    })) as unknown as Transaction;

    res.json(decryptTransaction(updatedTransaction));
  } catch (error) {
    console.error('Error rejecting transaction:', error);
    res.status(500).json({ error: 'Error rejecting transaction' });
  }
});

// PATCH /api/transactions/:id/status - Change transaction review status (flexible endpoint)
router.patch('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { status, reason } = req.body;
    const transactionsContainer = await mongoDBService.getTransactionsContainer();

    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be: pending, approved, or rejected' });
      return;
    }

    // Find the transaction
    const existingTransaction = (await transactionsContainer.findOne({
      id,
      userId,
    })) as unknown as Transaction | null;

    if (!existingTransaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    // Build update object
    const updateFields: any = {
      reviewStatus: status,
      updatedAt: new Date(),
    };

    // Set reviewedAt timestamp when moving to approved/rejected
    if (status === 'approved' || status === 'rejected') {
      updateFields.reviewedAt = new Date();
    }

    // Add rejection reason if provided
    if (status === 'rejected' && reason) {
      updateFields.rejectionReason = reason;
    }

    // Clear rejection reason if moving away from rejected
    if (status !== 'rejected' && existingTransaction.reviewStatus === 'rejected') {
      updateFields.rejectionReason = null;
    }

    // Update transaction status
    await transactionsContainer.updateOne({ id, userId }, { $set: updateFields });

    const updatedTransaction = (await transactionsContainer.findOne({
      id,
      userId,
    })) as unknown as Transaction;

    // Learn from approval: Save merchant → category/account mapping
    if (status === 'approved' && updatedTransaction.merchantName && updatedTransaction.accountId) {
      // Get the category from the first split or legacy categoryId
      const splitsContainer = await mongoDBService.getTransactionSplitsContainer();
      const splits = (await splitsContainer
        .find({ transactionId: id })
        .toArray()) as unknown as TransactionSplit[];

      const categoryId = splits.length > 0 ? splits[0].categoryId : updatedTransaction.categoryId;

      if (categoryId) {
        await learnFromTransaction(
          userId,
          updatedTransaction.merchantName,
          categoryId,
          updatedTransaction.accountId
        );
      }
    }

    res.json(decryptTransaction(updatedTransaction));
  } catch (error) {
    console.error('Error updating transaction status:', error);
    res.status(500).json({ error: 'Error updating transaction status' });
  }
});

// POST /api/transactions/bulk-approve - Approve multiple transactions
router.post('/bulk-approve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { transactionIds }: { transactionIds: string[] } = req.body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      res.status(400).json({ error: 'transactionIds array is required' });
      return;
    }

    const transactionsContainer = await mongoDBService.getTransactionsContainer();

    // Update all transactions
    const result = await transactionsContainer.updateMany(
      {
        id: { $in: transactionIds },
        userId,
        reviewStatus: 'pending',
      },
      {
        $set: {
          reviewStatus: 'approved',
          reviewedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} transactions approved`,
      approvedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error bulk approving transactions:', error);
    res.status(500).json({ error: 'Error bulk approving transactions' });
  }
});

// POST /api/transactions/bulk-reject - Reject multiple transactions
router.post('/bulk-reject', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { transactionIds, reason }: { transactionIds: string[]; reason?: string } = req.body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      res.status(400).json({ error: 'transactionIds array is required' });
      return;
    }

    const transactionsContainer = await mongoDBService.getTransactionsContainer();

    // Update all transactions
    const result = await transactionsContainer.updateMany(
      {
        id: { $in: transactionIds },
        userId,
        reviewStatus: 'pending',
      },
      {
        $set: {
          reviewStatus: 'rejected',
          reviewedAt: new Date(),
          rejectionReason: reason || 'Bulk rejected by user',
          updatedAt: new Date(),
        },
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} transactions rejected`,
      rejectedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error bulk rejecting transactions:', error);
    res.status(500).json({ error: 'Error bulk rejecting transactions' });
  }
});

// POST /api/transactions/transfer - Create a transfer between accounts
router.post('/transfer', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { fromAccountId, toAccountId, amount, date, notes } = req.body;

    // Validation
    if (!fromAccountId || !toAccountId || !amount) {
      res.status(400).json({
        success: false,
        message: 'fromAccountId, toAccountId, and amount are required',
      });
      return;
    }

    if (fromAccountId === toAccountId) {
      res.status(400).json({
        success: false,
        message: 'Cannot transfer to the same account',
      });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({
        success: false,
        message: 'Amount must be positive',
      });
      return;
    }

    const transactionsContainer = await mongoDBService.getTransactionsContainer();
    const splitsContainer = await mongoDBService.getTransactionSplitsContainer();
    const accountsContainer = await mongoDBService.getAccountsContainer();
    const categoriesContainer = await mongoDBService.getCategoriesContainer();

    // Verify both accounts exist
    const fromAccount = await accountsContainer.findOne({ id: fromAccountId, userId });
    const toAccount = await accountsContainer.findOne({ id: toAccountId, userId });

    if (!fromAccount) {
      res.status(404).json({
        success: false,
        message: 'Source account not found',
      });
      return;
    }

    if (!toAccount) {
      res.status(404).json({
        success: false,
        message: 'Destination account not found',
      });
      return;
    }

    // Get or create "Transfer" category
    let transferCategory = await categoriesContainer.findOne({
      userId,
      name: 'Transfer',
    });

    if (!transferCategory) {
      const categoryId = uuidv4();
      const newCategory = {
        id: categoryId,
        userId,
        name: 'Transfer',
        type: 'both' as 'income' | 'expense' | 'both',
        color: '#2196f3',
        icon: 'swap_horiz',
        description: 'Money transfers between accounts',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await categoriesContainer.insertOne(newCategory);
      transferCategory = await categoriesContainer.findOne({ id: categoryId });
    }

    if (!transferCategory) {
      res.status(500).json({
        success: false,
        message: 'Failed to create or find Transfer category',
      });
      return;
    }

    const transferId = uuidv4(); // Link both transactions
    const transferDate = date ? new Date(date) : new Date();
    const description = `Transfer: ${fromAccount.name} → ${toAccount.name}`;

    // Encrypt description
    const encryptedDescription = encryptTransaction({ description }).description || description;

    // Create debit transaction (money OUT of source account)
    const debitTransactionId = uuidv4();
    const debitTransaction: Transaction = {
      id: debitTransactionId,
      userId,
      type: 'debit',
      amount,
      accountId: fromAccountId,
      description: encryptedDescription,
      date: transferDate,
      isRecurring: false,
      source: 'transfer',
      reviewStatus: 'approved',
      linkedTransactionId: transferId, // Link to credit transaction
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const debitSplit: TransactionSplit = {
      id: uuidv4(),
      transactionId: debitTransactionId,
      userId,
      categoryId: transferCategory.id,
      amount,
      tags: ['transfer'],
      notes: notes || `Transfer to ${toAccount.name}`,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create credit transaction (money INTO destination account)
    const creditTransactionId = uuidv4();
    const creditTransaction: Transaction = {
      id: creditTransactionId,
      userId,
      type: 'credit',
      amount,
      accountId: toAccountId,
      description: encryptedDescription,
      date: transferDate,
      isRecurring: false,
      source: 'transfer',
      reviewStatus: 'approved',
      linkedTransactionId: transferId, // Link to debit transaction
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const creditSplit: TransactionSplit = {
      id: uuidv4(),
      transactionId: creditTransactionId,
      userId,
      categoryId: transferCategory.id,
      amount,
      tags: ['transfer'],
      notes: notes || `Transfer from ${fromAccount.name}`,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert both transactions and splits
    await transactionsContainer.insertMany([debitTransaction, creditTransaction]);
    await splitsContainer.insertMany([debitSplit, creditSplit]);

    // Update account balances
    await accountsContainer.updateOne(
      { id: fromAccountId, userId },
      {
        $inc: { balance: -amount },
        $set: { updatedAt: new Date() },
      }
    );

    await accountsContainer.updateOne(
      { id: toAccountId, userId },
      {
        $inc: { balance: amount },
        $set: { updatedAt: new Date() },
      }
    );

    // Decrypt transactions before sending to client
    const decryptedDebitTxn = decryptTransaction(debitTransaction);
    const decryptedCreditTxn = decryptTransaction(creditTransaction);

    res.status(201).json({
      success: true,
      message: 'Transfer created successfully',
      transfer: {
        id: transferId,
        fromAccountId,
        toAccountId,
        amount,
        date: transferDate,
        debitTransaction: {
          ...decryptedDebitTxn,
          splits: [debitSplit],
        },
        creditTransaction: {
          ...decryptedCreditTxn,
          splits: [creditSplit],
        },
      },
    });
  } catch (error) {
    console.error('Error creating transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating transfer',
    });
  }
});

export default router;
