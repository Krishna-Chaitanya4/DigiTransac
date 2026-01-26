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
    onMutate: async (newTagData) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tags.list() });
      
      const previousTags = queryClient.getQueryData<Tag[]>(queryKeys.tags.list());
      
      if (previousTags) {
        const optimisticTag: Tag = {
          id: `temp-${Date.now()}`,
          name: newTagData.name,
          color: newTagData.color ?? null,
          createdAt: new Date().toISOString(),
        };
        queryClient.setQueryData<Tag[]>(queryKeys.tags.list(), [...previousTags, optimisticTag]);
      }
      
      return { previousTags };
    },
    onError: (_err, _newTag, context) => {
      if (context?.previousTags) {
        queryClient.setQueryData(queryKeys.tags.list(), context.previousTags);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
  });
}

// Hook for updating a tag
export function useUpdateTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTagRequest }) => 
      updateTag(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tags.list() });
      
      const previousTags = queryClient.getQueryData<Tag[]>(queryKeys.tags.list());
      
      if (previousTags) {
        queryClient.setQueryData<Tag[]>(
          queryKeys.tags.list(),
          previousTags.map(tag =>
            tag.id === id ? { ...tag, ...data } : tag
          )
        );
      }
      
      return { previousTags };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTags) {
        queryClient.setQueryData(queryKeys.tags.list(), context.previousTags);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
  });
}

// Hook for deleting a tag
export function useDeleteTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tags.list() });
      
      const previousTags = queryClient.getQueryData<Tag[]>(queryKeys.tags.list());
      
      if (previousTags) {
        queryClient.setQueryData<Tag[]>(
          queryKeys.tags.list(),
          previousTags.filter(tag => tag.id !== deletedId)
        );
      }
      
      return { previousTags };
    },
    onError: (_err, _id, context) => {
      if (context?.previousTags) {
        queryClient.setQueryData(queryKeys.tags.list(), context.previousTags);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
  });
}

// Hook for getting tag transaction count (for delete confirmation)
// Uses useQuery with enabled option for conditional fetching
export function useTagTransactionCount(tagId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tags.transactionCount(tagId ?? ''),
    queryFn: () => getTagTransactionCount(tagId!),
    enabled: options?.enabled ?? !!tagId,
    staleTime: 30 * 1000, // 30 seconds - counts can change
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

// Hook to prefetch tags (e.g., on hover)
export function usePrefetchTags() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.tags.list(),
      queryFn: getTags,
      staleTime: 10 * 60 * 1000,
    });
  };
}

export type { Tag };
