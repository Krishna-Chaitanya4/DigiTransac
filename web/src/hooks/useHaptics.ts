import { useCallback, useMemo } from 'react';

/**
 * Haptic feedback patterns using the Vibration API.
 * Each pattern is an array of alternating vibration/pause durations in ms.
 * Falls back to no-op on devices that don't support vibration.
 */
const PATTERNS = {
  /** Ultra-light tap — tab selection, toggle */
  light: [10],
  /** Medium tap — swipe threshold reached, button press */
  medium: [25],
  /** Heavy tap — destructive confirm, swipe complete */
  heavy: [50],
  /** Double-pulse — success feedback */
  success: [15, 50, 15],
  /** Triple-pulse — warning */
  warning: [20, 40, 20, 40, 20],
  /** Long single buzz — error */
  error: [80],
  /** Tiny tick — selection change, scroll snap */
  selection: [5],
} as const;

export type HapticPattern = keyof typeof PATTERNS;

/**
 * Hook providing haptic feedback via the Vibration API.
 * All methods are safe to call on any device — they no-op
 * when `navigator.vibrate` is unavailable.
 *
 * @example
 * ```tsx
 * const haptics = useHaptics();
 * <button onClick={() => { haptics.medium(); doAction(); }}>Tap</button>
 * ```
 */
export function useHaptics() {
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const vibrate = useCallback(
    (pattern: HapticPattern) => {
      if (isSupported) {
        try {
          navigator.vibrate(PATTERNS[pattern]);
        } catch {
          // Silently ignore — some browsers throw in certain contexts
        }
      }
    },
    [isSupported],
  );

  return useMemo(
    () => ({
      isSupported,
      vibrate,
      light: () => vibrate('light'),
      medium: () => vibrate('medium'),
      heavy: () => vibrate('heavy'),
      success: () => vibrate('success'),
      warning: () => vibrate('warning'),
      error: () => vibrate('error'),
      selection: () => vibrate('selection'),
    }),
    [isSupported, vibrate],
  );
}