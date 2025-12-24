import { google } from 'googleapis';
import { cosmosDBService } from '../config/cosmosdb';
import { emailParserService } from './emailParser.service';
import { Transaction, TransactionSplit, Category } from '../models/types';
import { randomUUID } from 'crypto';

class GmailPollingService {
  /**
   * Refresh access token if expired
   */
  private async refreshTokenIfNeeded(user: any) {
    const now = new Date();
    const tokenExpiry = new Date(user.emailIntegration.tokenExpiry);

    // If token expires in less than 5 minutes, refresh it
    if (tokenExpiry.getTime() - now.getTime() < 5 * 60 * 1000) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        `${process.env.BACKEND_URL}/api/gmail/callback`
      );

      oauth2Client.setCredentials({
        refresh_token: user.emailIntegration.refreshToken,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update tokens in database
      const userContainer = await cosmosDBService.getUsersContainer();
      await userContainer.updateOne(
        { id: user.id },
        {
          $set: {
            'emailIntegration.accessToken': credentials.access_token!,
            'emailIntegration.tokenExpiry': new Date(credentials.expiry_date!),
          },
        }
      );

      return credentials.access_token!;
    }

    return user.emailIntegration.accessToken;
  }

  /**
   * Find existing "Uncategorized" category or create new one
   */
  private async getOrCreateUncategorizedCategory(userId: string): Promise<string> {
    try {
      const categoriesContainer = await cosmosDBService.getCategoriesContainer();

      // Try to find existing "Uncategorized" category
      const existing = await categoriesContainer.findOne({
        userId,
        name: 'Uncategorized',
        isFolder: false,
      });

      if (existing) {
        return existing.id;
      }

      // Create new "Uncategorized" category
      const newCategory: Category = {
        id: randomUUID(),
        userId,
        name: 'Uncategorized',
        parentId: null,
        isFolder: false,
        icon: 'help_outline',
        color: '#9e9e9e',
        path: ['Uncategorized'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await categoriesContainer.insertOne(newCategory);
      console.log(`📂 Auto-created "Uncategorized" category for user ${userId}`);

      return newCategory.id;
    } catch (error) {
      console.error('Error getting/creating uncategorized category:', error);
      // Return empty string if failed
      return '';
    }
  }

  /**
   * Fetch and process emails using Gmail History API (industry standard)
   */
  async processUserEmails(user: any): Promise<number> {
    try {
      if (!user.emailIntegration?.enabled) {
        return 0;
      }

      // Refresh token if needed
      const accessToken = await this.refreshTokenIfNeeded(user);

      // Set up Gmail API client
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const lastHistoryId = user.emailIntegration?.lastHistoryId;

      // First-time setup: Get initial historyId
      if (!lastHistoryId) {
        console.log(`🆕 First-time setup for user ${user.id} - Getting initial historyId`);
        const profile = await gmail.users.getProfile({ userId: 'me' });
        const initialHistoryId = profile.data.historyId;

        // Store initial historyId
        const userContainer = await cosmosDBService.getUsersContainer();
        await userContainer.updateOne(
          { id: user.id },
          { $set: { 'emailIntegration.lastHistoryId': initialHistoryId } }
        );

        console.log(`✅ Stored initial historyId: ${initialHistoryId}`);
        console.log(`📭 No emails to process on first setup - will start tracking from now`);
        return 0;
      }

      console.log(`🔄 Fetching changes since historyId: ${lastHistoryId}`);

      // Fetch history changes (only new emails added to INBOX)
      let history: any;
      try {
        history = await gmail.users.history.list({
          userId: 'me',
          startHistoryId: lastHistoryId,
          historyTypes: ['messageAdded'],
          labelId: 'INBOX',
        });
      } catch (error: any) {
        if (error.code === 404) {
          console.warn(`⚠️ HistoryId ${lastHistoryId} expired. Getting fresh historyId.`);
          const profile = await gmail.users.getProfile({ userId: 'me' });
          const freshHistoryId = profile.data.historyId;

          const userContainer = await cosmosDBService.getUsersContainer();
          await userContainer.updateOne(
            { id: user.id },
            { $set: { 'emailIntegration.lastHistoryId': freshHistoryId } }
          );

          console.log(`✅ Reset to fresh historyId: ${freshHistoryId}`);
          return 0;
        }
        throw error;
      }

      const historyRecords = history.data.history || [];

      if (historyRecords.length === 0) {
        console.log(`📭 No new changes since last check`);
        return 0;
      }

      console.log(`📬 Found ${historyRecords.length} history record(s) with changes`);

      // Extract new message IDs from history
      const newMessageIds: string[] = [];
      for (const record of historyRecords) {
        const messagesAdded = record.messagesAdded || [];
        for (const msgAdded of messagesAdded) {
          if (msgAdded.message?.id) {
            newMessageIds.push(msgAdded.message.id);
          }
        }
      }

      console.log(`📨 Extracted ${newMessageIds.length} new message ID(s)`);

      if (newMessageIds.length === 0) {
        // Update historyId even if no messages to process
        const newHistoryId = history.data.historyId;
        const userContainer = await cosmosDBService.getUsersContainer();
        await userContainer.updateOne(
          { id: user.id },
          { $set: { 'emailIntegration.lastHistoryId': newHistoryId } }
        );
        return 0;
      }

      // Bank sender filters
      const bankSenders = [
        'HDFCBK',
        'HDFC',
        'ICICIB',
        'ICICI',
        'SBIIN',
        'SBI',
        'AXISBK',
        'AXIS',
        'KOTAKB',
        'KOTAK',
        'PNBSMS',
        'PNB',
        'BOBIN',
        'BOB',
        'CANBNK',
        'CANARA',
        'UBOI',
        'UNION',
        'IDBIBN',
        'IDBI',
        'perugukrishna8@gmail.com', // Test email
      ];

      let processedCount = 0;

      // Process each new message
      for (const messageId of newMessageIds) {
        try {
          // Get full message details
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full',
          });

          // Extract email content
          const headers = msg.data.payload?.headers || [];
          const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from');

          const from = fromHeader?.value || '';

          // Check if email is from a bank sender
          const isFromBank = bankSenders.some((sender) => from.includes(sender));
          if (!isFromBank) {
            console.log(`⏭️ Skipping non-bank email from: ${from}`);
            continue;
          }

          // Get email body
          let body = '';
          if (msg.data.payload?.body?.data) {
            body = Buffer.from(msg.data.payload.body.data, 'base64').toString('utf-8');
          } else if (msg.data.payload?.parts) {
            // Try text/plain first
            let textPart = msg.data.payload.parts.find((p) => p.mimeType === 'text/plain');
            if (!textPart) {
              // Fall back to text/html if no plain text
              textPart = msg.data.payload.parts.find((p) => p.mimeType === 'text/html');
            }
            // Check nested parts (multipart/alternative)
            if (!textPart && msg.data.payload.parts.length > 0) {
              for (const part of msg.data.payload.parts) {
                if (part.parts) {
                  textPart = part.parts.find((p) => p.mimeType === 'text/plain');
                  if (!textPart) {
                    textPart = part.parts.find((p) => p.mimeType === 'text/html');
                  }
                  if (textPart) break;
                }
              }
            }
            if (textPart?.body?.data) {
              body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
              // Strip HTML tags if it's HTML
              if (textPart.mimeType === 'text/html') {
                body = body
                  .replace(/<[^>]*>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
              }
            }
          }

          // Log email details for debugging
          console.log(`📧 Processing new email:`);
          console.log('  From:', from);
          console.log('  Message ID:', messageId);
          console.log('  Body:', body.substring(0, 200)); // First 200 chars

          // Check if it's a transaction SMS
          if (!emailParserService.isTransactionSMS(body)) {
            console.log('❌ Not a transaction email, skipping');
            continue;
          }

          console.log('✅ Detected as transaction SMS');

          // Parse transaction (pass userId for learning)
          const parsedTransaction = await emailParserService.parseTransaction(body, from, user.id);

          if (!parsedTransaction) {
            console.log('❌ Could not parse transaction, skipping');
            console.log('   Full body was:', body);
            continue;
          }

          console.log('✅ Transaction parsed successfully!');
          console.log('   Amount:', parsedTransaction.amount);
          console.log('   Merchant:', parsedTransaction.merchant);
          console.log('   Bank:', parsedTransaction.bankName);

          // Use learned category/account if available, otherwise use suggested/empty
          let categoryId = parsedTransaction.learnedCategoryId || emailParserService.suggestCategory(
            parsedTransaction.merchant,
            user.emailIntegration?.merchantMappings
          );

          // If no category suggested, use "Uncategorized" as fallback
          if (!categoryId) {
            categoryId = await this.getOrCreateUncategorizedCategory(user.id);
            console.log('   📂 No category match - using Uncategorized');
          } else {
            console.log('   📂 Category suggested from mapping or learning');
          }
          
          const accountId = parsedTransaction.learnedAccountId || '';

          // Create pending transaction
          const transactionsContainer = await cosmosDBService.getTransactionsContainer();
          const splitsContainer = await cosmosDBService.getTransactionSplitsContainer();

          const transactionId = randomUUID();
          const splitId = randomUUID();

          const newTransaction: Transaction = {
            id: transactionId,
            userId: user.id,
            accountId: accountId, // Auto-filled from learning
            categoryId: categoryId, // Legacy field, auto-filled
            type: 'debit',
            amount: parsedTransaction.amount,
            description: `${parsedTransaction.merchant} - ${parsedTransaction.bankName}`,
            date: parsedTransaction.date,
            isRecurring: false,
            source: 'email',
            sourceEmailId: messageId,
            merchantName: parsedTransaction.merchant,
            tags: parsedTransaction.tags || [], // Auto-detected tags
            parsedData: {
              rawText: parsedTransaction.rawText,
              bankName: parsedTransaction.bankName,
              cardLast4: parsedTransaction.cardLast4,
              transactionId: parsedTransaction.transactionId,
              confidence: parsedTransaction.confidence,
            },
            reviewStatus: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const newSplit: TransactionSplit = {
            id: splitId,
            transactionId: transactionId,
            userId: user.id,
            categoryId: categoryId,
            amount: parsedTransaction.amount,
            tags: parsedTransaction.tags || [], // Auto-detected tags
            notes: categoryId && parsedTransaction.learnedCategoryId ? 'Auto-filled from learning' : undefined,
            order: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await transactionsContainer.insertOne(newTransaction);
          await splitsContainer.insertOne(newSplit);
          processedCount++;
          console.log(`💰 Created transaction ${newTransaction.id} from email ${messageId}`);
        } catch (error) {
          console.error(`❌ Error processing message ${messageId}:`, error);
          // Continue processing other emails even if one fails
        }
      }

      // Update historyId to the latest from Gmail (critical for delta sync)
      const newHistoryId = history.data.historyId;
      const userContainer = await cosmosDBService.getUsersContainer();

      await userContainer.updateOne(
        { id: user.id },
        {
          $set: {
            'emailIntegration.lastHistoryId': newHistoryId,
            'emailIntegration.lastProcessedAt': new Date(),
            'emailIntegration.totalEmailsProcessed':
              (user.emailIntegration.totalEmailsProcessed || 0) + processedCount,
          },
        }
      );

      console.log(
        `✅ Successfully processed ${processedCount} expense(s) from ${newMessageIds.length} new email(s)`
      );
      console.log(`📌 Updated historyId: ${lastHistoryId} → ${newHistoryId}`);
      console.log(`🚀 Delta sync complete - only fetched changes, not full inbox!`);

      return processedCount;
    } catch (error: any) {
      console.error(`Error processing emails for user ${user.id}:`, error);
      return 0;
    }
  }

  /**
   * Poll all users with enabled email integration
   */
  async pollAllUsers(): Promise<void> {
    try {
      console.log('Starting email polling job...');

      const userContainer = await cosmosDBService.getUsersContainer();

      // Find all users with email integration enabled
      const users = await userContainer
        .find({
          'emailIntegration.enabled': true,
        })
        .toArray();

      console.log(`Found ${users.length} users with email integration enabled`);

      let totalProcessed = 0;

      // Process each user
      for (const user of users) {
        const count = await this.processUserEmails(user);
        totalProcessed += count;
      }

      console.log(`Email polling completed. Processed ${totalProcessed} emails total.`);
    } catch (error) {
      console.error('Error in email polling job:', error);
    }
  }
}

export const gmailPollingService = new GmailPollingService();
