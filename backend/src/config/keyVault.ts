import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { logger } from '../utils/logger';

class KeyVaultService {
  private client: SecretClient | null = null;
  private secretCache: Map<string, string> = new Map();
  private initialized: boolean = false;

  private initializeClient() {
    if (this.initialized) return;

    try {
      const keyVaultUrl = process.env.AZURE_KEY_VAULT_URL || process.env.KEY_VAULT_URL;

      if (!keyVaultUrl) {
        throw new Error(
          '❌ AZURE_KEY_VAULT_URL is required for secure secret management.\n' +
            '📋 Setup instructions:\n' +
            '  1. Run: az login\n' +
            '  2. Set: AZURE_KEY_VAULT_URL=https://digitransac-kv-3895.vault.azure.net/\n' +
            '  3. Restart the application'
        );
      }

      // Use DefaultAzureCredential for both dev and prod
      // - Development: Uses Azure CLI credentials (az login)
      // - Production: Uses Managed Identity
      const credential = new DefaultAzureCredential();
      this.client = new SecretClient(keyVaultUrl, credential);

      const env = process.env.NODE_ENV || 'development';
      logger.info(
        {
          keyVaultUrl,
          authMethod: env === 'production' ? 'Managed Identity' : 'Azure CLI (az login)',
        },
        '🔐 Key Vault client initialized'
      );

      this.initialized = true;
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Key Vault client');
      throw error;
    }
  }

  async getSecret(secretName: string): Promise<string> {
    // Lazy initialization on first use
    if (!this.initialized) {
      this.initializeClient();
    }
    // Check cache first
    if (this.secretCache.has(secretName)) {
      return this.secretCache.get(secretName)!;
    }

    // Fetch from Key Vault
    try {
      if (!this.client) {
        throw new Error('Key Vault client not initialized');
      }

      const secret = await this.client.getSecret(secretName);

      if (!secret.value) {
        throw new Error(`Secret ${secretName} has no value in Key Vault`);
      }

      // Cache the secret
      this.secretCache.set(secretName, secret.value);
      logger.info(`✅ Retrieved secret: ${secretName} from Key Vault`);

      return secret.value;
    } catch (error) {
      logger.error({ error, secretName }, `Failed to get secret ${secretName} from Key Vault`);
      throw error;
    }
  }

  // Clear cache (useful for secret rotation)
  clearCache() {
    this.secretCache.clear();
    logger.info('Key Vault cache cleared');
  }
}

export const keyVaultService = new KeyVaultService();
