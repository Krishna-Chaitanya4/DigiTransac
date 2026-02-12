import { useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHaptics } from './useHaptics';

/** Ordered list of navigable tab routes for swipe navigation */
const SWIPE_TABS = ['/insights', '/accounts', '/transactions'];

interface SwipeNavigationOptions {
  /** Minimum horizontal distance (px) to trigger navigation. Default: 80 */
  minDistance?: number;
  /** Maximum vertical distance (px) allowed during swipe. Default: 80 */
  maxVertical?: number;
  /** Maximum time (ms) allowed for the swipe gesture. Default: 400 */
  maxTime?: number;
  /** Whether swipe navigation is enabled. Default: true */
  enabled?: boolean;
}

/**
 * Hook that enables horizontal swipe gestures to navigate between
 * adjacent bottom tab bar pages on mobile.
 *
 * Swipe right → previous tab, swipe left → next tab.
 *
 * The hook attaches touch listeners to the provided ref element and
 * carefully avoids interfering with vertical scrolling or nested
 * horizontal gestures (e.g. SwipeableRow).
 */
export function useSwipeNavigation(
  ref: React.RefObject<HTMLElement | null>,
  options: SwipeNavigationOptions = {}
) {
  const {
    minDistance = 80,
    maxVertical = 80,
    maxTime = 400,
    enabled = true,
  } = options;

  const navigate = useNavigate();
  const location = useLocation();
  const haptics = useHaptics();

  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const isTracking = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    // Only track single-finger touches
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    isTracking.current = true;
  }, [enabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isTracking.current || !touchStart.current) return;

    const touch = e.touches[0];
    const dy = Math.abs(touch.clientY - touchStart.current.y);

    // If vertical movement exceeds threshold, abort horizontal tracking
    // This prevents interference with vertical scrolling
    if (dy > maxVertical) {
      isTracking.current = false;
      touchStart.current = null;
    }
  }, [maxVertical]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!isTracking.current || !touchStart.current) {
      isTracking.current = false;
      touchStart.current = null;
      return;
    }

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = Math.abs(touch.clientY - touchStart.current.y);
    const elapsed = Date.now() - touchStart.current.time;

    isTracking.current = false;
    touchStart.current = null;

    // Validate the swipe gesture
    if (Math.abs(dx) < minDistance) return;
    if (dy > maxVertical) return;
    if (elapsed > maxTime) return;

    // Find current tab index
    const currentIndex = SWIPE_TABS.indexOf(location.pathname);
    if (currentIndex === -1) return; // Not on a navigable tab page

    let targetIndex: number;
    if (dx > 0) {
      // Swipe right → go to previous tab
      targetIndex = currentIndex - 1;
    } else {
      // Swipe left → go to next tab
      targetIndex = currentIndex + 1;
    }

    if (targetIndex < 0 || targetIndex >= SWIPE_TABS.length) return;

    haptics.light();
    navigate(SWIPE_TABS[targetIndex]);
  }, [minDistance, maxVertical, maxTime, location.pathname, navigate, haptics]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [ref, enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);
}