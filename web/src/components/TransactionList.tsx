import { useState } from 'react';
import type { Transaction, TransactionType } from '../types/transactions';
import type { Account } from '../services/accountService';
import type { Label, Tag } from '../types/labels';
import { getCurrencySymbol } from '../services/currencyService';

interface TransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  labels: Label[];
  tags: Tag[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onToggleCleared: (id: string, isCleared: boolean) => void;
  isLoading?: boolean;
}

// Get type color
function getTypeColor(type: TransactionType): string {
  switch (type) {
    case 'Credit': return 'text-green-600 dark:text-green-400';
    case 'Debit': return 'text-red-600 dark:text-red-400';
    case 'Transfer': return 'text-blue-600 dark:text-blue-400';
  }
}

// Get type icon
function getTypeIcon(type: TransactionType): string {
  switch (type) {
    case 'Credit': return '↓';
    case 'Debit': return '↑';
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
  onToggleCleared,
  isLoading = false,
}: TransactionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Create lookup maps
  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const labelMap = new Map(labels.map(l => [l.id, l]));
  const tagMap = new Map(tags.map(t => [t.id, t]));
  
  // Group transactions
  const groupedTransactions = groupByDate(transactions);
  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

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
        
        // Calculate daily total
        const dailyTotal = dateTransactions.reduce((sum, t) => {
          if (t.type === 'Credit') return sum + t.amount;
          if (t.type === 'Debit') return sum - t.amount;
          return sum;
        }, 0);
        
        return (
          <div key={dateString}>
            {/* Date Header */}
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {displayDate}
              </h3>
              <span className={`text-sm font-medium ${dailyTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dailyTotal >= 0 ? '+' : ''}{dailyTotal.toFixed(2)}
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
                  <div
                    key={transaction.id}
                    className={`bg-white dark:bg-gray-800 rounded-lg border 
                      ${transaction.isCleared 
                        ? 'border-gray-200 dark:border-gray-700' 
                        : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                      } overflow-hidden transition-all`}
                  >
                    {/* Main Row */}
                    <div
                      className="flex items-center p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      onClick={() => setExpandedId(isExpanded ? null : transaction.id)}
                    >
                      {/* Category Icon */}
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                        style={{ backgroundColor: (primaryLabel?.color || '#6B7280') + '20' }}
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
                          {!transaction.isCleared && (
                            <span className="text-xs px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400 rounded">
                              Pending
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {account?.name}
                          {transaction.payee && ` • ${transaction.payee}`}
                        </div>
                      </div>
                      
                      {/* Amount */}
                      <div className={`text-right flex-shrink-0 ${getTypeColor(transaction.type)}`}>
                        <span className="font-semibold">
                          {transaction.type === 'Credit' ? '+' : transaction.type === 'Debit' ? '-' : ''}
                          {currencySymbol}{transaction.amount.toFixed(2)}
                        </span>
                        <div className="text-xs opacity-70">
                          {getTypeIcon(transaction.type)} {transaction.type}
                        </div>
                      </div>
                      
                      {/* Expand indicator */}
                      <div className="ml-2 text-gray-400">
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
                      <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700">
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
                                      {currencySymbol}{split.amount.toFixed(2)}
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
                        
                        {/* Transfer details */}
                        {transaction.type === 'Transfer' && transaction.transferToAccountId && (
                          <div className="text-sm text-blue-600 dark:text-blue-400 mb-3">
                            → {accountMap.get(transaction.transferToAccountId)?.name || 'Unknown Account'}
                          </div>
                        )}
                        
                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleCleared(transaction.id, !transaction.isCleared);
                            }}
                            className={`flex-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                              transaction.isCleared
                                ? 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                : 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                            }`}
                          >
                            {transaction.isCleared ? '↩ Mark Pending' : '✓ Mark Cleared'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(transaction);
                            }}
                            className="px-3 py-1.5 text-sm rounded-lg border border-blue-300 dark:border-blue-700 
                              text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Delete this transaction?')) {
                                onDelete(transaction.id);
                              }
                            }}
                            className="px-3 py-1.5 text-sm rounded-lg border border-red-300 dark:border-red-700 
                              text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
