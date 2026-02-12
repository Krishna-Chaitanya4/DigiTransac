import { useRef, useCallback } from 'react';
import { useHaptics } from './useHaptics';

interface UseLongPressOptions {
  /** Callback when long press is detected */
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  /** Optional callback for regular tap */
  onClick?: (e: React.TouchEvent | React.MouseEvent) => void;
  /** Duration in ms to trigger long press (default: 500) */
  delay?: number;
  /** Movement threshold in px to cancel long press (default: 10) */
  moveThreshold?: number;
  /** Whether to provide haptic feedback (default: true) */
  hapticFeedback?: boolean;
}

interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

/**
 * Hook that detects long press gestures on touch devices.
 * Returns event handlers to spread onto a target element.
 *
 * Cancels the long press if the finger moves beyond moveThreshold,
 * preventing false triggers during scroll.
 *
 * @example
 * ```tsx
 * const longPressHandlers = useLongPress({
 *   onLongPress: () => setShowActionSheet(true),
 *   onClick: () => navigateToDetail(),
 * });
 *
 * return <div {...longPressHandlers}>Item</div>;
 * ```
 */
export function useLongPress({
  onLongPress,
  onClick,
  delay = 500,
  moveThreshold = 10,
  hapticFeedback = true,
}: UseLongPressOptions): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggered = useRef(false);
  const haptics = useHaptics();

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTriggered.current = false;

    timerRef.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (hapticFeedback) {
        haptics.heavy();
      }
      onLongPress(e);
    }, delay);
  }, [delay, onLongPress, hapticFeedback, haptics]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startPos.current) return;

    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - startPos.current.x);
    const dy = Math.abs(touch.clientY - startPos.current.y);

    if (dx > moveThreshold || dy > moveThreshold) {
      clear();
      startPos.current = null;
    }
  }, [moveThreshold, clear]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    clear();
    startPos.current = null;

    // If long press was triggered, prevent the click
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      e.preventDefault();
      return;
    }

    // Otherwise fire onClick
    if (onClick) {
      onClick(e);
    }
  }, [clear, onClick]);

  const onTouchCancel = useCallback(() => {
    clear();
    startPos.current = null;
    longPressTriggered.current = false;
  }, [clear]);

  // Prevent context menu on long press to avoid the native browser menu
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (longPressTriggered.current) {
      e.preventDefault();
    }
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    onContextMenu,
  };
}