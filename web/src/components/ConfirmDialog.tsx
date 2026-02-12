import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useHaptics } from '../hooks/useHaptics';

export interface ConfirmDialogProps {
  /** Whether the dialog is visible */
  isOpen: boolean;
  /** Title text */
  title: string;
  /** Description / body text */
  message: string;
  /** Label for the confirm button */
  confirmLabel?: string;
  /** Label for the cancel button */
  cancelLabel?: string;
  /** Visual variant for the confirm button */
  variant?: 'danger' | 'warning' | 'default';
  /** Called when the user confirms */
  onConfirm: () => void;
  /** Called when the user cancels or dismisses */
  onCancel: () => void;
  /** Whether confirm action is in progress */
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  const isMobile = useIsMobile();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const haptics = useHaptics();

  // Focus trap — focus the confirm button when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to let the animation start
      const timer = setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, isLoading]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const handleConfirmWithHaptics = useCallback(() => {
    if (variant === 'danger') {
      haptics.heavy();
    } else if (variant === 'warning') {
      haptics.warning();
    } else {
      haptics.medium();
    }
    onConfirm();
  }, [variant, haptics, onConfirm]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onCancel();
    }
  }, [onCancel, isLoading]);

  if (!isOpen) return null;

  const confirmButtonColors = {
    danger: 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 focus:ring-red-500',
    warning: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800 focus:ring-amber-500',
    default: 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800 focus:ring-indigo-500',
  };

  const iconByVariant = {
    danger: (
      <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
      </div>
    ),
    warning: (
      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>
    ),
    default: (
      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
        </svg>
      </div>
    ),
  };

  // Mobile: bottom sheet style
  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center animate-fade-in"
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Bottom sheet */}
        <div
          ref={dialogRef}
          className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-t-2xl safe-area-bottom animate-slide-up"
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>

          <div className="px-6 pt-2 pb-6">
            {/* Icon + Title */}
            <div className="flex items-center gap-3 mb-3">
              {iconByVariant[variant]}
              <h2 id="confirm-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </h2>
            </div>

            {/* Message */}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 ml-[52px]">
              {message}
            </p>

            {/* Actions — stacked on mobile */}
            <div className="flex flex-col gap-2">
              <button
                ref={confirmBtnRef}
                onClick={handleConfirmWithHaptics}
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-xl text-white font-medium text-sm transition-colors
                  focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${confirmButtonColors[variant]}`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : confirmLabel}
              </button>
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl text-gray-700 dark:text-gray-300 font-medium text-sm
                  bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                  transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: centered modal style
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center animate-fade-in"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 animate-scale-in"
      >
        <div className="p-6">
          {/* Icon + Title */}
          <div className="flex items-center gap-3 mb-3">
            {iconByVariant[variant]}
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
          </div>

          {/* Message */}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 ml-[52px]">
            {message}
          </p>

          {/* Actions — side by side on desktop */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 font-medium text-sm
                bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmBtnRef}
              onClick={handleConfirmWithHaptics}
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg text-white font-medium text-sm transition-colors
                focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800
                disabled:opacity-50 disabled:cursor-not-allowed
                ${confirmButtonColors[variant]}`}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage ConfirmDialog state with a promise-based API.
 * Usage:
 * ```
 * const { confirm, dialogProps } = useConfirmDialog();
 * 
 * const handleDelete = async () => {
 *   const confirmed = await confirm({
 *     title: 'Delete transaction?',
 *     message: 'This action cannot be undone.',
 *     confirmLabel: 'Delete',
 *     variant: 'danger',
 *   });
 *   if (confirmed) { ... }
 * };
 * 
 * return <><ConfirmDialog {...dialogProps} />...</>;
 * ```
 */
interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
}

export function useConfirmDialog() {
  const [state, setState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
  }>({
    isOpen: false,
    options: { title: '', message: '' },
  });

  // Store resolve in a ref to avoid dependency issues with React Compiler
  const resolveRef: RefObject<((value: boolean) => void) | null> = useRef(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({
        isOpen: true,
        options,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const dialogProps: ConfirmDialogProps = {
    isOpen: state.isOpen,
    title: state.options.title,
    message: state.options.message,
    confirmLabel: state.options.confirmLabel,
    cancelLabel: state.options.cancelLabel,
    variant: state.options.variant,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
  };

  return { confirm, dialogProps };
}