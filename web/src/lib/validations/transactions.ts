import { z } from 'zod';
import { 
  objectIdSchema, 
  positiveAmountSchema, 
  dateStringSchema, 
  dateOnlySchema,
  timeSchema,
  timezoneSchema,
  emailSchema,
  searchTextSchema,
  paginationSchema 
} from './common';

// ============================================================================
// Transaction Validation Schemas
// ============================================================================

/**
 * Transaction type enum
 */
export const transactionTypeSchema = z.enum(['Receive', 'Send']);

/**
 * UI transaction type (includes Transfer)
 */
export const transactionUITypeSchema = z.enum(['Receive', 'Send', 'Transfer']);

/**
 * Transaction role enum
 */
export const transactionRoleSchema = z.enum(['Sender', 'Receiver']);

/**
 * Transaction status enum
 */
export const transactionStatusSchema = z.enum(['Pending', 'Confirmed', 'Declined']);

/**
 * Recurrence frequency enum
 */
export const recurrenceFrequencySchema = z.enum([
  'Daily', 
  'Weekly', 
  'Biweekly', 
  'Monthly', 
  'Quarterly', 
  'Yearly'
]);

/**
 * Transaction location schema
 */
export const transactionLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  placeName: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
});

export type TransactionLocationInput = z.infer<typeof transactionLocationSchema>;

/**
 * Transaction split schema (for category allocation)
 */
export const transactionSplitSchema = z.object({
  labelId: objectIdSchema,
  amount: positiveAmountSchema,
  notes: z.string().max(500).optional(),
});

export type TransactionSplitInput = z.infer<typeof transactionSplitSchema>;

/**
 * Recurring rule schema
 */
export const recurringRuleSchema = z.object({
  frequency: recurrenceFrequencySchema,
  interval: z.number().int().min(1).max(365).optional().default(1),
  endDate: dateStringSchema.optional(),
});

export type RecurringRuleInput = z.infer<typeof recurringRuleSchema>;

/**
 * Create transaction request schema
 */
export const createTransactionSchema = z.object({
  accountId: objectIdSchema,
  type: transactionTypeSchema,
  amount: positiveAmountSchema,
  date: dateStringSchema,
  title: z.string().min(1).max(200).optional(),
  payee: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  splits: z.array(transactionSplitSchema).min(0).max(50),
  tagIds: z.array(objectIdSchema).max(20).optional(),
  location: transactionLocationSchema.optional(),
  transferToAccountId: objectIdSchema.optional(),
  recurringRule: recurringRuleSchema.optional(),
  // P2P fields
  counterpartyEmail: emailSchema.optional(),
  counterpartyAmount: positiveAmountSchema.optional(),
  // Timezone-aware fields
  dateLocal: dateOnlySchema.optional(),
  timeLocal: timeSchema.optional(),
  dateTimezone: timezoneSchema.optional(),
}).refine(data => {
  // Validate that splits total matches amount if splits are provided
  if (data.splits.length > 0) {
    const splitTotal = data.splits.reduce((sum, split) => sum + split.amount, 0);
    return Math.abs(splitTotal - data.amount) < 0.01; // Allow small rounding errors
  }
  return true;
}, {
  message: 'Split amounts must equal transaction amount',
  path: ['splits'],
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/**
 * Update transaction request schema
 */
export const updateTransactionSchema = z.object({
  type: transactionTypeSchema.optional(),
  amount: positiveAmountSchema.optional(),
  date: dateStringSchema.optional(),
  title: z.string().min(1).max(200).optional().nullable(),
  payee: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  splits: z.array(transactionSplitSchema).min(0).max(50).optional(),
  tagIds: z.array(objectIdSchema).max(20).optional(),
  location: transactionLocationSchema.optional().nullable(),
  status: transactionStatusSchema.optional(),
  transferToAccountId: objectIdSchema.optional().nullable(),
  accountId: objectIdSchema.optional(),
  // Timezone-aware fields
  dateLocal: dateOnlySchema.optional(),
  timeLocal: timeSchema.optional(),
  dateTimezone: timezoneSchema.optional(),
});

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

/**
 * Transaction filter schema
 */
export const transactionFilterSchema = z.object({
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  accountIds: z.array(objectIdSchema).optional(),
  types: z.array(transactionUITypeSchema).optional(),
  labelIds: z.array(objectIdSchema).optional(),
  folderIds: z.array(objectIdSchema).optional(),
  tagIds: z.array(objectIdSchema).optional(),
  counterpartyUserIds: z.array(objectIdSchema).optional(),
  minAmount: z.number().nonnegative().optional(),
  maxAmount: z.number().positive().optional(),
  searchText: searchTextSchema.optional(),
  status: transactionStatusSchema.optional(),
  isRecurring: z.boolean().optional(),
}).merge(paginationSchema.partial()).refine(data => {
  // Validate date range
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: 'Start date must be before or equal to end date',
  path: ['startDate'],
}).refine(data => {
  // Validate amount range
  if (data.minAmount !== undefined && data.maxAmount !== undefined) {
    return data.minAmount <= data.maxAmount;
  }
  return true;
}, {
  message: 'Min amount must be less than or equal to max amount',
  path: ['minAmount'],
});

export type TransactionFilterInput = z.infer<typeof transactionFilterSchema>;

/**
 * Batch transaction request schema
 */
export const batchTransactionSchema = z.object({
  transactions: z.array(createTransactionSchema).min(1).max(100),
});

export type BatchTransactionInput = z.infer<typeof batchTransactionSchema>;

/**
 * Transaction response validation (for API responses)
 */
export const transactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  accountName: z.string().optional(),
  type: transactionTypeSchema,
  amount: z.number(),
  currency: z.string(),
  date: z.string(),
  title: z.string().optional().nullable(),
  payee: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  splits: z.array(z.object({
    labelId: z.string(),
    labelName: z.string().optional(),
    labelColor: z.string().optional(),
    labelIcon: z.string().optional(),
    amount: z.number(),
    notes: z.string().optional().nullable(),
  })),
  tagIds: z.array(z.string()),
  tags: z.array(z.object({
    id: z.string(),
    name: z.string(),
    color: z.string().optional(),
  })),
  location: transactionLocationSchema.optional().nullable(),
  transferToAccountId: z.string().optional().nullable(),
  transferToAccountName: z.string().optional().nullable(),
  linkedTransactionId: z.string().optional().nullable(),
  recurringRule: z.object({
    frequency: recurrenceFrequencySchema,
    interval: z.number(),
    endDate: z.string().optional().nullable(),
    nextOccurrence: z.string(),
  }).optional().nullable(),
  parentTransactionId: z.string().optional().nullable(),
  isRecurringTemplate: z.boolean(),
  status: transactionStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  // P2P fields
  transactionLinkId: z.string().optional().nullable(),
  counterpartyEmail: z.string().optional().nullable(),
  counterpartyUserId: z.string().optional().nullable(),
  role: transactionRoleSchema.optional(),
  lastSyncedAt: z.string().optional().nullable(),
  chatMessageId: z.string().optional().nullable(),
  // Timezone fields
  dateLocal: z.string().optional().nullable(),
  timeLocal: z.string().optional().nullable(),
  dateTimezone: z.string().optional().nullable(),
});

export type Transaction = z.infer<typeof transactionSchema>;

/**
 * Transaction list response validation
 */
export const transactionListResponseSchema = z.object({
  transactions: z.array(transactionSchema),
  totalCount: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

export type TransactionListResponse = z.infer<typeof transactionListResponseSchema>;