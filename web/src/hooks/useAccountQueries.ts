import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import {
  getAccounts,
  getAccountSummary,
  createAccount,
  updateAccount,
  deleteAccount,
  adjustBalance,
  setDefaultAccount,
} from '../services/accountService';
import type { Account, AccountSummary, CreateAccountRequest, UpdateAccountRequest, AdjustBalanceRequest } from '../services/accountService';

// Hook for fetching all accounts
export function useAccounts(includeArchived = false): UseQueryResult<Account[], Error> {
  return useQuery({
    queryKey: queryKeys.accounts.list(includeArchived),
    queryFn: () => getAccounts(includeArchived),
    staleTime: 5 * 60 * 1000, // 5 minutes - accounts don't change often
  });
}

// Hook for fetching account summary
export function useAccountSummary(): UseQueryResult<AccountSummary, Error> {
  return useQuery({
    queryKey: queryKeys.accounts.summary,
    queryFn: getAccountSummary,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Hook for creating an account
export function useCreateAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateAccountRequest) => createAccount(data),
    onSuccess: () => {
      // Invalidate to refetch with server data (optimistic updates for accounts
      // are complex due to many required fields)
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });
}

// Hook for updating an account
export function useUpdateAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAccountRequest }) => 
      updateAccount(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.accounts.list(false) });
      await queryClient.cancelQueries({ queryKey: queryKeys.accounts.list(true) });
      
      const previousAccounts = queryClient.getQueryData<Account[]>(queryKeys.accounts.list(false));
      const previousArchivedAccounts = queryClient.getQueryData<Account[]>(queryKeys.accounts.list(true));
      
      // Update in the appropriate list
      const updateList = (accounts: Account[] | undefined) => 
        accounts?.map(account =>
          account.id === id ? { ...account, ...data, updatedAt: new Date().toISOString() } : account
        );
      
      if (previousAccounts) {
        queryClient.setQueryData<Account[]>(queryKeys.accounts.list(false), updateList(previousAccounts)!);
      }
      if (previousArchivedAccounts) {
        queryClient.setQueryData<Account[]>(queryKeys.accounts.list(true), updateList(previousArchivedAccounts)!);
      }
      
      return { previousAccounts, previousArchivedAccounts };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(queryKeys.accounts.list(false), context.previousAccounts);
      }
      if (context?.previousArchivedAccounts) {
        queryClient.setQueryData(queryKeys.accounts.list(true), context.previousArchivedAccounts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });
}

// Hook for deleting an account
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.accounts.list(false) });
      await queryClient.cancelQueries({ queryKey: queryKeys.accounts.list(true) });
      
      const previousAccounts = queryClient.getQueryData<Account[]>(queryKeys.accounts.list(false));
      const previousArchivedAccounts = queryClient.getQueryData<Account[]>(queryKeys.accounts.list(true));
      
      if (previousAccounts) {
        queryClient.setQueryData<Account[]>(
          queryKeys.accounts.list(false),
          previousAccounts.filter(account => account.id !== deletedId)
        );
      }
      if (previousArchivedAccounts) {
        queryClient.setQueryData<Account[]>(
          queryKeys.accounts.list(true),
          previousArchivedAccounts.filter(account => account.id !== deletedId)
        );
      }
      
      return { previousAccounts, previousArchivedAccounts };
    },
    onError: (_err, _id, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(queryKeys.accounts.list(false), context.previousAccounts);
      }
      if (context?.previousArchivedAccounts) {
        queryClient.setQueryData(queryKeys.accounts.list(true), context.previousArchivedAccounts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      // Also invalidate transactions since they reference accounts
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all, refetchType: 'all' });
    },
  });
}

// Hook for adjusting account balance
export function useAdjustBalance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdjustBalanceRequest }) =>
      adjustBalance(id, data),
    onSuccess: async () => {
      // Await invalidation to ensure fresh data is fetched before UI updates
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all, refetchType: 'all' }),
        // Balance adjustment creates a transaction visible in self-chat
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all }),
      ]);
    },
  });
}

// Hook for setting default account
export function useSetDefaultAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => setDefaultAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });
}

// Hook to invalidate all account queries
export function useInvalidateAccounts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
}

// Hook to prefetch accounts (e.g., on hover)
export function usePrefetchAccounts() {
  const queryClient = useQueryClient();
  
  return (includeArchived = false) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.accounts.list(includeArchived),
      queryFn: () => getAccounts(includeArchived),
      staleTime: 5 * 60 * 1000,
    });
  };
}

export type { Account, AccountSummary };
