/**
 * Keyboard Shortcuts Help Modal
 * 
 * Displays all available keyboard shortcuts in the application.
 * Can be triggered with ? or Ctrl+/ (Cmd+/ on Mac)
 */

import { useEffect, useState } from 'react';

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['G', 'T'], description: 'Go to Transactions' },
      { keys: ['G', 'A'], description: 'Go to Accounts' },
      { keys: ['G', 'I'], description: 'Go to Insights' },
      { keys: ['G', 'B'], description: 'Go to Budgets' },
      { keys: ['G', 'C'], description: 'Go to Chats' },
      { keys: ['G', 'M'], description: 'Go to Spending Map' },
      { keys: ['G', 'S'], description: 'Go to Settings' },
    ],
  },
  {
    title: 'Transactions',
    shortcuts: [
      { keys: ['N'], description: 'New transaction' },
      { keys: ['F'], description: 'Focus search' },
      { keys: ['/'], description: 'Toggle filter panel' },
      { keys: ['J'], description: 'Next transaction' },
      { keys: ['K'], description: 'Previous transaction' },
      { keys: ['Enter'], description: 'Expand/collapse selected' },
      { keys: ['E'], description: 'Edit selected transaction' },
      { keys: ['Delete'], description: 'Delete selected transaction' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: ['?'], description: 'Show this help' },
      { keys: ['Esc'], description: 'Close modal / Cancel' },
      { keys: ['Ctrl', 'S'], description: 'Save form' },
      { keys: ['Ctrl', 'Z'], description: 'Undo last action' },
    ],
  },
  {
    title: 'Appearance',
    shortcuts: [
      { keys: ['Ctrl', 'Shift', 'L'], description: 'Toggle dark mode' },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto" 
      role="dialog" 
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 
              id="keyboard-shortcuts-title" 
              className="text-xl font-semibold text-gray-900 dark:text-gray-100"
            >
              ⌨️ Keyboard Shortcuts
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
            <div className="grid gap-6 md:grid-cols-2">
              {shortcutGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                    {group.title}
                  </h3>
                  <div className="space-y-2">
                    {group.shortcuts.map((shortcut, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between py-1"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, keyIndex) => (
                            <span key={keyIndex}>
                              <kbd className="
                                px-2 py-1 
                                text-xs font-mono font-medium
                                bg-gray-100 dark:bg-gray-700
                                text-gray-800 dark:text-gray-200
                                border border-gray-300 dark:border-gray-600
                                rounded-md shadow-sm
                              ">
                                {key}
                              </kbd>
                              {keyIndex < shortcut.keys.length - 1 && (
                                <span className="mx-1 text-gray-400">+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Footer */}
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              Press <kbd className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">?</kbd> anytime to show this help
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage keyboard shortcuts modal state
 * Also registers the global ? shortcut to open the modal
 */
export function useKeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // ? to open help (Shift + /)
      if (e.key === '?' || (e.key === '/' && e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(true);
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(!isOpen),
  };
}