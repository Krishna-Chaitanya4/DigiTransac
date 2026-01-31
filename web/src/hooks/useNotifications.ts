import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from '../context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

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

export interface PendingCountNotification {
  pendingCount: number;
}

interface UseNotificationsOptions {
  onP2PTransactionCreated?: (notification: P2PTransactionNotification) => void;
  onP2PTransactionAccepted?: (notification: P2PTransactionNotification) => void;
  onP2PTransactionRejected?: (notification: P2PTransactionNotification) => void;
  onChatMessage?: (notification: ChatMessageNotification) => void;
  onNewChatMessage?: (notification: ChatMessageNotification) => void;
  onPendingCountUpdate?: (notification: PendingCountNotification) => void;
}

type ConnectionState = 'Disconnected' | 'Connecting' | 'Connected' | 'Reconnecting' | 'Error';

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('Disconnected');
  const [error, setError] = useState<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const optionsRef = useRef(options);
  
  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Get the API URL from environment
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Initialize connection
  const initializeConnection = useCallback((token: string) => {
    if (connectionRef.current) return connectionRef.current;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${apiUrl}/hubs/notifications`, {
        accessTokenFactory: () => token,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext: signalR.RetryContext) => {
          if (retryContext.previousRetryCount >= maxReconnectAttempts) {
            return null; // Stop reconnecting
          }
          // Exponential backoff: 0, 2, 4, 8, 16 seconds
          return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
        },
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connectionRef.current = connection;

    // Handle connection state changes
    connection.onreconnecting((err: Error | undefined) => {
      setConnectionState('Reconnecting');
      console.log('SignalR reconnecting...', err);
    });

    connection.onreconnected((connectionId: string | undefined) => {
      setConnectionState('Connected');
      reconnectAttemptsRef.current = 0;
      console.log('SignalR reconnected:', connectionId);
    });

    connection.onclose((err: Error | undefined) => {
      setConnectionState('Disconnected');
      if (err) {
        setError(err.message);
        console.error('SignalR connection closed with error:', err);
      }
    });

    // Register event handlers
    connection.on('P2PTransactionCreated', (notification: P2PTransactionNotification) => {
      console.log('P2P Transaction Created:', notification);
      optionsRef.current.onP2PTransactionCreated?.(notification);
      
      // Invalidate relevant queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['pendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    connection.on('P2PTransactionAccepted', (notification: P2PTransactionNotification) => {
      console.log('P2P Transaction Accepted:', notification);
      optionsRef.current.onP2PTransactionAccepted?.(notification);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    connection.on('P2PTransactionRejected', (notification: P2PTransactionNotification) => {
      console.log('P2P Transaction Rejected:', notification);
      optionsRef.current.onP2PTransactionRejected?.(notification);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['pendingTransactions'] });
    });

    connection.on('ChatMessage', (notification: ChatMessageNotification) => {
      console.log('Chat Message:', notification);
      optionsRef.current.onChatMessage?.(notification);
      
      // Invalidate chat queries
      queryClient.invalidateQueries({ queryKey: ['chatMessages'] });
    });

    connection.on('NewChatMessage', (notification: ChatMessageNotification) => {
      console.log('New Chat Message:', notification);
      optionsRef.current.onNewChatMessage?.(notification);
      
      // Invalidate conversations list
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    });

    connection.on('PendingCount', (notification: PendingCountNotification) => {
      optionsRef.current.onPendingCountUpdate?.(notification);
    });

    connection.on('Pong', (timestamp: string) => {
      console.log('Pong received:', timestamp);
    });

    return connection;
  }, [apiUrl, queryClient]);

  // Start connection
  const connect = useCallback(async (token: string) => {
    const connection = initializeConnection(token);
    if (!connection || connection.state === signalR.HubConnectionState.Connected) return;

    try {
      setConnectionState('Connecting');
      setError(null);
      await connection.start();
      setConnectionState('Connected');
      reconnectAttemptsRef.current = 0;
      console.log('SignalR connected');
    } catch (err) {
      setConnectionState('Error');
      setError(err instanceof Error ? err.message : 'Failed to connect');
      console.error('SignalR connection error:', err);
    }
  }, [initializeConnection]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (connectionRef.current) {
      await connectionRef.current.stop();
      connectionRef.current = null;
      setConnectionState('Disconnected');
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

  // Auto-connect when authenticated
  useEffect(() => {
    if (user && accessToken) {
      connect(accessToken);
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, accessToken, connect, disconnect]);

  // Keep-alive ping every 30 seconds
  useEffect(() => {
    if (connectionState !== 'Connected') return;

    const pingInterval = setInterval(() => {
      ping();
    }, 30000);

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
    ping,
  };
}

export default useNotifications;