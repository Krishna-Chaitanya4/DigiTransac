import { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useNavigate, useLocation } from 'react-router-dom';

interface PageErrorFallbackProps {
  error?: Error | null;
  onReset: () => void;
}

/**
 * Fallback UI for page-level errors with navigation support
 */
function PageErrorFallback({ error, onReset }: PageErrorFallbackProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleGoBack = () => {
    // Try to go back, or go to dashboard if no history
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  const handleRefresh = () => {
    // Reset the error boundary and re-render
    onReset();
    // Force a re-render by navigating to the same page
    navigate(location.pathname, { replace: true });
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center" role="alert">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg 
            className="w-8 h-8 text-red-600 dark:text-red-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth={1.5} 
            stroke="currentColor"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" 
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Page Error
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          We couldn't load this page. The error has been reported and we're working on it.
        </p>
        <div className="space-y-3">
          <button
            onClick={handleRefresh}
            className="w-full px-4 py-2 bg-gradient-to-br from-indigo-600 to-indigo-700 dark:from-indigo-900 dark:to-indigo-950 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 dark:hover:from-indigo-800 dark:hover:to-indigo-900 transition-colors font-medium"
          >
            Refresh Page
          </button>
          <button
            onClick={handleGoBack}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Go Back
          </button>
        </div>
        {import.meta.env.DEV && error && (
          <details className="mt-6 text-left">
            <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
              Error Details (Dev Only)
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs text-red-600 dark:text-red-400 overflow-auto max-h-40">
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

interface PageErrorBoundaryProps {
  children: ReactNode;
  /** Name of the page for error tracking */
  pageName: string;
}

/**
 * Error boundary specifically designed for page-level components.
 * Shows a user-friendly error with navigation options.
 */
export function PageErrorBoundary({ children, pageName }: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary
      name={`Page:${pageName}`}
      fallback={
        <PageErrorFallbackWrapper />
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Wrapper to provide reset functionality to the fallback
 * This is needed because we can't directly access the ErrorBoundary's reset from the fallback
 */
function PageErrorFallbackWrapper() {
  // Note: In a real implementation, we'd need to use a ref or context
  // to properly reset the error boundary. For now, reload the page.
  const handleReset = () => {
    window.location.reload();
  };

  return <PageErrorFallback onReset={handleReset} />;
}

export default PageErrorBoundary;
