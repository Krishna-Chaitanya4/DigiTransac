import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cosmosDBService } from '../config/cosmosdb';
import { getExpensesFromTransactions } from '../utils/expenseHelpers';

const router = Router();

router.use(authenticate);

// GET /api/analytics/overview - Get spending overview for dashboard
router.get('/overview', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate as string)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate
      ? new Date(new Date(endDate as string).setHours(23, 59, 59, 999))
      : new Date(new Date().setHours(23, 59, 59, 999));

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    const expenses = await transactionsContainer
      .find({
        userId,
        type: 'debit',
        date: { $gte: start, $lte: end },
        reviewStatus: 'approved',
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
        $or: [{ endDate: { $gte: start } }, { endDate: { $exists: false } }],
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
          endDate: end,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching overview:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching overview',
    });
  }
});

// GET /api/analytics/category-breakdown - Get spending by category with folder hierarchy
router.get('/category-breakdown', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate as string)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate
      ? new Date(new Date(endDate as string).setHours(23, 59, 59, 999))
      : new Date(new Date().setHours(23, 59, 59, 999));

    // Get transactions and their splits to aggregate by category
    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    const splitsContainer = await cosmosDBService.getTransactionSplitsContainer();
    
    const transactions = await transactionsContainer
      .find({
        userId,
        type: 'debit',
        date: { $gte: start, $lte: end },
        reviewStatus: 'approved',
      })
      .toArray();

    const transactionIds = transactions.map((t: any) => t.id);
    const splits = await splitsContainer
      .find({
        transactionId: { $in: transactionIds },
      })
      .toArray();

    // Aggregate by category from splits
    const categoryMap = new Map<string, { amount: number; count: number }>();

    splits.forEach((split: any) => {
      const categoryId = split.categoryId;
      const current = categoryMap.get(categoryId) || { amount: 0, count: 0 };
      categoryMap.set(categoryId, {
        amount: current.amount + split.amount,
        count: current.count + 1,
      });
    });

    // Get category details
    const categoriesContainer = await cosmosDBService.getCategoriesContainer();
    const categories = await categoriesContainer.find({ userId }).toArray();

    const categoryLookup = new Map(categories.map((cat: any) => [cat.id, cat]));

    // Helper function to build name path from category IDs
    const buildNamePath = (categoryId: string): string[] => {
      const category = categoryLookup.get(categoryId);
      if (!category) return ['Unknown'];

      const namePath: string[] = [];
      if (category.parentId) {
        // Recursively get parent names
        const parentCategory = categoryLookup.get(category.parentId);
        if (parentCategory) {
          namePath.push(...buildNamePath(category.parentId));
        }
      }
      namePath.push(category.name);
      return namePath;
    };

    const breakdown = Array.from(categoryMap.entries()).map(([categoryId, data]) => {
      const category = categoryLookup.get(categoryId);
      return {
        categoryId,
        categoryName: category?.name || 'Unknown',
        categoryColor: category?.color || '#667eea',
        isFolder: category?.isFolder || false,
        parentId: category?.parentId || null,
        path: buildNamePath(categoryId),
        amount: data.amount,
        count: data.count,
        percentage: 0, // Will calculate after
      };
    });

    const totalAmount = breakdown.reduce((sum, item) => sum + item.amount, 0);
    breakdown.forEach((item) => {
      item.percentage = totalAmount > 0 ? Math.round((item.amount / totalAmount) * 100) : 0;
    });

    // Sort by amount descending
    breakdown.sort((a, b) => b.amount - a.amount);

    res.json({
      success: true,
      breakdown,
      total: totalAmount,
    });
  } catch (error) {
    console.error('Error fetching category breakdown:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching category breakdown',
    });
  }
});

