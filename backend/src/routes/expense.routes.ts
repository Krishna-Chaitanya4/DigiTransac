import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/expenses - Get all expenses with filters
router.get('/', async (_req, res) => {
  res.json({ message: 'Get all expenses' });
});

// GET /api/expenses/:id - Get single expense
router.get('/:id', async (_req, res) => {
  res.json({ message: 'Get expense by id' });
});

// POST /api/expenses - Create expense
router.post('/', async (_req, res) => {
  res.json({ message: 'Create expense' });
});

// PUT /api/expenses/:id - Update expense
router.put('/:id', async (_req, res) => {
  res.json({ message: 'Update expense' });
});

// DELETE /api/expenses/:id - Delete expense
router.delete('/:id', async (_req, res) => {
  res.json({ message: 'Delete expense' });
});

// GET /api/expenses/recurring/upcoming - Get upcoming recurring expenses
router.get('/recurring/upcoming', async (_req, res) => {
  res.json({ message: 'Get upcoming recurring expenses' });
});

export default router;
