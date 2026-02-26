import { useState, useEffect, useRef, useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { getConversation } from '../services/conversationService';
import { logger } from '../services/logger';
import type { ConversationDetailResponse, ConversationMessage } from '../types/conversations';

interface UseChatScrollOptions {
  /** Currently selected counterparty user ID. */
  selectedUserId: string | null;
  /** Raw conversation data from useConversation query. */
  conversationData: ConversationDetailResponse | null;
  /** Timestamp of last React Query data update. */
  dataUpdatedAt: number;
  /** The effective conversation being displayed (may include pending new-chat data). */
  selectedConversation: ConversationDetailResponse | null;
  /** Message ID to scroll to (from deep link / "View in Chat"). */
  pendingScrollMessageId: string | null;
  /** Clear the pending scroll message ID after scrolling. */
  setPendingScrollMessageId: (id: string | null) => void;
  /** React Query client. */
  queryClient: QueryClient;
  /** Mark-as-read mutation. */
  markAsReadMutation: { mutate: (userId: string) => void };
  /** Show info toast for "message not found". */
  showInfo: (msg: string) => void;
}

/**
 * Encapsulates chat scroll management, load-older-messages pagination,
 * unread divider tracking, mark-as-read, and deep-link scroll.
 *
 * Extracted from ChatsPage to reduce its size (~200 lines removed).
 */
export function useChatScroll({
  selectedUserId,
  conversationData,
  dataUpdatedAt,
  selectedConversation,
  pendingScrollMessageId,
  setPendingScrollMessageId,
  queryClient,
  markAsReadMutation,
  showInfo,
}: UseChatScrollOptions) {
  // ─── Refs ───────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const unreadDividerRef = useRef<HTMLDivElement>(null);
  const loadingOlderRef = useRef(false);
  const deepLinkScrolledRef = useRef(false);
  const navigationTimestampRef = useRef(0);
  const unreadCapturedRef = useRef(false);
  const hasScrolledToUnreadRef = useRef(false);
  const markedAsReadRef = useRef<string | null>(null);
  const messageCountRef = useRef<number>(0);
  const lastViewedMsgIdRef = useRef<Map<string, string>>(new Map());
  const previousSelectedUserIdRef = useRef<string | null>(null);
  const latestMessagesRef = useRef<ConversationMessage[] | null>(null);

  // ─── State ──────────────────────────────────────────────────
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [activeUnreadDividerId, setActiveUnreadDividerId] = useState<string | null>(null);

  // ─── Keep latest messages ref in sync ───────────────────────
  useEffect(() => {
    latestMessagesRef.current = conversationData?.messages ?? null;
  }, [conversationData?.messages]);

  // ─── Reset all tracking when switching conversations ────────
  useEffect(() => {
    // Save last viewed message for the conversation we're leaving
    const prevUserId = previousSelectedUserIdRef.current;
    const msgs = latestMessagesRef.current;
    if (prevUserId && msgs?.length) {
      lastViewedMsgIdRef.current.set(prevUserId, msgs[msgs.length - 1].id);
    }
    previousSelectedUserIdRef.current = selectedUserId;

    navigationTimestampRef.current = Date.now();
    unreadCapturedRef.current = false;
    deepLinkScrolledRef.current = false;
    setActiveUnreadDividerId(null);
    hasScrolledToUnreadRef.current = false;
    markedAsReadRef.current = null;
    messageCountRef.current = 0;
    setIsLoadingOlder(false);
    loadingOlderRef.current = false;
    if (selectedUserId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(selectedUserId) });
    }
  }, [selectedUserId, queryClient]);

  // ─── Scroll to message with highlight ───────────────────────
  const scrollToMessage = useCallback((messageId: string): boolean => {
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
      return true;
    }
    return false;
  }, []);

  // ─── Capture unread divider from fresh data ──────────────────
  useEffect(() => {
    if (!conversationData || !selectedUserId || unreadCapturedRef.current) return;
    if (dataUpdatedAt < navigationTimestampRef.current) return;
    unreadCapturedRef.current = true;
    const apiUnreadId = conversationData.firstUnreadMessageId;
    if (apiUnreadId) {
      const lastViewedId = lastViewedMsgIdRef.current.get(selectedUserId);
      if (lastViewedId && conversationData.messages) {
        const messages = conversationData.messages;
        const unreadIdx = messages.findIndex(m => m.id === apiUnreadId);
        const viewedIdx = messages.findIndex(m => m.id === lastViewedId);
        if (viewedIdx >= 0 && unreadIdx >= 0 && viewedIdx >= unreadIdx) {
          return; // User already viewed past the unread boundary
        }
      }
      setActiveUnreadDividerId(apiUnreadId);
      hasScrolledToUnreadRef.current = false;
    }
  }, [conversationData, dataUpdatedAt, selectedUserId]);

  // ─── Mark as read ───────────────────────────────────────────
  useEffect(() => {
    if (!selectedUserId || !conversationData) return;
    if (dataUpdatedAt < navigationTimestampRef.current) return;

    const messages = conversationData.messages ?? [];
    const currentMessageCount = messages.length;
    const isNewConversation = markedAsReadRef.current !== selectedUserId;
    const hasNewMessages = currentMessageCount > messageCountRef.current && !isNewConversation;
    const hasUnreadIncoming = messages.some(m => !m.isFromMe && m.status !== 'Read');

    if ((isNewConversation || hasNewMessages) && hasUnreadIncoming) {
      markAsReadMutation.mutate(selectedUserId);
      markedAsReadRef.current = selectedUserId;
    }
    messageCountRef.current = currentMessageCount;
  }, [selectedUserId, conversationData, dataUpdatedAt, markAsReadMutation]);

  // ─── Auto-scroll to bottom (or unread divider) ─────────────
  useEffect(() => {
    if (pendingScrollMessageId) return;
    if (deepLinkScrolledRef.current) return;
    if (loadingOlderRef.current || isLoadingOlder) return;

    if (selectedConversation?.messages && selectedConversation.messages.length > 0) {
      const timeoutId = setTimeout(() => {
        if (activeUnreadDividerId && !hasScrolledToUnreadRef.current && unreadDividerRef.current) {
          unreadDividerRef.current.scrollIntoView({ behavior: 'instant', block: 'center' });
          hasScrolledToUnreadRef.current = true;
        } else if (!activeUnreadDividerId || hasScrolledToUnreadRef.current) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedConversation?.messages, pendingScrollMessageId, activeUnreadDividerId, isLoadingOlder]);

  // ─── Deep-link scroll to specific message ───────────────────
  useEffect(() => {
    if (pendingScrollMessageId && selectedConversation?.messages && selectedConversation.messages.length > 0) {
      const timeoutId = setTimeout(() => {
        const found = scrollToMessage(pendingScrollMessageId);
        if (!found) {
          showInfo('Could not find this message in the conversation');
        }
        deepLinkScrolledRef.current = true;
        setPendingScrollMessageId(null);
      }, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [pendingScrollMessageId, selectedConversation?.messages, scrollToMessage, showInfo, setPendingScrollMessageId]);

  // ─── Load older messages (scroll-up pagination) ─────────────
  const loadOlderMessages = useCallback(async () => {
    if (!selectedUserId || !selectedConversation?.hasMore || loadingOlderRef.current) return;
    const messages = selectedConversation.messages;
    if (!messages.length) return;

    loadingOlderRef.current = true;
    setIsLoadingOlder(true);

    try {
      const oldestMsg = messages[0];
      const before = oldestMsg.createdAt;
      const olderData = await getConversation(selectedUserId, 50, before);

      if (olderData.messages.length > 0) {
        const container = messagesContainerRef.current;
        const prevScrollHeight = container?.scrollHeight ?? 0;

        queryClient.setQueryData(
          queryKeys.conversations.detail(selectedUserId),
          (old: ConversationDetailResponse | undefined) => {
            if (!old) return old;
            const existingIds = new Set(old.messages.map((m) => m.id));
            const newMsgs = olderData.messages.filter((m) => !existingIds.has(m.id));
            return { ...old, messages: [...newMsgs, ...old.messages], hasMore: olderData.hasMore };
          },
        );

        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop += newScrollHeight - prevScrollHeight;
          }
        });
      } else {
        queryClient.setQueryData(
          queryKeys.conversations.detail(selectedUserId),
          (old: ConversationDetailResponse | undefined) => {
            if (!old) return old;
            return { ...old, hasMore: false };
          },
        );
      }
    } catch (err) {
      logger.error('Failed to load older messages:', err);
    } finally {
      setIsLoadingOlder(false);
      setTimeout(() => {
        loadingOlderRef.current = false;
      }, 200);
    }
  }, [selectedUserId, selectedConversation?.hasMore, selectedConversation?.messages, queryClient]);

  // ─── Scroll handler (scroll button visibility + load older) ─
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const hasEnoughContent = scrollHeight > clientHeight + 50;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      setShowScrollButton(hasEnoughContent && !isNearBottom);

      if (scrollTop < 100 && !loadingOlderRef.current) {
        loadOlderMessages();
      }
    }
  }, [loadOlderMessages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  /** Call when leaving a conversation to clear the unread divider. */
  const resetUnreadTracking = useCallback(() => {
    setActiveUnreadDividerId(null);
    hasScrolledToUnreadRef.current = false;
  }, []);

  return {
    // Refs for JSX
    messagesEndRef,
    messagesContainerRef,
    unreadDividerRef,
    // State for rendering
    showScrollButton,
    isLoadingOlder,
    activeUnreadDividerId,
    // Callbacks
    scrollToBottom,
    scrollToMessage,
    handleScroll,
    resetUnreadTracking,
  };
}
