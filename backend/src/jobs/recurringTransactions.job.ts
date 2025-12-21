import { cosmosDBService } from '../config/cosmosdb';
import { Transaction, RecurrencePattern } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Process recurring transactions and create new instances
 * Runs daily to check if any recurring transactions need to be created
 */
export async function processRecurringTransactions(): Promise<number> {
  try {
    console.log('🔄 Processing recurring transactions...');
    
    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    
    // Find all recurring transactions
    const recurringTransactions = (await transactionsContainer
      .find({ isRecurring: true })
      .toArray()) as unknown as Transaction[];

    console.log(`Found ${recurringTransactions.length} recurring transactions`);

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    let created = 0;

    for (const recurringTxn of recurringTransactions) {
      if (!recurringTxn.recurrencePattern) continue;

      const pattern = recurringTxn.recurrencePattern;
      
      // Check if recurrence has ended
      if (pattern.endDate && new Date(pattern.endDate) < today) {
        continue;
      }

      // Check if we should create a transaction today
      if (shouldCreateTransaction(recurringTxn, pattern, today)) {
        // Create new transaction instance
        const newTransaction: Transaction = {
          ...recurringTxn,
          id: uuidv4(),
          date: today,
          isRecurring: false, // Created instance is not recurring itself
          recurrencePattern: undefined,
          linkedTransactionId: recurringTxn.id, // Link back to recurring template
          tags: [...(recurringTxn.tags || []), 'recurring-auto'], // Add auto-generated tag
          notes: `${recurringTxn.notes || ''}\n[Auto-created from recurring transaction]`.trim(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await transactionsContainer.insertOne(newTransaction);
        
        // Update last created timestamp on the recurring transaction
        await transactionsContainer.updateOne(
          { id: recurringTxn.id },
          { 
            $set: { 
              'recurrencePattern.lastCreated': today,
              updatedAt: new Date()
            } 
          }
        );

        created++;
        console.log(`✅ Created recurring transaction: ${recurringTxn.description}`);
      }
    }

    console.log(`✅ Created ${created} recurring transactions`);
    return created;
  } catch (error) {
    console.error('❌ Error processing recurring transactions:', error);
    return 0;
  }
}

/**
 * Determine if a transaction should be created today based on recurrence pattern
 */
function shouldCreateTransaction(
  transaction: Transaction,
  pattern: RecurrencePattern,
  today: Date
): boolean {
  const lastCreated = pattern.lastCreated ? new Date(pattern.lastCreated) : null;
  
  // If already created today, skip
  if (lastCreated) {
    lastCreated.setHours(0, 0, 0, 0);
    if (lastCreated.getTime() === today.getTime()) {
      return false;
    }
  }

  const dayOfMonth = today.getDate();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

  switch (pattern.frequency) {
    case 'daily':
      return true; // Create every day

    case 'weekly':
      // Create on the same day of week as the original transaction
      const originalDate = new Date(transaction.date);
      return dayOfWeek === originalDate.getDay();

    case 'monthly':
      // Create on the specified day of month (or last day if pattern.day > days in month)
      const targetDay = pattern.day || new Date(transaction.date).getDate();
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const effectiveDay = Math.min(targetDay, lastDayOfMonth);
      return dayOfMonth === effectiveDay;

    case 'yearly':
      // Create on the same month and day as the original transaction
      const originalYearly = new Date(transaction.date);
      return today.getMonth() === originalYearly.getMonth() && 
             dayOfMonth === originalYearly.getDate();

    default:
      return false;
  }
}

/**
 * Start the recurring transactions cron job
 * Runs every day at midnight
 */
export function startRecurringTransactionsJob(): void {
  // Run immediately on startup
  processRecurringTransactions();

  // Run every day at midnight (00:00)
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  
  // Calculate time until next midnight
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const timeUntilMidnight = midnight.getTime() - now.getTime();

  // Schedule first run at midnight
  setTimeout(() => {
    processRecurringTransactions();
    
    // Then run every 24 hours
    setInterval(() => {
      processRecurringTransactions();
    }, TWENTY_FOUR_HOURS);
  }, timeUntilMidnight);

  console.log('✅ Recurring transactions job scheduled');
}
