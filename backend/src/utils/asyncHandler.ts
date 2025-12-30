import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ApiResponse } from './apiResponse';

/**
 * Async route handler wrapper
 * Eliminates repetitive try-catch blocks in all routes
 * Automatically catches and handles errors
 */

type AsyncRouteHandler = (
  req: Request | AuthRequest,
  res: Response,
  next: NextFunction
) => Promise<void> | Promise<any>;

/**
 * Wraps async route handlers to catch errors automatically
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (fn: AsyncRouteHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Pass to error handler middleware
      next(error);
    });
  };
};

/**
 * Wraps async route handlers with automatic error response
 * No need for try-catch in routes - errors are automatically handled
 */
export const catchAsync = (fn: AsyncRouteHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Send error response directly instead of passing to middleware
      ApiResponse.internalError(res, error, req);
    });
  };
};

/**
 * Wraps async route handlers with custom error handling
 * Note: Use asyncHandler or catchAsync instead - they provide better error handling
 * This is kept for backward compatibility
 */
export const asyncErrorHandler = (fn: AsyncRouteHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      ApiResponse.internalError(res, error, req);
    });
  };
};
