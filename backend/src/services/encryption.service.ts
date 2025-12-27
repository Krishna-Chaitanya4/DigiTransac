import crypto, { CipherGCM, DecipherGCM } from 'crypto';
import { logger } from '../utils/logger';
import { keyVaultService } from '../config/keyVault';

class EncryptionService {
  private masterKey: string | null = null;
  private algorithm = 'aes-256-gcm';

  /**
   * Initialize encryption service by fetching master key from Key Vault
   */
  async initialize(): Promise<void> {
    try {
      // Always fetch from Key Vault (both dev and prod)
      this.masterKey = await keyVaultService.getSecret('Master-Encryption-Key');
      logger.info('✅ Master encryption key retrieved from Key Vault');
    } catch (error) {
      logger.error(error, '❌ Error initializing encryption service');
      throw new Error('Failed to initialize encryption service');
    }
  }

  /**
   * Encrypt a string value
   * @param plaintext - The text to encrypt
   * @returns Encrypted string in format: iv:authTag:encryptedData (all base64)
   */
  encrypt(plaintext: string): string {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    if (!plaintext || plaintext.trim() === '') {
      return plaintext; // Don't encrypt empty strings
    }

    try {
      // Generate random initialization vector (IV)
      const iv = crypto.randomBytes(16);

      // Create cipher (GCM mode)
      const cipher = crypto.createCipheriv(
        this.algorithm,
        Buffer.from(this.masterKey, 'utf-8').subarray(0, 32), // Use first 32 bytes as key
        iv
      ) as CipherGCM;

      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Get authentication tag for GCM mode
      const authTag = cipher.getAuthTag();

      // Return format: iv:authTag:encryptedData (all base64 encoded)
      return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
      logger.error(error, 'Encryption error');
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt an encrypted string
   * @param encryptedData - Encrypted string in format: iv:authTag:encryptedData
   * @returns Decrypted plaintext string
   */
  decrypt(encryptedData: string): string {
    if (!this.masterKey) {
      throw new Error('Encryption service not initialized');
    }

    if (!encryptedData || encryptedData.trim() === '') {
      return encryptedData; // Return empty strings as-is
    }

    try {
      // Split the encrypted data
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        // Not encrypted data, return as-is (backward compatibility)
        return encryptedData;
      }

      const [ivBase64, authTagBase64, encrypted] = parts;

      // Convert from base64
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');

      // Create decipher (GCM mode)
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        Buffer.from(this.masterKey, 'utf-8').subarray(0, 32),
        iv
      ) as DecipherGCM;

      // Set authentication tag
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error(error, 'Decryption error');
      // Return original data if decryption fails (backward compatibility)
      return encryptedData;
    }
  }

  /**
   * Encrypt a number and return as encrypted string
   */
  encryptNumber(value: number): string {
    return this.encrypt(value.toString());
  }

  /**
   * Decrypt an encrypted number
   */
  decryptNumber(encryptedValue: string): number {
    const decrypted = this.decrypt(encryptedValue);
    return parseFloat(decrypted);
  }

  /**
   * Check if data is encrypted (has the iv:authTag:data format)
   */
  isEncrypted(data: string): boolean {
    if (!data) return false;
    const parts = data.split(':');
    return parts.length === 3;
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService();
