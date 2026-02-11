import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the apiClient module
vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  API_BASE_URL: '/api',
}));

// Mock fetch for export tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('transactionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildFilterQuery', () => {
    it('should build query string with multiple accountIds', async () => {
      const { apiClient } = await import('./apiClient');
      const { getTransactions } = await import('./transactionService');

      vi.mocked(apiClient.get).mockResolvedValue({
        transactions: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
      });

      await getTransactions({
        accountIds: ['acc-1', 'acc-2', 'acc-3'],
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('accountIds=acc-1%2Cacc-2%2Cacc-3')
      );
    });

    it('should build query string with multiple types', async () => {
      const { apiClient } = await import('./apiClient');
      const { getTransactions } = await import('./transactionService');

      vi.mocked(apiClient.get).mockResolvedValue({
        transactions: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
      });

      await getTransactions({
        types: ['Send', 'Receive'],
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('types=Send%2CReceive')
      );
    });

    it('should build query string with multiple labelIds', async () => {
      const { apiClient } = await import('./apiClient');
      const { getTransactions } = await import('./transactionService');

      vi.mocked(apiClient.get).mockResolvedValue({
        transactions: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
      });

      await getTransactions({
        labelIds: ['label-1', 'label-2'],
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('labelIds=label-1%2Clabel-2')
      );
    });

    it('should build query string with multiple tagIds', async () => {
      const { apiClient } = await import('./apiClient');
      const { getTransactions } = await import('./transactionService');

      vi.mocked(apiClient.get).mockResolvedValue({
        transactions: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
      });

      await getTransactions({
        tagIds: ['tag-1', 'tag-2', 'tag-3'],
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('tagIds=tag-1%2Ctag-2%2Ctag-3')
      );
    });

    it('should build query string with all filters combined', async () => {
      const { apiClient } = await import('./apiClient');
      const { getTransactions } = await import('./transactionService');

      vi.mocked(apiClient.get).mockResolvedValue({
        transactions: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
      });

      await getTransactions({
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T23:59:59.999Z',
        accountIds: ['acc-1'],
        types: ['Send'],
        labelIds: ['label-1'],
        tagIds: ['tag-1'],
        searchText: 'grocery',
        minAmount: 10,
        maxAmount: 100,
        status: 'Confirmed',
      });

      const callArg = vi.mocked(apiClient.get).mock.calls[0][0];
      expect(callArg).toContain('startDate=');
      expect(callArg).toContain('endDate=');
      expect(callArg).toContain('accountIds=acc-1');
      expect(callArg).toContain('types=Send');
      expect(callArg).toContain('labelIds=label-1');
      expect(callArg).toContain('tagIds=tag-1');
      expect(callArg).toContain('searchText=grocery');
      expect(callArg).toContain('minAmount=10');
      expect(callArg).toContain('maxAmount=100');
      expect(callArg).toContain('status=Confirmed');
    });

    it('should not include empty arrays in query string', async () => {
      const { apiClient } = await import('./apiClient');
      const { getTransactions } = await import('./transactionService');

      vi.mocked(apiClient.get).mockResolvedValue({
        transactions: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
      });

      await getTransactions({
        accountIds: [],
        types: [],
        labelIds: [],
        tagIds: [],
      });

      const callArg = vi.mocked(apiClient.get).mock.calls[0][0];
      expect(callArg).not.toContain('accountIds');
      expect(callArg).not.toContain('types');
      expect(callArg).not.toContain('labelIds');
      expect(callArg).not.toContain('tagIds');
    });

    it('should not include undefined values in query string', async () => {
      const { apiClient } = await import('./apiClient');
      const { getTransactions } = await import('./transactionService');

      vi.mocked(apiClient.get).mockResolvedValue({
        transactions: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
      });

      await getTransactions({});

      const callArg = vi.mocked(apiClient.get).mock.calls[0][0];
      expect(callArg).toBe('/transactions');
    });
  });

  describe('getTransactionSummary', () => {
    it('should call summary endpoint with filter parameters', async () => {
      const { apiClient } = await import('./apiClient');
      const { getTransactionSummary } = await import('./transactionService');

      vi.mocked(apiClient.get).mockResolvedValue({
        totalCredits: 1000,
        totalDebits: 500,
        netAmount: 500,
        transactionCount: 10,
        currency: 'USD',
      });

      await getTransactionSummary({
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T23:59:59.999Z',
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/transactions/summary')
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('startDate=')
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('endDate=')
      );
    });

    it('should include all filter parameters when provided', async () => {
      const { apiClient } = await import('./apiClient');
      const { getTransactionSummary } = await import('./transactionService');

      vi.mocked(apiClient.get).mockResolvedValue({
        totalCredits: 1000,
        totalDebits: 500,
        netAmount: 500,
        transactionCount: 10,
        currency: 'USD',
      });

      await getTransactionSummary({
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T23:59:59.999Z',
        accountIds: ['acc-123'],
        types: ['Send'],
        labelIds: ['label-1'],
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('accountIds=acc-123')
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('types=Send')
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('labelIds=label-1')
      );
    });
  });

  describe('getTransaction', () => {
    it('should get a single transaction by ID', async () => {
      const { apiClient } = await import('./apiClient');
      const { getTransaction } = await import('./transactionService');

      const mockTransaction = {
        id: 'txn-123',
        amount: 100,
        description: 'Test transaction',
        type: 'Send',
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockTransaction);

      const result = await getTransaction('txn-123');

      expect(apiClient.get).toHaveBeenCalledWith('/transactions/txn-123');
      expect(result).toEqual(mockTransaction);
    });
  });

  describe('getRecurringTransactions', () => {
    it('should get recurring transactions', async () => {
      const { apiClient } = await import('./apiClient');
      const { getRecurringTransactions } = await import('./transactionService');

      const mockRecurring = [
        { id: 'rec-1', frequency: 'Monthly' },
        { id: 'rec-2', frequency: 'Weekly' },
      ];

      vi.mocked(apiClient.get).mockResolvedValue(mockRecurring);

      const result = await getRecurringTransactions();

      expect(apiClient.get).toHaveBeenCalledWith('/transactions/recurring');
      expect(result).toEqual(mockRecurring);
    });
  });

  describe('createTransaction', () => {
    it('should create a new transaction', async () => {
      const { apiClient } = await import('./apiClient');
      const { createTransaction } = await import('./transactionService');

      const request = {
        amount: 50,
        description: 'New transaction',
        type: 'Send' as const,
        accountId: 'acc-1',
        date: '2024-01-15',
        splits: [],
      };

      const mockResponse = { id: 'txn-new', ...request };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const result = await createTransaction(request);

      expect(apiClient.post).toHaveBeenCalledWith('/transactions', request);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateTransaction', () => {
    it('should update an existing transaction', async () => {
      const { apiClient } = await import('./apiClient');
      const { updateTransaction } = await import('./transactionService');

      const request = { amount: 75, description: 'Updated' };
      const mockResponse = { id: 'txn-123', ...request };
      vi.mocked(apiClient.put).mockResolvedValue(mockResponse);

      const result = await updateTransaction('txn-123', request);

      expect(apiClient.put).toHaveBeenCalledWith('/transactions/txn-123', request);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteTransaction', () => {
    it('should delete a transaction', async () => {
      const { apiClient } = await import('./apiClient');
      const { deleteTransaction } = await import('./transactionService');

      vi.mocked(apiClient.delete).mockResolvedValue(undefined);

      await deleteTransaction('txn-123');

      expect(apiClient.delete).toHaveBeenCalledWith('/transactions/txn-123');
    });
  });

  describe('deleteRecurringTransaction', () => {
    it('should delete recurring transaction without future instances', async () => {
      const { apiClient } = await import('./apiClient');
      const { deleteRecurringTransaction } = await import('./transactionService');

      vi.mocked(apiClient.delete).mockResolvedValue(undefined);

      await deleteRecurringTransaction('rec-123');

      expect(apiClient.delete).toHaveBeenCalledWith('/transactions/recurring/rec-123?deleteFutureInstances=false');
    });

    it('should delete recurring transaction with future instances', async () => {
      const { apiClient } = await import('./apiClient');
      const { deleteRecurringTransaction } = await import('./transactionService');

      vi.mocked(apiClient.delete).mockResolvedValue(undefined);

      await deleteRecurringTransaction('rec-123', true);

      expect(apiClient.delete).toHaveBeenCalledWith('/transactions/recurring/rec-123?deleteFutureInstances=true');
    });
  });

  describe('updateStatus', () => {
    it('should update transaction status', async () => {
      const { apiClient } = await import('./apiClient');
      const { updateStatus } = await import('./transactionService');

      const mockResponse = { id: 'txn-123', status: 'Confirmed' };
      vi.mocked(apiClient.put).mockResolvedValue(mockResponse);

      const result = await updateStatus('txn-123', 'Confirmed');

      expect(apiClient.put).toHaveBeenCalledWith('/transactions/txn-123', { status: 'Confirmed' });
      expect(result.status).toBe('Confirmed');
    });
  });

  describe('Batch Operations', () => {
    it('should batch delete transactions', async () => {
      const { apiClient } = await import('./apiClient');
      const { batchDelete } = await import('./transactionService');

      const mockResponse = { successCount: 3, failedCount: 0, failedIds: [], message: 'Deleted' };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const result = await batchDelete(['txn-1', 'txn-2', 'txn-3']);

      expect(apiClient.post).toHaveBeenCalledWith('/transactions/batch', {
        ids: ['txn-1', 'txn-2', 'txn-3'],
        action: 'delete',
      });
      expect(result.successCount).toBe(3);
    });

    it('should batch mark confirmed', async () => {
      const { apiClient } = await import('./apiClient');
      const { batchMarkConfirmed } = await import('./transactionService');

      const mockResponse = { successCount: 2, failedCount: 0, failedIds: [], message: 'Marked' };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const result = await batchMarkConfirmed(['txn-1', 'txn-2']);

      expect(apiClient.post).toHaveBeenCalledWith('/transactions/batch', {
        ids: ['txn-1', 'txn-2'],
        action: 'markconfirmed',
      });
      expect(result.successCount).toBe(2);
    });

    it('should batch mark pending', async () => {
      const { apiClient } = await import('./apiClient');
      const { batchMarkPending } = await import('./transactionService');

      const mockResponse = { successCount: 2, failedCount: 0, failedIds: [], message: 'Marked' };
      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      const result = await batchMarkPending(['txn-1', 'txn-2']);

      expect(apiClient.post).toHaveBeenCalledWith('/transactions/batch', {
        ids: ['txn-1', 'txn-2'],
        action: 'markpending',
      });
      expect(result.successCount).toBe(2);
    });
  });

  describe('getAnalytics', () => {
    it('should get analytics with all parameters', async () => {
      const { apiClient } = await import('./apiClient');
      const { getAnalytics } = await import('./transactionService');

      const mockAnalytics = {
        topCategories: [],
        spendingTrend: [],
        averagesByType: { averageCredit: 100, averageDebit: 50, averageTransfer: 25 },
        dailyAverage: 10,
        monthlyAverage: 300,
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockAnalytics);

      const result = await getAnalytics('2024-01-01', '2024-12-31', 'acc-1');

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/transactions/analytics')
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2024-01-01')
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('endDate=2024-12-31')
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('accountId=acc-1')
      );
      expect(result).toEqual(mockAnalytics);
    });

    it('should get analytics without parameters', async () => {
      const { apiClient } = await import('./apiClient');
      const { getAnalytics } = await import('./transactionService');

      vi.mocked(apiClient.get).mockResolvedValue({});

      await getAnalytics();

      expect(apiClient.get).toHaveBeenCalledWith('/transactions/analytics');
    });
  });

  describe('exportTransactions', () => {
    it('should export transactions as JSON', async () => {
      const { apiClient } = await import('./apiClient');
      const { exportTransactions } = await import('./transactionService');

      const mockTransactions = [{ id: 'txn-1' }, { id: 'txn-2' }];
      vi.mocked(apiClient.get).mockResolvedValue(mockTransactions);

      const result = await exportTransactions({ startDate: '2024-01-01' }, 'json');

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/transactions/export')
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('format=json')
      );
      expect(result).toEqual(mockTransactions);
    });

    it('should export transactions as CSV', async () => {
      const { exportTransactions } = await import('./transactionService');

      localStorageMock.getItem.mockReturnValue('test-token');
      mockFetch.mockResolvedValue({
        text: () => Promise.resolve('id,amount\ntxn-1,100'),
      });

      const result = await exportTransactions({ startDate: '2024-01-01' }, 'csv');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/transactions/export'),
        expect.objectContaining({
          headers: { 'Authorization': 'Bearer test-token' },
          credentials: 'include',
        })
      );
      expect(result).toBe('id,amount\ntxn-1,100');
    });
  });

  describe('Helper Functions', () => {
    it('should get current month transactions', async () => {
      const { apiClient } = await import('./apiClient');
      const { getCurrentMonthTransactions } = await import('./transactionService');

      vi.mocked(apiClient.get).mockResolvedValue({
        transactions: [],
        totalCount: 0,
        page: 1,
        pageSize: 100,
        totalPages: 0,
      });

      await getCurrentMonthTransactions('acc-1');

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('accountIds=acc-1')
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('pageSize=100')
      );
    });

    it('should get transactions by date range', async () => {
      const { apiClient } = await import('./apiClient');
      const { getTransactionsByDateRange } = await import('./transactionService');

      vi.mocked(apiClient.get).mockResolvedValue({
        transactions: [],
        totalCount: 0,
        page: 1,
        pageSize: 100,
        totalPages: 0,
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await getTransactionsByDateRange(startDate, endDate, 'acc-1');

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2024-01-01')
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('endDate=2024-01-31')
      );
    });
  });
});
