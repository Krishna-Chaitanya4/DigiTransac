import { encryptTransaction, decryptTransaction, decryptTransactions } from '../transactionEncryption';
import { encryptionService } from '../../services/encryption.service';
import { Transaction } from '../../models/types';
import { logger } from '../logger';

// Mock dependencies
jest.mock('../../services/encryption.service');
jest.mock('../logger');

describe('TransactionEncryption', () => {
  const mockTransaction: Partial<Transaction> = {
    id: 'tx1',
    userId: 'user123',
    amount: 1000,
    description: 'Test transaction',
    type: 'debit',
    date: new Date('2024-01-15'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('encryptTransaction', () => {
    it('should encrypt description when present', () => {
      (encryptionService.encrypt as jest.Mock).mockReturnValue('encrypted-description');

      const result = encryptTransaction(mockTransaction);

      expect(encryptionService.encrypt).toHaveBeenCalledWith('Test transaction');
      expect(result.description).toBe('encrypted-description');
    });

    it('should not encrypt description if not present', () => {
      const txWithoutDesc = { ...mockTransaction, description: undefined };

      const result = encryptTransaction(txWithoutDesc);

      expect(encryptionService.encrypt).not.toHaveBeenCalled();
      expect(result.description).toBeUndefined();
    });

    it('should encrypt amount as encryptedAmount field', () => {
      (encryptionService.encryptNumber as jest.Mock).mockReturnValue('encrypted-1000');

      const result = encryptTransaction(mockTransaction);

      expect(encryptionService.encryptNumber).toHaveBeenCalledWith(1000);
      expect((result as any).encryptedAmount).toBe('encrypted-1000');
      expect(result.amount).toBe(1000); // Original preserved for migration compatibility
    });

    it('should not encrypt amount if not a number', () => {
      const txWithoutAmount = { ...mockTransaction, amount: undefined };

      const result = encryptTransaction(txWithoutAmount);

      expect(encryptionService.encryptNumber).not.toHaveBeenCalled();
      expect((result as any).encryptedAmount).toBeUndefined();
    });

    it('should preserve other fields unchanged', () => {
      (encryptionService.encrypt as jest.Mock).mockReturnValue('encrypted-desc');
      (encryptionService.encryptNumber as jest.Mock).mockReturnValue('encrypted-amount');

      const result = encryptTransaction(mockTransaction);

      expect(result.id).toBe('tx1');
      expect(result.userId).toBe('user123');
      expect(result.type).toBe('debit');
      expect(result.date).toEqual(mockTransaction.date);
    });

    it('should handle empty description', () => {
      const txWithEmptyDesc = { ...mockTransaction, description: '' };
      (encryptionService.encrypt as jest.Mock).mockReturnValue('encrypted-empty');

      const result = encryptTransaction(txWithEmptyDesc);

      expect(encryptionService.encrypt).toHaveBeenCalledWith('');
      expect(result.description).toBe('encrypted-empty');
    });

    it('should handle zero amount', () => {
      const txWithZeroAmount = { ...mockTransaction, amount: 0 };
      (encryptionService.encryptNumber as jest.Mock).mockReturnValue('encrypted-0');

      const result = encryptTransaction(txWithZeroAmount);

      expect(encryptionService.encryptNumber).toHaveBeenCalledWith(0);
      expect((result as any).encryptedAmount).toBe('encrypted-0');
    });
  });

  describe('decryptTransaction', () => {
    it('should decrypt encrypted description', () => {
      const encryptedTx = {
        ...mockTransaction,
        description: 'encrypted-description',
      } as Transaction;

      (encryptionService.isEncrypted as jest.Mock).mockReturnValue(true);
      (encryptionService.decrypt as jest.Mock).mockReturnValue('Decrypted Transaction');

      const result = decryptTransaction(encryptedTx);

      expect(encryptionService.isEncrypted).toHaveBeenCalledWith('encrypted-description');
      expect(encryptionService.decrypt).toHaveBeenCalledWith('encrypted-description');
      expect(result.description).toBe('Decrypted Transaction');
    });

    it('should not decrypt non-encrypted description', () => {
      const plainTx = {
        ...mockTransaction,
        description: 'Plain text',
      } as Transaction;

      (encryptionService.isEncrypted as jest.Mock).mockReturnValue(false);

      const result = decryptTransaction(plainTx);

      expect(encryptionService.decrypt).not.toHaveBeenCalled();
      expect(result.description).toBe('Plain text');
    });

    it('should decrypt encryptedAmount and remove field', () => {
      const encryptedTx = {
        ...mockTransaction,
        encryptedAmount: 'encrypted-1000',
      } as any;

      (encryptionService.decryptNumber as jest.Mock).mockReturnValue(1000);

      const result = decryptTransaction(encryptedTx);

      expect(encryptionService.decryptNumber).toHaveBeenCalledWith('encrypted-1000');
      expect(result.amount).toBe(1000);
      expect((result as any).encryptedAmount).toBeUndefined();
    });

    it('should fallback to original amount on decryption failure', () => {
      const encryptedTx = {
        ...mockTransaction,
        amount: 500,
        encryptedAmount: 'corrupted-data',
      } as any;

      (encryptionService.decryptNumber as jest.Mock).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = decryptTransaction(encryptedTx);

      expect(logger.warn).toHaveBeenCalledWith('Failed to decrypt amount, using original value');
      expect(result.amount).toBe(500); // Falls back to original
    });

    it('should not decrypt if encryptedAmount not present', () => {
      const plainTx = {
        ...mockTransaction,
        amount: 1000,
      } as Transaction;

      const result = decryptTransaction(plainTx);

      expect(encryptionService.decryptNumber).not.toHaveBeenCalled();
      expect(result.amount).toBe(1000);
    });

    it('should handle missing description field', () => {
      const txWithoutDesc = {
        ...mockTransaction,
        description: undefined,
      } as any;

      const result = decryptTransaction(txWithoutDesc);

      expect(encryptionService.isEncrypted).not.toHaveBeenCalled();
      expect(result.description).toBeUndefined();
    });

    it('should preserve all other fields', () => {
      const encryptedTx = {
        ...mockTransaction,
        reviewStatus: 'approved',
        accountId: 'acc1',
      } as Transaction;

      (encryptionService.isEncrypted as jest.Mock).mockReturnValue(false);

      const result = decryptTransaction(encryptedTx);

      expect(result.id).toBe('tx1');
      expect(result.userId).toBe('user123');
      expect(result.type).toBe('debit');
      expect(result.reviewStatus).toBe('approved');
      expect(result.accountId).toBe('acc1');
    });
  });

  describe('decryptTransactions', () => {
    it('should decrypt array of transactions', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          description: 'encrypted-1',
          amount: 100,
        } as Transaction,
        {
          id: 'tx2',
          description: 'encrypted-2',
          amount: 200,
        } as Transaction,
      ];

      (encryptionService.isEncrypted as jest.Mock).mockReturnValue(true);
      (encryptionService.decrypt as jest.Mock)
        .mockReturnValueOnce('Decrypted 1')
        .mockReturnValueOnce('Decrypted 2');

      const result = decryptTransactions(transactions);

      expect(result).toHaveLength(2);
      expect(result[0].description).toBe('Decrypted 1');
      expect(result[1].description).toBe('Decrypted 2');
    });

    it('should handle empty array', () => {
      const result = decryptTransactions([]);

      expect(result).toEqual([]);
    });

    it('should handle array with mixed encrypted/plain transactions', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          description: 'encrypted',
          encryptedAmount: 'encrypted-100',
        } as any,
        {
          id: 'tx2',
          description: 'plain',
          amount: 200,
        } as Transaction,
      ];

      (encryptionService.isEncrypted as jest.Mock)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      (encryptionService.decrypt as jest.Mock).mockReturnValue('Decrypted');
      (encryptionService.decryptNumber as jest.Mock).mockReturnValue(100);

      const result = decryptTransactions(transactions);

      expect(result[0].description).toBe('Decrypted');
      expect(result[0].amount).toBe(100);
      expect(result[1].description).toBe('plain');
      expect(result[1].amount).toBe(200);
    });
  });

  describe('End-to-end encryption/decryption', () => {
    it('should round-trip encrypt and decrypt transaction', () => {
      const original: Partial<Transaction> = {
        id: 'tx1',
        userId: 'user123',
        amount: 1234.56,
        description: 'Grocery Shopping',
        type: 'debit',
      };

      // Mock encryption
      (encryptionService.encrypt as jest.Mock).mockImplementation((val) => `encrypted-${val}`);
      (encryptionService.encryptNumber as jest.Mock).mockImplementation(
        (val) => `encrypted-${val}`
      );

      const encrypted = encryptTransaction(original);

      expect(encrypted.description).toBe('encrypted-Grocery Shopping');
      expect((encrypted as any).encryptedAmount).toBe('encrypted-1234.56');

      // Mock decryption
      (encryptionService.isEncrypted as jest.Mock).mockImplementation((val: string) =>
        val.startsWith('encrypted-')
      );
      (encryptionService.decrypt as jest.Mock).mockImplementation((val: string) =>
        val.replace('encrypted-', '')
      );
      (encryptionService.decryptNumber as jest.Mock).mockImplementation((val: string) =>
        parseFloat(val.replace('encrypted-', ''))
      );

      const decrypted = decryptTransaction(encrypted as Transaction);

      expect(decrypted.description).toBe('Grocery Shopping');
      expect(decrypted.amount).toBe(1234.56);
      expect((decrypted as any).encryptedAmount).toBeUndefined();
    });
  });
});
