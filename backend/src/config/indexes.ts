import { mongoDBService } from '../config/mongodb';
import { logger } from '../utils/logger';

/**
 * Database index setup for performance optimization
 * Run this on application startup or as a migration script
 */

export async function setupDatabaseIndexes(): Promise<void> {
  try {
    logger.info('Setting up database indexes...');

    // Transactions indexes
    const transactionsContainer = await mongoDBService.getTransactionsContainer();
    await Promise.all([
      // Primary query patterns
      transactionsContainer.createIndex({ userId: 1, date: -1 }),
      transactionsContainer.createIndex({ userId: 1, accountId: 1, date: -1 }),
      transactionsContainer.createIndex({ userId: 1, categoryId: 1, date: -1 }),
      transactionsContainer.createIndex({ userId: 1, reviewStatus: 1, date: -1 }),
      
      // Unique constraint
      transactionsContainer.createIndex({ id: 1, userId: 1 }, { unique: true }),
      
      // Full-text search (if needed)
      // transactionsContainer.createIndex({ description: 'text', merchant: 'text' }),
    ]);
    logger.info('✓ Transaction indexes created');

    // Splits indexes
    const splitsContainer = await mongoDBService.getTransactionSplitsContainer();
    await Promise.all([
      splitsContainer.createIndex({ transactionId: 1 }),
      splitsContainer.createIndex({ categoryId: 1 }),
      splitsContainer.createIndex({ userId: 1, categoryId: 1 }),
    ]);
    logger.info('✓ Splits indexes created');

    // Categories indexes
    const categoriesContainer = await mongoDBService.getCategoriesContainer();
    await Promise.all([
      categoriesContainer.createIndex({ userId: 1 }),
      categoriesContainer.createIndex({ userId: 1, parentId: 1 }),
      categoriesContainer.createIndex({ id: 1, userId: 1 }, { unique: true }),
    ]);
    logger.info('✓ Category indexes created');

    // Accounts indexes
    const accountsContainer = await mongoDBService.getAccountsContainer();
    await Promise.all([
      accountsContainer.createIndex({ userId: 1 }),
      accountsContainer.createIndex({ userId: 1, isDefault: 1 }),
      accountsContainer.createIndex({ id: 1, userId: 1 }, { unique: true }),
    ]);
    logger.info('✓ Account indexes created');

    // Budgets indexes
    const budgetsContainer = await mongoDBService.getBudgetsContainer();
    await Promise.all([
      budgetsContainer.createIndex({ userId: 1 }),
      budgetsContainer.createIndex({ userId: 1, startDate: 1, endDate: 1 }),
      budgetsContainer.createIndex({ id: 1, userId: 1 }, { unique: true }),
    ]);
    logger.info('✓ Budget indexes created');

    // Tags indexes
    const tagsContainer = await mongoDBService.getTagsContainer();
    await Promise.all([
      tagsContainer.createIndex({ userId: 1 }),
      tagsContainer.createIndex({ userId: 1, name: 1 }),
      tagsContainer.createIndex({ id: 1, userId: 1 }, { unique: true }),
    ]);
    logger.info('✓ Tag indexes created');

    // Users indexes
    const usersContainer = await mongoDBService.getUsersContainer();
    await Promise.all([
      usersContainer.createIndex({ email: 1 }, { unique: true }),
      usersContainer.createIndex({ id: 1 }, { unique: true }),
    ]);
    logger.info('✓ User indexes created');

    logger.info('✅ All database indexes created successfully');
  } catch (error) {
    logger.error({ error }, '❌ Failed to create database indexes');
    // Don't throw - indexes are optimization, not critical for startup
  }
}
