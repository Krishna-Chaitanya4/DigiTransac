import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import {
  getBudgets,
  getBudget,
  getBudgetBreakdown,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/budgetService';
import type {
  Budget,
  BudgetSummary,
  BudgetSpendingBreakdown,
  BudgetNotificationList,
  CreateBudgetRequest,
  UpdateBudgetRequest,
} from '../types/budgets';

// Hook for fetching all budgets with summary
export function useBudgets(activeOnly = true): UseQueryResult<BudgetSummary, Error> {
  return useQuery({
    queryKey: queryKeys.budgets.summary(activeOnly),
    queryFn: () => getBudgets(activeOnly),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Hook for fetching a single budget
export function useBudget(id: string | null): UseQueryResult<Budget, Error> {
  return useQuery({
    queryKey: queryKeys.budgets.detail(id ?? ''),
    queryFn: () => getBudget(id!),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
}

// Hook for fetching budget spending breakdown
export function useBudgetBreakdown(id: string | null): UseQueryResult<BudgetSpendingBreakdown, Error> {
  return useQuery({
    queryKey: queryKeys.budgets.breakdown(id ?? ''),
    queryFn: () => getBudgetBreakdown(id!),
    enabled: !!id,
    staleTime: 1 * 60 * 1000, // 1 minute - spending changes frequently
  });
}

// Hook for fetching budget notifications
export function useBudgetNotifications(unreadOnly = false): UseQueryResult<BudgetNotificationList, Error> {
  return useQuery({
    queryKey: queryKeys.budgets.notifications(unreadOnly),
    queryFn: () => getBudgetNotifications(unreadOnly),
    staleTime: 30 * 1000, // 30 seconds - notifications need to be fresh
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

// Hook for creating a budget
export function useCreateBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateBudgetRequest) => createBudget(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
    meta: {
      successMessage: 'Budget created successfully',
    },
  });
}

// Hook for updating a budget
export function useUpdateBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBudgetRequest }) =>
      updateBudget(id, data),
    onSuccess: (_updatedBudget, { id }) => {
      // Invalidate the specific budget and all budget queries
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
    meta: {
      successMessage: 'Budget updated successfully',
    },
  });
}

// Hook for deleting a budget
export function useDeleteBudget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.budgets.all });
      
      const previousSummary = queryClient.getQueryData<BudgetSummary>(queryKeys.budgets.summary(true));
      
      if (previousSummary) {
        queryClient.setQueryData<BudgetSummary>(queryKeys.budgets.summary(true), {
          ...previousSummary,
          totalBudgets: previousSummary.totalBudgets - 1,
          budgets: previousSummary.budgets.filter(b => b.id !== deletedId),
        });
      }
      
      return { previousSummary };
    },
    onError: (_err, _id, context) => {
      if (context?.previousSummary) {
        queryClient.setQueryData(queryKeys.budgets.summary(true), context.previousSummary);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
    },
    meta: {
      successMessage: 'Budget deleted successfully',
    },
  });
}

// Hook for marking a notification as read
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.notifications() });
    },
  });
}

// Hook for marking all notifications as read
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.notifications() });
    },
  });
}

// Hook to invalidate all budget queries
export function useInvalidateBudgets() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
}

// Re-export types
export type { Budget, BudgetSummary, BudgetSpendingBreakdown, BudgetNotificationList };