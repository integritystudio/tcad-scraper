/**
 * XController Middleware Tests
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import {
  generateNonce,
  encodeJsonForHtml,
  nonceMiddleware,
  cspMiddleware,
  generateSecureHtml,
  getInitialAppData,
} from '../xcontroller.middleware';

describe('XController Middleware', () => {
  describe('generateNonce', () => {
    test('should generate a base64 string', () => {
      const nonce = generateNonce();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(16);
    });

    test('should generate unique nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      expect(nonce1).not.toBe(nonce2);
    });

    test('should be cryptographically secure (16 bytes = 24 base64 chars)', () => {
      const nonce = generateNonce();
      // 16 bytes in base64 = 24 characters (rounded up)
      expect(nonce.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe('encodeJsonForHtml', () => {
    test('should encode dangerous < character', () => {
      const data = { html: '<script>alert("xss")</script>' };
      const encoded = encodeJsonForHtml(data);
      expect(encoded).not.toContain('<script>');
      expect(encoded).toContain('\\u003C');
    });

    test('should encode dangerous > character', () => {
      const data = { html: '<div>' };
      const encoded = encodeJsonForHtml(data);
      expect(encoded).not.toContain('>');
      expect(encoded).toContain('\\u003E');
    });

    test('should encode dangerous & character', () => {
      const data = { html: 'foo & bar' };
      const encoded = encodeJsonForHtml(data);
      expect(encoded).not.toContain('&');
      expect(encoded).toContain('\\u0026');
    });

    test('should prevent script injection', () => {
      const malicious = {
        payload: '</script><script>alert("xss")</script>',
      };
      const encoded = encodeJsonForHtml(malicious);
      expect(encoded).not.toContain('</script>');
      expect(encoded).not.toContain('<script>');
    });

    test('should handle unicode line separators', () => {
      const data = { text: 'line\u2028separator' };
      const encoded = encodeJsonForHtml(data);
      expect(encoded).toContain('\\u2028');
    });

    test('should be valid JSON after encoding', () => {
      const data = { test: 'value', number: 123 };
      const encoded = encodeJsonForHtml(data);
      const decoded = JSON.parse(encoded);
      expect(decoded).toEqual(data);
    });
  });

  describe('nonceMiddleware', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
      req = {};
      res = {
        locals: {},
      };
      next = jest.fn();
    });

    test('should add nonce to res.locals', () => {
      nonceMiddleware(req as Request, res as Response, next);
      expect(res.locals?.nonce).toBeDefined();
      expect(typeof res.locals?.nonce).toBe('string');
    });

    test('should call next()', () => {
      nonceMiddleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });

    test('should generate different nonces for different requests', () => {
      const res1: Partial<Response> = { locals: {} };
      const res2: Partial<Response> = { locals: {} };

      nonceMiddleware(req as Request, res1 as Response, next);
      nonceMiddleware(req as Request, res2 as Response, next);

      expect(res1.locals?.nonce).not.toBe(res2.locals?.nonce);
    });
  });

  describe('cspMiddleware', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
      req = {
        protocol: 'http',
      };
      res = {
        locals: { nonce: 'test-nonce-12345' },
        setHeader: jest.fn(),
      };
      next = jest.fn();
      process.env.NODE_ENV = 'development';
    });

    test('should set Content-Security-Policy header with nonce', () => {
      cspMiddleware(req as Request, res as Response, next);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("'nonce-test-nonce-12345'")
      );
    });

    test('should set X-Content-Type-Options header', () => {
      cspMiddleware(req as Request, res as Response, next);
      expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    });

    test('should set X-Frame-Options header', () => {
      cspMiddleware(req as Request, res as Response, next);
      expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    });

    test('should set X-XSS-Protection header', () => {
      cspMiddleware(req as Request, res as Response, next);
      expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    });

    test('should set Referrer-Policy header', () => {
      cspMiddleware(req as Request, res as Response, next);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin'
      );
    });

    test('should include default-src directive', () => {
      cspMiddleware(req as Request, res as Response, next);
      const cspCall = (res.setHeader as jest.Mock).mock.calls.find(
        call => call[0] === 'Content-Security-Policy'
      );
      expect(cspCall[1]).toContain("default-src 'self'");
    });

    test('should include script-src with nonce', () => {
      cspMiddleware(req as Request, res as Response, next);
      const cspCall = (res.setHeader as jest.Mock).mock.calls.find(
        call => call[0] === 'Content-Security-Policy'
      );
      expect(cspCall[1]).toContain("script-src 'self' 'nonce-test-nonce-12345'");
    });

    test('should set HSTS in production with HTTPS', () => {
      process.env.NODE_ENV = 'production';
      req.protocol = 'https';
      cspMiddleware(req as Request, res as Response, next);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    });

    test('should not set HSTS in development', () => {
      process.env.NODE_ENV = 'development';
      cspMiddleware(req as Request, res as Response, next);
      expect(res.setHeader).not.toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.anything()
      );
    });

    test('should not set HSTS with HTTP in production', () => {
      process.env.NODE_ENV = 'production';
      req.protocol = 'http';
      cspMiddleware(req as Request, res as Response, next);
      expect(res.setHeader).not.toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.anything()
      );
    });

    test('should call next()', () => {
      cspMiddleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('generateSecureHtml', () => {
    test('should generate valid HTML', () => {
      const html = generateSecureHtml({
        title: 'Test App',
        nonce: 'test-nonce',
        scriptSrc: '/app.js',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Test App</title>');
      expect(html).toContain('<div id="root"></div>');
    });

    test('should include nonce in script tag', () => {
      const html = generateSecureHtml({
        title: 'Test App',
        nonce: 'test-nonce-123',
        scriptSrc: '/app.js',
      });

      expect(html).toContain('nonce="test-nonce-123"');
    });

    test('should embed initial data when provided', () => {
      const html = generateSecureHtml({
        title: 'Test App',
        nonce: 'test-nonce',
        initialData: { test: 'value' },
        scriptSrc: '/app.js',
      });

      expect(html).toContain('type="application/json"');
      expect(html).toContain('id="initial-data"');
      expect(html).toContain('"test"');
    });

    test('should properly encode initial data', () => {
      const html = generateSecureHtml({
        title: 'Test App',
        nonce: 'test-nonce',
        initialData: { html: '<script>alert("xss")</script>' },
        scriptSrc: '/app.js',
      });

      expect(html).not.toContain('<script>alert');
      expect(html).toContain('\\u003Cscript\\u003E');
    });

    test('should include style link when provided', () => {
      const html = generateSecureHtml({
        title: 'Test App',
        nonce: 'test-nonce',
        scriptSrc: '/app.js',
        styleSrc: '/app.css',
      });

      expect(html).toContain('<link rel="stylesheet" href="/app.css"');
    });

    test('should not include data script when no initial data', () => {
      const html = generateSecureHtml({
        title: 'Test App',
        nonce: 'test-nonce',
        scriptSrc: '/app.js',
      });

      expect(html).not.toContain('id="initial-data"');
    });
  });

  describe('getInitialAppData', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should return valid initial data structure', () => {
      const data = getInitialAppData();

      expect(data).toHaveProperty('apiUrl');
      expect(data).toHaveProperty('environment');
      expect(data).toHaveProperty('features');
      expect(data).toHaveProperty('version');
    });

    test('should use environment variables when available', () => {
      process.env.API_URL = 'https://api.example.com';
      process.env.NODE_ENV = 'production';
      process.env.APP_VERSION = '2.0.0';

      const data = getInitialAppData();

      expect(data.apiUrl).toBe('https://api.example.com');
      expect(data.environment).toBe('production');
      expect(data.version).toBe('2.0.0');
    });

    test('should use defaults when environment variables are missing', () => {
      delete process.env.API_URL;
      delete process.env.NODE_ENV;
      delete process.env.APP_VERSION;

      const data = getInitialAppData();

      expect(data.apiUrl).toBe('/api');
      expect(data.environment).toBe('development');
      expect(data.version).toBe('1.0.0');
    });

    test('should enable analytics in production', () => {
      process.env.NODE_ENV = 'production';
      const data = getInitialAppData();
      expect(data.features.analytics).toBe(true);
    });

    test('should disable analytics in development', () => {
      process.env.NODE_ENV = 'development';
      const data = getInitialAppData();
      expect(data.features.analytics).toBe(false);
    });

    test('should not expose sensitive data', () => {
      process.env.DATABASE_URL = 'postgres://secret';
      process.env.API_KEY = 'secret-key';

      const data = getInitialAppData();
      const json = JSON.stringify(data);

      expect(json).not.toContain('secret');
      expect(json).not.toContain('DATABASE_URL');
      expect(json).not.toContain('API_KEY');
    });
  });
});
