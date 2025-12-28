import { getExpensesFromTransactions, getExpenseById, countExpenses } from '../expenseHelpers';
import { mongoDBService } from '../../config/mongodb';
import { decryptTransaction } from '../transactionEncryption';
import { buildExpenseFilter } from '../transactionFilters';

// Mock dependencies
jest.mock('../../config/mongodb');
jest.mock('../transactionEncryption');
jest.mock('../transactionFilters');

describe('ExpenseHelpers', () => {
  const mockUserId = 'user123';
  const mockStartDate = new Date('2024-01-01');
  const mockEndDate = new Date('2024-01-31');

  // Mock containers
  const mockTransactionsContainer = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockSplitsContainer = {
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    (mongoDBService.getTransactionsContainer as jest.Mock).mockResolvedValue(
      mockTransactionsContainer
    );
    (mongoDBService.getTransactionSplitsContainer as jest.Mock).mockResolvedValue(
      mockSplitsContainer
    );
  });

  describe('getExpensesFromTransactions', () => {
    it('should return empty array when no transactions found', async () => {
      mockTransactionsContainer.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      const result = await getExpensesFromTransactions(mockUserId, mockStartDate, mockEndDate);

      expect(result).toEqual([]);
    });

    it('should use buildExpenseFilter when reviewStatus provided', async () => {
      const mockFilter = { userId: mockUserId, type: 'debit', reviewStatus: 'approved' };
      (buildExpenseFilter as jest.Mock).mockReturnValue(mockFilter);

      mockTransactionsContainer.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      await getExpensesFromTransactions(mockUserId, mockStartDate, mockEndDate, 'approved');

      expect(buildExpenseFilter).toHaveBeenCalledWith(mockUserId, mockStartDate, mockEndDate);
      expect(mockTransactionsContainer.find).toHaveBeenCalledWith(mockFilter);
    });

    it('should use basic filter when reviewStatus not provided', async () => {
      mockTransactionsContainer.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      await getExpensesFromTransactions(mockUserId, mockStartDate, mockEndDate);

      expect(buildExpenseFilter).not.toHaveBeenCalled();
      expect(mockTransactionsContainer.find).toHaveBeenCalledWith({
        userId: mockUserId,
        type: 'debit',
        date: { $gte: mockStartDate, $lte: mockEndDate },
      });
    });

    it('should decrypt transactions and combine with splits', async () => {
      const mockTransactions = [
        {
          id: 'tx1',
          userId: mockUserId,
          type: 'debit',
          date: new Date('2024-01-15'),
          description: 'encrypted-desc',
          reviewStatus: 'approved',
          accountId: 'acc1',
          createdAt: new Date('2024-01-15'),
        },
      ];

      const mockDecryptedTx = {
        ...mockTransactions[0],
        description: 'Decrypted Description',
      };

      const mockSplits = [
        {
          id: 'split1',
          userId: mockUserId,
          transactionId: 'tx1',
          amount: 500,
          categoryId: 'cat1',
          tags: ['food', 'dinner'],
        },
        {
          id: 'split2',
          userId: mockUserId,
          transactionId: 'tx1',
          amount: 300,
          categoryId: 'cat2',
          tags: ['transport'],
        },
      ];

      mockTransactionsContainer.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockTransactions),
      });

      (decryptTransaction as jest.Mock).mockReturnValue(mockDecryptedTx);

      mockSplitsContainer.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockSplits),
      });

      const result = await getExpensesFromTransactions(mockUserId, mockStartDate, mockEndDate);

      expect(decryptTransaction).toHaveBeenCalledWith(mockTransactions[0]);
      expect(mockSplitsContainer.find).toHaveBeenCalledWith({
        transactionId: { $in: ['tx1'] },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'split1',
        userId: mockUserId,
        amount: 500,
        categoryId: 'cat1',
        date: mockDecryptedTx.date,
        description: 'Decrypted Description',
        reviewStatus: 'approved',
        createdAt: mockDecryptedTx.createdAt,
        accountId: 'acc1',
        transactionId: 'tx1',
        tags: ['food', 'dinner'],
        type: 'debit',
      });
    });

    it('should handle missing transaction data gracefully', async () => {
      const mockTransactions = [{ id: 'tx1', userId: mockUserId }];
      const mockSplits = [
        {
          id: 'split1',
          userId: mockUserId,
          transactionId: 'tx1',
          amount: 500,
          categoryId: 'cat1',
        },
      ];

      mockTransactionsContainer.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockTransactions),
      });

      (decryptTransaction as jest.Mock).mockReturnValue(mockTransactions[0]);

      mockSplitsContainer.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockSplits),
      });

      const result = await getExpensesFromTransactions(mockUserId, mockStartDate, mockEndDate);

      expect(result[0].date).toBeInstanceOf(Date);
      expect(result[0].description).toBe('');
      expect(result[0].reviewStatus).toBe('pending');
      expect(result[0].tags).toEqual([]);
      expect(result[0].type).toBe('debit');
    });

    it('should handle multiple transactions with multiple splits', async () => {
      const mockTransactions = [
        { id: 'tx1', userId: mockUserId, type: 'debit', date: new Date('2024-01-10') },
        { id: 'tx2', userId: mockUserId, type: 'debit', date: new Date('2024-01-20') },
      ];

      const mockSplits = [
        { id: 'split1', transactionId: 'tx1', amount: 100, categoryId: 'cat1', userId: mockUserId },
        { id: 'split2', transactionId: 'tx1', amount: 200, categoryId: 'cat2', userId: mockUserId },
        { id: 'split3', transactionId: 'tx2', amount: 300, categoryId: 'cat1', userId: mockUserId },
      ];

      mockTransactionsContainer.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockTransactions),
      });

      (decryptTransaction as jest.Mock).mockImplementation((tx) => tx);

      mockSplitsContainer.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockSplits),
      });

      const result = await getExpensesFromTransactions(mockUserId, mockStartDate, mockEndDate);

      expect(result).toHaveLength(3);
      expect(result[0].transactionId).toBe('tx1');
      expect(result[1].transactionId).toBe('tx1');
      expect(result[2].transactionId).toBe('tx2');
    });
  });

  describe('getExpenseById', () => {
    const mockExpenseId = 'split123';

    it('should return null when split not found', async () => {
      mockSplitsContainer.findOne.mockResolvedValue(null);

      const result = await getExpenseById(mockUserId, mockExpenseId);

      expect(result).toBeNull();
      expect(mockSplitsContainer.findOne).toHaveBeenCalledWith({
        id: mockExpenseId,
        userId: mockUserId,
      });
    });

    it('should return null when transaction not found', async () => {
      const mockSplit = {
        id: mockExpenseId,
        userId: mockUserId,
        transactionId: 'tx1',
        amount: 500,
        categoryId: 'cat1',
      };

      mockSplitsContainer.findOne.mockResolvedValue(mockSplit);
      mockTransactionsContainer.findOne.mockResolvedValue(null);

      const result = await getExpenseById(mockUserId, mockExpenseId);

      expect(result).toBeNull();
      expect(mockTransactionsContainer.findOne).toHaveBeenCalledWith({
        id: 'tx1',
        userId: mockUserId,
      });
    });

    it('should return expense with decrypted transaction data', async () => {
      const mockSplit = {
        id: mockExpenseId,
        userId: mockUserId,
        transactionId: 'tx1',
        amount: 500,
        categoryId: 'cat1',
        tags: ['business'],
      };

      const mockTransaction = {
        id: 'tx1',
        userId: mockUserId,
        type: 'debit',
        date: new Date('2024-01-15'),
        description: 'encrypted',
        reviewStatus: 'approved',
        accountId: 'acc1',
        createdAt: new Date('2024-01-15'),
      };

      const mockDecrypted = {
        ...mockTransaction,
        description: 'Business Lunch',
      };

      mockSplitsContainer.findOne.mockResolvedValue(mockSplit);
      mockTransactionsContainer.findOne.mockResolvedValue(mockTransaction);
      (decryptTransaction as jest.Mock).mockReturnValue(mockDecrypted);

      const result = await getExpenseById(mockUserId, mockExpenseId);

      expect(decryptTransaction).toHaveBeenCalledWith(mockTransaction);
      expect(result).toEqual({
        id: mockExpenseId,
        userId: mockUserId,
        amount: 500,
        categoryId: 'cat1',
        date: mockDecrypted.date,
        description: 'Business Lunch',
        reviewStatus: 'approved',
        createdAt: mockDecrypted.createdAt,
        accountId: 'acc1',
        transactionId: 'tx1',
        tags: ['business'],
        type: 'debit',
      });
    });

    it('should handle missing tags in split', async () => {
      const mockSplit = {
        id: mockExpenseId,
        userId: mockUserId,
        transactionId: 'tx1',
        amount: 500,
        categoryId: 'cat1',
        // No tags field
      };

      const mockTransaction = {
        id: 'tx1',
        userId: mockUserId,
        type: 'credit',
        date: new Date('2024-01-15'),
      };

      mockSplitsContainer.findOne.mockResolvedValue(mockSplit);
      mockTransactionsContainer.findOne.mockResolvedValue(mockTransaction);
      (decryptTransaction as jest.Mock).mockReturnValue(mockTransaction);

      const result = await getExpenseById(mockUserId, mockExpenseId);

      expect(result?.tags).toEqual([]);
      expect(result?.type).toBe('credit');
    });
  });

  describe('countExpenses', () => {
    it('should return 0 when no transactions found', async () => {
      mockTransactionsContainer.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      const result = await countExpenses(mockUserId);

      expect(result).toBe(0);
      expect(mockTransactionsContainer.find).toHaveBeenCalledWith({
        userId: mockUserId,
        type: 'debit',
      });
    });

    it('should count splits for matching transactions', async () => {
      const mockTransactions = [{ id: 'tx1' }, { id: 'tx2' }];

      mockTransactionsContainer.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockTransactions),
      });

      mockSplitsContainer.countDocuments.mockResolvedValue(5);

      const result = await countExpenses(mockUserId);

      expect(mockSplitsContainer.countDocuments).toHaveBeenCalledWith({
        transactionId: { $in: ['tx1', 'tx2'] },
      });
      expect(result).toBe(5);
    });

    it('should apply additional filters', async () => {
      const additionalFilter = {
        reviewStatus: 'approved',
        date: { $gte: mockStartDate, $lte: mockEndDate },
      };

      const mockTransactions = [{ id: 'tx1' }];

      mockTransactionsContainer.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockTransactions),
      });

      mockSplitsContainer.countDocuments.mockResolvedValue(3);

      const result = await countExpenses(mockUserId, additionalFilter);

      expect(mockTransactionsContainer.find).toHaveBeenCalledWith({
        userId: mockUserId,
        type: 'debit',
        reviewStatus: 'approved',
        date: { $gte: mockStartDate, $lte: mockEndDate },
      });
      expect(result).toBe(3);
    });

    it('should handle empty transaction list gracefully', async () => {
      mockTransactionsContainer.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([]),
      });

      const result = await countExpenses(mockUserId, { categoryId: 'nonexistent' });

      expect(result).toBe(0);
      expect(mockSplitsContainer.countDocuments).not.toHaveBeenCalled();
    });
  });
});
