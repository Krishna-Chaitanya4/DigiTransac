import express from 'express';
import { Request, Response } from 'express';
import { emailParserService } from '../services/emailParser.service';
import { cosmosDBService } from '../config/cosmosdb';
import { randomUUID } from 'crypto';
import { Transaction, TransactionSplit } from '../models/types';

const router = express.Router();

/**
 * Webhook endpoint to receive forwarded emails
 * This will be called by Mailgun/SendGrid when an email is received
 */
router.post('/inbound', async (req: Request, res: Response) => {
  try {
    console.log('Received inbound email:', req.body);

    // Parse the incoming email (format depends on email service)
    const emailData = parseInboundEmail(req.body);

    if (!emailData) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const { to, from, text } = emailData;

    // Extract userId from the email address (expenses-{userId}@yourdomain.com)
    const userId = extractUserIdFromEmail(to);

    if (!userId) {
      console.log('Could not extract userId from email:', to);
      return res.status(400).json({ message: 'Invalid forwarding email' });
    }

    // Check if text looks like a transaction SMS
    if (!emailParserService.isTransactionSMS(text)) {
      console.log('Email does not appear to be a transaction SMS');
      return res.status(200).json({ message: 'Not a transaction SMS, ignored' });
    }

    // Parse the transaction (pass userId for learning)
    const parsedTransaction = await emailParserService.parseTransaction(text, from, userId);

    if (!parsedTransaction) {
      console.log('Could not parse transaction from email');
      return res.status(200).json({ message: 'Could not parse transaction' });
    }

    // Get user's email integration settings
    const userContainer = await cosmosDBService.getUsersContainer();
    const user = await userContainer.findOne({ id: userId });

    if (!user || !user.emailIntegration?.enabled) {
      console.log('Email integration not enabled for user:', userId);
      return res.status(400).json({ message: 'Email integration not enabled' });
    }

    // Fallback hierarchy for category suggestion:
    // 1. MerchantLearning (auto-learned from approvals)
    // 2. Generic keyword patterns (hardcoded common merchants)
    // 3. Empty (user will fill during review)
    const genericCategory = emailParserService.suggestCategory(parsedTransaction.merchant);

    const categoryId = parsedTransaction.learnedCategoryId || genericCategory || '';
    // Priority for account: matched (email/SMS info) > learned (merchant history) > empty (manual)
    const accountId =
      parsedTransaction.matchedAccountId || parsedTransaction.learnedAccountId || '';

    // Create pending transaction
    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    const splitsContainer = await cosmosDBService.getTransactionSplitsContainer();

    const transactionId = randomUUID();
    const splitId = randomUUID();

    const newTransaction: Transaction = {
      id: transactionId,
      userId: userId,
      accountId: accountId, // Auto-filled from learning
      categoryId: categoryId, // Auto-filled from learning (legacy field)
      type: 'debit',
      amount: parsedTransaction.amount,
      description: `${parsedTransaction.merchant} - ${parsedTransaction.bankName}`,
      date: parsedTransaction.date,
      isRecurring: false,
      source: 'email',
      sourceEmailId: emailData.messageId,
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
      userId: userId,
      categoryId: categoryId, // Auto-filled from learning
      amount: parsedTransaction.amount,
      tags: parsedTransaction.tags || [], // Auto-detected tags
      notes: categoryId ? 'Auto-filled from learning' : undefined,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await transactionsContainer.insertOne(newTransaction);
    await splitsContainer.insertOne(newSplit);

    // Update user's email integration stats
    await userContainer.updateOne(
      { id: userId },
      {
        $set: {
          'emailIntegration.lastProcessedAt': new Date(),
          'emailIntegration.totalEmailsProcessed':
            (user?.emailIntegration?.totalEmailsProcessed || 0) + 1,
        },
      }
    );

    console.log('Created pending transaction:', newTransaction.id);

    return res.status(200).json({
      message: 'Transaction processed successfully',
      expense: {
        id: newTransaction.id,
        amount: newTransaction.amount,
        merchant: parsedTransaction.merchant,
        status: 'pending',
      },
    });
  } catch (error: any) {
    console.error('Error processing inbound email:', error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

/**
 * Parse inbound email from Mailgun/SendGrid format
 */
function parseInboundEmail(
  body: any
): { to: string; from: string; subject: string; text: string; messageId: string } | null {
  try {
    // Mailgun format
    if (body.recipient) {
      return {
        to: body.recipient,
        from: body.sender || body.From,
        subject: body.subject || body.Subject || '',
        text: body['body-plain'] || body['stripped-text'] || '',
        messageId: body['Message-Id'] || randomUUID(),
      };
    }

    // SendGrid format
    if (body.to) {
      return {
        to: body.to,
        from: body.from,
        subject: body.subject || '',
        text: body.text || '',
        messageId: body.headers?.['message-id'] || randomUUID(),
      };
    }

    // Generic format (for testing)
    if (body.text && body.from) {
      return {
        to: body.to || '',
        from: body.from,
        subject: body.subject || '',
        text: body.text,
        messageId: body.messageId || randomUUID(),
      };
    }

    return null;
  } catch (error) {
    console.error('Error parsing email body:', error);
    return null;
  }
}

/**
 * Extract userId from forwarding email address
 * Format: expenses-{userId}@yourdomain.com
 */
function extractUserIdFromEmail(email: string): string | null {
  const match = email.match(/expenses-([a-zA-Z0-9-]+)@/);
  return match ? match[1] : null;
}

export default router;
