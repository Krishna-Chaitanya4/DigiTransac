import React, { useState, useRef, useCallback, TouchEvent, ReactNode } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  threshold?: number; // Pull distance needed to trigger refresh (default: 80px)
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  threshold = 80,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only start pull if we're at the top of the scroll
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - startY.current;

      // Only pull down
      if (distance > 0) {
        // Add resistance to the pull
        const resistedDistance = Math.min(distance * 0.5, threshold * 1.5);
        setPullDistance(resistedDistance);
      }
    },
    [isPulling, isRefreshing, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh error:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

  const pullProgress = Math.min(pullDistance / threshold, 1);
  const iconRotation = pullProgress * 360;

  return (
    <Box
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      sx={{
        overflow: 'auto',
        height: '100%',
        position: 'relative',
      }}
    >
      {/* Pull indicator */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: `translate(-50%, ${pullDistance - 60}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: '50%',
          bgcolor: 'background.paper',
          boxShadow: 2,
          opacity: Math.min(pullDistance / 30, 1),
        }}
      >
        {isRefreshing ? (
          <CircularProgress size={24} sx={{ color: 'primary.main' }} />
        ) : (
          <RefreshIcon
            sx={{
              transform: `rotate(${iconRotation}deg)`,
              transition: 'transform 0.1s',
              color: pullProgress >= 1 ? 'primary.main' : 'text.secondary',
            }}
          />
        )}
      </Box>

      {/* Content */}
      <Box
        sx={{
          transform: `translateY(${isPulling || isRefreshing ? pullDistance : 0}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default PullToRefresh;
