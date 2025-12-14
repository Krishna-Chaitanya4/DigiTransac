import { google } from 'googleapis';
import { cosmosDBService } from '../config/cosmosdb';
import { emailParserService } from './emailParser.service';
import { Expense } from '../models/types';
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
   * Fetch and process emails for a single user with optimized pagination
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

      // Build query to fetch bank emails
      const bankSenders = [
        'HDFCBK', 'HDFC', 'ICICIB', 'ICICI', 'SBIIN', 'SBI',
        'AXISBK', 'AXIS', 'KOTAKB', 'KOTAK', 'PNBSMS', 'PNB',
        'BOBIN', 'BOB', 'CANBNK', 'CANARA', 'UBOI', 'UNION',
        'IDBIBN', 'IDBI',
      ];

      const query = `from:(${bankSenders.join(' OR ')})`;
      const lastProcessedId = user.emailIntegration?.lastProcessedEmailId;
      const lastProcessedAt = user.emailIntegration?.lastProcessedAt;
      
      // Calculate smart batch size based on offline time
      const hoursOffline = lastProcessedAt ? 
        (Date.now() - new Date(lastProcessedAt).getTime()) / (1000 * 60 * 60) : 168;
      
      let batchSize;
      if (hoursOffline < 1) {
        batchSize = 20;    // Recent polling - small batch
      } else if (hoursOffline < 24) {
        batchSize = 100;   // Few hours offline - medium batch
      } else {
        batchSize = 500;   // Long offline - large batch for efficiency
      }
      
      console.log(`📊 User ${user.id} - Offline for ${hoursOffline.toFixed(1)}h, using batch size ${batchSize}`);
      
      // Pagination to find all new emails until marker
      let allNewMessages = [];
      let pageToken = undefined;
      let foundMarker = false;
      let pageCount = 0;
      const maxPages = 20; // Safety limit
      
      console.log(`🔍 Searching for emails after marker: ${lastProcessedId || 'none (new user)'}`);
      
      do {
        const response: any = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: batchSize,
          pageToken: pageToken,
        });
        
        const messages = response.data.messages || [];
        pageCount++;
        
        console.log(`📄 Page ${pageCount}: Found ${messages.length} emails`);
        
        if (!lastProcessedId) {
          // New user - process all messages in this batch
          allNewMessages.push(...messages);
          console.log(`👤 New user: Added ${messages.length} emails to process`);
          break;
        }
        
        // Check if our marker is in this batch
        const markerIndex = messages.findIndex((msg: any) => msg.id === lastProcessedId);
        
        if (markerIndex !== -1) {
          // Found the marker! Take only emails BEFORE it (newer emails)
          const newEmails = messages.slice(0, markerIndex);
          allNewMessages.push(...newEmails);
          foundMarker = true;
          console.log(`✅ Found marker at position ${markerIndex}, added ${newEmails.length} new emails`);
          break;
        } else {
          // Marker not found, add all messages and continue to next page
          allNewMessages.push(...messages);
          pageToken = response.data.nextPageToken;
          console.log(`⏭️ Marker not found, added ${messages.length} emails, continuing to next page`);
        }
        
        // Safety: prevent infinite loops
        if (pageCount >= maxPages) {
          console.warn(`⚠️ Reached maximum page limit (${maxPages}). Processing available emails.`);
          break;
        }
        
        // Rate limiting protection
        if (pageToken) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between pages
        }
        
      } while (pageToken && !foundMarker);
      
      // Handle edge cases
      if (!foundMarker && lastProcessedId && pageCount > 0) {
        if (hoursOffline > 168) { // More than 7 days
          console.warn(`⚠️ LastProcessedEmailId not found after ${pageCount} pages. Marker might be too old (${hoursOffline.toFixed(1)}h offline). Processing recent emails only.`);
        } else {
          console.warn(`⚠️ Could not find lastProcessedEmailId ${lastProcessedId} after ${pageCount} pages. Processing all fetched emails.`);
        }
      }
      
      if (allNewMessages.length === 0) {
        console.log(`📭 No new emails to process for user ${user.id}`);
        return 0;
      }
      
      console.log(`🎯 Processing ${allNewMessages.length} new emails (reduced from potentially ${pageCount * batchSize}+ total emails)`);
      
      let processedCount = 0;
      let latestEmailId = null;

      // Process emails in reverse order (oldest new email first) for chronological expense creation
      for (let i = allNewMessages.length - 1; i >= 0; i--) {
        const message = allNewMessages[i];
        
        try {
          // Track the latest (newest) email ID for updating marker
          if (i === 0) {
            latestEmailId = message.id!;
          }

          // Get full message details
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'full',
          });

          // Extract email content
          const headers = msg.data.payload?.headers || [];
          const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from');
          
          const from = fromHeader?.value || '';
          
          // Get email body
          let body = '';
          if (msg.data.payload?.body?.data) {
            body = Buffer.from(msg.data.payload.body.data, 'base64').toString('utf-8');
          } else if (msg.data.payload?.parts) {
            // Try text/plain first
            let textPart = msg.data.payload.parts.find(p => p.mimeType === 'text/plain');
            if (!textPart) {
              // Fall back to text/html if no plain text
              textPart = msg.data.payload.parts.find(p => p.mimeType === 'text/html');
            }
            // Check nested parts (multipart/alternative)
            if (!textPart && msg.data.payload.parts.length > 0) {
              for (const part of msg.data.payload.parts) {
                if (part.parts) {
                  textPart = part.parts.find(p => p.mimeType === 'text/plain');
                  if (!textPart) {
                    textPart = part.parts.find(p => p.mimeType === 'text/html');
                  }
                  if (textPart) break;
                }
              }
            }
            if (textPart?.body?.data) {
              body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
              // Strip HTML tags if it's HTML
              if (textPart.mimeType === 'text/html') {
                body = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
              }
            }
          }

          // Log email details for debugging
          console.log(`📧 Processing email ${allNewMessages.length - i}/${allNewMessages.length}:`);
          console.log('  From:', from);
          console.log('  Message ID:', message.id);
          console.log('  Body:', body.substring(0, 200)); // First 200 chars

          // Check if it's a transaction SMS
          if (!emailParserService.isTransactionSMS(body)) {
            console.log('❌ Not a transaction email, skipping');
            continue;
          }

          console.log('✅ Detected as transaction SMS');

          // Parse transaction
          const parsedTransaction = emailParserService.parseTransaction(body, from);

          if (!parsedTransaction) {
            console.log('❌ Could not parse transaction, skipping');
            console.log('   Full body was:', body);
            continue;
          }

          console.log('✅ Transaction parsed successfully!');
          console.log('   Amount:', parsedTransaction.amount);
          console.log('   Merchant:', parsedTransaction.merchant);
          console.log('   Bank:', parsedTransaction.bankName);

          // Suggest category
          const suggestedCategory = emailParserService.suggestCategory(
            parsedTransaction.merchant,
            user.emailIntegration?.merchantMappings
          );

          // Create pending expense
          const expenseContainer = await cosmosDBService.getExpensesContainer();
          
          const newExpense: Expense = {
            id: randomUUID(),
            userId: user.id,
            categoryId: suggestedCategory || '',
            amount: parsedTransaction.amount,
            description: `${parsedTransaction.merchant} - ${parsedTransaction.bankName}`,
            date: parsedTransaction.date,
            isRecurring: false,
            source: 'email',
            sourceEmailId: message.id!,
            merchantName: parsedTransaction.merchant,
            parsedData: {
              rawText: parsedTransaction.rawText,
              bankName: parsedTransaction.bankName,
              cardLast4: parsedTransaction.cardLast4,
              transactionId: parsedTransaction.transactionId,
              confidence: parsedTransaction.confidence,
            },
            reviewStatus: 'pending',
            notes: suggestedCategory ? '' : 'Category needs to be assigned',
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await expenseContainer.insertOne(newExpense);
          processedCount++;
          console.log(`💰 Created expense ${newExpense.id} from email ${message.id}`);

        } catch (error) {
          console.error(`❌ Error processing message ${message.id}:`, error);
          // Continue processing other emails even if one fails
        }
      }

      // Update user stats with new marker-based approach
      const userContainer = await cosmosDBService.getUsersContainer();
      const updateData: any = {
        'emailIntegration.lastProcessedAt': new Date(),
        'emailIntegration.totalEmailsProcessed': 
          (user.emailIntegration.totalEmailsProcessed || 0) + processedCount,
      };
      
      // Update the marker to the latest processed email (if any new emails were processed)
      if (latestEmailId) {
        updateData['emailIntegration.lastProcessedEmailId'] = latestEmailId;
        console.log(`📌 Updated marker to latest email ID: ${latestEmailId}`);
      }
      
      await userContainer.updateOne(
        { id: user.id },
        { $set: updateData }
      );
      
      console.log(`✅ Successfully processed ${processedCount} new emails for user ${user.id}`);
      console.log(`📊 Performance: Checked ${allNewMessages.length} emails vs potentially ${pageCount * batchSize}+ without optimization`);
      
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
      const users = await userContainer.find({
        'emailIntegration.enabled': true,
      }).toArray();

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
