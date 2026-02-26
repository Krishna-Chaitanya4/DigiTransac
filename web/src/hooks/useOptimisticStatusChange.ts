import { useState, useCallback, useMemo } from 'react';
import { logger } from '../services/logger';
import type { Transaction } from '../types/transactions';
import type { ToastAction } from '../components/Toast';

interface UseOptimisticStatusChangeOptions {
  /** Raw server transactions from React Query (before optimistic overlay). */
  baseTransactions: Transaction[];
  /** Active status filter — determines whether updated items are removed from the list. */
  filterStatus: string | undefined;
  /** Mutation that persists the status change on the server. */
  updateStatusMutation: {
    mutateAsync: (vars: { id: string; status: 'Pending' | 'Confirmed' | 'Declined' }) => Promise<unknown>;
  };
  /** Show an informational toast with an optional action (e.g. Undo). Returns toast ID. */
  showInfo: (message: string, action?: ToastAction) => string;
  /** Dismiss a toast by ID. */
  dismissToast: (id: string) => void;
}

/**
 * Extracts the duplicated optimistic-status-change-with-undo pattern
 * used by `handleUpdateStatus` and `handleDecline` in TransactionsPage.
 *
 * Owns the `optimisticTransactions` overlay state and exposes the effective
 * `transactions` list (optimistic ?? base) so the component can render it.
 */
export function useOptimisticStatusChange({
  baseTransactions,
  filterStatus,
  updateStatusMutation,
  showInfo,
  dismissToast,
}: UseOptimisticStatusChangeOptions) {
  const [optimisticTransactions, setOptimisticTransactions] = useState<Transaction[] | null>(null);
  const [pendingRefreshTrigger, setPendingRefreshTrigger] = useState(0);

  /** The effective list: optimistic overlay when present, otherwise server data. */
  const transactions = useMemo(
    () => optimisticTransactions ?? baseTransactions,
    [optimisticTransactions, baseTransactions],
  );

  /**
   * Shared implementation: optimistically update or remove a transaction,
   * fire the API call, and show an undo toast that reverts on click.
   */
  const changeStatus = useCallback(
    async (
      id: string,
      newStatus: 'Pending' | 'Confirmed' | 'Declined',
      toastMessage: string,
    ) => {
      const target = transactions.find(t => t.id === id);
      if (!target) return;

      const previousStatus = target.status;
      const shouldRemove = filterStatus && filterStatus !== newStatus;
      const originalIndex = transactions.findIndex(t => t.id === id);

      // Optimistic update
      setOptimisticTransactions(prev => {
        const list = prev ?? transactions;
        if (shouldRemove) {
          return list.filter(t => t.id !== id);
        }
        return list.map(t => (t.id === id ? { ...t, status: newStatus } : t));
      });

      // Undo toast
      const toastId = showInfo(toastMessage, {
        label: 'Undo',
        onClick: async () => {
          dismissToast(toastId);
          try {
            await updateStatusMutation.mutateAsync({ id, status: previousStatus });
            setOptimisticTransactions(prev => {
              const list = prev ?? transactions;
              if (shouldRemove) {
                const newList = [...list];
                newList.splice(originalIndex, 0, { ...target, status: previousStatus });
                return newList;
              }
              return list.map(t => (t.id === id ? { ...t, status: previousStatus } : t));
            });
            setPendingRefreshTrigger(c => c + 1);
            setTimeout(() => setOptimisticTransactions(null), 100);
          } catch (err) {
            logger.error('Failed to undo status change:', err);
          }
        },
      });

      try {
        await updateStatusMutation.mutateAsync({ id, status: newStatus });
        setPendingRefreshTrigger(c => c + 1);
        setOptimisticTransactions(null);
      } catch (err) {
        logger.error('Failed to update transaction:', err);
        setOptimisticTransactions(null);
        dismissToast(toastId);
      }
    },
    [transactions, filterStatus, updateStatusMutation, showInfo, dismissToast],
  );

  const handleUpdateStatus = useCallback(
    async (id: string, status: 'Pending' | 'Confirmed') => {
      const label = status === 'Confirmed' ? 'confirmed' : 'marked pending';
      return changeStatus(id, status, `Transaction ${label}`);
    },
    [changeStatus],
  );

  const handleDecline = useCallback(
    async (id: string) => changeStatus(id, 'Declined', 'Transaction declined'),
    [changeStatus],
  );

  return {
    transactions,
    optimisticTransactions,
    setOptimisticTransactions,
    pendingRefreshTrigger,
    handleUpdateStatus,
    handleDecline,
  };
}
