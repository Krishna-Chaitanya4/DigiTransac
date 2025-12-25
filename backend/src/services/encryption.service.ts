import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import crypto, { CipherGCM, DecipherGCM } from 'crypto';

class EncryptionService {
  private secretClient: SecretClient | null = null;
  private masterKey: string | null = null;
  private algorithm = 'aes-256-gcm';
  private keyVaultUrl: string;

  constructor() {
    this.keyVaultUrl = process.env.KEY_VAULT_URL || 'https://digitransac-kv-3895.vault.azure.net/';
  }

  /**
   * Initialize connection to Azure Key Vault and retrieve master key
   */
  async initialize(): Promise<void> {
    try {
      // In development, use environment variable for master key
      if (process.env.NODE_ENV === 'development' && process.env.MASTER_ENCRYPTION_KEY) {
        this.masterKey = process.env.MASTER_ENCRYPTION_KEY;
        console.log('✅ Using master key from environment variable (development mode)');
        return;
      }

      // In production, use Azure Key Vault
      const credential = new DefaultAzureCredential();
      this.secretClient = new SecretClient(this.keyVaultUrl, credential);

      const secret = await this.secretClient.getSecret('master-encryption-key');
      this.masterKey = secret.value!;

      console.log('✅ Master encryption key retrieved from Azure Key Vault');
    } catch (error) {
      console.error('❌ Error initializing encryption service:', error);
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
      console.error('Encryption error:', error);
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
      console.error('Decryption error:', error);
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
