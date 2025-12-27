import Joi from 'joi';
import { logger } from './logger';

interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  AZURE_KEY_VAULT_URL: string;
  MONGODB_DATABASE_NAME?: string;
  COSMOS_DATABASE_NAME?: string; // Legacy support
  JWT_EXPIRE: string;
  CORS_ORIGIN: string;
  FRONTEND_URL: string;
  BACKEND_URL: string;
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
}

const envSchema = Joi.object({
  PORT: Joi.number().default(5000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  // Key Vault is required for all secrets
  AZURE_KEY_VAULT_URL: Joi.string().uri().required().messages({
    'string.uri': 'AZURE_KEY_VAULT_URL must be a valid URI',
    'any.required': 'AZURE_KEY_VAULT_URL is required. Run "az login" and set this variable.',
  }),
  KEY_VAULT_URL: Joi.string().uri().optional(), // Legacy alias

  // Database configuration
  MONGODB_DATABASE_NAME: Joi.string().optional(),
  COSMOS_DATABASE_NAME: Joi.string().optional(), // Legacy support

  JWT_EXPIRE: Joi.string().default('7d'),
  CORS_ORIGIN: Joi.string().required(),
  FRONTEND_URL: Joi.string().uri().required(),
  BACKEND_URL: Joi.string().uri().required(),

  // Optional integrations
  GMAIL_CLIENT_ID: Joi.string().optional(),
  GMAIL_CLIENT_SECRET: Joi.string().optional(),

  // Legacy variables (ignored)
  COSMOS_ENDPOINT: Joi.string().optional(),
  COSMOS_KEY: Joi.string().optional(),
  JWT_SECRET: Joi.string().optional(),
  MASTER_ENCRYPTION_KEY: Joi.string().optional(),
}).unknown(true);

export function validateEnv(): EnvConfig {
  const { error, value } = envSchema.validate(process.env, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errorMessage = error.details.map((detail) => detail.message).join(', ');
    logger.error(`Environment validation failed: ${errorMessage}`);
    throw new Error(`Environment validation failed: ${errorMessage}`);
  }

  logger.info('Environment variables validated successfully');
  return value as EnvConfig;
}
