import express, { Request, Response } from 'express';
import { google } from 'googleapis';
import { authenticate, AuthRequest } from '../middleware/auth';
import { cosmosDBService } from '../config/cosmosdb';

const router = express.Router();

// Gmail OAuth2 Client
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    `${process.env.BACKEND_URL}/api/gmail/callback`
  );
};

/**
 * Step 1: Generate OAuth URL
 */
router.get('/connect', authenticate, (req: AuthRequest, res: Response) => {
  const oauth2Client = getOAuth2Client();
  
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: req.userId, // Pass userId in state for callback
    prompt: 'consent', // Force consent screen to get refresh token
  });

  res.json({ authUrl });
});

/**
 * Step 2: OAuth Callback - Exchange code for tokens
 */
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
      res.status(400).send('Missing authorization code or user ID');
      return;
    }

    const oauth2Client = getOAuth2Client();
    
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    // Get user's email address
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    // Save tokens to database
    const userContainer = await cosmosDBService.getUsersContainer();
    await userContainer.updateOne(
      { id: userId },
      {
        $set: {
          emailIntegration: {
            enabled: true,
            provider: 'gmail',
            email: data.email,
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token!,
            tokenExpiry: new Date(tokens.expiry_date!),
            lastProcessedAt: null,
            lastProcessedEmailId: null,
            totalEmailsProcessed: 0,
            merchantMappings: [],
            customBankPatterns: [],
          },
        },
      }
    );

    // Redirect to frontend success page
    res.redirect(`${process.env.FRONTEND_URL}/profile?gmail=connected`);
  } catch (error: any) {
    console.error('Gmail OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/profile?gmail=error`);
  }
});

/**
 * Disconnect Gmail Integration
 */
router.post('/disconnect', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const userContainer = await cosmosDBService.getUsersContainer();
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
router.get('/status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const userContainer = await cosmosDBService.getUsersContainer();
    const user = await userContainer.findOne({ id: userId });

    if (!user || !user.emailIntegration) {
      res.json({ connected: false });
      return;
    }

    res.json({
      connected: user.emailIntegration.enabled,
      email: user.emailIntegration.email,
      provider: user.emailIntegration.provider,
      totalEmailsProcessed: user.emailIntegration.totalEmailsProcessed,
      lastProcessedAt: user.emailIntegration.lastProcessedAt,
    });
  } catch (error: any) {
    console.error('Error getting Gmail status:', error);
    res.status(500).json({ message: error.message || 'Failed to get status' });
  }
});

export default router;