// GET /api/analytics/folder-breakdown - Get spending aggregated by folders
router.get('/folder-breakdown', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate as string)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate
      ? new Date(new Date(endDate as string).setHours(23, 59, 59, 999))
      : new Date(new Date().setHours(23, 59, 59, 999));

    const expenses = await getExpensesFromTransactions(userId, start, end, 'approved');

    // Get all categories
    const categoriesContainer = await cosmosDBService.getCategoriesContainer();
    const categories = await categoriesContainer.find({ userId }).toArray();

    const categoryLookup = new Map(categories.map((cat: any) => [cat.id, cat]));

    // Helper to get root folder for a category
    const getRootFolder = (categoryId: string): any => {
      const category = categoryLookup.get(categoryId);
      if (!category) return null;

      if (!category.parentId) {
        // This is already a root category/folder
        return category;
      }

      // Traverse up to find root
      let current = category;
      while (current.parentId) {
        const parent = categoryLookup.get(current.parentId);
        if (!parent) break;
        current = parent;
      }
      return current;
    };

    // Aggregate expenses by root folder
    const folderMap = new Map<string, { amount: number; count: number; children: Set<string> }>();

    expenses.forEach((expense: any) => {
      const rootFolder = getRootFolder(expense.categoryId);
      if (!rootFolder) return;

      const folderId = rootFolder.id;
      const current = folderMap.get(folderId) || {
        amount: 0,
        count: 0,
        children: new Set<string>(),
      };
      folderMap.set(folderId, {
        amount: current.amount + expense.amount,
        count: current.count + 1,
        children: current.children.add(expense.categoryId),
      });
    });

    const breakdown = Array.from(folderMap.entries()).map(([folderId, data]) => {
      const folder = categoryLookup.get(folderId);
      return {
        categoryId: folderId,
        categoryName: folder?.name || 'Unknown',
        categoryColor: folder?.color || '#667eea',
        isFolder: folder?.isFolder || false,
        parentId: null, // Root folders have no parent
        path: [folder?.name || 'Unknown'],
        amount: data.amount,
        count: data.count,
        childCount: data.children.size,
        percentage: 0, // Will calculate after
      };
    });

    const totalAmount = breakdown.reduce((sum, item) => sum + item.amount, 0);
    breakdown.forEach((item) => {
      item.percentage = totalAmount > 0 ? Math.round((item.amount / totalAmount) * 100) : 0;
    });

    // Sort by amount descending
    breakdown.sort((a, b) => b.amount - a.amount);

    res.json({
      success: true,
      breakdown,
      total: totalAmount,
    });
  } catch (error) {
    console.error('Error fetching folder breakdown:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching folder breakdown',
    });
  }
});

// GET /api/analytics/trends - Get spending trends over time
router.get('/trends', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const start = startDate
      ? new Date(startDate as string)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate
      ? new Date(new Date(endDate as string).setHours(23, 59, 59, 999))
      : new Date(new Date().setHours(23, 59, 59, 999));

    const expenses = await getExpensesFromTransactions(userId, start, end, 'approved');

    // Group by time period
    const trendsMap = new Map<string, number>();

    expenses.forEach((expense: any) => {
      const date = new Date(expense.date);
      let key: string;

      switch (groupBy) {
        case 'week': {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        }
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
      groupBy,
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trends',
    });
  }
});

// GET /api/analytics/budget-comparison - Compare actual spending vs budgets (with folder support)
router.get('/budget-comparison', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate as string)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate
      ? new Date(new Date(endDate as string).setHours(23, 59, 59, 999))
      : new Date(new Date().setHours(23, 59, 59, 999));

    // Get active budgets
    const budgetsContainer = await cosmosDBService.getBudgetsContainer();
    const budgets = await budgetsContainer
      .find({
        userId,
        startDate: { $lte: end },
        $or: [{ endDate: { $gte: start } }, { endDate: { $exists: false } }],
      })
      .toArray();

    if (budgets.length === 0) {
      res.json({ success: true, comparisons: [] });
      return;
    }

    const categoriesContainer = await cosmosDBService.getCategoriesContainer();

    const categories = await categoriesContainer.find({ userId }).toArray();
    const categoryLookup = new Map(categories.map((cat: any) => [cat.id, cat]));

    // Build category hierarchy map
    const categoryToDescendantsMap = new Map<string, string[]>();
    const getAllDescendantCategoryIds = (categoryId: string): string[] => {
      if (categoryToDescendantsMap.has(categoryId)) {
        return categoryToDescendantsMap.get(categoryId)!;
      }

      const result = [categoryId];
      const children = categories.filter((cat: any) => cat.parentId === categoryId);
      children.forEach((child: any) => {
        result.push(...getAllDescendantCategoryIds(child.id));
      });

      categoryToDescendantsMap.set(categoryId, result);
      return result;
    };

    // Pre-compute descendants for all budget categories
    budgets.forEach((budget: any) => getAllDescendantCategoryIds(budget.categoryId));

    // Fetch ALL relevant expenses in ONE query
    const allExpenses = await getExpensesFromTransactions(userId, start, end, 'approved');

    // Group expenses by category
    const expensesByCategory = new Map<string, any[]>();
    allExpenses.forEach((exp: any) => {
      if (!expensesByCategory.has(exp.categoryId)) {
        expensesByCategory.set(exp.categoryId, []);
      }
      expensesByCategory.get(exp.categoryId)!.push(exp);
    });

    // Calculate comparisons using pre-fetched data
    const comparisons = budgets.map((budget: any) => {
      const budgetStart = new Date(budget.startDate) > start ? new Date(budget.startDate) : start;
      const budgetEnd =
        budget.endDate && new Date(budget.endDate) < end ? new Date(budget.endDate) : end;

      const category = categoryLookup.get(budget.categoryId);
      const isFolder = category?.isFolder || false;

      // For folders, get all descendant categories
      const categoryIds = isFolder
        ? getAllDescendantCategoryIds(budget.categoryId)
        : [budget.categoryId];

      // Calculate spending from pre-fetched expenses
      let spent = 0;
      for (const catId of categoryIds) {
        const expenses = expensesByCategory.get(catId) || [];
        spent += expenses
          .filter((exp: any) => {
            const expDate = new Date(exp.date);
            return expDate >= budgetStart && expDate <= budgetEnd;
          })
          .reduce((sum: number, exp: any) => sum + exp.amount, 0);
      }

      return {
        categoryId: budget.categoryId,
        categoryName: category?.name || 'Unknown',
        categoryColor: category?.color || '#667eea',
        isFolder,
        budgetAmount: budget.amount,
        actualSpent: spent,
        difference: budget.amount - spent,
        percentUsed: Math.round((spent / budget.amount) * 100),
        isOverBudget: spent > budget.amount,
      };
    });

    res.json({
      success: true,
      comparisons,
    });
  } catch (error) {
    console.error('Error fetching budget comparison:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching budget comparison',
    });
  }
});

