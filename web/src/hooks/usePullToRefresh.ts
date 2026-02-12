import { useCallback, useEffect, useRef, useState } from 'react';
import { useHaptics } from './useHaptics';

interface PullToRefreshOptions {
  /** Callback to execute when pull threshold is reached */
  onRefresh: () => Promise<void>;
  /** Distance in pixels to pull before triggering refresh (default: 80) */
  threshold?: number;
  /** Maximum pull distance in pixels (default: 150) */
  maxPull?: number;
  /** Whether pull-to-refresh is enabled (default: true) */
  enabled?: boolean;
}

interface PullToRefreshState {
  isPulling: boolean;
  pullDistance: number;
  isRefreshing: boolean;
}

/**
 * Custom hook for pull-to-refresh functionality on mobile devices.
 * Attach the returned ref to a scrollable container element.
 * 
 * @example
 * ```tsx
 * const { ref, isPulling, pullDistance, isRefreshing, PullIndicator } = usePullToRefresh({
 *   onRefresh: async () => {
 *     await queryClient.invalidateQueries(['transactions']);
 *   },
 * });
 * 
 * return (
 *   <div ref={ref} className="overflow-auto h-full">
 *     <PullIndicator />
 *     {content}
 *   </div>
 * );
 * ```
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 150,
  enabled = true,
}: PullToRefreshOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const hasVibratedThreshold = useRef(false);
  const haptics = useHaptics();
  
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    pullDistance: 0,
    isRefreshing: false,
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || state.isRefreshing) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    // Only start pull if at the top of the scroll container
    if (container.scrollTop > 0) return;
    
    startY.current = e.touches[0].clientY;
    currentY.current = e.touches[0].clientY;
  }, [enabled, state.isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || state.isRefreshing) return;
    if (startY.current === 0) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    // Only continue if at top of container
    if (container.scrollTop > 0) {
      startY.current = 0;
      setState(s => ({ ...s, isPulling: false, pullDistance: 0 }));
      return;
    }
    
    currentY.current = e.touches[0].clientY;
    const deltaY = currentY.current - startY.current;
    
    // Only pull down, not up
    if (deltaY < 0) {
      startY.current = 0;
      setState(s => ({ ...s, isPulling: false, pullDistance: 0 }));
      return;
    }
    
    // Apply resistance - the further you pull, the harder it gets
    const resistance = 0.5;
    const pullDistance = Math.min(deltaY * resistance, maxPull);
    
    // Haptic feedback when crossing threshold
    if (pullDistance >= threshold && !hasVibratedThreshold.current) {
      haptics.light();
      hasVibratedThreshold.current = true;
    } else if (pullDistance < threshold) {
      hasVibratedThreshold.current = false;
    }

    if (pullDistance > 10) {
      // Prevent scrolling while pulling
      e.preventDefault();
      setState(s => ({ ...s, isPulling: true, pullDistance }));
    }
  }, [enabled, maxPull, state.isRefreshing, threshold, haptics]);

  const handleTouchEnd = useCallback(async () => {
    if (!enabled || state.isRefreshing) return;
    if (!state.isPulling) {
      startY.current = 0;
      return;
    }
    
    startY.current = 0;
    currentY.current = 0;
    
    if (state.pullDistance >= threshold) {
      // Trigger refresh
      haptics.success();
      hasVibratedThreshold.current = false;
      setState(s => ({ ...s, isPulling: false, pullDistance: threshold, isRefreshing: true }));
      
      try {
        await onRefresh();
      } finally {
        setState({ isPulling: false, pullDistance: 0, isRefreshing: false });
      }
    } else {
      // Didn't reach threshold, spring back
      hasVibratedThreshold.current = false;
      setState({ isPulling: false, pullDistance: 0, isRefreshing: false });
    }
  }, [enabled, onRefresh, state.isPulling, state.pullDistance, state.isRefreshing, threshold, haptics]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;
    
    // Use passive: false for touchmove to allow preventDefault
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, enabled]);

  // Calculate progress (0 to 1)
  const progress = Math.min(state.pullDistance / threshold, 1);
  const isReadyToRefresh = progress >= 1;

  return {
    ref: containerRef,
    isPulling: state.isPulling,
    pullDistance: state.pullDistance,
    isRefreshing: state.isRefreshing,
    progress,
    isReadyToRefresh,
  };
}