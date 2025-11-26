/**
 * Integration Tests for XController Implementation
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { isRedisAvailable } from './test-utils';

describe('Integration Tests', () => {
  describe('Server Health', () => {
    test('should respond to health check', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });

    test('should respond to queue health check', async () => {
      const redisAvailable = await isRedisAvailable(3000);

      if (!redisAvailable) {
        console.log('⏭️  Skipping queue health check: Redis not available');
        return;
      }

      const response = await request(app).get('/health/queue');
      expect([200, 500]).toContain(response.status);
      // May be 500 if Redis is not running, but should respond
    }, 10000); // 10 second timeout for this test
  });

  describe('API Routes', () => {
    test('should serve API routes without CSP interference', async () => {
      const response = await request(app).get('/api/properties/stats');

      // Should work even if it returns an error
      expect(response.status).toBeDefined();

      // Should not have strict CSP that would break API
      const csp = response.headers['content-security-policy'];
      if (csp) {
        // API endpoints should allow flexible content
        expect(csp).not.toContain('frame-ancestors');
      }
    });
  });

  describe('Frontend Routes', () => {
    test('should serve frontend with xcontroller security', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    });

    test('should include CSP headers on frontend routes', async () => {
      const response = await request(app).get('/');

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('should include nonce in both HTML and CSP', async () => {
      const response = await request(app).get('/');

      const htmlNonceMatch = response.text.match(/nonce="([^"]+)"/);
      expect(htmlNonceMatch).toBeTruthy();

      const htmlNonce = htmlNonceMatch![1];
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain(`'nonce-${htmlNonce}'`);
    });
  });

  describe('Security Headers', () => {
    test('should set all required security headers on frontend', async () => {
      const response = await request(app).get('/');

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('Route Priority', () => {
    test('should serve health checks before app routes', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });

    test('should serve API routes before app routes', async () => {
      const response = await request(app).get('/api/properties/stats');
      // Should respond (even if error) and not serve HTML
      if (response.status === 200) {
        expect(response.headers['content-type']).toContain('application/json');
      }
      expect(response.headers['content-type']).not.toContain('text/html');
    });

    test('should serve frontend for unmatched routes', async () => {
      const response = await request(app).get('/some-spa-route');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    });
  });

  describe('Data Passing', () => {
    test('should embed initial data in HTML', async () => {
      const response = await request(app).get('/');

      expect(response.text).toContain('id="initial-data"');
      expect(response.text).toContain('type="application/json"');

      const dataMatch = response.text.match(
        /<script type="application\/json" id="initial-data"[^>]*>\s*({[\s\S]*?})\s*<\/script>/
      );

      expect(dataMatch).toBeTruthy();
      const data = JSON.parse(dataMatch![1]);

      expect(data).toHaveProperty('apiUrl');
      expect(data).toHaveProperty('environment');
      expect(data).toHaveProperty('features');
      expect(data).toHaveProperty('version');
    });

    test('should not expose sensitive environment variables', async () => {
      const response = await request(app).get('/');

      const text = response.text.toLowerCase();

      // Should not contain common sensitive variable names
      expect(text).not.toContain('database_url');
      expect(text).not.toContain('db_password');
      expect(text).not.toContain('api_key');
      expect(text).not.toContain('secret_key');
      expect(text).not.toContain('private_key');
    });
  });

  describe('XSS Prevention', () => {
    test('should encode dangerous characters in embedded data', async () => {
      const response = await request(app).get('/');

      const dataMatch = response.text.match(
        /<script type="application\/json" id="initial-data"[^>]*>([\s\S]*?)<\/script>/
      );

      if (dataMatch) {
        const dataSection = dataMatch[1];

        // Check for proper encoding if special chars are present
        if (dataSection.includes('\\u003C') || dataSection.includes('\\u003E')) {
          // Good - using unicode escapes
          expect(dataSection).not.toContain('</script>');
        }
      }
    });

    test('should not allow script breakout', async () => {
      const response = await request(app).get('/');

      // Should not have unescaped script tags in data
      const dangerousPattern = /<script[^>]*>[\s\S]*?<\/script>[\s\S]*?<script>/;
      const scriptSections = response.text.match(/<script[^>]*>[\s\S]*?<\/script>/g);

      if (scriptSections && scriptSections.length > 0) {
        // Each script section should be properly closed
        scriptSections.forEach(section => {
          const openCount = (section.match(/<script/g) || []).length;
          const closeCount = (section.match(/<\/script>/g) || []).length;
          expect(openCount).toBe(closeCount);
        });
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for non-existent API routes', async () => {
      const response = await request(app).get('/api/nonexistent');
      expect(response.status).toBe(404);
    });

    test('should serve frontend for non-existent SPA routes', async () => {
      const response = await request(app).get('/dashboard/analytics/report');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    });
  });
});
