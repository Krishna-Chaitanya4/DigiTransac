import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOnlineStatus, useOfflineQueue, OfflineAction } from './useOffline';

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(),
};

const mockIDBDatabase = {
  transaction: vi.fn(),
  objectStoreNames: { contains: vi.fn(() => true) },
  createObjectStore: vi.fn(),
};

const mockIDBTransaction = {
  objectStore: vi.fn(),
  oncomplete: null as (() => void) | null,
  onerror: null as (() => void) | null,
};

const mockIDBObjectStore = {
  clear: vi.fn(),
  add: vi.fn(),
  getAll: vi.fn(),
};

describe('useOnlineStatus', () => {
  let originalNavigator: boolean;

  beforeEach(() => {
    originalNavigator = navigator.onLine;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('should return true when online', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it('should return false when offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it('should update when online status changes', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    // Simulate going offline
    await act(async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('offline'));
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });

    // Simulate coming back online
    await act(async () => {
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });
});

describe('useOfflineQueue', () => {
  let originalIndexedDB: IDBFactory;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalIndexedDB = window.indexedDB;
    originalFetch = global.fetch;

    // Mock IndexedDB
    const mockRequest = {
      result: mockIDBDatabase,
      error: null,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onupgradeneeded: null as ((event: { target: { result: typeof mockIDBDatabase } }) => void) | null,
    };

    mockIndexedDB.open.mockImplementation(() => {
      setTimeout(() => {
        if (mockRequest.onsuccess) mockRequest.onsuccess();
      }, 0);
      return mockRequest;
    });

    Object.defineProperty(window, 'indexedDB', {
      value: mockIndexedDB,
      writable: true,
      configurable: true,
    });

    mockIDBDatabase.transaction.mockReturnValue(mockIDBTransaction);
    mockIDBTransaction.objectStore.mockReturnValue(mockIDBObjectStore);

    const mockGetAllRequest = {
      result: [] as OfflineAction[],
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };

    mockIDBObjectStore.getAll.mockImplementation(() => {
      setTimeout(() => {
        if (mockGetAllRequest.onsuccess) mockGetAllRequest.onsuccess();
      }, 0);
      return mockGetAllRequest;
    });

    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(window, 'indexedDB', {
      value: originalIndexedDB,
      writable: true,
      configurable: true,
    });
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('should initialize with empty queue', async () => {
    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.queue).toEqual([]);
    });
  });

  it('should not be syncing initially', async () => {
    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(result.current.isSyncing).toBe(false);
    });
  });

  it('should provide addToQueue function', async () => {
    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(typeof result.current.addToQueue).toBe('function');
    });
  });

  it('should provide syncQueue function', async () => {
    const { result } = renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(typeof result.current.syncQueue).toBe('function');
    });
  });
});
