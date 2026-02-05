import { useState, useEffect, useSyncExternalStore, useCallback, useRef } from 'react';
import { logger } from '../services/logger';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true; // Assume online during SSR
}

/**
 * Simple hook to check if the device is online
 */
export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export interface OnlineStatusExtended {
  isOnline: boolean;
  wasOffline: boolean; // True if was offline and just came back online (for UI feedback)
  lastOnlineAt: Date | null;
}

/**
 * Extended online status hook with reconnection detection
 * Useful for showing "Back online" notifications
 */
export function useOnlineStatusExtended(): OnlineStatusExtended {
  const isOnline = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(isOnline ? new Date() : null);
  const wasOnlineRef = useRef(isOnline);

  useEffect(() => {
    // Coming back online
    if (isOnline && !wasOnlineRef.current) {
      setLastOnlineAt(new Date());
      setWasOffline(true);
      // Clear "back online" indicator after 3 seconds
      const timer = setTimeout(() => setWasOffline(false), 3000);
      return () => clearTimeout(timer);
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline]);

  return { isOnline, wasOffline, lastOnlineAt };
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState<OfflineAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const isOnline = useOnlineStatus();

  // Load queue from IndexedDB on mount
  useEffect(() => {
    loadQueue().then(setQueue);
  }, []);

  const addToQueue = async (action: OfflineAction) => {
    const newQueue = [...queue, { ...action, id: Date.now().toString(), timestamp: new Date().toISOString() }];
    setQueue(newQueue);
    await saveQueue(newQueue);
  };

  const syncQueue = useCallback(async () => {
    if (isSyncing || queue.length === 0) return;
    
    setIsSyncing(true);
    const successfulIds: string[] = [];

    for (const action of queue) {
      try {
        await executeAction(action);
        successfulIds.push(action.id!);
      } catch (error) {
        logger.error('Failed to sync action:', action, error);
        // Stop syncing on first failure to maintain order
        break;
      }
    }

    const remainingQueue = queue.filter(a => !successfulIds.includes(a.id!));
    setQueue(remainingQueue);
    await saveQueue(remainingQueue);
    setIsSyncing(false);
  }, [isSyncing, queue]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline && queue.length > 0 && !isSyncing) {
      syncQueue();
    }
  }, [isOnline, queue.length, isSyncing, syncQueue]);

  return { queue, addToQueue, syncQueue, isSyncing };
}

export interface OfflineAction {
  id?: string;
  type: 'CREATE_TRANSACTION' | 'UPDATE_TRANSACTION' | 'DELETE_TRANSACTION' | 'SEND_MESSAGE';
  payload: unknown;
  timestamp?: string;
}

