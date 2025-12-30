import express, { Request, Response } from 'express';
import { google } from 'googleapis';
import { authenticate, AuthRequest } from '../middleware/auth';
import { mongoDBService } from '../config/mongodb';
import { encryptionService } from '../services/encryption.service';
import { oauthLimiter } from '../middleware/rateLimiter';
import crypto from 'crypto';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/apiResponse';
import { logger } from '../utils/logger';

const router = express.Router();

// Gmail OAuth2 Client
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    `${process.env.BACKEND_URL}/api/gmail/callback`
  );
};

// Store for CSRF tokens (in production, use Redis)
const csrfTokens = new Map<string, { userId: string; timestamp: number }>();

// Clean up expired tokens every 15 minutes
setInterval(
  () => {
    const now = Date.now();
    const expired = Array.from(csrfTokens.entries()).filter(
      ([_, data]) => now - data.timestamp > 15 * 60 * 1000
    );
    expired.forEach(([token]) => csrfTokens.delete(token));
  },
  15 * 60 * 1000
);

/**
 * Step 1: Generate OAuth URL with CSRF token
 */
router.get('/connect', authenticate, oauthLimiter, (req: AuthRequest, res: Response) => {
  const oauth2Client = getOAuth2Client();

  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  // Generate CSRF token
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const state = `${req.userId}:${csrfToken}`;

  // Store CSRF token
  csrfTokens.set(csrfToken, {
    userId: req.userId!,
    timestamp: Date.now(),
  });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state, // Pass userId:csrfToken in state for CSRF protection
    prompt: 'consent', // Force consent screen to get refresh token
  });

  res.json({ authUrl });
});

/**
 * Step 2: OAuth Callback - Exchange code for tokens with CSRF validation
 */
router.get('/callback', oauthLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      logger.warn('Gmail callback missing code or state');
      res.status(400).send('Missing authorization code or state parameter');
      return;
    }

    // Parse state (userId:csrfToken)
    const [userId, csrfToken] = (state as string).split(':');

    if (!userId || !csrfToken) {
      logger.warn('Gmail callback invalid state parameter');
      res.status(400).send('Invalid state parameter');
      return;
    }

    // Validate CSRF token
    const storedData = csrfTokens.get(csrfToken);
    if (!storedData || storedData.userId !== userId) {
      logger.warn({ userId, csrfToken }, 'Gmail callback CSRF validation failed');
      res.status(403).send('CSRF token validation failed');
      return;
    }

    // Check token age (15 minutes max)
    if (Date.now() - storedData.timestamp > 15 * 60 * 1000) {
      csrfTokens.delete(csrfToken);
      logger.warn({ userId }, 'Gmail callback CSRF token expired');
      res.status(403).send('CSRF token expired');
      return;
    }

    // Delete token after use (one-time use)
    csrfTokens.delete(csrfToken);

    const oauth2Client = getOAuth2Client();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    // Get user's email address
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    // Encrypt sensitive tokens before storing
    const encryptedAccessToken = encryptionService.encrypt(tokens.access_token!);
    const encryptedRefreshToken = encryptionService.encrypt(tokens.refresh_token!);

    // Save encrypted tokens to database
    const userContainer = await mongoDBService.getUsersContainer();
    await userContainer.updateOne(
      { id: userId },
      {
        $set: {
          emailIntegration: {
            enabled: true,
            provider: 'gmail',
            email: data.email,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            tokenExpiry: new Date(tokens.expiry_date!),
            lastProcessedAt: null,
            lastProcessedEmailId: null,
            totalEmailsProcessed: 0,
            customBankPatterns: [],
          },
        },
      }
    );

    logger.info({ userId, email: data.email }, 'Gmail integration connected successfully');

    // Close popup window with success message
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gmail Connected</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%);
            }
            .container {
              text-align: center;
              color: white;
            }
            .icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              margin: 0;
              font-size: 24px;
            }
            p {
              margin: 10px 0;
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✓</div>
            <h1>Gmail Connected Successfully!</h1>
            <p>This window will close automatically...</p>
          </div>
          <script>
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('Gmail OAuth callback error:', error);
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            }
            .container {
              text-align: center;
              color: white;
            }
            .icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              margin: 0;
              font-size: 24px;
            }
            p {
              margin: 10px 0;
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">✗</div>
            <h1>Connection Failed</h1>
            <p>Please try again...</p>
          </div>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `);
  }
});

/**
 * Disconnect Gmail Integration
 */
router.post('/disconnect', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const userContainer = await mongoDBService.getUsersContainer();
    await userContainer.updateOne(
      { id: userId },
      {
        $set: {
          'emailIntegration.enabled': false,
          'emailIntegration.accessToken': '',
          'emailIntegration.refreshToken': '',
        },
      }
    );

    res.json({ message: 'Gmail disconnected successfully' });
  } catch (error: any) {
    console.error('Error disconnecting Gmail:', error);
    res.status(500).json({ message: error.message || 'Failed to disconnect Gmail' });
  }
});

/**
 * Get Gmail Integration Status
 */
router.get(
  '/status',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;

    const userContainer = await mongoDBService.getUsersContainer();
    const user = await userContainer.findOne({ id: userId });

    if (!user || !user.emailIntegration) {
      return ApiResponse.success(res, { connected: false });
    }

    logger.info({ userId, connected: user.emailIntegration.enabled }, 'Gmail status checked');
    ApiResponse.success(res, {
      connected: user.emailIntegration.enabled,
      email: user.emailIntegration.email,
      provider: user.emailIntegration.provider,
      totalEmailsProcessed: user.emailIntegration.totalEmailsProcessed,
      lastProcessedAt: user.emailIntegration.lastProcessedAt,
    });
  })
);

export default router;
