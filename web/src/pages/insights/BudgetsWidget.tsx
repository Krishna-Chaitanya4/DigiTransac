import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BudgetCard } from '../../components/budget';
import type { DragProps, SectionId } from './types';
import type { BudgetSummary, Budget } from '../../types/budgets';
import { CollapsibleSection, WidgetWithErrorBoundary } from './InsightWidgets';
import { formatCurrency } from '../../services/currencyService';

interface BudgetsWidgetProps {
  budgetSummary: BudgetSummary | undefined;
  isLoading: boolean;
  collapsedSections: Set<string>;
  toggleSection: (id: SectionId) => void;
  dragProps: DragProps;
}

export function BudgetsWidget({
  budgetSummary,
  isLoading,
  collapsedSections,
  toggleSection,
  dragProps,
}: BudgetsWidgetProps) {
  // Sort budgets by usage (highest first) without mutating source array
  const budgets = budgetSummary?.budgets;
  const sortedBudgets = useMemo(() => {
    if (!budgets) return [];
    return [...budgets].sort((a: Budget, b: Budget) => b.percentUsed - a.percentUsed);
  }, [budgets]);

  const overallPercent = budgetSummary && budgetSummary.totalBudgetAmount > 0
    ? Math.round((budgetSummary.totalSpent / budgetSummary.totalBudgetAmount) * 100)
    : 0;

  const currency = budgetSummary?.primaryCurrency ?? 'INR';

  // Subtitle with active count + warnings
  const subtitle = useMemo(() => {
    if (!budgetSummary) return undefined;
    const parts: string[] = [];
    parts.push(`${budgetSummary.activeBudgets} active`);
    if (budgetSummary.overBudgetCount > 0) parts.push(`${budgetSummary.overBudgetCount} over`);
    else if (budgetSummary.nearLimitCount > 0) parts.push(`${budgetSummary.nearLimitCount} near limit`);
    return parts.join(' · ');
  }, [budgetSummary]);

  return (
    <WidgetWithErrorBoundary name="Budget Tracking">
      <CollapsibleSection
        id="budgets"
        title="Budget Tracking"
        subtitle={subtitle}
        icon={
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
          </svg>
        }
        headerRight={
          <Link
            to="/budgets"
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            View all →
          </Link>
        }
        isCollapsed={collapsedSections.has('budgets')}
        onToggle={toggleSection}
        className="mb-6"
        {...dragProps}
      >
        {isLoading ? (
          <div className="pt-4 space-y-4">
            {/* Overall progress skeleton */}
            <div className="h-16 bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse" />
            {/* Budget cards skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ) : sortedBudgets.length > 0 ? (
          <div className="pt-4 space-y-4">
            {/* Overall Budget Health */}
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Overall Budget
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(budgetSummary!.totalSpent, currency)} / {formatCurrency(budgetSummary!.totalBudgetAmount, currency)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    overallPercent >= 100
                      ? 'bg-red-500'
                      : overallPercent >= 80
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(overallPercent, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs font-medium ${
                  overallPercent >= 100
                    ? 'text-red-600 dark:text-red-400'
                    : overallPercent >= 80
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {overallPercent}% used
                </span>
                <div className="flex items-center gap-2">
                  {(budgetSummary!.overBudgetCount > 0) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      {budgetSummary!.overBudgetCount} over budget
                    </span>
                  )}
                  {(budgetSummary!.nearLimitCount > 0) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                      {budgetSummary!.nearLimitCount} near limit
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Top 3 budget cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {sortedBudgets.slice(0, 3).map((budget: Budget) => (
                <BudgetCard key={budget.id} budget={budget} compact />
              ))}
            </div>

            {sortedBudgets.length > 3 && (
              <div className="text-center">
                <Link
                  to="/budgets"
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  +{sortedBudgets.length - 3} more budget{sortedBudgets.length - 3 !== 1 ? 's' : ''}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-500 dark:text-gray-400 mb-3">No budgets set up yet</p>
            <Link
              to="/budgets"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-blue-600 to-blue-700
                  dark:from-blue-900 dark:to-blue-950 text-white rounded-lg text-sm font-medium
                  hover:from-blue-700 hover:to-blue-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Budget
            </Link>
          </div>
        )}
      </CollapsibleSection>
    </WidgetWithErrorBoundary>
  );
}
