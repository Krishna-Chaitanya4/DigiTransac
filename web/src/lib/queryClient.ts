import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query';
import { toast } from '../components/ToastProvider';
import { logger } from '../services/logger';

/**
 * Extract a user-friendly error message from various error types
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Handle API errors with response data
    if ('response' in error && typeof (error as any).response?.data?.message === 'string') {
      return (error as any).response.data.message;
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
        // Don't retry on client errors (4xx)
        if (isClientError(error)) return false;
        // Retry up to 2 times for server errors
        return failureCount < 2;
      },
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
};
