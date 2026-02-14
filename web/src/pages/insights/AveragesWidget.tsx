import type { DragProps } from './types';
import { convertAndFormat } from './helpers';
import { CollapsibleSection, ComparisonBadge, WidgetWithErrorBoundary } from './InsightWidgets';

interface AveragesWidgetProps {
  analytics: any;
  prevAnalytics: any;
  transactionSummary: any;
  primaryCurrency: string;
  convert: (amount: number, fromCurrency: string) => number;
  collapsedSections: Set<string>;
  toggleSection: (id: any) => void;
  dragProps: DragProps;
}

export function AveragesWidget({
  analytics,
  prevAnalytics,
  transactionSummary,
  primaryCurrency,
  convert,
  collapsedSections,
  toggleSection,
  dragProps,
}: AveragesWidgetProps) {
  if (!analytics?.averagesByType) return null;

  return (
    <WidgetWithErrorBoundary name="Transaction Averages">
      <CollapsibleSection
        id="averages"
        title="Transaction Averages"
        icon={
          <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        }
        isCollapsed={collapsedSections.has('averages')}
        onToggle={toggleSection}
        {...dragProps}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-sm text-green-600 dark:text-green-400 mb-1">Avg. Income</div>
            <div className="text-xl font-bold text-green-700 dark:text-green-300">
              {convertAndFormat(analytics.averagesByType.averageCredit, transactionSummary?.currency, primaryCurrency, convert)}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">per transaction</div>
            {prevAnalytics?.averagesByType && (
              <div className="mt-2">
                <ComparisonBadge
                  current={analytics.averagesByType.averageCredit}
                  previous={prevAnalytics.averagesByType.averageCredit}
                  invertColors={false}
                  label=""
                />
              </div>
            )}
          </div>
          <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-sm text-red-600 dark:text-red-400 mb-1">Avg. Expense</div>
            <div className="text-xl font-bold text-red-700 dark:text-red-300">
              {convertAndFormat(analytics.averagesByType.averageDebit, transactionSummary?.currency, primaryCurrency, convert)}
            </div>
            <div className="text-xs text-red-600 dark:text-red-400 mt-1">per transaction</div>
            {prevAnalytics?.averagesByType && (
              <div className="mt-2">
                <ComparisonBadge
                  current={analytics.averagesByType.averageDebit}
                  previous={prevAnalytics.averagesByType.averageDebit}
                  invertColors={true}
                  label=""
                />
              </div>
            )}
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Avg. Transfer</div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {convertAndFormat(analytics.averagesByType.averageTransfer, transactionSummary?.currency, primaryCurrency, convert)}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">per transaction</div>
            {prevAnalytics?.averagesByType && (
              <div className="mt-2">
                <ComparisonBadge
                  current={analytics.averagesByType.averageTransfer}
                  previous={prevAnalytics.averagesByType.averageTransfer}
                  invertColors={false}
                  label=""
                />
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>
    </WidgetWithErrorBoundary>
  );
}
