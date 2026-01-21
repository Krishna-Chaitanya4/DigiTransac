import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TransactionFilter, TransactionType } from '../types/transactions';

// Date preset types
export type DatePreset = 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'custom';

interface DateRange {
  start: Date;
  end: Date;
}

// Date utility functions
export const formatDateToStartOfDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00.000Z`;
};

export const formatDateToEndOfDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T23:59:59.999Z`;
};

export const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function getDateRangeForPreset(preset: DatePreset): DateRange {
  const now = new Date();
  
  switch (preset) {
    case 'today':
      return { start: now, end: now };
    case 'thisWeek': {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      return { start, end: now };
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: now };
    }
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
      return { start, end };
    }
    case 'custom':
    default:
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
  }
}

interface UseTransactionFiltersOptions {
  /** Whether to sync filters with URL (default: true) */
  syncWithUrl?: boolean;
  /** Default date preset (default: 'thisMonth') */
  defaultPreset?: DatePreset;
  /** Page size for pagination (default: 50) */
  pageSize?: number;
}

interface TransactionFiltersState {
  // Date state
  datePreset: DatePreset;
  customStartDate: string;
  customEndDate: string;
  
  // Search and filter state
  searchText: string;
  filter: TransactionFilter;
  
  // Pagination
  currentPage: number;
  pageSize: number;
}

interface TransactionFiltersActions {
  setDatePreset: (preset: DatePreset) => void;
  setCustomStartDate: (date: string) => void;
  setCustomEndDate: (date: string) => void;
  setSearchText: (text: string) => void;
  setFilter: (filter: TransactionFilter) => void;
  setCurrentPage: (page: number) => void;
  resetFilters: () => void;
  getDateRange: () => { startDate: string; endDate: string };
  getFullFilter: () => TransactionFilter;
  getActiveFilterCount: () => number;
}

