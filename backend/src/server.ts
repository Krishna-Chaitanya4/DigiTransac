import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { requestIdMiddleware } from './middleware/requestId';
import { httpLogger } from './middleware/httpLogger';
import { globalLimiter } from './middleware/rateLimiter';
import { validateConfig } from './utils/configValidator';
import { validateEnv } from './utils/envValidator';
import { setupSwagger } from './config/swagger';
import { cosmosDBService } from './config/cosmosdb';
import { encryptionService } from './services/encryption.service';
import configRoutes from './routes/config.routes';
import v1Routes from './routes/v1';
import { startEmailPollingJob } from './jobs/emailPolling.job';
import { startRecurringTransactionsJob } from './jobs/recurringTransactions.job';

// Load environment variables
dotenv.config();

// Validate environment variables
validateEnv();

const app: Application = express();
const PORT = Number(process.env.PORT) || 5000;

// Validate configuration on startup
validateConfig();

// Trust proxy - required for rate limiting and secure headers behind reverse proxy
app.set('trust proxy', 1);

// Middleware
app.use(helmet());

// CORS configuration - support multiple origins
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:3000'];

logger.info({ allowedOrigins }, '🔒 CORS configuration loaded');

app.use(
  cors({
    origin: (origin, callback) => {
      logger.debug({ origin }, '📡 CORS request received');
      
      // In production, reject requests without origin
      if (!origin && process.env.NODE_ENV === 'production') {
        logger.warn('CORS request rejected - no origin in production');
        return callback(new Error('Not allowed by CORS'));
      }
      // Allow requests with no origin in development (like mobile apps or curl)
      if (!origin) {
        logger.debug('No origin - allowing (development mode)');
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        logger.debug({ origin }, 'Origin allowed');
        callback(null, true);
      } else {
        logger.warn({ origin }, 'Origin blocked by CORS policy');
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  })
);

app.use(compression());
app.use(requestIdMiddleware as express.RequestHandler);
app.use(httpLogger as express.RequestHandler);

// Log all OPTIONS requests for debugging
app.options('*', (req, res) => {
  logger.debug({
    url: req.url,
    origin: req.headers.origin,
    method: req.method,
  }, '🔍 OPTIONS preflight request received');
  res.status(204).end();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize());
app.use(globalLimiter);

// Liveness probe - instant response
app.get('/ping', (_req, res) => {
  res.json({ status: 'alive' });
});

// Readiness probe - checks if DB is initialized
app.get('/health', async (_req, res) => {
  const healthCheckTimeout = setTimeout(() => {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'timeout',
      error: 'Health check timeout',
    });
  }, 5000); // 5 second timeout

  try {
    // Simple check: just verify DB service is initialized
    const isInitialized = cosmosDBService.usersContainer !== null;

    clearTimeout(healthCheckTimeout);
    res.status(isInitialized ? 200 : 503).json({
      status: isInitialized ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: isInitialized ? 'initialized' : 'not initialized',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    clearTimeout(healthCheckTimeout);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'error',
      error: 'Health check failed',
    });
  }
});

// API Documentation
setupSwagger(app);

// API Routes
// Config route (unversioned for now)
app.use('/api/config', configRoutes);

// v1 API Routes
app.use('/api/v1', v1Routes);

// Legacy routes (backward compatibility) - redirect to v1
app.use('/api/auth', (req, res) => res.redirect(308, `/api/v1/auth${req.url}`));
app.use('/api/users', (req, res) => res.redirect(308, `/api/v1/users${req.url}`));
app.use('/api/categories', (req, res) => res.redirect(308, `/api/v1/categories${req.url}`));
app.use('/api/budgets', (req, res) => res.redirect(308, `/api/v1/budgets${req.url}`));
app.use('/api/analytics', (req, res) => res.redirect(308, `/api/v1/analytics${req.url}`));
app.use('/api/email', (req, res) => res.redirect(308, `/api/v1/email${req.url}`));
app.use('/api/gmail', (req, res) => res.redirect(308, `/api/v1/gmail${req.url}`));
app.use('/api/accounts', (req, res) => res.redirect(308, `/api/v1/accounts${req.url}`));
app.use('/api/tags', (req, res) => res.redirect(308, `/api/v1/tags${req.url}`));
app.use('/api/transactions', (req, res) => res.redirect(308, `/api/v1/transactions${req.url}`));
app.use('/api/sms', (req, res) => res.redirect(308, `/api/v1/sms${req.url}`));

// Error handling
app.use(errorHandler);

// Initialize Cosmos DB and start server
const startServer = async () => {
  try {
    // Initialize Cosmos DB connection
    await cosmosDBService.initialize();

    // Initialize encryption service
    await encryptionService.initialize();

    // Start email polling cron job
    startEmailPollingJob();

    // Start recurring transactions cron job
    startRecurringTransactionsJob();

    // Start server - listen on all network interfaces for mobile testing
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server is running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`✅ Cosmos DB connected and ready`);
      logger.info(`📱 Network: http://192.168.0.11:${PORT}`);
    });
  } catch (error) {
    logger.error({ error }, '❌ Failed to start server');
    process.exit(1);
  }
};

startServer();

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} signal received: closing HTTP server`);
  
  try {
    // Close database connection
    await cosmosDBService.close();
    
    logger.info('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, '❌ Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
