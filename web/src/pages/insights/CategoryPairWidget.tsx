import { Link } from 'react-router-dom';
import type { SectionId, DragProps, MobileReorderProps } from './types';
import type { TransactionAnalytics, CategoryBreakdown } from '../../services/transactionService';
import type { TransactionSummary } from '../../types/transactions';
import { convertAndFormat } from './helpers';
import { CollapsibleSection, DragHandle, MobileReorderButtons, WidgetWithErrorBoundary } from './InsightWidgets';

interface CategoryPairWidgetProps {
  analytics: TransactionAnalytics | undefined;
  systemFolders: { incomeCategoryIds: string[]; expenseCategoryIds: string[] };
  incomeCategories: CategoryBreakdown[];
  transactionSummary: TransactionSummary | undefined;
  prevAnalytics: TransactionAnalytics | undefined;
  primaryCurrency: string;
  convert: (amount: number, fromCurrency: string) => number;
  isLoading: boolean;
  collapsedSections: Set<SectionId>;
  toggleSection: (id: SectionId) => void;
  dragOverWidget: string | null;
  dragProps: DragProps;
  mobileReorderProps: MobileReorderProps;
}

export function CategoryPairWidget({
  analytics,
  systemFolders,
  incomeCategories,
  transactionSummary,
  primaryCurrency,
  convert,
  isLoading,
  collapsedSections,
  toggleSection,
  dragOverWidget,
  dragProps,
  mobileReorderProps,
}: CategoryPairWidgetProps) {
  return (
    <WidgetWithErrorBoundary name="Categories">
      <div
        className={`grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 p-1 rounded-lg transition-all duration-200 ${
          dragOverWidget === 'categoryPair' ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
        }`}
        draggable={dragProps.draggable}
        onDragStart={dragProps.onDragStart as unknown as React.DragEventHandler}
        onDragOver={dragProps.onDragOver as unknown as React.DragEventHandler}
        onDragEnd={dragProps.onDragEnd as unknown as React.DragEventHandler}
        onDrop={dragProps.onDrop as unknown as React.DragEventHandler}
      >
        {/* Top Expense Categories - Collapsible */}
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
              <MobileReorderButtons {...mobileReorderProps} />
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
          isCollapsed={collapsedSections.has('categories')}
          onToggle={toggleSection}
        >
          {isLoading ? (
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
          ) : analytics?.topCategories && analytics.topCategories.length > 0 ? (
            <div className="space-y-3 pt-4">
              {analytics.topCategories
                .filter((cat: CategoryBreakdown) => systemFolders.expenseCategoryIds.includes(cat.labelId))
                .slice(0, 6)
                .map((category: CategoryBreakdown) => (
                <div key={category.labelId} className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: category.labelColor ? `${category.labelColor}20` : '#f3f4f6' }}
                  >
                    {category.labelIcon || '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {category.labelName}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {convertAndFormat(category.amount, transactionSummary?.currency, primaryCurrency, convert)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${category.percentage}%`,
                          backgroundColor: category.labelColor || '#ef4444'
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
                    {category.percentage.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No expense transactions in this period</p>
            </div>
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
          isCollapsed={collapsedSections.has('incomeCategories')}
          onToggle={toggleSection}
        >
          {isLoading ? (
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
          ) : incomeCategories.length > 0 ? (
            <div className="space-y-3 pt-4">
              {incomeCategories.slice(0, 6).map((category) => (
                <div key={category.labelId} className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: category.labelColor ? `${category.labelColor}20` : '#f0fdf4' }}
                  >
                    {category.labelIcon || '💰'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {category.labelName}
                      </span>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {convertAndFormat(category.amount, transactionSummary?.currency, primaryCurrency, convert)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${category.percentage}%`,
                          backgroundColor: category.labelColor || '#22c55e'
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
                    {category.percentage.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No income transactions in this period</p>
            </div>
          )}
        </CollapsibleSection>
      </div>
    </WidgetWithErrorBoundary>
  );
}
