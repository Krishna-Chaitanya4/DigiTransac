import { Router } from 'express';

const router = Router();

// Public endpoint - no auth required
// Returns frontend configuration from environment variables
router.get('/config', (req, res) => {
  res.json({
    apiUrl: process.env.API_URL || req.protocol + '://' + req.get('host'),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0'
  });
});

export default router;
