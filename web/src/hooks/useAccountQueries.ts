import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import {
  getAccounts,
  getAccountSummary,
  createAccount,
  updateAccount,
  deleteAccount,
} from '../services/accountService';
import type { Account, AccountSummary, CreateAccountRequest, UpdateAccountRequest } from '../services/accountService';

// Hook for fetching all accounts
export function useAccounts(): UseQueryResult<Account[], Error> {
  return useQuery({
    queryKey: queryKeys.accounts.list(),
    queryFn: () => getAccounts(),
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

export type { Account, AccountSummary };
