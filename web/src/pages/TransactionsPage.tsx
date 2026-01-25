import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TransactionList } from '../components/TransactionList';
import { TransactionForm } from '../components/TransactionForm';
import { DatePicker } from '../components/DatePicker';
import { FilterPanel, SummaryCards, BulkActionsBar } from '../components/transactions';
import { PendingIndicator } from '../components/PendingIndicator';
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
import { getLabels } from '../services/labelService';
import { getTags, createTag } from '../services/tagService';
import { getAccounts, type Account } from '../services/accountService';
import { logger } from '../services/logger';
import {
  getTransactions,
  getTransactionSummary,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  updateStatus,
  batchDelete,
  batchMarkConfirmed,
  batchMarkPending,
  exportTransactions,
} from '../services/transactionService';
import type {
  Transaction,
  TransactionSummary,
  TransactionFilter,
  CreateTransactionRequest,
  UpdateTransactionRequest,
} from '../types/transactions';
import type { Label, Tag } from '../types/labels';

export default function TransactionsPage() {
  // Currency context - backend returns summary already converted to primary currency
  const { primaryCurrency } = useCurrency();
  
  // URL search params for highlight
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Data state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingRefreshTrigger, setPendingRefreshTrigger] = useState(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 50;
  
  // Filter state
  const [datePreset, setDatePreset] = useState<DatePreset>('thisMonth');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<TransactionFilter>({ status: 'Confirmed' }); // Default to Confirmed
  
  // Linked transaction navigation
  const [highlightedTransactionId, setHighlightedTransactionId] = useState<string | null>(null);
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Infinite scroll
  const listRef = useInfiniteScroll({
    hasMore,
    isLoading: isLoadingMore,
    onLoadMore: () => loadTransactions(currentPage + 1, true),
  });

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'n',
        handler: () => setIsFormOpen(true),
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

  // Load initial data
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [accountsData, labelsData, tagsData] = await Promise.all([
          getAccounts(),
          getLabels(),
          getTags(),
        ]);
        setAccounts(accountsData);
        setLabels(labelsData);
        setTags(tagsData);
      } catch (err) {
        logger.error('Failed to load initial data:', err);
        setError('Failed to load data. Please refresh the page.');
      }
    }
    loadInitialData();
  }, []);

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

  // Load transactions when filter changes
  const loadTransactions = useCallback(async (page = 1, append = false) => {
    if (page === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const dateRange = getDateRange();
      const expandedLabelIds = getExpandedLabelIds();
      const fullFilter: TransactionFilter = {
        ...filter,
        ...dateRange,
        labelIds: expandedLabelIds, // Use expanded labelIds
        folderIds: undefined, // Don't send folderIds to API
        searchText: searchText || undefined,
        page,
        pageSize,
      };

      const [transactionsData, summaryData] = await Promise.all([
        getTransactions(fullFilter),
        // Pass full filter to summary for consistent results
        page === 1 ? getTransactionSummary(fullFilter) : Promise.resolve(null),
      ]);

      if (append) {
        setTransactions(prev => [...prev, ...transactionsData.transactions]);
      } else {
        setTransactions(transactionsData.transactions);
        clearSelection(); // Clear selection when reloading
      }
      
      if (summaryData) {
        setSummary(summaryData);
      }
      
      setCurrentPage(transactionsData.page);
      setHasMore(transactionsData.page < transactionsData.totalPages);
    } catch (err) {
      logger.error('Failed to load transactions:', err);
      setError('Failed to load transactions. Please try again.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [filter, searchText, getDateRange, clearSelection, getExpandedLabelIds]);

  // Refresh just the summary (for instant updates after status changes)
  const refreshSummary = useCallback(async () => {
    try {
      const dateRange = getDateRange();
      const expandedLabelIds = getExpandedLabelIds();
      const fullFilter: TransactionFilter = {
        ...filter,
        ...dateRange,
        labelIds: expandedLabelIds,
        folderIds: undefined,
        searchText: searchText || undefined,
      };
      const summaryData = await getTransactionSummary(fullFilter);
      setSummary(summaryData);
    } catch (err) {
      logger.error('Failed to refresh summary:', err);
    }
  }, [filter, searchText, getDateRange, getExpandedLabelIds]);

  // Initial load and reload on filter changes
  useEffect(() => {
    loadTransactions(1, false);
  }, [loadTransactions]);

  // Handle highlight from URL param (e.g., /transactions?highlight=abc123)
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && transactions.length > 0) {
      // Set the highlighted transaction
      setHighlightedTransactionId(highlightId);
      
      // Clear the URL param
      searchParams.delete('highlight');
      setSearchParams(searchParams, { replace: true });
      
      // Scroll to the transaction after a short delay
      setTimeout(() => {
        const element = document.querySelector(`[data-transaction-id="${highlightId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      
      // Clear highlight after animation
      setTimeout(() => setHighlightedTransactionId(null), 3000);
    }
  }, [searchParams, setSearchParams, transactions.length]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      loadTransactions(1, false);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

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
    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, data as UpdateTransactionRequest);
      } else {
        await createTransaction(data as CreateTransactionRequest);
      }
      setIsFormOpen(false);
      setEditingTransaction(null);
      loadTransactions(1, false);
    } catch (err) {
      logger.error('Failed to save transaction:', err);
      const message = err instanceof Error ? err.message : 'Failed to save transaction. Please try again.';
      setFormError(message);
      // Don't close the form on error so user can fix and retry
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsFormOpen(true);
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      loadTransactions(1, false);
    } catch (err) {
      logger.error('Failed to delete transaction:', err);
      setError('Failed to delete transaction. Please try again.');
    }
  };

  // Handle update status
  const handleUpdateStatus = async (id: string, status: 'Pending' | 'Confirmed') => {
    try {
      await updateStatus(id, status);
      
      // Check if the transaction should still be visible with current filter
      const currentStatusFilter = filter.status;
      const shouldRemove = currentStatusFilter && currentStatusFilter !== status;
      
      if (shouldRemove) {
        // Remove from list immediately - it no longer matches the filter
        setTransactions(prev => prev.filter(t => t.id !== id));
      } else {
        // Update in place
        setTransactions(prev => prev.map(t => 
          t.id === id ? { ...t, status } : t
        ));
      }
      
      // Refresh pending count and summary immediately
      setPendingRefreshTrigger(prev => prev + 1);
      refreshSummary();
    } catch (err) {
      logger.error('Failed to update transaction:', err);
      setError('Failed to update transaction. Please try again.');
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
    
    // Reload transactions to include all accounts, then scroll to the linked one
    loadTransactions(1, false).then(() => {
      // Small delay to let the DOM update
      setTimeout(() => {
        const element = document.querySelector(`[data-transaction-id="${linkedTransactionId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    });
  }, []);

  // Handle Accept P2P - opens form with transaction data for account/category assignment
  const handleAcceptP2P = useCallback((transaction: Transaction) => {
    // Open the form with this transaction's data so user can add account and categories
    setEditingTransaction(transaction);
    setIsFormOpen(true);
  }, []);

  // Handle Decline - sets status to Declined
  const handleDecline = useCallback(async (id: string) => {
    try {
      await updateStatus(id, 'Declined');
      
      // Remove from list if current filter wouldn't show Declined
      const currentStatusFilter = filter.status;
      if (currentStatusFilter && currentStatusFilter !== 'Declined') {
        setTransactions(prev => prev.filter(t => t.id !== id));
      }
      
      // Refresh pending count and summary immediately
      setPendingRefreshTrigger(prev => prev + 1);
      refreshSummary();
    } catch (err) {
      logger.error('Failed to decline transaction:', err);
      setError('Failed to decline transaction. Please try again.');
    }
  }, [filter.status, refreshSummary]);

  // Batch operations
  const handleBatchDelete = async () => {
    if (!confirm(`Delete ${selectionCount} transaction${selectionCount > 1 ? 's' : ''}?`)) {
      return;
    }
    
    setIsBatchProcessing(true);
    try {
      const result = await batchDelete(Array.from(selectedIds));
      clearSelection();
      loadTransactions(1, false);
      if (result.failedCount > 0) {
        setError(`${result.failedCount} transaction(s) could not be deleted.`);
      }
    } catch (err) {
      logger.error('Failed to batch delete:', err);
      setError('Failed to delete transactions. Please try again.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchMarkConfirmed = async () => {
    setIsBatchProcessing(true);
    try {
      await batchMarkConfirmed(Array.from(selectedIds));
      setTransactions(prev => prev.map(t => 
        selectedIds.has(t.id) ? { ...t, status: 'Confirmed' as const } : t
      ));
      clearSelection();
    } catch (err) {
      logger.error('Failed to batch mark confirmed:', err);
      setError('Failed to update transactions. Please try again.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchMarkPending = async () => {
    setIsBatchProcessing(true);
    try {
      await batchMarkPending(Array.from(selectedIds));
      setTransactions(prev => prev.map(t => 
        selectedIds.has(t.id) ? { ...t, status: 'Pending' as const } : t
      ));
      clearSelection();
    } catch (err) {
      logger.error('Failed to batch mark pending:', err);
      setError('Failed to update transactions. Please try again.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Export
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
      
      // Create download
      const blob = format === 'csv' 
        ? new Blob([data as string], { type: 'text/csv' })
        : new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('Failed to export:', err);
      setError('Failed to export transactions. Please try again.');
    }
  };

  // Close form
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingTransaction(null);
    setFormError(null);
  };

  // Get active filter count (excluding date range and search)
  const activeFilterCount = [
    filter.accountIds && filter.accountIds.length > 0,
    filter.types && filter.types.length > 0,
    (filter.labelIds && filter.labelIds.length > 0) || (filter.folderIds && filter.folderIds.length > 0),
    filter.tagIds && filter.tagIds.length > 0,
    filter.status !== undefined,
    filter.minAmount !== undefined,
    filter.maxAmount !== undefined,
  ].filter(Boolean).length;

  // Summary is already converted to user's primary currency by the backend
  // Just use it directly with the primaryCurrency from context

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
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
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 text-white rounded-lg 
              hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Date Presets */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['today', 'thisWeek', 'thisMonth', 'lastMonth', 'custom'] as DatePreset[]).map((preset) => (
          <button
            key={preset}
            onClick={() => handleDatePresetChange(preset)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              datePreset === preset
                ? 'bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 text-white border-blue-600 dark:border-blue-900'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-500 hover:border-blue-400 dark:hover:border-blue-400'
            }`}
          >
            {preset === 'today' && 'Today'}
            {preset === 'thisWeek' && 'This Week'}
            {preset === 'thisMonth' && 'This Month'}
            {preset === 'lastMonth' && 'Last Month'}
            {preset === 'custom' && 'Custom'}
          </button>
        ))}
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
            placeholder="Search title, category, tag, account, city... (press / to focus)"
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
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
          onRejectP2P={handleDecline}
          highlightedTransactionId={highlightedTransactionId}
          isLoading={showLoadingSkeleton}
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

      {/* Floating Action Button (Mobile) */}
      {!hasSelection && (
        <button
          onClick={() => setIsFormOpen(true)}
          className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-900 dark:to-blue-950 text-white rounded-full 
            shadow-lg hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900 transition-colors flex items-center justify-center z-40"
        >
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

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
            const newTag = await createTag({ name });
            // Add to local tags list
            setTags(prev => [...prev, newTag]);
            return newTag;
          } catch (error) {
            logger.error('Failed to create tag:', error);
            return null;
          }
        }}
      />
    </div>
  );
}
