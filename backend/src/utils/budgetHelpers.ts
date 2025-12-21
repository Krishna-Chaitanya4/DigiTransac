import { Budget, Category } from '../models/types';

/**
 * Calculate budget spending based on scope type and calculation type
 */
export async function calculateBudgetSpending(
  budget: Budget,
  _userId: string, // prefixed with underscore to indicate intentionally unused
  categories: Category[],
  categoryToDescendantsMap: Map<string, string[]>,
  expensesByCategory: Map<string, any[]>
): Promise<{ spent: number; credit: number; debit: number; net: number }> {
  const startDate = new Date(budget.startDate);
  const endDate = budget.endDate ? new Date(budget.endDate) : new Date();

  let relevantExpenses: any[] = [];

  // Get relevant expenses based on scope type
  if (budget.scopeType === 'category' && budget.categoryId) {
    const category = categories.find((c) => c.id === budget.categoryId);
    if (!category) {
      return { spent: 0, credit: 0, debit: 0, net: 0 };
    }

    const categoryIds = category.isFolder
      ? categoryToDescendantsMap.get(budget.categoryId) || []
      : [budget.categoryId];

    for (const catId of categoryIds) {
      const expenses = expensesByCategory.get(catId) || [];
      relevantExpenses.push(
        ...expenses.filter((exp: any) => {
          const expDate = new Date(exp.date);
          return expDate >= startDate && expDate <= endDate;
        })
      );
    }
  } else if (budget.scopeType === 'tag' && budget.tagIds && budget.tagIds.length > 0) {
    // Tag-based budgets: filter by tags
    const tagLogic = budget.tagLogic || 'OR';

    for (const expenses of expensesByCategory.values()) {
      for (const exp of expenses) {
        const expDate = new Date(exp.date);
        if (expDate >= startDate && expDate <= endDate && exp.tags && exp.tags.length > 0) {
          // Check if expense matches tag criteria
          const matchesTag =
            tagLogic === 'AND'
              ? budget.tagIds!.every((tagId) => exp.tags.includes(tagId))
              : budget.tagIds!.some((tagId) => exp.tags.includes(tagId));

          if (matchesTag) {
            relevantExpenses.push(exp);
          }
        }
      }
    }
  } else if (budget.scopeType === 'account' && budget.accountId) {
    // Account-based budgets: filter by account
    for (const expenses of expensesByCategory.values()) {
      relevantExpenses.push(
        ...expenses.filter((exp: any) => {
          const expDate = new Date(exp.date);
          return expDate >= startDate && expDate <= endDate && exp.accountId === budget.accountId;
        })
      );
    }
  }

  // Calculate totals based on transaction type
  const debit = relevantExpenses
    .filter((exp: any) => exp.type === 'debit')
    .reduce((sum: number, exp: any) => sum + exp.amount, 0);

  const credit = relevantExpenses
    .filter((exp: any) => exp.type === 'credit')
    .reduce((sum: number, exp: any) => sum + exp.amount, 0);

  const net = credit - debit;

  // Return spent based on calculation type
  let spent = 0;
  if (budget.calculationType === 'debit') {
    spent = debit;
  } else if (budget.calculationType === 'credit') {
    spent = credit;
  } else if (budget.calculationType === 'net') {
    spent = net;
  }

  return { spent, credit, debit, net };
}

/**
 * Calculate budget spending with custom date range (for analytics)
 */
export async function calculateBudgetSpendingInRange(
  budget: Budget,
  userId: string,
  categories: Category[],
  categoryToDescendantsMap: Map<string, string[]>,
  expensesByCategory: Map<string, any[]>,
  rangeStart: Date,
  rangeEnd: Date
): Promise<{ spent: number; credit: number; debit: number; net: number }> {
  // Temporarily override budget dates for calculation
  const originalStart = budget.startDate;
  const originalEnd = budget.endDate;

  budget.startDate = rangeStart;
  budget.endDate = rangeEnd;

  const result = await calculateBudgetSpending(
    budget,
    userId, // Pass through userId even if unused
    categories,
    categoryToDescendantsMap,
    expensesByCategory
  );

  // Restore original dates
  budget.startDate = originalStart;
  budget.endDate = originalEnd;

  return result;
}
