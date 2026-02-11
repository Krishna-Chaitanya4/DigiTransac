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
  const params = new URLSearchParams();
  if (filter.startDate) params.append('startDate', filter.startDate);
  if (filter.endDate) params.append('endDate', filter.endDate);
  if (filter.accountIds?.length) params.append('accountIds', filter.accountIds.join(','));
  
  // Handle types filter - translate Transfer to hasLinkedTransaction
  if (filter.types?.length) {
    const hasTransferFilter = filter.types.includes('Transfer');
    const apiTypes = filter.types.filter(t => t !== 'Transfer') as TransactionType[];
    
    if (apiTypes.length > 0) {
      params.append('types', apiTypes.join(','));
    }
    if (hasTransferFilter) {
      params.append('hasLinkedTransaction', 'true');
    }
  }
  
  if (filter.labelIds?.length) params.append('labelIds', filter.labelIds.join(','));
  if (filter.tagIds?.length) params.append('tagIds', filter.tagIds.join(','));
  if (filter.counterpartyUserIds?.length) params.append('counterpartyUserIds', filter.counterpartyUserIds.join(','));
  if (filter.minAmount !== undefined) params.append('minAmount', filter.minAmount.toString());
  if (filter.maxAmount !== undefined) params.append('maxAmount', filter.maxAmount.toString());
  if (filter.status) params.append('status', filter.status);
  
  const query = params.toString();
  return apiClient.get<TransactionSummary>(`/transactions/summary${query ? `?${query}` : ''}`);
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

// Delete transaction
export async function deleteTransaction(id: string): Promise<void> {
  return apiClient.delete(`/transactions/${id}`);
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
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (accountId) params.append('accountId', accountId);
  
  const query = params.toString();
  return apiClient.get<TransactionAnalytics>(`/transactions/analytics${query ? `?${query}` : ''}`);
}

// Export
export async function exportTransactions(
  filter: TransactionFilter,
  format: 'csv' | 'json' = 'json'
): Promise<Transaction[] | string> {
  const params = new URLSearchParams();
  if (filter.startDate) params.append('startDate', filter.startDate);
  if (filter.endDate) params.append('endDate', filter.endDate);
  if (filter.accountIds?.length) params.append('accountIds', filter.accountIds.join(','));
  if (filter.types?.length) params.append('types', filter.types.join(','));
  if (filter.labelIds?.length) params.append('labelIds', filter.labelIds.join(','));
  if (filter.tagIds?.length) params.append('tagIds', filter.tagIds.join(','));
  params.append('format', format);
  
  const query = params.toString();
  
  if (format === 'csv') {
    // For CSV, we need to get the raw text response (apiClient parses JSON)
    const token = getStoredAccessToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/transactions/export?${query}`, {
      headers,
      credentials: 'include',
    });
    return response.text();
  }
  
  return apiClient.get<Transaction[]>(`/transactions/export?${query}`);
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

// Get top counterparties (payees) spending breakdown
export async function getTopCounterparties(
  startDate?: string,
  endDate?: string,
  pageSize = 10,
  page = 1
): Promise<TopCounterpartiesResponse> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  params.append('page', page.toString());
  params.append('pageSize', pageSize.toString());
  
  const query = params.toString();
  return apiClient.get<TopCounterpartiesResponse>(`/transactions/analytics/counterparties?${query}`);
}

// Get spending breakdown by account
export async function getSpendingByAccount(
  startDate?: string,
  endDate?: string
): Promise<SpendingByAccountResponse> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const query = params.toString();
  return apiClient.get<SpendingByAccountResponse>(`/transactions/analytics/by-account${query ? `?${query}` : ''}`);
}

// Get spending patterns (by day of week and hour of day)
export async function getSpendingPatterns(
  startDate?: string,
  endDate?: string
): Promise<SpendingPatternsResponse> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const query = params.toString();
  return apiClient.get<SpendingPatternsResponse>(`/transactions/analytics/patterns${query ? `?${query}` : ''}`);
}

// Get spending anomalies and alerts
export async function getSpendingAnomalies(
  startDate?: string,
  endDate?: string
): Promise<SpendingAnomaliesResponse> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const query = params.toString();
  return apiClient.get<SpendingAnomaliesResponse>(`/transactions/analytics/anomalies${query ? `?${query}` : ''}`);
}

// Get location-based spending insights
export async function getLocationInsights(
  startDate?: string,
  endDate?: string,
  latitude?: number,
  longitude?: number,
  radiusKm?: number
): Promise<LocationInsightsResponse> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (latitude !== undefined) params.append('latitude', latitude.toString());
  if (longitude !== undefined) params.append('longitude', longitude.toString());
  if (radiusKm !== undefined) params.append('radiusKm', radiusKm.toString());
  
  const query = params.toString();
  return apiClient.get<LocationInsightsResponse>(`/transactions/analytics/locations${query ? `?${query}` : ''}`);
}

// Get trip groups (travel spending analysis)
export async function getTripGroups(
  startDate?: string,
  endDate?: string,
  homeLatitude?: number,
  homeLongitude?: number,
  minTripDistanceKm?: number
): Promise<TripGroupsResponse> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (homeLatitude !== undefined) params.append('homeLatitude', homeLatitude.toString());
  if (homeLongitude !== undefined) params.append('homeLongitude', homeLongitude.toString());
  if (minTripDistanceKm !== undefined) params.append('minTripDistanceKm', minTripDistanceKm.toString());
  
  const query = params.toString();
  return apiClient.get<TripGroupsResponse>(`/transactions/analytics/trips${query ? `?${query}` : ''}`);
}
