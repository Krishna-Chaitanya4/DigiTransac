import { CosmosClient, Database, Container } from '@azure/cosmos';
import dotenv from 'dotenv';

dotenv.config();

class CosmosDBService {
  private client: CosmosClient;
  private database: Database | null = null;
  
  public usersContainer: Container | null = null;
  public categoriesContainer: Container | null = null;
  public expensesContainer: Container | null = null;
  public budgetsContainer: Container | null = null;

  constructor() {
    const endpoint = process.env.COSMOS_ENDPOINT!;
    const key = process.env.COSMOS_KEY!;
    
    this.client = new CosmosClient({ endpoint, key });
  }

  async initialize(): Promise<void> {
    try {
      const databaseName = process.env.COSMOS_DATABASE_NAME || 'ExpenseTrackerDB';
      
      // Create database if it doesn't exist
      const { database } = await this.client.databases.createIfNotExists({ id: databaseName });
      this.database = database;
      console.log(`✅ Database "${databaseName}" is ready`);

      // Create containers
      await this.createContainers();
      
      console.log('✅ All Cosmos DB containers are ready');
    } catch (error) {
      console.error('❌ Error initializing Cosmos DB:', error);
      throw error;
    }
  }

  private async createContainers(): Promise<void> {
    if (!this.database) throw new Error('Database not initialized');

    // Users container
    const { container: usersContainer } = await this.database.containers.createIfNotExists({
      id: 'users',
      partitionKey: { paths: ['/id'] }
    });
    this.usersContainer = usersContainer;

    // Categories container (hierarchical structure)
    const { container: categoriesContainer } = await this.database.containers.createIfNotExists({
      id: 'categories',
      partitionKey: { paths: ['/userId'] }
    });
    this.categoriesContainer = categoriesContainer;

    // Expenses container
    const { container: expensesContainer } = await this.database.containers.createIfNotExists({
      id: 'expenses',
      partitionKey: { paths: ['/userId'] }
    });
    this.expensesContainer = expensesContainer;

    // Budgets container
    const { container: budgetsContainer } = await this.database.containers.createIfNotExists({
      id: 'budgets',
      partitionKey: { paths: ['/userId'] }
    });
    this.budgetsContainer = budgetsContainer;
  }
}

export const cosmosDBService = new CosmosDBService();
