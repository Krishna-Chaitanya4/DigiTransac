import Joi from 'joi';
import { logger } from './logger';

interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  COSMOS_ENDPOINT: string;
  COSMOS_KEY: string;
  COSMOS_DATABASE_NAME: string;
  JWT_SECRET: string;
  JWT_EXPIRE: string;
  CORS_ORIGIN: string;
  FRONTEND_URL: string;
  BACKEND_URL: string;
  MASTER_ENCRYPTION_KEY?: string;
  KEY_VAULT_URL?: string;
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
}

const envSchema = Joi.object({
  PORT: Joi.number().default(5000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  COSMOS_ENDPOINT: Joi.string().uri().required(),
  COSMOS_KEY: Joi.string().required(),
  COSMOS_DATABASE_NAME: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRE: Joi.string().default('7d'),
  CORS_ORIGIN: Joi.string().required(),
  FRONTEND_URL: Joi.string().uri().required(),
  BACKEND_URL: Joi.string().uri().required(),
  MASTER_ENCRYPTION_KEY: Joi.string().optional(),
  KEY_VAULT_URL: Joi.string().uri().optional(),
  GMAIL_CLIENT_ID: Joi.string().optional(),
  GMAIL_CLIENT_SECRET: Joi.string().optional(),
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
