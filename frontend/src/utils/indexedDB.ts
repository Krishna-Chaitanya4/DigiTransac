/**
 * IndexedDB wrapper for offline data persistence
 */

const DB_NAME = 'DigiTransacDB';
const DB_VERSION = 1;

// Store names
export const STORES = {
  TRANSACTIONS: 'transactions',
  ACCOUNTS: 'accounts',
  CATEGORIES: 'categories',
  BUDGETS: 'budgets',
  TAGS: 'tags',
  SYNC_QUEUE: 'syncQueue',
} as const;

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create object stores
      if (!database.objectStoreNames.contains(STORES.TRANSACTIONS)) {
        const txnStore = database.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
        txnStore.createIndex('date', 'date', { unique: false });
        txnStore.createIndex('accountId', 'accountId', { unique: false });
        txnStore.createIndex('categoryId', 'categoryId', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORES.ACCOUNTS)) {
        database.createObjectStore(STORES.ACCOUNTS, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(STORES.CATEGORIES)) {
        database.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(STORES.BUDGETS)) {
        const budgetStore = database.createObjectStore(STORES.BUDGETS, { keyPath: 'id' });
        budgetStore.createIndex('month', 'month', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORES.TAGS)) {
        database.createObjectStore(STORES.TAGS, { keyPath: 'name' });
      }

      if (!database.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = database.createObjectStore(STORES.SYNC_QUEUE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

/**
 * Generic get operation
 */
export const getItem = async <T>(storeName: string, key: string): Promise<T | undefined> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Generic get all operation
 */
export const getAllItems = async <T>(storeName: string): Promise<T[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Generic put operation (add or update)
 */
export const putItem = async <T>(storeName: string, item: T): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Generic put many operation
 */
export const putManyItems = async <T>(storeName: string, items: T[]): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    let completed = 0;
    const total = items.length;

    items.forEach((item) => {
      const request = store.put(item);
      request.onsuccess = () => {
        completed++;
        if (completed === total) resolve();
      };
      request.onerror = () => reject(request.error);
    });

    if (total === 0) resolve();
  });
};

/**
 * Generic delete operation
 */
export const deleteItem = async (storeName: string, key: string): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Clear all data from a store
 */
export const clearStore = async (storeName: string): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Add item to sync queue
 */
export interface SyncQueueItem {
  id?: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  storeName: string;
  data: any;
  timestamp: number;
}

export const addToSyncQueue = async (item: Omit<SyncQueueItem, 'id'>): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.add(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Get sync queue items
 */
export const getSyncQueue = async (): Promise<SyncQueueItem[]> => {
  return getAllItems<SyncQueueItem>(STORES.SYNC_QUEUE);
};

/**
 * Clear sync queue
 */
export const clearSyncQueue = async (): Promise<void> => {
  return clearStore(STORES.SYNC_QUEUE);
};

/**
 * Close database connection
 */
export const closeDB = (): void => {
  if (db) {
    db.close();
    db = null;
  }
};
