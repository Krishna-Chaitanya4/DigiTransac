import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/users/profile
router.get(
  '/profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    logger.info({ userId }, 'Profile accessed');
    ApiResponse.success(res, { message: 'Get user profile' });
  })
);

// PUT /api/users/profile
router.put(
  '/profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    logger.info({ userId }, 'Profile updated');
    ApiResponse.success(res, { message: 'Update user profile' });
  })
);

// DELETE /api/users/profile - Delete account
router.delete(
  '/profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;
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

    logger.info({ userId }, 'Account deleted');
    ApiResponse.success(res, { message: 'Account deleted successfully' });
  })
);

export default router;
