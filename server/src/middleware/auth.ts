import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

// Simple API key authentication middleware
export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;

  // Skip auth in development if no API key is set and skip is enabled
  if (config.env.isDevelopment && config.auth.skipInDevelopment && !config.auth.apiKey) {
    return next();
  }

  if (!apiKey || apiKey !== config.auth.apiKey) {
    return res.status(401).json({ error: 'Unauthorized - Invalid API key' });
  }

  next();
};

// JWT authentication middleware
export const jwtAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // Skip auth in development if no JWT secret is set and skip is enabled
  if (config.env.isDevelopment && config.auth.skipInDevelopment && !config.auth.jwt.secret) {
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }

  try {
    const decoded = jwt.verify(token, config.auth.jwt.secret) as { id: string; email?: string };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden - Invalid token' });
  }
};

// Optional auth middleware (allows both authenticated and unauthenticated access)
export const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token && config.auth.jwt.secret) {
    try {
      const decoded = jwt.verify(token, config.auth.jwt.secret) as { id: string; email?: string };
      req.user = decoded;
    } catch (error) {
      // Invalid token, but we continue anyway
    }
  }

  next();
};

// Generate JWT token
export const generateToken = (userId: string, email?: string): string => {
  return jwt.sign(
    { id: userId, email },
    config.auth.jwt.secret,
    // Type assertion needed: jwt library's SignOptions type is overly strict
    // expiresIn accepts string values like '7d' but TypeScript infers our config value too narrowly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expiresIn: config.auth.jwt.expiresIn as any }
  );
};
