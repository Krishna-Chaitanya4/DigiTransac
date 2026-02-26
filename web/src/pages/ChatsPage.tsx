import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { PullToRefreshContainer } from '../components/PullToRefreshContainer';
import { useAccounts, useLabels, useTags, useCreateTag, useCreateTransaction, useRestoreTransaction, useDeleteTransaction } from '../hooks';
import {
  useConversations,
  useConversation,
  useOptimisticSendMessage,
  useEditMessage,
  useDeleteMessage,
  useRestoreMessage,
  useMarkAsRead,
  useInvalidateConversations,
} from '../hooks';
import { queryKeys } from '../lib/queryClient';
import {
  ConversationList,
  ChatHeaderEnhanced,
  ChatSearchBar,
  MessageBubble,
  MessageInput,
  MessageActionsMenu,
  NewChatModal,
  NetworkStatusBanner,
} from '../components/chat';
import { TransactionForm } from '../components/TransactionForm';
import { logger } from '../services/logger';
import { useToast } from '../components/ToastProvider';
import { SIDEBAR_CONSTANTS } from '../utils/constants';
import { usePresence } from '../context/PresenceContext';
import { useChatScroll } from '../hooks/useChatScroll';
import type { CreateTransactionRequest, UpdateTransactionRequest } from '../types/transactions';
import type { ConversationMessage, ConversationDetailResponse, UserSearchResult } from '../types/conversations';
import { ChevronDownIcon, ChatBubbleIcon } from '../components/icons';

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
  const queryClient = useQueryClient();
  const { info: showInfo, error: showError } = useToast();
  
  // URL params for deep linking (e.g., from "View in Chat" on transactions)
  const [searchParams, setSearchParams] = useSearchParams();

  // React Query hooks for data
  const { data: accounts = [] } = useAccounts();
  const { data: allLabels = [] } = useLabels();
  const { data: tags = [] } = useTags();
  const createTagMutation = useCreateTag();
  const createTransactionMutation = useCreateTransaction();

  // Conversation React Query hooks
  const { data: conversationsData, isLoading: isLoadingConversations } = useConversations();
  const conversations = conversationsData?.conversations ?? [];

  // Query online status for all counterparties when conversations load
  // AND when SignalR connection becomes active (handles race condition on page load)
  const { queryOnlineUsers, isConnected: presenceConnected } = usePresence();
  useEffect(() => {
    if (!presenceConnected) return;
    const userIds = conversations
      .filter(c => !c.isSelfChat)
      .map(c => c.counterpartyUserId);
    if (userIds.length > 0) {
      queryOnlineUsers(userIds);
    }
  }, [conversations, queryOnlineUsers, presenceConnected]);

  // Selected conversation state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingConversation, setPendingConversation] = useState<ConversationDetailResponse | null>(null);
  
  // State for pending message scroll (from deep link)
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState<string | null>(null);
  
  // State for pending transaction form open (from AddTransactionSheet navigation)
  const [pendingTransactionAction, setPendingTransactionAction] = useState<{
    type?: 'Send' | 'Receive' | 'Transfer';
    fromAccount?: string;
    toAccount?: string;
  } | null>(null);

  // Handle URL params for deep linking
  useEffect(() => {
    const userParam = searchParams.get('user');
    const selfParam = searchParams.get('self');
    const messageIdParam = searchParams.get('messageId');
    const actionParam = searchParams.get('action');
    const typeParam = searchParams.get('type');
    const fromAccountParam = searchParams.get('fromAccount');
    const toAccountParam = searchParams.get('toAccount');
    
    if (userParam) {
      // Navigate to specific user's chat
      setSelectedUserId(userParam);
      // Store message ID for scrolling after conversation loads
      if (messageIdParam) {
        setPendingScrollMessageId(messageIdParam);
      }
      // Handle transaction action from AddTransactionSheet
      if (actionParam === 'transaction') {
        setPendingTransactionAction({
          type: typeParam as 'Send' | 'Receive' | undefined,
          fromAccount: fromAccountParam || undefined,
          toAccount: toAccountParam || undefined,
        });
      }
      // Clear the param after use
      setSearchParams({}, { replace: true });
    } else if (selfParam === 'true') {
      // Navigate to self-chat (personal transactions)
      // Find the self-chat conversation from the list
      const selfChat = conversations.find(c => c.isSelfChat);
      if (selfChat) {
        setSelectedUserId(selfChat.counterpartyUserId);
        // Store message ID for scrolling after conversation loads
        if (messageIdParam) {
          setPendingScrollMessageId(messageIdParam);
        }
        // Handle transaction action from AddTransactionSheet
        if (actionParam === 'transaction') {
          setPendingTransactionAction({
            type: typeParam as 'Send' | 'Receive' | 'Transfer' | undefined,
            fromAccount: fromAccountParam || undefined,
            toAccount: toAccountParam || undefined,
          });
        }
      } else if (conversations.length === 0) {
        // Wait for conversations to load - will re-trigger when they're available
        return;
      }
      // Clear the param after use
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, conversations]);

  const {
    data: conversationData,
    isLoading: isLoadingMessages,
    dataUpdatedAt,
  } = useConversation(selectedUserId, pendingScrollMessageId ? 200 : undefined);

  // Use pending conversation for new chats, or the fetched data
  const selectedConversation = pendingConversation || conversationData || null;

  // Track the default type for the transaction form
  const [formDefaultType, setFormDefaultType] = useState<'Send' | 'Receive' | 'Transfer' | undefined>(undefined);

  // Transaction form modal - declared before the useEffect that uses it
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionFormError, setTransactionFormError] = useState<string | null>(null);

  // Open transaction form when pending action and conversation is ready
  useEffect(() => {
    if (pendingTransactionAction && selectedConversation) {
      // Set the default type from the pending action
      setFormDefaultType(pendingTransactionAction.type);
      setShowTransactionForm(true);
      // Clear the pending action after opening
      setPendingTransactionAction(null);
    }
  }, [pendingTransactionAction, selectedConversation]);

  // Mutations
  const sendMessageMutation = useOptimisticSendMessage();
  const editMessageMutation = useEditMessage();
  const deleteMessageMutation = useDeleteMessage();
  const restoreMessageMutation = useRestoreMessage();
  const restoreTransactionMutation = useRestoreTransaction();
  const deleteTransactionMutation = useDeleteTransaction();
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

  // Chat scroll management, unread tracking, load-older, mark-as-read
  const {
    messagesEndRef,
    messagesContainerRef,
    unreadDividerRef,
    showScrollButton,
    isLoadingOlder,
    activeUnreadDividerId,
    scrollToBottom,
    scrollToMessage,
    handleScroll,
    resetUnreadTracking,
  } = useChatScroll({
    selectedUserId,
    conversationData: conversationData ?? null,
    dataUpdatedAt,
    selectedConversation,
    pendingScrollMessageId,
    setPendingScrollMessageId,
    queryClient,
    markAsReadMutation,
    showInfo,
  });

  // Sidebar resize state - persist in localStorage
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('chatsSidebarWidth');
    return saved ? parseInt(saved, 10) : SIDEBAR_CONSTANTS.DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Persist sidebar width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('chatsSidebarWidth', String(sidebarWidth));
  }, [sidebarWidth]);

  // New chat modal
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // Is self-chat (for Transfer option and special message positioning)
  // Use the API flag if available, fallback to case-insensitive email comparison for backward compatibility
  const isSelfChat = selectedConversation?.isSelfChat ?? (user?.email?.toLowerCase() === selectedConversation?.counterpartyEmail?.toLowerCase());

  // Close search bar - defined before handlers that use it
  const closeSearchBar = useCallback(() => {
    setShowSearchBar(false);
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchIndex(0);
  }, []);

  // Select conversation handler — clear unread divider for the conversation we're leaving
  const handleSelectConversation = useCallback((userId: string) => {
    if (selectedUserId && selectedUserId !== userId) {
      resetUnreadTracking();
    }
    setSelectedUserId(userId);
    setPendingConversation(null);
    setReplyTo(null);
    setEditingMessage(null);
    closeSearchBar();
  }, [closeSearchBar, selectedUserId, resetUnreadTracking]);

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || !selectedUserId || sendMessageMutation.isPending) return;

    // If this is a pending (new) conversation, seed the query cache so the
    // optimistic update in useOptimisticSendMessage can find data and add the
    // message instantly. Then clear pendingConversation so conversationData
    // (which will be kept up-to-date by React Query) takes over rendering.
    if (pendingConversation) {
      queryClient.setQueryData(
        queryKeys.conversations.detail(selectedUserId),
        pendingConversation,
      );
      setPendingConversation(null);
    }

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
    } catch (err) {
      logger.error('Failed to send message:', err);
      showError('Failed to send message. Please try again.');
    }
  }, [messageInput, selectedUserId, replyTo, sendMessageMutation, scrollToBottom, pendingConversation, queryClient]);

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
    } catch (err) {
      logger.error('Failed to edit message:', err);
      showError('Failed to edit message. Please try again.');
    }
  }, [editingMessage, editInput, editMessageMutation]);

  // Delete message
  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      try {
        await deleteMessageMutation.mutateAsync({ messageId, counterpartyUserId: selectedUserId || undefined });
      } catch (err) {
        logger.error('Failed to delete message:', err);
        showError('Failed to delete message. Please try again.');
      }
    },
    [deleteMessageMutation, selectedUserId]
  );

  // Restore (undo delete) message
  const handleRestoreMessage = useCallback(
    async (messageId: string) => {
      if (!selectedUserId) return;
      try {
        await restoreMessageMutation.mutateAsync({ messageId, counterpartyUserId: selectedUserId });
      } catch (err) {
        logger.error('Failed to restore message:', err);
        showError('Failed to restore message. Please try again.');
      }
    },
    [restoreMessageMutation, selectedUserId]
  );

  // Helper to optimistically toggle isDeleted on a transaction in the conversation cache
  const optimisticToggleTransactionDeleted = useCallback(
    (transactionId: string, isDeleted: boolean) => {
      if (!selectedUserId) return;
      queryClient.setQueryData<ConversationDetailResponse>(
        queryKeys.conversations.detail(selectedUserId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages.map((msg) =>
              msg.transaction?.transactionId === transactionId
                ? {
                    ...msg,
                    transaction: {
                      ...msg.transaction,
                      isDeleted,
                      deletedAt: isDeleted ? new Date().toISOString() : null,
                    },
                  }
                : msg
            ),
          };
        }
      );
    },
    [queryClient, selectedUserId]
  );

  // Restore (undo delete) transaction
  const handleRestoreTransaction = useCallback(
    (transactionId: string) => {
      // Optimistically show the transaction as restored in chat
      optimisticToggleTransactionDeleted(transactionId, false);
      restoreTransactionMutation.mutate(transactionId, {
        onSettled: () => {
          // Refetch conversation detail and list preview
          if (selectedUserId) {
            invalidateDetail(selectedUserId);
          }
          invalidateList();
        },
      });
    },
    [restoreTransactionMutation, optimisticToggleTransactionDeleted, selectedUserId, invalidateDetail, invalidateList]
  );

  // Delete transaction (soft-delete from chat context menu)
  const handleDeleteTransaction = useCallback(
    (transactionId: string) => {
      // Optimistically show the transaction as deleted in chat
      optimisticToggleTransactionDeleted(transactionId, true);
      deleteTransactionMutation.mutate(transactionId, {
        onSettled: () => {
          // Refetch conversation detail and list preview
          if (selectedUserId) {
            invalidateDetail(selectedUserId);
          }
          invalidateList();
        },
      });
    },
    [deleteTransactionMutation, optimisticToggleTransactionDeleted, selectedUserId, invalidateDetail, invalidateList]
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

      const newIndex = direction === 'next'
        ? (currentSearchIndex + 1) % searchResults.length
        : (currentSearchIndex - 1 + searchResults.length) % searchResults.length;

      setCurrentSearchIndex(newIndex);
      const element = document.getElementById(`msg-${searchResults[newIndex]}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    [searchResults, currentSearchIndex]
  );


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

      // Seed cache and clear pending conversation (same as handleSendMessage)
      if (pendingConversation && selectedUserId) {
        queryClient.setQueryData(
          queryKeys.conversations.detail(selectedUserId),
          pendingConversation,
        );
        setPendingConversation(null);
      }

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
    [selectedConversation, createTransactionMutation, invalidateList, invalidateDetail, scrollToBottom, pendingConversation, selectedUserId, queryClient]
  );

  // Go back (mobile) — clear unread divider for the conversation we're leaving
  const handleBack = useCallback(() => {
    if (selectedUserId) {
      resetUnreadTracking();
    }
    setSelectedUserId(null);
    setPendingConversation(null);
  }, [selectedUserId, resetUnreadTracking]);

  // Loading state
  if (isLoadingConversations) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
  <div className="fixed inset-x-0 top-12 bottom-16 z-20 lg:relative lg:inset-auto lg:-m-8 lg:z-auto flex lg:h-[calc(100vh-3.5rem)] bg-white dark:bg-gray-900 overflow-hidden">
    {/* Conversations sidebar */}
      <ConversationList
        conversations={conversations}
        selectedUserId={selectedUserId}
        onSelectConversation={handleSelectConversation}
        onNewChat={() => setShowNewChatModal(true)}
        isResizing={isResizing}
        onResizeStart={() => setIsResizing(true)}
        onResizeEnd={() => setIsResizing(false)}
        onResizeReset={() => setSidebarWidth(SIDEBAR_CONSTANTS.DEFAULT_WIDTH)}
        sidebarWidth={sidebarWidth}
        onWidthChange={setSidebarWidth}
        onRefresh={async () => {
          invalidateList();
        }}
      />

      {/* Chat area */}
      <div className={`flex-1 flex flex-col transition-transform duration-300 ease-in-out ${
        selectedUserId
          ? 'flex absolute inset-0 md:relative md:inset-auto bg-white dark:bg-gray-900 z-10'
          : 'hidden md:flex'
      }`}>
        {selectedConversation ? (
          <>
            {/* Header - Enhanced with balance summary */}
            <ChatHeaderEnhanced
              conversation={selectedConversation}
              showSearchBar={showSearchBar}
              onToggleSearch={() => setShowSearchBar(!showSearchBar)}
              onBack={handleBack}
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
                <PullToRefreshContainer
                  onRefresh={async () => {
                    if (selectedUserId) {
                      invalidateDetail(selectedUserId);
                    }
                  }}
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
                    {/* Loading older messages indicator */}
                    {isLoadingOlder && (
                      <div className="flex items-center justify-center py-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Loading older messages…</span>
                      </div>
                    )}
                    {/* Show a subtle indicator when all history is loaded */}
                    {!selectedConversation.hasMore && selectedConversation.messages.length >= 50 && !isLoadingOlder && (
                      <div className="flex items-center justify-center py-3">
                        <span className="text-xs text-gray-400 dark:text-gray-500">Beginning of conversation</span>
                      </div>
                    )}
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

                          {/* "New messages" divider — shown at the first unread message */}
                          {activeUnreadDividerId === msg.id && (
                            <div ref={unreadDividerRef} className="flex items-center gap-3 my-4">
                              <div className="flex-1 h-px bg-blue-400 dark:bg-blue-500" />
                              <span className="text-xs font-semibold text-blue-500 dark:text-blue-400 whitespace-nowrap">
                                New messages
                              </span>
                              <div className="flex-1 h-px bg-blue-400 dark:bg-blue-500" />
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
                            onRestore={handleRestoreMessage}
                            onRestoreTransaction={handleRestoreTransaction}
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
                </PullToRefreshContainer>
              </div>

              {/* Scroll to bottom button */}
              {showScrollButton && (
                <button
                  onClick={scrollToBottom}
                  className="absolute bottom-4 right-4 p-3 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors z-10"
                >
                  <ChevronDownIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
              )}
            </div>

            {/* Message input */}
            <MessageInput
              messageInput={messageInput}
              onMessageChange={setMessageInput}
              onSend={handleSendMessage}
              isSending={sendMessageMutation.isPending}
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
              <ChatBubbleIcon className="w-20 h-20 mx-auto mb-4 opacity-30" />
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
          setFormDefaultType(undefined);
        }}
        onSubmit={handleTransactionSubmit}
        editingTransaction={null}
        accounts={accounts}
        labels={labels}
        tags={tags}
        defaultType={formDefaultType}
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
          onDeleteTransaction={handleDeleteTransaction}
        />
      )}


      {/* Network status banner */}
      <NetworkStatusBanner />
    </div>
  );
}
