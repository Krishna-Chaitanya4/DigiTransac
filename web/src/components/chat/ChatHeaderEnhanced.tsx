import { memo, useState } from 'react';
import type { ConversationDetailResponse } from '../../types/conversations';
import { formatChatCurrency } from '../../services/conversationService';

interface ChatHeaderEnhancedProps {
  conversation: ConversationDetailResponse;
  showSearchBar: boolean;
  onToggleSearch: () => void;
  onBack: () => void;
  isConnected?: boolean; // SignalR connection status
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
  isConnected = true,
}: ChatHeaderEnhancedProps) {
  const [showBalanceDetails, setShowBalanceDetails] = useState(false);
  
  const isSelfChat = conversation.isSelfChat ?? false;
  // Use counterpartyName from API (which returns "Personal" for self-chat)
  const displayName = conversation.counterpartyName || conversation.counterpartyEmail;
  
  // Calculate balance summary
  const totalSent = conversation.totalSent || 0;
  const totalReceived = conversation.totalReceived || 0;
  const netBalance = totalReceived - totalSent; // Positive = they owe you
  
  const hasBalance = totalSent > 0 || totalReceived > 0;

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
        <button
          onClick={() => hasBalance && setShowBalanceDetails(!showBalanceDetails)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left touch-manipulation"
          disabled={!hasBalance}
        >
          {/* Avatar */}
          {isSelfChat ? (
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          ) : (
            <div className="relative">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0 shadow-sm">
                {displayName?.charAt(0).toUpperCase()}
              </div>
              {/* Online indicator */}
              {isConnected && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />
              )}
            </div>
          )}

          {/* Name and balance summary */}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-base sm:text-lg">
              {displayName}
            </h2>
            
            {/* Quick balance summary - compact on mobile */}
            {hasBalance && !isSelfChat && (
              <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                {netBalance > 0 ? (
                  <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                    Owes you {formatChatCurrency(Math.abs(netBalance), 'INR')}
                  </span>
                ) : netBalance < 0 ? (
                  <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                    </svg>
                    You owe {formatChatCurrency(Math.abs(netBalance), 'INR')}
                  </span>
                ) : (
                  <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Settled up
                  </span>
                )}
                
                {/* Expand indicator */}
                <svg 
                  className={`w-3 h-3 text-gray-400 transition-transform ${showBalanceDetails ? 'rotate-180' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
            
            {/* Self-chat subtitle */}
            {isSelfChat && (
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Track personal expenses & transfers
              </p>
            )}
          </div>
        </button>

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

      {/* Expandable balance details panel */}
      {showBalanceDetails && hasBalance && !isSelfChat && (
        <div className="px-4 pb-3 pt-1 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 animate-slide-down">
          <div className="flex justify-around text-center">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">You sent</p>
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                {formatChatCurrency(totalSent, 'INR')}
              </p>
            </div>
            <div className="w-px bg-gray-200 dark:bg-gray-700" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">You received</p>
              <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                {formatChatCurrency(totalReceived, 'INR')}
              </p>
            </div>
            <div className="w-px bg-gray-200 dark:bg-gray-700" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Net balance</p>
              <p className={`text-sm font-bold ${
                netBalance > 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : netBalance < 0 
                    ? 'text-red-600 dark:text-red-400' 
                    : 'text-gray-600 dark:text-gray-300'
              }`}>
                {netBalance > 0 && '+'}
                {formatChatCurrency(netBalance, 'INR')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default ChatHeaderEnhanced;