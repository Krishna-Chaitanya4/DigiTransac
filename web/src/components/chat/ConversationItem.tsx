import { memo } from 'react';
import type { ConversationSummary } from '../../types/conversations';
import { getDisplayName, formatRelativeTime } from '../../services/conversationService';

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
    ? 'Personal Transactions' 
    : getDisplayName(conversation.counterpartyName, conversation.counterpartyEmail);

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

        <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-0.5">
          {conversation.lastMessagePreview || 'No messages yet'}
        </p>
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
