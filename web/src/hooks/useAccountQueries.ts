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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
    },
  });
}

// Hook for deleting an account
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      // Also invalidate transactions since they reference accounts
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

// Hook for adjusting account balance
export function useAdjustBalance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdjustBalanceRequest }) => 
      adjustBalance(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
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

export type { Account, AccountSummary };
