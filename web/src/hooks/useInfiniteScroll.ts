import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether currently loading */
  isLoading: boolean;
  /** Callback to load more items */
  onLoadMore: () => void;
  /** Distance from bottom in pixels to trigger load (default: 200) */
  threshold?: number;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook to handle infinite scroll behavior
 * Returns a ref to attach to the scrollable container
 */
export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  threshold = 200,
  enabled = true,
}: UseInfiniteScrollOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(onLoadMore);
  
  // Keep callback ref updated
  useEffect(() => {
    loadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current || isLoading || !hasMore || !enabled) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    
    if (scrollTop + clientHeight >= scrollHeight - threshold) {
      loadMoreRef.current();
    }
  }, [isLoading, hasMore, threshold, enabled]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;
    
    container.addEventListener('scroll', handleScroll);
    
    // Also check on mount in case content is already at bottom
    handleScroll();
    
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll, enabled]);

  return containerRef;
}
