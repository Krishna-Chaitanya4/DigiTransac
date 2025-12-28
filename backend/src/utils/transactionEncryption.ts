import { encryptionService } from '../services/encryption.service';
import { Transaction } from '../models/types';
import { logger } from './logger';

/**
 * Transaction with encrypted fields
 */
interface EncryptedTransaction extends Partial<Transaction> {
  encryptedAmount?: string;
}

/**
 * Encrypt sensitive fields in a transaction before storing in database
 */
export function encryptTransaction(transaction: Partial<Transaction>): EncryptedTransaction {
  const encrypted: EncryptedTransaction = { ...transaction };

  // Encrypt description if present and non-empty
  if (encrypted.description && encrypted.description.trim()) {
    encrypted.description = encryptionService.encrypt(encrypted.description);
  }

  // Encrypt amount (store as encrypted string)
  if (typeof encrypted.amount === 'number') {
    encrypted.encryptedAmount = encryptionService.encryptNumber(encrypted.amount);
    // Keep original amount for backward compatibility during migration
  }

  return encrypted;
}

/**
 * Decrypt sensitive fields in a transaction after retrieving from database
 */
export function decryptTransaction(transaction: Transaction | EncryptedTransaction): Transaction {
  const encrypted = transaction as EncryptedTransaction;
  const decrypted: Transaction = { ...transaction } as Transaction;

  // Decrypt description
  if (decrypted.description && encryptionService.isEncrypted(decrypted.description)) {
    try {
      decrypted.description = encryptionService.decrypt(decrypted.description);
    } catch {
      logger.warn('Failed to decrypt description, using original value');
    }
  }

  // Decrypt amount if encryptedAmount exists
  if (encrypted.encryptedAmount) {
    try {
      decrypted.amount = encryptionService.decryptNumber(encrypted.encryptedAmount);
      // Remove the encrypted field from response
      delete (decrypted as EncryptedTransaction).encryptedAmount;
    } catch {
      // If decryption fails, use original amount (backward compatibility)
      logger.warn('Failed to decrypt amount, using original value');
    }
  }

  return decrypted;
}

/**
 * Decrypt an array of transactions
 */
export function decryptTransactions(
  transactions: (Transaction | EncryptedTransaction)[]
): Transaction[] {
  return transactions.map(decryptTransaction);
}
