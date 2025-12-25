/**
 * Application Constants
 * Central location for all magic numbers, strings, and configuration values
 */

export const API_CONFIG = {
  // Request timeouts
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  UPLOAD_TIMEOUT: 60000, // 1 minute

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2 seconds

  // Rate limiting
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,

  // Pagination
  DEFAULT_PAGE_SIZE: 100,
  MAX_PAGE_SIZE: 1000,
} as const;

export const AUTH_CONFIG = {
  // Token expiration
  JWT_EXPIRE_TIME: '7d',
  REFRESH_TOKEN_EXPIRE: '30d',

  // Password requirements
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
} as const;

export const DATABASE_CONFIG = {
  // Connection pool
  MIN_POOL_SIZE: 10,
  MAX_POOL_SIZE: 50,

  // Query timeout
  QUERY_TIMEOUT: 10000, // 10 seconds

  // Health check
  HEALTH_CHECK_TIMEOUT: 5000, // 5 seconds
} as const;

export const VALIDATION_CONFIG = {
  // Transaction
  MAX_DESCRIPTION_LENGTH: 500,
  MIN_AMOUNT: 0.01,
  MAX_AMOUNT: 999999999.99,

  // Category
  MAX_CATEGORY_NAME_LENGTH: 100,

  // Budget
  MAX_BUDGET_NAME_LENGTH: 100,

  // Account
  MAX_ACCOUNT_NAME_LENGTH: 100,
} as const;

export const FILE_CONFIG = {
  // Upload limits
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const ERROR_MESSAGES = {
  // Auth
  INVALID_CREDENTIALS: 'Invalid email or password',
  TOKEN_EXPIRED: 'Authentication token has expired',
  TOKEN_INVALID: 'Invalid authentication token',
  UNAUTHORIZED: 'Authentication required',

  // Validation
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Invalid email address',
  INVALID_DATE: 'Invalid date format',
  AMOUNT_TOO_LOW: 'Amount must be greater than 0',
  AMOUNT_TOO_HIGH: 'Amount exceeds maximum allowed value',

  // Database
  NOT_FOUND: 'Resource not found',
  ALREADY_EXISTS: 'Resource already exists',
  DATABASE_ERROR: 'Database operation failed',

  // Server
  INTERNAL_ERROR: 'An internal server error occurred',
  SERVICE_UNAVAILABLE: 'Service is temporarily unavailable',
} as const;

export const SUCCESS_MESSAGES = {
  // Auth
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  REGISTER_SUCCESS: 'Registration successful',

  // CRUD
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
} as const;

export const TRANSACTION_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense',
  TRANSFER: 'transfer',
} as const;

export const REVIEW_STATUS = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  FLAGGED: 'flagged',
} as const;

export const CATEGORY_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense',
} as const;

export const BUDGET_PERIODS = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
} as const;
