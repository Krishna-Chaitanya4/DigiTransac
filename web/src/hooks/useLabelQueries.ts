import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { getLabels, getLabelsTree, createLabel, updateLabel, deleteLabel, deleteLabelWithReassignment } from '../services/labelService';
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
    onSuccess: () => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.all });
    },
  });
}

// Hook for deleting a label
export function useDeleteLabel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteLabel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.labels.all });
    },
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
