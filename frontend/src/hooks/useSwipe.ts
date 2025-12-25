import { useState, useCallback, useRef, TouchEvent } from 'react';

interface SwipeConfig {
  threshold?: number; // Minimum swipe distance to trigger action (default: 80px)
  velocity?: number; // Minimum swipe velocity (default: 0.3)
}

interface SwipeHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: () => void;
}

interface SwipeState {
  deltaX: number;
  isSwiping: boolean;
}

/**
 * Hook for handling swipe gestures
 * Returns handlers and current swipe state
 */
export const useSwipe = (
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  config: SwipeConfig = {}
): [SwipeHandlers, SwipeState] => {
  const { threshold = 80, velocity = 0.3 } = config;

  const [deltaX, setDeltaX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const startX = useRef(0);
  const startTime = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startTime.current = Date.now();
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isSwiping) return;

    const currentX = e.touches[0].clientX;
    const delta = currentX - startX.current;

    // Limit swipe distance
    const limitedDelta = Math.max(-150, Math.min(150, delta));
    setDeltaX(limitedDelta);
  }, [isSwiping]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping) return;

    const endTime = Date.now();
    const timeDelta = endTime - startTime.current;
    const swipeVelocity = Math.abs(deltaX) / timeDelta;

    // Check if swipe meets threshold or velocity requirements
    const isValidSwipe = Math.abs(deltaX) > threshold || swipeVelocity > velocity;

    if (isValidSwipe) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    // Reset state
    setDeltaX(0);
    setIsSwiping(false);
  }, [deltaX, isSwiping, onSwipeLeft, onSwipeRight, threshold, velocity]);

  return [
    {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    {
      deltaX,
      isSwiping,
    },
  ];
};
