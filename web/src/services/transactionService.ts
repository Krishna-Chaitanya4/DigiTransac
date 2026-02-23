import { apiClient, API_BASE_URL } from './apiClient';
import { getStoredAccessToken } from './tokenStorage';
import type {
  Transaction,
  TransactionListResponse,
  TransactionSummary,
  RecurringTransaction,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  TransactionFilter,
  TransactionType,
  CounterpartyInfo,
  TopCounterpartiesResponse,
  SpendingByAccountResponse,
  SpendingPatternsResponse,
  SpendingAnomaliesResponse,
  LocationInsightsResponse,
  TripGroupsResponse,
} from '../types/transactions';

// Build query string from filter
function buildFilterQuery(filter: TransactionFilter): string {
  const params = new URLSearchParams();
  
  if (filter.startDate) params.append('startDate', filter.startDate);
  if (filter.endDate) params.append('endDate', filter.endDate);
  // Multiple account IDs - send as comma-separated string
  if (filter.accountIds && filter.accountIds.length > 0) {
    params.append('accountIds', filter.accountIds.join(','));
  }
  // Multiple types - handle Transfer as a UI-only concept
  if (filter.types && filter.types.length > 0) {
    // Filter out 'Transfer' - it's a UI concept, not an API type
    // Transfer means transactions with linkedTransactionId
    const hasTransferFilter = filter.types.includes('Transfer');
    const apiTypes = filter.types.filter(t => t !== 'Transfer') as TransactionType[];
    
    if (apiTypes.length > 0) {
      params.append('types', apiTypes.join(','));
    }
    
    // If Transfer filter is selected, add a parameter for linked transactions
    if (hasTransferFilter) {
      params.append('hasLinkedTransaction', 'true');
    }
  }
  // Multiple label IDs (categories) - send as comma-separated string
  if (filter.labelIds && filter.labelIds.length > 0) {
    params.append('labelIds', filter.labelIds.join(','));
  }
  // Multiple tag IDs - send as comma-separated string
  if (filter.tagIds && filter.tagIds.length > 0) {
    params.append('tagIds', filter.tagIds.join(','));
  }
  // Multiple counterparty user IDs - send as comma-separated string
  if (filter.counterpartyUserIds && filter.counterpartyUserIds.length > 0) {
    params.append('counterpartyUserIds', filter.counterpartyUserIds.join(','));
  }
  if (filter.minAmount !== undefined) params.append('minAmount', filter.minAmount.toString());
  if (filter.maxAmount !== undefined) params.append('maxAmount', filter.maxAmount.toString());
  if (filter.searchText) params.append('searchText', filter.searchText);
  if (filter.status) params.append('status', filter.status);
  if (filter.isRecurring !== undefined) params.append('isRecurring', filter.isRecurring.toString());
  if (filter.page !== undefined) params.append('page', filter.page.toString());
  if (filter.pageSize !== undefined) params.append('pageSize', filter.pageSize.toString());
  
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

// Get transactions with filters
export async function getTransactions(filter: TransactionFilter = {}): Promise<TransactionListResponse> {
  const query = buildFilterQuery(filter);
  return apiClient.get<TransactionListResponse>(`/transactions${query}`);
}

// Get transaction by ID
export async function getTransaction(id: string): Promise<Transaction> {
  return apiClient.get<Transaction>(`/transactions/${id}`);
}

// Get transaction summary (supports all filter parameters)
export async function getTransactionSummary(
  filter: TransactionFilter
): Promise<TransactionSummary> {
  // Reuse buildFilterQuery — strip page/pageSize since summary doesn't paginate
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { page: _, pageSize: __, searchText: ___, isRecurring: ____, ...summaryFilter } = filter;
  const query = buildFilterQuery(summaryFilter as TransactionFilter);
  return apiClient.get<TransactionSummary>(`/transactions/summary${query}`);
}

// Get recurring transactions
export async function getRecurringTransactions(): Promise<RecurringTransaction[]> {
  return apiClient.get<RecurringTransaction[]>('/transactions/recurring');
}

// Get counterparties (users the current user has transacted with)
export async function getCounterparties(): Promise<CounterpartyInfo[]> {
  return apiClient.get<CounterpartyInfo[]>('/transactions/counterparties');
}

// Create transaction
export async function createTransaction(request: CreateTransactionRequest): Promise<Transaction> {
  return apiClient.post<Transaction>('/transactions', request);
}

// Update transaction
export async function updateTransaction(id: string, request: UpdateTransactionRequest): Promise<Transaction> {
  return apiClient.put<Transaction>(`/transactions/${id}`, request);
}

// Delete transaction (soft-delete with 24-hour undo window)
export async function deleteTransaction(id: string): Promise<void> {
  return apiClient.delete(`/transactions/${id}`);
}

// Restore a soft-deleted transaction (within 24-hour undo window)
export async function restoreTransaction(id: string): Promise<void> {
  return apiClient.post(`/transactions/${id}/restore`);
}

// Delete recurring transaction
export async function deleteRecurringTransaction(id: string, deleteFutureInstances = false): Promise<void> {
  return apiClient.delete(`/transactions/recurring/${id}?deleteFutureInstances=${deleteFutureInstances}`);
}

// Update transaction status
export async function updateStatus(id: string, status: 'Pending' | 'Confirmed' | 'Declined'): Promise<Transaction> {
  return updateTransaction(id, { status });
}

// Batch Operations
export interface BatchOperationResponse {
  successCount: number;
  failedCount: number;
  failedIds: string[];
  message: string;
}

export async function batchDelete(ids: string[]): Promise<BatchOperationResponse> {
  return apiClient.post<BatchOperationResponse>('/transactions/batch', {
    ids,
    action: 'delete',
  });
}

export async function batchMarkConfirmed(ids: string[]): Promise<BatchOperationResponse> {
  return apiClient.post<BatchOperationResponse>('/transactions/batch', {
    ids,
    action: 'markconfirmed',
  });
}

export async function batchMarkPending(ids: string[]): Promise<BatchOperationResponse> {
  return apiClient.post<BatchOperationResponse>('/transactions/batch', {
    ids,
    action: 'markpending',
  });
}

// Analytics
export interface CategoryBreakdown {
  labelId: string;
  labelName: string;
  labelIcon?: string;
  labelColor?: string;
  amount: number;
  transactionCount: number;
  percentage: number;
}

export interface SpendingTrend {
  period: string;
  credits: number;
  debits: number;
  net: number;
  transactionCount: number;
}

export interface AveragesByType {
  averageCredit: number;
  averageDebit: number;
  averageTransfer: number;
}

export interface TransactionAnalytics {
  topCategories: CategoryBreakdown[];
  topIncomeCategories: CategoryBreakdown[];
  spendingTrend: SpendingTrend[];
  averagesByType: AveragesByType;
  dailyAverage: number;
  monthlyAverage: number;
}

export async function getAnalytics(
  startDate?: string,
  endDate?: string,
  accountId?: string
): Promise<TransactionAnalytics> {
  const query = buildDateRangeParams(startDate, endDate, { accountId });
  return apiClient.get<TransactionAnalytics>(`/transactions/analytics${query}`);
}

// Export
export async function exportTransactions(
  filter: TransactionFilter,
  format: 'csv' | 'json' = 'json'
): Promise<Transaction[] | string> {
  // Reuse buildFilterQuery for consistent filter handling, then append format
  const filterQuery = buildFilterQuery({ ...filter, page: undefined, pageSize: undefined });
  const separator = filterQuery ? '&' : '?';
  const query = `${filterQuery}${separator}format=${format}`;
  
  if (format === 'csv') {
    // For CSV, we need to get the raw text response (apiClient parses JSON)
    const token = getStoredAccessToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/transactions/export${query}`, {
      headers,
      credentials: 'include',
    });
    return response.text();
  }
  
  return apiClient.get<Transaction[]>(`/transactions/export${query}`);
}

// Helper functions for inclusive date range handling
const formatDateToStartOfDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00.000Z`;
};

const formatDateToEndOfDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T23:59:59.999Z`;
};

// Helper: Get transactions for current month
export async function getCurrentMonthTransactions(accountId?: string): Promise<TransactionListResponse> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  return getTransactions({
    startDate: formatDateToStartOfDay(startOfMonth),
    endDate: formatDateToEndOfDay(endOfMonth),
    accountIds: accountId ? [accountId] : undefined,
    pageSize: 100,
  });
}

// Helper: Get transactions for a specific date range (dates are inclusive)
export async function getTransactionsByDateRange(
  startDate: Date,
  endDate: Date,
  accountId?: string
): Promise<TransactionListResponse> {
  return getTransactions({
    startDate: formatDateToStartOfDay(startDate),
    endDate: formatDateToEndOfDay(endDate),
    accountIds: accountId ? [accountId] : undefined,
    pageSize: 100,
  });
}

// P2P Pending Transactions
export async function getPendingCount(): Promise<number> {
  const response = await apiClient.get<{ count: number }>('/transactions/pending/count');
  return response.count;
}

// ============ Extended Analytics APIs ============

// Build query params for date-range-based analytics endpoints
function buildDateRangeParams(
  startDate?: string,
  endDate?: string,
  extra?: Record<string, string | number | undefined>
): string {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) params.append(key, value.toString());
    }
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

// Get top counterparties (payees) spending breakdown
export async function getTopCounterparties(
  startDate?: string,
  endDate?: string,
  pageSize = 10,
  page = 1
): Promise<TopCounterpartiesResponse> {
  const query = buildDateRangeParams(startDate, endDate, { page, pageSize });
  return apiClient.get<TopCounterpartiesResponse>(`/transactions/analytics/counterparties${query}`);
}

// Get spending breakdown by account
export async function getSpendingByAccount(
  startDate?: string,
  endDate?: string
): Promise<SpendingByAccountResponse> {
  const query = buildDateRangeParams(startDate, endDate);
  return apiClient.get<SpendingByAccountResponse>(`/transactions/analytics/by-account${query}`);
}

// Get spending patterns (by day of week and hour of day)
export async function getSpendingPatterns(
  startDate?: string,
  endDate?: string
): Promise<SpendingPatternsResponse> {
  const query = buildDateRangeParams(startDate, endDate);
  return apiClient.get<SpendingPatternsResponse>(`/transactions/analytics/patterns${query}`);
}

// Get spending anomalies and alerts
export async function getSpendingAnomalies(
  startDate?: string,
  endDate?: string
): Promise<SpendingAnomaliesResponse> {
  const query = buildDateRangeParams(startDate, endDate);
  return apiClient.get<SpendingAnomaliesResponse>(`/transactions/analytics/anomalies${query}`);
}

// Get location-based spending insights
export async function getLocationInsights(
  startDate?: string,
  endDate?: string,
  latitude?: number,
  longitude?: number,
  radiusKm?: number
): Promise<LocationInsightsResponse> {
  const query = buildDateRangeParams(startDate, endDate, { latitude, longitude, radiusKm });
  return apiClient.get<LocationInsightsResponse>(`/transactions/analytics/locations${query}`);
}

// Get trip groups (travel spending analysis)
export async function getTripGroups(
  startDate?: string,
  endDate?: string,
  homeLatitude?: number,
  homeLongitude?: number,
  minTripDistanceKm?: number
): Promise<TripGroupsResponse> {
  const query = buildDateRangeParams(startDate, endDate, { homeLatitude, homeLongitude, minTripDistanceKm });
  return apiClient.get<TripGroupsResponse>(`/transactions/analytics/trips${query}`);
}
