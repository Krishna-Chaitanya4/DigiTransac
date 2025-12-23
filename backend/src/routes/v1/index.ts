import { Router } from 'express';
import authRoutes from '../auth.routes';
import userRoutes from '../user.routes';
import categoryRoutes from '../category.routes';
import budgetRoutes from '../budget.routes';
import analyticsRoutes from '../analytics.routes';
import emailRoutes from '../email.routes';
import gmailRoutes from '../gmail.routes';
import accountRoutes from '../account.routes';
import tagRoutes from '../tag.routes';
import transactionRoutes from '../transaction.routes';
import smsRoutes from '../sms.routes';
import { authLimiter } from '../../middleware/rateLimiter';

/**
 * API v1 Routes
 * All v1 API endpoints are grouped here for versioning
 */
const router = Router();

// Mount all v1 routes
router.use('/auth', authLimiter, authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/budgets', budgetRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/email', emailRoutes);
router.use('/gmail', gmailRoutes);
router.use('/accounts', accountRoutes);
router.use('/tags', tagRoutes);
router.use('/transactions', transactionRoutes);
router.use('/sms', smsRoutes);

export default router;
