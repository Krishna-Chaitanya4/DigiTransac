import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import {
  getConversations,
  getConversation,
  sendMessage,
  editMessage,
  deleteMessage,
  restoreMessage,
  markAsRead,
  searchUserByEmail,
} from '../services/conversationService';
import type {
  ConversationListResponse,
  ConversationDetailResponse,
  ConversationMessage,
  SendMessageRequest,
} from '../types/conversations';

// Use centralized query keys from queryClient.ts
const conversationKeys = queryKeys.conversations;

// Hook to fetch all conversations
export function useConversations() {
  return useQuery({
    queryKey: conversationKeys.list(),
    queryFn: getConversations,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Hook to fetch a single conversation
export function useConversation(userId: string | null) {
  return useQuery({
    queryKey: conversationKeys.detail(userId || ''),
    queryFn: () => getConversation(userId!),
    enabled: !!userId,
    staleTime: 10 * 1000, // 10 seconds
  });
}

// Hook to send a message
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, request }: { userId: string; request: SendMessageRequest }) =>
      sendMessage(userId, request),
    onSuccess: (_data, variables) => {
      // Invalidate the conversation to refetch messages
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(variables.userId) });
      // Invalidate the list to update previews
      queryClient.invalidateQueries({ queryKey: conversationKeys.list() });
    },
  });
}

// Hook to edit a message
export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      editMessage(messageId, { content }),
    onSuccess: () => {
      // Invalidate all conversation data
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

// Hook to delete a message
export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId }: { messageId: string; counterpartyUserId?: string }) =>
      deleteMessage(messageId),
    onMutate: async ({ messageId, counterpartyUserId }) => {
      // Optimistically mark the message as deleted in the conversation detail
      if (counterpartyUserId) {
        await queryClient.cancelQueries({ queryKey: conversationKeys.detail(counterpartyUserId) });
        await queryClient.cancelQueries({ queryKey: conversationKeys.list() });

        // Update conversation detail: mark message as deleted
        const previousDetail = queryClient.getQueryData<ConversationDetailResponse>(
          conversationKeys.detail(counterpartyUserId)
        );
        if (previousDetail) {
          queryClient.setQueryData<ConversationDetailResponse>(
            conversationKeys.detail(counterpartyUserId),
            {
              ...previousDetail,
              messages: previousDetail.messages.map((m) =>
                m.id === messageId ? { ...m, isDeleted: true, content: null } : m
              ),
            }
          );
        }

        // Update conversation list: if deleted message was the latest, update preview
        const previousList = queryClient.getQueryData<ConversationListResponse>(
          conversationKeys.list()
        );
        if (previousList) {
          queryClient.setQueryData<ConversationListResponse>(
            conversationKeys.list(),
            {
              ...previousList,
              conversations: previousList.conversations.map((c) => {
                if (c.counterpartyUserId !== counterpartyUserId) return c;
                // Check if the deleted message matches the current preview
                const deletedMsg = previousDetail?.messages.find((m) => m.id === messageId);
                if (deletedMsg && c.lastMessagePreview === deletedMsg.content) {
                  return { ...c, lastMessagePreview: 'This message was deleted' };
                }
                return c;
              }),
            }
          );
        }

        return { previousDetail, previousList, counterpartyUserId };
      }
      return {};
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousDetail && context.counterpartyUserId) {
        queryClient.setQueryData(
          conversationKeys.detail(context.counterpartyUserId),
          context.previousDetail
        );
      }
      if (context?.previousList) {
        queryClient.setQueryData(conversationKeys.list(), context.previousList);
      }
    },
    onSettled: () => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