// IndexedDB helpers
const DB_NAME = 'digitransac-offline';
const DB_VERSION = 2; // Bumped version for new stores
const STORE_QUEUE = 'offline-queue';
const STORE_LOCATIONS = 'cached-locations';
const STORE_MESSAGES = 'cached-messages';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create offline queue store
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
      }
      
      // Create locations cache store
      if (!db.objectStoreNames.contains(STORE_LOCATIONS)) {
        const locationStore = db.createObjectStore(STORE_LOCATIONS, { keyPath: 'id' });
        locationStore.createIndex('userId', 'userId', { unique: false });
        locationStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Create messages cache store
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const messageStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
        messageStore.createIndex('conversationId', 'conversationId', { unique: false });
        messageStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

async function saveQueue(queue: OfflineAction[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_QUEUE, 'readwrite');
  const store = tx.objectStore(STORE_QUEUE);
  
  // Clear existing and add all
  store.clear();
  queue.forEach(action => store.add(action));
  
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadQueue(): Promise<OfflineAction[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_QUEUE, 'readonly');
    const store = tx.objectStore(STORE_QUEUE);
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

async function executeAction(action: OfflineAction): Promise<void> {
  const token = localStorage.getItem('accessToken');
  if (!token) throw new Error('No auth token');

  const API_BASE_URL = '/api';

  switch (action.type) {
    case 'CREATE_TRANSACTION': {
      const response = await fetch(`${API_BASE_URL}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(action.payload),
      });
      if (!response.ok) throw new Error('Failed to create transaction');
      break;
    }
    case 'UPDATE_TRANSACTION': {
      const { id, ...data } = action.payload as { id: string; [key: string]: unknown };
      const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update transaction');
      break;
    }
    case 'DELETE_TRANSACTION': {
      const { id } = action.payload as { id: string };
      const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete transaction');
      break;
    }
    case 'SEND_MESSAGE': {
      const { userId, content, replyToMessageId } = action.payload as {
        userId: string;
        content: string;
        replyToMessageId?: string;
      };
      const response = await fetch(`${API_BASE_URL}/conversations/${userId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content, replyToMessageId }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      break;
    }
  }
}

// ============================================
// Location Cache for Offline Map Viewing
// ============================================

export interface CachedLocation {
  id: string;
  transactionId: string;
  userId: string;
  latitude: number;
  longitude: number;
  placeName?: string;
  city?: string;
  country?: string;
  amount: number;
  currency: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  date: string;
  timestamp: string; // When cached
}

/**
 * Cache transaction locations for offline map viewing
 */
export async function cacheLocations(locations: CachedLocation[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_LOCATIONS, 'readwrite');
    const store = tx.objectStore(STORE_LOCATIONS);
    
    // Add or update each location
    for (const location of locations) {
      store.put({
        ...location,
        timestamp: new Date().toISOString(),
      });
    }
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        logger.info(`Cached ${locations.length} locations for offline use`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    logger.error('Failed to cache locations:', error);
  }
}

/**
 * Get cached locations for offline map viewing
 */
export async function getCachedLocations(userId?: string): Promise<CachedLocation[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_LOCATIONS, 'readonly');
    const store = tx.objectStore(STORE_LOCATIONS);
    
    if (userId) {
      const index = store.index('userId');
      const request = index.getAll(userId);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } else {
      const request = store.getAll();
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    }
  } catch (error) {
    logger.error('Failed to get cached locations:', error);
    return [];
  }
}

/**
 * Clear old cached locations (older than 7 days by default)
 */
export async function clearOldCachedLocations(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_LOCATIONS, 'readwrite');
    const store = tx.objectStore(STORE_LOCATIONS);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const locations = request.result as CachedLocation[];
      const now = Date.now();
      
      for (const location of locations) {
        const age = now - new Date(location.timestamp).getTime();
        if (age > maxAgeMs) {
          store.delete(location.id);
        }
      }
    };
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    logger.error('Failed to clear old cached locations:', error);
  }
}

// ============================================
// Message Cache for Offline Chat Viewing
// ============================================

export interface CachedMessage {
  id: string;
  conversationId: string;
  content: string;
  isFromMe: boolean;
  createdAt: string;
  status: 'Pending' | 'Sent' | 'Read';
  replyToMessageId?: string;
  timestamp: string; // When cached
}

/**
 * Cache conversation messages for offline viewing
 */
export async function cacheMessages(conversationId: string, messages: CachedMessage[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);
    
    // Add or update each message
    for (const message of messages) {
      store.put({
        ...message,
        conversationId,
        timestamp: new Date().toISOString(),
      });
    }
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        logger.info(`Cached ${messages.length} messages for conversation ${conversationId}`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    logger.error('Failed to cache messages:', error);
  }
}

/**
 * Get cached messages for a conversation
 */
export async function getCachedMessages(conversationId: string): Promise<CachedMessage[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_MESSAGES, 'readonly');
    const store = tx.objectStore(STORE_MESSAGES);
    const index = store.index('conversationId');
    const request = index.getAll(conversationId);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const messages = (request.result || []) as CachedMessage[];
        // Sort by createdAt
        messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    logger.error('Failed to get cached messages:', error);
    return [];
  }
}

/**
 * Hook for using cached locations in offline mode
 */
export function useOfflineLocations() {
  const [locations, setLocations] = useState<CachedLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isOnline = useOnlineStatus();
  
  useEffect(() => {
    if (!isOnline) {
      // Load cached locations when offline
      setIsLoading(true);
      getCachedLocations()
        .then(setLocations)
        .finally(() => setIsLoading(false));
    }
  }, [isOnline]);
  
  const refreshCache = useCallback(async (newLocations: CachedLocation[]) => {
    await cacheLocations(newLocations);
    setLocations(newLocations);
  }, []);
  
  return { locations, isLoading, refreshCache, isOffline: !isOnline };
}

/**
 * Hook for using cached messages in offline mode
 */
export function useOfflineMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<CachedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isOnline = useOnlineStatus();
  
  useEffect(() => {
    if (!isOnline && conversationId) {
      // Load cached messages when offline
      setIsLoading(true);
      getCachedMessages(conversationId)
        .then(setMessages)
        .finally(() => setIsLoading(false));
    }
  }, [isOnline, conversationId]);
  
  const refreshCache = useCallback(async (newMessages: CachedMessage[]) => {
    if (conversationId) {
      await cacheMessages(conversationId, newMessages);
      setMessages(newMessages);
    }
  }, [conversationId]);
  
  return { messages, isLoading, refreshCache, isOffline: !isOnline };
}
