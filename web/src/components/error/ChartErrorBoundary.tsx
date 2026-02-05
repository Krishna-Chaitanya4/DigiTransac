import { ReactNode } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';

interface ChartErrorFallbackProps {
  onRetry: () => void;
  chartType?: string;
}

function ChartErrorFallback({ onRetry, chartType = 'chart' }: ChartErrorFallbackProps) {
  return (
    <div className="h-full min-h-[200px] flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-6">
      <svg 
        className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-3"
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={1.5} 
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" 
        />
      </svg>
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-3">
        Unable to render {chartType}
      </p>
      <button
        onClick={onRetry}
        className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

interface ChartErrorBoundaryProps {
  children: ReactNode;
  chartType?: string;
  onRetry?: () => void;
}

export function ChartErrorBoundary({ children, chartType, onRetry }: ChartErrorBoundaryProps) {
  const handleReset = () => {
    onRetry?.();
  };

  return (
    <ErrorBoundary
      name={`Chart-${chartType || 'Unknown'}`}
      fallback={<ChartErrorFallback onRetry={handleReset} chartType={chartType} />}
    >
      {children}
    </ErrorBoundary>
  );
}

export default ChartErrorBoundary;