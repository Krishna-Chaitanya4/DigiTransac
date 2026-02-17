import type { DragProps, SectionId } from './types';
import type { TopCounterpartiesResponse, CounterpartySpending } from '../../types/transactions';
import { convertAndFormat } from './helpers';
import { CollapsibleSection, WidgetWithErrorBoundary } from './InsightWidgets';

interface CounterpartiesWidgetProps {
  counterparties: TopCounterpartiesResponse | undefined;
  counterpartiesLoading: boolean;
  primaryCurrency: string;
  convert: (amount: number, fromCurrency: string) => number;
  collapsedSections: Set<string>;
  toggleSection: (id: SectionId) => void;
  dragProps: DragProps;
}

export function CounterpartiesWidget({
  counterparties,
  counterpartiesLoading,
  primaryCurrency,
  convert,
  collapsedSections,
  toggleSection,
  dragProps,
}: CounterpartiesWidgetProps) {
  return (
    <WidgetWithErrorBoundary name="Top Payees">
      <CollapsibleSection
        id="counterparties"
        title="Top Payees"
        subtitle={counterparties ? `${counterparties.counterparties.length} payees` : undefined}
        icon={
          <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        }
        isCollapsed={collapsedSections.has('counterparties')}
        onToggle={toggleSection}
        className="mb-6"
        {...dragProps}
      >
        {counterpartiesLoading ? (
          <div className="space-y-3 pt-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
                  <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : counterparties && counterparties.counterparties.length > 0 ? (
          <div className="space-y-3 pt-4">
            {counterparties.counterparties.map((cp: CounterpartySpending, index: number) => {
              const avgAmount = cp.transactionCount > 0 ? cp.totalAmount / cp.transactionCount : 0;
              return (
                <div key={cp.name} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                    {cp.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {cp.name}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {convertAndFormat(cp.totalAmount, counterparties?.currency, primaryCurrency, convert)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{cp.transactionCount} transaction{cp.transactionCount !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span>Avg: {convertAndFormat(avgAmount, counterparties?.currency, primaryCurrency, convert)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 w-6 text-right">
                    #{index + 1}
                  </div>
                </div>
              );
            })}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Total from top payees</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {convertAndFormat(
                    counterparties.counterparties.reduce((sum: number, cp: CounterpartySpending) => sum + cp.totalAmount, 0),
                    counterparties?.currency,
                    primaryCurrency,
                    convert
                  )}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p>No payee data available</p>
          </div>
        )}
      </CollapsibleSection>
    </WidgetWithErrorBoundary>
  );
}
