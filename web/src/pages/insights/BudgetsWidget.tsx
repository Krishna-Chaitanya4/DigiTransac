import { Link } from 'react-router-dom';
import { BudgetCard } from '../../components/budget';
import type { DragProps, SectionId } from './types';
import type { BudgetSummary, Budget } from '../../types/budgets';
import { CollapsibleSection, WidgetWithErrorBoundary } from './InsightWidgets';

interface BudgetsWidgetProps {
  budgetSummary: BudgetSummary | undefined;
  collapsedSections: Set<string>;
  toggleSection: (id: SectionId) => void;
  dragProps: DragProps;
}

export function BudgetsWidget({
  budgetSummary,
  collapsedSections,
  toggleSection,
  dragProps,
}: BudgetsWidgetProps) {
  return (
    <WidgetWithErrorBoundary name="Budget Tracking">
      <CollapsibleSection
        id="budgets"
        title="Budget Tracking"
        subtitle={`${budgetSummary?.activeBudgets ?? 0} active budget${budgetSummary?.activeBudgets !== 1 ? 's' : ''}${(budgetSummary?.overBudgetCount ?? 0) > 0 ? ` • ${budgetSummary?.overBudgetCount} over budget` : ''}`}
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
        {/* Show top 3 budgets that need attention */}
        {budgetSummary?.budgets && budgetSummary.budgets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
            {budgetSummary.budgets
              .sort((a: Budget, b: Budget) => b.percentUsed - a.percentUsed) // Sort by usage, highest first
              .slice(0, 3)
              .map((budget: Budget) => (
                <BudgetCard key={budget.id} budget={budget} compact />
              ))}
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
