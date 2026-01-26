import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { getLabels, createLabel, updateLabel, deleteLabel } from '../services/labelService';
import type { Label, CreateLabelRequest, UpdateLabelRequest } from '../types/labels';

// Hook for fetching all labels
export function useLabels(): UseQueryResult<Label[], Error> {
  return useQuery({
    queryKey: queryKeys.labels.list(),
    queryFn: getLabels,
    staleTime: 10 * 60 * 1000, // 10 minutes - labels rarely change
  });
}

// Hook for creating a label
export function useCreateLabel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateLabelRequest) => createLabel(data),
    onSuccess: (newLabel) => {
      // Update cache with new label
      queryClient.setQueryData<Label[]>(queryKeys.labels.list(), (old) => 
        old ? [...old, newLabel] : [newLabel]
      );
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

export type { Label };
