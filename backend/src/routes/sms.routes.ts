import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { smsParserService, ParsedTransaction } from '../services/smsParser.service';
import { cosmosDBService } from '../config/cosmosdb';
import { v4 as uuidv4 } from 'uuid';

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
router.post('/parse', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { smsTexts } = req.body;

    if (!smsTexts || !Array.isArray(smsTexts)) {
      res.status(400).json({ error: 'smsTexts array is required' });
      return;
    }

    if (smsTexts.length === 0) {
      res.status(400).json({ error: 'At least one SMS text is required' });
      return;
    }

    if (smsTexts.length > 50) {
      res.status(400).json({ error: 'Maximum 50 SMS messages allowed per batch' });
      return;
    }

    const userId = req.userId!;

    // Parse all SMS messages
    const parsedTransactions = smsParserService.parseMultipleSMS(smsTexts);

    if (parsedTransactions.length === 0) {
      res.status(400).json({
        error: 'No valid transactions found in the provided SMS messages',
        failedCount: smsTexts.length,
      });
      return;
    }

    // Get existing transactions for duplicate detection
    const transactionsContainer = await cosmosDBService.getTransactionsContainer();
    
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

      // Create pending transaction
      const pendingTransaction = {
        id: uuidv4(),
        userId,
        amount: parsed.type === 'debit' ? -Math.abs(parsed.amount) : Math.abs(parsed.amount),
        type: parsed.type === 'debit' ? 'expense' : 'income',
        description: merchant,
        date: (parsed.date || new Date()).toISOString(),
        source: 'sms',
        reviewStatus: 'pending',
        metadata: {
          originalSMS: parsed.originalText,
          accountNumber: parsed.accountNumber,
          bankName: parsed.bankName,
          confidence: parsed.confidence,
          referenceNumber: parsed.referenceNumber,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      pendingTransactions.push(pendingTransaction);
    }

    // Save to database
    const savedTransactions: any[] = [];
    for (const transaction of pendingTransactions) {
      const result = await transactionsContainer.insertOne(transaction);
      savedTransactions.push({ ...transaction, id: result.insertedId });
    }

    // Return summary
    res.status(201).json({
      success: true,
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
  } catch (error) {
    console.error('Error parsing SMS:', error);
    res.status(500).json({ error: 'Failed to parse SMS messages' });
  }
});

// Parse SMS without saving (preview only)
router.post('/preview', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { smsTexts } = req.body;

    if (!smsTexts || !Array.isArray(smsTexts)) {
      res.status(400).json({ error: 'smsTexts array is required' });
      return;
    }

    const parsedTransactions = smsParserService.parseMultipleSMS(smsTexts);

    const preview = parsedTransactions.map((parsed) => ({
      amount: parsed.amount,
      type: parsed.type,
      merchant: parsed.merchant
        ? smsParserService.extractMerchant(parsed.merchant)
        : 'Unknown',
      date: parsed.date,
      accountNumber: parsed.accountNumber,
      bankName: parsed.bankName,
      confidence: parsed.confidence,
      originalText: parsed.originalText,
    }));

    res.json({
      success: true,
      total: smsTexts.length,
      parsed: parsedTransactions.length,
      failed: smsTexts.length - parsedTransactions.length,
      transactions: preview,
    });
  } catch (error) {
    console.error('Error previewing SMS:', error);
    res.status(500).json({ error: 'Failed to preview SMS messages' });
  }
});

export default router;
