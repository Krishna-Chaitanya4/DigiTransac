import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { getTags, createTag, updateTag, deleteTag, getTagTransactionCount, deleteTagConfirmed } from '../services/tagService';
import type { Tag, CreateTagRequest, UpdateTagRequest } from '../types/labels';

// Hook for fetching all tags
export function useTags(): UseQueryResult<Tag[], Error> {
  return useQuery({
    queryKey: queryKeys.tags.list(),
    queryFn: getTags,
    staleTime: 10 * 60 * 1000, // 10 minutes - tags rarely change
  });
}

// Hook for creating a tag
export function useCreateTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateTagRequest) => createTag(data),
    onSuccess: (newTag) => {
      // Update cache with new tag
      queryClient.setQueryData<Tag[]>(queryKeys.tags.list(), (old) => 
        old ? [...old, newTag] : [newTag]
      );
    },
  });
}

// Hook for updating a tag
export function useUpdateTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTagRequest }) => 
      updateTag(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
  });
}

// Hook for deleting a tag
export function useDeleteTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
  });
}

// Hook for getting tag transaction count
export function useTagTransactionCount() {
  return useMutation({
    mutationFn: (id: string) => getTagTransactionCount(id),
  });
}

// Hook for deleting a tag with confirmation (removes from all transactions)
export function useDeleteTagConfirmed() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteTagConfirmed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      // Also invalidate transactions since tags are removed from them
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    },
  });
}

// Hook for manually invalidating tags cache
export function useInvalidateTags() {
  const queryClient = useQueryClient();
  
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
}

export type { Tag };
