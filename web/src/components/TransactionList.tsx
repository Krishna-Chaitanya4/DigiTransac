import { useState, memo, useMemo, useCallback } from 'react';
import type { Transaction, TransactionUIType } from '../types/transactions';
import type { Account } from '../services/accountService';
import type { Label, Tag } from '../types/labels';
import { getCurrencySymbol, formatCurrency } from '../services/currencyService';
import { formatAmount } from '../utils/formatters';
import { SwipeableRow, SwipeActionIcon } from './SwipeableRow';
import { useCurrency } from '../context/CurrencyContext';

// Memoized transaction row to prevent unnecessary re-renders
interface TransactionRowProps {
  transaction: Transaction;
  account: Account | undefined;
  primaryLabel: Label | undefined;
  isExpanded: boolean;
  isHighlighted: boolean;
  currencySymbol: string;
  primaryCurrency: string;
  formatWithConversion: (amount: number, currency: string) => { original: string; converted: string | null };
  selectionMode: boolean;
  isSelected: boolean;
  labelMap: Map<string, Label>;
  tagMap: Map<string, Tag>;
  accountMap: Map<string, Account>;
  onToggleExpand: (id: string) => void;
  onToggleSelection?: (id: string) => void;
  onUpdateStatus: (id: string, status: 'Pending' | 'Confirmed') => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onViewLinkedTransaction?: (linkedTransactionId: string, linkedAccountId: string) => void;
}

