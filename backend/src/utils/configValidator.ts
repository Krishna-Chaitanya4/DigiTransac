import { logger } from './logger';

/**
 * Validates required environment variables on startup
 * Throws error if critical configuration is missing
 * 
 * Note: Secrets (MongoDB connection, JWT secret, encryption key) are now
 * stored in Azure Key Vault and validated at runtime, not here.
 */
export const validateConfig = (): void => {
  const required = ['AZURE_KEY_VAULT_URL'];

  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    logger.error({ missing }, '❌ Missing required environment variables');
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Run "az login" and set AZURE_KEY_VAULT_URL=https://digitransac-kv-3895.vault.azure.net/'
    );
  }

  logger.info('✅ Configuration validated successfully');
};
