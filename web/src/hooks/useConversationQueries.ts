import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

// Query keys
export const conversationKeys = {
  all: ['conversations'] as const,
  list: () => [...conversationKeys.all, 'list'] as const,
  detail: (userId: string) => [...conversationKeys.all, 'detail', userId] as const,
  userSearch: (email: string) => [...conversationKeys.all, 'search', email] as const,
};

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
    mutationFn: (messageId: string) => deleteMessage(messageId),
    onSuccess: () => {
      // Invalidate all conversation data
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

// Hook to restore (undo delete) a message
export function useRestoreMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => restoreMessage(messageId),
    onSuccess: () => {
      // Invalidate all conversation data
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
