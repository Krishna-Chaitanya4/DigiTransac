import { offlineDB, SyncQueueItem } from './db';
import axios from 'axios';
import { getApiUrl } from '../../services/config.service';

/**
 * Background sync manager for offline changes
 */

export class SyncManager {
  private syncInProgress = false;
  private syncInterval: number | null = null;

  async startAutoSync() {
    // Try to sync immediately
    await this.sync();

    // Then sync every 30 seconds when online
    this.syncInterval = window.setInterval(() => {
      if (navigator.onLine && !this.syncInProgress) {
        this.sync();
      }
    }, 30000);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async sync(): Promise<{ success: number; failed: number }> {
    if (this.syncInProgress || !navigator.onLine) {
      return { success: 0, failed: 0 };
    }

    this.syncInProgress = true;
    let successCount = 0;
    let failedCount = 0;

    try {
      const queue = await offlineDB.getSyncQueue();
      console.log(`Starting sync: ${queue.length} items in queue`);

      for (const item of queue) {
        try {
          await this.syncItem(item);
          await offlineDB.removeSyncQueueItem(item.id);
          successCount++;
        } catch (error) {
          console.error('Sync item failed:', error);
          failedCount++;

          // Increment retry count
          await offlineDB.incrementRetryCount(item.id);

          // Remove from queue after 5 failed attempts
          const updatedItem = await offlineDB.get<SyncQueueItem>('syncQueue', item.id);
          if (updatedItem && updatedItem.retryCount >= 5) {
            console.error('Max retries reached, removing from queue:', item);
            await offlineDB.removeSyncQueueItem(item.id);
          }
        }
      }

      console.log(`Sync complete: ${successCount} success, ${failedCount} failed`);

      // Update last sync timestamp
      if (successCount > 0) {
        await offlineDB.setMetadata('lastSyncTime', Date.now());
      }
    } finally {
      this.syncInProgress = false;
    }

    return { success: successCount, failed: failedCount };
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    const baseUrl = await getApiUrl();
    const token = localStorage.getItem('token');

    if (!token) {
      throw new Error('No auth token found');
    }

    const config = {
      headers: { Authorization: `Bearer ${token}` },
    };

    const endpoint = `${baseUrl}/${item.entity}s`;

    switch (item.type) {
      case 'create':
        await axios.post(endpoint, item.data, config);
        break;

      case 'update':
        await axios.put(`${endpoint}/${item.data._id}`, item.data, config);
        break;

      case 'delete':
        await axios.delete(`${endpoint}/${item.data._id}`, config);
        break;

      default:
        throw new Error(`Unknown sync type: ${item.type}`);
    }
  }

  async queueCreate(entity: SyncQueueItem['entity'], data: any): Promise<void> {
    await offlineDB.addToSyncQueue({
      type: 'create',
      entity,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    });

    // Try to sync immediately if online
    if (navigator.onLine) {
      this.sync();
    }
  }

  async queueUpdate(entity: SyncQueueItem['entity'], data: any): Promise<void> {
    await offlineDB.addToSyncQueue({
      type: 'update',
      entity,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    });

    if (navigator.onLine) {
      this.sync();
    }
  }

  async queueDelete(entity: SyncQueueItem['entity'], id: string): Promise<void> {
    await offlineDB.addToSyncQueue({
      type: 'delete',
      entity,
      data: { _id: id },
      timestamp: Date.now(),
      retryCount: 0,
    });

    if (navigator.onLine) {
      this.sync();
    }
  }

  async getQueueSize(): Promise<number> {
    const queue = await offlineDB.getSyncQueue();
    return queue.length;
  }

  async getLastSyncTime(): Promise<number | null> {
    return await offlineDB.getMetadata('lastSyncTime');
  }
}

// Singleton instance
export const syncManager = new SyncManager();
