import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { cosmosDBService } from './config/cosmosdb';
import { encryptionService } from './services/encryption.service';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import categoryRoutes from './routes/category.routes';
import budgetRoutes from './routes/budget.routes';
import analyticsRoutes from './routes/analytics.routes';
import emailRoutes from './routes/email.routes';
import gmailRoutes from './routes/gmail.routes';
import accountRoutes from './routes/account.routes';
import tagRoutes from './routes/tag.routes';
import transactionRoutes from './routes/transaction.routes';
import configRoutes from './routes/config.routes';
import { startEmailPollingJob } from './jobs/emailPolling.job';
import { startRecurringTransactionsJob } from './jobs/recurringTransactions.job';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());

// CORS configuration - support multiple origins
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint - Enhanced for production monitoring
app.get('/health', async (_req, res) => {
  try {
    // Check database connectivity
    const usersContainer = await cosmosDBService.getUsersContainer();
    await usersContainer.findOne({}, { projection: { _id: 1 } });
    
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: 'Database connection failed'
    });
  }
});

// Simple liveness probe (no DB check)
app.get('/ping', (_req, res) => {
  res.status(200).send('pong');
});

// API Routes
app.use('/api/config', configRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/transactions', transactionRoutes);

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
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`✅ Cosmos DB connected and ready`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
