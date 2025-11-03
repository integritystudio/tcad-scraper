import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

// Simple API key authentication middleware
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedApiKey = process.env.API_KEY;

  // Skip auth in development if no API key is set
  if (process.env.NODE_ENV === 'development' && !expectedApiKey) {
    return next();
  }

  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({ error: 'Unauthorized - Invalid API key' });
  }

  next();
};

// JWT authentication middleware
export const jwtAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // Skip auth in development if no JWT secret is set
  if (process.env.NODE_ENV === 'development' && !process.env.JWT_SECRET) {
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    const decoded = jwt.verify(token, jwtSecret) as { id: string; email?: string };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden - Invalid token' });
  }
};

// Optional auth middleware (allows both authenticated and unauthenticated access)
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token && process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as { id: string; email?: string };
      req.user = decoded;
    } catch (error) {
      // Invalid token, but we continue anyway
    }
  }

  next();
};

// Generate JWT token
export const generateToken = (userId: string, email?: string): string => {
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign({ id: userId, email }, jwtSecret, { expiresIn });
};
