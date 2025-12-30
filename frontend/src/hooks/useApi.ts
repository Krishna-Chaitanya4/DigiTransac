import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { api } from '../services/api';
import { queryKeys } from '../utils/queryClient';
import { useToast } from '../components/Toast';
import type {
  Transaction,
  Category,
  Account,
  Budget,
  Tag,
  User,
} from '../types/api.types';

// Re-export types for convenience
export type { Transaction, Category, Account, Budget, Tag, User } from '../types/api.types';

/**
 * Centralized React Query hooks for data fetching
 * ✅ Eliminates duplicate useState, useEffect, error handling
 * ✅ Consistent patterns across all API calls
 * ✅ Automatic cache invalidation
 * ✅ Type-safe with centralized types
 */

/**
 * Transactions
 */
export const useTransactions = (filters?: any, options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () => api.get('/api/transactions', filters),
    ...options,
  });
};

export const useTransaction = (id: string, options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.transaction(id),
    queryFn: () => api.get(`/api/transactions/${id}`),
    enabled: !!id,
    ...options,
  });
};

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (data: Partial<Transaction>) => api.post('/api/transactions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      showToast('Transaction created successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to create transaction', 'error');
    },
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Transaction> }) => 
      api.put(`/api/transactions/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transaction(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      showToast('Transaction updated successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to update transaction', 'error');
    },
  });
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      showToast('Transaction deleted successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to delete transaction', 'error');
    },
  });
};

/**
 * Categories
 */
export const useCategories = (options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => api.get('/api/categories'),
    ...options,
  });
};

export const useCategoryStats = (options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: [...queryKeys.categories, 'stats'],
    queryFn: () => api.get('/api/categories/stats'),
    ...options,
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (data: Partial<Category>) => api.post('/api/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      showToast('Category created successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to create category', 'error');
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Category> }) => 
      api.put(`/api/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      showToast('Category updated successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to update category', 'error');
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      showToast('Category deleted successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to delete category', 'error');
    },
  });
};

/**
 * Accounts
 */
export const useAccounts = (options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => api.get('/api/accounts'),
    ...options,
  });
};

export const useAccountBalance = (id: string, options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: [...queryKeys.accounts, id, 'balance'],
    queryFn: () => api.get(`/api/accounts/${id}/balance`),
    enabled: !!id,
    ...options,
  });
};

export const useCreateAccount = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (data: Partial<Account>) => api.post('/api/accounts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      showToast('Account created successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to create account', 'error');
    },
  });
};

export const useUpdateAccount = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Account> }) => 
      api.put(`/api/accounts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      showToast('Account updated successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to update account', 'error');
    },
  });
};

export const useDeleteBankAccount = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      showToast('Account deleted successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to delete account', 'error');
    },
  });
};

/**
 * Budgets
 */
export const useBudgets = (filters?: any, options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.budgets(filters),
    queryFn: () => api.get('/api/budgets', filters),
    ...options,
  });
};

export const useCreateBudget = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (data: Partial<Budget>) => api.post('/api/budgets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      showToast('Budget created successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to create budget', 'error');
    },
  });
};

export const useUpdateBudget = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Budget> }) => 
      api.put(`/api/budgets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      showToast('Budget updated successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to update budget', 'error');
    },
  });
};

export const useDeleteBudget = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/budgets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      showToast('Budget deleted successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to delete budget', 'error');
    },
  });
};

export const useUpdateBudgetThreshold = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ budgetId, threshold }: { budgetId: string; threshold: number }) => 
      api.post(`/api/budgets/${budgetId}/threshold`, { threshold }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets() });
      showToast('Budget threshold updated successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to update budget threshold', 'error');
    },
  });
};

/**
 * Tags
 */
export const useTags = (options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.tags,
    queryFn: () => api.get('/api/tags'),
    ...options,
  });
};

export const useCreateTag = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (data: Partial<Tag>) => api.post('/api/tags', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
      showToast('Tag created successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to create tag', 'error');
    },
  });
};

export const useUpdateTag = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tag> }) => 
      api.put(`/api/tags/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
      showToast('Tag updated successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to update tag', 'error');
    },
  });
};

export const useDeleteTag = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
      showToast('Tag deleted successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to delete tag', 'error');
    },
  });
};

/**
 * Dashboard
 */
export const useDashboard = (options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => api.get('/api/analytics/dashboard'),
    ...options,
  });
};

/**
 * User & Profile
 */
export const useUserProfile = (options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: () => api.get(`${import.meta.env.VITE_API_BASE_URL}/api/users/profile`),
    ...options,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (data: Partial<User>) => 
      api.post(`${import.meta.env.VITE_API_BASE_URL}/api/users/profile`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      showToast('Profile updated successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to update profile', 'error');
    },
  });
};

export const useUpdatePassword = () => {
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => 
      api.patch(`${import.meta.env.VITE_API_BASE_URL}/api/users/profile/password`, data),
    onSuccess: () => {
      showToast('Password updated successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to update password', 'error');
    },
  });
};

export const useDeleteAccount = () => {
  const { showToast } = useToast();

  return useMutation({
    mutationFn: () => 
      api.delete(`${import.meta.env.VITE_API_BASE_URL}/api/users/profile`),
    onSuccess: () => {
      showToast('Account deleted successfully', 'success');
      // Redirect handled in component
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to delete account', 'error');
    },
  });
};

/**
 * Gmail Integration
 */
export const useGmailConnect = (options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: ['gmail', 'connect'],
    queryFn: () => api.get(`${import.meta.env.VITE_API_BASE_URL}/api/gmail/connect`),
    enabled: false, // Only fetch when explicitly called
    ...options,
  });
};

export const useTestGmailConnection = () => {
  const { showToast } = useToast();

  return useMutation({
    mutationFn: () => 
      api.post(`${import.meta.env.VITE_API_BASE_URL}/api/gmail/test`),
    onSuccess: () => {
      showToast('Gmail connection test successful', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Gmail connection test failed', 'error');
    },
  });
};

export const useDisconnectGmail = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: () => 
      api.post(`${import.meta.env.VITE_API_BASE_URL}/api/gmail/disconnect`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      showToast('Gmail disconnected successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to disconnect Gmail', 'error');
    },
  });
};

/**
 * Transfer
 */
export const useTransferFunds = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (data: { fromAccountId: string; toAccountId: string; amount: number; description?: string; date?: string }) => 
      api.post('/api/transactions/transfer', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      showToast('Transfer completed successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Transfer failed', 'error');
    },
  });
};

/**
 * Tag Usage
 */
export const useTagUsage = (tagId: string, options?: UseQueryOptions<any>) => {
  return useQuery({
    queryKey: [...queryKeys.tags, tagId, 'usage'],
    queryFn: () => api.get(`/api/tags/${tagId}/usage`),
    enabled: !!tagId,
    ...options,
  });
};

/**
 * Bulk Operations
 */
export const useBulkUpdateTransactions = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ transactionIds, updates }: { transactionIds: string[]; updates: any }) => 
      api.post('/api/transactions/bulk-update', { transactionIds, updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      showToast('Transactions updated successfully', 'success');
    },
    onError: (error: Error) => {
      showToast(error.message || 'Failed to update transactions', 'error');
    },
  });
};
