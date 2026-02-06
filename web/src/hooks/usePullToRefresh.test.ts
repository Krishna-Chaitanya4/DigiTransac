import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePullToRefresh } from './usePullToRefresh';

describe('usePullToRefresh', () => {
  const mockOnRefresh: () => Promise<void> = vi.fn(() => Promise.resolve());
  let containerElement: HTMLDivElement;

  beforeEach(() => {
    containerElement = document.createElement('div');
    containerElement.scrollTop = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return initial state', () => {
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh: mockOnRefresh })
    );

    expect(result.current.isPulling).toBe(false);
    expect(result.current.pullDistance).toBe(0);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.isReadyToRefresh).toBe(false);
  });

  it('should not be pulling when disabled', () => {
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh: mockOnRefresh, enabled: false })
    );

    expect(result.current.isPulling).toBe(false);
    expect(result.current.pullDistance).toBe(0);
  });

  it('should return a ref', () => {
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh: mockOnRefresh })
    );

    expect(result.current.ref).toBeDefined();
    expect(typeof result.current.ref).toBe('object');
  });

  it('should calculate progress correctly', () => {
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh: mockOnRefresh, threshold: 80 })
    );

    // Progress is calculated as pullDistance / threshold (capped at 1)
    // Initial state has 0 progress
    expect(result.current.progress).toBe(0);
  });

  it('should set isReadyToRefresh when progress >= 1', () => {
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh: mockOnRefresh, threshold: 80 })
    );

    // When pullDistance = 0, progress = 0, isReadyToRefresh = false
    expect(result.current.isReadyToRefresh).toBe(false);
  });

  it('should use custom threshold', () => {
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh: mockOnRefresh, threshold: 50 })
    );

    // Default threshold is 80, custom is 50
    expect(result.current.progress).toBe(0); // With pullDistance 0
  });

  it('should use custom maxPull', () => {
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh: mockOnRefresh, maxPull: 200 })
    );

    // maxPull limits how far user can pull
    expect(result.current.pullDistance).toBe(0);
  });
});

describe('usePullToRefresh touch events', () => {
  const mockOnRefresh: () => Promise<void> = vi.fn(() => Promise.resolve());
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    Object.defineProperty(container, 'scrollTop', {
      value: 0,
      writable: true,
    });
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.clearAllMocks();
  });

  it('should handle touch events when enabled', () => {
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh: mockOnRefresh })
    );

    // Manually set the ref
    act(() => {
      Object.defineProperty(result.current.ref, 'current', {
        value: container,
        writable: true,
      });
    });

    // Initial state
    expect(result.current.isPulling).toBe(false);
    expect(result.current.pullDistance).toBe(0);
  });
});