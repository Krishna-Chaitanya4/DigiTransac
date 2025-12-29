import { Response } from 'express';
import { logger } from './logger';

/**
 * Standardized API response utility
 * Eliminates duplicate response patterns across routes
 */

export interface ApiSuccessResponse<T = any> {
  success: true;
  data?: T;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    [key: string]: any;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: any;
  requestId?: string;
  stack?: string;
}

export class ApiResponse {
  /**
   * Send success response with data
   */
  static success<T>(
    res: Response,
    data?: T,
    message?: string,
    statusCode: number = 200,
    meta?: any
  ): void {
    const response: ApiSuccessResponse<T> = {
      success: true,
      ...(data !== undefined && { data }),
      ...(message && { message }),
      ...(meta && { meta }),
    };

    res.status(statusCode).json(response);
  }

  /**
   * Send created response (201)
   */
  static created<T>(res: Response, data: T, message: string = 'Resource created successfully'): void {
    this.success(res, data, message, 201);
  }

  /**
   * Send no content response (204)
   */
  static noContent(res: Response): void {
    res.status(204).send();
  }

  /**
   * Send error response
   */
  static error(
    res: Response,
    message: string,
    statusCode: number = 500,
    details?: any,
    req?: any
  ): void {
    const response: ApiErrorResponse = {
      success: false,
      error: message,
      ...(details && { details }),
      ...(req?.id && { requestId: req.id }),
      ...(process.env.NODE_ENV === 'development' && details?.stack && { stack: details.stack }),
    };

    // Log error for monitoring
    if (statusCode >= 500) {
      logger.error(
        {
          error: details,
          statusCode,
          requestId: req?.id,
          url: req?.url,
          method: req?.method,
          userId: req?.userId,
        },
        message
      );
    } else if (statusCode >= 400) {
      logger.warn(
        {
          statusCode,
          requestId: req?.id,
          url: req?.url,
          method: req?.method,
          userId: req?.userId,
        },
        message
      );
    }

    res.status(statusCode).json(response);
  }

  /**
   * Common error responses
   */
  static badRequest(res: Response, message: string = 'Bad request', details?: any, req?: any): void {
    this.error(res, message, 400, details, req);
  }

  static unauthorized(res: Response, message: string = 'Unauthorized', req?: any): void {
    this.error(res, message, 401, undefined, req);
  }

  static forbidden(res: Response, message: string = 'Forbidden', req?: any): void {
    this.error(res, message, 403, undefined, req);
  }

  static notFound(res: Response, message: string = 'Resource not found', req?: any): void {
    this.error(res, message, 404, undefined, req);
  }

  static conflict(res: Response, message: string = 'Resource conflict', details?: any, req?: any): void {
    this.error(res, message, 409, details, req);
  }

  static tooManyRequests(res: Response, message: string = 'Too many requests', req?: any): void {
    this.error(res, message, 429, undefined, req);
  }

  static internalError(res: Response, error: any, req?: any): void {
    this.error(res, 'Internal server error', 500, error, req);
  }

  static serviceUnavailable(res: Response, message: string = 'Service unavailable', req?: any): void {
    this.error(res, message, 503, undefined, req);
  }
}
