import { useMemo } from 'react';
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
  // Sort by transaction count (most frequent first)
  const sorted = useMemo(
    () => counterparties?.counterparties ? [...counterparties.counterparties].sort((a, b) => b.transactionCount - a.transactionCount) : [],
    [counterparties]
  );
  const totalTransactions = sorted.reduce((sum, cp) => sum + cp.transactionCount, 0);

  return (
    <WidgetWithErrorBoundary name="Frequent Contacts">
      <CollapsibleSection
        id="counterparties"
        title="Frequent Contacts"
        subtitle={counterparties ? `${sorted.length} contacts` : undefined}
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
        ) : sorted.length > 0 ? (
          <div className="space-y-3 pt-4">
            {sorted.map((cp: CounterpartySpending) => {
              const activityPct = totalTransactions > 0
                ? Math.round((cp.transactionCount / totalTransactions) * 100)
                : 0;
              const net = cp.totalCredits - cp.totalDebits;
              return (
                <div key={cp.name} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                      {cp.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {cp.name}
                          </span>
                          {cp.type === 'P2P' && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 shrink-0">
                              P2P
                            </span>
                          )}
                        </div>
                        <span className={`text-sm font-semibold shrink-0 ${
                          net >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {net >= 0 ? '+' : ''}{convertAndFormat(Math.abs(net), counterparties?.currency, primaryCurrency, convert)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span>{cp.transactionCount} txn{cp.transactionCount !== 1 ? 's' : ''}</span>
                        <span>·</span>
                        <span className="text-red-500 dark:text-red-400">
                          ↑{convertAndFormat(cp.totalDebits, counterparties?.currency, primaryCurrency, convert)}
                        </span>
                        <span>·</span>
                        <span className="text-green-500 dark:text-green-400">
                          ↓{convertAndFormat(cp.totalCredits, counterparties?.currency, primaryCurrency, convert)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Activity bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-500"
                        style={{ width: `${Math.min(activityPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right shrink-0">
                      {activityPct}%
                    </span>
                  </div>
                </div>
              );
            })}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Total from frequent contacts</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {convertAndFormat(
                    sorted.reduce((sum: number, cp: CounterpartySpending) => sum + cp.totalAmount, 0),
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
            <p>No recipient data available</p>
          </div>
        )}
      </CollapsibleSection>
    </WidgetWithErrorBoundary>
  );
}
