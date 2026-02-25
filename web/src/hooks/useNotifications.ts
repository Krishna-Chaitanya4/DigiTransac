import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from '../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { NOTIFICATION_CONSTANTS } from '../utils/constants';
import { API_BASE_URL } from '../services/apiClient';
import { getStoredAccessToken } from '../services/tokenStorage';
import { logger } from '../services/logger';
import { queryKeys } from '../lib/queryClient';
import type { ConversationDetailResponse } from '../types/conversations';

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
  senderName?: string;
  messageType: string;
  content?: string;
  transactionId?: string;
  sentAt: string;
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
  onChatMessage?: (notification: ChatMessageNotification) => void;
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
      
      // Invalidate all transaction-dependent queries (including analytics/insights)
      queryClient.invalidateQueries({ queryKey: ['transactions'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['pendingTransactions'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['accounts'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['budgets'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['conversations'], ...invalidateAll });
    });

    connection.on('P2PTransactionAccepted', (notification: P2PTransactionNotification) => {
      logger.info('P2P Transaction Accepted', { transactionId: notification.transactionId });
      optionsRef.current.onP2PTransactionAccepted?.(notification);
      
      // Invalidate all transaction-dependent queries
      queryClient.invalidateQueries({ queryKey: ['transactions'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['accounts'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['budgets'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['conversations'], ...invalidateAll });
    });

    connection.on('P2PTransactionRejected', (notification: P2PTransactionNotification) => {
      logger.info('P2P Transaction Rejected', { transactionId: notification.transactionId });
      optionsRef.current.onP2PTransactionRejected?.(notification);
      
      // Invalidate all transaction-dependent queries
      queryClient.invalidateQueries({ queryKey: ['transactions'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['pendingTransactions'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['accounts'], ...invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['budgets'], ...invalidateAll });
    });

    connection.on('ChatMessage', (notification: ChatMessageNotification) => {
      logger.info('SignalR: ChatMessage received', { messageId: notification.messageId, senderId: notification.senderId });
      optionsRef.current.onChatMessage?.(notification);
      
      // Invalidate conversation detail for this sender
      // This ensures real-time message updates in the active conversation
      queryClient.invalidateQueries({ queryKey: ['conversations', 'detail', notification.senderId] });
      // Also invalidate the conversations list to update previews
      queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
    });

    connection.on('NewChatMessage', (notification: ChatMessageNotification) => {
      logger.info('SignalR: NewChatMessage received', { messageId: notification.messageId, senderId: notification.senderId });
      optionsRef.current.onNewChatMessage?.(notification);
      
      // Invalidate conversation detail for this sender
      queryClient.invalidateQueries({ queryKey: ['conversations', 'detail', notification.senderId] });
      // Invalidate conversations list to show new message in sidebar
      queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
    });

    connection.on('MessageDeleted', (notification: MessageDeletedNotification) => {
      logger.info('SignalR: MessageDeleted received', { messageId: notification.messageId, senderId: notification.senderId });
      
      // Invalidate conversation detail to remove the deleted message
      queryClient.invalidateQueries({ queryKey: ['conversations', 'detail', notification.senderId] });
      // Invalidate conversations list to update preview if deleted message was the latest
      queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
    });

    connection.on('MessageRestored', (notification: MessageRestoredNotification) => {
      logger.info('SignalR: MessageRestored received', { messageId: notification.messageId, senderId: notification.senderId });
      
      // Invalidate conversation detail to show the restored message
      queryClient.invalidateQueries({ queryKey: ['conversations', 'detail', notification.senderId] });
      // Invalidate conversations list to update preview
      queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
    });

    // When the counterparty reads our messages, update statuses to 'Read' instantly
    connection.on('MessagesRead', (notification: { readByUserId: string }) => {
      logger.info('SignalR: MessagesRead received', { readByUserId: notification.readByUserId });
      queryClient.setQueryData<ConversationDetailResponse>(
        queryKeys.conversations.detail(notification.readByUserId),
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