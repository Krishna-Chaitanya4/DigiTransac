import { useState, useRef, useCallback } from 'react';

interface SwipeState {
  /** Current horizontal offset */
  offsetX: number;
  /** Whether a swipe action is in progress */
  isSwiping: boolean;
  /** Direction of the swipe: 'left', 'right', or null */
  direction: 'left' | 'right' | null;
  /** Whether the swipe has passed the action threshold */
  isActionTriggered: boolean;
}

interface UseSwipeGestureOptions {
  /** Minimum distance to trigger action (default: 80) */
  threshold?: number;
  /** Maximum swipe distance (default: 120) */
  maxDistance?: number;
  /** Resistance factor for drag (default: 0.8) */
  resistance?: number;
  /** Callback when swiped left past threshold */
  onSwipeLeft?: () => void;
  /** Callback when swiped right past threshold */
  onSwipeRight?: () => void;
  /** Whether swipe is disabled */
  disabled?: boolean;
  /** Directions allowed (default: both) */
  allowedDirections?: ('left' | 'right')[];
}

interface UseSwipeGestureReturn {
  /** Current swipe state */
  state: SwipeState;
  /** Touch event handlers to apply to the element */
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  /** Style object to apply for the swipe effect */
  style: React.CSSProperties;
  /** Reset the swipe state */
  reset: () => void;
}

/**
 * Hook for horizontal swipe gestures (swipe-to-delete, swipe-to-action)
 * Provides smooth, native-feeling swipe experience
 */
export function useSwipeGesture({
  threshold = 80,
  maxDistance = 120,
  resistance = 0.8,
  onSwipeLeft,
  onSwipeRight,
  disabled = false,
  allowedDirections = ['left', 'right'],
}: UseSwipeGestureOptions = {}): UseSwipeGestureReturn {
  const [state, setState] = useState<SwipeState>({
    offsetX: 0,
    isSwiping: false,
    direction: null,
    isActionTriggered: false,
  });

  const startX = useRef(0);
  const startY = useRef(0);
  const isTracking = useRef(false);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      isTracking.current = true;
      isHorizontalSwipe.current = null;
      
      setState(prev => ({
        ...prev,
        isSwiping: false,
        direction: null,
        isActionTriggered: false,
      }));
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isTracking.current || disabled) return;

      const deltaX = e.touches[0].clientX - startX.current;
      const deltaY = e.touches[0].clientY - startY.current;

      // Determine if this is a horizontal or vertical swipe
      if (isHorizontalSwipe.current === null) {
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
        }
        if (!isHorizontalSwipe.current) {
          // This is a vertical scroll, stop tracking
          isTracking.current = false;
          return;
        }
      }

      if (!isHorizontalSwipe.current) return;

      // Determine direction
      const direction = deltaX < 0 ? 'left' : 'right';
      
      // Check if direction is allowed
      if (!allowedDirections.includes(direction)) {
        return;
      }

      // Apply resistance and clamp to max distance
      const appliedDelta = deltaX * resistance;
      const clampedOffset = Math.max(
        -maxDistance,
        Math.min(maxDistance, appliedDelta)
      );

      const isActionTriggered = Math.abs(clampedOffset) >= threshold;

      setState({
        offsetX: clampedOffset,
        isSwiping: true,
        direction,
        isActionTriggered,
      });

      // Prevent scroll while swiping
      e.preventDefault();
    },
    [disabled, threshold, maxDistance, resistance, allowedDirections]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isTracking.current) return;
    isTracking.current = false;

    if (state.isActionTriggered) {
      if (state.direction === 'left' && onSwipeLeft) {
        onSwipeLeft();
      } else if (state.direction === 'right' && onSwipeRight) {
        onSwipeRight();
      }
    }

    // Reset position with animation
    setState({
      offsetX: 0,
      isSwiping: false,
      direction: null,
      isActionTriggered: false,
    });
  }, [state.isActionTriggered, state.direction, onSwipeLeft, onSwipeRight]);

  const reset = useCallback(() => {
    setState({
      offsetX: 0,
      isSwiping: false,
      direction: null,
      isActionTriggered: false,
    });
  }, []);

  const style: React.CSSProperties = {
    transform: `translateX(${state.offsetX}px)`,
    transition: state.isSwiping ? 'none' : 'transform 0.3s ease-out',
    touchAction: 'pan-y',
  };

  return {
    state,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    style,
    reset,
  };
}

export default useSwipeGesture;