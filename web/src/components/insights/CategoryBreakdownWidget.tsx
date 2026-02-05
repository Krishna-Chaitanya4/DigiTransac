import { Link } from 'react-router-dom';
import { CollapsibleSection } from './CollapsibleSection';
import { DragHandle } from './DragHandle';
import { WidgetWithErrorBoundary } from './WidgetWithErrorBoundary';
import type { SectionId, CategoryData } from './types';

interface CategoryBreakdownWidgetProps {
  expenseCategories: CategoryData[];
  incomeCategories: CategoryData[];
  isLoading: boolean;
  expenseCollapsed: boolean;
  incomeCollapsed: boolean;
  onToggle: (id: SectionId) => void;
  formatCurrency: (amount: number, currency: string) => string;
  primaryCurrency: string;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export function CategoryBreakdownWidget({
  expenseCategories,
  incomeCategories,
  isLoading,
  expenseCollapsed,
  incomeCollapsed,
  onToggle,
  formatCurrency,
  primaryCurrency,
  isDragOver = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: CategoryBreakdownWidgetProps) {
  return (
    <WidgetWithErrorBoundary name="Categories">
      <div
        className={`grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 p-1 rounded-lg transition-all duration-200 ${
          isDragOver ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
        }`}
        draggable={true}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDrop={onDrop}
      >
        {/* Top Expense Categories */}
        <CollapsibleSection
          id="categories"
          title="Top Spending Categories"
          icon={
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
          headerRight={
            <>
              <DragHandle />
              <Link
                to="/transactions"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View all →
              </Link>
            </>
          }
          isCollapsed={expenseCollapsed}
          onToggle={onToggle}
        >
          {isLoading ? (
            <CategorySkeleton />
          ) : expenseCategories.length > 0 ? (
            <div className="space-y-3 pt-4">
              {expenseCategories.slice(0, 6).map((category) => (
                <CategoryRow
                  key={category.labelId}
                  category={category}
                  formatCurrency={formatCurrency}
                  primaryCurrency={primaryCurrency}
                />
              ))}
            </div>
          ) : (
            <EmptyState message="No expense transactions in this period" />
          )}
        </CollapsibleSection>

        {/* Top Income Categories */}
        <CollapsibleSection
          id="incomeCategories"
          title="Top Income Sources"
          icon={
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          }
          headerRight={
            <Link
              to="/transactions"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View all →
            </Link>
          }
          isCollapsed={incomeCollapsed}
          onToggle={onToggle}
        >
          {isLoading ? (
            <CategorySkeleton />
          ) : incomeCategories.length > 0 ? (
            <div className="space-y-3 pt-4">
              {incomeCategories.slice(0, 6).map((category) => (
                <CategoryRow
                  key={category.labelId}
                  category={category}
                  formatCurrency={formatCurrency}
                  primaryCurrency={primaryCurrency}
                  isIncome
                />
              ))}
            </div>
          ) : (
            <EmptyState message="No income transactions in this period" icon="💰" />
          )}
        </CollapsibleSection>
      </div>
    </WidgetWithErrorBoundary>
  );
}

// Category Row Component
function CategoryRow({
  category,
  formatCurrency,
  primaryCurrency,
  isIncome = false,
}: {
  category: CategoryData;
  formatCurrency: (amount: number, currency: string) => string;
  primaryCurrency: string;
  isIncome?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
        style={{ backgroundColor: category.labelColor ? `${category.labelColor}20` : isIncome ? '#f0fdf4' : '#f3f4f6' }}
      >
        {category.labelIcon || (isIncome ? '💰' : '📦')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {category.labelName}
          </span>
          <span className={`text-sm font-semibold ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
            {formatCurrency(category.amount, primaryCurrency)}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: `${category.percentage}%`,
              backgroundColor: category.labelColor || (isIncome ? '#22c55e' : '#ef4444')
            }}
          />
        </div>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
        {category.percentage.toFixed(0)}%
      </span>
    </div>
  );
}

// Loading skeleton
function CategorySkeleton() {
  return (
    <div className="space-y-3 pt-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full" />
          </div>
          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// Empty state
function EmptyState({ message }: { message: string; icon?: string }) {
  return (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p>{message}</p>
    </div>
  );
}