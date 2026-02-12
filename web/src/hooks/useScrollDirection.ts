import { useState, useEffect, useRef } from 'react';

export type ScrollDirection = 'up' | 'down' | null;

interface UseScrollDirectionOptions {
  /** Minimum scroll delta (px) before triggering direction change. Default: 10 */
  threshold?: number;
  /** Distance from top (px) where header always shows. Default: 50 */
  topOffset?: number;
}

/**
 * Detects scroll direction for auto-hide header patterns.
 * Returns 'up' when scrolling up (show header), 'down' when scrolling down (hide header),
 * or null when at rest/top of page.
 */
export function useScrollDirection(options: UseScrollDirectionOptions = {}): ScrollDirection {
  const { threshold = 10, topOffset = 50 } = options;
  const [direction, setDirection] = useState<ScrollDirection>(null);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const updateDirection = () => {
      const scrollY = window.scrollY;

      // Always show header near top of page
      if (scrollY < topOffset) {
        setDirection(null);
        lastScrollY.current = scrollY;
        ticking.current = false;
        return;
      }

      const delta = scrollY - lastScrollY.current;

      if (Math.abs(delta) >= threshold) {
        setDirection(delta > 0 ? 'down' : 'up');
        lastScrollY.current = scrollY;
      }

      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(updateDirection);
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold, topOffset]);

  return direction;
}