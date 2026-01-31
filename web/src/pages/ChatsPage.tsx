import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAccounts, useLabels, useTags, useCreateTag, useCreateTransaction } from '../hooks';
import {
  useConversations,
  useConversation,
  useOptimisticSendMessage,
  useEditMessage,
  useDeleteMessage,
  useMarkAsRead,
  useInvalidateConversations,
} from '../hooks';
import { useNotifications } from '../hooks/useNotifications';
import {
  ConversationList,
  ChatHeaderEnhanced,
  ChatSearchBar,
  MessageBubble,
  MessageInput,
  MessageActionsMenu,
  NewChatModal,
  NetworkStatusBanner,
  FloatingActionButton,
} from '../components/chat';
import { TransactionForm } from '../components/TransactionForm';
import { logger } from '../services/logger';
import type { CreateTransactionRequest, UpdateTransactionRequest } from '../types/transactions';
import type { ConversationMessage, ConversationDetailResponse, UserSearchResult } from '../types/conversations';

// Format date for date separator
const formatDateSeparator = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Check if two dates are on different days
const isDifferentDay = (date1: string, date2: string): boolean => {
  const d1 = new Date(date1).toDateString();
  const d2 = new Date(date2).toDateString();
  return d1 !== d2;
};

export default function ChatsPage() {
  // Auth context
  const { user } = useAuth();
  
  // URL params for deep linking (e.g., from "View in Chat" on transactions)
  const [searchParams, setSearchParams] = useSearchParams();

  // SignalR notifications for real-time updates
  const { isConnected: isSignalRConnected } = useNotifications();

  // React Query hooks for data
  const { data: accounts = [] } = useAccounts();
  const { data: allLabels = [] } = useLabels();
  const { data: tags = [] } = useTags();
  const createTagMutation = useCreateTag();
  const createTransactionMutation = useCreateTransaction();

  // Conversation React Query hooks
  const { data: conversationsData, isLoading: isLoadingConversations } = useConversations();
  const conversations = conversationsData?.conversations ?? [];

  // Selected conversation state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingConversation, setPendingConversation] = useState<ConversationDetailResponse | null>(null);
  
  // State for pending message scroll (from deep link)
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState<string | null>(null);

  // Handle URL params for deep linking
  useEffect(() => {
    const userParam = searchParams.get('user');
    const selfParam = searchParams.get('self');
    const messageIdParam = searchParams.get('messageId');
    
    if (userParam) {
      // Navigate to specific user's chat
      setSelectedUserId(userParam);
      // Store message ID for scrolling after conversation loads
      if (messageIdParam) {
        setPendingScrollMessageId(messageIdParam);
      }
      // Clear the param after use
      setSearchParams({}, { replace: true });
    } else if (selfParam === 'true' && conversations.length > 0) {
      // Navigate to self-chat (personal transactions)
      // Find the self-chat conversation from the list
      const selfChat = conversations.find(c => c.isSelfChat);
      if (selfChat) {
        setSelectedUserId(selfChat.counterpartyUserId);
        // Store message ID for scrolling after conversation loads
        if (messageIdParam) {
          setPendingScrollMessageId(messageIdParam);
        }
      }
      // Clear the param after use
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, conversations]);

  const {
    data: conversationData,
    isLoading: isLoadingMessages,
  } = useConversation(selectedUserId);

  // Use pending conversation for new chats, or the fetched data
  const selectedConversation = pendingConversation || conversationData || null;

  // Mutations
  const sendMessageMutation = useOptimisticSendMessage();
  const editMessageMutation = useEditMessage();
  const deleteMessageMutation = useDeleteMessage();
  const markAsReadMutation = useMarkAsRead();
  const { invalidateList, invalidateDetail } = useInvalidateConversations();

  // Filter labels to only Category (not Folders)
  const labels = useMemo(() => allLabels.filter((l) => l.type === 'Category'), [allLabels]);

  // UI State
  const [messageInput, setMessageInput] = useState('');
  const [replyTo, setReplyTo] = useState<ConversationMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ConversationMessage | null>(null);
  const [editInput, setEditInput] = useState('');

  // Menu state
  const [menuMessage, setMenuMessage] = useState<ConversationMessage | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number; buttonTop: number } | null>(null);

  // Search in conversation
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  // Scroll state
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  // New chat modal
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // Transaction form modal
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionFormError, setTransactionFormError] = useState<string | null>(null);

  // Is self-chat (for Transfer option and special message positioning)
  // Use the API flag if available, fallback to email comparison for backward compatibility
  const isSelfChat = selectedConversation?.isSelfChat ?? (user?.email === selectedConversation?.counterpartyEmail);

  // Scroll to a message and highlight it temporarily
  const scrollToMessage = useCallback((messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('rounded-2xl', 'transition-colors', 'duration-500');
      element.classList.add('bg-gray-200', 'dark:bg-gray-700');
      setTimeout(() => {
        element.classList.remove('bg-gray-200', 'dark:bg-gray-700');
        setTimeout(() => {
          element.classList.remove('rounded-2xl', 'transition-colors', 'duration-500');
        }, 500);
      }, 1000);
    }
  }, []);

  // Mark as read when conversation loads
  useEffect(() => {
    if (selectedUserId && conversationData) {
      markAsReadMutation.mutate(selectedUserId);
    }
  }, [selectedUserId, conversationData]);

  // Scroll to bottom when messages change
  useEffect(() => {
    // Don't auto-scroll if we're about to scroll to a specific message
    if (pendingScrollMessageId) return;
    
    if (selectedConversation?.messages && selectedConversation.messages.length > 0) {
      const timeoutId = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedConversation?.messages, pendingScrollMessageId]);

  // Scroll to specific message from deep link (View in Chat)
  useEffect(() => {
    if (pendingScrollMessageId && selectedConversation?.messages && selectedConversation.messages.length > 0) {
      // Small delay to ensure DOM is rendered
      const timeoutId = setTimeout(() => {
        scrollToMessage(pendingScrollMessageId);
        setPendingScrollMessageId(null);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [pendingScrollMessageId, selectedConversation?.messages, scrollToMessage]);

  // Handle scroll detection
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const hasEnoughContent = scrollHeight > clientHeight + 50;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      setShowScrollButton(hasEnoughContent && !isNearBottom);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Select conversation handler
  const handleSelectConversation = useCallback((userId: string) => {
    setSelectedUserId(userId);
    setPendingConversation(null);
    setReplyTo(null);
    setEditingMessage(null);
    closeSearchBar();
  }, []);

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || !selectedUserId || sendMessageMutation.isPending) return;

    try {
      await sendMessageMutation.mutateAsync({
        userId: selectedUserId,
        request: {
          content: messageInput.trim(),
          replyToMessageId: replyTo?.id,
        },
      });
      setMessageInput('');
      setReplyTo(null);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      logger.error('Failed to send message:', error);
    }
  }, [messageInput, selectedUserId, replyTo, sendMessageMutation, scrollToBottom]);

  // Edit message
  const handleEditMessage = useCallback(async () => {
    if (!editingMessage || !editInput.trim()) return;

    try {
      await editMessageMutation.mutateAsync({
        messageId: editingMessage.id,
        content: editInput.trim(),
      });
      setEditingMessage(null);
      setEditInput('');
    } catch (error) {
      logger.error('Failed to edit message:', error);
    }
  }, [editingMessage, editInput, editMessageMutation]);

  // Delete message
  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      try {
        await deleteMessageMutation.mutateAsync(messageId);
      } catch (error) {
        logger.error('Failed to delete message:', error);
      }
    },
    [deleteMessageMutation]
  );

  // Start editing
  const startEditing = useCallback((msg: ConversationMessage) => {
    setEditingMessage(msg);
    setEditInput(msg.content || '');
    setMenuMessage(null);
    setMenuPosition(null);
  }, []);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingMessage(null);
    setEditInput('');
  }, []);

  // Search within conversation
  const handleSearchInConversation = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!query.trim() || !selectedConversation) {
        setSearchResults([]);
        setCurrentSearchIndex(0);
        return;
      }

      const lowerQuery = query.toLowerCase();
      const matchingIds = selectedConversation.messages
        .filter((msg) => msg.content?.toLowerCase().includes(lowerQuery))
        .map((msg) => msg.id);

      setSearchResults(matchingIds);
      setCurrentSearchIndex(0);

      if (matchingIds.length > 0) {
        const element = document.getElementById(`msg-${matchingIds[0]}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    [selectedConversation]
  );

  // Navigate search results
  const navigateSearchResult = useCallback(
    (direction: 'prev' | 'next') => {
      if (searchResults.length === 0) return;

      let newIndex = currentSearchIndex;
      if (direction === 'next') {
        newIndex = (currentSearchIndex + 1) % searchResults.length;
      } else {
        newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
      }

      setCurrentSearchIndex(newIndex);
      const element = document.getElementById(`msg-${searchResults[newIndex]}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    [searchResults, currentSearchIndex]
  );

  // Close search bar
  const closeSearchBar = useCallback(() => {
    setShowSearchBar(false);
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchIndex(0);
  }, []);

  // Handle menu open
  const handleMenuOpen = useCallback(
    (message: ConversationMessage, position: { x: number; y: number; buttonTop: number }) => {
      setMenuMessage(message);
      setMenuPosition(position);
    },
    []
  );

  // Handle menu close
  const handleMenuClose = useCallback(() => {
    setMenuMessage(null);
    setMenuPosition(null);
  }, []);

  // Handle new chat start
  const handleStartConversation = useCallback(
    (user: UserSearchResult) => {
      // Check if conversation already exists
      const existing = conversations.find((c) => c.counterpartyUserId === user.userId);
      if (existing) {
        handleSelectConversation(existing.counterpartyUserId);
      } else {
        // Create pending conversation for new chats
        setSelectedUserId(user.userId);
        setPendingConversation({
          counterpartyUserId: user.userId,
          counterpartyName: user.name,
          counterpartyEmail: user.email,
          totalSent: 0,
          totalReceived: 0,
          messages: [],
          totalCount: 0,
          hasMore: false,
        });
      }
    },
    [conversations, handleSelectConversation]
  );

  // Handle transaction form submit
  const handleTransactionSubmit = useCallback(
    async (data: CreateTransactionRequest | UpdateTransactionRequest) => {
      if (!selectedConversation) return;

      setTransactionFormError(null);

      try {
        await createTransactionMutation.mutateAsync(data as CreateTransactionRequest);

        // Invalidate both conversations list and the current conversation detail
        invalidateList();
        invalidateDetail(selectedConversation.counterpartyUserId);

        // Close form
        setShowTransactionForm(false);

        // Scroll to bottom
        setTimeout(scrollToBottom, 100);
      } catch (error) {
        logger.error('Failed to create transaction:', error);
        setTransactionFormError(error instanceof Error ? error.message : 'Failed to create transaction');
      }
    },
    [selectedConversation, createTransactionMutation, invalidateList, invalidateDetail, scrollToBottom]
  );

  // Go back (mobile)
  const handleBack = useCallback(() => {
    setSelectedUserId(null);
    setPendingConversation(null);
  }, []);

  // Loading state
  if (isLoadingConversations) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 flex h-[calc(100vh-4rem)] bg-white dark:bg-gray-900">
      {/* Conversations sidebar */}
      <ConversationList
        conversations={conversations}
        selectedUserId={selectedUserId}
        onSelectConversation={handleSelectConversation}
        onNewChat={() => setShowNewChatModal(true)}
        isResizing={isResizing}
        onResizeStart={() => setIsResizing(true)}
        onResizeEnd={() => setIsResizing(false)}
        onResizeReset={() => setSidebarWidth(320)}
        sidebarWidth={sidebarWidth}
        onWidthChange={setSidebarWidth}
      />

      {/* Chat area */}
      <div className={`flex-1 flex flex-col ${selectedUserId ? 'flex' : 'hidden md:flex'}`}>
        {selectedConversation ? (
          <>
            {/* Header - Enhanced with balance summary */}
            <ChatHeaderEnhanced
              conversation={selectedConversation}
              showSearchBar={showSearchBar}
              onToggleSearch={() => setShowSearchBar(!showSearchBar)}
              onBack={handleBack}
              isConnected={isSignalRConnected}
            />

            {/* Search bar */}
            {showSearchBar && (
              <ChatSearchBar
                searchQuery={searchQuery}
                onSearchChange={handleSearchInConversation}
                searchResultsCount={searchResults.length}
                currentSearchIndex={currentSearchIndex}
                onNavigatePrev={() => navigateSearchResult('prev')}
                onNavigateNext={() => navigateSearchResult('next')}
                onClose={closeSearchBar}
              />
            )}

            {/* Messages container */}
            <div className="flex-1 relative overflow-hidden">
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="h-full overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800/50"
              >
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  </div>
                ) : selectedConversation.messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  <>
                    {selectedConversation.messages.map((msg, index) => {
                      const prevMsg = index > 0 ? selectedConversation.messages[index - 1] : null;
                      const nextMsg =
                        index < selectedConversation.messages.length - 1
                          ? selectedConversation.messages[index + 1]
                          : null;

                      const showDateSeparator = index === 0 || isDifferentDay(prevMsg!.createdAt, msg.createdAt);

                      const showTime =
                        !nextMsg ||
                        nextMsg.isFromMe !== msg.isFromMe ||
                        isDifferentDay(msg.createdAt, nextMsg.createdAt) ||
                        new Date(nextMsg.createdAt).getTime() - new Date(msg.createdAt).getTime() > 5 * 60 * 1000;

                      return (
                        <div key={msg.id}>
                          {showDateSeparator && (
                            <div className="flex items-center justify-center my-4">
                              <div className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-300 font-medium">
                                {formatDateSeparator(msg.createdAt)}
                              </div>
                            </div>
                          )}
                          <MessageBubble
                            message={msg}
                            showTime={showTime}
                            searchQuery={searchQuery}
                            isCurrentSearchResult={
                              searchResults.length > 0 && searchResults[currentSearchIndex] === msg.id
                            }
                            counterpartyName={selectedConversation.counterpartyName}
                            counterpartyUserId={selectedConversation.counterpartyUserId}
                            isSelfChat={isSelfChat}
                            onMenuOpen={handleMenuOpen}
                            onScrollToReply={scrollToMessage}
                          />
                        </div>
                      );
                    })}

                    {/* Seen indicator - only for P2P chats, not self-chat */}
                    {!isSelfChat && (() => {
                      const lastMsg = selectedConversation.messages[selectedConversation.messages.length - 1];
                      if (lastMsg?.isFromMe && lastMsg?.status === 'Read') {
                        return (
                          <div className="flex justify-end pr-2 mt-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Seen</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Scroll to bottom button */}
              {showScrollButton && (
                <button
                  onClick={scrollToBottom}
                  className="absolute bottom-4 right-4 p-3 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors z-10"
                >
                  <svg
                    className="w-5 h-5 text-gray-600 dark:text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
              )}
            </div>

            {/* Message input */}
            <MessageInput
              messageInput={messageInput}
              onMessageChange={setMessageInput}
              onSend={handleSendMessage}
              isSending={sendMessageMutation.isPending}
              hasAccounts={accounts.length > 0}
              onOpenTransactionForm={() => setShowTransactionForm(true)}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              counterpartyName={selectedConversation.counterpartyName}
              editingMessage={editingMessage}
              editInput={editInput}
              onEditInputChange={setEditInput}
              onEditSubmit={handleEditMessage}
              onCancelEdit={cancelEditing}
            />
          </>
        ) : (
          /* No conversation selected */
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <svg
                className="w-20 h-20 mx-auto mb-4 opacity-30"
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
              <h3 className="text-lg font-medium mb-1">Select a conversation</h3>
              <p className="text-sm">Choose a conversation from the list to view messages</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onStartConversation={handleStartConversation}
      />

      {/* Transaction Form Modal */}
      <TransactionForm
        isOpen={showTransactionForm}
        onClose={() => {
          setShowTransactionForm(false);
          setTransactionFormError(null);
        }}
        onSubmit={handleTransactionSubmit}
        editingTransaction={null}
        accounts={accounts}
        labels={labels}
        tags={tags}
        isLoading={createTransactionMutation.isPending}
        error={transactionFormError}
        hideRecipientField={true}
        showTransfer={isSelfChat}
        fixedCounterpartyEmail={isSelfChat ? undefined : selectedConversation?.counterpartyEmail}
        hidePayeeField={!isSelfChat}
        onCreateTag={async (name) => {
          try {
            const newTag = await createTagMutation.mutateAsync({ name });
            return newTag;
          } catch (error) {
            logger.error('Failed to create tag:', error);
            return null;
          }
        }}
      />

      {/* Message Actions Menu */}
      {menuMessage && menuPosition && (
        <MessageActionsMenu
          message={menuMessage}
          position={menuPosition}
          onClose={handleMenuClose}
          onReply={() => setReplyTo(menuMessage)}
          onEdit={() => startEditing(menuMessage)}
          onDelete={() => handleDeleteMessage(menuMessage.id)}
        />
      )}

      {/* Floating Action Button for quick transaction creation (mobile) */}
      {selectedConversation && (
        <FloatingActionButton
          onCreateTransaction={() => setShowTransactionForm(true)}
          hasAccounts={accounts.length > 0}
          className="md:hidden" // Only show on mobile
        />
      )}

      {/* Network status banner */}
      <NetworkStatusBanner />
    </div>
  );
}
