import { ReactNode, useState, useCallback } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';

// Widget Error Fallback Component
export interface WidgetErrorFallbackProps {
  widgetName: string;
  onRetry: () => void;
}

export function WidgetErrorFallback({ widgetName, onRetry }: WidgetErrorFallbackProps) {
  return (
    <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
      <svg
        className="w-12 h-12 mx-auto mb-3 text-red-400 dark:text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
        Failed to load {widgetName}
      </h3>
      <p className="text-sm text-red-600 dark:text-red-400 mb-3">
        Something went wrong while loading this widget.
      </p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

// Widget wrapper with error boundary
export interface WidgetWithErrorBoundaryProps {
  name: string;
  children: ReactNode;
}

export function WidgetWithErrorBoundary({ name, children }: WidgetWithErrorBoundaryProps) {
  const [key, setKey] = useState(0);
  
  const handleRetry = useCallback(() => {
    setKey(k => k + 1);
  }, []);
  
  return (
    <ErrorBoundary
      key={key}
      name={`InsightsWidget-${name}`}
      fallback={<WidgetErrorFallback widgetName={name} onRetry={handleRetry} />}
    >
      {children}
    </ErrorBoundary>
  );
}