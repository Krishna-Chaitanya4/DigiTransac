import { useState, useEffect } from 'react';
import { syncManager } from '../utils/offline/sync';

/**
 * Hook to monitor offline status and sync state
 */
export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update queue size and last sync time
    const updateStatus = async () => {
      const size = await syncManager.getQueueSize();
      const lastSync = await syncManager.getLastSyncTime();
      setQueueSize(size);
      setLastSyncTime(lastSync);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000);

    // Listen for sync events from service worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'BACKGROUND_SYNC') {
        if (event.data.action === 'START_SYNC') {
          manualSync();
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  const manualSync = async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      await syncManager.sync();
      const size = await syncManager.getQueueSize();
      const lastSync = await syncManager.getLastSyncTime();
      setQueueSize(size);
      setLastSyncTime(lastSync);
    } finally {
      setIsSyncing(false);
    }
  };

  const registerBackgroundSync = async () => {
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // Type assertion for sync API (experimental feature)
        await (registration as any).sync.register('sync-transactions');
        console.log('Background sync registered');
      } catch (error) {
        console.error('Background sync registration failed:', error);
      }
    }
  };

  return {
    isOnline,
    queueSize,
    lastSyncTime,
    isSyncing,
    manualSync,
    registerBackgroundSync,
  };
};
