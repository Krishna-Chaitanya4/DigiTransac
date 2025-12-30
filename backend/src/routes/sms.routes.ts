import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { smsParserService, ParsedTransaction } from '../services/smsParser.service';
import { mongoDBService } from '../config/mongodb';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';
import { logger } from '../utils/logger';

const router = Router();

// Get supported banks
router.get('/supported-banks', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const banks = smsParserService.getSupportedBanks();
    return res.json({ banks });
  } catch (error) {
    console.error('Error fetching supported banks:', error);
    return res.status(500).json({ error: 'Failed to fetch supported banks' });
  }
});

// Parse SMS and create pending transactions
router.post(
  '/parse',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { smsTexts } = req.body;

    if (!smsTexts || !Array.isArray(smsTexts)) {
      return ApiResponse.badRequest(res, 'smsTexts array is required');
    }

    if (smsTexts.length === 0) {
      return ApiResponse.badRequest(res, 'At least one SMS text is required');
    }

    if (smsTexts.length > 50) {
      return ApiResponse.badRequest(res, 'Maximum 50 SMS messages allowed per batch');
    }

    const userId = req.userId!;

    // Parse all SMS messages (pass userId for learning)
    const parsedTransactions = await smsParserService.parseMultipleSMS(smsTexts, userId);

    if (parsedTransactions.length === 0) {
      return ApiResponse.badRequest(
        res,
        'No valid transactions found in the provided SMS messages',
        {
          failedCount: smsTexts.length,
        }
      );
    }

    // Get existing transactions for duplicate detection
    const transactionsContainer = await mongoDBService.getTransactionsContainer();

    // Get transactions from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const existingTransactions = (await transactionsContainer
      .find({
        userId,
        date: { $gte: sevenDaysAgo },
      })
      .toArray()) as any[];

    // Convert to format expected by isDuplicate
    const existingFormatted = existingTransactions.map((t: any) => ({
      amount: Math.abs(t.amount),
      date: new Date(t.date),
      description: t.description,
    }));

    // Create pending transactions (filter out duplicates)
    const pendingTransactions: any[] = [];
    const duplicates: ParsedTransaction[] = [];

    for (const parsed of parsedTransactions) {
      // Check for duplicates
      if (smsParserService.isDuplicate(parsed, existingFormatted)) {
        duplicates.push(parsed);
        continue;
      }

      // Extract merchant name
      const merchant = parsed.merchant
        ? smsParserService.extractMerchant(parsed.merchant)
        : 'Unknown';

      // Create pending transaction with proper structure
      const transactionId = uuidv4();

      // Priority for account: matched (SMS info) > learned (merchant history) > empty (manual)
      const finalAccountId = parsed.matchedAccountId || parsed.learnedAccountId || '';

      const pendingTransaction = {
        id: transactionId,
        userId,
        type: parsed.type === 'debit' ? 'debit' : 'credit', // Use 'debit'/'credit' not 'expense'/'income'
        amount: Math.abs(parsed.amount), // Always positive
        accountId: finalAccountId, // Auto-filled from account matching or learning
        categoryId: parsed.learnedCategoryId || '', // Auto-filled from learning (legacy field)
        description: merchant,
        date: parsed.date || new Date(), // Store as Date object, not string
        source: 'sms',
        merchantName: merchant,
        tags: parsed.tags || [], // Auto-detected tags
        reviewStatus: 'pending',
        confidence: parsed.confidence,
        originalContent: parsed.originalText, // Store original SMS
        isRecurring: false,
        parsedData: {
          accountNumber: parsed.accountNumber,
          bankName: parsed.bankName,
          referenceNumber: parsed.referenceNumber,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      pendingTransactions.push(pendingTransaction);
    }

    // Save to database
    const savedTransactions: any[] = [];
    const splitsContainer = await mongoDBService.getTransactionSplitsContainer();

    for (const transaction of pendingTransactions) {
      const result = await transactionsContainer.insertOne(transaction);
      savedTransactions.push({ ...transaction, id: result.insertedId });

      // If we have a learned category, create a split automatically
      if (transaction.categoryId) {
        const splitId = uuidv4();
        await splitsContainer.insertOne({
          id: splitId,
          transactionId: transaction.id,
          userId: transaction.userId,
          categoryId: transaction.categoryId,
          amount: transaction.amount,
          tags: transaction.tags || [],
          notes: 'Auto-filled from learning',
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Return summary
    logger.info(
      {
        userId,
        total: smsTexts.length,
        parsed: parsedTransactions.length,
        created: savedTransactions.length,
        duplicates: duplicates.length,
      },
      'SMS batch parsed and saved'
    );

    ApiResponse.created(res, {
      summary: {
        total: smsTexts.length,
        parsed: parsedTransactions.length,
        created: savedTransactions.length,
        duplicates: duplicates.length,
        failed: smsTexts.length - parsedTransactions.length,
      },
      transactions: savedTransactions,
      duplicateDetails: duplicates.map((d) => ({
        amount: d.amount,
        merchant: d.merchant,
        date: d.date,
      })),
    });
  })
);

// Parse SMS without saving (preview only)
router.post(
  '/preview',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { smsTexts } = req.body;
    const userId = req.userId!;

    if (!smsTexts || !Array.isArray(smsTexts)) {
      return ApiResponse.badRequest(res, 'smsTexts array is required');
    }

    const parsedTransactions = await smsParserService.parseMultipleSMS(smsTexts, userId);

    const preview = parsedTransactions.map((parsed) => ({
      amount: parsed.amount,
      type: parsed.type,
      merchant: parsed.merchant ? smsParserService.extractMerchant(parsed.merchant) : 'Unknown',
      date: parsed.date,
      accountNumber: parsed.accountNumber,
      bankName: parsed.bankName,
      confidence: parsed.confidence,
      originalText: parsed.originalText,
    }));

    logger.info(
      { userId, total: smsTexts.length, parsed: parsedTransactions.length },
      'SMS preview generated'
    );
    ApiResponse.success(res, {
      total: smsTexts.length,
      parsed: parsedTransactions.length,
      failed: smsTexts.length - parsedTransactions.length,
      transactions: preview,
    });
  })
);

export default router;
