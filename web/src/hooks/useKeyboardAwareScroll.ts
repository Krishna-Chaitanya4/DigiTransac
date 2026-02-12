import { useEffect } from 'react';
import { useIsMobile } from './useMediaQuery';

/**
 * Hook that ensures focused input fields remain visible when the
 * mobile virtual keyboard appears.
 *
 * On mobile devices, the keyboard can cover input fields. This hook
 * listens for focus events on input/textarea/select elements and
 * uses `scrollIntoView` with the VisualViewport API resize event
 * to ensure the focused element stays visible.
 *
 * Call this hook once in a top-level component (e.g. Layout).
 */
export function useKeyboardAwareScroll() {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) return;

    const scrollToFocused = () => {
      // Small delay to let the keyboard animation settle
      setTimeout(() => {
        const el = document.activeElement;
        if (
          el &&
          (el instanceof HTMLInputElement ||
            el instanceof HTMLTextAreaElement ||
            el instanceof HTMLSelectElement)
        ) {
          el.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }
      }, 150);
    };

    // Strategy 1: VisualViewport resize (fires when keyboard opens/closes)
    const handleViewportResize = () => {
      if (document.activeElement && document.activeElement !== document.body) {
        scrollToFocused();
      }
    };

    // Strategy 2: Focus event on input elements
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        // Delay scroll to allow keyboard to open
        setTimeout(() => {
          if (document.activeElement === target) {
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest',
            });
          }
        }, 300);
      }
    };

    // Attach listeners
    document.addEventListener('focusin', handleFocusIn, { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
    }

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
      }
    };
  }, [isMobile]);
}