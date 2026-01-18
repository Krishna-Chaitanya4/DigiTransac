import { useState, useEffect, useSyncExternalStore } from 'react';
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

export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState<OfflineAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const isOnline = useOnlineStatus();

  // Load queue from IndexedDB on mount
  useEffect(() => {
    loadQueue().then(setQueue);
  }, []);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline && queue.length > 0 && !isSyncing) {
      syncQueue();
    }
  }, [isOnline, queue.length]);

  const addToQueue = async (action: OfflineAction) => {
    const newQueue = [...queue, { ...action, id: Date.now().toString(), timestamp: new Date().toISOString() }];
    setQueue(newQueue);
    await saveQueue(newQueue);
  };

  const syncQueue = async () => {
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
  };

  return { queue, addToQueue, syncQueue, isSyncing };
}

export interface OfflineAction {
  id?: string;
  type: 'CREATE_TRANSACTION' | 'UPDATE_TRANSACTION' | 'DELETE_TRANSACTION';
  payload: unknown;
  timestamp?: string;
}

// IndexedDB helpers
const DB_NAME = 'digitransac-offline';
const STORE_NAME = 'offline-queue';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function saveQueue(queue: OfflineAction[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
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
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
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
  }
}
