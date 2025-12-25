/**
 * Migration Script: Convert existing transactions to use split model
 *
 * This script:
 * 1. Finds all transactions without splits
 * 2. Creates a single split for each transaction using its categoryId and tags
 * 3. Preserves all existing data
 */

import { cosmosDBService } from '../config/cosmosdb';
import { Transaction, TransactionSplit } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

async function migrateToSplits() {
  try {
    console.log('🚀 Starting migration to split transactions...\n');

    await cosmosDBService.initialize();

    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    const splitsContainer = await cosmosDBService.getTransactionSplitsContainer();

    // Get all transactions
    const allTransactions = (await transactionsContainer
      .find({})
      .toArray()) as unknown as Transaction[];

    console.log(`📊 Found ${allTransactions.length} total transactions\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const transaction of allTransactions) {
      try {
        // Check if splits already exist for this transaction
        const existingSplits = await splitsContainer.findOne({ transactionId: transaction.id });

        if (existingSplits) {
          console.log(`⏭️  Transaction ${transaction.id} already has splits, skipping`);
          skippedCount++;
          continue;
        }

        // Skip if no categoryId (shouldn't happen, but just in case)
        if (!transaction.categoryId) {
          console.log(`⚠️  Transaction ${transaction.id} has no categoryId, skipping`);
          skippedCount++;
          continue;
        }

        // Create a single split with the transaction's category and tags
        const split: TransactionSplit = {
          id: uuidv4(),
          transactionId: transaction.id,
          userId: transaction.userId,
          categoryId: transaction.categoryId,
          amount: transaction.amount,
          tags: transaction.tags || [],
          notes: undefined,
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await splitsContainer.insertOne(split);

        migratedCount++;
        console.log(
          `✅ Migrated transaction ${transaction.id} (${transaction.description || 'No description'})`
        );
      } catch (error) {
        errorCount++;
        console.error(`❌ Error migrating transaction ${transaction.id}:`, error);
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${migratedCount}`);
    console.log(`   ⏭️  Skipped (already migrated): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📊 Total processed: ${allTransactions.length}\n`);

    await cosmosDBService.close();
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateToSplits();
