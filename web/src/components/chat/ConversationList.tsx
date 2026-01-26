import { useRef, useEffect, useState, useCallback, memo } from 'react';
import type { ConversationSummary } from '../../types/conversations';
import { ConversationItem } from './ConversationItem';

interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedUserId: string | null;
  onSelectConversation: (userId: string) => void;
  onNewChat: () => void;
  isResizing: boolean;
  onResizeStart: () => void;
  onResizeReset: () => void;
  sidebarWidth: number;
  onWidthChange: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
}

export const ConversationList = memo(function ConversationList({
  conversations,
  selectedUserId,
  onSelectConversation,
  onNewChat,
  isResizing,
  onResizeStart,
  onResizeReset,
  sidebarWidth,
  onWidthChange,
  minWidth = 280,
  maxWidth = 500,
}: ConversationListProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [conversationFilter, setConversationFilter] = useState('');

  // Handle sidebar resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !sidebarRef.current) return;

      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      const newWidth = e.clientX - sidebarRect.left;
      const clampedWidth = Math.min(maxWidth, Math.max(minWidth, newWidth));
      onWidthChange(clampedWidth);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minWidth, maxWidth, onWidthChange]);

  const filteredConversations = useCallback(() => {
    if (!conversationFilter.trim()) return conversations;
    const filter = conversationFilter.toLowerCase();
    return conversations.filter((conv) => {
      const name = (conv.counterpartyName || '').toLowerCase();
      const email = (conv.counterpartyEmail || '').toLowerCase();
      return name.includes(filter) || email.includes(filter);
    });
  }, [conversations, conversationFilter]);

  const filtered = filteredConversations();

  return (
    <>
      <div
        ref={sidebarRef}
        className={`flex flex-col border-r border-gray-200 dark:border-gray-700 ${
          selectedUserId ? 'hidden md:flex' : 'flex'
        }`}
        style={{ width: `${sidebarWidth}px`, minWidth: `${minWidth}px`, maxWidth: `${maxWidth}px` }}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Chats</h1>
          <button
            onClick={onNewChat}
            className="p-2 text-gray-500 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="New Chat"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Search conversations */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={conversationFilter}
              onChange={(e) => setConversationFilter(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {conversationFilter && (
              <button
                onClick={() => setConversationFilter('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="font-medium">No conversations yet</p>
              <p className="text-sm mt-1">Start a new chat or make a transaction</p>
            </div>
          ) : (
            <>
              {filtered.map((convo) => (
                <ConversationItem
                  key={convo.counterpartyUserId}
                  conversation={convo}
                  isSelected={selectedUserId === convo.counterpartyUserId}
                  onClick={() => onSelectConversation(convo.counterpartyUserId)}
                />
              ))}
              {conversationFilter && filtered.length === 0 && (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No conversations match "{conversationFilter}"
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Resize handle */}
      <div
        className={`hidden md:flex w-3 items-center justify-center cursor-col-resize flex-shrink-0 group hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors ${
          isResizing ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-transparent'
        }`}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onResizeStart();
        }}
        onDoubleClick={onResizeReset}
        title="Drag to resize, double-click to reset"
      >
        <div
          className={`w-1 h-10 rounded-full transition-colors ${
            isResizing ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600 group-hover:bg-blue-400'
          }`}
        />
      </div>
    </>
  );
});
