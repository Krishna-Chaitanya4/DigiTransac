import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

// Global rate limiter - applies to all requests
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs (reasonable for normal use)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers

  // Skip health check and ping endpoints
  skip: (req: Request) => {
    return req.path === '/health' || req.path === '/ping';
  },

  // Custom handler for rate limit exceeded
  handler: (req: Request, res: Response) => {
    logger.warn(
      {
        ip: req.ip,
        url: req.url,
        method: req.method,
      },
      'Rate limit exceeded'
    );

    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: res.getHeader('Retry-After'),
    });
  },

  // Skip successful requests in count (optional - only count failed requests)
  skipSuccessfulRequests: false,

  // Skip failed requests in count
  skipFailedRequests: false,
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs (prevents brute force)
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req: Request, res: Response) => {
    logger.warn(
      {
        ip: req.ip,
        url: req.url,
        method: req.method,
      },
      'Auth rate limit exceeded - potential brute force attack'
    );

    res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please try again after 15 minutes.',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});

// API rate limiter - more generous for authenticated API calls
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each user to 500 API requests per windowMs
  message: 'API rate limit exceeded.',
  standardHeaders: true,
  legacyHeaders: false,

  // Don't use custom keyGenerator - let express-rate-limit handle IP properly
  // It will use userId from skip function if we need user-based limiting
  skip: (req: Request) => {
    // Never skip, but this allows us to track authenticated users differently
    const userId = (req as Request & { userId?: string }).userId;
    if (userId) {
      // For authenticated users, we could implement separate limits
      // For now, use the same IP-based limit
    }
    return false;
  },

  handler: (req: Request, res: Response) => {
    const userId = (req as Request & { userId?: string }).userId;
    logger.warn(
      {
        userId: userId || 'anonymous',
        ip: req.ip,
        url: req.url,
        method: req.method,
      },
      'API rate limit exceeded'
    );

    res.status(429).json({
      success: false,
      error: 'API rate limit exceeded. Please slow down your requests.',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});

// OAuth rate limiter - prevent OAuth abuse
export const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 OAuth attempts per windowMs
  message: 'Too many OAuth attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req: Request, res: Response) => {
    logger.warn(
      {
        ip: req.ip,
        url: req.url,
        method: req.method,
      },
      'OAuth rate limit exceeded - potential abuse'
    );

    res.status(429).json({
      success: false,
      error: 'Too many OAuth connection attempts. Please try again after 15 minutes.',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});
