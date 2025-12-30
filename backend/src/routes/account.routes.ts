import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { mongoDBService } from '../config/mongodb';
import { Account } from '../models/types';
import { buildApprovedTransactionsFilter } from '../utils/transactionFilters';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';
import { DbHelper } from '../utils/dbHelpers';

const router = Router();

router.use(authenticate);

// GET /api/accounts - Get all accounts for a user
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    const accountsContainer = await mongoDBService.getAccountsContainer();
    const accounts = await DbHelper.findAllByUser<Account>(accountsContainer, userId);

    // Sort in memory to avoid composite index requirement
    accounts.sort((a, b) => {
      if (a.isDefault !== b.isDefault) {
        return b.isDefault ? 1 : -1; // isDefault accounts first
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    logger.info({ userId, count: accounts.length }, 'Accounts fetched successfully');
    ApiResponse.success(res, { accounts });
  })
);

// POST /api/accounts - Create a new account
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const {
      name,
      type,
      bankName,
      accountNumber,
      currency,
      initialBalance,
      icon,
      color,
      isDefault,
      notes,
    } = req.body;

    if (!name || !type || !currency) {
      return ApiResponse.badRequest(res, 'Name, type, and currency are required');
    }

    const accountsContainer = await mongoDBService.getAccountsContainer();

    // If this is set as default, unset other defaults
    if (isDefault) {
      await accountsContainer.updateMany(
        { userId, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const newAccount = await DbHelper.createDocument<Account>(accountsContainer, {
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
    });

    logger.info({ userId, accountId: newAccount.id }, 'Account created successfully');
    ApiResponse.created(res, { account: newAccount }, 'Account created successfully');
  })
);

// PUT /api/accounts/:id - Update an account
router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;
    const { name, type, bankName, accountNumber, icon, color, isDefault, isActive, notes } =
      req.body;

    const accountsContainer = await mongoDBService.getAccountsContainer();

    const account = await DbHelper.findByIdAndUser<Account>(accountsContainer, id, userId);
    if (!account) {
      return ApiResponse.notFound(res, 'Account not found');
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
    };

    await DbHelper.updateByIdAndUser(accountsContainer, id, userId, updateData);

    const updatedAccount = await DbHelper.findByIdAndUser<Account>(accountsContainer, id, userId);

    logger.info({ userId, accountId: id }, 'Account updated successfully');
    ApiResponse.success(res, { account: updatedAccount }, 'Account updated successfully');
  })
);

// DELETE /api/accounts/:id - Delete an account
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;

    const accountsContainer = await mongoDBService.getAccountsContainer();
    const transactionsContainer = await mongoDBService.getTransactionsContainer();

    const account = await DbHelper.findByIdAndUser<Account>(accountsContainer, id, userId);
    if (!account) {
      return ApiResponse.notFound(res, 'Account not found');
    }

    // Check if account has transactions
    const transactionCount = await transactionsContainer.countDocuments({ accountId: id });
    if (transactionCount > 0) {
      return ApiResponse.badRequest(
        res,
        `Cannot delete account with ${transactionCount} transaction(s). Please delete or reassign transactions first.`
      );
    }

    await DbHelper.deleteByIdAndUser(accountsContainer, id, userId);

    logger.info({ userId, accountId: id }, 'Account deleted successfully');
    ApiResponse.success(res, null, 'Account deleted successfully');
  })
);

// GET /api/accounts/:id/balance - Get account balance with transaction summary
router.get(
  '/:id/balance',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;

    const accountsContainer = await mongoDBService.getAccountsContainer();
    const transactionsContainer = await mongoDBService.getTransactionsContainer();

    const account = await DbHelper.findByIdAndUser<Account>(accountsContainer, id, userId);
    if (!account) {
      return ApiResponse.notFound(res, 'Account not found');
    }

    // Get approved transactions only for accurate balance calculation
    const transactions = await transactionsContainer
      .find(buildApprovedTransactionsFilter(userId, { accountId: id }))
      .toArray();

    const credits = transactions
      .filter((t) => t.type === 'credit')
      .reduce((sum: number, t) => sum + t.amount, 0);

    const debits = transactions
      .filter((t) => t.type === 'debit')
      .reduce((sum: number, t) => sum + t.amount, 0);

    const calculatedBalance = (account.initialBalance || 0) + credits - debits;

    logger.info(
      { userId, accountId: id, transactionCount: transactions.length },
      'Account balance fetched'
    );
    ApiResponse.success(res, {
      balance: {
        currentBalance: account.balance,
        calculatedBalance,
        initialBalance: account.initialBalance || 0,
        totalCredits: credits,
        totalDebits: debits,
        transactionCount: transactions.length,
      },
    });
  })
);

export default router;
