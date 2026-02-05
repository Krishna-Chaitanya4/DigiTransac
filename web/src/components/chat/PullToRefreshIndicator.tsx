import { memo } from 'react';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

/**
 * PullToRefreshIndicator - Visual feedback for pull-to-refresh gesture
 * Shows loading spinner when refreshing, arrow when pulling
 */
export const PullToRefreshIndicator = memo(function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  if (pullDistance <= 0 && !isRefreshing) return null;

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 180;
  const scale = 0.5 + progress * 0.5;

  return (
    <div 
      className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-20"
      style={{ 
        transform: `translateY(${Math.min(pullDistance, threshold * 1.2)}px)`,
        transition: isRefreshing ? 'transform 0.2s ease' : 'none',
      }}
    >
      <div
        className={`
          w-10 h-10 rounded-full bg-white dark:bg-gray-700 
          shadow-lg border border-gray-200 dark:border-gray-600
          flex items-center justify-center
          transition-transform duration-200
        `}
        style={{ transform: `scale(${scale})` }}
      >
        {isRefreshing ? (
          /* Loading spinner */
          <svg
            className="w-5 h-5 text-blue-500 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          /* Arrow with rotation based on pull progress */
          <svg
            className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        )}
      </div>
    </div>
  );
});

export default PullToRefreshIndicator;