export function useTransactionFilters(
  options: UseTransactionFiltersOptions = {}
): TransactionFiltersState & TransactionFiltersActions {
  const {
    syncWithUrl = true,
    defaultPreset = 'thisMonth',
    pageSize = 50,
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL or defaults
  const getInitialState = useCallback((): TransactionFiltersState => {
    if (!syncWithUrl) {
      return {
        datePreset: defaultPreset,
        customStartDate: '',
        customEndDate: '',
        searchText: '',
        filter: {},
        currentPage: 1,
        pageSize,
      };
    }

    const preset = (searchParams.get('preset') as DatePreset) || defaultPreset;
    const types = searchParams.get('types')?.split(',').filter(Boolean) as TransactionType[] | undefined;
    
    return {
      datePreset: preset,
      customStartDate: searchParams.get('startDate') || '',
      customEndDate: searchParams.get('endDate') || '',
      searchText: searchParams.get('search') || '',
      filter: {
        accountIds: searchParams.get('accounts')?.split(',').filter(Boolean) || undefined,
        types: types?.length ? types : undefined,
        labelIds: searchParams.get('categories')?.split(',').filter(Boolean) || undefined,
        tagIds: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
        isCleared: searchParams.get('cleared') === 'true' ? true : 
                   searchParams.get('cleared') === 'false' ? false : undefined,
        minAmount: searchParams.get('minAmount') ? parseFloat(searchParams.get('minAmount')!) : undefined,
        maxAmount: searchParams.get('maxAmount') ? parseFloat(searchParams.get('maxAmount')!) : undefined,
      },
      currentPage: parseInt(searchParams.get('page') || '1', 10),
      pageSize,
    };
  }, [searchParams, syncWithUrl, defaultPreset, pageSize]);

  const [state, setState] = useState<TransactionFiltersState>(getInitialState);

  // Sync state to URL
  const syncToUrl = useCallback((newState: TransactionFiltersState) => {
    if (!syncWithUrl) return;

    const params = new URLSearchParams();
    
    if (newState.datePreset !== defaultPreset) {
      params.set('preset', newState.datePreset);
    }
    if (newState.datePreset === 'custom' && newState.customStartDate) {
      params.set('startDate', newState.customStartDate);
    }
    if (newState.datePreset === 'custom' && newState.customEndDate) {
      params.set('endDate', newState.customEndDate);
    }
    if (newState.searchText) {
      params.set('search', newState.searchText);
    }
    if (newState.filter.accountIds?.length) {
      params.set('accounts', newState.filter.accountIds.join(','));
    }
    if (newState.filter.types?.length) {
      params.set('types', newState.filter.types.join(','));
    }
    if (newState.filter.labelIds?.length) {
      params.set('categories', newState.filter.labelIds.join(','));
    }
    if (newState.filter.tagIds?.length) {
      params.set('tags', newState.filter.tagIds.join(','));
    }
    if (newState.filter.isCleared !== undefined) {
      params.set('cleared', String(newState.filter.isCleared));
    }
    if (newState.filter.minAmount !== undefined) {
      params.set('minAmount', String(newState.filter.minAmount));
    }
    if (newState.filter.maxAmount !== undefined) {
      params.set('maxAmount', String(newState.filter.maxAmount));
    }
    if (newState.currentPage > 1) {
      params.set('page', String(newState.currentPage));
    }

    setSearchParams(params, { replace: true });
  }, [syncWithUrl, defaultPreset, setSearchParams]);

  // Actions
  const setDatePreset = useCallback((preset: DatePreset) => {
    setState(prev => {
      const newState = {
        ...prev,
        datePreset: preset,
        customStartDate: preset !== 'custom' ? '' : prev.customStartDate || formatDateForInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
        customEndDate: preset !== 'custom' ? '' : prev.customEndDate || formatDateForInput(new Date()),
        currentPage: 1,
      };
      syncToUrl(newState);
      return newState;
    });
  }, [syncToUrl]);

  const setCustomStartDate = useCallback((date: string) => {
    setState(prev => {
      const newState = { ...prev, customStartDate: date, currentPage: 1 };
      syncToUrl(newState);
      return newState;
    });
  }, [syncToUrl]);

  const setCustomEndDate = useCallback((date: string) => {
    setState(prev => {
      const newState = { ...prev, customEndDate: date, currentPage: 1 };
      syncToUrl(newState);
      return newState;
    });
  }, [syncToUrl]);

  const setSearchText = useCallback((text: string) => {
    setState(prev => {
      const newState = { ...prev, searchText: text, currentPage: 1 };
      // Don't sync search to URL immediately (debounce in component)
      return newState;
    });
  }, []);

  const setFilter = useCallback((filter: TransactionFilter) => {
    setState(prev => {
      const newState = { ...prev, filter, currentPage: 1 };
      syncToUrl(newState);
      return newState;
    });
  }, [syncToUrl]);

  const setCurrentPage = useCallback((page: number) => {
    setState(prev => {
      const newState = { ...prev, currentPage: page };
      syncToUrl(newState);
      return newState;
    });
  }, [syncToUrl]);

  const resetFilters = useCallback(() => {
    const newState: TransactionFiltersState = {
      datePreset: defaultPreset,
      customStartDate: '',
      customEndDate: '',
      searchText: '',
      filter: {},
      currentPage: 1,
      pageSize,
    };
    setState(newState);
    syncToUrl(newState);
  }, [defaultPreset, pageSize, syncToUrl]);

  // Computed values
  const getDateRange = useCallback((): { startDate: string; endDate: string } => {
    if (state.datePreset === 'custom') {
      return {
        startDate: state.customStartDate ? formatDateToStartOfDay(new Date(state.customStartDate)) : '',
        endDate: state.customEndDate ? formatDateToEndOfDay(new Date(state.customEndDate)) : '',
      };
    }
    const range = getDateRangeForPreset(state.datePreset);
    return {
      startDate: formatDateToStartOfDay(range.start),
      endDate: formatDateToEndOfDay(range.end),
    };
  }, [state.datePreset, state.customStartDate, state.customEndDate]);

  const getFullFilter = useCallback((): TransactionFilter => {
    const dateRange = getDateRange();
    return {
      ...state.filter,
      ...dateRange,
      searchText: state.searchText || undefined,
      page: state.currentPage,
      pageSize: state.pageSize,
    };
  }, [state, getDateRange]);

  const getActiveFilterCount = useCallback((): number => {
    return [
      state.filter.accountIds && state.filter.accountIds.length > 0,
      state.filter.types && state.filter.types.length > 0,
      state.filter.labelIds && state.filter.labelIds.length > 0,
      state.filter.tagIds && state.filter.tagIds.length > 0,
      state.filter.isCleared !== undefined,
      state.filter.minAmount !== undefined,
      state.filter.maxAmount !== undefined,
    ].filter(Boolean).length;
  }, [state.filter]);

  return {
    ...state,
    setDatePreset,
    setCustomStartDate,
    setCustomEndDate,
    setSearchText,
    setFilter,
    setCurrentPage,
    resetFilters,
    getDateRange,
    getFullFilter,
    getActiveFilterCount,
  };
}
