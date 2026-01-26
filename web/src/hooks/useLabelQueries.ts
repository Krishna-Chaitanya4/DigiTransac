import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { getLabels, getLabelsTree, createLabel, updateLabel, deleteLabel, deleteLabelWithReassignment, getLabelTransactionCount } from '../services/labelService';
import type { Label, LabelTree, CreateLabelRequest, UpdateLabelRequest } from '../types/labels';

// Hook for fetching all labels (flat list)
export function useLabels(): UseQueryResult<Label[], Error> {
  return useQuery({
    queryKey: queryKeys.labels.list(),
    queryFn: getLabels,
    staleTime: 10 * 60 * 1000, // 10 minutes - labels rarely change
  });
}

// Hook for fetching labels as tree structure
export function useLabelsTree(): UseQueryResult<LabelTree[], Error> {
  return useQuery({
    queryKey: queryKeys.labels.tree(),
    queryFn: getLabelsTree,
    staleTime: 10 * 60 * 1000,
  });
}

// Hook for creating a label
export function useCreateLabel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateLabelRequest) => createLabel(data),
    onMutate: async (newLabel) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.labels.list() });
      
      // Snapshot previous value
      const previousLabels = queryClient.getQueryData<Label[]>(queryKeys.labels.list());
      
      // Optimistically add the new label with a temp ID
      if (previousLabels) {
        const optimisticLabel: Label = {
          id: `temp-${Date.now()}`,
          name: newLabel.name,
          type: newLabel.type,
          parentId: newLabel.parentId ?? null,
          color: newLabel.color ?? null,
          icon: newLabel.icon ?? null,
          order: previousLabels.length,
          isSystem: false,
          createdAt: new Date().toISOString(),
        };
        queryClient.setQueryData<Label[]>(queryKeys.labels.list(), [...previousLabels, optimisticLabel]);
      }
      
      return { previousLabels };
    },
    onError: (_err, _newLabel, context) => {
      // Rollback on error
      if (context?.previousLabels) {
        queryClient.setQueryData(queryKeys.labels.list(), context.previousLabels);
      }
    },
    onSettled: () => {
      // Always refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.all });
    },
  });
}

// Hook for updating a label
export function useUpdateLabel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLabelRequest }) => 
      updateLabel(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.labels.list() });
      
      const previousLabels = queryClient.getQueryData<Label[]>(queryKeys.labels.list());
      
      if (previousLabels) {
        queryClient.setQueryData<Label[]>(
          queryKeys.labels.list(),
          previousLabels.map(label =>
            label.id === id ? { ...label, ...data } : label
          )
        );
      }
      
      return { previousLabels };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousLabels) {
        queryClient.setQueryData(queryKeys.labels.list(), context.previousLabels);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.all });
    },
  });
}

// Hook for deleting a label
export function useDeleteLabel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteLabel(id),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.labels.list() });
      
      const previousLabels = queryClient.getQueryData<Label[]>(queryKeys.labels.list());
      
      if (previousLabels) {
        queryClient.setQueryData<Label[]>(
          queryKeys.labels.list(),
          previousLabels.filter(label => label.id !== deletedId)
        );
      }
      
      return { previousLabels };
    },
    onError: (_err, _id, context) => {
      if (context?.previousLabels) {
        queryClient.setQueryData(queryKeys.labels.list(), context.previousLabels);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.all });
    },
  });
}

// Hook for fetching label transaction count (for delete confirmation)
export function useLabelTransactionCount(labelId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.labels.transactionCount(labelId ?? ''),
    queryFn: () => getLabelTransactionCount(labelId!),
    enabled: options?.enabled ?? !!labelId,
    staleTime: 30 * 1000, // 30 seconds - counts change frequently
  });
}

// Hook for deleting a label with transaction reassignment
export function useDeleteLabelWithReassignment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, reassignToId }: { id: string; reassignToId?: string }) => 
      deleteLabelWithReassignment(id, reassignToId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

// Hook to invalidate all label queries
export function useInvalidateLabels() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.labels.all });
}

export type { Label, LabelTree };
