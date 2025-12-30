import { QueryClient } from '@tanstack/react-query';

/**
 * React Query configuration
 * Centralizes caching, refetching, and error handling strategies
 */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,

      // Cache time: Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,

      // Retry failed requests 1 time
      retry: 1,

      // Refetch on window focus for real-time data
      refetchOnWindowFocus: true,

      // Refetch on reconnect
      refetchOnReconnect: true,

      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
    },
    mutations: {
      // Retry failed mutations 1 time
      retry: 1,
    },
  },
});

/**
 * Query keys for consistent cache management
 */
export const queryKeys = {
  // Auth
  user: ['user'] as const,

  // Transactions
  transactions: (filters?: any) => ['transactions', filters] as const,
  transaction: (id: string) => ['transaction', id] as const,
  pendingTransactions: ['transactions', 'pending'] as const,

  // Categories
  categories: ['categories'] as const,
  category: (id: string) => ['category', id] as const,

  // Accounts
  accounts: ['accounts'] as const,
  account: (id: string) => ['account', id] as const,
  accountBalance: (id: string) => ['account', id, 'balance'] as const,

  // Budgets
  budgets: (filters?: any) => ['budgets', filters] as const,
  budget: (id: string) => ['budget', id] as const,
  budgetAlerts: ['budgets', 'alerts'] as const,

  // Tags
  tags: ['tags'] as const,
  tag: (id: string) => ['tag', id] as const,

  // Analytics
  analytics: (filters?: any) => ['analytics', filters] as const,
  dashboard: ['dashboard'] as const,

  // Configuration
  config: ['config'] as const,
};
