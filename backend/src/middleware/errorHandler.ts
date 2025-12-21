import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (err: ApiError, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestWithId = req as any;

  // Log error with full context
  logger.error(
    {
      error: {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        statusCode,
      },
      request: {
        id: requestWithId.id,
        method: req.method,
        url: req.url,
        userId: requestWithId.userId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
    },
    'Error occurred'
  );

  res.status(statusCode).json({
    success: false,
    error: message,
    requestId: requestWithId.id,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export class AppError extends Error implements ApiError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
