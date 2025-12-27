import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import { keyVaultService } from '../config/keyVault';

export interface AuthRequest extends Request {
  userId?: string;
}

interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

// Cache JWT secret for performance
let jwtSecretCache: string | null = null;

export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication token required', 401);
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      throw new AppError('Authentication token required', 401);
    }

    // Get JWT secret from Key Vault (cached)
    if (!jwtSecretCache) {
      jwtSecretCache = await keyVaultService.getSecret('JWT-Secret');
    }

    const decoded = jwt.verify(token, jwtSecretCache) as JWTPayload;

    // Attach userId to request
    req.userId = decoded.userId;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token expired', 401));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token', 401));
    } else {
      next(error);
    }
  }
};
