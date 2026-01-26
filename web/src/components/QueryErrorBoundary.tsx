import { ReactNode } from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary } from './ErrorBoundary';

interface QueryErrorBoundaryProps {
  children: ReactNode;
  /** Optional name for debugging */
  name?: string;
  /** Use inline compact styling */
  inline?: boolean;
}

/**
 * Combines React Query's QueryErrorResetBoundary with our ErrorBoundary.
 * This provides a unified error handling experience for both render errors
 * and query errors with automatic retry capability.
 */
export function QueryErrorBoundary({ children, name, inline }: QueryErrorBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          name={name}
          inline={inline}
          fallback={
            <QueryErrorFallback 
              onReset={reset} 
              inline={inline} 
            />
          }
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

interface QueryErrorFallbackProps {
  onReset: () => void;
  inline?: boolean;
}

function QueryErrorFallback({ onReset, inline }: QueryErrorFallbackProps) {
  if (inline) {
    return (
      <div 
        className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" 
        role="alert"
      >
        <div className="flex items-start gap-3">
          <svg 
            className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth={1.5} 
            stroke="currentColor"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" 
            />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
              Failed to load data
            </h3>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              There was a problem loading this content.
              <button 
                onClick={onReset}
                className="ml-2 underline hover:no-underline font-medium"
              >
                Try again
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[200px] flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg 
            className="w-6 h-6 text-red-600 dark:text-red-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth={1.5} 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" 
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Failed to load data
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          There was a problem loading this content. Please try again.
        </p>
        <button
          onClick={onReset}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
