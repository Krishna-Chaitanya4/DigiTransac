import { Filter, FindOptions, Document } from 'mongodb';
import { logger } from './logger';

/**
 * Centralized database helper utilities
 * Eliminates duplicate query patterns and provides consistent error handling
 */

export class DbHelper {
  /**
   * Find a single document by ID and userId (common pattern)
   */
  static async findByIdAndUser<T extends Document>(
    container: any,
    id: string,
    userId: string
  ): Promise<T | null> {
    try {
      const result = await container.findOne({ id, userId });
      return result as T | null;
    } catch (error) {
      logger.error({ error, id, userId }, 'Error finding document by ID and user');
      throw error;
    }
  }

  /**
   * Find all documents for a user with optional filter
   */
  static async findAllByUser<T extends Document>(
    container: any,
    userId: string,
    additionalFilter: Filter<any> = {},
    options: FindOptions = {}
  ): Promise<T[]> {
    try {
      const filter = { userId, ...additionalFilter };
      const results = await container.find(filter, options).toArray();
      return results as T[];
    } catch (error) {
      logger.error({ error, userId }, 'Error finding documents by user');
      throw error;
    }
  }

  /**
   * Check if document exists
   */
  static async exists(container: any, filter: Filter<any>): Promise<boolean> {
    try {
      const count = await container.countDocuments(filter, { limit: 1 });
      return count > 0;
    } catch (error) {
      logger.error({ error, filter }, 'Error checking document existence');
      throw error;
    }
  }

  /**
   * Create document with auto-generated ID and timestamps
   */
  static async createDocument<T extends Document>(
    container: any,
    document: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
    idPrefix: string = 'doc'
  ): Promise<T> {
    try {
      const newDocument = {
        ...document,
        id: `${idPrefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as T;

      await container.insertOne(newDocument);
      return newDocument;
    } catch (error) {
      logger.error({ error }, 'Error creating document');
      throw error;
    }
  }

  /**
   * Update document by ID and userId
   */
  static async updateByIdAndUser(
    container: any,
    id: string,
    userId: string,
    update: any
  ): Promise<boolean> {
    try {
      const result = await container.updateOne(
        { id, userId },
        { 
          $set: { 
            ...update, 
            updatedAt: new Date() 
          } 
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error({ error, id, userId }, 'Error updating document');
      throw error;
    }
  }

  /**
   * Delete document by ID and userId
   */
  static async deleteByIdAndUser(
    container: any,
    id: string,
    userId: string
  ): Promise<boolean> {
    try {
      const result = await container.deleteOne({ id, userId });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error({ error, id, userId }, 'Error deleting document');
      throw error;
    }
  }

  /**
   * Paginate query results
   */
  static async paginate<T extends Document>(
    container: any,
    filter: Filter<any>,
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ data: T[]; total: number; page: number; limit: number; totalPages: number }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;
      const sortField = options.sortBy || 'createdAt';
      const sortDirection = options.sortOrder === 'asc' ? 1 : -1;

      const [data, total] = await Promise.all([
        container
          .find(filter)
          .sort({ [sortField]: sortDirection })
          .skip(skip)
          .limit(limit)
          .toArray(),
        container.countDocuments(filter),
      ]);

      return {
        data: data as T[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error({ error, filter }, 'Error paginating documents');
      throw error;
    }
  }

  /**
   * Bulk operations helper
   */
  static async bulkUpdate(
    container: any,
    operations: Array<{ filter: Filter<any>; update: any }>
  ): Promise<number> {
    try {
      const bulkOps = operations.map((op) => ({
        updateOne: {
          filter: op.filter,
          update: { $set: { ...op.update, updatedAt: new Date() } },
        },
      }));

      const result = await container.bulkWrite(bulkOps);
      return result.modifiedCount;
    } catch (error) {
      logger.error({ error }, 'Error performing bulk update');
      throw error;
    }
  }
}
