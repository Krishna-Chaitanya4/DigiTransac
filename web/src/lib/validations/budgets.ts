import { z } from 'zod';
import { 
  objectIdSchema, 
  positiveAmountSchema, 
  currencyCodeSchema,
  dateStringSchema,
  hexColorSchema,
  emojiSchema
} from './common';

// ============================================================================
// Budget Validation Schemas
// ============================================================================

/**
 * Budget period enum
 */
export const budgetPeriodSchema = z.enum([
  'Weekly', 
  'Monthly', 
  'Quarterly', 
  'Yearly', 
  'Custom'
]);

/**
 * Budget alert schema
 */
export const budgetAlertSchema = z.object({
  thresholdPercent: z.number().min(0).max(100),
  notifyEnabled: z.boolean(),
});

export type BudgetAlertInput = z.infer<typeof budgetAlertSchema>;

/**
 * Create budget request schema
 */
export const createBudgetSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  description: z.string().max(500).optional(),
  amount: positiveAmountSchema,
  currency: currencyCodeSchema.optional(),
  period: budgetPeriodSchema,
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  labelIds: z.array(objectIdSchema).max(50).optional(),
  accountIds: z.array(objectIdSchema).max(20).optional(),
  alerts: z.array(budgetAlertSchema).max(10).optional(),
  color: hexColorSchema.optional(),
  icon: emojiSchema,
}).refine(data => {
  // Custom period requires both start and end dates
  if (data.period === 'Custom') {
    return data.startDate && data.endDate;
  }
  return true;
}, {
  message: 'Custom period requires start and end dates',
  path: ['period'],
}).refine(data => {
  // End date must be after start date if both provided
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) < new Date(data.endDate);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
}).refine(data => {
  // Alert thresholds should be unique
  if (data.alerts && data.alerts.length > 0) {
    const thresholds = data.alerts.map(a => a.thresholdPercent);
    return new Set(thresholds).size === thresholds.length;
  }
  return true;
}, {
  message: 'Alert thresholds must be unique',
  path: ['alerts'],
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

/**
 * Update budget request schema
 */
export const updateBudgetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  amount: positiveAmountSchema.optional(),
  currency: currencyCodeSchema.optional(),
  period: budgetPeriodSchema.optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional().nullable(),
  labelIds: z.array(objectIdSchema).max(50).optional(),
  accountIds: z.array(objectIdSchema).max(20).optional(),
  alerts: z.array(budgetAlertSchema).max(10).optional(),
  isActive: z.boolean().optional(),
  color: hexColorSchema.optional().nullable(),
  icon: emojiSchema.nullable(),
});

export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

/**
 * Budget response validation (for API responses)
 */
export const budgetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  amount: z.number(),
  currency: z.string(),
  period: budgetPeriodSchema,
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
  labelIds: z.array(z.string()),
  labels: z.array(z.object({
    id: z.string(),
    name: z.string(),
    color: z.string().optional(),
    icon: z.string().optional(),
  })),
  accountIds: z.array(z.string()),
  accounts: z.array(z.object({
    id: z.string(),
    name: z.string(),
    currency: z.string(),
  })),
  alerts: z.array(z.object({
    thresholdPercent: z.number(),
    notifyEnabled: z.boolean(),
    triggered: z.boolean(),
    lastTriggeredAt: z.string().optional().nullable(),
  })),
  isActive: z.boolean(),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  // Computed spending info
  amountSpent: z.number(),
  amountRemaining: z.number(),
  percentUsed: z.number(),
  periodStart: z.string(),
  periodEnd: z.string(),
  daysRemaining: z.number(),
  isOverBudget: z.boolean(),
  // Multi-currency support
  spendingByCurrency: z.record(z.string(), z.object({
    originalAmount: z.number(),
    convertedAmount: z.number(),
    transactionCount: z.number(),
  })).optional(),
  primaryCurrency: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Budget = z.infer<typeof budgetSchema>;

/**
 * Budget summary response validation
 */
export const budgetSummarySchema = z.object({
  totalBudgets: z.number(),
  activeBudgets: z.number(),
  overBudgetCount: z.number(),
  nearLimitCount: z.number(),
  totalBudgetAmount: z.number(),
  totalSpent: z.number(),
  totalRemaining: z.number(),
  primaryCurrency: z.string(),
  budgets: z.array(budgetSchema),
});

export type BudgetSummary = z.infer<typeof budgetSummarySchema>;

/**
 * Budget notification schema
 */
export const budgetNotificationSchema = z.object({
  id: z.string(),
  budgetId: z.string(),
  budgetName: z.string(),
  thresholdPercent: z.number(),
  percentUsed: z.number(),
  amountSpent: z.number(),
  budgetAmount: z.number(),
  currency: z.string(),
  createdAt: z.string(),
  isRead: z.boolean(),
});

export type BudgetNotification = z.infer<typeof budgetNotificationSchema>;

/**
 * Category spending breakdown schema
 */
export const categorySpendingSchema = z.object({
  labelId: z.string(),
  labelName: z.string(),
  labelColor: z.string().optional(),
  labelIcon: z.string().optional(),
  amount: z.number(),
  percentage: z.number(),
  transactionCount: z.number(),
});

export type CategorySpending = z.infer<typeof categorySpendingSchema>;

/**
 * Daily spending schema
 */
export const dailySpendingSchema = z.object({
  date: z.string(),
  amount: z.number(),
  cumulativeAmount: z.number(),
  budgetProrated: z.number(),
});

export type DailySpending = z.infer<typeof dailySpendingSchema>;

/**
 * Budget spending breakdown response
 */
export const budgetSpendingBreakdownSchema = z.object({
  budgetId: z.string(),
  budgetName: z.string(),
  budgetAmount: z.number(),
  totalSpent: z.number(),
  percentUsed: z.number(),
  currency: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  byCategory: z.array(categorySpendingSchema),
  dailySpending: z.array(dailySpendingSchema),
});

export type BudgetSpendingBreakdown = z.infer<typeof budgetSpendingBreakdownSchema>;