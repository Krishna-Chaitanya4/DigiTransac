import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAccounts,
  getAccountSummary,
  getAccount,
  createAccount,
  updateAccount,
  adjustBalance,
  reorderAccounts,
  deleteAccount,
  formatCurrency,
  accountTypeConfig,
} from './accountService';
import { apiClient } from './apiClient';

// Mock the apiClient
vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('accountService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAccounts', () => {
    it('should call API with includeArchived=false by default', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);
      
      await getAccounts();
      
      expect(apiClient.get).toHaveBeenCalledWith('/accounts?includeArchived=false');
    });

    it('should call API with includeArchived=true when specified', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);
      
      await getAccounts(true);
      
      expect(apiClient.get).toHaveBeenCalledWith('/accounts?includeArchived=true');
    });
  });

  describe('getAccountSummary', () => {
    it('should call summary endpoint', async () => {
      const mockSummary = {
        totalAssets: 100000,
        totalLiabilities: 20000,
        netWorth: 80000,
        balancesByType: {},
      };
      vi.mocked(apiClient.get).mockResolvedValue(mockSummary);
      
      const result = await getAccountSummary();
      
      expect(apiClient.get).toHaveBeenCalledWith('/accounts/summary');
      expect(result).toEqual(mockSummary);
    });
  });

  describe('getAccount', () => {
    it('should call API with account id', async () => {
      const mockAccount = { id: '123', name: 'Test' };
      vi.mocked(apiClient.get).mockResolvedValue(mockAccount);
      
      const result = await getAccount('123');
      
      expect(apiClient.get).toHaveBeenCalledWith('/accounts/123');
      expect(result).toEqual(mockAccount);
    });
  });

  describe('createAccount', () => {
    it('should post account data', async () => {
      const newAccount = { name: 'New Account', type: 'Bank' as const };
      const createdAccount = { id: '123', ...newAccount };
      vi.mocked(apiClient.post).mockResolvedValue(createdAccount);
      
      const result = await createAccount(newAccount);
      
      expect(apiClient.post).toHaveBeenCalledWith('/accounts', newAccount);
      expect(result).toEqual(createdAccount);
    });
  });

  describe('updateAccount', () => {
    it('should put account data with id', async () => {
      const updateData = { name: 'Updated Account' };
      const updatedAccount = { id: '123', name: 'Updated Account' };
      vi.mocked(apiClient.put).mockResolvedValue(updatedAccount);
      
      const result = await updateAccount('123', updateData);
      
      expect(apiClient.put).toHaveBeenCalledWith('/accounts/123', updateData);
      expect(result).toEqual(updatedAccount);
    });
  });

  describe('adjustBalance', () => {
    it('should post adjust balance request', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(undefined);
      
      await adjustBalance('123', { newBalance: 50000, notes: 'Reconciliation' });
      
      expect(apiClient.post).toHaveBeenCalledWith('/accounts/123/adjust-balance', {
        newBalance: 50000,
        notes: 'Reconciliation',
      });
    });
  });

  describe('reorderAccounts', () => {
    it('should post reorder request', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(undefined);
      const items = [
        { id: '1', order: 0 },
        { id: '2', order: 1 },
      ];
      
      await reorderAccounts(items);
      
      expect(apiClient.post).toHaveBeenCalledWith('/accounts/reorder', { items });
    });
  });

  describe('deleteAccount', () => {
    it('should delete account by id', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined);
      
      await deleteAccount('123');
      
      expect(apiClient.delete).toHaveBeenCalledWith('/accounts/123');
    });
  });
});

describe('formatCurrency', () => {
  it('should format positive numbers in INR', () => {
    expect(formatCurrency(1000)).toBe('₹1,000.00');
    expect(formatCurrency(1234567.89)).toBe('₹12,34,567.89');
  });

  it('should format zero', () => {
    expect(formatCurrency(0)).toBe('₹0.00');
  });

  it('should format negative numbers', () => {
    expect(formatCurrency(-1000)).toBe('-₹1,000.00');
  });

  it('should format with different currency when specified', () => {
    expect(formatCurrency(1000, 'USD')).toBe('$1,000.00');
  });

  it('should format decimal values correctly', () => {
    expect(formatCurrency(1234.56)).toBe('₹1,234.56');
    expect(formatCurrency(0.99)).toBe('₹0.99');
  });
});

describe('accountTypeConfig', () => {
  it('should have all account types defined', () => {
    expect(accountTypeConfig.Bank).toBeDefined();
    expect(accountTypeConfig.CreditCard).toBeDefined();
    expect(accountTypeConfig.Cash).toBeDefined();
    expect(accountTypeConfig.DigitalWallet).toBeDefined();
    expect(accountTypeConfig.Investment).toBeDefined();
    expect(accountTypeConfig.Loan).toBeDefined();
  });

  it('should have correct liability flags', () => {
    expect(accountTypeConfig.Bank.isLiability).toBe(false);
    expect(accountTypeConfig.CreditCard.isLiability).toBe(true);
    expect(accountTypeConfig.Cash.isLiability).toBe(false);
    expect(accountTypeConfig.DigitalWallet.isLiability).toBe(false);
    expect(accountTypeConfig.Investment.isLiability).toBe(false);
    expect(accountTypeConfig.Loan.isLiability).toBe(true);
  });

  it('should have labels for each type', () => {
    expect(accountTypeConfig.Bank.label).toBe('Bank Account');
    expect(accountTypeConfig.CreditCard.label).toBe('Credit Card');
    expect(accountTypeConfig.Cash.label).toBe('Cash');
    expect(accountTypeConfig.DigitalWallet.label).toBe('Digital Wallet');
    expect(accountTypeConfig.Investment.label).toBe('Investment');
    expect(accountTypeConfig.Loan.label).toBe('Loan');
  });

  it('should have icons for each type', () => {
    expect(accountTypeConfig.Bank.icon).toBe('🏦');
    expect(accountTypeConfig.CreditCard.icon).toBe('💳');
    expect(accountTypeConfig.Cash.icon).toBe('💵');
    expect(accountTypeConfig.DigitalWallet.icon).toBe('📱');
    expect(accountTypeConfig.Investment.icon).toBe('📈');
    expect(accountTypeConfig.Loan.icon).toBe('🏠');
  });

  it('should have default colors for each type', () => {
    Object.values(accountTypeConfig).forEach((config) => {
      expect(config.defaultColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});
