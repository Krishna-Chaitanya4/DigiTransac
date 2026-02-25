import { useRef, useMemo, useState, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Transaction, TransactionUIType } from '../types/transactions';
import type { Account } from '../services/accountService';
import type { Label, Tag } from '../types/labels';
import { getCurrencySymbol, formatCurrency } from '../services/currencyService';
import { useCurrency } from '../context/CurrencyContext';
import { formatAmount } from '../utils/formatters';
import { isTransactionExcluded } from '../utils/labelExclusion';

// Get display type - only self-transfers show as Transfer
function getDisplayType(transaction: Transaction): TransactionUIType {
  if (transaction.transferToAccountId) {
    return 'Transfer';
  }
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

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

interface VirtualizedTransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  labels: Label[];
  tags: Tag[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: 'Pending' | 'Confirmed') => void;
  onDecline?: (transactionId: string) => void;
  highlightedTransactionId?: string | null;
  isLoading?: boolean;
  statusFilter?: 'Confirmed' | 'Pending' | 'Declined';
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  /** Enable virtualization - recommended for lists > 100 items */
  enableVirtualization?: boolean;
  /** Estimated row height for virtualization */
  estimatedRowHeight?: number;
}

// Flattened list item type
type ListItem = 
  | { type: 'date-header'; date: string; dateString: string; dailyTotal: number }
  | { type: 'transaction'; transaction: Transaction };

