import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cosmosDBService } from '../config/cosmosdb';
import { Transaction } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

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
      sortOrder = 'desc'
    } = req.query;

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    
    // Build filter
    let filter: any = { userId };
    
    if (accountId) filter.accountId = accountId;
    if (categoryId) filter.categoryId = categoryId;
    if (type) filter.type = type;
    if (tags) {
      const tagArray = (tags as string).split(',');
      filter.tags = { $in: tagArray };
    }
    if (reviewStatus) filter.reviewStatus = reviewStatus;
    
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate as string);
      if (endDate) filter.date.$lte = new Date(endDate as string);
    }

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const transactions = (await transactionsContainer
      .find(filter)
      .sort(sort)
      .skip(parseInt(skip as string))
      .limit(parseInt(limit as string))
      .toArray()) as unknown as Transaction[];

    const total = await transactionsContainer.countDocuments(filter);

    res.json({
      success: true,
      transactions,
      pagination: {
        total,
        limit: parseInt(limit as string),
        skip: parseInt(skip as string),
        hasMore: total > parseInt(skip as string) + parseInt(limit as string)
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions'
    });
  }
});

// GET /api/transactions/:id - Get single transaction
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    const transaction = await transactionsContainer.findOne({ id, userId });

    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
      return;
    }

    res.json({
      success: true,
      transaction
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction'
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
      categoryId,
      description,
      tags,
      date,
      notes,
      isRecurring,
      recurrencePattern,
      source,
      merchantName,
      reviewStatus
    } = req.body;

    // Validation
    if (!type || !amount || !accountId || !categoryId || !description) {
      res.status(400).json({
        success: false,
        message: 'Type, amount, accountId, categoryId, and description are required'
      });
      return;
    }

    if (type !== 'credit' && type !== 'debit') {
      res.status(400).json({
        success: false,
        message: 'Type must be either "credit" or "debit"'
      });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({
        success: false,
        message: 'Amount must be positive'
      });
      return;
    }

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    const accountsContainer = await cosmosDBService.getAccountsContainer();
    const tagsContainer = await cosmosDBService.getTagsContainer();

    // Verify account exists
    const account = await accountsContainer.findOne({ id: accountId, userId });
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found'
      });
      return;
    }

    const newTransaction: Transaction = {
      id: uuidv4(),
      userId,
      type,
      amount,
      accountId,
      categoryId,
      description,
      tags: tags || [],
      date: date ? new Date(date) : new Date(),
      notes,
      isRecurring: isRecurring || false,
      recurrencePattern,
      source: source || 'manual',
      merchantName,
      reviewStatus: reviewStatus || 'approved',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await transactionsContainer.insertOne(newTransaction);

    // Update account balance
    const balanceChange = type === 'credit' ? amount : -amount;
    await accountsContainer.updateOne(
      { id: accountId, userId },
      { 
        $inc: { balance: balanceChange },
        $set: { updatedAt: new Date() }
      }
    );

    // Update tag usage counts
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        await tagsContainer.updateOne(
          { userId, name: tagName },
          { 
            $inc: { usageCount: 1 },
            $set: { updatedAt: new Date() }
          },
          { upsert: true }
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      transaction: newTransaction
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating transaction'
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
      reviewStatus
    } = req.body;

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    const accountsContainer = await cosmosDBService.getAccountsContainer();
    const tagsContainer = await cosmosDBService.getTagsContainer();

    const existingTransaction = await transactionsContainer.findOne({ id, userId }) as unknown as Transaction;
    if (!existingTransaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found'
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
        $set: { updatedAt: new Date() }
      }
    );

    // Apply new transaction effect on new account
    const newBalanceChange = newType === 'credit' ? newAmount : -newAmount;
    await accountsContainer.updateOne(
      { id: newAccountId, userId },
      { 
        $inc: { balance: newBalanceChange },
        $set: { updatedAt: new Date() }
      }
    );

    // Update tag usage counts
    const oldTags = existingTransaction.tags || [];
    const newTags = tags !== undefined ? tags : oldTags;

    // Decrement old tags
    for (const tagName of oldTags) {
      if (!newTags.includes(tagName)) {
        await tagsContainer.updateOne(
          { userId, name: tagName },
          { $inc: { usageCount: -1 } }
        );
      }
    }

    // Increment new tags
    for (const tagName of newTags) {
      if (!oldTags.includes(tagName)) {
        await tagsContainer.updateOne(
          { userId, name: tagName },
          { 
            $inc: { usageCount: 1 },
            $set: { updatedAt: new Date() }
          },
          { upsert: true }
        );
      }
    }

    const updateData: Partial<Transaction> = {
      ...(type && { type }),
      ...(amount !== undefined && { amount }),
      ...(accountId && { accountId }),
      ...(categoryId && { categoryId }),
      ...(description && { description }),
      ...(tags !== undefined && { tags }),
      ...(paymentMethodId !== undefined && { paymentMethodId }),
      ...(date && { date: new Date(date) }),
      ...(notes !== undefined && { notes }),
      ...(isRecurring !== undefined && { isRecurring }),
      ...(recurrencePattern !== undefined && { recurrencePattern }),
      ...(merchantName !== undefined && { merchantName }),
      ...(reviewStatus && { reviewStatus }),
      updatedAt: new Date()
    };

    await transactionsContainer.updateOne(
      { id, userId },
      { $set: updateData }
    );

    const updatedTransaction = await transactionsContainer.findOne({ id, userId });

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      transaction: updatedTransaction
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating transaction'
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

    const transaction = await transactionsContainer.findOne({ id, userId }) as unknown as Transaction;
    if (!transaction) {
      res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
      return;
    }

    // Reverse transaction effect on account balance
    const balanceChange = transaction.type === 'credit' ? -transaction.amount : transaction.amount;
    await accountsContainer.updateOne(
      { id: transaction.accountId, userId },
      { 
        $inc: { balance: balanceChange },
        $set: { updatedAt: new Date() }
      }
    );

    // Decrement tag usage counts
    if (transaction.tags && transaction.tags.length > 0) {
      for (const tagName of transaction.tags) {
        await tagsContainer.updateOne(
          { userId, name: tagName },
          { $inc: { usageCount: -1 } }
        );
      }
    }

    await transactionsContainer.deleteOne({ id, userId });

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting transaction'
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
        message: 'Transactions array is required'
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
        updatedAt: new Date()
      };

      newTransactions.push(newTransaction);

      // Track balance changes
      const balanceChange = newTransaction.type === 'credit' ? newTransaction.amount : -newTransaction.amount;
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
          $set: { updatedAt: new Date() }
        }
      );
    }

    // Update tag usage counts
    for (const [tagName, count] of Object.entries(tagUpdates)) {
      await tagsContainer.updateOne(
        { userId, name: tagName },
        { 
          $inc: { usageCount: count },
          $set: { updatedAt: new Date() }
        },
        { upsert: true }
      );
    }

    res.status(201).json({
      success: true,
      message: `${newTransactions.length} transactions created successfully`,
      transactions: newTransactions
    });
  } catch (error) {
    console.error('Error bulk creating transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk creating transactions'
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
        message: 'Transaction IDs array is required'
      });
      return;
    }

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    const accountsContainer = await cosmosDBService.getAccountsContainer();
    const tagsContainer = await cosmosDBService.getTagsContainer();

    // Get all transactions to delete
    const transactions = await transactionsContainer
      .find({ id: { $in: ids }, userId })
      .toArray() as unknown as Transaction[];

    if (transactions.length === 0) {
      res.status(404).json({
        success: false,
        message: 'No transactions found'
      });
      return;
    }

    const accountBalanceChanges: { [accountId: string]: number } = {};
    const tagUpdates: { [tagName: string]: number } = {};

    // Calculate reverse changes
    for (const txn of transactions) {
      const balanceChange = txn.type === 'credit' ? -txn.amount : txn.amount;
      accountBalanceChanges[txn.accountId] = (accountBalanceChanges[txn.accountId] || 0) + balanceChange;

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
          $set: { updatedAt: new Date() }
        }
      );
    }

    // Update tag usage counts
    for (const [tagName, count] of Object.entries(tagUpdates)) {
      await tagsContainer.updateOne(
        { userId, name: tagName },
        { $inc: { usageCount: count } }
      );
    }

    res.json({
      success: true,
      message: `${transactions.length} transactions deleted successfully`
    });
  } catch (error) {
    console.error('Error bulk deleting transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk deleting transactions'
    });
  }
});

export default router;
