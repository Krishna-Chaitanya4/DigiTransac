import { useState, useEffect, useRef, useCallback } from 'react';
import type { Transaction } from '../types/transactions';

interface UseTransactionHighlightOptions {
  /** Current displayed transactions list. */
  transactions: Transaction[];
  /** Whether more pages are available. */
  hasMore: boolean;
  /** Current page number (for progressive loading). */
  currentPage: number;
  /** Setter for current page (to load more if target not found). */
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  /** Whether the transactions query is currently fetching. */
  isFetching: boolean;
  /** Initial highlight ID from navigation (location.state). Fresh on each mount. */
  initialHighlightId: string | null;
  /** React Router location.key — unique per navigation. Used to detect new
   *  navigations even if the component is reconciled without remounting. */
  navigationKey: string;
}

/**
 * Manages the "highlight and scroll to a transaction" feature.
 *
 * Design:
 * - Uses React STATE for the scroll target (not a ref), so the value
 *   survives React Strict Mode's double-mount cycle.
 * - The DOM polling interval is created and cleaned up in the SAME effect,
 *   making it Strict Mode safe (cleanup→remount correctly restarts the poll).
 * - Progressive page loading is a separate effect that loads more data
 *   if the target isn't in the currently loaded transactions.
 * - Exposes `triggerHighlight(id)` for in-page use (e.g. "View linked transaction").
 *
 * Navigation: callers use `navigate('/transactions', { state: { highlightTransactionId } })`
 * instead of URL search params, which avoids in-place mutation issues and doesn't
 * require manual URL cleanup.
 */
export function useTransactionHighlight({
  transactions,
  hasMore,
  currentPage,
  setCurrentPage,
  isFetching,
  initialHighlightId,
  navigationKey,
}: UseTransactionHighlightOptions) {
  const [highlightedTransactionId, setHighlightedTransactionId] = useState<string | null>(null);

  // The ID we want to scroll to. Using STATE (not ref) so it survives Strict Mode.
  // Initialized from location.state, which is fresh on each component mount.
  const [scrollTarget, setScrollTarget] = useState<string | null>(initialHighlightId);

  // ─── Sync from props on navigation changes ──────────────────
  // Handles the edge case where React reconciles the component without
  // remounting it (useState wouldn't re-initialize).
  // Also acts as a safety net for any timing issues.
  useEffect(() => {
    if (initialHighlightId) {
      setScrollTarget(initialHighlightId);
    }
  }, [initialHighlightId, navigationKey]);

  // Track highlight clear timer for cleanup
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── DOM Polling (Strict Mode safe) ─────────────────────────
  // Poll creation and cleanup are in the SAME effect. During Strict Mode's
  // cleanup→remount cycle: effect1 starts poll → cleanup kills it →
  // effect2 starts a NEW poll (scrollTarget is still set because it's state).
  useEffect(() => {
    if (!scrollTarget) return;

    let elapsed = 0;
    const interval = 100; // ms
    const maxWait = 5000; // 5 seconds

    const pollId = setInterval(() => {
      elapsed += interval;
      const element = document.querySelector(`[data-transaction-id="${scrollTarget}"]`);
      if (element) {
        clearInterval(pollId);
        setHighlightedTransactionId(scrollTarget);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setScrollTarget(null);
        // Clear highlight after 3 seconds
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = setTimeout(() => setHighlightedTransactionId(null), 3000);
      } else if (elapsed >= maxWait) {
        clearInterval(pollId);
        setScrollTarget(null);
      }
    }, interval);

    return () => clearInterval(pollId);
  }, [scrollTarget]);

  // ─── Progressive Page Loading ───────────────────────────────
  // If the scroll target isn't in the loaded data, load more pages
  // so the poll can eventually find the DOM element.
  useEffect(() => {
    if (!scrollTarget || transactions.length === 0 || isFetching) return;

    const exists = transactions.some(t => t.id === scrollTarget);
    if (!exists && hasMore && currentPage < 20) {
      setCurrentPage(prev => prev + 1);
    }
  }, [scrollTarget, transactions, hasMore, currentPage, isFetching, setCurrentPage]);

  // Cleanup highlight timer on unmount
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  /** Programmatically trigger a highlight (e.g., "View linked transaction"). */
  const triggerHighlight = useCallback((transactionId: string) => {
    setScrollTarget(transactionId);
  }, []);

  return {
    highlightedTransactionId,
    triggerHighlight,
  };
}
