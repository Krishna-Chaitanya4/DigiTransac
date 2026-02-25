import { memo } from 'react';
import type { ConversationDetailResponse } from '../../types/conversations';
import { usePresence } from '../../context/PresenceContext';

interface ChatHeaderEnhancedProps {
  conversation: ConversationDetailResponse;
  showSearchBar: boolean;
  onToggleSearch: () => void;
  onBack: () => void;
}

/**
 * Enhanced ChatHeader with balance summary
 * Mobile-first design with compact info display
 */
export const ChatHeaderEnhanced = memo(function ChatHeaderEnhanced({
  conversation,
  showSearchBar,
  onToggleSearch,
  onBack,
}: ChatHeaderEnhancedProps) {
  const { isOnline } = usePresence();
  const isSelfChat = conversation.isSelfChat ?? false;
  // Use counterpartyName from API (which returns "Personal" for self-chat)
  const displayName = conversation.counterpartyName || conversation.counterpartyEmail;

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 safe-area-top">
      {/* Main header row */}
      <div className="flex items-center gap-2 px-2 py-2 sm:px-4 sm:py-3">
        {/* Back button - prominent on mobile */}
        <button
          onClick={onBack}
          className="md:hidden p-2 -ml-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors touch-manipulation"
          aria-label="Back to conversations"
        >
          <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Avatar and name */}
        <div
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          {/* Avatar */}
          {isSelfChat ? (
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-amber-500 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          ) : (
            <div className="relative">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0 shadow-sm">
                {displayName?.charAt(0).toUpperCase()}
              </div>
              {/* Online indicator - real presence tracking */}
              {isOnline(conversation.counterpartyUserId) && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
              )}
            </div>
          )}

          {/* Name */}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-base sm:text-lg">
              {displayName}
            </h2>
            
            {/* Self-chat subtitle */}
            {isSelfChat && (
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Track personal expenses & transfers
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Search toggle */}
          <button
            onClick={onToggleSearch}
            className={`p-2.5 rounded-full transition-colors touch-manipulation ${
              showSearchBar
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200'
            }`}
            aria-label="Search messages"
            aria-pressed={showSearchBar}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          
          {/* More options (desktop) */}
          <button
            className="hidden sm:block p-2.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="More options"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});

export default ChatHeaderEnhanced;