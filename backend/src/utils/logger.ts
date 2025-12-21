import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

// Create base logger
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  
  // Development: Pretty print with colors
  // Production: JSON format for log aggregation
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: false
    }
  } : undefined,

  // Base fields for all logs
  base: {
    env: process.env.NODE_ENV || 'development',
    service: 'digitransac-backend'
  },

  // Timestamp format
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,

  // Serialize errors properly
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res
  }
});

// Child logger for specific contexts
export const createContextLogger = (context: Record<string, any>) => {
  return logger.child(context);
};

// Helper functions for common log patterns
export const logError = (message: string, error: Error, context?: Record<string, any>) => {
  logger.error({ err: error, ...context }, message);
};

export const logInfo = (message: string, context?: Record<string, any>) => {
  logger.info(context, message);
};

export const logWarn = (message: string, context?: Record<string, any>) => {
  logger.warn(context, message);
};

export const logDebug = (message: string, context?: Record<string, any>) => {
  logger.debug(context, message);
};