// GET /api/analytics/top-expenses - Get top expenses
router.get('/top-expenses', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { startDate, endDate, limit = '10' } = req.query;

    const start = startDate
      ? new Date(startDate as string)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate
      ? new Date(new Date(endDate as string).setHours(23, 59, 59, 999))
      : new Date(new Date().setHours(23, 59, 59, 999));

    const expenses = await getExpensesFromTransactions(userId, start, end, 'approved');

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
        categoryColor: category?.color || '#667eea',
      };
    });

    res.json({
      success: true,
      expenses: enrichedExpenses,
    });
  } catch (error) {
    console.error('Error fetching top expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching top expenses',
    });
  }
});

// GET /api/analytics/payment-method-breakdown - Get spending by payment method
router.get('/payment-method-breakdown', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate as string)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate
      ? new Date(new Date(endDate as string).setHours(23, 59, 59, 999))
      : new Date(new Date().setHours(23, 59, 59, 999));

    const expenses = await getExpensesFromTransactions(userId, start, end, 'approved');

    // Aggregate by payment method
    const paymentMethodMap = new Map<string, { amount: number; count: number }>();

    expenses.forEach((expense: any) => {
      const paymentMethodId = expense.paymentMethodId || 'none';
      const current = paymentMethodMap.get(paymentMethodId) || { amount: 0, count: 0 };
      paymentMethodMap.set(paymentMethodId, {
        amount: current.amount + expense.amount,
        count: current.count + 1,
      });
    });

    // Get payment method details
    const paymentMethodsContainer = await cosmosDBService.getPaymentMethodsContainer();
    const paymentMethods = await paymentMethodsContainer.find({ userId }).toArray();

    const totalAmount = Array.from(paymentMethodMap.values()).reduce(
      (sum, pm) => sum + pm.amount,
      0
    );

    const breakdown = Array.from(paymentMethodMap.entries())
      .map(([paymentMethodId, data]) => {
        const paymentMethod = paymentMethods.find((pm: any) => pm.id === paymentMethodId);
        return {
          paymentMethodId,
          paymentMethodName:
            paymentMethodId === 'none' ? 'Not Specified' : paymentMethod?.name || 'Unknown',
          paymentMethodType: paymentMethod?.type || 'other',
          amount: data.amount,
          count: data.count,
          percentage: totalAmount > 0 ? Math.round((data.amount / totalAmount) * 100) : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    res.json({
      success: true,
      breakdown,
    });
  } catch (error) {
    console.error('Error fetching payment method breakdown:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment method breakdown',
    });
  }
});

