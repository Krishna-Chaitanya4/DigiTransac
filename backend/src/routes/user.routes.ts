import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
  };
}

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

// DELETE /api/users/profile - Delete account
router.delete('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const db = req.app.locals.db;

    // Delete all user data
    await Promise.all([
      db.collection('users').deleteOne({ _id: userId }),
      db.collection('transactions').deleteMany({ userId }),
      db.collection('budgets').deleteMany({ userId }),
      db.collection('categories').deleteMany({ userId }),
      db.collection('accounts').deleteMany({ userId }),
      db.collection('tags').deleteMany({ userId }),
    ]);

    return res.json({ message: 'Account deleted successfully' });
  } catch (error: any) {
    console.error('Delete account error:', error);
    return res.status(500).json({ message: 'Failed to delete account' });
  }
});

export default router;
