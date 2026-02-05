import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkSelection } from './useBulkSelection';

interface TestItem {
  id: string;
  name: string;
}

const mockItems: TestItem[] = [
  { id: '1', name: 'Item 1' },
  { id: '2', name: 'Item 2' },
  { id: '3', name: 'Item 3' },
];

const getId = (item: TestItem) => item.id;

describe('useBulkSelection', () => {
  it('should initialize with empty selection', () => {
    const { result } = renderHook(() => 
      useBulkSelection({ items: mockItems, getId })
    );
    
    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.hasSelection).toBe(false);
    expect(result.current.selectionCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
  });

  it('should toggle selection of an item', () => {
    const { result } = renderHook(() => 
      useBulkSelection({ items: mockItems, getId })
    );
    
    act(() => {
      result.current.toggleSelection('1');
    });
    
    expect(result.current.isSelected('1')).toBe(true);
    expect(result.current.isSelected('2')).toBe(false);
    expect(result.current.selectionCount).toBe(1);
    expect(result.current.hasSelection).toBe(true);
  });

  it('should toggle selection off when called twice', () => {
    const { result } = renderHook(() => 
      useBulkSelection({ items: mockItems, getId })
    );
    
    act(() => {
      result.current.toggleSelection('1');
    });
    
    expect(result.current.isSelected('1')).toBe(true);
    
    act(() => {
      result.current.toggleSelection('1');
    });
    
    expect(result.current.isSelected('1')).toBe(false);
    expect(result.current.hasSelection).toBe(false);
  });

  it('should select all items', () => {
    const { result } = renderHook(() => 
      useBulkSelection({ items: mockItems, getId })
    );
    
    act(() => {
      result.current.selectAll();
    });
    
    expect(result.current.isSelected('1')).toBe(true);
    expect(result.current.isSelected('2')).toBe(true);
    expect(result.current.isSelected('3')).toBe(true);
    expect(result.current.selectionCount).toBe(3);
    expect(result.current.isAllSelected).toBe(true);
  });

  it('should clear all selections', () => {
    const { result } = renderHook(() => 
      useBulkSelection({ items: mockItems, getId })
    );
    
    act(() => {
      result.current.selectAll();
    });
    
    expect(result.current.selectionCount).toBe(3);
    
    act(() => {
      result.current.clearSelection();
    });
    
    expect(result.current.selectionCount).toBe(0);
    expect(result.current.hasSelection).toBe(false);
    expect(result.current.isAllSelected).toBe(false);
  });

  it('should toggle select all', () => {
    const { result } = renderHook(() => 
      useBulkSelection({ items: mockItems, getId })
    );
    
    // Toggle on
    act(() => {
      result.current.toggleSelectAll();
    });
    
    expect(result.current.isAllSelected).toBe(true);
    expect(result.current.selectionCount).toBe(3);
    
    // Toggle off
    act(() => {
      result.current.toggleSelectAll();
    });
    
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.selectionCount).toBe(0);
  });

  it('should select multiple items', () => {
    const { result } = renderHook(() => 
      useBulkSelection({ items: mockItems, getId })
    );
    
    act(() => {
      result.current.selectMultiple(['1', '3']);
    });
    
    expect(result.current.isSelected('1')).toBe(true);
    expect(result.current.isSelected('2')).toBe(false);
    expect(result.current.isSelected('3')).toBe(true);
    expect(result.current.selectionCount).toBe(2);
  });

  it('should add to existing selection with selectMultiple', () => {
    const { result } = renderHook(() => 
      useBulkSelection({ items: mockItems, getId })
    );
    
    act(() => {
      result.current.toggleSelection('1');
    });
    
    expect(result.current.selectionCount).toBe(1);
    
    act(() => {
      result.current.selectMultiple(['2', '3']);
    });
    
    expect(result.current.selectionCount).toBe(3);
    expect(result.current.isSelected('1')).toBe(true);
    expect(result.current.isSelected('2')).toBe(true);
    expect(result.current.isSelected('3')).toBe(true);
  });

  it('should handle empty items array', () => {
    const { result } = renderHook(() => 
      useBulkSelection({ items: [], getId })
    );
    
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.hasSelection).toBe(false);
    
    act(() => {
      result.current.selectAll();
    });
    
    // With no items, selecting all results in nothing selected
    expect(result.current.selectionCount).toBe(0);
  });

  it('should update when items change', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useBulkSelection({ items, getId }),
      { initialProps: { items: mockItems } }
    );
    
    act(() => {
      result.current.selectAll();
    });
    
    expect(result.current.isAllSelected).toBe(true);
    expect(result.current.selectionCount).toBe(3);
    
    // Add a new item
    const newItems = [...mockItems, { id: '4', name: 'Item 4' }];
    rerender({ items: newItems });
    
    // Now we should have 3 selected out of 4, so not all selected
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.selectionCount).toBe(3);
  });
});