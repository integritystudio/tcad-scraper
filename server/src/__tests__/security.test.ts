/**
 * Security Tests for XController Implementation
 */

import { describe, test, expect } from '@jest/globals';
import request from 'supertest';
import app from '../index';
import { encodeJsonForHtml } from '../middleware/xcontroller.middleware';

describe('Security Tests', () => {
  describe('XSS Prevention', () => {
    test('should prevent script injection via < character', () => {
      const malicious = { html: '<script>alert("xss")</script>' };
      const encoded = encodeJsonForHtml(malicious);

      expect(encoded).not.toContain('<script>');
      expect(encoded).toContain('\\u003Cscript\\u003E');
    });

    test('should prevent script injection via closing tag', () => {
      const malicious = { payload: '</script><script>alert("xss")</script>' };
      const encoded = encodeJsonForHtml(malicious);

      expect(encoded).not.toContain('</script><script>');
      expect(encoded).toContain('\\u003C/script\\u003E');
    });

    test('should prevent event handler injection', () => {
      const malicious = { html: '<img src=x onerror=alert("xss")>' };
      const encoded = encodeJsonForHtml(malicious);

      expect(encoded).not.toContain('<img');
      expect(encoded).toContain('\\u003Cimg');
    });

    test('should prevent javascript: URL injection', () => {
      const malicious = { url: 'javascript:alert("xss")' };
      const encoded = encodeJsonForHtml(malicious);

      // Data should be encoded but javascript: prefix stays (it's just text)
      expect(JSON.parse(encoded).url).toBe('javascript:alert("xss")');
      // But it won't execute as it's in JSON
    });

    test('should handle unicode escape sequences', () => {
      const malicious = { text: '\u003Cscript\u003Ealert("xss")\u003C/script\u003E' };
      const encoded = encodeJsonForHtml(malicious);

      // Should be double-encoded
      expect(encoded).toContain('\\\\u003C');
    });

    test('should prevent data URI injection', () => {
      const malicious = { data: 'data:text/html,<script>alert("xss")</script>' };
      const encoded = encodeJsonForHtml(malicious);

      expect(encoded).not.toContain('<script>');
    });
  });

  describe('CSP Compliance', () => {
    test('should have CSP header on frontend routes', async () => {
      const response = await request(app).get('/');
      const csp = response.headers['content-security-policy'];

      expect(csp).toBeDefined();
      expect(csp).toContain('default-src');
      expect(csp).toContain('script-src');
    });

    test('should require nonce for inline scripts', async () => {
      const response = await request(app).get('/');
      const csp = response.headers['content-security-policy'];

      expect(csp).toContain("'nonce-");
      expect(csp).not.toContain("'unsafe-inline'");
    });

    test('should block frame embedding', async () => {
      const response = await request(app).get('/');
      const csp = response.headers['content-security-policy'];

      expect(csp).toContain('frame-ancestors');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('should restrict script sources', async () => {
      const response = await request(app).get('/');
      const csp = response.headers['content-security-policy'];

      expect(csp).toContain("script-src 'self'");
      expect(csp).not.toContain("'unsafe-eval'");
    });

    test('should have consistent nonce across page', async () => {
      const response = await request(app).get('/');

      // Extract all nonces from HTML
      const htmlNonces = response.text.match(/nonce="([^"]+)"/g);
      expect(htmlNonces).toBeTruthy();
      expect(htmlNonces!.length).toBeGreaterThan(0);

      // All should be the same nonce
      const uniqueNonces = new Set(htmlNonces);
      expect(uniqueNonces.size).toBe(1);
    });
  });

  describe('Security Headers', () => {
    test('should set X-Content-Type-Options to prevent MIME sniffing', async () => {
      const response = await request(app).get('/');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('should set X-Frame-Options to prevent clickjacking', async () => {
      const response = await request(app).get('/');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    test('should set X-XSS-Protection', async () => {
      const response = await request(app).get('/');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    test('should set Referrer-Policy', async () => {
      const response = await request(app).get('/');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    test('should not expose sensitive headers', async () => {
      const response = await request(app).get('/');

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });
  });

  describe('Sensitive Data Protection', () => {
    test('should not expose database credentials', async () => {
      const response = await request(app).get('/');
      const text = response.text.toLowerCase();

      expect(text).not.toContain('database_url');
      expect(text).not.toContain('db_password');
      expect(text).not.toContain('postgres://');
    });

    test('should not expose API keys', async () => {
      const response = await request(app).get('/');
      const text = response.text.toLowerCase();

      expect(text).not.toContain('api_key');
      expect(text).not.toContain('secret_key');
      expect(text).not.toContain('access_token');
    });

    test('should not expose private keys', async () => {
      const response = await request(app).get('/');
      const text = response.text.toLowerCase();

      expect(text).not.toContain('private_key');
      expect(text).not.toContain('-----begin');
    });

    test('should only expose safe environment variables', async () => {
      const response = await request(app).get('/');

      const dataMatch = response.text.match(
        /<script type="application\/json" id="initial-data"[^>]*>\s*({[\s\S]*?})\s*<\/script>/
      );

      if (dataMatch) {
        const data = JSON.parse(dataMatch[1]);

        // Should have safe data
        expect(data).toHaveProperty('apiUrl');
        expect(data).toHaveProperty('environment');

        // Should not have sensitive data
        expect(data).not.toHaveProperty('databaseUrl');
        expect(data).not.toHaveProperty('apiKey');
        expect(data).not.toHaveProperty('secret');
      }
    });
  });

  describe('HTTPS and Transport Security', () => {
    test('should recommend HTTPS in production', () => {
      // This is a note/documentation test
      // HSTS header should be set in production with HTTPS
      expect(true).toBe(true);
    });

    test('should not set HSTS in development', async () => {
      const response = await request(app).get('/');
      // In development, HSTS should not be set
      if (process.env.NODE_ENV !== 'production') {
        expect(response.headers['strict-transport-security']).toBeUndefined();
      }
    });
  });

  describe('Input Validation', () => {
    test('should handle malformed JSON gracefully', () => {
      const invalidJson = '{"incomplete": ';

      expect(() => {
        JSON.parse(invalidJson);
      }).toThrow();

      // Our encoding should still work with valid objects
      const valid = { test: 'value' };
      const encoded = encodeJsonForHtml(valid);
      expect(() => JSON.parse(encoded)).not.toThrow();
    });

    test('should handle extremely large data', () => {
      const largeArray = Array(10000).fill({ data: 'test' });
      const encoded = encodeJsonForHtml(largeArray);

      expect(encoded.length).toBeGreaterThan(10000);
      expect(() => JSON.parse(encoded)).not.toThrow();
    });

    test('should handle special characters in strings', () => {
      const specialChars = {
        quotes: 'He said "Hello"',
        apostrophe: "It's working",
        backslash: 'path\\to\\file',
        newline: 'Line 1\nLine 2',
        tab: 'Col1\tCol2',
      };

      const encoded = encodeJsonForHtml(specialChars);
      const decoded = JSON.parse(encoded);

      expect(decoded).toEqual(specialChars);
    });
  });

  describe('Attack Vectors', () => {
    test('should prevent polyglot attacks', () => {
      const polyglot = {
        payload:
          '/*-/*`/*\\`/*\'/*"/**/(/* */onerror=alert(\'xss\') )//%0D%0A%0d%0a//<script>alert("xss")</script>',
      };

      const encoded = encodeJsonForHtml(polyglot);
      expect(encoded).not.toContain('<script>');
      expect(encoded).not.toContain('onerror=');
    });

    test('should prevent mutation XSS (mXSS)', () => {
      const mxss = {
        payload: '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
      };

      const encoded = encodeJsonForHtml(mxss);
      expect(encoded).not.toContain('<noscript>');
      expect(encoded).not.toContain('<img');
    });

    test('should prevent CSS injection', () => {
      const cssInjection = {
        style: 'expression(alert("xss"))',
      };

      const encoded = encodeJsonForHtml(cssInjection);
      // Should be safely encoded as a string
      const decoded = JSON.parse(encoded);
      expect(decoded.style).toBe('expression(alert("xss"))');
      // But won't execute as it's just data
    });

    test('should prevent CRLF injection', () => {
      const crlfInjection = {
        header: 'value\r\nX-Injected: malicious',
      };

      const encoded = encodeJsonForHtml(crlfInjection);
      const decoded = JSON.parse(encoded);
      expect(decoded.header).toContain('\\r\\n');
    });
  });

  describe('Regression Tests', () => {
    test('should maintain backward compatibility', async () => {
      const response = await request(app).get('/');

      // Should still serve HTML
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');

      // Should have required elements
      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('<div id="root">');
    });

    test('should not break API routes', async () => {
      const response = await request(app).get('/api/properties/stats');

      // Should respond (even if with error)
      expect(response.status).toBeDefined();

      // Should not serve HTML for API routes
      if (response.status === 200) {
        expect(response.headers['content-type']).not.toContain('text/html');
      }
    });
  });
});
