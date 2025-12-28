import { calculateBudgetSpending, calculateBudgetSpendingInRange } from '../budgetHelpers';
import { Budget, Category } from '../../models/types';

describe('BudgetHelpers', () => {
  const mockUserId = 'user123';

  // Mock categories
  const categories: Category[] = [
    {
      id: 'cat1',
      userId: mockUserId,
      name: 'Food',
      isFolder: false,
      parentId: null,
      path: ['cat1'],
      icon: '🍔',
      color: '#FF5733',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'cat2',
      userId: mockUserId,
      name: 'Transport',
      isFolder: false,
      parentId: null,
      path: ['cat2'],
      icon: '🚗',
      color: '#3498DB',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'catFolder',
      userId: mockUserId,
      name: 'Shopping',
      isFolder: true,
      parentId: null,
      path: ['catFolder'],
      icon: '🛒',
      color: '#9B59B6',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'catChild1',
      userId: mockUserId,
      name: 'Clothing',
      isFolder: false,
      parentId: 'catFolder',
      path: ['catFolder', 'catChild1'],
      icon: '👕',
      color: '#E74C3C',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ];

  describe('calculateBudgetSpending', () => {
    it('should calculate spending with no filters (all expenses)', async () => {
      const budget: Budget = {
        id: 'budget1',
        userId: mockUserId,
        name: 'Total Budget',
        amount: 10000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        calculationType: 'debit',
        period: 'custom',
        alertThreshold: 80,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const expenses = [
        { id: '1', date: new Date('2024-01-15'), type: 'debit', amount: 500, categoryId: 'cat1' },
        { id: '2', date: new Date('2024-01-20'), type: 'debit', amount: 300, categoryId: 'cat2' },
        { id: '3', date: new Date('2024-01-25'), type: 'credit', amount: 100, categoryId: 'cat1' },
      ];

      const expensesByCategory = new Map([
        ['cat1', [expenses[0], expenses[2]]],
        ['cat2', [expenses[1]]],
      ]);

      const categoryToDescendantsMap = new Map();

      const result = await calculateBudgetSpending(
        budget,
        mockUserId,
        categories,
        categoryToDescendantsMap,
        expensesByCategory
      );

      expect(result.debit).toBe(800); // 500 + 300
      expect(result.credit).toBe(100);
      expect(result.net).toBe(700); // 800 - 100
      expect(result.spent).toBe(800); // calculationType: 'debit'
    });

    it('should filter by date range correctly', async () => {
      const budget: Budget = {
        id: 'budget1',
        userId: mockUserId,
        name: 'January Budget',
        amount: 5000,
        startDate: new Date('2024-01-10'),
        endDate: new Date('2024-01-20'),
        calculationType: 'debit',
        period: 'custom',
        alertThreshold: 80,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const expenses = [
        { id: '1', date: new Date('2024-01-05'), type: 'debit', amount: 500, categoryId: 'cat1' },
        { id: '2', date: new Date('2024-01-15'), type: 'debit', amount: 300, categoryId: 'cat2' },
        { id: '3', date: new Date('2024-01-25'), type: 'debit', amount: 200, categoryId: 'cat1' },
      ];

      const expensesByCategory = new Map([['cat1', expenses]]);
      const categoryToDescendantsMap = new Map();

      const result = await calculateBudgetSpending(
        budget,
        mockUserId,
        categories,
        categoryToDescendantsMap,
        expensesByCategory
      );

      expect(result.debit).toBe(300); // Only expense on 2024-01-15
      expect(result.spent).toBe(300);
    });

    it('should filter by category IDs', async () => {
      const budget: Budget = {
        id: 'budget1',
        userId: mockUserId,
        name: 'Food Budget',
        amount: 3000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        categoryIds: ['cat1'], // Only Food
        calculationType: 'debit',
        period: 'custom',
        alertThreshold: 80,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const expenses = [
        { id: '1', date: new Date('2024-01-15'), type: 'debit', amount: 500, categoryId: 'cat1' },
        { id: '2', date: new Date('2024-01-20'), type: 'debit', amount: 300, categoryId: 'cat2' },
      ];

      const expensesByCategory = new Map([['cat1', [expenses[0]]], ['cat2', [expenses[1]]]]);
      const categoryToDescendantsMap = new Map();

      const result = await calculateBudgetSpending(
        budget,
        mockUserId,
        categories,
        categoryToDescendantsMap,
        expensesByCategory
      );

      expect(result.debit).toBe(500); // Only cat1
      expect(result.spent).toBe(500);
    });

    it('should include folder descendants in category filter', async () => {
      const budget: Budget = {
        id: 'budget1',
        userId: mockUserId,
        name: 'Shopping Budget',
        amount: 5000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        categoryIds: ['catFolder'], // Shopping folder
        calculationType: 'debit',
        period: 'custom',
        alertThreshold: 80,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const expenses = [
        { id: '1', date: new Date('2024-01-15'), type: 'debit', amount: 500, categoryId: 'catChild1' },
        { id: '2', date: new Date('2024-01-20'), type: 'debit', amount: 300, categoryId: 'cat1' },
      ];

      const expensesByCategory = new Map([['catChild1', [expenses[0]]], ['cat1', [expenses[1]]]]);
      const categoryToDescendantsMap = new Map([['catFolder', ['catChild1']]]);

      const result = await calculateBudgetSpending(
        budget,
        mockUserId,
        categories,
        categoryToDescendantsMap,
        expensesByCategory
      );

      expect(result.debit).toBe(500); // Only catChild1 (descendant of catFolder)
      expect(result.spent).toBe(500);
    });

    it('should filter by include tags (OR logic)', async () => {
      const budget: Budget = {
        id: 'budget1',
        userId: mockUserId,
        name: 'Tagged Budget',
        amount: 5000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        includeTagIds: ['tag1', 'tag2'],
        calculationType: 'debit',
        period: 'custom',
        alertThreshold: 80,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const expenses = [
        {
          id: '1',
          date: new Date('2024-01-15'),
          type: 'debit',
          amount: 500,
          categoryId: 'cat1',
          tags: ['tag1'],
        },
        {
          id: '2',
          date: new Date('2024-01-20'),
          type: 'debit',
          amount: 300,
          categoryId: 'cat2',
          tags: ['tag2'],
        },
        {
          id: '3',
          date: new Date('2024-01-25'),
          type: 'debit',
          amount: 200,
          categoryId: 'cat1',
          tags: ['tag3'],
        },
      ];

      const expensesByCategory = new Map([['cat1', expenses]]);
      const categoryToDescendantsMap = new Map();

      const result = await calculateBudgetSpending(
        budget,
        mockUserId,
        categories,
        categoryToDescendantsMap,
        expensesByCategory
      );

      expect(result.debit).toBe(800); // 500 (tag1) + 300 (tag2), not 200 (tag3)
      expect(result.spent).toBe(800);
    });

    it('should filter by exclude tags', async () => {
      const budget: Budget = {
        id: 'budget1',
        userId: mockUserId,
        name: 'Exclude Tags Budget',
        amount: 5000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        excludeTagIds: ['exclude1'],
        calculationType: 'debit',
        period: 'custom',
        alertThreshold: 80,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const expenses = [
        {
          id: '1',
          date: new Date('2024-01-15'),
          type: 'debit',
          amount: 500,
          categoryId: 'cat1',
          tags: ['include1'],
        },
        {
          id: '2',
          date: new Date('2024-01-20'),
          type: 'debit',
          amount: 300,
          categoryId: 'cat2',
          tags: ['exclude1'],
        },
      ];

      const expensesByCategory = new Map([['cat1', expenses]]);
      const categoryToDescendantsMap = new Map();

      const result = await calculateBudgetSpending(
        budget,
        mockUserId,
        categories,
        categoryToDescendantsMap,
        expensesByCategory
      );

      expect(result.debit).toBe(500); // Only expense without 'exclude1' tag
      expect(result.spent).toBe(500);
    });

    it('should filter by account IDs', async () => {
      const budget: Budget = {
        id: 'budget1',
        userId: mockUserId,
        name: 'Account Budget',
        amount: 5000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        accountIds: ['acc1', 'acc2'],
        calculationType: 'debit',
        period: 'custom',
        alertThreshold: 80,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const expenses = [
        {
          id: '1',
          date: new Date('2024-01-15'),
          type: 'debit',
          amount: 500,
          categoryId: 'cat1',
          accountId: 'acc1',
        },
        {
          id: '2',
          date: new Date('2024-01-20'),
          type: 'debit',
          amount: 300,
          categoryId: 'cat2',
          accountId: 'acc3',
        },
      ];

      const expensesByCategory = new Map([['cat1', expenses]]);
      const categoryToDescendantsMap = new Map();

      const result = await calculateBudgetSpending(
        budget,
        mockUserId,
        categories,
        categoryToDescendantsMap,
        expensesByCategory
      );

      expect(result.debit).toBe(500); // Only acc1
      expect(result.spent).toBe(500);
    });

    it('should calculate net spending when calculationType is "net"', async () => {
      const budget: Budget = {
        id: 'budget1',
        userId: mockUserId,
        name: 'Net Budget',
        amount: 5000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        calculationType: 'net',
        period: 'custom',
        alertThreshold: 80,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const expenses = [
        { id: '1', date: new Date('2024-01-15'), type: 'debit', amount: 1000, categoryId: 'cat1' },
        { id: '2', date: new Date('2024-01-20'), type: 'credit', amount: 300, categoryId: 'cat1' },
      ];

      const expensesByCategory = new Map([['cat1', expenses]]);
      const categoryToDescendantsMap = new Map();

      const result = await calculateBudgetSpending(
        budget,
        mockUserId,
        categories,
        categoryToDescendantsMap,
        expensesByCategory
      );

      expect(result.debit).toBe(1000);
      expect(result.credit).toBe(300);
      expect(result.net).toBe(700); // 1000 - 300
      expect(result.spent).toBe(700); // calculationType: 'net'
    });

    it('should handle budget with no endDate (use current date)', async () => {
      const budget: Budget = {
        id: 'budget1',
        userId: mockUserId,
        name: 'Ongoing Budget',
        amount: 5000,
        startDate: new Date('2024-01-01'),
        // No endDate
        calculationType: 'debit',
        period: 'custom',
        alertThreshold: 80,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const expenses = [
        { id: '1', date: new Date('2024-01-15'), type: 'debit', amount: 500, categoryId: 'cat1' },
      ];

      const expensesByCategory = new Map([['cat1', expenses]]);
      const categoryToDescendantsMap = new Map();

      const result = await calculateBudgetSpending(
        budget,
        mockUserId,
        categories,
        categoryToDescendantsMap,
        expensesByCategory
      );

      expect(result.debit).toBe(500);
      expect(result.spent).toBe(500);
    });

    it('should return zero when no expenses match filters', async () => {
      const budget: Budget = {
        id: 'budget1',
        userId: mockUserId,
        name: 'Empty Budget',
        amount: 5000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        categoryIds: ['nonexistent'],
        calculationType: 'debit',
        period: 'custom',
        alertThreshold: 80,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const expenses = [
        { id: '1', date: new Date('2024-01-15'), type: 'debit', amount: 500, categoryId: 'cat1' },
      ];

      const expensesByCategory = new Map([['cat1', expenses]]);
      const categoryToDescendantsMap = new Map();

      const result = await calculateBudgetSpending(
        budget,
        mockUserId,
        categories,
        categoryToDescendantsMap,
        expensesByCategory
      );

      expect(result.debit).toBe(0);
      expect(result.credit).toBe(0);
      expect(result.net).toBe(0);
      expect(result.spent).toBe(0);
    });
  });

  describe('calculateBudgetSpendingInRange', () => {
    it('should calculate spending for custom date range', async () => {
      const budget: Budget = {
        id: 'budget1',
        userId: mockUserId,
        name: 'Monthly Budget',
        amount: 5000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        calculationType: 'debit',
        period: 'custom',
        alertThreshold: 80,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const expenses = [
        { id: '1', date: new Date('2024-01-10'), type: 'debit', amount: 300, categoryId: 'cat1' },
        { id: '2', date: new Date('2024-01-20'), type: 'debit', amount: 500, categoryId: 'cat1' },
        { id: '3', date: new Date('2024-01-30'), type: 'debit', amount: 200, categoryId: 'cat1' },
      ];

      const expensesByCategory = new Map([['cat1', expenses]]);
      const categoryToDescendantsMap = new Map();

      const rangeStart = new Date('2024-01-15');
      const rangeEnd = new Date('2024-01-25');

      const result = await calculateBudgetSpendingInRange(
        budget,
        mockUserId,
        categories,
        categoryToDescendantsMap,
        expensesByCategory,
        rangeStart,
        rangeEnd
      );

      expect(result.debit).toBe(500); // Only expense on 2024-01-20
      expect(result.spent).toBe(500);
    });

    it('should restore original budget dates after calculation', async () => {
      const originalStart = new Date('2024-01-01');
      const originalEnd = new Date('2024-01-31');

      const budget: Budget = {
        id: 'budget1',
        userId: mockUserId,
        name: 'Test Budget',
        amount: 5000,
        startDate: originalStart,
        endDate: originalEnd,
        calculationType: 'debit',
        period: 'custom',
        alertThreshold: 80,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      const expenses = [
        { id: '1', date: new Date('2024-01-15'), type: 'debit', amount: 500, categoryId: 'cat1' },
      ];

      const expensesByCategory = new Map([['cat1', expenses]]);
      const categoryToDescendantsMap = new Map();

      await calculateBudgetSpendingInRange(
        budget,
        mockUserId,
        categories,
        categoryToDescendantsMap,
        expensesByCategory,
        new Date('2024-01-10'),
        new Date('2024-01-20')
      );

      // Verify dates are restored
      expect(budget.startDate).toEqual(originalStart);
      expect(budget.endDate).toEqual(originalEnd);
    });
  });
});
