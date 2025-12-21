import { MongoClient, Db, Collection } from 'mongodb';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

class CosmosDBService {
  private client: MongoClient;
  private db: Db | null = null;
  
  public usersContainer: Collection | null = null;
  public categoriesContainer: Collection | null = null;
  public expensesContainer: Collection | null = null;
  public budgetsContainer: Collection | null = null;
  public paymentMethodsContainer: Collection | null = null;
  public transactionsContainer: Collection | null = null;
  public accountsContainer: Collection | null = null;
  public tagsContainer: Collection | null = null;
  public transactionSplitsContainer: Collection | null = null;

  constructor() {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    const dbName = process.env.COSMOS_DATABASE_NAME || 'DigiTransacDB';
    
    if (!endpoint) {
      throw new Error('COSMOS_ENDPOINT environment variable is required');
    }
    
    let connectionString: string;
    
    // Check if using Cosmos DB Emulator (localhost)
    if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
      // Cosmos DB Emulator with MongoDB API
      // Format: mongodb://localhost:<key>@localhost:10255/?ssl=true
      const emulatorKey = key || 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEclP9qNdxzYg==';
      connectionString = `mongodb://localhost:${encodeURIComponent(emulatorKey)}@localhost:10255/?ssl=true&retrywrites=false`;
      logger.info('🔧 Using Cosmos DB Emulator');
      logger.info(`📁 Database: ${dbName}`);
    } else {
      // Azure Cosmos DB connection string
      if (!key) {
        throw new Error('COSMOS_KEY environment variable is required for Azure Cosmos DB');
      }
      
      // Extract account name from endpoint
      const accountName = endpoint.match(/https:\/\/([^.]+)/)?.[1] || '';
      connectionString = `mongodb://${accountName}:${encodeURIComponent(key)}@${accountName}.mongo.cosmos.azure.com:10255/${dbName}?ssl=true&retrywrites=false&maxIdleTimeMS=120000&appName=@${accountName}@`;
      logger.info('🌍 Using Azure Cosmos DB');
    }
    
    this.client = new MongoClient(connectionString, {
      tlsAllowInvalidCertificates: endpoint.includes('localhost'), // Allow self-signed certs for emulator
      serverSelectionTimeoutMS: 5000, // Fail fast if emulator not running
    });
  }

  async initialize(): Promise<void> {
    try {
      const databaseName = process.env.COSMOS_DATABASE_NAME || 'DigiTransacDB';
      
      // Connect to Cosmos DB via MongoDB API
      await this.client.connect();
      this.db = this.client.db(databaseName);
      logger.info(`✅ Database "${databaseName}" connected`);

      // Initialize collections
      await this.createCollections();
      
      logger.info('✅ All Cosmos DB collections are ready');
    } catch (error) {
      logger.error({ error }, '❌ Error initializing Cosmos DB');
      throw error;
    }
  }

  private async createCollections(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Users collection
    this.usersContainer = this.db.collection('users');
    
    // Categories collection
    this.categoriesContainer = this.db.collection('categories');
    
    // Expenses collection
    this.expensesContainer = this.db.collection('expenses');
    
    // Budgets collection
    this.budgetsContainer = this.db.collection('budgets');
    
    // Payment Methods collection
    this.paymentMethodsContainer = this.db.collection('paymentMethods');
    
    // Transactions collection (new)
    this.transactionsContainer = this.db.collection('transactions');
    
    // Accounts collection (new)
    this.accountsContainer = this.db.collection('accounts');
    
    // Tags collection (new)
    this.tagsContainer = this.db.collection('tags');
    
    // Transaction Splits collection (new)
    this.transactionSplitsContainer = this.db.collection('transactionSplits');

    // Create indexes for better query performance
    await this.usersContainer.createIndex({ email: 1 }, { unique: true });
    await this.categoriesContainer.createIndex({ userId: 1 });
    await this.expensesContainer.createIndex({ userId: 1 });
    await this.expensesContainer.createIndex({ categoryId: 1 });
    await this.expensesContainer.createIndex({ paymentMethodId: 1 });
    await this.budgetsContainer.createIndex({ userId: 1 });
    await this.paymentMethodsContainer.createIndex({ userId: 1 });
    
    // New indexes for transactions, accounts, and tags
    await this.transactionsContainer.createIndex({ userId: 1 });
    await this.transactionsContainer.createIndex({ accountId: 1 });
    await this.transactionsContainer.createIndex({ date: 1 });
    await this.transactionsContainer.createIndex({ type: 1 });
    // Compound index for userId + date sorting (required for Cosmos DB)
    await this.transactionsContainer.createIndex({ userId: 1, date: -1 });
    await this.accountsContainer.createIndex({ userId: 1 });
    await this.tagsContainer.createIndex({ userId: 1 });
    await this.tagsContainer.createIndex({ name: 1 });
    
    // Indexes for transaction splits
    await this.transactionSplitsContainer.createIndex({ transactionId: 1 });
    await this.transactionSplitsContainer.createIndex({ userId: 1 });
    await this.transactionSplitsContainer.createIndex({ categoryId: 1 });
    await this.transactionSplitsContainer.createIndex({ tags: 1 });
  }

  async getUsersContainer(): Promise<Collection> {
    if (!this.usersContainer) {
      throw new Error('Cosmos DB not initialized. Call initialize() first.');
    }
    return this.usersContainer;
  }

  async getCategoriesContainer(): Promise<Collection> {
    if (!this.categoriesContainer) {
      throw new Error('Cosmos DB not initialized. Call initialize() first.');
    }
    return this.categoriesContainer;
  }

  async getExpensesContainer(): Promise<Collection> {
    if (!this.expensesContainer) {
      throw new Error('Cosmos DB not initialized. Call initialize() first.');
    }
    return this.expensesContainer;
  }

  async getBudgetsContainer(): Promise<Collection> {
    if (!this.budgetsContainer) {
      throw new Error('Cosmos DB not initialized. Call initialize() first.');
    }
    return this.budgetsContainer;
  }

  async getPaymentMethodsContainer(): Promise<Collection> {
    if (!this.paymentMethodsContainer) {
      throw new Error('Cosmos DB not initialized. Call initialize() first.');
    }
    return this.paymentMethodsContainer;
  }

  async getTransactionsContainer(): Promise<Collection> {
    if (!this.transactionsContainer) {
      throw new Error('Cosmos DB not initialized. Call initialize() first.');
    }
    return this.transactionsContainer;
  }

  async getAccountsContainer(): Promise<Collection> {
    if (!this.accountsContainer) {
      throw new Error('Cosmos DB not initialized. Call initialize() first.');
    }
    return this.accountsContainer;
  }

  async getTagsContainer(): Promise<Collection> {
    if (!this.tagsContainer) {
      throw new Error('Cosmos DB not initialized. Call initialize() first.');
    }
    return this.tagsContainer;
  }

  async getTransactionSplitsContainer(): Promise<Collection> {
    if (!this.transactionSplitsContainer) {
      throw new Error('Cosmos DB not initialized. Call initialize() first.');
    }
    return this.transactionSplitsContainer;
  }

  async close(): Promise<void> {
    await this.client.close();
    logger.info('✅ Cosmos DB connection closed');
  }
}

export const cosmosDBService = new CosmosDBService();
