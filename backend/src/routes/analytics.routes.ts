import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cosmosDBService } from '../config/cosmosdb';

const router = Router();

router.use(authenticate);

// GET /api/analytics/overview - Get spending overview for dashboard
router.get('/overview', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    const expensesContainer = await cosmosDBService.getExpensesContainer();
    const expenses = await expensesContainer
      .find({
        userId,
        date: { $gte: start, $lte: end }
      })
      .toArray();

    const totalSpent = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
    const expenseCount = expenses.length;
    const avgExpense = expenseCount > 0 ? totalSpent / expenseCount : 0;

    // Get budget info
    const budgetsContainer = await cosmosDBService.getBudgetsContainer();
    const budgets = await budgetsContainer
      .find({
        userId,
        startDate: { $lte: end },
        $or: [
          { endDate: { $gte: start } },
          { endDate: { $exists: false } }
        ]
      })
      .toArray();

    const totalBudget = budgets.reduce((sum: number, budget: any) => sum + budget.amount, 0);

    res.json({
      success: true,
      overview: {
        totalSpent,
        totalBudget,
        expenseCount,
        avgExpense,
        budgetUsedPercent: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
        period: {
          startDate: start,
          endDate: end
        }
      }
    });
  } catch (error) {
    console.error('Error fetching overview:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching overview'
    });
  }
});

// GET /api/analytics/category-breakdown - Get spending by category
router.get('/category-breakdown', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    const expensesContainer = await cosmosDBService.getExpensesContainer();
    const expenses = await expensesContainer
      .find({
        userId,
        date: { $gte: start, $lte: end }
      })
      .toArray();

    // Aggregate by category
    const categoryMap = new Map<string, { amount: number; count: number }>();
    
    expenses.forEach((expense: any) => {
      const categoryId = expense.categoryId;
      const current = categoryMap.get(categoryId) || { amount: 0, count: 0 };
      categoryMap.set(categoryId, {
        amount: current.amount + expense.amount,
        count: current.count + 1
      });
    });

    // Get category details
    const categoriesContainer = await cosmosDBService.getCategoriesContainer();
    const categories = await categoriesContainer
      .find({ userId })
      .toArray();

    const categoryLookup = new Map(categories.map((cat: any) => [cat.id, cat]));

    const breakdown = Array.from(categoryMap.entries()).map(([categoryId, data]) => {
      const category = categoryLookup.get(categoryId);
      return {
        categoryId,
        categoryName: category?.name || 'Unknown',
        categoryColor: category?.color || '#667eea',
        amount: data.amount,
        count: data.count,
        percentage: 0 // Will calculate after
      };
    });

    const totalAmount = breakdown.reduce((sum, item) => sum + item.amount, 0);
    breakdown.forEach(item => {
      item.percentage = totalAmount > 0 ? Math.round((item.amount / totalAmount) * 100) : 0;
    });

    // Sort by amount descending
    breakdown.sort((a, b) => b.amount - a.amount);

    res.json({
      success: true,
      breakdown,
      total: totalAmount
    });
  } catch (error) {
    console.error('Error fetching category breakdown:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching category breakdown'
    });
  }
});

// GET /api/analytics/trends - Get spending trends over time
router.get('/trends', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    const expensesContainer = await cosmosDBService.getExpensesContainer();
    const expenses = await expensesContainer
      .find({
        userId,
        date: { $gte: start, $lte: end }
      })
      .toArray();

    // Group by time period
    const trendsMap = new Map<string, number>();

    expenses.forEach((expense: any) => {
      const date = new Date(expense.date);
      let key: string;

      switch (groupBy) {
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = `${date.getFullYear()}`;
          break;
        default: // day
          key = date.toISOString().split('T')[0];
      }

      trendsMap.set(key, (trendsMap.get(key) || 0) + expense.amount);
    });

    const trends = Array.from(trendsMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      trends,
      groupBy
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trends'
    });
  }
});

// GET /api/analytics/budget-comparison - Compare actual spending vs budgets
router.get('/budget-comparison', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get active budgets
    const budgetsContainer = await cosmosDBService.getBudgetsContainer();
    const budgets = await budgetsContainer
      .find({
        userId,
        startDate: { $lte: end },
        $or: [
          { endDate: { $gte: start } },
          { endDate: { $exists: false } }
        ]
      })
      .toArray();

    const expensesContainer = await cosmosDBService.getExpensesContainer();
    const categoriesContainer = await cosmosDBService.getCategoriesContainer();
    
    const categories = await categoriesContainer.find({ userId }).toArray();
    const categoryLookup = new Map(categories.map((cat: any) => [cat.id, cat]));

    const comparisons = await Promise.all(
      budgets.map(async (budget: any) => {
        const budgetStart = new Date(budget.startDate) > start ? new Date(budget.startDate) : start;
        const budgetEnd = budget.endDate && new Date(budget.endDate) < end ? new Date(budget.endDate) : end;

        const expenses = await expensesContainer
          .find({
            userId,
            categoryId: budget.categoryId,
            date: { $gte: budgetStart, $lte: budgetEnd }
          })
          .toArray();

        const spent = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
        const category = categoryLookup.get(budget.categoryId);

        return {
          categoryId: budget.categoryId,
          categoryName: category?.name || 'Unknown',
          categoryColor: category?.color || '#667eea',
          budgetAmount: budget.amount,
          actualSpent: spent,
          difference: budget.amount - spent,
          percentUsed: Math.round((spent / budget.amount) * 100),
          isOverBudget: spent > budget.amount
        };
      })
    );

    res.json({
      success: true,
      comparisons
    });
  } catch (error) {
    console.error('Error fetching budget comparison:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching budget comparison'
    });
  }
});

// GET /api/analytics/top-expenses - Get top expenses
router.get('/top-expenses', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { startDate, endDate, limit = '10' } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    const expensesContainer = await cosmosDBService.getExpensesContainer();
    const expenses = await expensesContainer
      .find({
        userId,
        date: { $gte: start, $lte: end }
      })
      .toArray();

    // Sort by amount and take top N
    const topExpenses = expenses
      .sort((a: any, b: any) => b.amount - a.amount)
      .slice(0, parseInt(limit as string));

    // Get category details
    const categoriesContainer = await cosmosDBService.getCategoriesContainer();
    const categories = await categoriesContainer.find({ userId }).toArray();
    const categoryLookup = new Map(categories.map((cat: any) => [cat.id, cat]));

    const enrichedExpenses = topExpenses.map((expense: any) => {
      const category = categoryLookup.get(expense.categoryId);
      return {
        ...expense,
        categoryName: category?.name || 'Unknown',
        categoryColor: category?.color || '#667eea'
      };
    });

    res.json({
      success: true,
      expenses: enrichedExpenses
    });
  } catch (error) {
    console.error('Error fetching top expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching top expenses'
    });
  }
});

export default router;
