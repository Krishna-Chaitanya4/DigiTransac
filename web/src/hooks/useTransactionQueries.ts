import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import {
  getTransactions,
  getTransactionSummary,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  updateStatus,
  getPendingCount,
  batchDelete,
  batchMarkConfirmed,
  batchMarkPending,
  getCounterparties,
} from '../services/transactionService';
import type {
  Transaction,
  TransactionFilter,
  TransactionSummary,
  TransactionListResponse,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  CounterpartyInfo,
} from '../types/transactions';

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
  });
}

// Hook for deleting a transaction with optimistic update
export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.transactions.all });
      
      // Return context for rollback
      return { deletedId: id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
    onError: (_err, _id, context) => {
      // Rollback is handled by refetching
      if (context?.deletedId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      }
    },
  });
}

// Hook for updating transaction status with optimistic update
export function useUpdateStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'Pending' | 'Confirmed' | 'Declined' }) =>
      updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

// Hook for batch delete
export function useBatchDelete() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (ids: string[]) => batchDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });
}

// Hook for batch mark confirmed
export function useBatchMarkConfirmed() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (ids: string[]) => batchMarkConfirmed(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

// Hook for batch mark pending
export function useBatchMarkPending() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (ids: string[]) => batchMarkPending(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
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

// Export types for convenience
export type { Transaction, TransactionFilter, TransactionSummary, TransactionListResponse, CounterpartyInfo };
