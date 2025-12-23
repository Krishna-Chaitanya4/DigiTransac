import { encryptionService } from '../services/encryption.service';
import { Transaction } from '../models/types';

/**
 * Encrypt sensitive fields in a transaction before storing in database
 */
export function encryptTransaction(transaction: Partial<Transaction>): Partial<Transaction> {
  const encrypted = { ...transaction };

  // Encrypt description if present
  if (encrypted.description) {
    encrypted.description = encryptionService.encrypt(encrypted.description);
  }

  // Encrypt amount (store as encrypted string)
  if (typeof encrypted.amount === 'number') {
    (encrypted as any).encryptedAmount = encryptionService.encryptNumber(encrypted.amount);
    // Keep original amount for backward compatibility during migration
  }

  return encrypted;
}

/**
 * Decrypt sensitive fields in a transaction after retrieving from database
 */
export function decryptTransaction(transaction: Transaction): Transaction {
  const decrypted = { ...transaction };

  // Decrypt description
  if (decrypted.description && encryptionService.isEncrypted(decrypted.description)) {
    decrypted.description = encryptionService.decrypt(decrypted.description);
  }

  // Decrypt amount if encryptedAmount exists
  if ((decrypted as any).encryptedAmount) {
    try {
      decrypted.amount = encryptionService.decryptNumber((decrypted as any).encryptedAmount);
      // Remove the encrypted field from response
      delete (decrypted as any).encryptedAmount;
    } catch (error) {
      // If decryption fails, use original amount (backward compatibility)
      console.warn('Failed to decrypt amount, using original value');
    }
  }

  return decrypted;
}

/**
 * Decrypt an array of transactions
 */
export function decryptTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.map(decryptTransaction);
}
