import { useMemo } from 'react';
import type { DragProps, SectionId } from './types';
import type { SpendingByAccountResponse } from '../../types/transactions';
import type { Account } from '../../services/accountService';
import { convertAndFormat } from './helpers';
import { CollapsibleSection, WidgetWithErrorBoundary } from './InsightWidgets';

const ACCOUNT_ICONS: Record<string, string> = {
  Bank: '🏦',
  CreditCard: '💳',
  Cash: '💵',
  DigitalWallet: '📱',
  Investment: '📈',
  Loan: '🏠',
};

interface AccountActivityWidgetProps {
  spendingByAccount: SpendingByAccountResponse | undefined;
  accounts: Account[] | undefined;
  byAccountLoading: boolean;
  primaryCurrency: string;
  convert: (amount: number, fromCurrency: string) => number;
  collapsedSections: Set<string>;
  toggleSection: (id: SectionId) => void;
  dragProps: DragProps;
}

export function AccountActivityWidget({
  spendingByAccount,
  accounts,
  byAccountLoading,
  primaryCurrency,
  convert,
  collapsedSections,
  toggleSection,
  dragProps,
}: AccountActivityWidgetProps) {
  // Enrich account spending with icon from accounts list
  const enrichedAccounts = useMemo(() => {
    if (!spendingByAccount?.accounts) return [];
    const accountMap = new Map(accounts?.map(a => [a.id, a]) ?? []);
    return spendingByAccount.accounts
      .map(as => ({
        ...as,
        type: accountMap.get(as.accountId)?.type ?? 'Bank',
        color: accountMap.get(as.accountId)?.color ?? null,
      }))
      .sort((a, b) => b.transactionCount - a.transactionCount);
  }, [spendingByAccount, accounts]);

  const totalTransactions = enrichedAccounts.reduce((sum, a) => sum + a.transactionCount, 0);

  return (
    <WidgetWithErrorBoundary name="Account Activity">
      <CollapsibleSection
        id="byAccount"
        title="Account Activity"
        subtitle={spendingByAccount ? `${enrichedAccounts.length} account${enrichedAccounts.length !== 1 ? 's' : ''} · ${totalTransactions} txn${totalTransactions !== 1 ? 's' : ''}` : undefined}
        icon={
          <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        }
        isCollapsed={collapsedSections.has('byAccount')}
        onToggle={toggleSection}
        className="mb-6"
        {...dragProps}
      >
        {byAccountLoading ? (
          <div className="space-y-3 pt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 w-28 bg-gray-200 dark:bg-gray-600 rounded mb-2" />
                    <div className="h-3 w-20 bg-gray-200 dark:bg-gray-600 rounded" />
                  </div>
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-600 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : enrichedAccounts.length > 0 ? (
          <div className="space-y-3 pt-4">
            {enrichedAccounts.map((account) => {
              const activityPct = totalTransactions > 0
                ? Math.round((account.transactionCount / totalTransactions) * 100)
                : 0;
              const net = account.totalCredits - account.totalDebits;

              return (
                <div key={account.accountId} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {/* Account icon */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                      style={{
                        backgroundColor: account.color
                          ? `${account.color}20`
                          : 'rgb(236 254 255)', // cyan-50
                      }}
                    >
                      {ACCOUNT_ICONS[account.type] ?? '💰'}
                    </div>

                    {/* Name + stats */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {account.accountName}
                        </span>
                        <span className={`text-sm font-semibold shrink-0 ${
                          net >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {net >= 0 ? '+' : ''}{convertAndFormat(Math.abs(net), spendingByAccount?.currency, primaryCurrency, convert)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span>{account.transactionCount} txn{account.transactionCount !== 1 ? 's' : ''}</span>
                        <span>·</span>
                        <span className="text-red-500 dark:text-red-400">
                          ↑{convertAndFormat(account.totalDebits, spendingByAccount?.currency, primaryCurrency, convert)}
                        </span>
                        <span>·</span>
                        <span className="text-green-500 dark:text-green-400">
                          ↓{convertAndFormat(account.totalCredits, spendingByAccount?.currency, primaryCurrency, convert)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Activity bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-cyan-500 dark:bg-cyan-400 transition-all duration-500"
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
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <p>No account activity in this period</p>
          </div>
        )}
      </CollapsibleSection>
    </WidgetWithErrorBoundary>
  );
}
