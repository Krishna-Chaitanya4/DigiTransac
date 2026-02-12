import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAccounts, useTransactions, useLabels } from '../hooks';
import { useCurrency } from '../context/CurrencyContext';
import { accountTypeConfig, formatCurrency } from '../services/accountService';
import { Sparkline } from '../components/Sparkline';
import EmptyState from '../components/EmptyState';
import type { TransactionFilter } from '../types/transactions';

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { primaryCurrency, formatWithConversion } = useCurrency();
  
  const { data: accounts = [], isLoading: isLoadingAccounts } = useAccounts(true);
  const { data: labels = [] } = useLabels();
  const account = accounts.find(a => a.id === id);

  // Fetch recent transactions for this account (last 30 transactions)
  const filter: TransactionFilter = useMemo(() => ({
    accountIds: id ? [id] : [],
    pageSize: 30,
  }), [id]);

  const { data: transactionData, isLoading: isLoadingTxns } = useTransactions(filter, !!id);
  const transactions = transactionData?.transactions ?? [];

  // Build sparkline data from transactions (balance running total)
  const sparklineData = useMemo(() => {
    if (!account || transactions.length === 0) return [];
    // Transactions are usually sorted newest first, reverse for chronological
    const sorted = [...transactions].reverse();
    let runningBalance = account.currentBalance;
    // Work backward from current balance
    const adjustments = sorted.map(t => {
      const isDebit = t.type === 'Send';
      return isDebit ? t.amount : -t.amount;
    });
    // Compute balances from end to start
    const balances: number[] = [runningBalance];
    for (let i = adjustments.length - 1; i >= 0; i--) {
      runningBalance += adjustments[i];
      balances.unshift(runningBalance);
    }
    // Take last 30 points max
    return balances.slice(-30);
  }, [account, transactions]);

  // Category breakdown from transactions
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { labelId: string; name: string; icon: string; total: number; count: number }>();
    for (const t of transactions) {
      for (const split of t.splits) {
        const label = labels.find(l => l.id === split.labelId);
        const key = split.labelId;
        const existing = map.get(key);
        if (existing) {
          existing.total += split.amount;
          existing.count += 1;
        } else {
          map.set(key, {
            labelId: key,
            name: label?.name || 'Unknown',
            icon: label?.icon || '📁',
            total: split.amount,
            count: 1,
          });
        }
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [transactions, labels]);

  if (isLoadingAccounts) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Account not found</p>
        <Link to="/accounts" className="text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to Accounts
        </Link>
      </div>
    );
  }

  const config = accountTypeConfig[account.type];
  const balanceColor = config.isLiability
    ? account.currentBalance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
    : account.currentBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/accounts')}
        className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Accounts
      </button>

      {/* Account Header */}
      <div className="bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl"
            style={{ backgroundColor: account.color || config.defaultColor }}
          >
            {config.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{account.name}</h1>
              {account.isDefault && (
                <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">Default</span>
              )}
              {account.isArchived && (
                <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">Archived</span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {config.label}
              {account.institution ? ` • ${account.institution}` : ''}
              {account.accountNumber ? ` • ${account.accountNumber}` : ''}
            </p>
          </div>
        </div>

        {/* Balance */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Current Balance</p>
            <p className={`text-3xl font-bold ${balanceColor}`}>
              {formatCurrency(config.isLiability ? -account.currentBalance : account.currentBalance, account.currency)}
            </p>
            {account.currency !== primaryCurrency && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                ≈ {formatWithConversion(account.currentBalance, account.currency).converted}
              </p>
            )}
          </div>
          {/* Balance Sparkline */}
          {sparklineData.length >= 2 && (
            <div className="w-32 h-12">
              <Sparkline
                data={sparklineData}
                width={128}
                height={48}
                color={config.isLiability ? '#ef4444' : '#10b981'}
              />
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Transactions</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{transactionData?.totalCount ?? '—'}</p>
        </div>
        <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Currency</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{account.currency}</p>
        </div>
        <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Net Worth</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {account.includeInNetWorth ? '✓' : '✕'}
          </p>
        </div>
      </div>

      {/* Top Categories */}
      {categoryBreakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Top Categories</h2>
          <div className="space-y-2">
            {categoryBreakdown.map(cat => {
              const maxTotal = categoryBreakdown[0].total;
              const barWidth = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0;
              return (
                <div key={cat.labelId} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{cat.name}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 ml-2">
                        {formatCurrency(cat.total, account.currency)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-8 text-right">{cat.count}×</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent Transactions</h2>
          <Link
            to={`/transactions?account=${id}`}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all →
          </Link>
        </div>

        {isLoadingTxns ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            variant="transactions"
            title="No transactions yet"
            description="Transactions for this account will appear here once you add them."
            compact
          />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-600">
            {transactions.slice(0, 10).map(t => {
              const primaryLabel = labels.find(l => l.id === t.splits[0]?.labelId);
              const isDebit = t.type === 'Send';
              const displayDate = t.dateLocal || t.date.split('T')[0];
              return (
                <div key={t.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-lg w-7 text-center">{primaryLabel?.icon || (isDebit ? '📤' : '📥')}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                      {t.title || t.payee || primaryLabel?.name || (isDebit ? 'Sent' : 'Received')}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{displayDate}</p>
                  </div>
                  <span className={`text-sm font-medium ${isDebit ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {isDebit ? '−' : '+'}{formatCurrency(t.amount, t.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Account Notes */}
      {account.notes && (
        <div className="bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-5 mt-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Notes</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{account.notes}</p>
        </div>
      )}
    </div>
  );
}