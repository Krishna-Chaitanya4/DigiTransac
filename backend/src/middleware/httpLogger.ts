import pinoHttp from 'pino-http';
import { logger } from '../utils/logger';
import { RequestWithId } from './requestId';

/**
 * HTTP request/response logger middleware
 * Logs all HTTP requests with timing, status, and metadata
 */
export const httpLogger = pinoHttp({
  logger,

  // Custom request ID field
  genReqId: (req: RequestWithId) => req.id || '',

  // Custom log message
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    if (res.statusCode >= 300) return 'info';
    return 'info';
  },

  // Custom success message
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },

  // Custom error message
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} - ${res.statusCode} - ${err.message}`;
  },

  // Additional request context
  customAttributeKeys: {
    req: 'request',
    res: 'response',
    err: 'error',
    responseTime: 'responseTime',
  },

  // Serialize request/response
  serializers: {
    req: (req) => ({
      id: (req as RequestWithId).id,
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      // Don't log body in production for security
      body: process.env.NODE_ENV === 'development' ? req.body : undefined,
      headers: {
        host: req.headers.host,
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers:
        typeof res.getHeader === 'function'
          ? {
              'content-type': res.getHeader('content-type'),
              'content-length': res.getHeader('content-length'),
            }
          : {},
    }),
  },

  // Don't log health check endpoints
  autoLogging: {
    ignore: (req) => {
      return req.url === '/health' || req.url === '/ping';
    },
  },
});
