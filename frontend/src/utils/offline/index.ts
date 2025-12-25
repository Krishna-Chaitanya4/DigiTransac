/**
 * Offline support module
 * Provides IndexedDB storage, background sync, and offline-first API
 */

export { offlineDB, OfflineDB } from './db';
export { syncManager, SyncManager } from './sync';
export { offlineAPI, OfflineAPI } from './api';
export type { Transaction, Category, Account, Budget, SyncQueueItem } from './db';
