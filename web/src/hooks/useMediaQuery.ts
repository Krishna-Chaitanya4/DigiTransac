import { useState, useEffect } from 'react';

/**
 * Hook to track a CSS media query match state.
 * Returns true when the media query matches.
 * 
 * @example
 * const isMobile = useMediaQuery('(max-width: 1023px)');
 * const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * Returns true when the viewport is below the `lg` breakpoint (< 1024px).
 * This matches Tailwind's `lg:` breakpoint.
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}