const TransactionRow = memo(function TransactionRow({
  transaction,
  account,
  primaryLabel,
  isExpanded,
  isHighlighted,
  currencySymbol,
  primaryCurrency,
  formatWithConversion,
  selectionMode,
  isSelected,
  labelMap,
  tagMap,
  accountMap,
  onToggleExpand,
  onToggleSelection,
  onUpdateStatus,
  onEdit,
  onDelete,
  onViewLinkedTransaction,
}: TransactionRowProps) {
  const handleClick = useCallback(() => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection(transaction.id);
    } else {
      onToggleExpand(transaction.id);
    }
  }, [selectionMode, onToggleSelection, onToggleExpand, transaction.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    } else if (e.key === 'Delete' && !selectionMode) {
      e.preventDefault();
      if (confirm('Delete this transaction?')) {
        onDelete(transaction.id);
      }
    }
  }, [handleClick, selectionMode, onDelete, transaction.id]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (onToggleSelection && !selectionMode) {
      e.preventDefault();
      onToggleSelection(transaction.id);
    }
  }, [onToggleSelection, selectionMode, transaction.id]);

  const handleUpdateStatus = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = transaction.status === 'Confirmed' ? 'Pending' : 'Confirmed';
    onUpdateStatus(transaction.id, newStatus);
  }, [onUpdateStatus, transaction.id, transaction.status]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(transaction);
  }, [onEdit, transaction]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this transaction?')) {
      onDelete(transaction.id);
    }
  }, [onDelete, transaction.id]);

  const handleSwipeRight = useCallback(() => {
    const newStatus = transaction.status === 'Confirmed' ? 'Pending' : 'Confirmed';
    onUpdateStatus(transaction.id, newStatus);
  }, [onUpdateStatus, transaction.id, transaction.status]);

  const handleSwipeLeft = useCallback(() => {
    if (confirm('Delete this transaction?')) {
      onDelete(transaction.id);
    }
  }, [onDelete, transaction.id]);

  const isConfirmed = transaction.status === 'Confirmed';
  
  const rightContent = useMemo(() => (
    <SwipeActionIcon
      icon={isConfirmed ? '↩' : '✓'}
      label={isConfirmed ? 'Pending' : 'Confirm'}
    />
  ), [isConfirmed]);

  const leftContent = useMemo(() => (
    <SwipeActionIcon icon="🗑" label="Delete" />
  ), []);

  return (
    <SwipeableRow
      onSwipeRight={handleSwipeRight}
      onSwipeLeft={handleSwipeLeft}
      rightContent={rightContent}
      leftContent={leftContent}
      rightBgColor={isConfirmed ? 'bg-yellow-500' : 'bg-green-500'}
      leftBgColor="bg-red-500"
    >
      <div
        data-transaction-id={transaction.id}
        className={`bg-white dark:bg-gray-800 rounded-lg border 
          ${isConfirmed 
            ? 'border-gray-200 dark:border-gray-700' 
            : 'border-l-4 border-l-yellow-400 border-gray-200 dark:border-gray-700 dark:border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/10'
          } ${selectionMode && isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''} 
          ${isHighlighted ? 'ring-2 ring-blue-500 ring-inset animate-pulse' : ''} overflow-hidden transition-all`}
      >
        {/* Main Row */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-label={`${transaction.title || primaryLabel?.name || 'Transaction'}, ${currencySymbol}${formatAmount(transaction.amount, transaction.currency)}, ${transaction.type}${!isConfirmed ? ', pending' : ''}`}
          className="flex items-center p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onContextMenu={handleContextMenu}
        >
          {/* Selection Checkbox (shown in selection mode) */}
          {selectionMode && (
            <div className="mr-3 flex-shrink-0" aria-hidden="true">
              <div 
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  isSelected
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          )}
          
          {/* Category Icon */}
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
            style={{ backgroundColor: (primaryLabel?.color || '#6B7280') + '20' }}
            aria-hidden="true"
          >
            {primaryLabel?.icon || '📝'}
          </div>
          
          {/* Content */}
          <div className="ml-3 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {transaction.title || primaryLabel?.name || 'Transaction'}
              </span>
              {transaction.parentTransactionId && (
                <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 rounded">
                  🔄
                </span>
              )}
              {transaction.counterpartyEmail && (
                <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded" title={`${transaction.role === 'Sender' ? 'To' : 'From'}: ${transaction.counterpartyEmail}`}>
                  👤
                </span>
              )}
              {!isConfirmed && (
                <span className="text-xs px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400 rounded">
                  {transaction.status}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {account?.name}
              {transaction.payee && ` • ${transaction.payee}`}
            </div>
          </div>
          
          {/* Amount */}
          <div className={`text-right flex-shrink-0 ${getTypeColor(getDisplayType(transaction))}`}>
            <span className="font-semibold">
              {/* Show +/- based on money flow: Receive = +, Send = - */}
              {transaction.type === 'Receive' ? '+' : '-'}
              {currencySymbol}{formatAmount(transaction.amount, transaction.currency)}
            </span>
            {/* Show converted amount if currency differs from primary */}
            {transaction.currency !== primaryCurrency && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                ≈ {formatWithConversion(transaction.amount, transaction.currency).converted}
              </div>
            )}
            <div className="text-xs opacity-70" aria-hidden="true">
              {getTypeIcon(getDisplayType(transaction))} {getDisplayType(transaction)}
            </div>
          </div>
          
          {/* Expand indicator */}
          <div className="ml-2 text-gray-400 dark:text-gray-500" aria-hidden="true">
            <svg 
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        {/* Expanded Details */}
        {isExpanded && (
          <div className="px-3 pb-3 pt-1 border-t border-gray-200 dark:border-gray-700" role="region" aria-label="Transaction details">
            {/* Splits */}
            {transaction.splits.length > 1 && (
              <div className="mb-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Categories:</p>
                <div className="space-y-1">
                  {transaction.splits.map((split, idx) => {
                    const label = labelMap.get(split.labelId);
                    return (
                      <div key={idx} className="flex justify-between text-sm">
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
            
            {/* Tags */}
            {transaction.tagIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {transaction.tagIds.map(tagId => {
                  const tag = tagMap.get(tagId);
                  return tag ? (
                    <span
                      key={tagId}
                      className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700"
                      style={tag.color ? { backgroundColor: tag.color + '30', color: tag.color } : undefined}
                    >
                      {tag.name}
                    </span>
                  ) : null;
                })}
              </div>
            )}
            
            {/* Location */}
            {transaction.location && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                📍 {transaction.location.placeName || transaction.location.city}
                {transaction.location.country && `, ${transaction.location.country}`}
              </div>
            )}
            
            {/* Notes */}
            {transaction.notes && (
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                {transaction.notes}
              </div>
            )}
            
            {/* Transfer details - shown only for self-transfers (between your own accounts) */}
            {transaction.transferToAccountId && transaction.linkedTransactionId && (
              <div className="text-sm mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                    {transaction.type === 'Send' && transaction.transferToAccountId
                      ? `→ ${accountMap.get(transaction.transferToAccountId)?.name || 'Unknown Account'}`
                      : `← From linked transfer`
                    }
                  </div>
                  {onViewLinkedTransaction && (
                    <button
                      onClick={() => {
                        // For Send side with transferToAccountId, the linked receive is in that account
                        // For Receive side, we need to find which account the linked transaction is in
                        const linkedAccountId = transaction.type === 'Send' && transaction.transferToAccountId
                          ? transaction.transferToAccountId
                          : transaction.accountId; // The linked send will show us to navigate there
                        onViewLinkedTransaction(transaction.linkedTransactionId!, linkedAccountId);
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      View linked
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* P2P Transfer details */}
            {transaction.counterpartyEmail && (
              <div className="text-sm mb-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800/30">
                <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  {transaction.role === 'Sender' ? (
                    <span>Sent to <span className="font-medium">{transaction.counterpartyEmail}</span></span>
                  ) : (
                    <span>Received from <span className="font-medium">{transaction.counterpartyEmail}</span></span>
                  )}
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleUpdateStatus}
                className={`flex-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  isConfirmed
                    ? 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    : 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                }`}
              >
                {isConfirmed ? '↩ Mark Pending' : '✓ Confirm'}
              </button>
              <button
                onClick={handleEdit}
                className="px-3 py-1.5 text-sm rounded-lg border border-blue-300 dark:border-blue-700 
                  text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-sm rounded-lg border border-red-300 dark:border-red-700 
                  text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </SwipeableRow>
  );
});

interface TransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  labels: Label[];
  tags: Tag[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: 'Pending' | 'Confirmed') => void;
  onViewLinkedTransaction?: (linkedTransactionId: string, linkedAccountId: string) => void;
  highlightedTransactionId?: string | null;
  isLoading?: boolean;
  /** Selection mode props */
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
}

// Get display type - only self-transfers (with transferToAccountId) show as Transfer
function getDisplayType(transaction: Transaction): TransactionUIType {
  // Self-transfer: has transferToAccountId set (transfer between your own accounts)
  if (transaction.transferToAccountId) {
    return 'Transfer';
  }
  // P2P or regular transaction: show as Send/Receive
  return transaction.type;
}

// Get type color
function getTypeColor(type: TransactionUIType): string {
  switch (type) {
    case 'Receive': return 'text-green-600 dark:text-green-400';
    case 'Send': return 'text-red-600 dark:text-red-400';
    case 'Transfer': return 'text-blue-600 dark:text-blue-400';
  }
}

// Get type icon
function getTypeIcon(type: TransactionUIType): string {
  switch (type) {
    case 'Receive': return '↓';
    case 'Send': return '↑';
    case 'Transfer': return '↔';
  }
}

// Extract YYYY-MM-DD from an ISO date string (stored at noon UTC)
function getDateKey(dateString: string): string {
  return dateString.split('T')[0];
}

// Format date for display
function formatDate(dateString: string): string {
  // Extract the date part from the ISO string (stored at noon UTC)
  const dateKey = getDateKey(dateString);
  const [year, month, day] = dateKey.split('-').map(Number);
  
  // Create date at noon local time for display purposes
  const date = new Date(year, month - 1, day, 12, 0, 0);
  
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  
  if (dateKey === todayKey) {
    return 'Today';
  }
  if (dateKey === yesterdayKey) {
    return 'Yesterday';
  }
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: year !== today.getFullYear() ? 'numeric' : undefined 
  });
}

// Group transactions by date
function groupByDate(transactions: Transaction[]): Record<string, Transaction[]> {
  const groups: Record<string, Transaction[]> = {};
  
  for (const transaction of transactions) {
    // Use the date key (YYYY-MM-DD) for grouping to avoid timezone issues
    const dateKey = getDateKey(transaction.date);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(transaction);
  }
  
  return groups;
}

export function TransactionList({
  transactions,
  accounts,
  labels,
  tags,
  onEdit,
  onDelete,
  onUpdateStatus,
  onViewLinkedTransaction,
  highlightedTransactionId,
  isLoading = false,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelection,
}: TransactionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { formatWithConversion, primaryCurrency, convert } = useCurrency();
  
  // Memoize lookup maps to prevent recreation on every render
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const labelMap = useMemo(() => new Map(labels.map(l => [l.id, l])), [labels]);
  const tagMap = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);
  
  // Memoize grouped transactions
  const { groupedTransactions, sortedDates } = useMemo(() => {
    const grouped = groupByDate(transactions);
    const sorted = Object.keys(grouped).sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );
    return { groupedTransactions: grouped, sortedDates: sorted };
  }, [transactions]);

  // Memoize callbacks for TransactionRow
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  // Calculate daily totals
  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const dateString of sortedDates) {
      const dateTransactions = groupedTransactions[dateString];
      totals[dateString] = dateTransactions.reduce((sum, t) => {
        const convertedAmount = convert(t.amount, t.currency);
        if (t.type === 'Receive') return sum + convertedAmount;
        if (t.type === 'Send') return sum - convertedAmount;
        return sum;
      }, 0);
    }
    return totals;
  }, [sortedDates, groupedTransactions, convert]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
        </div>
        <p className="text-gray-500 dark:text-gray-400">No transactions found</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Add your first transaction to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map(dateString => {
        const dateTransactions = groupedTransactions[dateString];
        const displayDate = formatDate(dateTransactions[0].date);
        const dailyTotal = dailyTotals[dateString];
        
        return (
          <div key={dateString}>
            {/* Date Header */}
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {displayDate}
              </h3>
              <span className={`text-sm font-medium ${dailyTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {dailyTotal >= 0 ? '+' : '-'}{formatCurrency(Math.abs(dailyTotal), primaryCurrency)}
              </span>
            </div>
            
            {/* Transactions for this date */}
            <div className="space-y-2">
              {dateTransactions.map(transaction => {
                const account = accountMap.get(transaction.accountId);
                const currencySymbol = getCurrencySymbol(transaction.currency);
                const primaryLabel = transaction.splits[0] && labelMap.get(transaction.splits[0].labelId);
                const isExpanded = expandedId === transaction.id;
                
                return (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    account={account}
                    primaryLabel={primaryLabel}
                    isExpanded={isExpanded}
                    isHighlighted={highlightedTransactionId === transaction.id}
                    currencySymbol={currencySymbol}
                    primaryCurrency={primaryCurrency}
                    formatWithConversion={formatWithConversion}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(transaction.id)}
                    labelMap={labelMap}
                    tagMap={tagMap}
                    accountMap={accountMap}
                    onToggleExpand={handleToggleExpand}
                    onToggleSelection={onToggleSelection}
                    onUpdateStatus={onUpdateStatus}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onViewLinkedTransaction={onViewLinkedTransaction}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
