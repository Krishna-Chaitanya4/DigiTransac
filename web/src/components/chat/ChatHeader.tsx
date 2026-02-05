import { memo } from 'react';
import { getDisplayName } from '../../services/conversationService';
import type { ConversationDetailResponse } from '../../types/conversations';

interface ChatHeaderProps {
  conversation: ConversationDetailResponse;
  showSearchBar: boolean;
  onToggleSearch: () => void;
  onBack: () => void;
}

export const ChatHeader = memo(function ChatHeader({
  conversation,
  showSearchBar,
  onToggleSearch,
  onBack,
}: ChatHeaderProps) {
  const displayName = getDisplayName(conversation.counterpartyName, conversation.counterpartyEmail);

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
      {/* Back button (mobile) */}
      <button
        onClick={onBack}
        className="md:hidden p-1 -ml-1 text-gray-500 hover:text-gray-700 dark:text-gray-400"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
        {displayName.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{displayName}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {conversation.counterpartyEmail}
        </p>
      </div>

      {/* Search button */}
      <button
        onClick={onToggleSearch}
        className={`p-2 rounded-full transition-colors ${
          showSearchBar
            ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
        title="Search messages"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>
    </div>
  );
});
