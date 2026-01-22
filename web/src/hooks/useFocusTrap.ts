import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to trap focus within a container element.
 * Useful for modals and dialogs to ensure keyboard users can't tab out.
 * 
 * @param isActive - Whether the focus trap is currently active
 * @param options - Configuration options
 * @returns ref to attach to the container element
 */
export function useFocusTrap<T extends HTMLElement>(
  isActive: boolean,
  options: {
    /** Element to focus when trap activates (default: first focusable) */
    initialFocusRef?: React.RefObject<HTMLElement | null>;
    /** Element to focus when trap deactivates */
    returnFocusRef?: React.RefObject<HTMLElement | null>;
    /** Whether to restore focus on deactivation (default: true) */
    restoreFocus?: boolean;
  } = {}
) {
  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<Element | null>(null);
  const { initialFocusRef, returnFocusRef, restoreFocus = true } = options;

  // Get all focusable elements within the container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ');

    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter(el => {
      // Filter out elements that are not visible
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, []);

  // Handle tab key to trap focus
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Shift+Tab on first element -> go to last
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    }
    // Tab on last element -> go to first
    else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }, [getFocusableElements]);

  // Handle escape key to close (optional callback)
  useEffect(() => {
    if (!isActive) return;

    // Store the currently focused element
    previousActiveElement.current = document.activeElement;

    // Set initial focus
    const setInitialFocus = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        } else {
          // If no focusable elements, focus the container itself
          containerRef.current?.focus();
        }
      }
    };

    // Delay focus to ensure DOM is ready
    const timeoutId = setTimeout(setInitialFocus, 0);

    // Add keydown listener
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus
      if (restoreFocus) {
        const elementToFocus = returnFocusRef?.current || previousActiveElement.current;
        if (elementToFocus && elementToFocus instanceof HTMLElement) {
          elementToFocus.focus();
        }
      }
    };
  }, [isActive, initialFocusRef, returnFocusRef, restoreFocus, getFocusableElements, handleKeyDown]);

  return containerRef;
}
