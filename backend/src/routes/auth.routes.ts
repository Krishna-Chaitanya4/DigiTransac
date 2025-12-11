import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cosmosDBService } from '../config/cosmosdb';
import { User } from '../models/types';

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
router.post('/register', async (req: Request<{}, {}, RegisterBody>, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, currency } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !currency) {
      res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
      return;
    }

    // Validate password length
    if (password.length < 6) {
      res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 6 characters' 
      });
      return;
    }

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
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error registering user' 
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request<{}, {}, LoginBody>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
      return;
    }

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
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error logging in' 
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (_req, res) => {
  // TODO: Implement token refresh
  res.json({ message: 'Refresh endpoint' });
});

export default router;
