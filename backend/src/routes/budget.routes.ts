import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cosmosDBService } from '../config/cosmosdb';
import { Budget, Category } from '../models/types';
import { getExpensesFromTransactions } from '../utils/expenseHelpers';
import { calculateBudgetSpending } from '../utils/budgetHelpers';

const router = Router();

router.use(authenticate);

// GET /api/budgets - Get all budgets with spending info
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const budgetsContainer = await cosmosDBService.getBudgetsContainer();
    const budgets = (await budgetsContainer.find({ userId }).toArray()) as unknown as Budget[];

    if (budgets.length === 0) {
      res.json({ success: true, budgets: [] });
      return;
    }

    // Fetch all categories once
    const categoriesContainer = await cosmosDBService.getCategoriesContainer();

    const categories = (await categoriesContainer
      .find({ userId })
      .toArray()) as unknown as Category[];

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

    res.json({
      success: true,
      budgets: budgetsWithSpending,
    });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching budgets',
    });
  }
});

// POST /api/budgets - Create budget
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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
        res.status(400).json({
          success: false,
          message: 'Budget name must not exceed 100 characters',
        });
        return;
      }
      // Convert empty string to undefined
      if (sanitizedName.length === 0) {
        sanitizedName = undefined;
      }
    }

    // Validate that at least one filter is specified
    const hasCategoryFilter = categoryIds && categoryIds.length > 0;
    const hasTagFilter = (includeTagIds && includeTagIds.length > 0) || (excludeTagIds && excludeTagIds.length > 0);
    const hasAccountFilter = accountIds && accountIds.length > 0;

    if (!hasCategoryFilter && !hasTagFilter && !hasAccountFilter) {
      res.status(400).json({
        success: false,
        message: 'At least one filter (categories, tags, or accounts) must be specified',
      });
      return;
    }

    // Validate categories exist
    if (hasCategoryFilter) {
      const categoriesContainer = await cosmosDBService.getCategoriesContainer();
      const categories = await categoriesContainer.find({ id: { $in: categoryIds }, userId }).toArray();
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
      const tagsContainer = await cosmosDBService.getTagsContainer();
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
      const accountsContainer = await cosmosDBService.getAccountsContainer();
      const accounts = await accountsContainer.find({ id: { $in: accountIds }, userId }).toArray();
      if (accounts.length !== accountIds.length) {
        res.status(404).json({
          success: false,
          message: 'One or more accounts not found',
        });
        return;
      }
    }

    const budgetsContainer = await cosmosDBService.getBudgetsContainer();

    const newBudget: Budget = {
      id: `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await budgetsContainer.insertOne(newBudget);

    res.status(201).json({
      success: true,
      message: 'Budget created successfully',
      budget: newBudget,
    });
  } catch (error) {
    console.error('Error creating budget:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating budget',
    });
  }
});

// PUT /api/budgets/:id - Update budget
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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
          res.status(400).json({
            success: false,
            message: 'Budget name must not exceed 100 characters',
          });
          return;
        }
        // Convert empty string to undefined
        if (sanitizedName.length === 0) {
          sanitizedName = undefined;
        }
      }
    }

    const budgetsContainer = await cosmosDBService.getBudgetsContainer();

    const budget = (await budgetsContainer.findOne({ id, userId })) as Budget | null;
    if (!budget) {
      res.status(404).json({
        success: false,
        message: 'Budget not found',
      });
      return;
    }

    // Validate categories if provided
    if (categoryIds !== undefined && categoryIds.length > 0) {
      const categoriesContainer = await cosmosDBService.getCategoriesContainer();
      const categories = await categoriesContainer.find({ id: { $in: categoryIds }, userId }).toArray();
      if (categories.length !== categoryIds.length) {
        res.status(404).json({
          success: false,
          message: 'One or more categories not found',
        });
        return;
      }
    }

    // Validate tags if provided
    if (includeTagIds !== undefined || excludeTagIds !== undefined) {
      const tagsContainer = await cosmosDBService.getTagsContainer();
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

    // Validate accounts if provided
    if (accountIds !== undefined && accountIds.length > 0) {
      const accountsContainer = await cosmosDBService.getAccountsContainer();
      const accounts = await accountsContainer.find({ id: { $in: accountIds }, userId }).toArray();
      if (accounts.length !== accountIds.length) {
        res.status(404).json({
          success: false,
          message: 'One or more accounts not found',
        });
        return;
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = sanitizedName;
    if (categoryIds !== undefined) updateData.categoryIds = categoryIds.length > 0 ? categoryIds : undefined;
    if (includeTagIds !== undefined) updateData.includeTagIds = includeTagIds.length > 0 ? includeTagIds : undefined;
    if (excludeTagIds !== undefined) updateData.excludeTagIds = excludeTagIds.length > 0 ? excludeTagIds : undefined;
    if (accountIds !== undefined) updateData.accountIds = accountIds.length > 0 ? accountIds : undefined;
    if (calculationType !== undefined) updateData.calculationType = calculationType;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (period) updateData.period = period;
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (alertThreshold !== undefined) updateData.alertThreshold = alertThreshold;
    if (alertThresholds !== undefined) updateData.alertThresholds = alertThresholds;
    if (notificationChannels !== undefined) updateData.notificationChannels = notificationChannels;
    if (enableRollover !== undefined) updateData.enableRollover = enableRollover;
    if (rolloverLimit !== undefined) updateData.rolloverLimit = rolloverLimit ? parseFloat(rolloverLimit) : undefined;

    await budgetsContainer.updateOne({ id, userId }, { $set: updateData });

    const updatedBudget = await budgetsContainer.findOne({ id, userId });

    res.json({
      success: true,
      message: 'Budget updated successfully',
      budget: updatedBudget,
    });
  } catch (error) {
    console.error('Error updating budget:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating budget',
    });
  }
});

// DELETE /api/budgets/:id - Delete budget
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const budgetsContainer = await cosmosDBService.getBudgetsContainer();

    const budget = (await budgetsContainer.findOne({ id, userId })) as Budget | null;
    if (!budget) {
      res.status(404).json({
        success: false,
        message: 'Budget not found',
      });
      return;
    }

    await budgetsContainer.deleteOne({ id, userId });

    res.json({
      success: true,
      message: 'Budget deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting budget:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting budget',
    });
  }
});

// GET /api/budgets/alerts - Get budget alerts
router.get('/alerts', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const budgetsContainer = await cosmosDBService.getBudgetsContainer();
    const budgets = (await budgetsContainer.find({ userId }).toArray()) as unknown as Budget[];

    if (budgets.length === 0) {
      res.json({ success: true, alerts: [] });
      return;
    }

    const categoriesContainer = await cosmosDBService.getCategoriesContainer();

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
        } else if (budget.categoryId) {
          primaryId = budget.categoryId; // Legacy
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

    res.json({
      success: true,
      alerts: budgetAlerts,
    });
  } catch (error) {
    console.error('Error fetching budget alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching budget alerts',
    });
  }
});

export default router;
