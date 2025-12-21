import { logger } from './logger';

/**
 * Validates required environment variables on startup
 * Throws error if critical configuration is missing
 */
export const validateConfig = (): void => {
  const required = ['COSMOS_ENDPOINT', 'COSMOS_KEY', 'COSMOS_DATABASE_NAME', 'JWT_SECRET'];

  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    logger.error({ missing }, '❌ Missing required environment variables');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Warn about development defaults
  if (
    process.env.JWT_SECRET === 'fallback-secret' ||
    process.env.JWT_SECRET === 'your-jwt-secret-change-in-production'
  ) {
    logger.warn('⚠️  Using weak JWT_SECRET - not suitable for production!');
  }

  // Validate JWT_SECRET strength in production
  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      logger.warn('⚠️  JWT_SECRET is too short for production (minimum 32 characters recommended)');
    }
  }

  logger.info('✅ Configuration validated successfully');
};
