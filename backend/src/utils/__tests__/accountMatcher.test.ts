import { normalizeMerchantName, matchAccount } from '../accountMatcher';
import { Account } from '../../models/types';

describe('AccountMatcher', () => {
  describe('normalizeMerchantName', () => {
    it('should handle null/undefined inputs', () => {
      expect(normalizeMerchantName('')).toBe('');
      expect(normalizeMerchantName(null as any)).toBe(null);
      expect(normalizeMerchantName(undefined as any)).toBe(undefined);
    });

    it('should remove asterisk and text after it', () => {
      expect(normalizeMerchantName('SWIGGY*BANGALORE')).toBe('Swiggy');
      expect(normalizeMerchantName('AMAZON PAY*1234')).toBe('Amazon Pay');
      expect(normalizeMerchantName('ZOMATO*ORDER123')).toBe('Zomato');
    });

    it('should remove city names', () => {
      expect(normalizeMerchantName('SWIGGY BANGALORE')).toBe('Swiggy');
      expect(normalizeMerchantName('ZOMATO MUMBAI')).toBe('Zomato');
      expect(normalizeMerchantName('UBER DELHI')).toBe('Uber');
      expect(normalizeMerchantName('FLIPKART CHENNAI')).toBe('Flipkart');
      expect(normalizeMerchantName('AMAZON KOLKATA')).toBe('Amazon');
      expect(normalizeMerchantName('OLA HYDERABAD')).toBe('Ola');
      expect(normalizeMerchantName('MYNTRA PUNE')).toBe('Myntra');
    });

    it('should remove company suffixes', () => {
      expect(normalizeMerchantName('AMAZON PVT')).toBe('Amazon');
      expect(normalizeMerchantName('SWIGGY LTD')).toBe('Swiggy');
      expect(normalizeMerchantName('ZOMATO LIMITED')).toBe('Zomato');
      expect(normalizeMerchantName('FLIPKART INC')).toBe('Flipkart');
      expect(normalizeMerchantName('UBER CORP')).toBe('Uber');
      expect(normalizeMerchantName('OLA LLC')).toBe('Ola');
    });

    it('should replace special characters with spaces', () => {
      expect(normalizeMerchantName('SWIGGY-BANGALORE')).toBe('Swiggy Bangalore');
      expect(normalizeMerchantName('AMAZON_PAY')).toBe('Amazon Pay');
      expect(normalizeMerchantName('ZOMATO@ONLINE')).toBe('Zomato Online');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeMerchantName('SWIGGY    BANGALORE')).toBe('Swiggy');
      expect(normalizeMerchantName('AMAZON  PAY  INDIA')).toBe('Amazon Pay');
    });

    it('should convert to title case', () => {
      expect(normalizeMerchantName('SWIGGY')).toBe('Swiggy');
      expect(normalizeMerchantName('amazon pay')).toBe('Amazon Pay');
      expect(normalizeMerchantName('ZoMaTo')).toBe('Zomato');
    });

    it('should handle complex merchant names', () => {
      expect(normalizeMerchantName('SWIGGY*BANGALORE PVT LTD')).toBe('Swiggy');
      expect(normalizeMerchantName('AMAZON-PAY*ORDER123 MUMBAI INC')).toBe('Amazon Pay');
      expect(normalizeMerchantName('ZOMATO_ONLINE*FOOD DELHI LTD')).toBe('Zomato Online');
    });

    it('should trim whitespace', () => {
      expect(normalizeMerchantName('  SWIGGY  ')).toBe('Swiggy');
      expect(normalizeMerchantName('\tAMAZON PAY\n')).toBe('Amazon Pay');
    });

    it('should preserve India suffix removal case-insensitively', () => {
      expect(normalizeMerchantName('AMAZON INDIA')).toBe('Amazon');
      expect(normalizeMerchantName('AMAZON india')).toBe('Amazon');
    });
  });

  describe('matchAccount', () => {
    const mockUserId = 'user123';

    // Mock accounts
    const mockAccounts: Account[] = [
      {
        id: 'acc1',
        userId: mockUserId,
        name: 'HDFC Savings',
        bankName: 'HDFC Bank',
        accountNumber: '1234567890',
        type: 'savings',
        balance: 10000,
        currency: 'INR',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'acc2',
        userId: mockUserId,
        name: 'ICICI Credit',
        bankName: 'ICICI Bank',
        accountNumber: '0987654321',
        type: 'credit_card',
        balance: 5000,
        currency: 'INR',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'acc3',
        userId: mockUserId,
        name: 'SBI Savings',
        bankName: 'State Bank of India',
        accountNumber: '1111222233',
        type: 'savings',
        balance: 15000,
        currency: 'INR',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'acc4',
        userId: mockUserId,
        name: 'HDFC Current',
        bankName: 'HDFC Bank',
        accountNumber: '9999888877',
        type: 'checking',
        balance: 20000,
        currency: 'INR',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: 'acc5',
        userId: mockUserId,
        name: 'Inactive Account',
        bankName: 'Axis Bank',
        accountNumber: '5555666677',
        type: 'savings',
        balance: 0,
        currency: 'INR',
        isActive: false, // Inactive account
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
    ];

    // Mock MongoDB collection
    const createMockCollection = (accounts: Account[]) => {
      return {
        find: jest.fn().mockImplementation((filter: any) => ({
          toArray: jest.fn().mockResolvedValue(
            accounts.filter((acc) => {
              // Apply the filter conditions
              if (filter.userId && acc.userId !== filter.userId) return false;
              if (filter.isActive !== undefined && acc.isActive !== filter.isActive) return false;
              return true;
            })
          ),
        })),
      } as any;
    };

    it('should return null when no bank name or account number provided', async () => {
      const mockCollection = createMockCollection(mockAccounts);

      const result = await matchAccount(mockUserId, mockCollection);

      expect(result).toBeNull();
    });

    it('should return null when user has no active accounts', async () => {
      const mockCollection = createMockCollection([]);

      const result = await matchAccount(mockUserId, mockCollection, 'HDFC Bank', '7890');

      expect(result).toBeNull();
    });

    it('should match by bank name and last 4 digits (priority 1)', async () => {
      const mockCollection = createMockCollection(mockAccounts);

      const result = await matchAccount(mockUserId, mockCollection, 'HDFC Bank', '7890');

      expect(result).toBe('acc1'); // HDFC Savings ending in 7890
    });

    it('should match case-insensitively for bank names', async () => {
      const mockCollection = createMockCollection(mockAccounts);

      const result = await matchAccount(mockUserId, mockCollection, 'hdfc bank', '7890');

      expect(result).toBe('acc1');
    });

    it('should match by partial bank name and last 4 digits', async () => {
      const mockCollection = createMockCollection(mockAccounts);

      const result = await matchAccount(mockUserId, mockCollection, 'HDFC', '7890');

      expect(result).toBe('acc1');
    });

    it('should match by bank name only when user has single account with that bank (priority 2)', async () => {
      const mockCollection = createMockCollection(mockAccounts);

      // ICICI Bank - only 1 account
      const result = await matchAccount(mockUserId, mockCollection, 'ICICI Bank');

      expect(result).toBe('acc2');
    });

    it('should not match by bank name only when multiple accounts exist', async () => {
      const mockCollection = createMockCollection(mockAccounts);

      // HDFC Bank - 2 accounts (acc1 and acc4)
      const result = await matchAccount(mockUserId, mockCollection, 'HDFC Bank');

      expect(result).toBeNull(); // Need last 4 digits to disambiguate
    });

    it('should match by last 4 digits only when no bank name provided (priority 3)', async () => {
      const mockCollection = createMockCollection(mockAccounts);

      const result = await matchAccount(mockUserId, mockCollection, undefined, '4321');

      expect(result).toBe('acc2'); // ICICI account ending in 4321
    });

    it('should not match by last 4 digits when multiple accounts have same last 4', async () => {
      const duplicateAccounts = [
        ...mockAccounts,
        {
          id: 'acc6',
          userId: mockUserId,
          name: 'Another HDFC',
          bankName: 'HDFC Bank',
          accountNumber: '9999887890', // Same last 4 as acc1
          type: 'savings' as const,
          balance: 5000,
          currency: 'INR',
          isActive: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      const mockCollection = createMockCollection(duplicateAccounts);

      const result = await matchAccount(mockUserId, mockCollection, undefined, '7890');

      expect(result).toBeNull(); // Multiple accounts with same last 4
    });

    it('should properly filter inactive accounts', async () => {
      const mockCollection = createMockCollection(mockAccounts);

      // Try to match Axis Bank (acc5 is inactive)
      const result = await matchAccount(mockUserId, mockCollection, 'Axis Bank', '6677');

      // acc5 is inactive so it won't be returned (isActive: true filter)
      expect(result).toBeNull();
    });

    it('should handle account numbers with full match', async () => {
      const mockCollection = createMockCollection(mockAccounts);

      const result = await matchAccount(
        mockUserId,
        mockCollection,
        'HDFC Bank',
        'XXXXXXXX7890' // Format with X's, last 4 digits
      );

      expect(result).toBe('acc1');
    });

    it('should return null when no match found', async () => {
      const mockCollection = createMockCollection(mockAccounts);

      const result = await matchAccount(mockUserId, mockCollection, 'Nonexistent Bank', '0000');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      const mockCollection = {
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any;

      const result = await matchAccount(mockUserId, mockCollection, 'HDFC Bank', '7890');

      expect(result).toBeNull();
    });

    it('should match State Bank of India by partial name', async () => {
      const mockCollection = createMockCollection(mockAccounts);

      const result = await matchAccount(mockUserId, mockCollection, 'State Bank', '2233');

      expect(result).toBe('acc3');
    });

    it('should prioritize exact match over partial match', async () => {
      const mockCollection = createMockCollection(mockAccounts);

      // Both bank name and last 4 match
      const result = await matchAccount(mockUserId, mockCollection, 'HDFC Bank', '8877');

      expect(result).toBe('acc4'); // HDFC Current ending in 8877
    });

    it('should handle whitespace in bank names', async () => {
      const mockCollection = createMockCollection(mockAccounts);

      const result = await matchAccount(mockUserId, mockCollection, '  HDFC Bank  ', '7890');

      expect(result).toBe('acc1');
    });

    it('should match with only last 4 digits provided as standalone string', async () => {
      const mockCollection = createMockCollection(mockAccounts);

      const result = await matchAccount(mockUserId, mockCollection, undefined, '2233');

      expect(result).toBe('acc3'); // SBI account ending in 2233
    });
  });
});
