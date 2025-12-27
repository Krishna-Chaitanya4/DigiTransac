import { MongoClient, Db, Collection } from 'mongodb';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { keyVaultService } from './keyVault';

dotenv.config();

class MongoDBService {
  private client: MongoClient;
  private db: Db | null = null;

  public usersContainer: Collection | null = null;
  public categoriesContainer: Collection | null = null;
  public budgetsContainer: Collection | null = null;
  public paymentMethodsContainer: Collection | null = null;
  public transactionsContainer: Collection | null = null;
  public accountsContainer: Collection | null = null;
  public tagsContainer: Collection | null = null;
  public transactionSplitsContainer: Collection | null = null;

  constructor() {
    // Connection will be initialized in initialize() method
    this.client = null as any;
  }

  async initialize() {
    try {
      // Get connection string from Key Vault
      const connectionString = await this.getConnectionString();
      const dbName =
        process.env.MONGODB_DATABASE_NAME || process.env.COSMOS_DATABASE_NAME || 'DigiTransacDB';

      // Initialize MongoDB client with secure options and connection pooling
      this.client = new MongoClient(connectionString, {
        tls: true,
        tlsAllowInvalidCertificates: false,
        retryWrites: true,
        w: 'majority',
        // Connection pool settings (industry standard)
        maxPoolSize: 50,
        minPoolSize: 10,
        maxIdleTimeMS: 30000,
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 5000,
        // Monitoring and reliability
        monitorCommands: false,
        compressors: ['zlib'],
      });

      await this.client.connect();
      this.db = this.client.db(dbName);

      logger.info(
        {
          env: process.env.NODE_ENV,
          service: 'digitransac-backend',
        },
        `📚 Database "${dbName}" connected`
      );

      await this.initializeCollections();
      logger.info(
        {
          env: process.env.NODE_ENV,
          service: 'digitransac-backend',
        },
        '✅ All MongoDB collections are ready'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to initialize MongoDB');
      throw error;
    }
  }

  private async getConnectionString(): Promise<string> {
    // Always fetch from Key Vault (both dev and prod)
    logger.info('🔐 Fetching MongoDB connection string from Key Vault');
    return await keyVaultService.getSecret('MongoDB-ConnectionString');
  }

  private async initializeCollections() {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    // Initialize all collections
    this.usersContainer = this.db.collection('users');
    this.categoriesContainer = this.db.collection('categories');
    this.budgetsContainer = this.db.collection('budgets');
    this.paymentMethodsContainer = this.db.collection('paymentMethods');
    this.transactionsContainer = this.db.collection('transactions');
    this.accountsContainer = this.db.collection('accounts');
    this.tagsContainer = this.db.collection('tags');
    this.transactionSplitsContainer = this.db.collection('transactionSplits');

    // Create indexes for better query performance
    await this.createIndexes();

    // Initialize merchant learning service
    const { initializeMerchantLearning } = await import('../services/merchantLearning.service');
    initializeMerchantLearning(this.db);
  }

  private async createIndexes(): Promise<void> {
    // Users collection indexes
    await this.usersContainer!.createIndex({ email: 1 }, { unique: true, sparse: true });
    await this.usersContainer!.createIndex({ phone: 1 }, { unique: true, sparse: true });
    await this.usersContainer!.createIndex({ username: 1 }, { unique: true });

    // Categories collection indexes
    await this.categoriesContainer!.createIndex({ userId: 1 });

    // Budgets collection indexes
    await this.budgetsContainer!.createIndex({ userId: 1 });

    // Payment Methods collection indexes
    await this.paymentMethodsContainer!.createIndex({ userId: 1 });

    // New indexes for transactions, accounts, and tags
    await this.transactionsContainer!.createIndex({ userId: 1 });
    await this.transactionsContainer!.createIndex({ accountId: 1 });
    await this.transactionsContainer!.createIndex({ date: 1 });
    await this.transactionsContainer!.createIndex({ type: 1 });
    // Compound indexes for userId + various sort fields (required for MongoDB)
    await this.transactionsContainer!.createIndex({ userId: 1, date: -1 });
    await this.transactionsContainer!.createIndex({ userId: 1, date: 1 });
    await this.transactionsContainer!.createIndex({ userId: 1, amount: -1 });
    await this.transactionsContainer!.createIndex({ userId: 1, amount: 1 });
    await this.transactionsContainer!.createIndex({ userId: 1, description: 1 });
    await this.transactionsContainer!.createIndex({ userId: 1, description: -1 });

    await this.accountsContainer!.createIndex({ userId: 1 });
    // Compound indexes for accounts sorting
    await this.accountsContainer!.createIndex({ userId: 1, isDefault: -1, createdAt: 1 });
    await this.accountsContainer!.createIndex({ userId: 1, createdAt: 1 });

    await this.tagsContainer!.createIndex({ userId: 1 });
    await this.tagsContainer!.createIndex({ name: 1 });
    // Compound indexes for tags sorting
    await this.tagsContainer!.createIndex({ userId: 1, usageCount: -1, name: 1 });
    await this.tagsContainer!.createIndex({ userId: 1, name: 1 });

    // Indexes for transaction splits
    await this.transactionSplitsContainer!.createIndex({ transactionId: 1 });
    await this.transactionSplitsContainer!.createIndex({ userId: 1 });
    await this.transactionSplitsContainer!.createIndex({ categoryId: 1 });
    await this.transactionSplitsContainer!.createIndex({ tags: 1 });

    logger.info('✅ All collection indexes created successfully');
  }

  async getUsersContainer(): Promise<Collection> {
    if (!this.usersContainer) {
      throw new Error('MongoDB not initialized. Call initialize() first.');
    }
    return this.usersContainer;
  }

  async getCategoriesContainer(): Promise<Collection> {
    if (!this.categoriesContainer) {
      throw new Error('MongoDB not initialized. Call initialize() first.');
    }
    return this.categoriesContainer;
  }

  async getBudgetsContainer(): Promise<Collection> {
    if (!this.budgetsContainer) {
      throw new Error('MongoDB not initialized. Call initialize() first.');
    }
    return this.budgetsContainer;
  }

  async getPaymentMethodsContainer(): Promise<Collection> {
    if (!this.paymentMethodsContainer) {
      throw new Error('MongoDB not initialized. Call initialize() first.');
    }
    return this.paymentMethodsContainer;
  }

  async getTransactionsContainer(): Promise<Collection> {
    if (!this.transactionsContainer) {
      throw new Error('MongoDB not initialized. Call initialize() first.');
    }
    return this.transactionsContainer;
  }

  async getAccountsContainer(): Promise<Collection> {
    if (!this.accountsContainer) {
      throw new Error('MongoDB not initialized. Call initialize() first.');
    }
    return this.accountsContainer;
  }

  async getTagsContainer(): Promise<Collection> {
    if (!this.tagsContainer) {
      throw new Error('MongoDB not initialized. Call initialize() first.');
    }
    return this.tagsContainer;
  }

  async getTransactionSplitsContainer(): Promise<Collection> {
    if (!this.transactionSplitsContainer) {
      throw new Error('MongoDB not initialized. Call initialize() first.');
    }
    return this.transactionSplitsContainer;
  }

  async close(): Promise<void> {
    await this.client.close();
    logger.info('✅ MongoDB connection closed');
  }
}

export const mongoDBService = new MongoDBService();
