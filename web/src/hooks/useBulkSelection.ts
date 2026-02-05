import { useState, useCallback } from 'react';

interface UseBulkSelectionOptions<T> {
  /** Function to get the ID of an item */
  getId: (item: T) => string;
  /** All items that can be selected */
  items: T[];
}

interface UseBulkSelectionReturn {
  /** Set of currently selected IDs */
  selectedIds: Set<string>;
  /** Whether any items are selected */
  hasSelection: boolean;
  /** Number of selected items */
  selectionCount: number;
  /** Whether all items are selected */
  isAllSelected: boolean;
  /** Check if a specific item is selected */
  isSelected: (id: string) => boolean;
  /** Toggle selection of a specific item */
  toggleSelection: (id: string) => void;
  /** Select all items */
  selectAll: () => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Toggle select all */
  toggleSelectAll: () => void;
  /** Select multiple items by ID */
  selectMultiple: (ids: string[]) => void;
}

export function useBulkSelection<T>({
  getId,
  items,
}: UseBulkSelectionOptions<T>): UseBulkSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const hasSelection = selectedIds.size > 0;
  const selectionCount = selectedIds.size;
  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(getId)));
  }, [items, getId]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      clearSelection();
    } else {
      selectAll();
    }
  }, [isAllSelected, clearSelection, selectAll]);

  const selectMultiple = useCallback((ids: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
  }, []);

  return {
    selectedIds,
    hasSelection,
    selectionCount,
    isAllSelected,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    toggleSelectAll,
    selectMultiple,
  };
}
