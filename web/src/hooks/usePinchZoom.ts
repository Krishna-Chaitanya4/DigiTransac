import { useState, useRef, useCallback } from 'react';

interface PinchZoomState {
  /** Current scale factor */
  scale: number;
  /** Whether a pinch gesture is in progress */
  isPinching: boolean;
  /** Origin point of the pinch (center between two fingers) */
  origin: { x: number; y: number } | null;
}

interface UsePinchZoomOptions {
  /** Minimum scale (default: 1) */
  minScale?: number;
  /** Maximum scale (default: 4) */
  maxScale?: number;
  /** Initial scale (default: 1) */
  initialScale?: number;
  /** Callback when scale changes */
  onScaleChange?: (scale: number) => void;
  /** Whether pinch zoom is disabled */
  disabled?: boolean;
}

interface UsePinchZoomReturn {
  /** Current pinch zoom state */
  state: PinchZoomState;
  /** Touch event handlers to apply to the element */
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  /** Style object to apply for the zoom effect */
  style: React.CSSProperties;
  /** Reset zoom to initial scale */
  reset: () => void;
  /** Set specific scale */
  setScale: (scale: number) => void;
}

/**
 * Calculate distance between two touch points
 */
function getDistance(touch1: React.Touch, touch2: React.Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get center point between two touches
 */
function getCenter(touch1: React.Touch, touch2: React.Touch): { x: number; y: number } {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
}

/**
 * Hook for pinch-to-zoom functionality
 * Provides smooth, native-feeling pinch zoom experience
 */
export function usePinchZoom({
  minScale = 1,
  maxScale = 4,
  initialScale = 1,
  onScaleChange,
  disabled = false,
}: UsePinchZoomOptions = {}): UsePinchZoomReturn {
  const [state, setState] = useState<PinchZoomState>({
    scale: initialScale,
    isPinching: false,
    origin: null,
  });

  const initialDistance = useRef(0);
  const lastScale = useRef(initialScale);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      
      // Need exactly 2 touches for pinch
      if (e.touches.length === 2) {
        initialDistance.current = getDistance(e.touches[0], e.touches[1]);
        lastScale.current = state.scale;
        
        const center = getCenter(e.touches[0], e.touches[1]);
        
        setState(prev => ({
          ...prev,
          isPinching: true,
          origin: center,
        }));
        
        // Prevent default to avoid page zoom
        e.preventDefault();
      }
    },
    [disabled, state.scale]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!state.isPinching || disabled || e.touches.length !== 2) return;

      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scaleFactor = currentDistance / initialDistance.current;
      let newScale = lastScale.current * scaleFactor;

      // Clamp scale
      newScale = Math.max(minScale, Math.min(maxScale, newScale));

      const center = getCenter(e.touches[0], e.touches[1]);

      setState(prev => ({
        ...prev,
        scale: newScale,
        origin: center,
      }));

      onScaleChange?.(newScale);
      
      // Prevent default to avoid page zoom
      e.preventDefault();
    },
    [state.isPinching, disabled, minScale, maxScale, onScaleChange]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length < 2) {
        setState(prev => ({
          ...prev,
          isPinching: false,
        }));
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({
      scale: initialScale,
      isPinching: false,
      origin: null,
    });
    lastScale.current = initialScale;
    onScaleChange?.(initialScale);
  }, [initialScale, onScaleChange]);

  const setScale = useCallback(
    (newScale: number) => {
      const clampedScale = Math.max(minScale, Math.min(maxScale, newScale));
      setState(prev => ({
        ...prev,
        scale: clampedScale,
      }));
      lastScale.current = clampedScale;
      onScaleChange?.(clampedScale);
    },
    [minScale, maxScale, onScaleChange]
  );

  const style: React.CSSProperties = {
    transform: `scale(${state.scale})`,
    transformOrigin: state.origin
      ? `${state.origin.x}px ${state.origin.y}px`
      : 'center center',
    transition: state.isPinching ? 'none' : 'transform 0.2s ease-out',
    touchAction: 'none',
  };

  return {
    state,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    style,
    reset,
    setScale,
  };
}

export default usePinchZoom;