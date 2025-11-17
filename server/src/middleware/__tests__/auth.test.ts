import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { apiKeyAuth, jwtAuth, optionalAuth, generateToken, AuthRequest } from '../auth';

// Mock the config module
vi.mock('../../config', () => ({
  config: {
    env: {
      isDevelopment: false,
    },
    auth: {
      apiKey: 'test-api-key',
      skipInDevelopment: false,
      jwt: {
        secret: 'test-jwt-secret',
        expiresIn: '1h',
      },
    },
  },
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: Mock;
  let statusMock: Mock;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      headers: {},
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = vi.fn();

    // Reset config to default test values
    const { config } = require('../../config');
    config.env.isDevelopment = false;
    config.auth.skipInDevelopment = false;
    config.auth.apiKey = 'test-api-key';
    config.auth.jwt.secret = 'test-jwt-secret';
  });

  describe('apiKeyAuth', () => {
    it('should allow request with valid API key', () => {
      mockReq.headers = { 'x-api-key': 'test-api-key' };

      apiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should reject request with invalid API key', () => {
      mockReq.headers = { 'x-api-key': 'wrong-key' };

      apiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized - Invalid API key' });
    });

    it('should reject request without API key', () => {
      mockReq.headers = {};

      apiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized - Invalid API key' });
    });

    it('should skip auth in development when skipInDevelopment is true and no API key configured', () => {
      const { config } = require('../../config');
      config.env.isDevelopment = true;
      config.auth.skipInDevelopment = true;
      config.auth.apiKey = undefined;

      mockReq.headers = {};

      apiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should still validate API key in development if skipInDevelopment is false', () => {
      const { config } = require('../../config');
      config.env.isDevelopment = true;
      config.auth.skipInDevelopment = false;

      mockReq.headers = {};

      apiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
    });
  });

  describe('jwtAuth', () => {
    it('should allow request with valid JWT token', () => {
      const token = jwt.sign({ id: 'user123', email: 'test@example.com' }, 'test-jwt-secret');
      mockReq.headers = { authorization: `Bearer ${token}` };

      jwtAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
      expect(mockReq.user).toMatchObject({ id: 'user123', email: 'test@example.com' });
    });

    it('should allow request with valid JWT token without email', () => {
      const token = jwt.sign({ id: 'user123' }, 'test-jwt-secret');
      mockReq.headers = { authorization: `Bearer ${token}` };

      jwtAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toMatchObject({ id: 'user123' });
    });

    it('should reject request with invalid JWT token', () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      jwtAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Forbidden - Invalid token' });
    });

    it('should reject request without token', () => {
      mockReq.headers = {};

      jwtAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized - No token provided' });
    });

    it('should reject request with malformed authorization header', () => {
      mockReq.headers = { authorization: 'InvalidFormat' };

      jwtAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should reject request with expired JWT token', () => {
      const expiredToken = jwt.sign(
        { id: 'user123', email: 'test@example.com' },
        'test-jwt-secret',
        { expiresIn: '-1h' }
      );
      mockReq.headers = { authorization: `Bearer ${expiredToken}` };

      jwtAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Forbidden - Invalid token' });
    });

    it('should skip auth in development when skipInDevelopment is true and no JWT secret configured', () => {
      const { config } = require('../../config');
      config.env.isDevelopment = true;
      config.auth.skipInDevelopment = true;
      config.auth.jwt.secret = undefined;

      mockReq.headers = {};

      jwtAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should attach user to request when valid token provided', () => {
      const token = jwt.sign({ id: 'user123', email: 'test@example.com' }, 'test-jwt-secret');
      mockReq.headers = { authorization: `Bearer ${token}` };

      optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toMatchObject({ id: 'user123', email: 'test@example.com' });
    });

    it('should continue without user when no token provided', () => {
      mockReq.headers = {};

      optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should continue without user when invalid token provided', () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should continue without user when token secret is not configured', () => {
      const { config } = require('../../config');
      config.auth.jwt.secret = undefined;

      const token = jwt.sign({ id: 'user123' }, 'some-secret');
      mockReq.headers = { authorization: `Bearer ${token}` };

      optionalAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token with user ID and email', () => {
      const token = generateToken('user123', 'test@example.com');

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, 'test-jwt-secret') as any;
      expect(decoded.id).toBe('user123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.exp).toBeTruthy();
    });

    it('should generate valid JWT token with only user ID', () => {
      const token = generateToken('user123');

      expect(token).toBeTruthy();

      const decoded = jwt.verify(token, 'test-jwt-secret') as any;
      expect(decoded.id).toBe('user123');
      expect(decoded.email).toBeUndefined();
    });

    it('should generate token that expires according to config', () => {
      const { config } = require('../../config');
      config.auth.jwt.expiresIn = '2h';

      const token = generateToken('user123');
      const decoded = jwt.verify(token, 'test-jwt-secret') as any;

      const now = Math.floor(Date.now() / 1000);
      const expectedExpiration = now + 2 * 60 * 60; // 2 hours from now

      // Allow 5 second tolerance
      expect(decoded.exp).toBeGreaterThan(now);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExpiration + 5);
    });
  });
});
