import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cosmosDBService } from '../config/cosmosdb';
import { Account } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.use(authenticate);

// GET /api/accounts - Get all accounts for a user
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    
    const accountsContainer = await cosmosDBService.getAccountsContainer();
    const accounts = (await accountsContainer
      .find({ userId })
      .toArray()) as unknown as Account[];

    // Sort in memory to avoid composite index requirement
    accounts.sort((a, b) => {
      if (a.isDefault !== b.isDefault) {
        return b.isDefault ? 1 : -1; // isDefault accounts first
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    res.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching accounts'
    });
  }
});

// POST /api/accounts - Create a new account
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { name, type, bankName, accountNumber, currency, initialBalance, icon, color, isDefault, notes } = req.body;

    if (!name || !type || !currency) {
      res.status(400).json({
        success: false,
        message: 'Name, type, and currency are required'
      });
      return;
    }

    const accountsContainer = await cosmosDBService.getAccountsContainer();

    // If this is set as default, unset other defaults
    if (isDefault) {
      await accountsContainer.updateMany(
        { userId, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const newAccount: Account = {
      id: uuidv4(),
      userId,
      name,
      type,
      bankName,
      accountNumber,
      currency,
      balance: initialBalance || 0,
      initialBalance: initialBalance || 0,
      icon,
      color,
      isDefault: isDefault || false,
      isActive: true,
      notes,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await accountsContainer.insertOne(newAccount);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      account: newAccount
    });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating account'
    });
  }
});

// PUT /api/accounts/:id - Update an account
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { name, type, bankName, accountNumber, icon, color, isDefault, isActive, notes } = req.body;

    const accountsContainer = await cosmosDBService.getAccountsContainer();

    const account = await accountsContainer.findOne({ id, userId });
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found'
      });
      return;
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await accountsContainer.updateMany(
        { userId, isDefault: true, id: { $ne: id } },
        { $set: { isDefault: false } }
      );
    }

    const updateData: Partial<Account> = {
      ...(name && { name }),
      ...(type && { type }),
      ...(bankName !== undefined && { bankName }),
      ...(accountNumber !== undefined && { accountNumber }),
      ...(icon !== undefined && { icon }),
      ...(color !== undefined && { color }),
      ...(isDefault !== undefined && { isDefault }),
      ...(isActive !== undefined && { isActive }),
      ...(notes !== undefined && { notes }),
      updatedAt: new Date()
    };

    await accountsContainer.updateOne(
      { id, userId },
      { $set: updateData }
    );

    const updatedAccount = await accountsContainer.findOne({ id, userId });

    res.json({
      success: true,
      message: 'Account updated successfully',
      account: updatedAccount
    });
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating account'
    });
  }
});

// DELETE /api/accounts/:id - Delete an account
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const accountsContainer = await cosmosDBService.getAccountsContainer();
    const transactionsContainer = await cosmosDBService.getTransactionsContainer();

    const account = await accountsContainer.findOne({ id, userId });
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found'
      });
      return;
    }

    // Check if account has transactions
    const transactionCount = await transactionsContainer.countDocuments({ accountId: id });
    if (transactionCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete account with ${transactionCount} transaction(s). Please delete or reassign transactions first.`
      });
      return;
    }

    await accountsContainer.deleteOne({ id, userId });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting account'
    });
  }
});

// GET /api/accounts/:id/balance - Get account balance with transaction summary
router.get('/:id/balance', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const accountsContainer = await cosmosDBService.getAccountsContainer();
    const transactionsContainer = await cosmosDBService.getTransactionsContainer();

    const account = await accountsContainer.findOne({ id, userId }) as unknown as Account;
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found'
      });
      return;
    }

    // Get approved transactions
    const transactions = await transactionsContainer
      .find({ accountId: id, reviewStatus: 'approved' })
      .toArray();

    const credits = transactions
      .filter((t: any) => t.type === 'credit')
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const debits = transactions
      .filter((t: any) => t.type === 'debit')
      .reduce((sum: number, t: any) => sum + t.amount, 0);

    const calculatedBalance = (account.initialBalance || 0) + credits - debits;

    res.json({
      success: true,
      balance: {
        currentBalance: account.balance,
        calculatedBalance,
        initialBalance: account.initialBalance || 0,
        totalCredits: credits,
        totalDebits: debits,
        transactionCount: transactions.length
      }
    });
  } catch (error) {
    console.error('Error fetching account balance:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching account balance'
    });
  }
});

export default router;
