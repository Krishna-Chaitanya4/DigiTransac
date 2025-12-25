import { Budget, Category } from '../models/types';

/**
 * Migrate legacy budget format to new multi-select format
 */
function migrateLegacyBudget(budget: Budget): void {
  // Migrate categoryId -> categoryIds
  if (budget.scopeType === 'category' && budget.categoryId && !budget.categoryIds) {
    budget.categoryIds = [budget.categoryId];
  }
  // Migrate accountId -> accountIds
  if (budget.scopeType === 'account' && budget.accountId && !budget.accountIds) {
    budget.accountIds = [budget.accountId];
  }
}

/**
 * Calculate budget spending with new multi-filter logic:
 * - Categories: OR logic (cat1 OR cat2 OR cat3)
 * - Tags: Include (tag1 OR tag2) AND NOT Exclude (tag3 OR tag4)
 * - Accounts: OR logic (acc1 OR acc2)
 * - Combine with AND: (categories) AND (tags) AND (accounts)
 */
export async function calculateBudgetSpending(
  budget: Budget,
  _userId: string, // prefixed with underscore to indicate intentionally unused
  categories: Category[],
  categoryToDescendantsMap: Map<string, string[]>,
  expensesByCategory: Map<string, any[]>
): Promise<{ spent: number; credit: number; debit: number; net: number }> {
  // Migrate legacy budget if needed
  migrateLegacyBudget(budget);

  const startDate = new Date(budget.startDate);
  const endDate = budget.endDate ? new Date(budget.endDate) : new Date();

  // Collect all expenses in date range
  const allExpensesInRange: any[] = [];
  for (const expenses of expensesByCategory.values()) {
    allExpensesInRange.push(
      ...expenses.filter((exp: any) => {
        const expDate = new Date(exp.date);
        return expDate >= startDate && expDate <= endDate;
      })
    );
  }

  // Apply filters with AND logic between types, OR within each type
  const relevantExpenses = allExpensesInRange.filter((exp: any) => {
    // Filter 1: Categories (OR logic)
    if (budget.categoryIds && budget.categoryIds.length > 0) {
      // Check if expense category matches any of the budget categories (including folder descendants)
      let matchesCategory = false;
      for (const budgetCategoryId of budget.categoryIds) {
        const category = categories.find((c) => c.id === budgetCategoryId);
        if (category) {
          const categoryIds = category.isFolder
            ? categoryToDescendantsMap.get(budgetCategoryId) || []
            : [budgetCategoryId];
          
          if (categoryIds.includes(exp.categoryId)) {
            matchesCategory = true;
            break;
          }
        }
      }
      if (!matchesCategory) return false; // AND logic: must pass category filter
    }

    // Filter 2: Include Tags (OR logic)
    if (budget.includeTagIds && budget.includeTagIds.length > 0) {
      if (!exp.tags || exp.tags.length === 0) {
        return false; // No tags on expense, but budget requires tags
      }
      const hasIncludedTag = budget.includeTagIds.some((tagId) =>
        exp.tags.includes(tagId)
      );
      if (!hasIncludedTag) return false; // AND logic: must have at least one included tag
    }

    // Filter 3: Exclude Tags (OR logic for exclusion)
    if (budget.excludeTagIds && budget.excludeTagIds.length > 0) {
      if (exp.tags && exp.tags.length > 0) {
        const hasExcludedTag = budget.excludeTagIds.some((tagId) =>
          exp.tags.includes(tagId)
        );
        if (hasExcludedTag) return false; // AND logic: must NOT have any excluded tags
      }
    }

    // Filter 4: Accounts (OR logic)
    if (budget.accountIds && budget.accountIds.length > 0) {
      if (!budget.accountIds.includes(exp.accountId)) {
        return false; // AND logic: must be from one of the specified accounts
      }
    }

    return true; // Passed all filters
  });

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
