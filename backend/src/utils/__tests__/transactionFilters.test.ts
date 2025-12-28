import {
  buildApprovedTransactionsFilter,
  buildTransactionFilter,
  ReviewStatus,
  TransactionType,
  TransactionFilterOptions,
} from '../transactionFilters';

describe('TransactionFilters', () => {
  const mockUserId = 'user123';

  describe('buildApprovedTransactionsFilter', () => {
    it('should build filter with userId and approved status', () => {
      const filter = buildApprovedTransactionsFilter(mockUserId);

      expect(filter).toEqual({
        userId: mockUserId,
        reviewStatus: ReviewStatus.APPROVED,
      });
    });

    it('should include additional filters', () => {
      const filter = buildApprovedTransactionsFilter(mockUserId, {
        type: TransactionType.DEBIT,
        date: { $gte: new Date('2024-01-01') },
      });

      expect(filter.userId).toBe(mockUserId);
      expect(filter.reviewStatus).toBe(ReviewStatus.APPROVED);
      expect(filter.type).toBe(TransactionType.DEBIT);
      expect(filter.date).toEqual({ $gte: new Date('2024-01-01') });
    });

    it('should work with empty additional filters', () => {
      const filter = buildApprovedTransactionsFilter(mockUserId, {});

      expect(filter).toEqual({
        userId: mockUserId,
        reviewStatus: ReviewStatus.APPROVED,
      });
    });
  });

  describe('buildTransactionFilter', () => {
    it('should build filter with only userId when no options provided', () => {
      const options: TransactionFilterOptions = { userId: mockUserId };
      const filter = buildTransactionFilter(options);

      expect(filter).toEqual({
        userId: mockUserId,
      });
    });

    it('should add single transaction type to filter', () => {
      const options: TransactionFilterOptions = {
        userId: mockUserId,
        type: TransactionType.DEBIT,
      };
      const filter = buildTransactionFilter(options);

      expect(filter.userId).toBe(mockUserId);
      expect(filter.type).toBe(TransactionType.DEBIT);
    });

    it('should add multiple transaction types with $in operator', () => {
      const options: TransactionFilterOptions = {
        userId: mockUserId,
        type: [TransactionType.DEBIT, TransactionType.CREDIT],
      };
      const filter = buildTransactionFilter(options);

      expect(filter.userId).toBe(mockUserId);
      expect(filter.type).toEqual({ $in: [TransactionType.DEBIT, TransactionType.CREDIT] });
    });

    it('should add review status to filter', () => {
      const options: TransactionFilterOptions = {
        userId: mockUserId,
        reviewStatus: ReviewStatus.PENDING,
      };
      const filter = buildTransactionFilter(options);

      expect(filter.userId).toBe(mockUserId);
      expect(filter.reviewStatus).toBe(ReviewStatus.PENDING);
    });

    it('should add date range filter', () => {
      const startDate = new Date('2024-01-01T00:00:00.000Z');
      const endDate = new Date('2024-01-31T23:59:59.999Z');
      const options: TransactionFilterOptions = {
        userId: mockUserId,
        startDate,
        endDate,
      };
      const filter = buildTransactionFilter(options);

      expect(filter.userId).toBe(mockUserId);
      expect(filter.date).toEqual({
        $gte: startDate,
        $lte: endDate,
      });
    });

    it('should add account ID filter', () => {
      const options: TransactionFilterOptions = {
        userId: mockUserId,
        accountId: 'acc123',
      };
      const filter = buildTransactionFilter(options);

      expect(filter.userId).toBe(mockUserId);
      expect(filter.accountId).toBe('acc123');
    });

    it('should add category filter with $in operator', () => {
      const options: TransactionFilterOptions = {
        userId: mockUserId,
        categoryIds: ['cat1', 'cat2'],
      };
      const filter = buildTransactionFilter(options);

      expect(filter.userId).toBe(mockUserId);
      expect(filter.categoryId).toEqual({ $in: ['cat1', 'cat2'] });
    });

    it('should add tags filter with $in operator', () => {
      const options: TransactionFilterOptions = {
        userId: mockUserId,
        tags: ['tag1', 'tag2'],
      };
      const filter = buildTransactionFilter(options);

      expect(filter.userId).toBe(mockUserId);
      expect(filter.tags).toEqual({ $in: ['tag1', 'tag2'] });
    });

    it('should combine multiple filter options correctly', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const options: TransactionFilterOptions = {
        userId: mockUserId,
        type: TransactionType.DEBIT,
        reviewStatus: ReviewStatus.APPROVED,
        startDate,
        endDate,
        accountId: 'acc1',
        categoryIds: ['cat1'],
        tags: ['important'],
      };
      const filter = buildTransactionFilter(options);

      expect(filter.userId).toBe(mockUserId);
      expect(filter.type).toBe(TransactionType.DEBIT);
      expect(filter.reviewStatus).toBe(ReviewStatus.APPROVED);
      expect(filter.date).toEqual({ $gte: startDate, $lte: endDate });
      expect(filter.accountId).toBe('acc1');
      expect(filter.categoryId).toEqual({ $in: ['cat1'] });
      expect(filter.tags).toEqual({ $in: ['important'] });
    });
  });

  describe('Type Safety', () => {
    it('should enforce ReviewStatus enum values', () => {
      const validStatuses: ReviewStatus[] = [
        ReviewStatus.PENDING,
        ReviewStatus.APPROVED,
        ReviewStatus.REJECTED,
      ];

      validStatuses.forEach((status) => {
        const options: TransactionFilterOptions = {
          userId: mockUserId,
          reviewStatus: status,
        };
        const filter = buildTransactionFilter(options);
        expect(filter.reviewStatus).toBe(status);
      });
    });

    it('should enforce TransactionType enum values', () => {
      const validTypes: TransactionType[] = [TransactionType.DEBIT, TransactionType.CREDIT];

      validTypes.forEach((type) => {
        const options: TransactionFilterOptions = {
          userId: mockUserId,
          type,
        };
        const filter = buildTransactionFilter(options);
        expect(filter.type).toBe(type);
      });
    });
  });
});
