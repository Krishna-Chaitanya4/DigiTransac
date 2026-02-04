import { DragEvent } from 'react';
import { CollapsibleSection } from './CollapsibleSection';
import { WidgetWithErrorBoundary } from './WidgetWithErrorBoundary';
import type { SectionId, AccountSpendingData } from './types';

interface SpendingByAccountResponse {
  accounts: AccountSpendingData[];
}

interface SpendingByAccountWidgetProps {
  spendingByAccount: SpendingByAccountResponse | undefined;
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

export function SpendingByAccountWidget({
  spendingByAccount,
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
}: SpendingByAccountWidgetProps) {
  return (
    <WidgetWithErrorBoundary name="Spending by Account">
      <CollapsibleSection
        id="byAccount"
        title="Spending by Account"
        subtitle={spendingByAccount ? `${spendingByAccount.accounts.length} account${spendingByAccount.accounts.length !== 1 ? 's' : ''}` : undefined}
        icon={
          <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
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
        ) : spendingByAccount && spendingByAccount.accounts.length > 0 ? (
          <div className="space-y-3 pt-4">
            {spendingByAccount.accounts.map((account) => (
              <div key={account.accountId} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-cyan-100 dark:bg-cyan-900/30">
                  🏦
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {account.accountName}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(account.totalDebits, primaryCurrency)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300 bg-cyan-500"
                      style={{
                        width: `${account.percentage}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">
                  {account.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Total spending</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(
                    spendingByAccount.accounts.reduce((sum, acc) => sum + acc.totalDebits, 0),
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
      {[1, 2, 3].map((i) => (
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

function EmptyState() {
  return (
    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
      <p>No account spending data</p>
    </div>
  );
}