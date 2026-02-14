import { memo, useRef, useCallback } from 'react';
import type { ConversationMessage } from '../../types/conversations';
import { formatChatCurrency } from '../../services/conversationService';
import { useCurrency } from '../../context/CurrencyContext';

// Time limits for message actions (in minutes)
export const EDIT_TIME_LIMIT_MINUTES = 15;
export const DELETE_TIME_LIMIT_MINUTES = 60;
export const UNDO_DELETE_WINDOW_MINUTES = 1440; // 24 hours

// Helper to check if a message can still be edited
export const canEditMessage = (msg: ConversationMessage): boolean => {
  if (!msg.isFromMe || msg.type !== 'Text' || msg.isDeleted) return false;
  const createdAt = new Date(msg.createdAt);
  const minutesElapsed = (Date.now() - createdAt.getTime()) / (1000 * 60);
  return minutesElapsed <= EDIT_TIME_LIMIT_MINUTES;
};

// Helper to check if a message can still be deleted
export const canDeleteMessage = (msg: ConversationMessage): boolean => {
  if (!msg.isFromMe || msg.isDeleted) return false;
  const createdAt = new Date(msg.createdAt);
  const minutesElapsed = (Date.now() - createdAt.getTime()) / (1000 * 60);
  return minutesElapsed <= DELETE_TIME_LIMIT_MINUTES;
};

// Helper to check if a deleted message can still be restored (undo)
export const canUndoDelete = (msg: ConversationMessage): boolean => {
  if (!msg.isFromMe || !msg.isDeleted || !msg.deletedAt) return false;
  const deletedAt = new Date(msg.deletedAt);
  const minutesElapsed = (Date.now() - deletedAt.getTime()) / (1000 * 60);
  return minutesElapsed <= UNDO_DELETE_WINDOW_MINUTES;
};

// Helper to get remaining undo time as a human-readable string
const getUndoTimeRemaining = (deletedAt: string): string => {
  const deletedTime = new Date(deletedAt).getTime();
  const expiresAt = deletedTime + UNDO_DELETE_WINDOW_MINUTES * 60 * 1000;
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) return 'expired';
  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const remainingMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  if (remainingHours > 0) return `${remainingHours}h ${remainingMins}m left`;
  return `${remainingMins}m left`;
};

