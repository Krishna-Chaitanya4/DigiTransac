import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Validation middleware factory
 * Creates Express middleware that validates request body, query, or params against a Joi schema
 */
export const validate = (
  schema: Joi.ObjectSchema,
  property: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Return all errors, not just the first one
      stripUnknown: true, // Remove unknown keys from the validated data
      errors: {
        wrap: {
          label: '', // Don't wrap field names in quotes
        },
      },
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      logger.warn(
        {
          url: req.url,
          method: req.method,
          property,
          errors,
        },
        'Request validation failed'
      );

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    // Replace request property with validated value (with defaults applied)
    req[property] = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  // Transaction validation
  createTransaction: Joi.object({
    type: Joi.string().valid('income', 'expense').required(),
    amount: Joi.number().positive().required(),
    accountId: Joi.string().required(),
    description: Joi.string().max(500).allow('').optional(),
    date: Joi.date().iso().optional(),
    splits: Joi.array()
      .items(
        Joi.object({
          categoryId: Joi.string().required(),
          amount: Joi.number().positive().required(),
          description: Joi.string().max(500).allow('').optional(),
          tags: Joi.array().items(Joi.string()).optional(),
        })
      )
      .min(1)
      .required(),
    notes: Joi.string().max(1000).allow('').optional(),
    source: Joi.string().valid('manual', 'email', 'sms', 'import').optional(),
    reviewStatus: Joi.string().valid('pending', 'approved', 'rejected').optional(),
  }),

  updateTransaction: Joi.object({
    type: Joi.string().valid('income', 'expense').optional(),
    amount: Joi.number().positive().optional(),
    accountId: Joi.string().optional(),
    description: Joi.string().max(500).allow('').optional(),
    date: Joi.date().iso().optional(),
    splits: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().optional(),
          categoryId: Joi.string().required(),
          amount: Joi.number().positive().required(),
          description: Joi.string().max(500).allow('').optional(),
          tags: Joi.array().items(Joi.string()).optional(),
        })
      )
      .min(1)
      .optional(),
    notes: Joi.string().max(1000).allow('').optional(),
    reviewStatus: Joi.string().valid('pending', 'approved', 'rejected').optional(),
  }),

  // User registration
  register: Joi.object({
    email: Joi.string().email().optional(),
    phone: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/) // E.164 format
      .optional(),
    username: Joi.string()
      .min(3)
      .max(30)
      .pattern(/^[a-z0-9._]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Username can only contain lowercase letters, numbers, dots and underscores',
      }),
    password: Joi.string().min(8).required(),
    fullName: Joi.string().min(1).max(100).required(),
    dateOfBirth: Joi.date().iso().max('now').optional(),
    currency: Joi.string().length(3).uppercase().required(),
  }).or('email', 'phone'), // At least one of email or phone must be provided

  // User login
  login: Joi.object({
    identifier: Joi.string().required(), // Can be email, phone, or username
    password: Joi.string().required(),
  }),

  // Category
  createCategory: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    type: Joi.string().valid('income', 'expense').required(),
    icon: Joi.string().max(50).optional(),
    color: Joi.string()
      .pattern(/^#[0-9A-F]{6}$/i)
      .optional(),
  }),

  // Budget
  createBudget: Joi.object({
    // Budget name (optional)
    name: Joi.string().max(100).allow('').optional(),

    // Multi-select filters (at least one required)
    categoryIds: Joi.array().items(Joi.string()).min(1).optional(),
    includeTagIds: Joi.array().items(Joi.string()).min(1).optional(),
    excludeTagIds: Joi.array().items(Joi.string()).min(1).optional(),
    accountIds: Joi.array().items(Joi.string()).min(1).optional(),

    // Calculation type
    calculationType: Joi.string().valid('debit', 'net').required(),

    // Core budget fields
    amount: Joi.number().positive().required(),
    period: Joi.string().valid('this-month', 'next-month', 'this-year', 'custom').required(),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),

    // Alert configuration
    alertThreshold: Joi.number().min(0).max(100).default(80),
    alertThresholds: Joi.array().items(Joi.number().min(0).max(100)).optional(),
    notificationChannels: Joi.array().items(Joi.string().valid('in-app', 'email')).optional(),

    // Rollover configuration
    enableRollover: Joi.boolean().optional().default(false),
    rolloverLimit: Joi.number().positive().optional(),
  }),

  // Account
  createAccount: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    type: Joi.string().valid('bank', 'credit_card', 'cash', 'investment', 'other').required(),
    balance: Joi.number().required(),
    currency: Joi.string().length(3).uppercase().required(),
    isDefault: Joi.boolean().optional(),
  }),

  // Query pagination
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional(),
    skip: Joi.number().integer().min(0).optional(),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional(),
  }),
};
