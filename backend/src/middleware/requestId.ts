import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestWithId extends Request {
  id: string;
}

/**
 * Middleware to generate and attach a unique request ID to each request
 * This ID can be used for tracing requests across logs and services
 */
export const requestIdMiddleware = (
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void => {
  // Use existing X-Request-ID from client, or generate new one
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  
  // Attach to request object
  req.id = requestId;
  
  // Send back in response headers for client-side tracing
  res.setHeader('X-Request-ID', requestId);
  
  next();
};