interface MessageBubbleProps {
  message: ConversationMessage;
  showTime: boolean;
  searchQuery?: string;
  isCurrentSearchResult?: boolean;
  counterpartyName?: string | null;
  counterpartyUserId?: string;
  isSelfChat?: boolean; // When true, use isSystemGenerated for left/right positioning
  onMenuOpen: (message: ConversationMessage, position: { x: number; y: number; buttonTop: number }) => void;
  onScrollToReply: (messageId: string) => void;
  onRestore?: (messageId: string) => void;
  onRestoreTransaction?: (transactionId: string) => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  showTime,
  searchQuery = '',
  isCurrentSearchResult = false,
  counterpartyName,
  counterpartyUserId,
  isSelfChat = false,
  onMenuOpen,
  onScrollToReply,
  onRestore,
  onRestoreTransaction,
}: MessageBubbleProps) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { primaryCurrency, formatInPrimaryCurrency } = useCurrency();
  
  // In self-chat: right = user-created, left = system-generated (needs review)
  // In P2P chat: right = my messages, left = counterparty messages
  const isMine = isSelfChat 
    ? !message.isSystemGenerated  // In self-chat, non-system messages go on right
    : message.isFromMe;

  // Long press handlers for mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Capture rect from currentTarget (the element with the handler) before setTimeout,
      // since React synthetic event properties are nullified after the event callback.
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      longPressTimerRef.current = setTimeout(() => {
        onMenuOpen(message, { x: rect.left, y: rect.bottom, buttonTop: rect.top });
      }, 500);
    },
    [message, onMenuOpen]
  );

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleMenuClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      onMenuOpen(message, { x: rect.left, y: rect.bottom, buttonTop: rect.top });
    },
    [message, onMenuOpen]
  );

  // Deleted message (soft-deleted chat message) — check BEFORE type-specific rendering
  // so that undo works for all message types (text, transaction, etc.)
  if (message.isDeleted) {
    const showUndo = canUndoDelete(message) && onRestore;
    return (
      <div
        id={`msg-${message.id}`}
        className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-3`}
      >
        <div className="px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 italic text-sm">
          <span>This message was deleted</span>
          {showUndo && (
            <button
              onClick={() => onRestore(message.id)}
              className="ml-2 text-blue-500 dark:text-blue-400 not-italic font-medium hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
            >
              Undo
            </button>
          )}
        </div>
      </div>
    );
  }

  // Soft-deleted transaction (transaction data still available, within undo window)
  if (message.type === 'Transaction' && message.transaction?.isDeleted) {
    const tx = message.transaction;
    const canUndo = tx.deletedAt && onRestoreTransaction && message.isFromMe &&
      (Date.now() - new Date(tx.deletedAt).getTime()) / (1000 * 60) <= UNDO_DELETE_WINDOW_MINUTES;
    return (
      <div
        id={`msg-${message.id}`}
        className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2`}
      >
        <div className="min-w-[130px] max-w-[190px] rounded-xl p-3 shadow-md bg-gray-200 dark:bg-gray-700 opacity-60">
          <div className="flex flex-col items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-xs italic">This transaction was deleted</span>
            {canUndo && (
              <button
                onClick={() => onRestoreTransaction(tx.transactionId)}
                className="text-xs text-blue-500 dark:text-blue-400 not-italic font-medium hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
              >
                Undo
              </button>
            )}
            {canUndo && tx.deletedAt && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 not-italic">
                {getUndoTimeRemaining(tx.deletedAt)}
              </span>
            )}
          </div>
          {showTime && (
            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 text-right">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Transaction message with hard-deleted transaction (purged, no data available)
  if (message.type === 'Transaction' && !message.transaction) {
    return (
      <div
        id={`msg-${message.id}`}
        className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2`}
      >
        <div className="min-w-[130px] max-w-[190px] rounded-xl p-3 shadow-md bg-gray-200 dark:bg-gray-700 opacity-75">
          <div className="flex flex-col items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-xs italic">This transaction was deleted</span>
          </div>
          {showTime && (
            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 text-right">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Transaction message
  if (message.type === 'Transaction' && message.transaction) {
    const tx = message.transaction;
    const isSent = tx.transactionType === 'Send';
    const isTransfer = message.systemSource === 'Transfer';
    const isRecurring = message.systemSource === 'Recurring';
    const isImport = message.systemSource === 'Import';
    const isPending = tx.status === 'Pending';
    const isDeclined = tx.status === 'Declined';
    
    // Get contextual emoji based on transaction source
    const getSourceIcon = () => {
      if (isTransfer) return '🔄';
      if (isRecurring) return '🔁';
      if (isImport) return '📥';
      return null;
    };
    const sourceIcon = getSourceIcon();
    
    // In self-chat, positioning is based on isSystemGenerated (left = system, right = user-created)
    // In P2P chat, positioning is based on Send/Receive
    const isRightAligned = isSelfChat ? isMine : isSent;
    
    // Determine card background based on status
    const getCardBackground = () => {
      if (isDeclined) return 'bg-gradient-to-br from-gray-400 to-gray-500 text-white opacity-75';
      if (isPending) return 'bg-gradient-to-br from-amber-400 to-orange-500 text-white';
      if (isSent) return 'bg-gradient-to-br from-rose-500 to-red-600 text-white';
      return 'bg-gradient-to-br from-emerald-500 to-green-600 text-white';
    };

    return (
      <div
        id={`msg-${message.id}`}
        className={`flex ${isRightAligned ? 'justify-end' : 'justify-start'} mb-2 group transition-all duration-300`}
      >
        <div className="relative">
          <div
            className={`min-w-[130px] max-w-[190px] rounded-xl p-3 shadow-md ${getCardBackground()}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={clearLongPress}
            onTouchMove={clearLongPress}
          >
            {/* Menu trigger */}
            <button
              onClick={handleMenuClick}
              className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/20 text-white/70 hover:text-white transition-opacity"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Source icon + Status badges */}
            <div className="flex items-center justify-center gap-1.5 mb-2 flex-wrap">
              {/* Source emoji icon */}
              {sourceIcon && (
                <span className="text-lg">{sourceIcon}</span>
              )}
              
              {/* Direction/Status badge */}
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                  isDeclined
                    ? 'bg-white/90 text-gray-600'
                    : isPending
                      ? 'bg-white/90 text-amber-600'
                      : isSent
                        ? 'bg-white/90 text-red-600'
                        : 'bg-white/90 text-green-600'
                }`}
              >
                {isDeclined ? '✗ Declined' : isPending ? '⏳ Pending' : isSent ? '↑ Sent' : '↓ Received'}
              </span>
              
              {/* Source type badge */}
              {isTransfer && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                  Transfer
                </span>
              )}
              {isRecurring && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                  Recurring
                </span>
              )}
              {isImport && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 text-cyan-700">
                  Import
                </span>
              )}
            </div>

            {/* Title if available */}
            {tx.title && (
              <div className="text-xs text-white/90 font-medium text-center mb-1 truncate">
                {tx.title}
              </div>
            )}

            {/* Category badge */}
            {tx.primaryCategory && (
              <div className="flex items-center justify-center gap-1 mb-1.5">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/20 text-white/90"
                  style={tx.primaryCategory.color ? {
                    backgroundColor: `${tx.primaryCategory.color}40`,
                    borderColor: tx.primaryCategory.color,
                    borderWidth: '1px'
                  } : undefined}
                >
                  {tx.primaryCategory.icon && (
                    <span className="text-xs">{tx.primaryCategory.icon}</span>
                  )}
                  <span className="truncate max-w-[80px]">{tx.primaryCategory.name}</span>
                </span>
              </div>
            )}

            {/* Amount */}
            <div className="text-center">
              <div className={`text-xl font-bold tracking-tight ${isDeclined ? 'line-through' : ''}`}>
                {formatChatCurrency(tx.amount, tx.currency)}
              </div>
              {/* Show converted amount if different currency */}
              {tx.currency && tx.currency !== primaryCurrency && (
                <div className="text-xs text-white/80 mt-0.5">
                  ≈ {formatInPrimaryCurrency(tx.amount, tx.currency)}
                </div>
              )}
              {tx.accountName && (
                <div className="text-xs text-white/90 mt-0.5 font-medium truncate">{tx.accountName}</div>
              )}
              {tx.notes && (
                <div className="text-[11px] text-white/80 mt-1 italic truncate max-w-full">"{tx.notes}"</div>
              )}
            </div>
            {showTime && (
              <div className="text-[10px] text-white/70 mt-1.5 text-right">
                {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Text message
  return (
    <div
      id={`msg-${message.id}`}
      className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-3 group transition-all duration-300`}
    >
      <div className={`flex flex-col max-w-xs ${isMine ? 'items-end' : 'items-start'}`}>
        {/* Reply reference - Instagram style */}
        {message.replyTo && (
          <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} mb-1`}>
            <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {message.replyTo.senderUserId === counterpartyUserId
                ? `Replied to ${counterpartyName || 'them'}`
                : 'You replied to yourself'}
            </span>
            <button
              onClick={() => onScrollToReply(message.replyTo!.messageId)}
              className={`px-3 py-2 rounded-2xl cursor-pointer hover:opacity-90 transition-opacity ${
                isMine
                  ? 'bg-blue-300 text-blue-900 dark:bg-blue-400/50 dark:text-white'
                  : 'bg-indigo-100 dark:bg-indigo-800/40 text-indigo-700 dark:text-indigo-200'
              }`}
            >
              <p className="text-sm line-clamp-2">{message.replyTo.contentPreview || 'Message'}</p>
            </button>
          </div>
        )}

        {/* Edited indicator */}
        {message.isEdited && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Edited</span>
        )}

        {/* Message bubble */}
        <div className="relative">
          <div
            className={`px-4 py-2 rounded-2xl select-none touch-none ${
              isMine
                ? 'bg-blue-500 text-white rounded-br-md'
                : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 rounded-bl-md'
            }`}
            onTouchStart={handleTouchStart}
            onTouchEnd={clearLongPress}
            onTouchMove={clearLongPress}
          >
            {/* Menu trigger */}
            <button
              onClick={handleMenuClick}
              className={`absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity ${
                isMine
                  ? 'hover:bg-blue-400/50 text-white/70 hover:text-white'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <p className="text-sm whitespace-pre-wrap break-words pr-6">
              {searchQuery && message.content?.toLowerCase().includes(searchQuery.toLowerCase())
                ? message.content.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                    part.toLowerCase() === searchQuery.toLowerCase() ? (
                      <mark
                        key={i}
                        className={`${
                          isCurrentSearchResult
                            ? 'bg-orange-400 dark:bg-orange-500'
                            : 'bg-yellow-300 dark:bg-yellow-600'
                        } text-inherit rounded px-0.5`}
                      >
                        {part}
                      </mark>
                    ) : (
                      part
                    )
                  )
                : message.content}
            </p>
            {showTime && (
              <div
                className={`flex items-center justify-end gap-1.5 mt-1 ${
                  isMine ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                <span className="text-xs">
                  {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
