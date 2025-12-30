import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { mongoDBService } from '../config/mongodb';
import { Budget, Category } from '../models/types';
import { getExpensesFromTransactions } from '../utils/expenseHelpers';
import { calculateBudgetSpending } from '../utils/budgetHelpers';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';
import { DbHelper } from '../utils/dbHelpers';

const router = Router();

router.use(authenticate);

// GET /api/budgets - Get all budgets with spending info
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    const budgetsContainer = await mongoDBService.getBudgetsContainer();
    const budgets = await DbHelper.findAllByUser<Budget>(budgetsContainer, userId);

    if (budgets.length === 0) {
      logger.info({ userId }, 'No budgets found');
      return ApiResponse.success(res, { budgets: [] });
    }

    // Fetch all categories once
    const categoriesContainer = await mongoDBService.getCategoriesContainer();
    const categories = await DbHelper.findAllByUser<Category>(categoriesContainer, userId);

    // Build category hierarchy map for efficient lookups
    const categoryToDescendantsMap = new Map<string, string[]>();
    const buildDescendants = (parentId: string): string[] => {
      if (categoryToDescendantsMap.has(parentId)) {
        return categoryToDescendantsMap.get(parentId)!;
      }

      const descendants: string[] = [];
      const children = categories.filter((cat) => cat.parentId === parentId);

      for (const child of children) {
        if (!child.isFolder) {
          descendants.push(child.id);
        }
        descendants.push(...buildDescendants(child.id));
      }

      categoryToDescendantsMap.set(parentId, descendants);
      return descendants;
    };

    // Pre-compute descendants for all categories
    categories.forEach((cat) => buildDescendants(cat.id));

    // Fetch ALL relevant expenses in ONE query using helper
    const minStartDate = new Date(Math.min(...budgets.map((b) => new Date(b.startDate).getTime())));
    const allExpenses = await getExpensesFromTransactions(
      userId,
      minStartDate,
      new Date(),
      'approved'
    );

    // Group expenses by category for fast lookup
    const expensesByCategory = new Map<string, any[]>();
    allExpenses.forEach((exp: any) => {
      if (!expensesByCategory.has(exp.categoryId)) {
        expensesByCategory.set(exp.categoryId, []);
      }
      expensesByCategory.get(exp.categoryId)!.push(exp);
    });

    // Calculate spending for each budget using new logic
    const budgetsWithSpending = await Promise.all(
      budgets.map(async (budget) => {
        const { spent } = await calculateBudgetSpending(
          budget,
          userId,
          categories,
          categoryToDescendantsMap,
          expensesByCategory
        );

        // Apply rollover if enabled
        const effectiveBudget = budget.amount + (budget.rolledOverAmount || 0);
        const remaining = effectiveBudget - spent;
        const percentUsed = Math.round((spent / effectiveBudget) * 100);

        return {
          ...budget,
          spent,
          remaining,
          percentUsed,
          isOverBudget: spent > effectiveBudget,
        };
      })
    );

    logger.info({ userId, count: budgetsWithSpending.length }, 'Budgets fetched successfully');
    ApiResponse.success(res, { budgets: budgetsWithSpending });
  })
);

