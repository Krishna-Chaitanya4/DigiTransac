import { z } from 'zod';

// ============================================================================
// Common Validation Schemas
// ============================================================================

/**
 * MongoDB ObjectId validation (24 character hex string)
 */
export const objectIdSchema = z.string().regex(
  /^[a-fA-F0-9]{24}$/,
  'Invalid ID format'
);

/**
 * Email validation with comprehensive checks
 */
export const emailSchema = z.string()
  .email('Invalid email address')
  .min(5, 'Email must be at least 5 characters')
  .max(255, 'Email must be at most 255 characters')
  .transform(val => val.toLowerCase().trim());

/**
 * Password validation with security requirements
 */
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Simple password for less strict validation (e.g., existing users)
 */
export const simplePasswordSchema = z.string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password must be at most 128 characters');

/**
 * Currency code validation (ISO 4217)
 */
export const currencyCodeSchema = z.string()
  .length(3, 'Currency code must be 3 characters')
  .regex(/^[A-Z]{3}$/, 'Invalid currency code format')
  .transform(val => val.toUpperCase());

/**
 * Common supported currencies
 */
export const supportedCurrencies = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'MXN',
  'BRL', 'KRW', 'SGD', 'HKD', 'SEK', 'NOK', 'DKK', 'NZD', 'ZAR', 'AED'
] as const;

export const supportedCurrencySchema = z.enum(supportedCurrencies);

/**
 * Positive decimal amount (for money)
 */
export const positiveAmountSchema = z.number()
  .positive('Amount must be positive')
  .max(999999999.99, 'Amount is too large')
  .transform(val => Math.round(val * 100) / 100); // Round to 2 decimal places

/**
 * Non-negative decimal amount
 */
export const nonNegativeAmountSchema = z.number()
  .nonnegative('Amount cannot be negative')
  .max(999999999.99, 'Amount is too large')
  .transform(val => Math.round(val * 100) / 100);

/**
 * Date string validation (ISO 8601 format)
 */
export const dateStringSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/, 'Invalid date format');

/**
 * Date-only string (YYYY-MM-DD)
 */
export const dateOnlySchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

/**
 * Time string (HH:mm)
 */
export const timeSchema = z.string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm format');

/**
 * IANA timezone validation
 */
export const timezoneSchema = z.string()
  .min(1, 'Timezone is required')
  .refine(tz => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, 'Invalid timezone');

/**
 * Hex color validation
 */
export const hexColorSchema = z.string()
  .regex(/^#[a-fA-F0-9]{6}$/, 'Invalid hex color format (use #RRGGBB)');

/**
 * Optional hex color
 */
export const optionalHexColorSchema = hexColorSchema.optional();

/**
 * Emoji validation (single emoji character)
 */
export const emojiSchema = z.string()
  .regex(/^[\p{Emoji}]$/u, 'Must be a single emoji')
  .optional();

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Sort order
 */
export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

/**
 * URL validation
 */
export const urlSchema = z.string().url('Invalid URL');

/**
 * Phone number validation (E.164 format)
 */
export const phoneSchema = z.string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g., +14155551234)');

/**
 * Username/display name validation
 */
export const displayNameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be at most 100 characters')
  .trim();

/**
 * Search text validation
 */
export const searchTextSchema = z.string()
  .max(200, 'Search text too long')
  .transform(val => val.trim());