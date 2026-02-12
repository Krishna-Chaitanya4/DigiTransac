import { useState, useMemo, useCallback } from 'react';
import type { Transaction, TransactionUIType } from '../types/transactions';
import type { Account } from '../services/accountService';
import type { Label, Tag } from '../types/labels';
import { getCurrencySymbol } from '../services/currencyService';
import { formatAmount } from '../utils/formatters';
import { useCurrency } from '../context/CurrencyContext';

// ── Helpers ──────────────────────────────────────────────────────

function getDisplayType(transaction: Transaction): TransactionUIType {
  if (transaction.transferToAccountId) return 'Transfer';
  return transaction.type;
}

function getDateKey(transaction: Transaction): string {
  if (transaction.dateLocal) return transaction.dateLocal;
  return transaction.date.split('T')[0];
}

function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (dateKey === todayKey) return 'Today';
  if (dateKey === yesterdayKey) return 'Yesterday';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: year !== today.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTime(transaction: Transaction): string {
  if (transaction.timeLocal) return transaction.timeLocal;
  try {
    const d = new Date(transaction.date);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

const dotColors: Record<TransactionUIType, string> = {
  Receive: 'bg-green-500',
  Send: 'bg-red-500',
  Transfer: 'bg-blue-500',
};

const lineColors: Record<TransactionUIType, string> = {
  Receive: 'ring-green-200 dark:ring-green-800',
  Send: 'ring-red-200 dark:ring-red-800',
  Transfer: 'ring-blue-200 dark:ring-blue-800',
};

// ── Component ────────────────────────────────────────────────────

interface ActivityTimelineProps {
  transactions: Transaction[];
  accounts: Account[];
  labels: Label[];
  tags: Tag[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  highlightedTransactionId?: string | null;
  isLoading?: boolean;
}

export function ActivityTimeline({
  transactions,
  accounts,
  labels,
  onEdit,
  onDelete,
  highlightedTransactionId,
  isLoading = false,
}: ActivityTimelineProps) {
  const { formatWithConversion, primaryCurrency } = useCurrency();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const labelMap = useMemo(() => new Map(labels.map(l => [l.id, l])), [labels]);

  // Group by date
  const { groups, sortedDates } = useMemo(() => {
    const g: Record<string, Transaction[]> = {};
    for (const t of transactions) {
      const key = getDateKey(t);
      (g[key] ||= []).push(t);
    }
    const sorted = Object.keys(g).sort((a, b) => b.localeCompare(a));
    return { groups: g, sortedDates: sorted };
  }, [transactions]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <div className="pl-8 space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse flex gap-3">
            <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 mt-1 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-14 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Empty state ──
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p>No transactions to show in timeline.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {sortedDates.map((dateKey, dateIdx) => {
        const dayTransactions = groups[dateKey];
        const dateLabel = formatDateLabel(dateKey);

        return (
          <div key={dateKey} className="relative">
            {/* ── Date header ── */}
            <div className="flex items-center gap-3 mb-3 mt-1">
              {/* Big date dot on the line */}
              <div className="relative z-10 flex-shrink-0 w-8 flex justify-center">
                <div className="w-4 h-4 rounded-full bg-gray-800 dark:bg-gray-200 ring-4 ring-gray-200 dark:ring-gray-700" />
              </div>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 tracking-wide">
                {dateLabel}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {dayTransactions.length} transaction{dayTransactions.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* ── Transactions for this date ── */}
            {dayTransactions.map((transaction, tIdx) => {
              const account = accountMap.get(transaction.accountId);
              const primaryLabel = transaction.splits[0] && labelMap.get(transaction.splits[0].labelId);
              const displayType = getDisplayType(transaction);
              const currencySymbol = getCurrencySymbol(transaction.currency);
              const time = formatTime(transaction);
              const isExpanded = expandedId === transaction.id;
              const isHighlighted = highlightedTransactionId === transaction.id;
              const isLast = dateIdx === sortedDates.length - 1 && tIdx === dayTransactions.length - 1;

              return (
                <div key={transaction.id} className="relative flex" data-transaction-id={transaction.id}>
                  {/* Vertical line + dot */}
                  <div className="relative flex-shrink-0 w-8 flex justify-center">
                    {/* Vertical connector – hidden for the very last item */}
                    {!isLast && (
                      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-gray-200 dark:bg-gray-700" />
                    )}
                    {/* Dot */}
                    <div
                      className={`relative z-10 mt-4 w-3 h-3 rounded-full ${dotColors[displayType]} ring-2 ${lineColors[displayType]} flex-shrink-0`}
                    />
                  </div>

                  {/* Card */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(transaction.id)}
                    className={`flex-1 mb-3 ml-2 rounded-xl border text-left transition-all
                      ${isHighlighted ? 'ring-2 ring-blue-500 animate-pulse' : ''}
                      ${isExpanded
                        ? 'bg-gray-50 dark:bg-gray-750 border-gray-300 dark:border-gray-600 shadow-sm'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                  >
                    {/* Main row */}
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      {/* Icon */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                        style={{ backgroundColor: (primaryLabel?.color || '#6B7280') + '20' }}
                      >
                        {primaryLabel?.icon || '📝'}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                            {transaction.title || primaryLabel?.name || 'Transaction'}
                          </span>
                          {!transaction.status || transaction.status === 'Pending' ? (
                            <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400 rounded">
                              Pending
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {account?.name}
                          {transaction.payee && ` · ${transaction.payee}`}
                          {time && ` · ${time}`}
                        </div>
                      </div>

                      {/* Amount */}
                      <div className={`text-right flex-shrink-0 ${
                        displayType === 'Receive'
                          ? 'text-green-600 dark:text-green-400'
                          : displayType === 'Send'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-blue-600 dark:text-blue-400'
                      }`}>
                        <span className="font-semibold text-sm">
                          {transaction.type === 'Receive' ? '+' : '-'}
                          {currencySymbol}{formatAmount(transaction.amount, transaction.currency)}
                        </span>
                        {transaction.currency !== primaryCurrency && (
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">
                            ≈ {formatWithConversion(transaction.amount, transaction.currency).converted}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700 space-y-2">
                        {/* Splits */}
                        {transaction.splits.length > 1 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Categories</p>
                            <div className="space-y-0.5">
                              {transaction.splits.map((split, idx) => {
                                const label = labelMap.get(split.labelId);
                                return (
                                  <div key={idx} className="flex justify-between text-xs">
                                    <span className="text-gray-600 dark:text-gray-300">
                                      {label?.icon} {label?.name || 'Unknown'}
                                    </span>
                                    <span className="text-gray-900 dark:text-gray-100">
                                      {currencySymbol}{formatAmount(split.amount, transaction.currency)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Location */}
                        {transaction.location && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            📍 {transaction.location.placeName || transaction.location.city}
                            {transaction.location.country && `, ${transaction.location.country}`}
                          </p>
                        )}

                        {/* Notes */}
                        {transaction.notes && (
                          <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                            {transaction.notes}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onEdit(transaction); }}
                            className="px-3 py-1.5 text-xs rounded-lg border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDelete(transaction.id); }}
                            className="px-3 py-1.5 text-xs rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}