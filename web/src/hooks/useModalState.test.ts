import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalState, useDeleteModalState } from './useModalState';

describe('useModalState', () => {
  it('should initialize with modal closed', () => {
    const { result } = renderHook(() => useModalState());
    
    expect(result.current.isOpen).toBe(false);
    expect(result.current.item).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should open modal without item', () => {
    const { result } = renderHook(() => useModalState());
    
    act(() => {
      result.current.open();
    });
    
    expect(result.current.isOpen).toBe(true);
    expect(result.current.item).toBeNull();
  });

  it('should open modal with item', () => {
    const { result } = renderHook(() => useModalState<{ id: string; name: string }>());
    const testItem = { id: '1', name: 'Test Item' };
    
    act(() => {
      result.current.open(testItem);
    });
    
    expect(result.current.isOpen).toBe(true);
    expect(result.current.item).toEqual(testItem);
  });

  it('should close modal and clear error', () => {
    const { result } = renderHook(() => useModalState());
    
    act(() => {
      result.current.open();
      result.current.setError('Some error');
    });
    
    expect(result.current.isOpen).toBe(true);
    expect(result.current.error).toBe('Some error');
    
    act(() => {
      result.current.close();
    });
    
    expect(result.current.isOpen).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should reset all state', () => {
    const { result } = renderHook(() => useModalState<{ id: string }>());
    
    act(() => {
      result.current.open({ id: '1' });
      result.current.setError('Error');
    });
    
    expect(result.current.isOpen).toBe(true);
    expect(result.current.item).toEqual({ id: '1' });
    expect(result.current.error).toBe('Error');
    
    act(() => {
      result.current.reset();
    });
    
    expect(result.current.isOpen).toBe(false);
    expect(result.current.item).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should clear error when opening', () => {
    const { result } = renderHook(() => useModalState());
    
    act(() => {
      result.current.open();
      result.current.setError('Previous error');
      result.current.close();
    });
    
    // Error was cleared on close, but let's verify opening also clears
    act(() => {
      result.current.setError('Another error');
    });
    
    act(() => {
      result.current.open();
    });
    
    expect(result.current.error).toBeNull();
  });
});

describe('useDeleteModalState', () => {
  it('should initialize with modal closed', () => {
    const { result } = renderHook(() => useDeleteModalState());
    
    expect(result.current.isOpen).toBe(false);
    expect(result.current.item).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoadingCount).toBe(false);
  });

  it('should open with loading state', () => {
    const { result } = renderHook(() => useDeleteModalState<{ id: string }>());
    const item = { id: '1' };
    
    act(() => {
      result.current.open(item);
    });
    
    expect(result.current.isOpen).toBe(true);
    expect(result.current.item).toEqual(item);
    expect(result.current.isLoadingCount).toBe(true);
  });

  it('should set count loaded', () => {
    const { result } = renderHook(() => useDeleteModalState<{ id: string }>());
    
    act(() => {
      result.current.open({ id: '1' });
    });
    
    expect(result.current.isLoadingCount).toBe(true);
    
    act(() => {
      result.current.setCountLoaded();
    });
    
    expect(result.current.isLoadingCount).toBe(false);
  });

  it('should reset loading state on close', () => {
    const { result } = renderHook(() => useDeleteModalState<{ id: string }>());
    
    act(() => {
      result.current.open({ id: '1' });
    });
    
    expect(result.current.isLoadingCount).toBe(true);
    
    act(() => {
      result.current.close();
    });
    
    expect(result.current.isLoadingCount).toBe(false);
  });

  it('should fully reset state', () => {
    const { result } = renderHook(() => useDeleteModalState<{ id: string }>());
    
    act(() => {
      result.current.open({ id: '1' });
      result.current.setError('Error');
    });
    
    act(() => {
      result.current.reset();
    });
    
    expect(result.current.isOpen).toBe(false);
    expect(result.current.item).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoadingCount).toBe(false);
  });
});