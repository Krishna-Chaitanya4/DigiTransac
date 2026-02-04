import { DragEvent } from 'react';
import { CollapsibleSection } from './CollapsibleSection';
import { WidgetWithErrorBoundary } from './WidgetWithErrorBoundary';
import type { SectionId, CounterpartyData } from './types';

interface CounterpartiesResponse {
  counterparties: CounterpartyData[];
}

interface CounterpartiesWidgetProps {
  counterparties: CounterpartiesResponse | undefined;
  isLoading: boolean;
  isCollapsed: boolean;
  onToggle: (id: SectionId) => void;
  formatCurrency: (amount: number, currency: string) => string;
  primaryCurrency: string;
  // Drag props
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDragEnd?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  isDragOver?: boolean;
}

export function CounterpartiesWidget({
  counterparties,
  isLoading,
  isCollapsed,
  onToggle,
  formatCurrency,
  primaryCurrency,
  draggable = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isDragOver = false,
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
        isCollapsed={isCollapsed}
        onToggle={onToggle}
        className="mb-6"
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDrop={onDrop}
        isDragOver={isDragOver}
      >
        {isLoading ? (
          <LoadingSkeleton />
        ) : counterparties && counterparties.counterparties.length > 0 ? (
          <div className="space-y-3 pt-4">
            {counterparties.counterparties.map((cp, index) => {
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
                        {formatCurrency(cp.totalAmount, primaryCurrency)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{cp.transactionCount} transaction{cp.transactionCount !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span>Avg: {formatCurrency(avgAmount, primaryCurrency)}</span>
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
                  {formatCurrency(
                    counterparties.counterparties.reduce((sum, cp) => sum + cp.totalAmount, 0),
                    primaryCurrency
                  )}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState />
        )}
      </CollapsibleSection>
    </WidgetWithErrorBoundary>
  );
}

function LoadingSkeleton() {
  return (
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
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <p>No payee data available</p>
    </div>
  );
}