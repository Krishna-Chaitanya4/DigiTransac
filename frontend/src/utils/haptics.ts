/**
 * Haptic feedback utilities for mobile devices
 * Provides a consistent way to add tactile feedback across the app
 */

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Trigger haptic feedback if supported by the device
 */
export const hapticFeedback = (pattern: HapticPattern = 'light'): void => {
  // Check if vibration API is supported
  if (!('vibrate' in navigator)) {
    return;
  }

  const patterns: Record<HapticPattern, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10], // Two short pulses
    warning: [15, 100, 15], // Two medium pulses
    error: [30, 100, 30, 100, 30], // Three heavy pulses
  };

  try {
    navigator.vibrate(patterns[pattern]);
  } catch (error) {
    // Silently fail if vibration is not supported or blocked
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Trigger haptic feedback for button presses
 */
export const hapticClick = (): void => {
  hapticFeedback('light');
};

/**
 * Trigger haptic feedback for successful actions
 */
export const hapticSuccess = (): void => {
  hapticFeedback('success');
};

/**
 * Trigger haptic feedback for warnings
 */
export const hapticWarning = (): void => {
  hapticFeedback('warning');
};

/**
 * Trigger haptic feedback for errors
 */
export const hapticError = (): void => {
  hapticFeedback('error');
};

/**
 * Check if device supports haptic feedback
 */
export const isHapticSupported = (): boolean => {
  return 'vibrate' in navigator;
};

/**
 * React hook for haptic feedback
 */
export const useHaptic = () => {
  return {
    click: hapticClick,
    success: hapticSuccess,
    warning: hapticWarning,
    error: hapticError,
    feedback: hapticFeedback,
    isSupported: isHapticSupported(),
  };
};
