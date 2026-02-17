import { memo } from 'react';
import type { ConversationSummary } from '../../types/conversations';
import { getDisplayName, formatRelativeTime } from '../../services/conversationService';
import { formatCurrency } from '../../services/currencyService';

interface ConversationItemProps {
  conversation: ConversationSummary;
  isSelected: boolean;
  onClick: () => void;
}

export const ConversationItem = memo(function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: ConversationItemProps) {
  const isSelfChat = conversation.isSelfChat ?? false;
  const displayName = isSelfChat
    ? 'Personal'
    : getDisplayName(conversation.counterpartyName, conversation.counterpartyEmail);

  // Determine if last message was a transaction type
  const isTransactionPreview = conversation.lastMessageType === 'Transaction';
  
  // Determine transaction preview color based on direction (Sent = red, Received = green)
  const previewText = conversation.lastMessagePreview ?? '';
  const isSentTransaction = isTransactionPreview && previewText.toLowerCase().startsWith('sent');
  const isReceivedTransaction = isTransactionPreview && previewText.toLowerCase().startsWith('received');
  
  // Check for deleted message/transaction previews
  const isDeletedPreview = previewText === 'This message was deleted' || previewText === 'This transaction was deleted';
  
  // Check if we have transaction totals to show
  const hasTransactions = (conversation.totalSent ?? 0) > 0 || (conversation.totalReceived ?? 0) > 0;
  const currency = conversation.primaryCurrency ?? 'INR';

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left ${
        isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500' : ''
      }`}
    >
      {/* Avatar - special icon for self-chat */}
      {isSelfChat ? (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white flex-shrink-0">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
      ) : (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {displayName}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
            {formatRelativeTime(conversation.lastActivityAt)}
          </span>
        </div>

        {/* Last message preview - enhanced for transactions with directional colors */}
        <p className={`text-sm truncate mt-0.5 ${
          isDeletedPreview
            ? 'text-gray-400 dark:text-gray-500 italic'
            : isSentTransaction
              ? 'text-red-500 dark:text-red-400 font-medium'
              : isReceivedTransaction
                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                : isTransactionPreview
                  ? 'text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400'
        }`}>
          {conversation.lastMessagePreview || 'No messages yet'}
        </p>

        {/* Transaction totals - show for non-self chats with transactions */}
        {!isSelfChat && hasTransactions && (
          <div className="flex items-center gap-3 mt-1 text-xs">
            {(conversation.totalSent ?? 0) > 0 && (
              <span className="text-red-500 dark:text-red-400 flex items-center gap-1">
                <span>↑</span>
                <span>{formatCurrency(conversation.totalSent ?? 0, currency)}</span>
              </span>
            )}
            {(conversation.totalReceived ?? 0) > 0 && (
              <span className="text-green-500 dark:text-green-400 flex items-center gap-1">
                <span>↓</span>
                <span>{formatCurrency(conversation.totalReceived ?? 0, currency)}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Unread badge */}
      {conversation.unreadCount > 0 && (
        <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-medium flex items-center justify-center flex-shrink-0">
          {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
        </span>
      )}
    </button>
  );
});
