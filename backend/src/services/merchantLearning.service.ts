import { Collection, Db } from 'mongodb';
import { MerchantLearning } from '../models/types';
import { logger } from '../utils/logger';

let db: Db;
let merchantLearningCollection: Collection<MerchantLearning>;

export function initializeMerchantLearning(database: Db): void {
  db = database;
  merchantLearningCollection = db.collection<MerchantLearning>('merchant_learning');

  // Create indexes for fast lookups
  merchantLearningCollection.createIndex({ userId: 1, merchantName: 1 }, { unique: true });
  merchantLearningCollection.createIndex({ userId: 1, lastUsedAt: -1 });

  logger.info('Merchant learning service initialized');
}

/**
 * Normalize merchant name for consistent matching
 */
function normalizeMerchantName(merchantName: string): string {
  return merchantName.toLowerCase().trim();
}

/**
 * Learn from a transaction approval - save merchant → category/account mapping
 */
export async function learnFromTransaction(
  userId: string,
  merchantName: string | undefined,
  categoryId: string,
  accountId: string
): Promise<void> {
  if (!merchantName) {
    return; // No merchant to learn from
  }

  const normalizedMerchant = normalizeMerchantName(merchantName);

  // Skip generic/system merchants
  const skipMerchants = ['transfer', 'cash', 'unknown', 'n/a', 'na', ''];
  if (skipMerchants.includes(normalizedMerchant)) {
    return;
  }

  try {
    // Upsert: Update if exists, create if not
    await merchantLearningCollection.updateOne(
      {
        userId: userId,
        merchantName: normalizedMerchant,
      },
      {
        $set: {
          categoryId: categoryId,
          accountId: accountId,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        },
        $inc: { usageCount: 1 },
        $setOnInsert: {
          userId: userId,
          merchantName: normalizedMerchant,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    logger.info(
      `Learned mapping: ${normalizedMerchant} → category=${categoryId}, account=${accountId}`
    );
  } catch (error) {
    logger.error({ error }, 'Failed to learn from transaction');
  }
}

/**
 * Get learned category/account for a merchant
 */
export async function getLearnedMapping(
  userId: string,
  merchantName: string | undefined
): Promise<{ categoryId: string; accountId: string } | null> {
  if (!merchantName) {
    return null;
  }

  const normalizedMerchant = normalizeMerchantName(merchantName);

  try {
    const learning = await merchantLearningCollection.findOne({
      userId: userId,
      merchantName: normalizedMerchant,
    });

    if (learning) {
      logger.info(
        `Found learned mapping for ${normalizedMerchant}: category=${learning.categoryId}, account=${learning.accountId}`
      );
      return {
        categoryId: learning.categoryId,
        accountId: learning.accountId || '',
      };
    }

    // Try partial match (e.g., "Swiggy Food" matches "Swiggy")
    const partialMatch = await merchantLearningCollection.findOne({
      userId: userId,
      merchantName: { $regex: new RegExp(`^${normalizedMerchant.split(' ')[0]}`, 'i') },
    });

    if (partialMatch) {
      logger.info(`Found partial match for ${normalizedMerchant}: ${partialMatch.merchantName}`);
      return {
        categoryId: partialMatch.categoryId,
        accountId: partialMatch.accountId || '',
      };
    }

    return null;
  } catch (error) {
    logger.error({ error }, 'Failed to get learned mapping');
    return null;
  }
}

/**
 * Get all learned mappings for a user (for debugging/admin UI)
 */
export async function getUserLearnings(userId: string): Promise<MerchantLearning[]> {
  try {
    return await merchantLearningCollection
      .find({ userId: userId })
      .sort({ usageCount: -1, lastUsedAt: -1 })
      .limit(100)
      .toArray();
  } catch (error) {
    logger.error({ error }, 'Failed to get user learnings');
    return [];
  }
}

/**
 * Delete a learned mapping
 */
export async function deleteLearnedMapping(userId: string, merchantName: string): Promise<boolean> {
  const normalizedMerchant = normalizeMerchantName(merchantName);

  try {
    const result = await merchantLearningCollection.deleteOne({
      userId: userId,
      merchantName: normalizedMerchant,
    });

    return (result.deletedCount || 0) > 0;
  } catch (error) {
    logger.error({ error }, 'Failed to delete learned mapping');
    return false;
  }
}

/**
 * Clear all learned mappings for a user
 */
export async function clearUserLearnings(userId: string): Promise<number> {
  try {
    const result = await merchantLearningCollection.deleteMany({
      userId: userId,
    });

    const deletedCount = result.deletedCount || 0;
    logger.info(`Cleared ${deletedCount} learned mappings for user ${userId}`);
    return deletedCount;
  } catch (error) {
    logger.error({ error }, 'Failed to clear user learnings');
    return 0;
  }
}
