/**
 * Zod validation schemas for DigiTransac
 * 
 * These schemas provide runtime type validation for:
 * - API request payloads (before sending to backend)
 * - API response data (after receiving from backend)
 * - Form data validation
 * - Environment variables
 * 
 * Usage:
 *   import { createTransactionSchema, type CreateTransactionInput } from '@/lib/validations';
 *   
 *   // Validate form data
 *   const result = createTransactionSchema.safeParse(formData);
 *   if (!result.success) {
 *     console.error(result.error.flatten());
 *   }
 */

// Re-export all schemas
export * from './auth';
export * from './transactions';
export * from './budgets';
export * from './accounts';
export * from './common';