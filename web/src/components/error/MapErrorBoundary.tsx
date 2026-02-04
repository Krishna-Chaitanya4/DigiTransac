import { ReactNode } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';
import { Link } from 'react-router-dom';

interface MapErrorFallbackProps {
  onRetry: () => void;
}

function MapErrorFallback({ onRetry }: MapErrorFallbackProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg p-8">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
        <svg 
          className="w-8 h-8 text-red-500 dark:text-red-400"
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" 
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Map couldn't be loaded
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4 max-w-xs">
        There was a problem loading the map. This might be due to a connection issue or a browser extension conflict.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Try Again
        </button>
        <Link
          to="/transactions"
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
        >
          View List Instead
        </Link>
      </div>
    </div>
  );
}

interface MapErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
}

export function MapErrorBoundary({ children, onRetry }: MapErrorBoundaryProps) {
  const handleReset = () => {
    onRetry?.();
    // Force a re-render by setting state if needed
  };

  return (
    <ErrorBoundary
      name="SpendingMap"
      fallback={<MapErrorFallback onRetry={handleReset} />}
    >
      {children}
    </ErrorBoundary>
  );
}

export default MapErrorBoundary;