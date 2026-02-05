import { z } from 'zod';
import { emailSchema, passwordSchema, simplePasswordSchema, displayNameSchema, currencyCodeSchema } from './common';

// ============================================================================
// Authentication Validation Schemas
// ============================================================================

/**
 * Login request validation
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: simplePasswordSchema,
  rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Registration request validation
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  fullName: displayNameSchema,
  primaryCurrency: currencyCodeSchema.optional().default('USD'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Email verification request
 */
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/**
 * Request password reset
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * Reset password with token
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Change password (when already logged in)
 */
export const changePasswordSchema = z.object({
  currentPassword: simplePasswordSchema,
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Two-factor authentication code
 */
export const twoFactorCodeSchema = z.object({
  code: z.string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export type TwoFactorCodeInput = z.infer<typeof twoFactorCodeSchema>;

/**
 * Enable two-factor authentication
 */
export const enableTwoFactorSchema = z.object({
  code: z.string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export type EnableTwoFactorInput = z.infer<typeof enableTwoFactorSchema>;

/**
 * Update user profile
 */
export const updateProfileSchema = z.object({
  fullName: displayNameSchema.optional(),
  primaryCurrency: currencyCodeSchema.optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Auth response validation (for validating API responses)
 */
export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  isEmailVerified: z.boolean(),
  primaryCurrency: z.string(),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

/**
 * User response validation
 */
export const userSchema = z.object({
  email: z.string().email(),
  fullName: z.string(),
  isEmailVerified: z.boolean(),
  primaryCurrency: z.string(),
});

export type User = z.infer<typeof userSchema>;