import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import {
  getTransactions,
  getTransactionSummary,
  getAnalytics,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  updateStatus,
  getPendingCount,
  batchDelete,
  batchMarkConfirmed,
  batchMarkPending,
  getCounterparties,
  getTopCounterparties,
  getSpendingByAccount,
  getSpendingPatterns,
  getSpendingAnomalies,
  getLocationInsights,
  getTripGroups,
} from '../services/transactionService';
import type {
  Transaction,
  TransactionFilter,
  TransactionSummary,
  TransactionListResponse,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  CounterpartyInfo,
  TopCounterpartiesResponse,
  SpendingByAccountResponse,
  SpendingPatternsResponse,
  SpendingAnomaliesResponse,
  LocationInsightsResponse,
  TripGroupsResponse,
} from '../types/transactions';
import type { TransactionAnalytics } from '../services/transactionService';

// Hook for fetching transactions with filters
export function useTransactions(filter: TransactionFilter, enabled = true) {
  return useQuery({
    queryKey: queryKeys.transactions.list(filter),
    queryFn: () => getTransactions(filter),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled,
  });
}

// Infinite query hook for paginated transactions (for infinite scroll)
export function useInfiniteTransactions(
  filter: Omit<TransactionFilter, 'page'>,
  enabled = true
) {
  return useInfiniteQuery({
    queryKey: ['transactions', 'infinite', filter],
    queryFn: ({ pageParam = 1 }) => getTransactions({ ...filter, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => 
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 2 * 60 * 1000,
    enabled,
  });
}

// Hook for fetching transaction summary
export function useTransactionSummary(filter: Omit<TransactionFilter, 'page' | 'pageSize'>) {
  return useQuery({
    queryKey: queryKeys.transactions.summary(filter),
    queryFn: () => getTransactionSummary(filter),
    staleTime: 2 * 60 * 1000,
  });
}

// Hook for fetching pending count
export function usePendingCount() {
  return useQuery({
    queryKey: queryKeys.transactions.pendingCount,
    queryFn: getPendingCount,
    staleTime: 30 * 1000, // 30 seconds - check frequently
    refetchInterval: 30 * 1000, // Poll every 30 seconds
  });
}

// Hook for fetching transaction analytics
export function useTransactionAnalytics(
  startDate?: string,
  endDate?: string,
  accountId?: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['transactions', 'analytics', { startDate, endDate, accountId }],
    queryFn: () => getAnalytics(startDate, endDate, accountId),
    staleTime: 5 * 60 * 1000, // 5 minutes - analytics don't need to be real-time
    enabled,
  });
}

// Hook for fetching counterparties (users the current user has transacted with)
export function useCounterparties() {
  return useQuery({
    queryKey: queryKeys.transactions.counterparties,
    queryFn: getCounterparties,
    staleTime: 5 * 60 * 1000, // 5 minutes - counterparty list changes rarely
  });
}

// Hook for creating a transaction
export function useCreateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateTransactionRequest) => createTransaction(data),
    onSuccess: () => {
      // Invalidate all transaction-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
    meta: {
      successMessage: 'Transaction created successfully',
    },
  });
}

// Hook for updating a transaction
export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTransactionRequest }) =>
      updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
    meta: {
      successMessage: 'Transaction updated successfully',
    },
  });
}

// Hook for deleting a transaction with optimistic update
export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      // Only cancel list queries, not summary/pendingCount/counterparties
      await queryClient.cancelQueries({ queryKey: ['transactions', 'list'] });
      
      // Snapshot only the transaction list queries for rollback (not summary, pendingCount, etc.)
      const previousTransactions = queryClient.getQueriesData<TransactionListResponse>({
        queryKey: ['transactions', 'list']
      });
      
      // Optimistically remove the transaction from list caches only
      queryClient.setQueriesData<TransactionListResponse>(
        { queryKey: ['transactions', 'list'] },
        (old) => {
          // Double-check that old has the expected structure
          if (!old || !Array.isArray(old.transactions)) return old;
          return {
            ...old,
            transactions: old.transactions.filter(t => t.id !== id),
            totalCount: Math.max(0, old.totalCount - 1),
          };
        }
      );
      
      // Return context with snapshot for rollback
      return { previousTransactions };
    },
    onError: (_err, _id, context) => {
      // Rollback to previous state on error
      if (context?.previousTransactions) {
        context.previousTransactions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
    meta: {
      successMessage: 'Transaction deleted',
    },
  });
}

// Hook for updating transaction status with optimistic update
export function useUpdateStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'Pending' | 'Confirmed' | 'Declined' }) =>
      updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      // Cancel only list queries
      await queryClient.cancelQueries({ queryKey: ['transactions', 'list'] });
      
      // Snapshot for rollback
      const previousTransactions = queryClient.getQueriesData<TransactionListResponse>({
        queryKey: ['transactions', 'list']
      });
      
      // Optimistically update the status in list queries only
      queryClient.setQueriesData<TransactionListResponse>(
        { queryKey: ['transactions', 'list'] },
        (old) => {
          if (!old || !Array.isArray(old.transactions)) return old;
          return {
            ...old,
            transactions: old.transactions.map(t =>
              t.id === id ? { ...t, status } : t
            ),
          };
        }
      );
      
      return { previousTransactions };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousTransactions) {
        context.previousTransactions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
    meta: {
      successMessage: 'Status updated',
    },
  });
}

