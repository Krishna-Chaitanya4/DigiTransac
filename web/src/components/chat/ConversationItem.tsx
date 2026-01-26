import { memo } from 'react';
import type { ConversationSummary } from '../../types/conversations';
import { getDisplayName, formatRelativeTime, formatChatCurrency } from '../../services/conversationService';

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
  const displayName = getDisplayName(conversation.counterpartyName, conversation.counterpartyEmail);

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left ${
        isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500' : ''
      }`}
    >
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
        {displayName.charAt(0).toUpperCase()}
      </div>

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

        <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-0.5">
          {conversation.lastMessagePreview || 'No messages yet'}
        </p>

        {/* Amount summary */}
        <div className="flex items-center gap-3 mt-1.5">
          {(conversation.totalSent ?? 0) > 0 && (
            <span className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-0.5">
              <span>↑</span>
              {formatChatCurrency(conversation.totalSent!, conversation.primaryCurrency)}
            </span>
          )}
          {(conversation.totalReceived ?? 0) > 0 && (
            <span className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-0.5">
              <span>↓</span>
              {formatChatCurrency(conversation.totalReceived!, conversation.primaryCurrency)}
            </span>
          )}
        </div>
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