// GET /api/analytics/top-merchants - Get top merchants from parsed email data
router.get('/top-merchants', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { startDate, endDate, limit } = req.query;

    const start = startDate
      ? new Date(startDate as string)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate
      ? new Date(new Date(endDate as string).setHours(23, 59, 59, 999))
      : new Date(new Date().setHours(23, 59, 59, 999));
    const topLimit = limit ? parseInt(limit as string) : 10;

    // Get all expenses first, then filter by merchantName (splits don't have merchantName)
    const allExpenses = await getExpensesFromTransactions(userId, start, end, 'approved');
    const expenses = allExpenses.filter((exp: any) => exp.merchantName);

    // Aggregate by merchant
    const merchantMap = new Map<string, { amount: number; count: number }>();

    expenses.forEach((expense: any) => {
      const merchant = expense.merchantName;
      const current = merchantMap.get(merchant) || { amount: 0, count: 0 };
      merchantMap.set(merchant, {
        amount: current.amount + expense.amount,
        count: current.count + 1,
      });
    });

    const totalAmount = Array.from(merchantMap.values()).reduce((sum, m) => sum + m.amount, 0);

    const topMerchants = Array.from(merchantMap.entries())
      .map(([merchantName, data]) => ({
        merchantName,
        amount: data.amount,
        count: data.count,
        percentage: totalAmount > 0 ? Math.round((data.amount / totalAmount) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, topLimit);

    res.json({
      success: true,
      merchants: topMerchants,
    });
  } catch (error) {
    console.error('Error fetching top merchants:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching top merchants',
    });
  }
});

// GET /api/analytics/smart-insights - Get AI-powered spending insights
router.get('/smart-insights', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    const start = startDate
      ? new Date(startDate as string)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate as string) : new Date();
    end.setHours(23, 59, 59, 999);

    const categoriesContainer = await cosmosDBService.getCategoriesContainer();
    const budgetsContainer = await cosmosDBService.getBudgetsContainer();

    // Get current period expenses (approved only)
    const currentExpenses = await getExpensesFromTransactions(userId, start, end, 'approved');

    // Get previous period for comparison
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - periodDays);
    const prevEnd = new Date(end);
    prevEnd.setDate(prevEnd.getDate() - periodDays);

    const previousExpenses = await getExpensesFromTransactions(userId, prevStart, prevEnd, 'approved');

    const currentTotal = currentExpenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
    const previousTotal = previousExpenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
    const percentChange =
      previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

    // Get budgets and check for over-budget categories
    const budgets = await budgetsContainer.find({ userId }).toArray();
    const categories = await categoriesContainer.find({ userId }).toArray();
    const categoryLookup = new Map(categories.map((cat: any) => [cat.id, cat]));

    const overBudgetAlerts: any[] = [];
    for (const budget of budgets) {
      const budgetExpenses = currentExpenses.filter(
        (exp: any) => exp.categoryId === budget.categoryId
      );
      const spent = budgetExpenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);

      if (spent > budget.amount) {
        const category = categoryLookup.get(budget.categoryId);
        overBudgetAlerts.push({
          categoryName: category?.name || 'Unknown',
          budgetAmount: budget.amount,
          spent,
          overBy: spent - budget.amount,
          percentOver: Math.round(((spent - budget.amount) / budget.amount) * 100),
        });
      }
    }

    // Detect unusual spending patterns (expenses significantly higher than average)
    const avgExpense = currentTotal / (currentExpenses.length || 1);
    const unusualExpenses = currentExpenses
      .filter((exp: any) => exp.amount > avgExpense * 2.5)
      .map((exp: any) => ({
        description: exp.description,
        amount: exp.amount,
        date: exp.date,
        timesAverage: Math.round((exp.amount / avgExpense) * 10) / 10,
      }))
      .sort((a: any, b: any) => b.amount - a.amount)
      .slice(0, 5);

    // Category growth analysis
    const currentCategoryMap = new Map<string, number>();
    const previousCategoryMap = new Map<string, number>();

    currentExpenses.forEach((exp: any) => {
      currentCategoryMap.set(
        exp.categoryId,
        (currentCategoryMap.get(exp.categoryId) || 0) + exp.amount
      );
    });

    previousExpenses.forEach((exp: any) => {
      previousCategoryMap.set(
        exp.categoryId,
        (previousCategoryMap.get(exp.categoryId) || 0) + exp.amount
      );
    });

    const categoryTrends: any[] = [];
    currentCategoryMap.forEach((currentAmount, categoryId) => {
      const previousAmount = previousCategoryMap.get(categoryId) || 0;
      const change =
        previousAmount > 0 ? ((currentAmount - previousAmount) / previousAmount) * 100 : 100;
      const category = categoryLookup.get(categoryId);

      if (Math.abs(change) > 20) {
        // Only show significant changes
        categoryTrends.push({
          categoryName: category?.name || 'Unknown',
          currentAmount,
          previousAmount,
          percentChange: Math.round(change),
          trend: change > 0 ? 'increasing' : 'decreasing',
        });
      }
    });

    categoryTrends.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

    // Folder-level insights
    const getRootFolder = (categoryId: string): any => {
      const category = categoryLookup.get(categoryId);
      if (!category) return null;

      if (!category.parentId) return category;

      let current = category;
      while (current.parentId) {
        const parent = categoryLookup.get(current.parentId);
        if (!parent) break;
        current = parent;
      }
      return current;
    };

    const currentFolderMap = new Map<string, number>();
    const previousFolderMap = new Map<string, number>();

    currentExpenses.forEach((exp: any) => {
      const rootFolder = getRootFolder(exp.categoryId);
      if (rootFolder) {
        currentFolderMap.set(
          rootFolder.id,
          (currentFolderMap.get(rootFolder.id) || 0) + exp.amount
        );
      }
    });

    previousExpenses.forEach((exp: any) => {
      const rootFolder = getRootFolder(exp.categoryId);
      if (rootFolder) {
        previousFolderMap.set(
          rootFolder.id,
          (previousFolderMap.get(rootFolder.id) || 0) + exp.amount
        );
      }
    });

    const folderTrends: any[] = [];
    currentFolderMap.forEach((currentAmount, folderId) => {
      const previousAmount = previousFolderMap.get(folderId) || 0;
      const change =
        previousAmount > 0 ? ((currentAmount - previousAmount) / previousAmount) * 100 : 100;
      const folder = categoryLookup.get(folderId);

      if (Math.abs(change) > 15) {
        // Slightly lower threshold for folders (broader categories)
        folderTrends.push({
          folderName: folder?.name || 'Unknown',
          categoryId: folderId,
          categoryColor: folder?.color || '#667eea',
          currentAmount,
          previousAmount,
          percentChange: Math.round(change),
          trend: change > 0 ? 'increasing' : 'decreasing',
        });
      }
    });

    folderTrends.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

    res.json({
      success: true,
      insights: {
        overallTrend: {
          currentTotal,
          previousTotal,
          percentChange: Math.round(percentChange),
          direction: percentChange > 0 ? 'up' : 'down',
        },
        overBudgetAlerts,
        unusualExpenses,
        categoryTrends: categoryTrends.slice(0, 5),
        folderTrends: folderTrends.slice(0, 5),
        summary: {
          totalExpenses: currentExpenses.length,
          avgDailySpending: Math.round(currentTotal / (periodDays || 1)),
          topSpendingDay: await getTopSpendingDay(currentExpenses),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching smart insights:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching smart insights',
    });
  }
});

