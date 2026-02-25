import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from '../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { NOTIFICATION_CONSTANTS } from '../utils/constants';
import { API_BASE_URL } from '../services/apiClient';
import { getStoredAccessToken } from '../services/tokenStorage';
import { logger } from '../services/logger';
import { queryKeys } from '../lib/queryClient';
import type { ConversationDetailResponse, ConversationListResponse, ConversationMessage } from '../types/conversations';
import { formatCurrency } from '../services/currencyService';

// Notification types from the backend
export interface P2PTransactionNotification {
  transactionId: string;
  counterpartyUserId: string;
  counterpartyEmail?: string;
  counterpartyName?: string;
  type: string;
  amount: number;
  currency: string;
  title?: string;
  date: string;
  status: string;
  reason?: string;
}

export interface ChatMessageNotification {
  messageId: string;
  senderId: string;
  recipientId: string;
  senderName?: string;
  messageType: string;
  content?: string;
  transactionId?: string;
  sentAt: string;
  // Optional transaction data for instant optimistic display
  transactionType?: string;   // "Send" or "Receive" (from sender's perspective)
  amount?: number;
  currency?: string;
  title?: string;
  transactionStatus?: string; // "Pending", "Confirmed", "Declined"
}

export interface MessageDeletedNotification {
  messageId: string;
  senderId: string;
}

export interface MessageRestoredNotification {
  messageId: string;
  senderId: string;
}

export interface PendingCountNotification {
  pendingCount: number;
}

export interface PresenceCallbacks {
  onUserOnline?: (userId: string) => void;
  onUserOffline?: (userId: string) => void;
}

interface UseNotificationsOptions {
  onP2PTransactionCreated?: (notification: P2PTransactionNotification) => void;
  onP2PTransactionAccepted?: (notification: P2PTransactionNotification) => void;
  onP2PTransactionRejected?: (notification: P2PTransactionNotification) => void;
  onNewChatMessage?: (notification: ChatMessageNotification) => void;
  onPendingCountUpdate?: (notification: PendingCountNotification) => void;
  presence?: PresenceCallbacks;
}

