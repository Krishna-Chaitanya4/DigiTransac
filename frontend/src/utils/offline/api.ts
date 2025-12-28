import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { offlineDB, Transaction, Category, Account, Budget } from './db';
import { syncManager } from './sync';
import { getApiUrl } from '../../services/config.service';

/**
 * Offline-aware API wrapper
 * Automatically falls back to IndexedDB when offline
 */

export class OfflineAPI {
  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const baseUrl = await getApiUrl();
    const token = localStorage.getItem('token');

    const requestConfig: AxiosRequestConfig = {
      ...config,
      method,
      url: `${baseUrl}${endpoint}`,
      data,
      headers: {
        ...config?.headers,
        Authorization: token ? `Bearer ${token}` : '',
      },
    };

    try {
      const response: AxiosResponse<T> = await axios(requestConfig);
      return response.data;
    } catch (err) {
      // If offline, throw a specific error
      if (!navigator.onLine) {
        throw new Error('OFFLINE');
      }
      throw err;
    }
  }

  // Transactions
  async getTransactions(userId: string): Promise<Transaction[]> {
    try {
      const data = await this.request<{ transactions: Transaction[] }>('GET', '/transactions');

      // Cache in IndexedDB
      await offlineDB.putMany('transactions', data.transactions);

      return data.transactions;
    } catch (err) {
      if ((err as Error).message === 'OFFLINE') {
        // Return from IndexedDB
        return await offlineDB.getByIndex<Transaction>('transactions', 'userId', userId);
      }
      throw err;
    }
  }

  async createTransaction(transaction: Partial<Transaction>): Promise<Transaction> {
    // Generate temporary ID for optimistic UI
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticTransaction = {
      ...transaction,
      _id: tempId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Transaction;

    // Save to IndexedDB immediately
    await offlineDB.put('transactions', optimisticTransaction);

    if (!navigator.onLine) {
      // Queue for sync
      await syncManager.queueCreate('transaction', transaction);
      return optimisticTransaction;
    }

    try {
      const created = await this.request<{ transaction: Transaction }>(
        'POST',
        '/transactions',
        transaction
      );

      // Replace temporary with real ID
      await offlineDB.delete('transactions', tempId);
      await offlineDB.put('transactions', created.transaction);

      return created.transaction;
    } catch {
      // If failed but we have it locally, queue for sync
      await syncManager.queueCreate('transaction', transaction);
      return optimisticTransaction;
    }
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    // Get existing transaction
    const existing = await offlineDB.get<Transaction>('transactions', id);
    if (!existing) {
      throw new Error('Transaction not found');
    }

    // Update optimistically
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await offlineDB.put('transactions', updated);

    if (!navigator.onLine) {
      await syncManager.queueUpdate('transaction', updated);
      return updated;
    }

    try {
      const result = await this.request<{ transaction: Transaction }>(
        'PUT',
        `/transactions/${id}`,
        updates
      );

      await offlineDB.put('transactions', result.transaction);
      return result.transaction;
    } catch {
      await syncManager.queueUpdate('transaction', updated);
      return updated;
    }
  }

  async deleteTransaction(id: string): Promise<void> {
    // Delete optimistically
    await offlineDB.delete('transactions', id);

    if (!navigator.onLine) {
      await syncManager.queueDelete('transaction', id);
      return;
    }

    try {
      await this.request('DELETE', `/transactions/${id}`);
    } catch {
      await syncManager.queueDelete('transaction', id);
    }
  }

  // Categories
  async getCategories(userId: string): Promise<Category[]> {
    try {
      const data = await this.request<{ categories: Category[] }>('GET', '/categories');

      await offlineDB.putMany('categories', data.categories);
      return data.categories;
    } catch (err) {
      if ((err as Error).message === 'OFFLINE') {
        return await offlineDB.getByIndex<Category>('categories', 'userId', userId);
      }
      throw err;
    }
  }

  async createCategory(category: Partial<Category>): Promise<Category> {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimistic = {
      ...category,
      _id: tempId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Category;

    await offlineDB.put('categories', optimistic);

    if (!navigator.onLine) {
      await syncManager.queueCreate('category', category);
      return optimistic;
    }

    try {
      const created = await this.request<{ category: Category }>('POST', '/categories', category);

      await offlineDB.delete('categories', tempId);
      await offlineDB.put('categories', created.category);
      return created.category;
    } catch {
      await syncManager.queueCreate('category', category);
      return optimistic;
    }
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const existing = await offlineDB.get<Category>('categories', id);
    if (!existing) throw new Error('Category not found');

    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await offlineDB.put('categories', updated);

    if (!navigator.onLine) {
      await syncManager.queueUpdate('category', updated);
      return updated;
    }

    try {
      const result = await this.request<{ category: Category }>(
        'PUT',
        `/categories/${id}`,
        updates
      );
      await offlineDB.put('categories', result.category);
      return result.category;
    } catch {
      await syncManager.queueUpdate('category', updated);
      return updated;
    }
  }

  async deleteCategory(id: string): Promise<void> {
    await offlineDB.delete('categories', id);

    if (!navigator.onLine) {
      await syncManager.queueDelete('category', id);
      return;
    }

    try {
      await this.request('DELETE', `/categories/${id}`);
    } catch {
      await syncManager.queueDelete('category', id);
    }
  }

  // Accounts
  async getAccounts(userId: string): Promise<Account[]> {
    try {
      const data = await this.request<{ accounts: Account[] }>('GET', '/accounts');

      await offlineDB.putMany('accounts', data.accounts);
      return data.accounts;
    } catch (err) {
      if ((err as Error).message === 'OFFLINE') {
        return await offlineDB.getByIndex<Account>('accounts', 'userId', userId);
      }
      throw err;
    }
  }

  async createAccount(account: Partial<Account>): Promise<Account> {
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimistic = {
      ...account,
      _id: tempId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Account;

    await offlineDB.put('accounts', optimistic);

    if (!navigator.onLine) {
      await syncManager.queueCreate('account', account);
      return optimistic;
    }

    try {
      const created = await this.request<{ account: Account }>('POST', '/accounts', account);

      await offlineDB.delete('accounts', tempId);
      await offlineDB.put('accounts', created.account);
      return created.account;
    } catch {
      await syncManager.queueCreate('account', account);
      return optimistic;
    }
  }

  async updateAccount(id: string, updates: Partial<Account>): Promise<Account> {
    const existing = await offlineDB.get<Account>('accounts', id);
    if (!existing) throw new Error('Account not found');

    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await offlineDB.put('accounts', updated);

    if (!navigator.onLine) {
      await syncManager.queueUpdate('account', updated);
      return updated;
    }

    try {
      const result = await this.request<{ account: Account }>('PUT', `/accounts/${id}`, updates);
      await offlineDB.put('accounts', result.account);
      return result.account;
    } catch {
      await syncManager.queueUpdate('account', updated);
      return updated;
    }
  }

  async deleteAccount(id: string): Promise<void> {
    await offlineDB.delete('accounts', id);

    if (!navigator.onLine) {
      await syncManager.queueDelete('account', id);
      return;
    }

    try {
      await this.request('DELETE', `/accounts/${id}`);
    } catch {
      await syncManager.queueDelete('account', id);
    }
  }

  // Budgets
  async getBudgets(userId: string): Promise<Budget[]> {
    try {
      const data = await this.request<{ budgets: Budget[] }>('GET', '/budgets');

      await offlineDB.putMany('budgets', data.budgets);
      return data.budgets;
    } catch (err) {
      if ((err as Error).message === 'OFFLINE') {
        return await offlineDB.getByIndex<Budget>('budgets', 'userId', userId);
      }
      throw err;
    }
  }
}

// Singleton instance
export const offlineAPI = new OfflineAPI();
