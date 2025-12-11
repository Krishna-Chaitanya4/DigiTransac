import { Router } from 'express';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/users/profile
router.get('/profile', async (_req, res) => {
  res.json({ message: 'Get user profile' });
});

// PUT /api/users/profile
router.put('/profile', async (_req, res) => {
  res.json({ message: 'Update user profile' });
});

export default router;
