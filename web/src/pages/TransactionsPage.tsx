import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { TransactionList } from '../components/TransactionList';
import { TransactionForm } from '../components/TransactionForm';
import { AddTransactionSheet } from '../components/AddTransactionSheet';
import { ConfirmDialog, useConfirmDialog } from '../components/ConfirmDialog';
import { DatePicker } from '../components/DatePicker';
import { FilterPanel, SummaryCards, BulkActionsBar } from '../components/transactions';
import { PendingIndicator } from '../components/PendingIndicator';
import { ToastContainer, useToast } from '../components/Toast';
import { PullToRefreshContainer } from '../components/PullToRefreshContainer';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useCurrency } from '../context/CurrencyContext';
import {
  DatePreset,
  getDateRangeForPreset,
  formatDateForInput,
  formatDateToStartOfDay,
  formatDateToEndOfDay,
} from '../hooks/useTransactionFilters';
import {
  useAccounts,
  useLabels,
  useTags,
  useCreateTag,
  useTransactions,
  useTransactionSummary,
  useCounterparties,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useUpdateStatus,
  useBatchDelete,
  useBatchMarkConfirmed,
  useBatchMarkPending,
  useInvalidateTransactions,
} from '../hooks';
import { useConversations } from '../hooks';
import { exportTransactions } from '../services/transactionService';
import { logger } from '../services/logger';
import type {
  Transaction,
  TransactionFilter,
  CreateTransactionRequest,
  UpdateTransactionRequest,
} from '../types/transactions';