// Hook for batch delete
export function useBatchDelete() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (ids: string[]) => batchDelete(ids),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['transactions', 'list'] });
      
      const previousTransactions = queryClient.getQueriesData<TransactionListResponse>({
        queryKey: ['transactions', 'list']
      });
      
      // Optimistically remove all deleted transactions from list queries only
      queryClient.setQueriesData<TransactionListResponse>(
        { queryKey: ['transactions', 'list'] },
        (old) => {
          if (!old || !Array.isArray(old.transactions)) return old;
          return {
            ...old,
            transactions: old.transactions.filter(t => !ids.includes(t.id)),
            totalCount: Math.max(0, old.totalCount - ids.length),
          };
        }
      );
      
      return { previousTransactions };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousTransactions) {
        context.previousTransactions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
    meta: {
      successMessage: 'Transactions deleted',
    },
  });
}

// Hook for batch mark confirmed
export function useBatchMarkConfirmed() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (ids: string[]) => batchMarkConfirmed(ids),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['transactions', 'list'] });
      
      const previousTransactions = queryClient.getQueriesData<TransactionListResponse>({
        queryKey: ['transactions', 'list']
      });
      
      // Optimistically update status in list queries only
      queryClient.setQueriesData<TransactionListResponse>(
        { queryKey: ['transactions', 'list'] },
        (old) => {
          if (!old || !Array.isArray(old.transactions)) return old;
          return {
            ...old,
            transactions: old.transactions.map(t =>
              ids.includes(t.id) ? { ...t, status: 'Confirmed' as const } : t
            ),
          };
        }
      );
      
      return { previousTransactions };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousTransactions) {
        context.previousTransactions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
    meta: {
      successMessage: 'Transactions marked as confirmed',
    },
  });
}

// Hook for batch mark pending
export function useBatchMarkPending() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (ids: string[]) => batchMarkPending(ids),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['transactions', 'list'] });
      
      const previousTransactions = queryClient.getQueriesData<TransactionListResponse>({
        queryKey: ['transactions', 'list']
      });
      
      // Optimistically update status in list queries only
      queryClient.setQueriesData<TransactionListResponse>(
        { queryKey: ['transactions', 'list'] },
        (old) => {
          if (!old || !Array.isArray(old.transactions)) return old;
          return {
            ...old,
            transactions: old.transactions.map(t =>
              ids.includes(t.id) ? { ...t, status: 'Pending' as const } : t
            ),
          };
        }
      );
      
      return { previousTransactions };
    },
    onError: (_err, _ids, context) => {
      if (context?.previousTransactions) {
        context.previousTransactions.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
    meta: {
      successMessage: 'Transactions marked as pending',
    },
  });
}

// Utility to prefetch transactions for a filter
export function usePrefetchTransactions() {
  const queryClient = useQueryClient();
  
  return (filter: TransactionFilter) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.transactions.list(filter),
      queryFn: () => getTransactions(filter),
      staleTime: 2 * 60 * 1000,
    });
  };
}

// Hook to get invalidation function (for manual cache invalidation)
export function useInvalidateTransactions() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
  };
}

// ============ Extended Analytics Hooks ============

// Hook for fetching top counterparties (payees) with spending breakdown
export function useTopCounterparties(
  startDate?: string,
  endDate?: string,
  pageSize = 10,
  page = 1,
  enabled = true
) {
  return useQuery({
    queryKey: ['transactions', 'analytics', 'counterparties', { startDate, endDate, page, pageSize }],
    queryFn: () => getTopCounterparties(startDate, endDate, pageSize, page),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  });
}

// Hook for fetching spending breakdown by account
export function useSpendingByAccount(
  startDate?: string,
  endDate?: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['transactions', 'analytics', 'byAccount', { startDate, endDate }],
    queryFn: () => getSpendingByAccount(startDate, endDate),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  });
}

// Hook for fetching spending patterns (by day of week and hour of day)
export function useSpendingPatterns(
  startDate?: string,
  endDate?: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['transactions', 'analytics', 'patterns', { startDate, endDate }],
    queryFn: () => getSpendingPatterns(startDate, endDate),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  });
}

// Hook for fetching spending anomalies and alerts
export function useSpendingAnomalies(
  startDate?: string,
  endDate?: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['transactions', 'analytics', 'anomalies', { startDate, endDate }],
    queryFn: () => getSpendingAnomalies(startDate, endDate),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  });
}

// Hook for fetching location-based spending insights
export function useLocationInsights(
  startDate?: string,
  endDate?: string,
  latitude?: number,
  longitude?: number,
  radiusKm?: number,
  enabled = true
) {
  return useQuery({
    queryKey: ['transactions', 'analytics', 'locations', { startDate, endDate, latitude, longitude, radiusKm }],
    queryFn: () => getLocationInsights(startDate, endDate, latitude, longitude, radiusKm),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  });
}

// Hook for fetching trip groups (travel spending analysis)
export function useTripGroups(
  startDate?: string,
  endDate?: string,
  homeLatitude?: number,
  homeLongitude?: number,
  minTripDistanceKm?: number,
  enabled = true
) {
  return useQuery({
    queryKey: ['transactions', 'analytics', 'trips', { startDate, endDate, homeLatitude, homeLongitude, minTripDistanceKm }],
    queryFn: () => getTripGroups(startDate, endDate, homeLatitude, homeLongitude, minTripDistanceKm),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled,
  });
}

// Export types for convenience
export type {
  Transaction,
  TransactionFilter,
  TransactionSummary,
  TransactionListResponse,
  CounterpartyInfo,
  TransactionAnalytics,
  TopCounterpartiesResponse,
  SpendingByAccountResponse,
  SpendingPatternsResponse,
  SpendingAnomaliesResponse,
  LocationInsightsResponse,
  TripGroupsResponse,
};