// POST /api/budgets - Create budget
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const {
      name,
      categoryIds,
      includeTagIds,
      excludeTagIds,
      accountIds,
      calculationType,
      amount,
      period,
      startDate,
      endDate,
      alertThreshold,
      alertThresholds,
      notificationChannels,
      enableRollover,
      rolloverLimit,
    } = req.body;

    // Validate and sanitize budget name
    let sanitizedName: string | undefined = undefined;
    if (name && typeof name === 'string') {
      sanitizedName = name.trim();
      if (sanitizedName.length > 100) {
        return ApiResponse.badRequest(res, 'Budget name must not exceed 100 characters');
      }
      // Convert empty string to undefined
      if (sanitizedName.length === 0) {
        sanitizedName = undefined;
      }
    }

    // Validate that at least one filter is specified
    const hasCategoryFilter = categoryIds && categoryIds.length > 0;
    const hasTagFilter =
      (includeTagIds && includeTagIds.length > 0) || (excludeTagIds && excludeTagIds.length > 0);
    const hasAccountFilter = accountIds && accountIds.length > 0;

    if (!hasCategoryFilter && !hasTagFilter && !hasAccountFilter) {
      return ApiResponse.badRequest(
        res,
        'At least one filter (categories, tags, or accounts) must be specified'
      );
    }

    // Validate dates
    if (!startDate) {
      return ApiResponse.badRequest(res, 'Start date is required');
    }

    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return ApiResponse.badRequest(res, 'Invalid start date');
    }

    // Validate end date if provided
    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return ApiResponse.badRequest(res, 'Invalid end date');
      }

      // End date must be after start date
      if (end <= start) {
        return ApiResponse.badRequest(res, 'End date must be after start date');
      }
    }

    // Validate categories exist
    if (hasCategoryFilter) {
      const categoriesContainer = await mongoDBService.getCategoriesContainer();
      const categories = await categoriesContainer
        .find({ id: { $in: categoryIds }, userId })
        .toArray();
      if (categories.length !== categoryIds.length) {
        res.status(404).json({
          success: false,
          message: 'One or more categories not found',
        });
        return;
      }
    }

    // Validate tags exist
    if (hasTagFilter) {
      const tagsContainer = await mongoDBService.getTagsContainer();
      const allTagIds = [...(includeTagIds || []), ...(excludeTagIds || [])];
      if (allTagIds.length > 0) {
        const tags = await tagsContainer.find({ id: { $in: allTagIds }, userId }).toArray();
        if (tags.length !== allTagIds.length) {
          res.status(404).json({
            success: false,
            message: 'One or more tags not found',
          });
          return;
        }
      }
    }

    // Validate accounts exist
    if (hasAccountFilter) {
      const accountsContainer = await mongoDBService.getAccountsContainer();
      const accounts = await accountsContainer.find({ id: { $in: accountIds }, userId }).toArray();
      if (accounts.length !== accountIds.length) {
        res.status(404).json({
          success: false,
          message: 'One or more accounts not found',
        });
        return;
      }
    }

    const budgetsContainer = await mongoDBService.getBudgetsContainer();

    const newBudget = await DbHelper.createDocument<Budget>(budgetsContainer, {
      userId,
      name: sanitizedName,
      categoryIds: hasCategoryFilter ? categoryIds : undefined,
      includeTagIds: hasTagFilter && includeTagIds?.length > 0 ? includeTagIds : undefined,
      excludeTagIds: hasTagFilter && excludeTagIds?.length > 0 ? excludeTagIds : undefined,
      accountIds: hasAccountFilter ? accountIds : undefined,
      calculationType,
      amount: parseFloat(amount),
      period: period || 'custom',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      alertThreshold: alertThreshold || 80,
      alertThresholds,
      notificationChannels,
      enableRollover: enableRollover || false,
      rolloverLimit: rolloverLimit ? parseFloat(rolloverLimit) : undefined,
    });

    logger.info({ userId, budgetId: newBudget.id }, 'Budget created successfully');
    ApiResponse.created(res, { budget: newBudget }, 'Budget created successfully');
  })
);

