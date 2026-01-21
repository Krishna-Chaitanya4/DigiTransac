import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the apiClient module
vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

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
        types: ['Debit', 'Credit'],
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('types=Debit%2CCredit')
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
        types: ['Debit'],
        labelIds: ['label-1'],
        tagIds: ['tag-1'],
        searchText: 'grocery',
        minAmount: 10,
        maxAmount: 100,
        isCleared: true,
      });

      const callArg = vi.mocked(apiClient.get).mock.calls[0][0];
      expect(callArg).toContain('startDate=');
      expect(callArg).toContain('endDate=');
      expect(callArg).toContain('accountIds=acc-1');
      expect(callArg).toContain('types=Debit');
      expect(callArg).toContain('labelIds=label-1');
      expect(callArg).toContain('tagIds=tag-1');
      expect(callArg).toContain('searchText=grocery');
      expect(callArg).toContain('minAmount=10');
      expect(callArg).toContain('maxAmount=100');
      expect(callArg).toContain('isCleared=true');
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
        types: ['Debit'],
        labelIds: ['label-1'],
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('accountIds=acc-123')
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('types=Debit')
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('labelIds=label-1')
      );
    });
  });
});
