import axios from 'axios';
import {
  initDB,
  STORES,
  getAllItems,
  putManyItems,
  clearStore,
  getSyncQueue,
  clearSyncQueue,
} from './indexedDB';

/**
 * Offline sync service
 * Handles data synchronization between IndexedDB and API
 */

// Check if online
export const isOnline = (): boolean => {
  return navigator.onLine;
};

/**
 * Sync data from API to IndexedDB
 */
export const syncFromAPI = async (token: string): Promise<void> => {
  if (!isOnline()) {
    console.log('Offline: Cannot sync from API');
    return;
  }

  try {
    await initDB();

    // Fetch all data in parallel
    const headers = { Authorization: `Bearer ${token}` };
    const [transactionsRes, accountsRes, categoriesRes, budgetsRes, tagsRes] = await Promise.all([
      axios.get('/api/transactions', { headers }).catch(() => ({ data: { transactions: [] } })),
      axios.get('/api/accounts', { headers }).catch(() => ({ data: [] })),
      axios.get('/api/categories', { headers }).catch(() => ({ data: [] })),
      axios.get('/api/budgets', { headers }).catch(() => ({ data: [] })),
      axios.get('/api/tags', { headers }).catch(() => ({ data: [] })),
    ]);

    // Store data in IndexedDB
    await Promise.all([
      putManyItems(STORES.TRANSACTIONS, transactionsRes.data.transactions || []),
      putManyItems(STORES.ACCOUNTS, accountsRes.data || []),
      putManyItems(STORES.CATEGORIES, categoriesRes.data || []),
      putManyItems(STORES.BUDGETS, budgetsRes.data || []),
      putManyItems(
        STORES.TAGS,
        (tagsRes.data || []).map((tag: string) => ({ name: tag }))
      ),
    ]);

    console.log('✅ Data synced from API to IndexedDB');
  } catch (error) {
    console.error('Failed to sync from API:', error);
    throw error;
  }
};

/**
 * Sync pending changes from IndexedDB to API
 */
export const syncToAPI = async (token: string): Promise<void> => {
  if (!isOnline()) {
    console.log('Offline: Cannot sync to API');
    return;
  }

  try {
    await initDB();
    const queue = await getSyncQueue();

    if (queue.length === 0) {
      console.log('No pending changes to sync');
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    // Process each queued item
    for (const item of queue) {
      try {
        switch (item.action) {
          case 'CREATE':
            if (item.storeName === 'transactions') {
              await axios.post('/api/transactions', item.data, { headers });
            } else if (item.storeName === 'accounts') {
              await axios.post('/api/accounts', item.data, { headers });
            } else if (item.storeName === 'categories') {
              await axios.post('/api/categories', item.data, { headers });
            } else if (item.storeName === 'budgets') {
              await axios.post('/api/budgets', item.data, { headers });
            }
            break;

          case 'UPDATE':
            if (item.storeName === 'transactions') {
              await axios.put(`/api/transactions/${item.data.id}`, item.data, { headers });
            } else if (item.storeName === 'accounts') {
              await axios.put(`/api/accounts/${item.data.id}`, item.data, { headers });
            } else if (item.storeName === 'categories') {
              await axios.put(`/api/categories/${item.data.id}`, item.data, { headers });
            } else if (item.storeName === 'budgets') {
              await axios.put(`/api/budgets/${item.data.id}`, item.data, { headers });
            }
            break;

          case 'DELETE':
            if (item.storeName === 'transactions') {
              await axios.delete(`/api/transactions/${item.data.id}`, { headers });
            } else if (item.storeName === 'accounts') {
              await axios.delete(`/api/accounts/${item.data.id}`, { headers });
            } else if (item.storeName === 'categories') {
              await axios.delete(`/api/categories/${item.data.id}`, { headers });
            } else if (item.storeName === 'budgets') {
              await axios.delete(`/api/budgets/${item.data.id}`, { headers });
            }
            break;
        }
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        // Continue with next item
      }
    }

    // Clear queue after successful sync
    await clearSyncQueue();
    console.log('✅ Synced pending changes to API');
  } catch (error) {
    console.error('Failed to sync to API:', error);
    throw error;
  }
};

/**
 * Get data from IndexedDB (offline fallback)
 */
export const getOfflineData = async <T>(storeName: string): Promise<T[]> => {
  try {
    await initDB();
    return await getAllItems<T>(storeName);
  } catch (error) {
    console.error('Failed to get offline data:', error);
    return [];
  }
};

/**
 * Clear all offline data
 */
export const clearOfflineData = async (): Promise<void> => {
  try {
    await initDB();
    await Promise.all([
      clearStore(STORES.TRANSACTIONS),
      clearStore(STORES.ACCOUNTS),
      clearStore(STORES.CATEGORIES),
      clearStore(STORES.BUDGETS),
      clearStore(STORES.TAGS),
      clearSyncQueue(),
    ]);
    console.log('✅ Cleared all offline data');
  } catch (error) {
    console.error('Failed to clear offline data:', error);
    throw error;
  }
};

/**
 * Setup automatic sync on network reconnection
 */
export const setupAutoSync = (token: string): (() => void) => {
  const handleOnline = () => {
    console.log('Network reconnected, syncing...');
    syncToAPI(token).then(() => syncFromAPI(token));
  };

  window.addEventListener('online', handleOnline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
  };
};
