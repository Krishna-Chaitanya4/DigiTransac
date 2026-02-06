import { ReactNode } from 'react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from './PullToRefreshIndicator';

interface PullToRefreshContainerProps {
  /** Callback when refresh is triggered */
  onRefresh: () => Promise<void>;
  /** Content to wrap */
  children: ReactNode;
  /** Optional className for the container */
  className?: string;
  /** Disable pull-to-refresh */
  disabled?: boolean;
  /** Custom threshold in pixels (default: 80) */
  threshold?: number;
  /** Maximum pull distance in pixels (default: 150) */
  maxPull?: number;
}

/**
 * A container that adds pull-to-refresh functionality for mobile users.
 * Wrap your scrollable content with this component.
 * 
 * @example
 * ```tsx
 * <PullToRefreshContainer
 *   onRefresh={async () => {
 *     await queryClient.invalidateQueries(['transactions']);
 *   }}
 *   className="flex-1 overflow-y-auto"
 * >
 *   <YourContent />
 * </PullToRefreshContainer>
 * ```
 */
export function PullToRefreshContainer({
  onRefresh,
  children,
  className = '',
  disabled = false,
  threshold = 80,
  maxPull = 150,
}: PullToRefreshContainerProps) {
  const {
    ref,
    pullDistance,
    isRefreshing,
    progress,
    isReadyToRefresh,
  } = usePullToRefresh({
    onRefresh,
    threshold,
    maxPull,
    enabled: !disabled,
  });

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{
        // Push content down when pulling
        transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
        transition: pullDistance === 0 ? 'transform 0.2s ease-out' : undefined,
      }}
    >
      {/* Pull indicator */}
      <PullToRefreshIndicator
        progress={progress}
        isRefreshing={isRefreshing}
        isReadyToRefresh={isReadyToRefresh}
        pullDistance={pullDistance}
      />

      {/* Content */}
      {children}
    </div>
  );
}

export default PullToRefreshContainer;