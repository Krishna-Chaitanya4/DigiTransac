import { useState, memo, useMemo, useCallback, useRef } from 'react';
import type { Transaction, TransactionUIType } from '../types/transactions';
import type { Account } from '../services/accountService';
import type { Label, Tag } from '../types/labels';
import { getCurrencySymbol, formatCurrency } from '../services/currencyService';
import { formatAmount } from '../utils/formatters';
import { isLabelEffectivelyExcluded, isTransactionExcluded } from '../utils/labelExclusion';
import { SwipeableRow, SwipeActionIcon } from './SwipeableRow';
import { useCurrency } from '../context/CurrencyContext';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useHaptics } from '../hooks/useHaptics';

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
  onLongPress?: (transaction: Transaction) => void;
  onUpdateStatus: (id: string, status: 'Pending' | 'Confirmed') => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onViewLinkedTransaction?: (linkedTransactionId: string, linkedAccountId: string) => void;
  onAcceptP2P?: (transaction: Transaction) => void;
  onDecline?: (transactionId: string) => void;
  onViewInChat?: (transaction: Transaction) => void;
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
  onLongPress,
  onUpdateStatus,
  onEdit,
  onDelete,
  onViewLinkedTransaction,
  onAcceptP2P,
  onDecline,
  onViewInChat,
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
      onDelete(transaction.id);
    }
  }, [handleClick, selectionMode, onDelete, transaction.id]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (onToggleSelection && !selectionMode) {
      e.preventDefault();
      onToggleSelection(transaction.id);
    }
  }, [onToggleSelection, selectionMode, transaction.id]);

  // Long press handler for mobile quick actions
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!onLongPress || selectionMode) return;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onLongPress(transaction);
    }, 500);
  }, [onLongPress, selectionMode, transaction]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      touchStartPos.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
    if (longPressTriggered.current) {
      e.preventDefault();
      longPressTriggered.current = false;
    }
  }, []);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
    longPressTriggered.current = false;
  }, []);

  const handleUpdateStatus = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // For P2P pending transactions (no accountId), open form to assign account before confirming
    if (transaction.status === 'Pending' && !transaction.accountId && transaction.transactionLinkId) {
      onAcceptP2P?.(transaction);
      return;
    }
    const newStatus = transaction.status === 'Confirmed' ? 'Pending' : 'Confirmed';
    onUpdateStatus(transaction.id, newStatus);
  }, [onUpdateStatus, onAcceptP2P, transaction]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(transaction);
  }, [onEdit, transaction]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(transaction.id);
  }, [onDelete, transaction.id]);

  const handleViewInChat = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onViewInChat?.(transaction);
  }, [onViewInChat, transaction]);

  const handleSwipeRight = useCallback(() => {
    const newStatus = transaction.status === 'Confirmed' ? 'Pending' : 'Confirmed';
    onUpdateStatus(transaction.id, newStatus);
  }, [onUpdateStatus, transaction.id, transaction.status]);

  const handleSwipeLeft = useCallback(() => {
    onDelete(transaction.id);
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
          ${isHighlighted ? 'ring-2 ring-blue-500 ring-inset bg-blue-50 dark:bg-blue-900/20' : ''}
          ${isTransactionExcluded(transaction, labelMap) ? 'opacity-60' : ''} overflow-hidden transition-all`}
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
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
                    const splitExcluded = isLabelEffectivelyExcluded(split.labelId, labelMap);
                    return (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className={`text-gray-600 dark:text-gray-300 ${splitExcluded ? 'opacity-60' : ''}`}>
                          {label?.icon} {label?.name || 'Unknown'}
                          {splitExcluded && (
                            <svg className="w-3 h-3 inline ml-1 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                          )}
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
                  {transaction.lastSyncedAt && (
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400" title={`Updated ${new Date(transaction.lastSyncedAt).toLocaleString()}`}>
                      (Edited)
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              {isConfirmed ? (
                /* Confirmed transaction actions */
                <>
                  <button
                    onClick={handleUpdateStatus}
                    className="flex-1 px-3 py-2.5 min-h-[44px] text-sm rounded-lg border border-gray-300 dark:border-gray-600
                      text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                  >
                    ↩ Mark Pending
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDecline?.(transaction.id); }}
                    className="px-3 py-2.5 min-h-[44px] text-sm rounded-lg border border-orange-300 dark:border-orange-700
                      text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors touch-manipulation"
                  >
                    ✗ Decline
                  </button>
                  <button
                    onClick={handleEdit}
                    className="px-3 py-2.5 min-h-[44px] text-sm rounded-lg border border-blue-300 dark:border-blue-700
                      text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 touch-manipulation"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-2.5 min-h-[44px] text-sm rounded-lg border border-red-300 dark:border-red-700
                      text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 touch-manipulation"
                  >
                    Delete
                  </button>
                </>
              ) : transaction.status === 'Pending' ? (
                /* Pending transaction actions */
                <>
                  <button
                    onClick={handleUpdateStatus}
                    className="flex-1 px-3 py-2.5 min-h-[44px] text-sm rounded-lg border border-green-300 dark:border-green-700
                      text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors touch-manipulation"
                  >
                    ✓ Confirm
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDecline?.(transaction.id); }}
                    className="px-3 py-2.5 min-h-[44px] text-sm rounded-lg border border-orange-300 dark:border-orange-700
                      text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors touch-manipulation"
                  >
                    ✗ Decline
                  </button>
                  <button
                    onClick={handleEdit}
                    className="px-3 py-2.5 min-h-[44px] text-sm rounded-lg border border-blue-300 dark:border-blue-700
                      text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 touch-manipulation"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-2.5 min-h-[44px] text-sm rounded-lg border border-red-300 dark:border-red-700
                      text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 touch-manipulation"
                  >
                    Delete
                  </button>
                </>
              ) : (
                /* Declined transaction actions */
                <>
                  <button
                    onClick={handleUpdateStatus}
                    className="flex-1 px-3 py-2.5 min-h-[44px] text-sm rounded-lg border border-green-300 dark:border-green-700
                      text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors touch-manipulation"
                  >
                    ✓ Confirm
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(transaction.id, 'Pending'); }}
                    className="px-3 py-2.5 min-h-[44px] text-sm rounded-lg border border-gray-300 dark:border-gray-600
                      text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                  >
                    ↩ Mark Pending
                  </button>
                  <button
                    onClick={handleEdit}
                    className="px-3 py-2.5 min-h-[44px] text-sm rounded-lg border border-blue-300 dark:border-blue-700
                      text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 touch-manipulation"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-2.5 min-h-[44px] text-sm rounded-lg border border-red-300 dark:border-red-700
                      text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 touch-manipulation"
                  >
                    Delete
                  </button>
                </>
              )}
              {/* View in Chat - only if transaction has a chat message */}
              {transaction.chatMessageId && onViewInChat && (
                <button
                  onClick={handleViewInChat}
                  className="px-3 py-2.5 min-h-[44px] text-sm rounded-lg border border-purple-300 dark:border-purple-700
                    text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors touch-manipulation"
                  title="View this transaction in chat"
                >
                  💬 Chat
                </button>
              )}
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
  onAcceptP2P?: (transaction: Transaction) => void;
  onDecline?: (transactionId: string) => void;
  onViewInChat?: (transaction: Transaction) => void;
  highlightedTransactionId?: string | null;
  isLoading?: boolean;
  /** Current status filter for empty state messaging */
  statusFilter?: 'Confirmed' | 'Pending' | 'Declined';
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

// Get the calendar date key for grouping transactions.
// WhatsApp-style: derive the local calendar date from the UTC timestamp
// using the viewer's device timezone.
function getDateKey(transaction: Transaction): string {
  const d = new Date(transaction.date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Format date for display using a transaction (WhatsApp-style: UTC → viewer's local TZ)
function formatDateFromTransaction(transaction: Transaction): string {
  const dateKey = getDateKey(transaction);
  const d = new Date(transaction.date);
  
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
  
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
  });
}

// Group transactions by date (WhatsApp-style: UTC → viewer's local calendar date)
function groupByDate(transactions: Transaction[]): Record<string, Transaction[]> {
  const groups: Record<string, Transaction[]> = {};
  
  for (const transaction of transactions) {
    const dateKey = getDateKey(transaction);
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
  onAcceptP2P,
  onDecline,
  onViewInChat,
  highlightedTransactionId,
  isLoading = false,
  statusFilter,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelection,
}: TransactionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [longPressTransaction, setLongPressTransaction] = useState<Transaction | null>(null);
  const isMobile = useIsMobile();
  const haptics = useHaptics();
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

  // Long press handler — shows quick action bottom sheet on mobile
  const handleLongPress = useCallback((transaction: Transaction) => {
    haptics.heavy();
    setLongPressTransaction(transaction);
  }, [haptics]);

  // Calculate daily totals (excluding transactions whose labels are all excluded from calculations)
  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const dateString of sortedDates) {
      const dateTransactions = groupedTransactions[dateString];
      totals[dateString] = dateTransactions.reduce((sum, t) => {
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
    return totals;
  }, [sortedDates, groupedTransactions, convert, labelMap]);

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
    // Status-specific empty states
    const emptyStateConfig = {
      Pending: {
        icon: (
          <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        ),
        title: 'No pending transactions',
        description: 'All caught up! You have no transactions awaiting review.',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      },
      Declined: {
        icon: (
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        ),
        title: 'No declined transactions',
        description: 'You haven\'t declined any transactions yet.',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
      },
      Confirmed: {
        icon: (
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
        ),
        title: 'No transactions found',
        description: 'Add your first transaction to get started',
        bgColor: 'bg-gray-100 dark:bg-gray-700',
      },
    };
    
    const config = statusFilter ? emptyStateConfig[statusFilter] : emptyStateConfig.Confirmed;
    
    return (
      <div className="text-center py-12">
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${config.bgColor} flex items-center justify-center`}>
          {config.icon}
        </div>
        <p className="text-gray-500 dark:text-gray-400">{config.title}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          {config.description}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map(dateString => {
        const dateTransactions = groupedTransactions[dateString];
        const displayDate = formatDateFromTransaction(dateTransactions[0]);
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
                    onLongPress={isMobile ? handleLongPress : undefined}
                    onUpdateStatus={onUpdateStatus}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onViewLinkedTransaction={onViewLinkedTransaction}
                    onAcceptP2P={onAcceptP2P}
                    onDecline={onDecline}
                    onViewInChat={onViewInChat}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Long-press Quick Action Bottom Sheet (mobile only) */}
      {longPressTransaction && isMobile && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
            onClick={() => setLongPressTransaction(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl animate-slide-up safe-area-bottom">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            {/* Transaction info header */}
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: (labelMap.get(longPressTransaction.splits[0]?.labelId)?.color || '#6B7280') + '20' }}
                >
                  {labelMap.get(longPressTransaction.splits[0]?.labelId)?.icon || '📝'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {longPressTransaction.title || labelMap.get(longPressTransaction.splits[0]?.labelId)?.name || 'Transaction'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {getCurrencySymbol(longPressTransaction.currency)}{formatAmount(longPressTransaction.amount, longPressTransaction.currency)}
                    {' · '}{longPressTransaction.status}
                  </p>
                </div>
              </div>
            </div>
            {/* Quick actions */}
            <div className="py-2">
              <button
                onClick={() => {
                  setLongPressTransaction(null);
                  onEdit(longPressTransaction);
                }}
                className="w-full flex items-center gap-4 px-5 py-3.5 min-h-[52px] text-left text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700 touch-manipulation"
              >
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
                <span className="text-base font-medium">Edit</span>
              </button>
              <button
                onClick={() => {
                  setLongPressTransaction(null);
                  const newStatus = longPressTransaction.status === 'Confirmed' ? 'Pending' : 'Confirmed';
                  onUpdateStatus(longPressTransaction.id, newStatus as 'Pending' | 'Confirmed');
                }}
                className="w-full flex items-center gap-4 px-5 py-3.5 min-h-[52px] text-left text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700 touch-manipulation"
              >
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  {longPressTransaction.status === 'Confirmed' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  )}
                </svg>
                <span className="text-base font-medium">
                  {longPressTransaction.status === 'Confirmed' ? 'Mark Pending' : 'Confirm'}
                </span>
              </button>
              {onToggleSelection && (
                <button
                  onClick={() => {
                    setLongPressTransaction(null);
                    onToggleSelection(longPressTransaction.id);
                  }}
                  className="w-full flex items-center gap-4 px-5 py-3.5 min-h-[52px] text-left text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700 touch-manipulation"
                >
                  <svg className="w-5 h-5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span className="text-base font-medium">Select</span>
                </button>
              )}
              <button
                onClick={() => {
                  setLongPressTransaction(null);
                  onDelete(longPressTransaction.id);
                }}
                className="w-full flex items-center gap-4 px-5 py-3.5 min-h-[52px] text-left text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20 touch-manipulation"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                <span className="text-base font-medium">Delete</span>
              </button>
            </div>
            <div className="px-4 pb-4 pt-1">
              <button
                onClick={() => setLongPressTransaction(null)}
                className="w-full py-3 min-h-[48px] text-center text-base font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-xl active:bg-gray-200 dark:active:bg-gray-600 touch-manipulation"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
