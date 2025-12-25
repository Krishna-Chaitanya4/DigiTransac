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
      scopeType,
      categoryId,
      includeTagIds,
      excludeTagIds,
      accountId,
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

    // Validate scope-specific fields
    if (scopeType === 'category' && categoryId) {
      const categoriesContainer = await cosmosDBService.getCategoriesContainer();
      const category = await categoriesContainer.findOne({ id: categoryId, userId });
      if (!category) {
        res.status(404).json({
          success: false,
          message: 'Category or folder not found',
        });
        return;
      }
    } else if (scopeType === 'tag' && (includeTagIds || excludeTagIds)) {
      // Validate at least one of include or exclude is provided
      if ((!includeTagIds || includeTagIds.length === 0) && (!excludeTagIds || excludeTagIds.length === 0)) {
        res.status(400).json({
          success: false,
          message: 'At least one include or exclude tag must be specified',
        });
        return;
      }

      const tagsContainer = await cosmosDBService.getTagsContainer();
      const allTagIds = [...(includeTagIds || []), ...(excludeTagIds || [])];
      const tags = await tagsContainer.find({ id: { $in: allTagIds }, userId }).toArray();
      if (tags.length !== allTagIds.length) {
        res.status(404).json({
          success: false,
          message: 'One or more tags not found',
        });
        return;
      }
    } else if (scopeType === 'account' && accountId) {
      const accountsContainer = await cosmosDBService.getAccountsContainer();
      const account = await accountsContainer.findOne({ id: accountId, userId });
      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Account not found',
        });
        return;
      }
    }

    const budgetsContainer = await cosmosDBService.getBudgetsContainer();

    // Check for existing budget with same scope and period
    const duplicateFilter: any = {
      userId,
      scopeType,
      startDate: new Date(startDate),
    };
    if (scopeType === 'category') duplicateFilter.categoryId = categoryId;
    if (scopeType === 'tag') {
      duplicateFilter.includeTagIds = includeTagIds;
      duplicateFilter.excludeTagIds = excludeTagIds;
    }
    if (scopeType === 'account') duplicateFilter.accountId = accountId;

    const existingBudget = await budgetsContainer.findOne(duplicateFilter);
    if (existingBudget) {
      res.status(400).json({
        success: false,
        message: 'Budget already exists for this scope in this period',
      });
      return;
    }

    const newBudget: Budget = {
      id: `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      name: sanitizedName,
      scopeType,
      categoryId: scopeType === 'category' ? categoryId : undefined,
      includeTagIds: scopeType === 'tag' ? includeTagIds : undefined,
      excludeTagIds: scopeType === 'tag' ? excludeTagIds : undefined,
      accountId: scopeType === 'account' ? accountId : undefined,
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
      scopeType,
      categoryId,
      includeTagIds,
      excludeTagIds,
      accountId,
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

    // Validate scope changes
    const newScopeType = scopeType || budget.scopeType;
    if (newScopeType === 'category' && categoryId) {
      const categoriesContainer = await cosmosDBService.getCategoriesContainer();
      const category = await categoriesContainer.findOne({ id: categoryId, userId });
      if (!category) {
        res.status(404).json({
          success: false,
          message: 'Category or folder not found',
        });
        return;
      }
    } else if (newScopeType === 'tag' && (includeTagIds || excludeTagIds)) {
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
    } else if (newScopeType === 'account' && accountId) {
      const accountsContainer = await cosmosDBService.getAccountsContainer();
      const account = await accountsContainer.findOne({ id: accountId, userId });
      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Account not found',
        });
        return;
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = sanitizedName;
    if (scopeType !== undefined) updateData.scopeType = scopeType;
    if (categoryId !== undefined) {
      updateData.categoryId = categoryId;
      updateData.includeTagIds = undefined;
      updateData.excludeTagIds = undefined;
      updateData.accountId = undefined;
    }
    if (includeTagIds !== undefined) {
      updateData.includeTagIds = includeTagIds;
      updateData.categoryId = undefined;
      updateData.accountId = undefined;
    }
    if (excludeTagIds !== undefined) {
      updateData.excludeTagIds = excludeTagIds;
    }
    if (accountId !== undefined) {
      updateData.accountId = accountId;
      updateData.categoryId = undefined;
      updateData.includeTagIds = undefined;
      updateData.excludeTagIds = undefined;
    }
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

    const categoriesContainer = await cosmosDBService.getCategoriesContainer();

    if (budgets.length === 0) {
      res.json({ success: true, alerts: [] });
      return;
    }

    // Fetch all categories and expenses once
    const categories = (await categoriesContainer
      .find({ userId })
      .toArray()) as unknown as Category[];
    const categoryMap = new Map(categories.map((cat) => [cat.id, cat]));

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
      // Skip budgets without category scope (we only handle category budgets in alerts for now)
      if (budget.scopeType !== 'category' || !budget.categoryId) {
        continue;
      }

      const startDate = new Date(budget.startDate);
      const endDate = budget.endDate ? new Date(budget.endDate) : new Date();

      const category = categoryMap.get(budget.categoryId);
      const categoryIds = category?.isFolder
        ? categoryToDescendantsMap.get(budget.categoryId) || []
        : [budget.categoryId];

      // Calculate spending from pre-fetched expenses
      let spent = 0;
      for (const catId of categoryIds) {
        const expenses = expensesByCategory.get(catId) || [];
        spent += expenses
          .filter((exp: any) => {
            const expDate = new Date(exp.date);
            return expDate >= startDate && expDate <= endDate;
          })
          .reduce((sum: number, exp: any) => sum + exp.amount, 0);
      }

      const percentUsed = (spent / budget.amount) * 100;

      if (percentUsed >= budget.alertThreshold) {
        budgetAlerts.push({
          budgetId: budget.id,
          categoryId: budget.categoryId,
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
