interface PullToRefreshIndicatorProps {
  /** Pull distance in pixels */
  pullDistance: number;
  /** Whether refresh has been triggered */
  isRefreshing: boolean;
  /** Progress from 0 to 1 (1 means ready to refresh) */
  progress: number;
  /** Whether the threshold has been reached */
  isReadyToRefresh: boolean;
}

/**
 * Visual indicator component for pull-to-refresh.
 * Shows a spinner that fills/rotates as user pulls down.
 */
export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  progress,
  isReadyToRefresh,
}: PullToRefreshIndicatorProps) {
  if (pullDistance === 0 && !isRefreshing) {
    return null;
  }

  const rotation = progress * 360;
  const scale = 0.5 + (progress * 0.5); // Scale from 0.5 to 1

  return (
    <div
      className="absolute left-0 right-0 flex items-center justify-center pointer-events-none z-50 transition-transform duration-100"
      style={{
        top: 0,
        transform: `translateY(${Math.max(pullDistance - 40, 0)}px)`,
      }}
    >
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center
          shadow-lg transition-colors duration-200
          ${isReadyToRefresh || isRefreshing
            ? 'bg-primary-500 text-white'
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }
        `}
        style={{
          transform: `scale(${scale})`,
        }}
      >
        <svg
          className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          style={{
            transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
            transition: isRefreshing ? undefined : 'transform 0.1s ease-out',
          }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * Wrapper component that provides pull-to-refresh functionality.
 * Use this to wrap scrollable content.
 */
interface PullToRefreshContainerProps {
  children: React.ReactNode;
  pullDistance: number;
  isRefreshing: boolean;
  progress: number;
  isReadyToRefresh: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  className?: string;
}

export function PullToRefreshContainer({
  children,
  pullDistance,
  isRefreshing,
  progress,
  isReadyToRefresh,
  containerRef,
  className = '',
}: PullToRefreshContainerProps) {
  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      style={{
        // Add padding when pulling/refreshing to make room for indicator
        paddingTop: isRefreshing ? 50 : 0,
        transition: 'padding-top 0.2s ease-out',
      }}
    >
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        progress={progress}
        isReadyToRefresh={isReadyToRefresh}
      />
      <div
        style={{
          transform: pullDistance > 0 && !isRefreshing ? `translateY(${pullDistance * 0.3}px)` : undefined,
          transition: pullDistance === 0 ? 'transform 0.2s ease-out' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}