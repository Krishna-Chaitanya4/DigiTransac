import { MongoClient, Db, Collection } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

class CosmosDBService {
  private client: MongoClient;
  private db: Db | null = null;
  
  public usersContainer: Collection | null = null;
  public categoriesContainer: Collection | null = null;
  public expensesContainer: Collection | null = null;
  public budgetsContainer: Collection | null = null;
  public paymentMethodsContainer: Collection | null = null;

  constructor() {
    // Build MongoDB connection string from Cosmos DB credentials
    const endpoint = process.env.COSMOS_ENDPOINT!;
    const key = process.env.COSMOS_KEY!;
    const dbName = process.env.COSMOS_DATABASE_NAME || 'ExpenseTrackerDB';
    
    // Extract account name from endpoint
    const accountName = endpoint.match(/https:\/\/([^.]+)/)?.[1] || '';
    
    const connectionString = `mongodb://${accountName}:${encodeURIComponent(key)}@${accountName}.mongo.cosmos.azure.com:10255/${dbName}?ssl=true&retrywrites=false&maxIdleTimeMS=120000&appName=@${accountName}@`;
    
    this.client = new MongoClient(connectionString);
  }

  async initialize(): Promise<void> {
    try {
      const databaseName = process.env.COSMOS_DATABASE_NAME || 'ExpenseTrackerDB';
      
      // Connect to Cosmos DB via MongoDB API
      await this.client.connect();
      this.db = this.client.db(databaseName);
      console.log(`✅ Database "${databaseName}" connected`);

      // Initialize collections
      await this.createCollections();
      
      console.log('✅ All Cosmos DB collections are ready');
    } catch (error) {
      console.error('❌ Error initializing Cosmos DB:', error);
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

    // Create indexes for better query performance
    await this.usersContainer.createIndex({ email: 1 }, { unique: true });
    await this.categoriesContainer.createIndex({ userId: 1 });
    await this.expensesContainer.createIndex({ userId: 1 });
    await this.expensesContainer.createIndex({ categoryId: 1 });
    await this.expensesContainer.createIndex({ paymentMethodId: 1 });
    await this.budgetsContainer.createIndex({ userId: 1 });
    await this.paymentMethodsContainer.createIndex({ userId: 1 });
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

  async close(): Promise<void> {
    await this.client.close();
    console.log('✅ Cosmos DB connection closed');
  }
}

export const cosmosDBService = new CosmosDBService();
