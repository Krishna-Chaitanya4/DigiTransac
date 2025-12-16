import cron from 'node-cron';
import { gmailPollingService } from '../services/gmailPolling.service';

/**
 * Schedule email polling job
 * Runs every 5 minutes
 */
export const startEmailPollingJob = () => {
  console.log('📧 Email polling job scheduled to run every 5 minutes');

  // Cron pattern: */5 * * * * = every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log(`\n🔄 [${new Date().toISOString()}] Running email polling job...`);
    await gmailPollingService.pollAllUsers();
  });

  // Also run immediately on startup (optional)
  console.log('🚀 Running initial email poll...');
  setTimeout(() => {
    gmailPollingService.pollAllUsers();
  }, 5000); // Wait 5 seconds after server starts
};
