import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cosmosDBService } from '../config/cosmosdb';
import { Budget, Category } from '../models/types';

const router = Router();

router.use(authenticate);

/**
 * Get all descendant category IDs for a given category/folder
 * For regular categories: returns just the categoryId
 * For folders: returns all child category IDs recursively
 */
async function getAllDescendantCategoryIds(
  categoriesContainer: any,
  userId: string,
  categoryId: string,
  isFolder: boolean
): Promise<string[]> {
  if (!isFolder) {
    // Regular category - return just itself
    return [categoryId];
  }

  // Folder - recursively get all descendants
  const categoryIds: string[] = [];

  const collectDescendants = async (parentId: string): Promise<void> => {
    const children = (await categoriesContainer.find({ parentId, userId }).toArray()) as Category[];

    for (const child of children) {
      if (!child.isFolder) {
        // It's a category - add to list
        categoryIds.push(child.id);
      }
      // Whether folder or category, check for children
      await collectDescendants(child.id);
    }
  };

  await collectDescendants(categoryId);
  return categoryIds;
}

// GET /api/budgets - Get all budgets with spending info
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const budgetsContainer = await cosmosDBService.getBudgetsContainer();
    const budgets = (await budgetsContainer.find({ userId }).toArray()) as unknown as Budget[];

    // Calculate spending for each budget
    const expensesContainer = await cosmosDBService.getExpensesContainer();
    const categoriesContainer = await cosmosDBService.getCategoriesContainer();

    const budgetsWithSpending = await Promise.all(
      budgets.map(async (budget) => {
        const startDate = new Date(budget.startDate);
        const endDate = budget.endDate ? new Date(budget.endDate) : new Date();

        // Get the category to check if it's a folder
        const category = (await categoriesContainer.findOne({
          id: budget.categoryId,
          userId,
        })) as Category | null;

        if (!category) {
          // Category not found - return budget with zero spending
          return {
            ...budget,
            spent: 0,
            remaining: budget.amount,
            percentUsed: 0,
            isOverBudget: false,
          };
        }

        // Get all category IDs to include in calculation
        const categoryIds = await getAllDescendantCategoryIds(
          categoriesContainer,
          userId,
          budget.categoryId,
          category.isFolder
        );

        // Calculate spending across all relevant categories (approved expenses only)
        const expenses = await expensesContainer
          .find({
            userId,
            categoryId: { $in: categoryIds },
            date: { $gte: startDate, $lte: endDate },
            reviewStatus: 'approved',
          })
          .toArray();

        const spent = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
        const remaining = budget.amount - spent;
        const percentUsed = Math.round((spent / budget.amount) * 100);

        return {
          ...budget,
          spent,
          remaining,
          percentUsed,
          isOverBudget: spent > budget.amount,
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
    const { categoryId, amount, period, startDate, endDate, alertThreshold } = req.body;

    if (!categoryId || !amount || !startDate) {
      res.status(400).json({
        success: false,
        message: 'Category, amount, and start date are required',
      });
      return;
    }

    // Validate category exists (can be folder or category)
    const categoriesContainer = await cosmosDBService.getCategoriesContainer();
    const category = await categoriesContainer.findOne({ id: categoryId, userId });

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category or folder not found',
      });
      return;
    }

    const budgetsContainer = await cosmosDBService.getBudgetsContainer();

    // Check for existing budget in same period
    const existingBudget = await budgetsContainer.findOne({
      userId,
      categoryId,
      startDate: new Date(startDate),
    });

    if (existingBudget) {
      res.status(400).json({
        success: false,
        message: 'Budget already exists for this category in this period',
      });
      return;
    }

    const newBudget: Budget = {
      id: `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      categoryId,
      amount: parseFloat(amount),
      period: period || 'custom',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      alertThreshold: alertThreshold || 80,
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
    const { categoryId, amount, period, startDate, endDate, alertThreshold } = req.body;

    const budgetsContainer = await cosmosDBService.getBudgetsContainer();

    const budget = (await budgetsContainer.findOne({ id, userId })) as Budget | null;
    if (!budget) {
      res.status(404).json({
        success: false,
        message: 'Budget not found',
      });
      return;
    }

    // If categoryId is being changed, validate the new category exists
    if (categoryId !== undefined && categoryId !== budget.categoryId) {
      const categoriesContainer = await cosmosDBService.getCategoriesContainer();
      const category = await categoriesContainer.findOne({ id: categoryId, userId });

      if (!category) {
        res.status(404).json({
          success: false,
          message: 'Category or folder not found',
        });
        return;
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (period) updateData.period = period;
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (alertThreshold !== undefined) updateData.alertThreshold = alertThreshold;

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

    const alerts = [];
    const expensesContainer = await cosmosDBService.getExpensesContainer();

    for (const budget of budgets) {
      const startDate = new Date(budget.startDate);
      const endDate = budget.endDate ? new Date(budget.endDate) : new Date();

      const expenses = await expensesContainer
        .find({
          userId,
          categoryId: budget.categoryId,
          date: { $gte: startDate, $lte: endDate },
        })
        .toArray();

      const spent = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
      const percentUsed = (spent / budget.amount) * 100;

      if (percentUsed >= budget.alertThreshold) {
        alerts.push({
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
      alerts,
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
