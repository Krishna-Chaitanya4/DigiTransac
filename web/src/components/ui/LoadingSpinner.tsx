import { useMemo } from 'react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerVariant = 'primary' | 'secondary' | 'white' | 'current';

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  className?: string;
  label?: string;
  fullScreen?: boolean;
  overlay?: boolean;
}

const sizeClasses: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const variantClasses: Record<SpinnerVariant, string> = {
  primary: 'border-blue-600 border-t-transparent',
  secondary: 'border-gray-400 border-t-transparent',
  white: 'border-white border-t-transparent',
  current: 'border-current border-t-transparent',
};

/**
 * A unified loading spinner component for consistent loading states across the app.
 * 
 * @example
 * // Basic usage
 * <LoadingSpinner />
 * 
 * @example
 * // With size and variant
 * <LoadingSpinner size="lg" variant="primary" />
 * 
 * @example
 * // Full screen overlay
 * <LoadingSpinner fullScreen overlay label="Loading..." />
 * 
 * @example
 * // Inline with label
 * <LoadingSpinner size="sm" label="Saving..." />
 */
export function LoadingSpinner({
  size = 'md',
  variant = 'primary',
  className = '',
  label,
  fullScreen = false,
  overlay = false,
}: LoadingSpinnerProps) {
  const spinnerElement = useMemo(() => (
    <div
      role="status"
      aria-label={label || 'Loading'}
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <div
        className={`animate-spin rounded-full border-2 ${sizeClasses[size]} ${variantClasses[variant]}`}
        aria-hidden="true"
      />
      {label && (
        <span className={`text-sm ${variant === 'white' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
          {label}
        </span>
      )}
      <span className="sr-only">{label || 'Loading'}</span>
    </div>
  ), [size, variant, className, label]);

  if (fullScreen) {
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center ${
          overlay ? 'bg-black/50 backdrop-blur-sm' : 'bg-gray-50 dark:bg-gray-900'
        }`}
      >
        {spinnerElement}
      </div>
    );
  }

  return spinnerElement;
}

/**
 * A page-level loading component for use while data is being fetched.
 * Centers the spinner in the available space.
 */
export function PageLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <LoadingSpinner size="lg" label={label} />
    </div>
  );
}

/**
 * An inline loading indicator for buttons or small areas.
 */
export function InlineLoader({ 
  size = 'sm', 
  variant = 'current',
  className = '',
}: Pick<LoadingSpinnerProps, 'size' | 'variant' | 'className'>) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin rounded-full border-2 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    />
  );
}

/**
 * A card-level skeleton loader placeholder.
 */
export function CardLoader() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-center h-32">
        <LoadingSpinner size="lg" />
      </div>
    </div>
  );
}