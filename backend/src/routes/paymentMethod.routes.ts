import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cosmosDBService } from '../config/cosmosdb';
import { PaymentMethod } from '../models/types';
import { randomUUID } from 'crypto';

const router = Router();

router.use(authenticate);

// Get all payment methods for user
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const container = await cosmosDBService.getPaymentMethodsContainer();
    
    const paymentMethods = await container.find({ userId }).toArray();
    
    res.json(paymentMethods);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// Create payment method
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { name, type, bankName, last4, icon, color, isDefault } = req.body;

    if (!name || !type) {
      res.status(400).json({ error: 'Name and type are required' });
      return;
    }

    const container = await cosmosDBService.getPaymentMethodsContainer();

    // If this is set as default, unset other defaults
    if (isDefault) {
      await container.updateMany(
        { userId, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const newPaymentMethod: PaymentMethod = {
      id: randomUUID(),
      userId,
      name,
      type,
      bankName,
      last4,
      icon,
      color,
      isDefault: isDefault || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await container.insertOne(newPaymentMethod);

    res.status(201).json(newPaymentMethod);
  } catch (error) {
    console.error('Error creating payment method:', error);
    res.status(500).json({ error: 'Failed to create payment method' });
  }
});

// Update payment method
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { name, type, bankName, last4, icon, color, isDefault } = req.body;

    const container = await cosmosDBService.getPaymentMethodsContainer();

    // Verify ownership
    const existing = await container.findOne({ id, userId });
    if (!existing) {
      res.status(404).json({ error: 'Payment method not found' });
      return;
    }

    // If this is set as default, unset other defaults
    if (isDefault && !existing.isDefault) {
      await container.updateMany(
        { userId, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (bankName !== undefined) updateData.bankName = bankName;
    if (last4 !== undefined) updateData.last4 = last4;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    await container.updateOne(
      { id, userId },
      { $set: updateData }
    );

    const updated = await container.findOne({ id, userId });
    res.json(updated);
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({ error: 'Failed to update payment method' });
  }
});

// Delete payment method
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const container = await cosmosDBService.getPaymentMethodsContainer();

    // Verify ownership
    const existing = await container.findOne({ id, userId });
    if (!existing) {
      res.status(404).json({ error: 'Payment method not found' });
      return;
    }

    // Check if any expenses use this payment method
    const expenseContainer = await cosmosDBService.getExpensesContainer();
    const expenseCount = await expenseContainer.countDocuments({ userId, paymentMethodId: id });

    if (expenseCount > 0) {
      res.status(400).json({ 
        error: 'Cannot delete payment method that is used by expenses',
        expenseCount 
      });
      return;
    }

    await container.deleteOne({ id, userId });

    res.json({ message: 'Payment method deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

export default router;
