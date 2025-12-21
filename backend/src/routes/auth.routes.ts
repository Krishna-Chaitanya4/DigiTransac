import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cosmosDBService } from '../config/cosmosdb';
import { User } from '../models/types';
import { validate, schemas } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

interface RegisterBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  currency: string;
}

interface LoginBody {
  email: string;
  password: string;
}

// POST /api/auth/register
router.post('/register', validate(schemas.register), async (req: Request<Record<string, never>, Record<string, never>, RegisterBody>, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, currency } = req.body;

    const usersContainer = await cosmosDBService.getUsersContainer();

    // Check if user already exists
    const existingUser = await usersContainer.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      res.status(409).json({ 
        success: false, 
        message: 'User with this email already exists' 
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user object
    const newUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      currency,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to database
    await usersContainer.insertOne(newUser);

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      (process.env.JWT_SECRET as jwt.Secret),
      { expiresIn: process.env.JWT_EXPIRE || '7d' } as jwt.SignOptions
    );

    // Return user without password
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = newUser;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    logger.error({ error }, 'Registration error');
    res.status(500).json({ 
      success: false, 
      message: 'Error registering user' 
    });
  }
});

// POST /api/auth/login
router.post('/login', validate(schemas.login), async (req: Request<Record<string, never>, Record<string, never>, LoginBody>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const usersContainer = await cosmosDBService.getUsersContainer();

    // Find user by email
    const user = await usersContainer.findOne({ email: email.toLowerCase() }) as User | null;

    if (!user) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      (process.env.JWT_SECRET as jwt.Secret),
      { expiresIn: process.env.JWT_EXPIRE || '7d' } as jwt.SignOptions
    );

    // Return user without password
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = user;

    logger.info(`User logged in successfully: ${user.email}`);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    logger.error({ error }, 'Login error');
    res.status(500).json({ 
      success: false, 
      message: 'Error logging in' 
    });
  }
});

// POST /api/auth/refresh - Generate new JWT token
router.post('/refresh', authenticate, async (req: any, res: Response): Promise<void> => {
  try {
    // User is already authenticated via middleware
    const userId = req.userId;
    const email = req.user?.email;

    // Generate new JWT token
    const token = jwt.sign(
      { userId, email },
      (process.env.JWT_SECRET as jwt.Secret),
      { expiresIn: process.env.JWT_EXPIRE || '7d' } as jwt.SignOptions
    );

    logger.info(`Token refreshed for user: ${email}`);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      token
    });
  } catch (error) {
    logger.error({ error }, 'Token refresh error');
    res.status(500).json({ 
      success: false, 
      message: 'Error refreshing token' 
    });
  }
});

export default router;
