import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { cosmosDBService } from './config/cosmosdb';
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
import { startEmailPollingJob } from './jobs/emailPolling.job';
import { startRecurringTransactionsJob } from './jobs/recurringTransactions.job';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
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
