import { useState, useCallback } from 'react';

/**
 * Custom hook for managing modal state with error handling.
 * Reduces boilerplate for common modal patterns.
 * 
 * @template T - The type of the item being edited/deleted in the modal
 * @returns Modal state and handlers
 */
export function useModalState<T = unknown>() {
  const [isOpen, setIsOpen] = useState(false);
  const [item, setItem] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((itemToEdit?: T) => {
    setItem(itemToEdit ?? null);
    setError(null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setIsOpen(false);
    setItem(null);
    setError(null);
  }, []);

  return {
    isOpen,
    item,
    error,
    setError,
    open,
    close,
    reset,
  };
}

/**
 * Custom hook for managing delete confirmation modal state.
 * Includes loading state for async count fetching.
 * 
 * @template T - The type of the item being deleted
 */
export function useDeleteModalState<T = unknown>() {
  const [isOpen, setIsOpen] = useState(false);
  const [item, setItem] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);

  const open = useCallback((itemToDelete: T) => {
    setItem(itemToDelete);
    setError(null);
    setIsLoadingCount(true);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setError(null);
    setIsLoadingCount(false);
  }, []);

  const reset = useCallback(() => {
    setIsOpen(false);
    setItem(null);
    setError(null);
    setIsLoadingCount(false);
  }, []);

  const setCountLoaded = useCallback(() => {
    setIsLoadingCount(false);
  }, []);

  return {
    isOpen,
    item,
    error,
    isLoadingCount,
    setError,
    setCountLoaded,
    open,
    close,
    reset,
  };
}
