import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { api } from '../services/api';
import { queryKeys } from '../utils/queryClient';
import { useToast } from '../components/Toast';

/**
 * Custom hooks for data fetching
 * Eliminates duplicate useState, useEffect, and error handling patterns
 */

// Types
export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
  accountId: string;
  categoryId?: string;
  merchant?: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  tags?: string[];
  splits?: any[];
  [key: string]: any;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  isFolder: boolean;
  icon?: string;
  color?: string;
  path: string[];
  [key: string]: any;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  isDefault: boolean;
  [key: string]: any;
}

export interface Budget {
  id: string;
  name: string;
  amount: number;
  period: string;
  categoryIds: string[];
  [key: string]: any;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  [key: string]: any;
}

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

export const useDeleteAccount = () => {
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
