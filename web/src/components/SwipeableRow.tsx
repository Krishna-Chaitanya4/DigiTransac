import { useRef, useState, useCallback, useEffect } from 'react';
import { useHaptics } from '../hooks/useHaptics';

interface SwipeableRowProps {
  children: React.ReactNode;
  /** Called when user swipes right past threshold */
  onSwipeRight?: () => void;
  /** Called when user swipes left past threshold */
  onSwipeLeft?: () => void;
  /** Content to show when swiping right */
  rightContent?: React.ReactNode;
  /** Content to show when swiping left */
  leftContent?: React.ReactNode;
  /** Background color when swiping right */
  rightBgColor?: string;
  /** Background color when swiping left */
  leftBgColor?: string;
  /** Minimum swipe distance to trigger action (default: 80) */
  threshold?: number;
  /** Whether swipe actions are disabled */
  disabled?: boolean;
}

export function SwipeableRow({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightContent,
  leftContent,
  rightBgColor = 'bg-green-500',
  leftBgColor = 'bg-red-500',
  threshold = 80,
  disabled = false,
}: SwipeableRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const haptics = useHaptics();
  const hasVibratedThreshold = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startX === null || !isDragging || disabled) return;
    
    const diff = e.touches[0].clientX - startX;
    
    // Limit swipe distance and add resistance
    const maxSwipe = 120;
    const resistance = 0.5;
    let clampedDiff = diff;
    
    if (Math.abs(diff) > maxSwipe) {
      clampedDiff = Math.sign(diff) * (maxSwipe + (Math.abs(diff) - maxSwipe) * resistance);
    }
    
    // Only allow swipe in enabled directions
    if (diff > 0 && !onSwipeRight) return;
    if (diff < 0 && !onSwipeLeft) return;

    // Haptic feedback when crossing the threshold
    if (Math.abs(clampedDiff) >= threshold && !hasVibratedThreshold.current) {
      haptics.medium();
      hasVibratedThreshold.current = true;
    } else if (Math.abs(clampedDiff) < threshold) {
      hasVibratedThreshold.current = false;
    }
    
    setCurrentX(clampedDiff);
  }, [startX, isDragging, disabled, onSwipeRight, onSwipeLeft, threshold, haptics]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    
    if (currentX > threshold && onSwipeRight) {
      haptics.heavy();
      onSwipeRight();
    } else if (currentX < -threshold && onSwipeLeft) {
      haptics.heavy();
      onSwipeLeft();
    }
    
    // Reset
    hasVibratedThreshold.current = false;
    setStartX(null);
    setCurrentX(0);
    setIsDragging(false);
  }, [currentX, threshold, isDragging, onSwipeRight, onSwipeLeft, haptics]);

  // Handle touch cancel
  const handleTouchCancel = useCallback(() => {
    setStartX(null);
    setCurrentX(0);
    setIsDragging(false);
  }, []);

  // Determine which background to show
  const showRightBg = currentX > 0;
  const showLeftBg = currentX < 0;
  const progress = Math.min(Math.abs(currentX) / threshold, 1);

  // Prevent scrolling while swiping
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isDragging) return;

    const preventScroll = (e: TouchEvent) => {
      if (Math.abs(currentX) > 10) {
        e.preventDefault();
      }
    };

    container.addEventListener('touchmove', preventScroll, { passive: false });
    return () => container.removeEventListener('touchmove', preventScroll);
  }, [isDragging, currentX]);

  if (disabled || (!onSwipeRight && !onSwipeLeft)) {
    return <>{children}</>;
  }

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden"
    >
      {/* Background layers */}
      {showRightBg && rightContent && (
        <div 
          className={`absolute inset-y-0 left-0 ${rightBgColor} flex items-center px-4 transition-opacity`}
          style={{ 
            width: Math.abs(currentX) + 20,
            opacity: progress,
          }}
        >
          <div 
            className="text-white"
            style={{ 
              transform: `scale(${0.8 + progress * 0.2})`,
              opacity: progress,
            }}
          >
            {rightContent}
          </div>
        </div>
      )}
      
      {showLeftBg && leftContent && (
        <div 
          className={`absolute inset-y-0 right-0 ${leftBgColor} flex items-center justify-end px-4 transition-opacity`}
          style={{ 
            width: Math.abs(currentX) + 20,
            opacity: progress,
          }}
        >
          <div 
            className="text-white"
            style={{ 
              transform: `scale(${0.8 + progress * 0.2})`,
              opacity: progress,
            }}
          >
            {leftContent}
          </div>
        </div>
      )}
      
      {/* Main content */}
      <div
        className="relative bg-inherit"
        style={{
          transform: `translateX(${currentX}px)`,
          transition: isDragging ? 'none' : 'transform 0.2s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {children}
      </div>
    </div>
  );
}

// Swipe action content components
export function SwipeActionIcon({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xl">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}
