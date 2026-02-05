import { z } from 'zod';
import {
  objectIdSchema,
  positiveAmountSchema,
  currencyCodeSchema,
  hexColorSchema,
  emojiSchema
} from './common';

// ============================================================================
// Account Validation Schemas
// ============================================================================

/**
 * Account type enum
 */
export const accountTypeSchema = z.enum([
  'Cash',
  'Bank',
  'CreditCard',
  'Investment',
  'Loan',
  'Wallet',
  'Other'
]);

export type AccountType = z.infer<typeof accountTypeSchema>;

/**
 * Create account request schema
 */
export const createAccountSchema = z.object({
  name: z.string()
    .min(1, 'Account name is required')
    .max(100, 'Account name must be at most 100 characters'),
  type: accountTypeSchema,
  currency: currencyCodeSchema,
  initialBalance: z.number().optional().default(0),
  description: z.string().max(500).optional(),
  color: hexColorSchema.optional(),
  icon: emojiSchema,
  isDefault: z.boolean().optional().default(false),
  includeInTotal: z.boolean().optional().default(true),
  // Credit card specific fields
  creditLimit: positiveAmountSchema.optional(),
  billingDay: z.number().int().min(1).max(31).optional(),
  // Loan specific fields
  interestRate: z.number().min(0).max(100).optional(),
  loanTerm: z.number().int().positive().optional(), // in months
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

/**
 * Update account request schema
 */
export const updateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: accountTypeSchema.optional(),
  currency: currencyCodeSchema.optional(),
  description: z.string().max(500).optional().nullable(),
  color: hexColorSchema.optional().nullable(),
  icon: emojiSchema.nullable(),
  isDefault: z.boolean().optional(),
  includeInTotal: z.boolean().optional(),
  creditLimit: positiveAmountSchema.optional().nullable(),
  billingDay: z.number().int().min(1).max(31).optional().nullable(),
  interestRate: z.number().min(0).max(100).optional().nullable(),
  loanTerm: z.number().int().positive().optional().nullable(),
  isArchived: z.boolean().optional(),
});

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

/**
 * Account balance adjustment schema
 */
export const adjustBalanceSchema = z.object({
  newBalance: z.number(),
  notes: z.string().max(500).optional(),
});

export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>;

/**
 * Account response validation (for API responses)
 */
export const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: accountTypeSchema,
  currency: z.string(),
  balance: z.number(),
  description: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  isDefault: z.boolean(),
  includeInTotal: z.boolean(),
  creditLimit: z.number().optional().nullable(),
  billingDay: z.number().optional().nullable(),
  interestRate: z.number().optional().nullable(),
  loanTerm: z.number().optional().nullable(),
  isArchived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Computed fields
  availableCredit: z.number().optional(),
  utilizationPercent: z.number().optional(),
});

export type Account = z.infer<typeof accountSchema>;

/**
 * Account summary response
 */
export const accountSummarySchema = z.object({
  totalAccounts: z.number(),
  totalBalance: z.number(),
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  netWorth: z.number(),
  primaryCurrency: z.string(),
  accounts: z.array(accountSchema),
  byType: z.record(z.string(), z.object({
    count: z.number(),
    totalBalance: z.number(),
  })),
});

export type AccountSummary = z.infer<typeof accountSummarySchema>;

/**
 * Label/Category schema
 */
export const labelSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  icon: z.string().optional(),
  parentId: z.string().optional().nullable(),
  isFolder: z.boolean(),
  sortOrder: z.number(),
  transactionCount: z.number().optional(),
});

export type Label = z.infer<typeof labelSchema>;

/**
 * Create label request
 */
export const createLabelSchema = z.object({
  name: z.string()
    .min(1, 'Label name is required')
    .max(50, 'Label name must be at most 50 characters'),
  color: hexColorSchema.optional(),
  icon: emojiSchema,
  parentId: objectIdSchema.optional(),
  isFolder: z.boolean().optional().default(false),
});

export type CreateLabelInput = z.infer<typeof createLabelSchema>;

/**
 * Update label request
 */
export const updateLabelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: hexColorSchema.optional().nullable(),
  icon: emojiSchema.nullable(),
  parentId: objectIdSchema.optional().nullable(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;

/**
 * Tag schema
 */
export const tagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  usageCount: z.number().optional(),
});

export type Tag = z.infer<typeof tagSchema>;

/**
 * Create tag request
 */
export const createTagSchema = z.object({
  name: z.string()
    .min(1, 'Tag name is required')
    .max(30, 'Tag name must be at most 30 characters')
    .regex(/^[a-zA-Z0-9\-_\s]+$/, 'Tag name can only contain letters, numbers, hyphens, underscores, and spaces'),
  color: hexColorSchema.optional(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;

/**
 * Update tag request
 */
export const updateTagSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  color: hexColorSchema.optional().nullable(),
});

export type UpdateTagInput = z.infer<typeof updateTagSchema>;