import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes by default
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests 1 time
      retry: 1,
      // Don't refetch on window focus for most queries
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

// Query keys for consistent cache management
export const queryKeys = {
  // Transactions
  transactions: {
    all: ['transactions'] as const,
    list: (filters: object) => ['transactions', 'list', filters] as const,
    detail: (id: string) => ['transactions', 'detail', id] as const,
    summary: (filters: object) => ['transactions', 'summary', filters] as const,
    pendingCount: ['transactions', 'pendingCount'] as const,
  },
  // Accounts
  accounts: {
    all: ['accounts'] as const,
    list: () => ['accounts', 'list'] as const,
    detail: (id: string) => ['accounts', 'detail', id] as const,
    summary: ['accounts', 'summary'] as const,
  },
  // Labels
  labels: {
    all: ['labels'] as const,
    list: () => ['labels', 'list'] as const,
  },
  // Tags
  tags: {
    all: ['tags'] as const,
    list: () => ['tags', 'list'] as const,
  },
  // Exchange rates
  exchangeRates: {
    all: ['exchangeRates'] as const,
    current: ['exchangeRates', 'current'] as const,
  },
  // User
  user: {
    profile: ['user', 'profile'] as const,
    settings: ['user', 'settings'] as const,
  },
};
