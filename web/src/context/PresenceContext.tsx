import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';

type QueryFn = (userIds: string[]) => Promise<string[]>;

interface PresenceContextValue {
  /** Set of user IDs currently online */
  onlineUsers: Set<string>;
  /** Whether the SignalR connection is active */
  isConnected: boolean;
  /** Check if a specific user is online */
  isOnline: (userId: string) => boolean;
  /** Add a user to the online set (called from SignalR event) */
  setUserOnline: (userId: string) => void;
  /** Remove a user from the online set (called from SignalR event) */
  setUserOffline: (userId: string) => void;
  /** Bulk-set online users (called after initial GetOnlineUsers hub invoke) */
  setOnlineUsers: (userIds: string[]) => void;
  /** Register the SignalR query function (called by Layout) */
  registerQueryFn: (fn: QueryFn) => void;
  /** Query which users are online via SignalR and update state */
  queryOnlineUsers: (userIds: string[]) => Promise<void>;
  /** Set the SignalR connection state (called by Layout) */
  setConnected: (connected: boolean) => void;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [onlineUsers, setOnlineUsersState] = useState<Set<string>>(new Set());
  const [isConnected, setConnected] = useState(false);
  const queryFnRef = useRef<QueryFn | null>(null);

  const setUserOnline = useCallback((userId: string) => {
    setOnlineUsersState(prev => {
      if (prev.has(userId)) return prev;
      const next = new Set(prev);
      next.add(userId);
      return next;
    });
  }, []);

  const setUserOffline = useCallback((userId: string) => {
    setOnlineUsersState(prev => {
      if (!prev.has(userId)) return prev;
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  const setOnlineUsers = useCallback((userIds: string[]) => {
    setOnlineUsersState(new Set(userIds));
  }, []);

  const isOnline = useCallback((userId: string) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  const registerQueryFn = useCallback((fn: QueryFn) => {
    queryFnRef.current = fn;
  }, []);

  const queryOnlineUsers = useCallback(async (userIds: string[]) => {
    if (!queryFnRef.current || userIds.length === 0) return;
    const onlineIds = await queryFnRef.current(userIds);
    if (onlineIds.length > 0) {
      setOnlineUsersState(prev => {
        const next = new Set(prev);
        for (const id of onlineIds) next.add(id);
        return next;
      });
    }
  }, []);

  const value = useMemo(() => ({
    onlineUsers,
    isConnected,
    isOnline,
    setUserOnline,
    setUserOffline,
    setOnlineUsers,
    registerQueryFn,
    queryOnlineUsers,
    setConnected,
  }), [onlineUsers, isConnected, isOnline, setUserOnline, setUserOffline, setOnlineUsers, registerQueryFn, queryOnlineUsers]);

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
}
