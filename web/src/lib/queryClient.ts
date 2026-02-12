import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query';
import { toast } from '../components/ToastProvider';
import { logger } from '../services/logger';

// Type for API errors with response data
interface ApiError extends Error {
  response?: {
    data?: {
      message?: string;
    };
  };
}

/**
 * Extract a user-friendly error message from various error types
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Handle API errors with response data
    const apiError = error as ApiError;
    if (apiError.response?.data?.message && typeof apiError.response.data.message === 'string') {
      return apiError.response.data.message;
    }
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

/**
 * Check if an error is a client-side error (4xx) that shouldn't be retried
 */
function isClientError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('401') || message.includes('unauthorized')) return true;
    if (message.includes('403') || message.includes('forbidden')) return true;
    if (message.includes('404') || message.includes('not found')) return true;
    if (message.includes('400') || message.includes('bad request')) return true;
    if (message.includes('422') || message.includes('validation')) return true;
    if (message.includes('429') || message.includes('too many requests')) return true;
  }
  return false;
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Log the error for debugging
      logger.error('Query error:', {
        queryKey: query.queryKey,
        error: getErrorMessage(error)
      });
      
      // Only show error toast for queries that explicitly want it
      // Most queries handle their own error states in the UI
      if (query.meta?.showErrorToast === true) {
        toast.error(getErrorMessage(error));
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Log the error
      logger.error('Mutation error:', {
        mutationKey: mutation.options.mutationKey,
        error: getErrorMessage(error)
      });
      
      // Skip if mutation has its own onError handler defined
      if (mutation.options.onError) return;
      
      // Skip if mutation explicitly disables error toast
      if (mutation.options.meta?.skipErrorToast === true) return;
      
      // Show error toast for unhandled mutation errors
      toast.error(getErrorMessage(error));
    },
    onSuccess: (_data, _variables, _context, mutation) => {
      // Skip if mutation has its own onSuccess handler with toast
      if (mutation.options.meta?.skipSuccessToast === true) return;
      
      // Show success toast if message is provided in meta
      const successMessage = mutation.options.meta?.successMessage;
      if (typeof successMessage === 'string') {
        toast.success(successMessage);
      }
    },
  }),
  defaultOptions: {
    queries: {
      // Cache data for 2 minutes by default
      staleTime: 2 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Smart retry logic based on error type
      retry: (failureCount, error) => {
        // Don't retry on client errors (4xx including 429)
        if (isClientError(error)) return false;
        // Retry up to 2 times for server errors
        return failureCount < 2;
      },
      // Exponential backoff for retries (1s, 2s, 4s...)
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000),
      // Don't refetch on window focus for most queries
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Don't retry mutations by default (user should retry manually)
      retry: false,
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
    counterparties: ['transactions', 'counterparties'] as const,
    analytics: ['transactions', 'analytics'] as const,
  },
  // Accounts
  accounts: {
    all: ['accounts'] as const,
    list: (includeArchived = false) => ['accounts', 'list', { includeArchived }] as const,
    detail: (id: string) => ['accounts', 'detail', id] as const,
    summary: ['accounts', 'summary'] as const,
  },
  // Labels
  labels: {
    all: ['labels'] as const,
    list: () => ['labels', 'list'] as const,
    tree: () => ['labels', 'tree'] as const,
    transactionCount: (id: string) => ['labels', 'transactionCount', id] as const,
  },
  // Tags
  tags: {
    all: ['tags'] as const,
    list: () => ['tags', 'list'] as const,
    transactionCount: (id: string) => ['tags', 'transactionCount', id] as const,
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
  // Budgets
  budgets: {
    all: ['budgets'] as const,
    summary: (activeOnly = true) => ['budgets', 'summary', { activeOnly }] as const,
    detail: (id: string) => ['budgets', 'detail', id] as const,
    breakdown: (id: string) => ['budgets', 'breakdown', id] as const,
    notifications: (unreadOnly = false) => ['budgets', 'notifications', { unreadOnly }] as const,
  },
  // Conversations (chats)
  conversations: {
    all: ['conversations'] as const,
  },
};

/**
 * Invalidate all queries that depend on the user's primary currency.
 * Call this when the primary currency is changed in Settings.
 *
 * Uses refetchType: 'all' to force immediate refetch of any active queries,
 * and also refetches inactive queries when they become active again.
 */
export function invalidateCurrencyDependentQueries() {
  // These queries return data with amounts converted to user's primary currency
  // Use refetchType: 'all' to force immediate refetch of active queries
  const invalidateOptions = { refetchType: 'all' as const };
  
  // Accounts - balances may be displayed in primary currency
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all, ...invalidateOptions });
  
  // Transactions - analytics and summary show currency-converted totals
  queryClient.invalidateQueries({ queryKey: queryKeys.transactions.analytics, ...invalidateOptions });
  // Invalidate all transaction summaries regardless of filter params
  queryClient.invalidateQueries({
    queryKey: ['transactions', 'summary'],
    ...invalidateOptions
  });
  
  // Budgets - summary totals are converted to primary currency
  queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all, ...invalidateOptions });
  
  // Conversations/Chats - message totals may show converted amounts
  queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all, ...invalidateOptions });
}