// POST /api/budgets/:id/duplicate - Duplicate budget with optional date shift
router.post(
  '/:id/duplicate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;
    const { shiftMonths = 1, newName } = req.body; // Optional: shift dates forward by N months

    const budgetsContainer = await mongoDBService.getBudgetsContainer();

    const originalBudget = (await budgetsContainer.findOne({ id, userId })) as Budget | null;
    if (!originalBudget) {
      return ApiResponse.notFound(res, 'Budget not found');
    }

    // Calculate new dates by shifting forward
    const originalStart = new Date(originalBudget.startDate);
    const newStartDate = new Date(originalStart);
    newStartDate.setMonth(newStartDate.getMonth() + shiftMonths);

    let newEndDate: Date | undefined;
    if (originalBudget.endDate) {
      const originalEnd = new Date(originalBudget.endDate);
      newEndDate = new Date(originalEnd);
      newEndDate.setMonth(newEndDate.getMonth() + shiftMonths);
    }

    // Create duplicated budget
    const duplicatedBudget: Budget = {
      id: `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      name: newName || (originalBudget.name ? `${originalBudget.name} (Copy)` : undefined),
      categoryIds: originalBudget.categoryIds,
      includeTagIds: originalBudget.includeTagIds,
      excludeTagIds: originalBudget.excludeTagIds,
      accountIds: originalBudget.accountIds,
      calculationType: originalBudget.calculationType,
      amount: originalBudget.amount,
      period: 'custom', // Always set to custom for duplicates
      startDate: newStartDate,
      endDate: newEndDate,
      alertThreshold: originalBudget.alertThreshold,
      alertThresholds: originalBudget.alertThresholds,
      notificationChannels: originalBudget.notificationChannels,
      enableRollover: originalBudget.enableRollover,
      rolloverLimit: originalBudget.rolloverLimit,
      rolledOverAmount: 0, // Reset rollover amount for new budget
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await budgetsContainer.insertOne(duplicatedBudget);

    logger.info(
      { userId, budgetId: id, newBudgetId: duplicatedBudget.id },
      'Budget duplicated successfully'
    );
    ApiResponse.created(res, { budget: duplicatedBudget }, 'Budget duplicated successfully');
  })
);

// PUT /api/budgets/:id - Update budget
router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;
    const {
      name,
      categoryIds,
      includeTagIds,
      excludeTagIds,
      accountIds,
      calculationType,
      amount,
      period,
      startDate,
      endDate,
      alertThreshold,
      alertThresholds,
      notificationChannels,
      enableRollover,
      rolloverLimit,
    } = req.body;

    // Validate and sanitize budget name
    let sanitizedName: string | undefined = undefined;
    if (name !== undefined) {
      if (typeof name === 'string') {
        sanitizedName = name.trim();
        if (sanitizedName.length > 100) {
          return ApiResponse.badRequest(res, 'Budget name must not exceed 100 characters');
        }
        // Convert empty string to undefined
        if (sanitizedName.length === 0) {
          sanitizedName = undefined;
        }
      }
    }

    const budgetsContainer = await mongoDBService.getBudgetsContainer();

    const budget = (await budgetsContainer.findOne({ id, userId })) as Budget | null;
    if (!budget) {
      return ApiResponse.notFound(res, 'Budget not found');
    }

    // Validate categories if provided
    if (categoryIds !== undefined && categoryIds.length > 0) {
      const categoriesContainer = await mongoDBService.getCategoriesContainer();
      const categories = await categoriesContainer
        .find({ id: { $in: categoryIds }, userId })
        .toArray();
      if (categories.length !== categoryIds.length) {
        return ApiResponse.notFound(res, 'One or more categories not found');
      }
    }

    // Validate tags if provided
    if (includeTagIds !== undefined || excludeTagIds !== undefined) {
      const tagsContainer = await mongoDBService.getTagsContainer();
      const allTagIds = [...(includeTagIds || []), ...(excludeTagIds || [])];
      if (allTagIds.length > 0) {
        const tags = await tagsContainer.find({ id: { $in: allTagIds }, userId }).toArray();
        if (tags.length !== allTagIds.length) {
          return ApiResponse.notFound(res, 'One or more tags not found');
        }
      }
    }

    // Validate accounts if provided
    if (accountIds !== undefined && accountIds.length > 0) {
      const accountsContainer = await mongoDBService.getAccountsContainer();
      const accounts = await accountsContainer.find({ id: { $in: accountIds }, userId }).toArray();
      if (accounts.length !== accountIds.length) {
        return ApiResponse.notFound(res, 'One or more accounts not found');
      }
    }

    // Validate dates if provided
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return ApiResponse.badRequest(res, 'Invalid start date');
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return ApiResponse.badRequest(res, 'Invalid end date');
      }
    }

    // Validate start date is before end date (if both provided or updating)
    const effectiveStartDate = startDate ? new Date(startDate) : budget.startDate;
    const effectiveEndDate = endDate ? new Date(endDate) : budget.endDate;

    if (effectiveEndDate && effectiveStartDate >= effectiveEndDate) {
      return ApiResponse.badRequest(res, 'End date must be after start date');
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = sanitizedName;
    // Always update arrays (even if empty) to allow clearing
    if (categoryIds !== undefined) updateData.categoryIds = categoryIds;
    if (includeTagIds !== undefined) updateData.includeTagIds = includeTagIds;
    if (excludeTagIds !== undefined) updateData.excludeTagIds = excludeTagIds;
    if (accountIds !== undefined) updateData.accountIds = accountIds;
    if (calculationType !== undefined) updateData.calculationType = calculationType;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (period) updateData.period = period;
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (alertThreshold !== undefined) updateData.alertThreshold = alertThreshold;
    if (alertThresholds !== undefined) updateData.alertThresholds = alertThresholds;
    if (notificationChannels !== undefined) updateData.notificationChannels = notificationChannels;
    if (enableRollover !== undefined) updateData.enableRollover = enableRollover;
    if (rolloverLimit !== undefined)
      updateData.rolloverLimit = rolloverLimit ? parseFloat(rolloverLimit) : undefined;

    await budgetsContainer.updateOne({ id, userId }, { $set: updateData });

    const updatedBudget = await budgetsContainer.findOne({ id, userId });

    logger.info({ userId, budgetId: id }, 'Budget updated successfully');
    ApiResponse.success(res, { budget: updatedBudget }, 'Budget updated successfully');
  })
);

// DELETE /api/budgets/:id - Delete budget
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
    const { id } = req.params;

    const budgetsContainer = await mongoDBService.getBudgetsContainer();

    const budget = await DbHelper.findByIdAndUser<Budget>(budgetsContainer, id, userId);
    if (!budget) {
      return ApiResponse.notFound(res, 'Budget not found');
    }

    await DbHelper.deleteByIdAndUser(budgetsContainer, id, userId);

    logger.info({ userId, budgetId: id }, 'Budget deleted successfully');
    ApiResponse.success(res, null, 'Budget deleted successfully');
  })
);

// GET /api/budgets/alerts - Get budget alerts
router.get(
  '/alerts',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    const budgetsContainer = await mongoDBService.getBudgetsContainer();
    const budgets = (await budgetsContainer.find({ userId }).toArray()) as unknown as Budget[];

    if (budgets.length === 0) {
      return ApiResponse.success(res, { alerts: [] });
    }

    const categoriesContainer = await mongoDBService.getCategoriesContainer();

    // Fetch all categories and expenses once
    const categories = (await categoriesContainer
      .find({ userId })
      .toArray()) as unknown as Category[];

    // Build category hierarchy map
    const categoryToDescendantsMap = new Map<string, string[]>();
    const buildDescendants = (parentId: string): string[] => {
      if (categoryToDescendantsMap.has(parentId)) {
        return categoryToDescendantsMap.get(parentId)!;
      }

      const descendants: string[] = [];
      const children = categories.filter((cat) => cat.parentId === parentId);

      for (const child of children) {
        if (!child.isFolder) {
          descendants.push(child.id);
        }
        descendants.push(...buildDescendants(child.id));
      }

      categoryToDescendantsMap.set(parentId, descendants);
      return descendants;
    };

    categories.forEach((cat) => buildDescendants(cat.id));

    // Fetch ALL relevant expenses in ONE query using helper
    const minStartDate = new Date(Math.min(...budgets.map((b) => new Date(b.startDate).getTime())));
    const allExpenses = await getExpensesFromTransactions(
      userId,
      minStartDate,
      new Date()
      // Don't filter by reviewStatus for alerts - show all spending
    );

    // Group expenses by category
    const expensesByCategory = new Map<string, any[]>();
    allExpenses.forEach((exp: any) => {
      if (!expensesByCategory.has(exp.categoryId)) {
        expensesByCategory.set(exp.categoryId, []);
      }
      expensesByCategory.get(exp.categoryId)!.push(exp);
    });

    const budgetAlerts = [];

    for (const budget of budgets) {
      // Use the budget helper to calculate spending (handles both legacy and new format)
      const { spent } = await calculateBudgetSpending(
        budget,
        userId,
        categories,
        categoryToDescendantsMap,
        expensesByCategory
      );

      const percentUsed = (spent / budget.amount) * 100;

      if (percentUsed >= budget.alertThreshold) {
        // Determine primary identifier for the alert
        let primaryId = '';
        if (budget.categoryIds && budget.categoryIds.length > 0) {
          primaryId = budget.categoryIds[0];
        } else if (budget.accountIds && budget.accountIds.length > 0) {
          primaryId = budget.accountIds[0];
        } else if (budget.includeTagIds && budget.includeTagIds.length > 0) {
          primaryId = budget.includeTagIds[0];
        }

        budgetAlerts.push({
          budgetId: budget.id,
          primaryId,
          amount: budget.amount,
          spent,
          percentUsed: Math.round(percentUsed),
          threshold: budget.alertThreshold,
          isOverBudget: spent > budget.amount,
        });
      }
    }

    logger.info({ userId, alertCount: budgetAlerts.length }, 'Budget alerts fetched');
    ApiResponse.success(res, { alerts: budgetAlerts });
  })
);

export default router;
