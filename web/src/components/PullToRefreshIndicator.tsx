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
 * Branded visual indicator component for pull-to-refresh.
 * Shows a DigiTransac-themed spinner with progress ring and status text.
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

  const scale = 0.6 + (progress * 0.4); // Scale from 0.6 to 1
  const opacity = Math.min(progress * 1.5, 1); // Fade in quickly

  // SVG progress ring params
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress * circumference);

  const statusText = isRefreshing
    ? 'Refreshing…'
    : isReadyToRefresh
      ? 'Release to refresh'
      : 'Pull to refresh';

  return (
    <div
      className="absolute left-0 right-0 flex flex-col items-center justify-center pointer-events-none z-50"
      style={{
        top: 0,
        transform: `translateY(${Math.max(pullDistance - 48, -10)}px)`,
        opacity,
        transition: pullDistance === 0 ? 'transform 0.3s ease-out, opacity 0.3s ease-out' : 'opacity 0.1s',
      }}
    >
      <div
        className="relative flex items-center justify-center"
        style={{
          transform: `scale(${scale})`,
          transition: pullDistance === 0 ? 'transform 0.3s ease-out' : 'transform 0.1s ease-out',
        }}
      >
        {/* Progress ring */}
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          className={isRefreshing ? 'animate-spin' : ''}
          style={{
            animationDuration: isRefreshing ? '1.2s' : undefined,
          }}
        >
          {/* Background ring */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress arc */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            className={isReadyToRefresh || isRefreshing
              ? 'text-indigo-500 dark:text-indigo-400'
              : 'text-indigo-400 dark:text-indigo-500'
            }
            stroke="currentColor"
            strokeDasharray={circumference}
            strokeDashoffset={isRefreshing ? circumference * 0.25 : strokeDashoffset}
            style={{
              transformOrigin: 'center',
              transform: 'rotate(-90deg)',
              transition: isRefreshing ? undefined : 'stroke-dashoffset 0.1s ease-out',
            }}
          />
        </svg>

        {/* Center icon — branded arrows */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className={`w-5 h-5 ${
              isReadyToRefresh || isRefreshing
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            style={{
              transform: isRefreshing
                ? undefined
                : `rotate(${isReadyToRefresh ? 180 : progress * 180}deg)`,
              transition: 'transform 0.15s ease-out, color 0.2s',
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
            />
          </svg>
        </div>
      </div>

      {/* Status text */}
      <span
        className={`text-[11px] font-medium mt-1 transition-colors duration-200 ${
          isReadyToRefresh || isRefreshing
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        {statusText}
      </span>
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
        paddingTop: isRefreshing ? 60 : 0,
        transition: 'padding-top 0.3s ease-out',
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
          transition: pullDistance === 0 ? 'transform 0.3s ease-out' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}