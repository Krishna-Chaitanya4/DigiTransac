import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cosmosDBService } from '../config/cosmosdb';
import { Transaction, TransactionSplit, MongoFilter } from '../models/types';
import { v4 as uuidv4 } from 'uuid';
import {
  encryptTransaction,
  decryptTransaction,
  decryptTransactions,
} from '../utils/transactionEncryption';

const router = Router();

router.use(authenticate);

// GET /api/transactions - Get all transactions with filtering
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const {
      accountId,
      categoryId,
      type,
      tags,
      startDate,
      endDate,
      reviewStatus,
      limit = '100',
      skip = '0',
      sortBy = 'date',
      sortOrder = 'desc',
      includeSplits = 'true', // Option to include splits
    } = req.query;

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    const splitsContainer = await cosmosDBService.getTransactionSplitsContainer();

    // Build filter
    const filter: MongoFilter<Transaction> = { userId };

    if (accountId) filter.accountId = accountId;
    // Note: categoryId and tags filtering now needs to look at splits
    // For backwards compatibility, also check transaction.categoryId
    if (type) filter.type = type;
    if (reviewStatus) filter.reviewStatus = reviewStatus;

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate as string);
      if (endDate) filter.date.$lte = new Date(endDate as string);
    }

    // Fetch all matching transactions (we'll sort in-memory to avoid Cosmos DB index issues)
    let transactions = (await transactionsContainer
      .find(filter)
      .toArray()) as unknown as Transaction[];

    // Sort in-memory
    const sortField = sortBy as string;
    const sortDirection = sortOrder === 'desc' ? -1 : 1;
    transactions.sort((a: any, b: any) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal < bVal) return -sortDirection;
      if (aVal > bVal) return sortDirection;
      return 0;
    });

    // Apply pagination after sorting
    const skipNum = parseInt(skip as string);
    const limitNum = parseInt(limit as string);
    transactions = transactions.slice(skipNum, skipNum + limitNum);

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
          acc[split.transactionId].push(split);
          return acc;
        },
        {} as Record<string, TransactionSplit[]>
      );

      // Attach splits to transactions
      transactions = transactions.map((txn) => ({
        ...txn,
        splits: splitsByTransaction[txn.id] || [],
      })) as any;
    }

    // Apply category and tag filtering AFTER fetching splits (if needed)
    if (categoryId || tags) {
      transactions = transactions.filter((txn: any) => {
        const txnSplits = txn.splits || [];

        if (categoryId) {
          // Check if any split has this category (or check backwards compat categoryId)
          const hasCategory =
            txnSplits.some((s: TransactionSplit) => s.categoryId === categoryId) ||
            txn.categoryId === categoryId;
          if (!hasCategory) return false;
        }

        if (tags) {
          const tagArray = (tags as string).split(',');
          // Check if any split has any of these tags (or check backwards compat tags)
          const hasTags =
            txnSplits.some((s: TransactionSplit) => s.tags.some((t) => tagArray.includes(t))) ||
            (txn.tags && txn.tags.some((t: string) => tagArray.includes(t)));
          if (!hasTags) return false;
        }

        return true;
      });
    }

    const total = await transactionsContainer.countDocuments(filter);

    // Decrypt transactions before sending to client
    const decryptedTransactions = decryptTransactions(transactions);

    res.json({
      success: true,
      transactions: decryptedTransactions,
      pagination: {
        total,
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        hasMore: total > parseInt(skip as string) + parseInt(limit as string),
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

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    const splitsContainer = await cosmosDBService.getTransactionSplitsContainer();

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
      notes,
      isRecurring,
      recurrencePattern,
      source,
      merchantName,
      reviewStatus,
      // Future fields (optional, for forward compatibility)
      organizationId,
      paidBy,
      sharedWith,
      paymentMethodType,
      upiTransactionId,
      paymentStatus,
      counterpartyUserId,
      settlementStatus,
      settlementProof,
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

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    const splitsContainer = await cosmosDBService.getTransactionSplitsContainer();
    const accountsContainer = await cosmosDBService.getAccountsContainer();
    const tagsContainer = await cosmosDBService.getTagsContainer();

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
      notes,
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
      notes: encryptedData.notes,
      isRecurring: isRecurring || false,
      recurrencePattern,
      source: source || 'manual',
      merchantName,
      reviewStatus: reviewStatus || 'approved',
      // Future fields (optional, store if provided)
      ...(organizationId && { organizationId }),
      ...(paidBy && { paidBy }),
      ...(sharedWith && { sharedWith }),
      ...(paymentMethodType && { paymentMethodType }),
      ...(upiTransactionId && { upiTransactionId }),
      ...(paymentStatus && { paymentStatus }),
      ...(counterpartyUserId && { counterpartyUserId }),
      ...(settlementStatus && { settlementStatus }),
      ...(settlementProof && { settlementProof }),
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
    const allTags = splitRecords.flatMap((split) => split.tags);
    const uniqueTags = [...new Set(allTags)];

    for (const tagName of uniqueTags) {
      const count = allTags.filter((t) => t === tagName).length;
      await tagsContainer.updateOne(
        { userId, name: tagName },
        {
          $inc: { usageCount: count },
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
      notes,
      isRecurring,
      recurrencePattern,
      merchantName,
      reviewStatus,
    } = req.body;

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    const accountsContainer = await cosmosDBService.getAccountsContainer();
    const tagsContainer = await cosmosDBService.getTagsContainer();

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
      ...(notes !== undefined && { notes }),
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
      ...(notes !== undefined && { notes: encryptedData.notes }),
      ...(isRecurring !== undefined && { isRecurring }),
      ...(recurrencePattern !== undefined && { recurrencePattern }),
      ...(merchantName !== undefined && { merchantName }),
      ...(reviewStatus && { reviewStatus }),
      updatedAt: new Date(),
    };

    await transactionsContainer.updateOne({ id, userId }, { $set: updateData });

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

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    const accountsContainer = await cosmosDBService.getAccountsContainer();
    const tagsContainer = await cosmosDBService.getTagsContainer();

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

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    const accountsContainer = await cosmosDBService.getAccountsContainer();
    const tagsContainer = await cosmosDBService.getTagsContainer();

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
        notes: txn.notes,
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

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    const accountsContainer = await cosmosDBService.getAccountsContainer();
    const tagsContainer = await cosmosDBService.getTagsContainer();

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

    const accountBalanceChanges: { [accountId: string]: number } = {};
    const tagUpdates: { [tagName: string]: number } = {};

    // Calculate reverse changes
    for (const txn of transactions) {
      const balanceChange = txn.type === 'credit' ? -txn.amount : txn.amount;
      accountBalanceChanges[txn.accountId] =
        (accountBalanceChanges[txn.accountId] || 0) + balanceChange;

      if (txn.tags) {
        for (const tag of txn.tags) {
          tagUpdates[tag] = (tagUpdates[tag] || 0) - 1;
        }
      }
    }

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
    const transactionsContainer = await cosmosDBService.getTransactionsContainer();

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
    const transactionsContainer = await cosmosDBService.getTransactionsContainer();

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
    const transactionsContainer = await cosmosDBService.getTransactionsContainer();

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

// POST /api/transactions/bulk-approve - Approve multiple transactions
router.post('/bulk-approve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { transactionIds }: { transactionIds: string[] } = req.body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      res.status(400).json({ error: 'transactionIds array is required' });
      return;
    }

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();

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

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();

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

export default router;