export default function TransactionsPage() {
  // Currency context - backend returns summary already converted to primary currency
  const { primaryCurrency } = useCurrency();
  
  // URL search params for highlight
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Navigation for View in Chat
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  
  // React Query hooks for data fetching
  const { data: accounts = [], isLoading: isLoadingAccounts, error: accountsError } = useAccounts();
  const { data: labels = [], isLoading: isLoadingLabels, error: labelsError } = useLabels();
  const { data: tags = [], isLoading: isLoadingTags, error: tagsError } = useTags();
  const { data: counterparties = [] } = useCounterparties();
  const createTagMutation = useCreateTag();
  const invalidateTransactions = useInvalidateTransactions();
  
  // Mutations
  const createTransactionMutation = useCreateTransaction();
  const updateTransactionMutation = useUpdateTransaction();
  const deleteTransactionMutation = useDeleteTransaction();
  const updateStatusMutation = useUpdateStatus();
  const batchDeleteMutation = useBatchDelete();
  const batchMarkConfirmedMutation = useBatchMarkConfirmed();
  const batchMarkPendingMutation = useBatchMarkPending();
  
  // Local transaction state for optimistic updates
  const [optimisticTransactions, setOptimisticTransactions] = useState<Transaction[] | null>(null);
  
  // Toast notifications
  const { showInfo, toasts, dismissToast } = useToast();
  
  // Confirm dialog for batch operations
  const { confirm, dialogProps: confirmDialogProps } = useConfirmDialog();
  
  // Conversations for contact picker in AddTransactionSheet
  const { data: conversationsData } = useConversations();
  const conversations = conversationsData?.conversations ?? [];
  
  // UI state
  const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(
    // Open add sheet if navigated from bottom tab bar
    !!(location.state as { openAddSheet?: boolean } | null)?.openAddSheet
  );
  const [addSheetMode, setAddSheetMode] = useState<'dropdown' | 'modal'>('dropdown');
  const [pendingRefreshTrigger, setPendingRefreshTrigger] = useState(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  
  // Filter state
  // When navigating via ?highlight=<id> (e.g. "View in Transactions" from chat),
  // clear filters so the transaction is findable regardless of status or date.
  const hasHighlight = searchParams.has('highlight');
  const [datePreset, setDatePreset] = useState<DatePreset>(hasHighlight ? 'custom' : 'thisMonth');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [filter, setFilter] = useState<TransactionFilter>(hasHighlight ? {} : { status: 'Confirmed' });
  
  // Linked transaction navigation
  const [highlightedTransactionId, setHighlightedTransactionId] = useState<string | null>(null);
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Get current date range based on preset
  const getDateRange = useCallback((): { startDate: string; endDate: string } => {
    if (datePreset === 'custom') {
      return {
        startDate: customStartDate ? formatDateToStartOfDay(new Date(customStartDate)) : '',
        endDate: customEndDate ? formatDateToEndOfDay(new Date(customEndDate)) : '',
      };
    }
    const range = getDateRangeForPreset(datePreset);
    return {
      startDate: formatDateToStartOfDay(range.start),
      endDate: formatDateToEndOfDay(range.end),
    };
  }, [datePreset, customStartDate, customEndDate]);

  // Helper to get all category IDs from selected folders
  const getExpandedLabelIds = useCallback(() => {
    const labelIds = new Set(filter.labelIds || []);
    
    // Expand folderIds to their child categories
    if (filter.folderIds?.length) {
      for (const folderId of filter.folderIds) {
        // Get all categories that belong to this folder
        const childCategories = labels.filter(l => l.parentId === folderId && l.type === 'Category');
        for (const child of childCategories) {
          labelIds.add(child.id);
        }
      }
    }
    
    return labelIds.size > 0 ? Array.from(labelIds) : undefined;
  }, [filter.labelIds, filter.folderIds, labels]);

  // Build the full filter for transaction queries
  const fullFilter: TransactionFilter = useMemo(() => {
    const dateRange = getDateRange();
    const expandedLabelIds = getExpandedLabelIds();
    return {
      ...filter,
      ...dateRange,
      labelIds: expandedLabelIds,
      folderIds: undefined,
      searchText: debouncedSearchText || undefined,
      page: currentPage,
      pageSize,
    };
  }, [filter, getDateRange, getExpandedLabelIds, debouncedSearchText, currentPage, pageSize]);

  // React Query for transactions
  const { 
    data: transactionResponse, 
    isLoading: isLoadingTransactions, 
    error: transactionsError,
    isFetching: isFetchingTransactions,
  } = useTransactions(fullFilter);

  // React Query for summary (without pagination)
  const summaryFilter = useMemo(() => {
    // Omit pagination fields for summary query
    const { page, pageSize, ...rest } = fullFilter;
    // Use void to suppress unused variable warnings
    void page;
    void pageSize;
    return rest;
  }, [fullFilter]);
  
  const { data: summary } = useTransactionSummary(summaryFilter);

  // Derived state
  const transactions = useMemo(() => {
    return optimisticTransactions ?? transactionResponse?.transactions ?? [];
  }, [optimisticTransactions, transactionResponse?.transactions]);
  const hasMore = transactionResponse ? transactionResponse.page < transactionResponse.totalPages : false;
  const isLoading = isLoadingAccounts || isLoadingLabels || isLoadingTags || isLoadingTransactions;
  const isLoadingMore = isFetchingTransactions && currentPage > 1;
  const queryError = accountsError || labelsError || tagsError || transactionsError 
    ? 'Failed to load data. Please refresh the page.' 
    : null;
  const isSubmitting = createTransactionMutation.isPending || updateTransactionMutation.isPending;
  
  // Local error state for non-query errors (export, etc.)
  const [localError, setLocalError] = useState<string | null>(null);
  const error = queryError || localError;

  // Bulk selection
  const {
    selectedIds,
    hasSelection,
    selectionCount,
    toggleSelection,
    clearSelection,
  } = useBulkSelection({
    getId: (t: Transaction) => t.id,
    items: transactions,
  });

  // Infinite scroll - load more by incrementing page
  const listRef = useInfiniteScroll({
    hasMore,
    isLoading: isLoadingMore || isFetchingTransactions,
    onLoadMore: () => {
      if (!isFetchingTransactions) {
        setCurrentPage(prev => prev + 1);
      }
    },
  });

  // Reset to page 1 when filter changes (except page itself)
  useEffect(() => {
    setCurrentPage(1);
    setOptimisticTransactions(null);
    clearSelection();
  }, [filter, debouncedSearchText, datePreset, customStartDate, customEndDate]);

  // Debounce search text
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchText]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'n',
        handler: () => setIsAddSheetOpen(true),
        description: 'New transaction',
      },
      {
        key: '/',
        handler: () => searchInputRef.current?.focus(),
        description: 'Focus search',
      },
      {
        key: 'Escape',
        handler: () => {
          if (isFormOpen) {
            handleCloseForm();
          } else if (hasSelection) {
            clearSelection();
          } else if (isFilterOpen) {
            setIsFilterOpen(false);
          }
        },
        description: 'Close/Cancel',
      },
      {
        key: 'f',
        handler: () => setIsFilterOpen(prev => !prev),
        description: 'Toggle filters',
      },
    ],
  });

  // Delayed loading skeleton - only show if loading takes more than 200ms
  useEffect(() => {
    if (isLoading) {
      loadingTimeoutRef.current = setTimeout(() => {
        setShowLoadingSkeleton(true);
      }, 200);
    } else {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      setShowLoadingSkeleton(false);
    }
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [isLoading]);

  // Handle highlight from URL param (e.g., /transactions?highlight=abc123)
  // Track timeouts for cleanup on unmount
  const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      timeoutRefs.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && transactions.length > 0) {
      // Set the highlighted transaction
      setHighlightedTransactionId(highlightId);
      
      // Clear the URL param
      searchParams.delete('highlight');
      setSearchParams(searchParams, { replace: true });
      
      // Scroll to the transaction after a short delay
      const scrollTimer = setTimeout(() => {
        const element = document.querySelector(`[data-transaction-id="${highlightId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      timeoutRefs.current.push(scrollTimer);
      
      // Clear highlight after animation
      const clearTimer = setTimeout(() => setHighlightedTransactionId(null), 3000);
      timeoutRefs.current.push(clearTimer);
    }
  }, [searchParams, setSearchParams, transactions.length]);

  // Handle date preset change
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    } else {
      // Set default custom range to this month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setCustomStartDate(formatDateForInput(startOfMonth));
      setCustomEndDate(formatDateForInput(now));
    }
  };

  // Handle transaction form submit
  const handleFormSubmit = async (data: CreateTransactionRequest | UpdateTransactionRequest) => {
    setFormError(null);
    try {
      if (editingTransaction) {
        await updateTransactionMutation.mutateAsync({ id: editingTransaction.id, data: data as UpdateTransactionRequest });
      } else {
        await createTransactionMutation.mutateAsync(data as CreateTransactionRequest);
      }
      setIsFormOpen(false);
      setEditingTransaction(null);
    } catch (err) {
      logger.error('Failed to save transaction:', err);
      const message = err instanceof Error ? err.message : 'Failed to save transaction. Please try again.';
      setFormError(message);
      // Don't close the form on error so user can fix and retry
    }
  };

  // Handle edit
  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsFormOpen(true);
  };

  // Handle delete — instant soft-delete (optimistic removal from React Query cache)
  const handleDelete = (id: string) => {
    deleteTransactionMutation.mutate(id);
  };

  // Handle update status with undo toast
  const handleUpdateStatus = async (id: string, status: 'Pending' | 'Confirmed') => {
    // Find the transaction for undo
    const transactionToUpdate = transactions.find(t => t.id === id);
    if (!transactionToUpdate) return;
    
    const previousStatus = transactionToUpdate.status;
    const currentStatusFilter = filter.status;
    const shouldRemove = currentStatusFilter && currentStatusFilter !== status;
    const originalIndex = transactions.findIndex(t => t.id === id);
    
    // Optimistic update
    setOptimisticTransactions(prev => {
      const list = prev ?? transactions;
      if (shouldRemove) {
        return list.filter(t => t.id !== id);
      } else {
        return list.map(t => t.id === id ? { ...t, status } : t);
      }
    });
    
    // Show undo toast
    const statusLabel = status === 'Confirmed' ? 'confirmed' : 'marked pending';
    const toastId = showInfo(`Transaction ${statusLabel}`, {
      label: 'Undo',
      onClick: async () => {
        dismissToast(toastId);
        try {
          await updateStatusMutation.mutateAsync({ id, status: previousStatus });
          // Restore to previous state via optimistic update
          setOptimisticTransactions(prev => {
            const list = prev ?? transactions;
            if (shouldRemove) {
              const newList = [...list];
              newList.splice(originalIndex, 0, { ...transactionToUpdate, status: previousStatus });
              return newList;
            } else {
              return list.map(t => t.id === id ? { ...t, status: previousStatus } : t);
            }
          });
          setPendingRefreshTrigger(prev => prev + 1);
          // Clear optimistic state after undo
          setTimeout(() => setOptimisticTransactions(null), 100);
        } catch (err) {
          logger.error('Failed to undo status change:', err);
        }
      },
    });
    
    try {
      await updateStatusMutation.mutateAsync({ id, status });
      setPendingRefreshTrigger(prev => prev + 1);
      // Clear optimistic state - query cache is updated
      setOptimisticTransactions(null);
    } catch (err) {
      logger.error('Failed to update transaction:', err);
      // Restore on error
      setOptimisticTransactions(null);
      dismissToast(toastId);
    }
  };

  // Handle view linked transaction
  const handleViewLinkedTransaction = useCallback((linkedTransactionId: string, _linkedAccountId: string) => {
    // Clear account filter to show all accounts (linked transaction might be in different account)
    setFilter(prev => ({ ...prev, accountIds: undefined }));
    
    // Set the transaction to highlight
    setHighlightedTransactionId(linkedTransactionId);
    
    // Clear highlight after animation
    setTimeout(() => setHighlightedTransactionId(null), 3000);
    
    // Invalidate to reload transactions with new filter, then scroll to the linked one
    invalidateTransactions();
    // Small delay to let the DOM update after query refresh
    setTimeout(() => {
      const element = document.querySelector(`[data-transaction-id="${linkedTransactionId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
  }, [invalidateTransactions]);

  // Handle Accept P2P - opens form with transaction data for account/category assignment
  const handleAcceptP2P = useCallback((transaction: Transaction) => {
    // Open the form with this transaction's data so user can add account and categories
    setEditingTransaction(transaction);
    setIsFormOpen(true);
  }, []);

  // Handle Decline - sets status to Declined with undo toast
  const handleDecline = useCallback(async (id: string) => {
    // Find the transaction for undo
    const transactionToDecline = transactions.find(t => t.id === id);
    if (!transactionToDecline) return;
    
    const previousStatus = transactionToDecline.status;
    const currentStatusFilter = filter.status;
    const shouldRemove = currentStatusFilter && currentStatusFilter !== 'Declined';
    const originalIndex = transactions.findIndex(t => t.id === id);
    
    // Optimistic update
    setOptimisticTransactions(prev => {
      const list = prev ?? transactions;
      if (shouldRemove) {
        return list.filter(t => t.id !== id);
      } else {
        return list.map(t => t.id === id ? { ...t, status: 'Declined' as const } : t);
      }
    });
    
    // Show undo toast
    const toastId = showInfo('Transaction declined', {
      label: 'Undo',
      onClick: async () => {
        dismissToast(toastId);
        try {
          await updateStatusMutation.mutateAsync({ id, status: previousStatus });
          // Restore to previous state via optimistic update
          setOptimisticTransactions(prev => {
            const list = prev ?? transactions;
            if (shouldRemove) {
              const newList = [...list];
              newList.splice(originalIndex, 0, { ...transactionToDecline, status: previousStatus });
              return newList;
            } else {
              return list.map(t => t.id === id ? { ...t, status: previousStatus } : t);
            }
          });
          setPendingRefreshTrigger(prev => prev + 1);
          // Clear optimistic state after undo
          setTimeout(() => setOptimisticTransactions(null), 100);
        } catch (err) {
          logger.error('Failed to undo decline:', err);
        }
      },
    });
    
    try {
      await updateStatusMutation.mutateAsync({ id, status: 'Declined' });
      setPendingRefreshTrigger(prev => prev + 1);
      // Clear optimistic state - query cache is updated
      setOptimisticTransactions(null);
    } catch (err) {
      logger.error('Failed to decline transaction:', err);
      // Restore on error
      setOptimisticTransactions(null);
      dismissToast(toastId);
    }
  }, [filter.status, transactions, updateStatusMutation, showInfo, dismissToast]);

  // Navigate to chat view for a transaction
  const handleViewInChat = useCallback((transaction: Transaction) => {
    // Build URL params for navigation
    const params = new URLSearchParams();
    
    // If transaction has a counterparty, navigate to their chat
    // Otherwise, navigate to self-chat (personal transactions)
    const userId = transaction.counterpartyUserId;
    if (userId) {
      params.set('user', userId);
    } else {
      params.set('self', 'true');
    }
    
    // Add message ID for scrolling and highlighting
    if (transaction.chatMessageId) {
      params.set('messageId', transaction.chatMessageId);
    }
    
    navigate(`/chats?${params.toString()}`);
  }, [navigate]);

  // Batch operations
  const handleBatchDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete transactions?',
      message: `This will permanently delete ${selectionCount} transaction${selectionCount > 1 ? 's' : ''}. This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    
    setIsBatchProcessing(true);
    try {
      const result = await batchDeleteMutation.mutateAsync(Array.from(selectedIds));
      clearSelection();
      if (result.failedCount > 0) {
        logger.error(`${result.failedCount} transaction(s) could not be deleted.`);
      }
    } catch (err) {
      logger.error('Failed to batch delete:', err);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchMarkConfirmed = async () => {
    setIsBatchProcessing(true);
    try {
      await batchMarkConfirmedMutation.mutateAsync(Array.from(selectedIds));
      // Optimistic update
      setOptimisticTransactions(prev => {
        const list = prev ?? transactions;
        return list.map(t => selectedIds.has(t.id) ? { ...t, status: 'Confirmed' as const } : t);
      });
      clearSelection();
      // Clear optimistic state after cache update
      setTimeout(() => setOptimisticTransactions(null), 100);
    } catch (err) {
      logger.error('Failed to batch mark confirmed:', err);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchMarkPending = async () => {
    setIsBatchProcessing(true);
    try {
      await batchMarkPendingMutation.mutateAsync(Array.from(selectedIds));
      // Optimistic update
      setOptimisticTransactions(prev => {
        const list = prev ?? transactions;
        return list.map(t => selectedIds.has(t.id) ? { ...t, status: 'Pending' as const } : t);
      });
      clearSelection();
      // Clear optimistic state after cache update
      setTimeout(() => setOptimisticTransactions(null), 100);
    } catch (err) {
      logger.error('Failed to batch mark pending:', err);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Export — uses Web Share API on mobile (for sharing files), fallback to direct download
  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const dateRange = getDateRange();
      const expandedLabelIds = getExpandedLabelIds();
      const exportFilter: TransactionFilter = {
        ...filter,
        ...dateRange,
        labelIds: expandedLabelIds,
        folderIds: undefined,
        searchText: searchText || undefined,
      };
      
      const data = await exportTransactions(exportFilter, format);
      
      const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
      const content = format === 'csv' ? (data as string) : JSON.stringify(data, null, 2);
      const blob = new Blob([content], { type: mimeType });
      const fileName = `transactions-${new Date().toISOString().split('T')[0]}.${format}`;
      
      // Try Web Share API on mobile (supports file sharing)
      if (isMobile && navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: mimeType });
        const shareData = { files: [file], title: 'Transactions Export' };
        
        if (navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
            return; // Successfully shared
          } catch (shareErr) {
            // User cancelled or share failed — fall through to download
            if ((shareErr as DOMException).name === 'AbortError') return;
          }
        }
      }
      
      // Fallback: direct download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('Failed to export:', err);
      setLocalError('Failed to export transactions. Please try again.');
    }
  };
  
  // Mobile export bottom sheet state
  const [showMobileExportSheet, setShowMobileExportSheet] = useState(false);

  // Close form
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingTransaction(null);
    setFormError(null);
  };

  // Get active filter count (excluding date range, search, and default Confirmed status)
  const activeFilterCount = [
    filter.accountIds && filter.accountIds.length > 0,
    filter.types && filter.types.length > 0,
    (filter.labelIds && filter.labelIds.length > 0) || (filter.folderIds && filter.folderIds.length > 0),
    filter.tagIds && filter.tagIds.length > 0,
    filter.counterpartyUserIds && filter.counterpartyUserIds.length > 0,
    filter.status !== undefined && filter.status !== 'Confirmed',
    filter.minAmount !== undefined,
    filter.maxAmount !== undefined,
  ].filter(Boolean).length;

  // Summary is already converted to user's primary currency by the backend
  // Just use it directly with the primaryCurrency from context

  return (
  <PullToRefreshContainer
    onRefresh={async () => {
      await invalidateTransactions();
    }}
  >
  <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="hidden lg:block text-2xl font-bold text-gray-900 dark:text-gray-100">
          Transactions
        </h1>
        

        
        <div className="hidden sm:flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative group">
            <button
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 
                rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
            <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
              rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <button
                onClick={() => handleExport('csv')}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg"
              >
                Export CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg"
              >
                Export JSON
              </button>
            </div>
          </div>
          
          <PendingIndicator 
            showingPending={filter.status === 'Pending'}
            refreshTrigger={pendingRefreshTrigger}
            onShowPending={() => {
              if (filter.status === 'Pending') {
                // Go back to default view: Confirmed, This Month
                setDatePreset('thisMonth');
                setCustomStartDate('');
                setCustomEndDate('');
                setSearchText('');
                setFilter({ status: 'Confirmed' });
              } else {
                // Show ALL pending transactions: clear filters, set all time
                setDatePreset('custom');
                setCustomStartDate('');
                setCustomEndDate('');
                setSearchText('');
                setFilter({ status: 'Pending' });
              }
            }}
          />
          
          <button
            ref={addButtonRef}
            onClick={() => {
              setAddSheetMode('dropdown');
              setIsAddSheetOpen(prev => !prev);
            }}
            data-tour="add-transaction"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium ${
              isAddSheetOpen && addSheetMode === 'dropdown'
                ? 'bg-blue-700 dark:bg-blue-800 text-white ring-2 ring-blue-300 dark:ring-blue-600'
                : 'bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 text-white hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900'
            }`}
          >
            <svg className={`w-5 h-5 transition-transform ${isAddSheetOpen && addSheetMode === 'dropdown' ? 'rotate-45' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Transaction
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
          rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
          {localError && <button onClick={() => setLocalError(null)} className="ml-2 underline">Dismiss</button>}
        </div>
      )}

      {/* Date Presets */}
      <div className="flex items-center gap-2 mb-4">
        {(['thisMonth', 'lastMonth', 'custom'] as DatePreset[]).map((preset) => (
          <button
            key={preset}
            onClick={() => handleDatePresetChange(preset)}
            className={`px-3 py-2 lg:py-1.5 min-h-[44px] lg:min-h-0 text-sm rounded-lg border transition-colors touch-manipulation ${
              datePreset === preset
                ? 'bg-blue-600 dark:bg-blue-800 text-white border-blue-600 dark:border-blue-800'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-500 hover:border-blue-400 dark:hover:border-blue-400'
            }`}
          >
            {preset === 'thisMonth' && 'This Month'}
            {preset === 'lastMonth' && 'Last Month'}
            {preset === 'custom' && 'Custom'}
          </button>
        ))}

        {/* Mobile action buttons - inline with date presets */}
        <div className="sm:hidden flex items-center gap-2 ml-auto">
          <PendingIndicator
            compact
            showingPending={filter.status === 'Pending'}
            refreshTrigger={pendingRefreshTrigger}
            onShowPending={() => {
              if (filter.status === 'Pending') {
                setDatePreset('thisMonth');
                setCustomStartDate('');
                setCustomEndDate('');
                setSearchText('');
                setFilter({ status: 'Confirmed' });
              } else {
                setDatePreset('custom');
                setCustomStartDate('');
                setCustomEndDate('');
                setSearchText('');
                setFilter({ status: 'Pending' });
              }
            }}
          />
          <button
            onClick={() => setShowMobileExportSheet(true)}
            className="flex items-center justify-center w-10 h-10 min-w-[44px] min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-600
              text-gray-700 dark:text-gray-300 active:bg-gray-100 dark:active:bg-gray-700 touch-manipulation"
            aria-label="Export transactions"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Custom Date Range */}
      {datePreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">From:</label>
            <div className="w-40">
              <DatePicker
                value={customStartDate}
                onChange={(value) => setCustomStartDate(value)}
                placeholder="Start date"
                maxDate={customEndDate ? new Date(customEndDate) : new Date()}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">To:</label>
            <div className="w-40">
              <DatePicker
                value={customEndDate}
                onChange={(value) => setCustomEndDate(value)}
                placeholder="End date"
                minDate={customStartDate ? new Date(customStartDate) : undefined}
              maxDate={new Date()}
              />
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <SummaryCards
          totalCredits={summary.totalCredits}
          totalDebits={summary.totalDebits}
          netChange={summary.netChange}
          currency={primaryCurrency}
          transactionCount={summary.transactionCount}
        />
      )}

      {/* Search and Filter Row */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={isMobile ? "Search transactions..." : "Search title, category, tag, account, city... (press / to focus)"}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
              bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              placeholder-gray-400 dark:placeholder-gray-500"
          />
          {searchText && (
            <button
              onClick={() => setSearchText('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 touch-manipulation"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={`flex items-center gap-2 px-4 py-2 min-h-[44px] border rounded-lg transition-colors touch-manipulation ${
            isFilterOpen || activeFilterCount > 0
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" 
            />
          </svg>
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 dark:bg-blue-700 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      <FilterPanel
        isOpen={isFilterOpen}
        accounts={accounts}
        labels={labels}
        tags={tags}
        counterparties={counterparties}
        filter={filter}
        onFilterChange={setFilter}
        onClose={() => setIsFilterOpen(false)}
      />

      {/* Transaction List */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto min-h-0"
      >
        <TransactionList
          transactions={transactions}
          accounts={accounts}
          labels={labels}
          tags={tags}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onUpdateStatus={handleUpdateStatus}
          onViewLinkedTransaction={handleViewLinkedTransaction}
          onAcceptP2P={handleAcceptP2P}
          onDecline={handleDecline}
          onViewInChat={handleViewInChat}
          highlightedTransactionId={highlightedTransactionId}
          isLoading={showLoadingSkeleton}
          statusFilter={filter.status}
          selectionMode={hasSelection}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
        />
        
        {/* Loading More Indicator */}
        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {/* End of List */}
        {!isLoading && !hasMore && transactions.length > 0 && (
          <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} • End of list
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectionCount}
        onClearSelection={clearSelection}
        onDelete={handleBatchDelete}
        onMarkConfirmed={handleBatchMarkConfirmed}
        onMarkPending={handleBatchMarkPending}
        isProcessing={isBatchProcessing}
      />

      {/* Transaction Form Modal */}
      <TransactionForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleFormSubmit}
        editingTransaction={editingTransaction}
        accounts={accounts}
        labels={labels}
        tags={tags}
        isLoading={isSubmitting}
        autoLocationEnabled={true}
        error={formError}
        onCreateTag={async (name) => {
          try {
            const newTag = await createTagMutation.mutateAsync({ name });
            // React Query will automatically invalidate and refetch tags
            return newTag;
          } catch (error) {
            logger.error('Failed to create tag:', error);
            return null;
          }
        }}
      />
      
      {/* Mobile FAB - Add Transaction */}
      {isMobile && (
        <button
          onClick={() => {
            setAddSheetMode('modal');
            setIsAddSheetOpen(true);
          }}
          className="fixed right-4 bottom-20 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 
            dark:from-blue-700 dark:to-blue-800 text-white shadow-lg shadow-blue-500/30 dark:shadow-blue-900/50
            active:scale-95 transition-transform touch-manipulation
            flex items-center justify-center"
          aria-label="Add transaction"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Add Transaction Sheet - Dropdown for desktop, Modal for mobile FAB */}
      <AddTransactionSheet
        isOpen={isAddSheetOpen}
        onClose={() => setIsAddSheetOpen(false)}
        accounts={accounts}
        conversations={conversations}
        anchorRef={addSheetMode === 'dropdown' ? addButtonRef : undefined}
        mode={addSheetMode}
      />
      
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      
      {/* Confirm dialog for batch operations */}
      <ConfirmDialog {...confirmDialogProps} />
      
      {/* Mobile Export Bottom Sheet */}
      {showMobileExportSheet && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
            onClick={() => setShowMobileExportSheet(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl animate-slide-up safe-area-bottom">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Export Transactions</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Choose a format to export</p>
            </div>
            <div className="py-2">
              <button
                onClick={() => { setShowMobileExportSheet(false); handleExport('csv'); }}
                className="w-full flex items-center gap-4 px-5 py-3.5 min-h-[52px] text-left text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700 touch-manipulation"
              >
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <div>
                  <span className="text-base font-medium">CSV Spreadsheet</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Best for Excel, Google Sheets</p>
                </div>
              </button>
              <button
                onClick={() => { setShowMobileExportSheet(false); handleExport('json'); }}
                className="w-full flex items-center gap-4 px-5 py-3.5 min-h-[52px] text-left text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700 touch-manipulation"
              >
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
                <div>
                  <span className="text-base font-medium">JSON Data</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Best for backup, developers</p>
                </div>
              </button>
            </div>
            <div className="px-4 pb-4 pt-1">
              <button
                onClick={() => setShowMobileExportSheet(false)}
                className="w-full py-3 min-h-[48px] text-center text-base font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-xl active:bg-gray-200 dark:active:bg-gray-600 touch-manipulation"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
    </PullToRefreshContainer>
  );
}
