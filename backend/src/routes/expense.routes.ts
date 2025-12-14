import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cosmosDBService } from '../config/cosmosdb';
import { Expense } from '../models/types';

const router = Router();

router.use(authenticate);

// GET /api/expenses - Get all expenses with filters
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { categoryId, startDate, endDate, isRecurring, reviewStatus } = req.query;
    
    const expensesContainer = await cosmosDBService.getExpensesContainer();
    
    // Build filter
    const filter: any = { userId };
    if (categoryId) filter.categoryId = categoryId;
    if (isRecurring !== undefined) filter.isRecurring = isRecurring === 'true';
    if (reviewStatus) filter.reviewStatus = reviewStatus;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate as string);
      if (endDate) filter.date.$lte = new Date(endDate as string);
    }

    const expenses = (await expensesContainer
      .find(filter)
      .toArray()) as unknown as Expense[];

    res.json({
      success: true,
      expenses
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expenses'
    });
  }
});

// GET /api/expenses/:id - Get single expense
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const expensesContainer = await cosmosDBService.getExpensesContainer();
    const expense = await expensesContainer.findOne({ id, userId }) as Expense | null;

    if (!expense) {
      res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
      return;
    }

    res.json({
      success: true,
      expense
    });
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expense'
    });
  }
});

// POST /api/expenses - Create expense
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const {
      categoryId,
      amount,
      description,
      date,
      isRecurring,
      recurrencePattern,
      tags,
      notes
    } = req.body;

    if (!categoryId || !amount || !description) {
      res.status(400).json({
        success: false,
        message: 'Category, amount, and description are required'
      });
      return;
    }

    // Validate category exists and is not a folder
    const categoriesContainer = await cosmosDBService.getCategoriesContainer();
    const category = await categoriesContainer.findOne({ id: categoryId, userId });
    
    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found'
      });
      return;
    }

    if (category.isFolder) {
      res.status(400).json({
        success: false,
        message: 'Cannot assign expense to a folder. Please select a category.'
      });
      return;
    }

    const expensesContainer = await cosmosDBService.getExpensesContainer();

    const newExpense: Expense = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      categoryId,
      amount: parseFloat(amount),
      description,
      date: date ? new Date(date) : new Date(),
      isRecurring: isRecurring || false,
      recurrencePattern: recurrencePattern || undefined,
      tags: tags || [],
      notes: notes || '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await expensesContainer.insertOne(newExpense);

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      expense: newExpense
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating expense'
    });
  }
});

// PUT /api/expenses/:id - Update expense
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const {
      categoryId,
      amount,
      description,
      date,
      isRecurring,
      recurrencePattern,
      tags,
      notes,
      reviewStatus
    } = req.body;

    const expensesContainer = await cosmosDBService.getExpensesContainer();
    
    const expense = await expensesContainer.findOne({ id, userId }) as Expense | null;
    if (!expense) {
      res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
      return;
    }

    // If category is being updated, validate it
    if (categoryId) {
      const categoriesContainer = await cosmosDBService.getCategoriesContainer();
      const category = await categoriesContainer.findOne({ id: categoryId, userId });
      
      if (!category) {
        res.status(404).json({
          success: false,
          message: 'Category not found'
        });
        return;
      }

      if (category.isFolder) {
        res.status(400).json({
          success: false,
          message: 'Cannot assign expense to a folder. Please select a category.'
        });
        return;
      }
    }

    const updateData: any = {
      updatedAt: new Date()
    };

    if (categoryId) updateData.categoryId = categoryId;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (description) updateData.description = description;
    if (date) updateData.date = new Date(date);
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring;
    if (recurrencePattern) updateData.recurrencePattern = recurrencePattern;
    if (tags) updateData.tags = tags;
    if (notes !== undefined) updateData.notes = notes;
    if (reviewStatus !== undefined) updateData.reviewStatus = reviewStatus;

    await expensesContainer.updateOne(
      { id, userId },
      { $set: updateData }
    );

    const updatedExpense = await expensesContainer.findOne({ id, userId });

    res.json({
      success: true,
      message: 'Expense updated successfully',
      expense: updatedExpense
    });
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating expense'
    });
  }
});

// DELETE /api/expenses/:id - Delete expense
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const expensesContainer = await cosmosDBService.getExpensesContainer();
    
    const expense = await expensesContainer.findOne({ id, userId }) as Expense | null;
    if (!expense) {
      res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
      return;
    }

    await expensesContainer.deleteOne({ id, userId });

    res.json({
      success: true,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting expense'
    });
  }
});

export default router;
