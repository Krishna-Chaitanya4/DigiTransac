import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cosmosDBService } from '../config/cosmosdb';
import { keyVaultService } from '../config/keyVault';
import { User } from '../models/types';
import { validate, schemas } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Cache JWT secret for performance
let jwtSecretCache: string | null = null;

async function getJWTSecret(): Promise<string> {
  if (!jwtSecretCache) {
    jwtSecretCache = await keyVaultService.getSecret('JWT-Secret');
  }
  return jwtSecretCache;
}

interface RegisterBody {
  email?: string;
  phone?: string;
  username: string;
  password: string;
  fullName: string;
  dateOfBirth?: string;
  currency: string;
}

interface LoginBody {
  identifier: string; // email, phone, or username
  password: string;
}

// POST /api/auth/register
router.post(
  '/register',
  validate(schemas.register),
  async (
    req: Request<Record<string, never>, Record<string, never>, RegisterBody>,
    res: Response
  ): Promise<void> => {
    try {
      const { email, phone, username, password, fullName, dateOfBirth, currency } = req.body;

      const usersContainer = await cosmosDBService.getUsersContainer();

      // Check if username already exists
      const existingUsername = await usersContainer.findOne({ username: username.toLowerCase() });
      if (existingUsername) {
        res.status(409).json({
          success: false,
          message: 'Username already taken',
        });
        return;
      }

      // Check if email already exists (if provided)
      if (email) {
        const existingEmail = await usersContainer.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
          res.status(409).json({
            success: false,
            message: 'Email already registered',
          });
          return;
        }
      }

      // Check if phone already exists (if provided)
      if (phone) {
        const existingPhone = await usersContainer.findOne({ phone });
        if (existingPhone) {
          res.status(409).json({
            success: false,
            message: 'Phone number already registered',
          });
          return;
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user object
      const newUser: User = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: email ? email.toLowerCase() : undefined,
        phone: phone || undefined,
        username: username.toLowerCase(),
        password: hashedPassword,
        fullName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        currency,
        emailVerified: false,
        phoneVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to database
      await usersContainer.insertOne(newUser);

      // Generate JWT token with secret from Key Vault
      const jwtSecret = await getJWTSecret();
      const token = jwt.sign(
        { userId: newUser.id, username: newUser.username },
        jwtSecret,
        { expiresIn: process.env.JWT_EXPIRE || '7d' } as jwt.SignOptions
      );

      // Return user without password
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...userWithoutPassword } = newUser;

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        token,
        user: userWithoutPassword,
      });
    } catch (error) {
      logger.error({ error }, 'Registration error');
      res.status(500).json({
        success: false,
        message: 'Error registering user',
      });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  validate(schemas.login),
  async (
    req: Request<Record<string, never>, Record<string, never>, LoginBody>,
    res: Response
  ): Promise<void> => {
    try {
      const { identifier, password } = req.body;

      const usersContainer = await cosmosDBService.getUsersContainer();

      // Find user by email, phone, or username
      const user = (await usersContainer.findOne({
        $or: [
          { email: identifier.toLowerCase() },
          { phone: identifier },
          { username: identifier.toLowerCase() },
        ],
      })) as User | null;

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
        return;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
        return;
      }

      // Generate JWT token with secret from Key Vault
      const jwtSecret = await getJWTSecret();
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        jwtSecret,
        { expiresIn: process.env.JWT_EXPIRE || '7d' } as jwt.SignOptions
      );

      // Return user without password
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...userWithoutPassword } = user;

      logger.info(`User logged in successfully: ${user.username}`);

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: userWithoutPassword,
      });
    } catch (error) {
      logger.error({ error }, 'Login error');
      res.status(500).json({
        success: false,
        message: 'Error logging in',
      });
    }
  }
);

// POST /api/auth/refresh - Generate new JWT token
router.post('/refresh', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    // User is already authenticated via middleware
    const userId = req.userId;
    const email = req.user?.email;

    // Generate new JWT token with secret from Key Vault
    const jwtSecret = await getJWTSecret();
    const token = jwt.sign(
      { userId, email },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRE || '7d' } as jwt.SignOptions
    );

    logger.info(`Token refreshed for user: ${email}`);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      token,
    });
  } catch (error) {
    logger.error({ error }, 'Token refresh error');
    res.status(500).json({
      success: false,
      message: 'Error refreshing token',
    });
  }
});

export default router;