// Hook to restore (undo delete) a message
export function useRestoreMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId }: { messageId: string; counterpartyUserId: string }) =>
      restoreMessage(messageId),
    onMutate: async ({ messageId, counterpartyUserId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: conversationKeys.detail(counterpartyUserId) });
      await queryClient.cancelQueries({ queryKey: conversationKeys.list() });

      // Snapshot previous values
      const previousDetail = queryClient.getQueryData<ConversationDetailResponse>(
        conversationKeys.detail(counterpartyUserId)
      );

      // Optimistically mark the message as not deleted in the detail cache
      if (previousDetail) {
        const restoredMsg = previousDetail.messages.find((m) => m.id === messageId);
        queryClient.setQueryData<ConversationDetailResponse>(
          conversationKeys.detail(counterpartyUserId),
          {
            ...previousDetail,
            messages: previousDetail.messages.map((m) =>
              m.id === messageId ? { ...m, isDeleted: false, deletedAt: null } : m
            ),
          }
        );

        // Update conversation list preview if this was the latest message
        const previousList = queryClient.getQueryData<ConversationListResponse>(
          conversationKeys.list()
        );
        if (previousList && restoredMsg) {
          queryClient.setQueryData<ConversationListResponse>(
            conversationKeys.list(),
            {
              ...previousList,
              conversations: previousList.conversations.map((c) => {
                if (c.counterpartyUserId !== counterpartyUserId) return c;
                if (c.lastMessagePreview === 'This message was deleted' && restoredMsg.content) {
                  return { ...c, lastMessagePreview: restoredMsg.content };
                }
                return c;
              }),
            }
          );
        }

        return { previousDetail, previousList, counterpartyUserId };
      }
      return {};
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousDetail && context.counterpartyUserId) {
        queryClient.setQueryData(
          conversationKeys.detail(context.counterpartyUserId),
          context.previousDetail
        );
      }
      if (context?.previousList) {
        queryClient.setQueryData(conversationKeys.list(), context.previousList);
      }
    },
    onSettled: () => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

// Hook to mark conversation as read
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => markAsRead(userId),
    onSuccess: (_data, userId) => {
      // Update the conversations list cache to set unread count to 0
      queryClient.setQueryData<ConversationListResponse>(
        conversationKeys.list(),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            conversations: old.conversations.map((c) =>
              c.counterpartyUserId === userId ? { ...c, unreadCount: 0 } : c
            ),
            totalUnreadCount: Math.max(0, old.totalUnreadCount - 
              (old.conversations.find(c => c.counterpartyUserId === userId)?.unreadCount || 0)),
          };
        }
      );
      // Optimistically update message statuses in the detail cache so "Seen"
      // indicators render immediately without waiting for a refetch.
      queryClient.setQueryData<ConversationDetailResponse>(
        conversationKeys.detail(userId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            firstUnreadMessageId: null,
            messages: old.messages.map((m) =>
              !m.isFromMe && m.status !== 'Read'
                ? { ...m, status: 'Read' as const, readAt: new Date().toISOString() }
                : m
            ),
          };
        }
      );
    },
  });
}

// Hook to search for a user by email
export function useUserSearch(email: string) {
  return useQuery({
    queryKey: conversationKeys.userSearch(email),
    queryFn: () => searchUserByEmail(email),
    enabled: !!email.trim(),
    staleTime: 60 * 1000, // 1 minute
  });
}

// Hook to invalidate conversation queries
export function useInvalidateConversations() {
  const queryClient = useQueryClient();
  
  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: conversationKeys.all }),
    invalidateList: () => queryClient.invalidateQueries({ queryKey: conversationKeys.list() }),
    invalidateDetail: (userId: string) => 
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(userId) }),
  };
}

// Optimistic update helper for sending messages
export function useOptimisticSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, request }: { userId: string; request: SendMessageRequest }) =>
      sendMessage(userId, request),
    onMutate: async ({ userId, request }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: conversationKeys.detail(userId) });

      // Snapshot previous value
      const previousConversation = queryClient.getQueryData<ConversationDetailResponse>(
        conversationKeys.detail(userId)
      );

      // Optimistically add the message
      if (previousConversation) {
        const optimisticMessage: ConversationMessage = {
          id: `temp-${Date.now()}`,
          type: 'Text',
          senderUserId: '', // Will be filled by server
          isFromMe: true,
          content: request.content,
          transaction: null,
          status: 'Sent',
          createdAt: new Date().toISOString(),
          deliveredAt: null,
          readAt: null,
          isEdited: false,
          editedAt: null,
          isDeleted: false,
          deletedAt: null,
          replyToMessageId: request.replyToMessageId || null,
          replyTo: null,
        };

        queryClient.setQueryData<ConversationDetailResponse>(
          conversationKeys.detail(userId),
          {
            ...previousConversation,
            messages: [...previousConversation.messages, optimisticMessage],
          }
        );
      }

      return { previousConversation, userId };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousConversation) {
        queryClient.setQueryData(
          conversationKeys.detail(context.userId),
          context.previousConversation
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(variables.userId) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.list() });
    },
  });
}