export function VirtualizedTransactionList({
  transactions,
  accounts,
  labels,
  tags,
  onEdit,
  onDelete,
  onUpdateStatus,
  onDecline,
  highlightedTransactionId,
  isLoading = false,
  statusFilter,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelection,
  enableVirtualization = true,
  estimatedRowHeight = 72,
}: VirtualizedTransactionListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { formatWithConversion, primaryCurrency, convert } = useCurrency();

  // Lookup maps
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const labelMap = useMemo(() => new Map(labels.map(l => [l.id, l])), [labels]);
  const tagMap = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);

  // Group transactions by date
  const { flattenedItems, groupedTransactions } = useMemo(() => {
    const grouped: Record<string, Transaction[]> = {};
    
    for (const t of transactions) {
      const d = new Date(t.date);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(t);
    }

    const sortedDates = Object.keys(grouped).sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );

    // Calculate daily totals (excluding transactions whose labels are all excluded from calculations)
    const dailyTotals: Record<string, number> = {};
    for (const date of sortedDates) {
      dailyTotals[date] = grouped[date].reduce((sum, t) => {
        // Only Confirmed transactions count toward daily totals
        if (t.status !== 'Confirmed') return sum;
        // Skip fully-excluded transactions from daily totals
        if (isTransactionExcluded(t, labelMap)) return sum;
        const convertedAmount = convert(t.amount, t.currency);
        if (t.type === 'Receive') return sum + convertedAmount;
        if (t.type === 'Send') return sum - convertedAmount;
        return sum;
      }, 0);
    }

    // Flatten for virtualization
    const items: ListItem[] = [];
    for (const date of sortedDates) {
      items.push({ 
        type: 'date-header', 
        date: formatDate(date), 
        dateString: date,
        dailyTotal: dailyTotals[date],
      });
      for (const transaction of grouped[date]) {
        items.push({ type: 'transaction', transaction });
      }
    }

    return { flattenedItems: items, groupedTransactions: grouped };
  }, [transactions, convert, labelMap]);

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flattenedItems[index];
      if (item.type === 'date-header') return 40;
      if (expandedId === item.transaction.id) return 200;
      return estimatedRowHeight;
    },
    overscan: 5,
  });

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  // Loading skeleton
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

  // Empty state
  if (transactions.length === 0) {
    const emptyStateConfig = {
      Pending: {
        icon: '⏰',
        title: 'No pending transactions',
        description: 'All caught up! You have no transactions awaiting review.',
      },
      Declined: {
        icon: '🚫',
        title: 'No declined transactions',
        description: "You haven't declined any transactions yet.",
      },
      Confirmed: {
        icon: '💵',
        title: 'No transactions found',
        description: 'Add your first transaction to get started',
      },
    };
    const config = statusFilter ? emptyStateConfig[statusFilter] : emptyStateConfig.Confirmed;

    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">{config.icon}</div>
        <p className="text-gray-500 dark:text-gray-400">{config.title}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{config.description}</p>
      </div>
    );
  }

  // Non-virtualized rendering for small lists
  if (!enableVirtualization || transactions.length < 50) {
    return (
      <div className="space-y-6">
        {Object.keys(groupedTransactions)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
          .map(dateString => {
            const dateTransactions = groupedTransactions[dateString];
            const displayDate = formatDate(dateString);
            const dailyTotal = dateTransactions.reduce((sum, t) => {
              // Only Confirmed transactions count toward daily totals
              if (t.status !== 'Confirmed') return sum;
              // Skip fully-excluded transactions from daily totals
              if (isTransactionExcluded(t, labelMap)) return sum;
              const convertedAmount = convert(t.amount, t.currency);
              if (t.type === 'Receive') return sum + convertedAmount;
              if (t.type === 'Send') return sum - convertedAmount;
              return sum;
            }, 0);

            return (
              <div key={dateString}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {displayDate}
                  </h3>
                  <span className={`text-sm font-medium ${dailyTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {dailyTotal >= 0 ? '+' : '-'}{formatCurrency(Math.abs(dailyTotal), primaryCurrency)}
                  </span>
                </div>
                <div className="space-y-2">
                  {dateTransactions.map(transaction => (
                    <TransactionItem
                      key={transaction.id}
                      transaction={transaction}
                      accountMap={accountMap}
                      labelMap={labelMap}
                      tagMap={tagMap}
                      isExpanded={expandedId === transaction.id}
                      isHighlighted={highlightedTransactionId === transaction.id}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(transaction.id)}
                      formatWithConversion={formatWithConversion}
                      onToggleExpand={handleToggleExpand}
                      onToggleSelection={onToggleSelection}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onUpdateStatus={onUpdateStatus}
                      onDecline={onDecline}
                    />
                  ))}
                </div>
              </div>
            );
          })}
      </div>
    );
  }

  // Virtualized rendering for large lists
  return (
    <div 
      ref={parentRef} 
      className="h-full overflow-auto"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => {
          const item = flattenedItems[virtualRow.index];

          if (item.type === 'date-header') {
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="flex items-center justify-between py-2 px-1 sticky top-0 bg-gray-50 dark:bg-gray-900 z-10">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {item.date}
                  </h3>
                  <span className={`text-sm font-medium ${item.dailyTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {item.dailyTotal >= 0 ? '+' : '-'}{formatCurrency(Math.abs(item.dailyTotal), primaryCurrency)}
                  </span>
                </div>
              </div>
            );
          }

          const transaction = item.transaction;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TransactionItem
                transaction={transaction}
                accountMap={accountMap}
                labelMap={labelMap}
                tagMap={tagMap}
                isExpanded={expandedId === transaction.id}
                isHighlighted={highlightedTransactionId === transaction.id}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(transaction.id)}
                formatWithConversion={formatWithConversion}
                onToggleExpand={handleToggleExpand}
                onToggleSelection={onToggleSelection}
                onEdit={onEdit}
                onDelete={onDelete}
                onUpdateStatus={onUpdateStatus}
                onDecline={onDecline}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Compact transaction item component
interface TransactionItemProps {
  transaction: Transaction;
  accountMap: Map<string, Account>;
  labelMap: Map<string, Label>;
  tagMap: Map<string, Tag>;
  isExpanded: boolean;
  isHighlighted: boolean;
  selectionMode: boolean;
  isSelected: boolean;
  formatWithConversion: (amount: number, currency: string) => { original: string; converted: string | null };
  onToggleExpand: (id: string) => void;
  onToggleSelection?: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: 'Pending' | 'Confirmed') => void;
  onDecline?: (transactionId: string) => void;
}

const TransactionItem = memo(function TransactionItem({
  transaction,
  accountMap,
  labelMap,
  tagMap,
  isExpanded,
  isHighlighted,
  selectionMode,
  isSelected,
  formatWithConversion,
  onToggleExpand,
  onToggleSelection,
  onEdit,
  onDelete,
  onUpdateStatus,
  onDecline,
}: TransactionItemProps) {
  const account = accountMap.get(transaction.accountId);
  const primaryLabel = transaction.splits[0] && labelMap.get(transaction.splits[0].labelId);
  const displayType = getDisplayType(transaction);
  const typeColor = getTypeColor(displayType);
  const typeIcon = getTypeIcon(displayType);
  const currencySymbol = getCurrencySymbol(transaction.currency);
  const { converted } = formatWithConversion(transaction.amount, transaction.currency);

  const isPending = transaction.status === 'Pending';
  const isDeclined = transaction.status === 'Declined';

  return (
    <div
      data-transaction-id={transaction.id}
      onClick={() => onToggleExpand(transaction.id)}
      className={`p-3 rounded-lg cursor-pointer transition-all duration-200
        ${isHighlighted
          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30'
          : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750'}
        ${isSelected ? 'ring-2 ring-blue-400' : ''}
        ${isPending ? 'border-l-4 border-l-yellow-400' : ''}
        ${isDeclined ? 'opacity-60 border-l-4 border-l-red-400' : ''}
        ${!isDeclined && isTransactionExcluded(transaction, labelMap) ? 'opacity-60' : ''}
      `}
    >
      {/* Main Row */}
      <div className="flex items-center gap-3">
        {selectionMode && (
          <div 
            onClick={(e) => { e.stopPropagation(); onToggleSelection?.(transaction.id); }}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center
              ${isSelected 
                ? 'bg-blue-500 border-blue-500 text-white' 
                : 'border-gray-300 dark:border-gray-600'}`}
          >
            {isSelected && <span className="text-xs">✓</span>}
          </div>
        )}
        
        {/* Label Icon */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
          style={{ backgroundColor: primaryLabel?.color ? `${primaryLabel.color}20` : '#e5e7eb' }}>
          {primaryLabel?.icon || '💰'}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {transaction.title || transaction.payee || primaryLabel?.name || 'Transaction'}
            </span>
            {isTransactionExcluded(transaction, labelMap) && (
              <span
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded"
                title="Excluded from calculations"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              </span>
            )}
            {isPending && (
              <span className="px-1.5 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">
                Pending
              </span>
            )}
            {isDeclined && (
              <span className="px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                Declined
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {account?.name || 'Unknown Account'}
          </div>
        </div>

        {/* Amount */}
        <div className="text-right">
          <div className={`font-medium ${typeColor}`}>
            <span className="mr-1">{typeIcon}</span>
            {currencySymbol}{formatAmount(transaction.amount, transaction.currency)}
          </div>
          {converted && (
            <div className="text-xs text-gray-400 dark:text-gray-500">
              ≈ {converted}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
          {/* Tags */}
          {transaction.tags && transaction.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {transaction.tags.map((tagId, index) => {
                const tag = typeof tagId === 'string' ? tagMap.get(tagId) : null;
                return tag ? (
                  <span key={tag.id || index} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
                    #{tag.name}
                  </span>
                ) : null;
              })}
            </div>
          )}

          {/* Notes */}
          {transaction.notes && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{transaction.notes}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {/* Status actions based on current status */}
            {isPending && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdateStatus(transaction.id, 'Confirmed'); }}
                  className="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200"
                >
                  Confirm
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDecline?.(transaction.id); }}
                  className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200"
                >
                  Decline
                </button>
              </>
            )}
            {transaction.status === 'Confirmed' && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdateStatus(transaction.id, 'Pending'); }}
                  className="px-3 py-1.5 text-sm bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg hover:bg-yellow-200"
                >
                  Mark Pending
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDecline?.(transaction.id); }}
                  className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200"
                >
                  Decline
                </button>
              </>
            )}
            {isDeclined && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdateStatus(transaction.id, 'Confirmed'); }}
                  className="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200"
                >
                  Confirm
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdateStatus(transaction.id, 'Pending'); }}
                  className="px-3 py-1.5 text-sm bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg hover:bg-yellow-200"
                >
                  Mark Pending
                </button>
              </>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); onEdit(transaction); }}
              className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200"
            >
              Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(transaction.id); }}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400 rounded-lg hover:bg-gray-200"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default VirtualizedTransactionList;
