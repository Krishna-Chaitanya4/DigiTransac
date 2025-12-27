import { Router } from 'express';

const router = Router();

// Public endpoint - no auth required
// Returns frontend configuration from environment variables
router.get('/', (req, res) => {
  // Dynamically determine API URL based on request host
  const requestHost = req.get('host') || 'localhost:5000';
  const apiUrl = process.env.API_URL || `${req.protocol}://${requestHost}`;

  console.log('🔍 Config request:', {
    host: req.get('host'),
    protocol: req.protocol,
    envApiUrl: process.env.API_URL,
    computedApiUrl: apiUrl,
  });

  res.json({
    apiUrl: apiUrl,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
  });
});

export default router;
