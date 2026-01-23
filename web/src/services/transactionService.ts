import { apiClient } from './apiClient';
import type {
  Transaction,
  TransactionListResponse,
  TransactionSummary,
  RecurringTransaction,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  TransactionFilter,
  TransactionType,
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
  if (filter.minAmount !== undefined) params.append('minAmount', filter.minAmount.toString());
  if (filter.maxAmount !== undefined) params.append('maxAmount', filter.maxAmount.toString());
  if (filter.searchText) params.append('searchText', filter.searchText);
  if (filter.isCleared !== undefined) params.append('isCleared', filter.isCleared.toString());
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
  if (filter.minAmount !== undefined) params.append('minAmount', filter.minAmount.toString());
  if (filter.maxAmount !== undefined) params.append('maxAmount', filter.maxAmount.toString());
  if (filter.isCleared !== undefined) params.append('isCleared', filter.isCleared.toString());
  
  const query = params.toString();
  return apiClient.get<TransactionSummary>(`/transactions/summary${query ? `?${query}` : ''}`);
}

// Get recurring transactions
export async function getRecurringTransactions(): Promise<RecurringTransaction[]> {
  return apiClient.get<RecurringTransaction[]>('/transactions/recurring');
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

// Toggle transaction cleared status
export async function toggleCleared(id: string, isCleared: boolean): Promise<Transaction> {
  return updateTransaction(id, { isCleared });
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

export async function batchMarkCleared(ids: string[]): Promise<BatchOperationResponse> {
  return apiClient.post<BatchOperationResponse>('/transactions/batch', {
    ids,
    action: 'markCleared',
  });
}

export async function batchMarkPending(ids: string[]): Promise<BatchOperationResponse> {
  return apiClient.post<BatchOperationResponse>('/transactions/batch', {
    ids,
    action: 'markPending',
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
    // For CSV, we need to get the raw text response
    const token = localStorage.getItem('digitransac_access_token');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`/api/transactions/export?${query}`, {
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
import type {
  PendingP2PListResponse,
  AcceptP2PRequest,
  RejectP2PRequest,
} from '../types/transactions';

export async function getPendingP2PTransactions(): Promise<PendingP2PListResponse> {
  return apiClient.get<PendingP2PListResponse>('/transactions/pending-p2p');
}

export async function getPendingP2PCount(): Promise<number> {
  const response = await apiClient.get<{ count: number }>('/transactions/pending-p2p/count');
  return response.count;
}

export async function acceptP2PTransaction(id: string, request: AcceptP2PRequest): Promise<Transaction> {
  return apiClient.post<Transaction>(`/transactions/${id}/accept`, request);
}

export async function rejectP2PTransaction(id: string, request?: RejectP2PRequest): Promise<void> {
  await apiClient.post(`/transactions/${id}/reject`, request ?? {});
}