type ConnectionState = 'Disconnected' | 'Connecting' | 'Connected' | 'Reconnecting' | 'Error';

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('Disconnected');
  const [error, setError] = useState<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const optionsRef = useRef(options);
  
  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Build the hub URL — strip '/api' suffix since the hub is mounted at /hubs, not /api/hubs
  const hubBaseUrl = API_BASE_URL.replace(/\/api\/?$/, '');

  // Initialize connection
  const initializeConnection = useCallback((token: string) => {
    if (connectionRef.current) return connectionRef.current;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${hubBaseUrl}/hubs/notifications`, {
        // Always read the latest token from localStorage so reconnections use the freshest token
        accessTokenFactory: () => getStoredAccessToken() || token,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext: signalR.RetryContext) => {
          if (retryContext.previousRetryCount >= NOTIFICATION_CONSTANTS.MAX_RECONNECT_ATTEMPTS) {
            return null; // Stop reconnecting
          }
          // Exponential backoff: 0, 2, 4, 8, 16 seconds
          return Math.min(
            1000 * Math.pow(2, retryContext.previousRetryCount),
            NOTIFICATION_CONSTANTS.MAX_RECONNECT_DELAY_MS
          );
        },
      })
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connectionRef.current = connection;

    // Handle connection state changes
    connection.onreconnecting((err: Error | undefined) => {
      setConnectionState('Reconnecting');
      logger.warn('SignalR reconnecting', { error: err?.message });
    });

    connection.onreconnected((connectionId: string | undefined) => {
      setConnectionState('Connected');
      reconnectAttemptsRef.current = 0;
      logger.info('SignalR reconnected', { connectionId });
    });

    connection.onclose((err: Error | undefined) => {
      setConnectionState('Disconnected');
      if (err) {
        setError(err.message);
        logger.error('SignalR connection closed with error', { error: err.message });
      }
    });

    // Shared invalidation options — refetchType: 'all' ensures inactive queries
    // (e.g. analytics when user is on Chats page) are also refetched in background
    const invalidateAll = { refetchType: 'all' as const };

    // Register event handlers
    connection.on('P2PTransactionCreated', (notification: P2PTransactionNotification) => {
      logger.info('P2P Transaction Created', { transactionId: notification.transactionId, type: notification.type });
      optionsRef.current.onP2PTransactionCreated?.(notification);
      
      // Optimistically update conversation list preview only if this transaction is newer.
      // Use ChatMessage.CreatedAt semantics: the server's latest chat message is the
      // authoritative preview. We only overwrite here if the current preview isn't a
      // more recent text message (text messages always reflect real-time activity).
      const receiverType = notification.type === 'Send' ? 'Received' : 'Sent';
      const preview = `${receiverType} ${formatCurrency(notification.amount, notification.currency)}`;
      queryClient.setQueryData<ConversationListResponse>(
        queryKeys.conversations.list(),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            conversations: old.conversations.map((c) => {
              if (c.counterpartyUserId !== notification.counterpartyUserId) return c;
              // Don't overwrite a recent text message preview — text messages are always
              // more current than a transaction notification arriving via SignalR
              if (c.lastMessageType === 'Text') return c;
              // This is the counterparty's view (they received the notification), so no "You: " prefix
              return { ...c, lastMessagePreview: preview, lastMessageType: 'Transaction', lastActivityAt: notification.date || new Date().toISOString() };
            }),
          };
        }
      );

      // Optimistically bump the pending count so the PendingIndicator badge
      // updates instantly without waiting for the refetch round-trip.
      queryClient.setQueryData<number>(
        queryKeys.transactions.pendingCount,
        (old) => (old ?? 0) + 1
      );

      // Invalidate all transaction-dependent queries (including analytics/insights)
      queryClient.invalidateQueries({ queryKey: ['transactions'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['pendingTransactions'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['accounts'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['budgets'], ...invalidateAll });
      // Only invalidate conversation list (not detail caches) to avoid racing
      // with the NewChatMessage optimistic append that updates detail caches.
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    });

    connection.on('P2PTransactionAccepted', (notification: P2PTransactionNotification) => {
      logger.info('P2P Transaction Accepted', { transactionId: notification.transactionId });
      optionsRef.current.onP2PTransactionAccepted?.(notification);
      
      // Invalidate all transaction-dependent queries
      queryClient.invalidateQueries({ queryKey: ['transactions'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['accounts'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['budgets'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    });

    connection.on('P2PTransactionRejected', (notification: P2PTransactionNotification) => {
      logger.info('P2P Transaction Rejected', { transactionId: notification.transactionId });
      optionsRef.current.onP2PTransactionRejected?.(notification);
      
      // Invalidate all transaction-dependent queries
      queryClient.invalidateQueries({ queryKey: ['transactions'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['pendingTransactions'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['accounts'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['budgets'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    });

    connection.on('NewChatMessage', async (notification: ChatMessageNotification) => {
      logger.info('SignalR: NewChatMessage received', { messageId: notification.messageId, senderId: notification.senderId });
      optionsRef.current.onNewChatMessage?.(notification);

      // Determine if this is my own message echoed back to me.
      // We can't use user.id (not in the auth type), so we check which
      // conversation detail cache exists. If we have a cache keyed by
      // recipientId, the recipient is our counterparty → we're the sender.
      const cachedByRecipient = queryClient.getQueryData<ConversationDetailResponse>(
        queryKeys.conversations.detail(notification.recipientId)
      );
      const isMyMessage = !!cachedByRecipient;
      // The detail key is always keyed by the COUNTERPARTY's user ID
      const counterpartyId = isMyMessage ? notification.recipientId : notification.senderId;
      const detailKey = queryKeys.conversations.detail(counterpartyId);

      // Cancel any in-flight refetches (e.g. from useCreateTransaction.onSuccess
      // invalidating conversations) so they don't overwrite our optimistic append
      // with stale data that doesn't include the new message yet.
      await queryClient.cancelQueries({ queryKey: detailKey });

      // Optimistically append ALL message types for instant display.
      // For Text messages the content is available immediately.
      // For Transaction messages the transaction data is now included in the
      // notification payload for instant rendering without waiting for refetch.
      queryClient.setQueryData<ConversationDetailResponse>(detailKey, (old) => {
        if (!old) return old;
        // Dedup — skip if message already exists (by server ID)
        if (old.messages.some(m => m.id === notification.messageId)) return old;

        // If this is our own message echoed back, the optimistic temp message
        // (from useOptimisticSendMessage with id "temp-...") is already in the
        // list. Replace it with the real server message instead of appending a
        // duplicate. Match by content + isFromMe for text, or by transactionId
        // for transaction messages.
        let messages = old.messages;
        if (isMyMessage) {
          const tempIndex = messages.findIndex(m => {
            if (!m.id.startsWith('temp-')) return false;
            if (notification.messageType === 'Transaction') {
              // Transaction temp messages won't exist (transactions use a different
              // mutation path), but guard anyway
              return false;
            }
            // Text message: match by content
            return m.isFromMe && m.content === notification.content;
          });
          if (tempIndex !== -1) {
            // Replace the temp message in-place with the real server message
            messages = [...messages];
            messages[tempIndex] = {
              ...messages[tempIndex],
              id: notification.messageId,
              senderUserId: notification.senderId,
              status: 'Delivered',
              deliveredAt: new Date().toISOString(),
            };
            return { ...old, messages };
          }
        }

        // Build optimistic transaction data if available in the notification.
        // The sender sees their own type; the receiver sees the inverse.
        let txData: import('../types/conversations').TransactionMessageData | null = null;
        if (notification.messageType === 'Transaction' && notification.transactionId && notification.amount != null && notification.currency) {
          const senderType = notification.transactionType as 'Send' | 'Receive' | undefined;
          // Sender's perspective is what the backend sent; receiver sees the inverse
          const viewerType = isMyMessage
            ? (senderType || 'Send')
            : (senderType === 'Send' ? 'Receive' : 'Send');
          txData = {
            transactionId: notification.transactionId,
            transactionLinkId: '', // Filled by refetch
            transactionType: viewerType,
            amount: notification.amount,
            currency: notification.currency,
            date: notification.sentAt,
            title: notification.title || null,
            notes: null,
            // Sender's transaction is always Confirmed; the notification may
            // carry "Pending" (correct for receiver) from P2PNotificationEventHandler.
            status: isMyMessage
              ? 'Confirmed'
              : ((notification.transactionStatus as 'Pending' | 'Confirmed' | 'Declined') || 'Pending'),
            accountName: null,
            primaryCategory: null,
            isDeleted: false,
            deletedAt: null,
          };
        }

        const newMsg: ConversationMessage = {
          id: notification.messageId,
          type: (notification.messageType as ConversationMessage['type']) || 'Text',
          senderUserId: notification.senderId,
          isFromMe: isMyMessage,
          content: notification.content || null,
          transaction: txData, // Populated from notification for instant display
          status: 'Delivered',
          createdAt: notification.sentAt,
          deliveredAt: new Date().toISOString(),
          readAt: null,
          isEdited: false,
          editedAt: null,
          isDeleted: false,
          deletedAt: null,
          replyToMessageId: null,
          replyTo: null,
        };
        return {
          ...old,
          messages: [...old.messages, newMsg],
          totalCount: old.totalCount + 1,
        };
      });

      // Optimistically update conversation list sidebar preview for instant feedback
      const previewContent = notification.messageType === 'Transaction'
        ? (isMyMessage
            ? `Sent ${notification.currency ? formatCurrency(notification.amount!, notification.currency) : ''}`
            : `Received ${notification.currency ? formatCurrency(notification.amount!, notification.currency) : ''}`)
        : notification.content || '';
      const previewText = isMyMessage ? `You: ${previewContent}` : previewContent;
      queryClient.setQueryData<ConversationListResponse>(
        queryKeys.conversations.list(),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            conversations: old.conversations.map((c) => {
              if (c.counterpartyUserId !== counterpartyId) return c;
              return {
                ...c,
                lastMessagePreview: previewText,
                lastMessageType: notification.messageType || 'Text',
                lastActivityAt: notification.sentAt,
                unreadCount: isMyMessage ? c.unreadCount : c.unreadCount + 1,
              };
            }),
          };
        }
      );

      // Invalidate after a short delay to get full server data (category, notes,
      // account name, etc.). The delay ensures the server has committed the chat
      // message before we refetch, preventing a stale response that would
      // overwrite our optimistic bubble.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: detailKey });
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
      }, 500);
    });

    connection.on('MessageDeleted', (notification: MessageDeletedNotification) => {
      logger.info('SignalR: MessageDeleted received', { messageId: notification.messageId, senderId: notification.senderId });
      
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(notification.senderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    });

    connection.on('MessageRestored', (notification: MessageRestoredNotification) => {
      logger.info('SignalR: MessageRestored received', { messageId: notification.messageId, senderId: notification.senderId });
      
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.detail(notification.senderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    });

    // When the counterparty reads our messages, update statuses to 'Read' instantly
    connection.on('MessagesRead', async (notification: { readByUserId: string }) => {
      logger.info('SignalR: MessagesRead received', { readByUserId: notification.readByUserId });
      const detailKey = queryKeys.conversations.detail(notification.readByUserId);
      // Cancel in-flight refetches so they don't overwrite with stale 'Delivered' statuses
      await queryClient.cancelQueries({ queryKey: detailKey });
      queryClient.setQueryData<ConversationDetailResponse>(
        detailKey,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages.map((m) =>
              m.isFromMe && m.status !== 'Read'
                ? { ...m, status: 'Read' as const, readAt: new Date().toISOString() }
                : m
            ),
          };
        }
      );
      // Also update the conversation list so the sidebar reflects read status
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    });

    connection.on('PendingCount', (notification: PendingCountNotification) => {
      optionsRef.current.onPendingCountUpdate?.(notification);
    });

    connection.on('Pong', (timestamp: string) => {
      logger.debug('Pong received', { timestamp });
    });

    // Presence events
    connection.on('UserOnline', (userId: string) => {
      logger.debug('User came online', { userId });
      optionsRef.current.presence?.onUserOnline?.(userId);
    });

    connection.on('UserOffline', (userId: string) => {
      logger.debug('User went offline', { userId });
      optionsRef.current.presence?.onUserOffline?.(userId);
    });

    return connection;
  }, [hubBaseUrl, queryClient]);

  // Start connection
  const connect = useCallback(async (token: string) => {
    const connection = initializeConnection(token);
    // Only start if truly disconnected — avoids race with Strict Mode double-invocation
    if (!connection || connection.state !== signalR.HubConnectionState.Disconnected) return;

    try {
      setConnectionState('Connecting');
      setError(null);
      await connection.start();
      setConnectionState('Connected');
      reconnectAttemptsRef.current = 0;
      logger.info('SignalR connected');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Ignore errors from stopping during negotiation (React Strict Mode cleanup)
      if (msg.includes('stopped during negotiation')) {
        logger.debug('SignalR connection stopped during negotiation (expected in dev mode)');
        return;
      }
      setConnectionState('Error');
      setError(msg);
      logger.error('SignalR connection error', { error: msg });
    }
  }, [initializeConnection]);

  // Disconnect
  const disconnect = useCallback(async () => {
    const connection = connectionRef.current;
    if (connection) {
      // Clear ref immediately so the next mount creates a fresh connection
      // instead of reusing a connection that's being stopped
      connectionRef.current = null;
      setConnectionState('Disconnected');
      try {
        await connection.stop();
      } catch {
        // Ignore errors when stopping (e.g. connection was mid-negotiation)
      }
    }
  }, []);

  // Join a conversation for real-time updates
  const joinConversation = useCallback(async (counterpartyUserId: string) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      await connectionRef.current.invoke('JoinConversation', counterpartyUserId);
    }
  }, []);

  // Leave a conversation
  const leaveConversation = useCallback(async (counterpartyUserId: string) => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      await connectionRef.current.invoke('LeaveConversation', counterpartyUserId);
    }
  }, []);

  // Ping to keep connection alive
  const ping = useCallback(async () => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      await connectionRef.current.invoke('Ping');
    }
  }, []);

  // Query which users from a list are currently online
  const getOnlineUsers = useCallback(async (userIds: string[]): Promise<string[]> => {
    if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
      try {
        return await connectionRef.current.invoke<string[]>('GetOnlineUsers', userIds);
      } catch {
        return [];
      }
    }
    return [];
  }, []);

  // Auto-connect when authenticated
  // Use refs to avoid stale closures while keeping effect stable
  const connectRef = useRef(connect);
  const disconnectRef = useRef(disconnect);
  connectRef.current = connect;
  disconnectRef.current = disconnect;

  useEffect(() => {
    if (user && accessToken) {
      logger.info('SignalR: connecting for user', { email: user.email });
      connectRef.current(accessToken);
    } else {
      disconnectRef.current();
    }

    return () => {
      disconnectRef.current();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, !!accessToken]); // Only reconnect when user identity changes, not on token refresh

  // Keep-alive ping at configured interval
  useEffect(() => {
    if (connectionState !== 'Connected') return;

    const pingInterval = setInterval(() => {
      ping();
    }, NOTIFICATION_CONSTANTS.PING_INTERVAL_MS);

    return () => clearInterval(pingInterval);
  }, [connectionState, ping]);

  return {
    connectionState,
    error,
    isConnected: connectionState === 'Connected',
    connect: () => accessToken && connect(accessToken),
    disconnect,
    joinConversation,
    leaveConversation,
    getOnlineUsers,
    ping,
  };
}

export default useNotifications;