// Helper function to find the day with highest spending
async function getTopSpendingDay(expenses: any[]): Promise<{ date: string; amount: number }> {
  const dailyMap = new Map<string, number>();

  expenses.forEach((exp: any) => {
    const dateKey = new Date(exp.date).toISOString().split('T')[0];
    dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + exp.amount);
  });

  let topDay = { date: '', amount: 0 };
  dailyMap.forEach((amount, date) => {
    if (amount > topDay.amount) {
      topDay = { date, amount };
    }
  });

  return topDay;
}

// GET /api/analytics/review-queue-stats - Get review queue analytics
router.get('/review-queue-stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();

    // Use aggregation to count by status efficiently
    const [pending, approved, rejected, pendingTransactions] = await Promise.all([
      transactionsContainer.countDocuments({ userId, type: 'debit', reviewStatus: 'pending' }),
      transactionsContainer.countDocuments({ userId, type: 'debit', reviewStatus: 'approved' }),
      transactionsContainer.countDocuments({ userId, type: 'debit', reviewStatus: 'rejected' }),
      transactionsContainer
        .find({ userId, type: 'debit', reviewStatus: 'pending' })
        .sort({ date: -1 })
        .limit(5)
        .toArray(),
    ]);

    const total = approved + rejected;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    // Get pending expenses details
    const pendingExpensesFormatted = pendingTransactions.map((tx: any) => ({
      id: tx.id,
      description: tx.description,
      amount: tx.amount,
      date: tx.date,
      daysSinceParsed: Math.floor(
        (Date.now() - new Date(tx.createdAt || tx.date).getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

    res.json({
      success: true,
      stats: {
        pending,
        approved,
        rejected,
        approvalRate,
        pendingExpenses: pendingExpensesFormatted,
      },
    });
  } catch (error) {
    console.error('Error fetching review queue stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching review queue stats',
    });
  }
});

export default router;
