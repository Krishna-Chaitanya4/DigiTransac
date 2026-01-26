import { memo, useRef, useCallback } from 'react';
import type { ConversationMessage } from '../../types/conversations';
import { formatChatCurrency } from '../../services/conversationService';

// Time limits for message actions (in minutes)
export const EDIT_TIME_LIMIT_MINUTES = 15;
export const DELETE_TIME_LIMIT_MINUTES = 60;

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

interface MessageBubbleProps {
  message: ConversationMessage;
  showTime: boolean;
  searchQuery?: string;
  isCurrentSearchResult?: boolean;
  counterpartyName?: string | null;
  counterpartyUserId?: string;
  onMenuOpen: (message: ConversationMessage, position: { x: number; y: number; buttonTop: number }) => void;
  onScrollToReply: (messageId: string) => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  showTime,
  searchQuery = '',
  isCurrentSearchResult = false,
  counterpartyName,
  counterpartyUserId,
  onMenuOpen,
  onScrollToReply,
}: MessageBubbleProps) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMine = message.isFromMe;

  // Long press handlers for mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      longPressTimerRef.current = setTimeout(() => {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
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

  // Transaction message
  if (message.type === 'Transaction' && message.transaction) {
    const tx = message.transaction;
    const isSent = tx.transactionType === 'Send';

    return (
      <div
        id={`msg-${message.id}`}
        className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-3 group transition-all duration-300`}
      >
        <div className="relative">
          <div
            className={`max-w-xs rounded-2xl p-4 ${
              isSent
                ? 'bg-gradient-to-br from-red-500 to-red-600 text-white'
                : 'bg-gradient-to-br from-green-500 to-green-600 text-white'
            }`}
          >
            {/* Menu trigger */}
            <button
              onClick={handleMenuClick}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/20 text-white/70 hover:text-white transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Status badge */}
            <div className="flex items-center justify-center gap-1 mb-2">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  isSent ? 'bg-red-400/30' : 'bg-green-400/30'
                }`}
              >
                {isSent ? '↑ Sent' : '↓ Received'}
              </span>
            </div>

            {/* Amount */}
            <div className="text-center">
              <div className="text-2xl font-bold">{formatChatCurrency(tx.amount, tx.currency)}</div>
              {tx.accountName && <div className="text-sm opacity-80 mt-1">{tx.accountName}</div>}
              {tx.notes && <div className="text-sm opacity-80 mt-1 italic">"{tx.notes}"</div>}
              {showTime && (
                <div className="text-xs opacity-60 mt-2">
                  {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Deleted message
  if (message.isDeleted) {
    return (
      <div
        id={`msg-${message.id}`}
        className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-3`}
      >
        <div className="px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 italic text-sm">
          This message was deleted
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
