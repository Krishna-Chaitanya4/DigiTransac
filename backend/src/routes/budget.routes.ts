import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/budgets - Get all budgets
router.get('/', async (_req, res) => {
  res.json({ message: 'Get all budgets' });
});

// POST /api/budgets - Create budget
router.post('/', async (_req, res) => {
  res.json({ message: 'Create budget' });
});

// PUT /api/budgets/:id - Update budget
router.put('/:id', async (_req, res) => {
  res.json({ message: 'Update budget' });
});

// DELETE /api/budgets/:id - Delete budget
router.delete('/:id', async (_req, res) => {
  res.json({ message: 'Delete budget' });
});

// GET /api/budgets/alerts - Get budget alerts
router.get('/alerts', async (_req, res) => {
  res.json({ message: 'Get budget alerts' });
});

export default router;
