import { Router } from 'express';

const router = Router();

// POST /api/auth/register
router.post('/register', async (_req, res) => {
  // TODO: Implement registration
  res.json({ message: 'Register endpoint' });
});

// POST /api/auth/login
router.post('/login', async (_req, res) => {
  // TODO: Implement login
  res.json({ message: 'Login endpoint' });
});

// POST /api/auth/refresh
router.post('/refresh', async (_req, res) => {
  // TODO: Implement token refresh
  res.json({ message: 'Refresh endpoint' });
});

export default router;
