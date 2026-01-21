import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
  /** Key to listen for */
  key: string;
  /** Whether Ctrl/Cmd must be pressed */
  ctrlOrCmd?: boolean;
  /** Whether Shift must be pressed */
  shift?: boolean;
  /** Whether Alt must be pressed */
  alt?: boolean;
  /** Callback when shortcut is triggered */
  handler: () => void;
  /** Description for help display */
  description?: string;
  /** Whether to prevent default behavior (default: true) */
  preventDefault?: boolean;
  /** Whether the shortcut is enabled (default: true) */
  enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  /** List of shortcuts to register */
  shortcuts: KeyboardShortcut[];
  /** Whether all shortcuts are enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook to register keyboard shortcuts
 * Automatically handles cleanup and ignores shortcuts when typing in inputs
 */
export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore shortcuts when typing in input elements
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        // Check if key matches (case-insensitive)
        if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) continue;

        // Check modifiers
        const ctrlOrCmd = event.ctrlKey || event.metaKey;
        if (shortcut.ctrlOrCmd && !ctrlOrCmd) continue;
        if (!shortcut.ctrlOrCmd && ctrlOrCmd && shortcut.key.length === 1) continue; // Don't trigger single-key shortcuts with Ctrl
        if (shortcut.shift && !event.shiftKey) continue;
        if (!shortcut.shift && event.shiftKey && shortcut.key.length === 1) continue;
        if (shortcut.alt && !event.altKey) continue;

        // Skip single-character shortcuts when in input (unless with modifiers)
        if (isInputElement && shortcut.key.length === 1 && !shortcut.ctrlOrCmd && !shortcut.alt) {
          continue;
        }

        // Trigger the handler
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.handler();
        return;
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

/**
 * Common keyboard shortcuts for reference
 */
export const COMMON_SHORTCUTS = {
  NEW: { key: 'n', description: 'New item' },
  SEARCH: { key: 'f', ctrlOrCmd: true, description: 'Focus search' },
  SEARCH_ALT: { key: '/', description: 'Focus search' },
  ESCAPE: { key: 'Escape', description: 'Close/Cancel' },
  SAVE: { key: 's', ctrlOrCmd: true, description: 'Save' },
  DELETE: { key: 'Delete', description: 'Delete selected' },
  SELECT_ALL: { key: 'a', ctrlOrCmd: true, description: 'Select all' },
  REFRESH: { key: 'r', ctrlOrCmd: true, description: 'Refresh' },
} as const;
