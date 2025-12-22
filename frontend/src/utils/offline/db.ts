/**
 * IndexedDB setup for offline storage
 */

const DB_NAME = 'DigiTransac';
const DB_VERSION = 1;

export interface Transaction {
  _id: string;
  userId: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: string;
  accountId?: string;
  tags?: string[];
  splits?: Array<{
    categoryId: string;
    amount: number;
    description?: string;
  }>;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  _id: string;
  userId: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  _id: string;
  userId: string;
  name: string;
  type: 'bank' | 'cash' | 'credit' | 'investment';
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  _id: string;
  userId: string;
  categoryId: string;
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'transaction' | 'category' | 'account' | 'budget';
  data: any;
  timestamp: number;
  retryCount: number;
}

export class OfflineDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Transactions store
        if (!db.objectStoreNames.contains('transactions')) {
          const transactionStore = db.createObjectStore('transactions', { keyPath: '_id' });
          transactionStore.createIndex('userId', 'userId', { unique: false });
          transactionStore.createIndex('date', 'date', { unique: false });
          transactionStore.createIndex('category', 'category', { unique: false });
          transactionStore.createIndex('type', 'type', { unique: false });
        }

        // Categories store
        if (!db.objectStoreNames.contains('categories')) {
          const categoryStore = db.createObjectStore('categories', { keyPath: '_id' });
          categoryStore.createIndex('userId', 'userId', { unique: false });
          categoryStore.createIndex('type', 'type', { unique: false });
        }

        // Accounts store
        if (!db.objectStoreNames.contains('accounts')) {
          const accountStore = db.createObjectStore('accounts', { keyPath: '_id' });
          accountStore.createIndex('userId', 'userId', { unique: false });
        }

        // Budgets store
        if (!db.objectStoreNames.contains('budgets')) {
          const budgetStore = db.createObjectStore('budgets', { keyPath: '_id' });
          budgetStore.createIndex('userId', 'userId', { unique: false });
          budgetStore.createIndex('categoryId', 'categoryId', { unique: false });
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('entity', 'entity', { unique: false });
        }

        // Metadata store (for last sync timestamps, etc.)
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Generic CRUD operations
  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    const store = this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const store = this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex<T>(storeName: string, indexName: string, value: any): Promise<T[]> {
    const store = this.getStore(storeName);
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put<T>(storeName: string, data: T): Promise<void> {
    const store = this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async putMany<T>(storeName: string, items: T[]): Promise<void> {
    const store = this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const transaction = store.transaction;
      
      items.forEach(item => store.put(item));
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    const store = this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    const store = this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Sync queue operations
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<void> {
    const store = this.getStore('syncQueue', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.add(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    return this.getAll<SyncQueueItem>('syncQueue');
  }

  async removeSyncQueueItem(id: string): Promise<void> {
    return this.delete('syncQueue', id);
  }

  async incrementRetryCount(id: string): Promise<void> {
    const item = await this.get<SyncQueueItem>('syncQueue', id);
    if (item) {
      item.retryCount++;
      await this.put('syncQueue', item);
    }
  }

  // Metadata operations
  async setMetadata(key: string, value: any): Promise<void> {
    return this.put('metadata', { key, value });
  }

  async getMetadata(key: string): Promise<any> {
    const result = await this.get<{ key: string; value: any }>('metadata', key);
    return result?.value;
  }

  // Clear all data (for logout)
  async clearAllData(): Promise<void> {
    await Promise.all([
      this.clear('transactions'),
      this.clear('categories'),
      this.clear('accounts'),
      this.clear('budgets'),
      this.clear('syncQueue'),
      this.clear('metadata'),
    ]);
  }
}

// Singleton instance
export const offlineDB = new OfflineDB();
