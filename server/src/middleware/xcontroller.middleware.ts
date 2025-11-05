/**
 * XController Middleware
 * Implements secure server-to-client data passing with CSP Level 3 compliance
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Generate cryptographically secure nonce for CSP
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Encode JSON safely for embedding in HTML
 * Prevents XSS by encoding dangerous characters
 */
export function encodeJsonForHtml(data: any): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')  // Line separator
    .replace(/\u2029/g, '\\u2029'); // Paragraph separator
}

/**
 * Middleware to add CSP nonce to response locals
 * Usage: app.use(nonceMiddleware)
 */
export function nonceMiddleware(req: Request, res: Response, next: NextFunction) {
  res.locals.nonce = generateNonce();
  next();
}

/**
 * Middleware to set CSP headers with nonce support
 * Usage: app.use(cspMiddleware)
 */
export function cspMiddleware(req: Request, res: Response, next: NextFunction) {
  const nonce = res.locals.nonce;

  if (!nonce) {
    console.warn('CSP middleware called without nonce. Use nonceMiddleware first.');
  }

  // CSP Level 3 with nonce support
  const cspDirectives = [
    "default-src 'self'",
    nonce ? `script-src 'self' 'nonce-${nonce}'` : "script-src 'self'",
    nonce ? `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'` : "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspDirectives);

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HSTS (only in production with HTTPS)
  if (process.env.NODE_ENV === 'production' && req.protocol === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

/**
 * Generate HTML with embedded secure data
 * Uses JSON Script Tag pattern for CSP compliance
 */
export function generateSecureHtml(options: {
  title: string;
  nonce: string;
  initialData?: any;
  scriptSrc: string;
  styleSrc?: string;
}): string {
  const { title, nonce, initialData, scriptSrc, styleSrc } = options;

  let dataScript = '';
  if (initialData) {
    const encodedData = encodeJsonForHtml(initialData);
    dataScript = `
    <!-- Initial app data (secure) -->
    <script type="application/json" id="initial-data" nonce="${nonce}">
      ${encodedData}
    </script>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${styleSrc ? `<link rel="stylesheet" href="${styleSrc}" nonce="${nonce}">` : ''}
  </head>
  <body>
    <div id="root"></div>
    ${dataScript}
    <script src="${scriptSrc}" nonce="${nonce}"></script>
  </body>
</html>`;
}

/**
 * Type-safe initial data interface
 */
export interface InitialAppData {
  apiUrl: string;
  environment: string;
  features: {
    search: boolean;
    analytics: boolean;
    monitoring: boolean;
  };
  version: string;
}

/**
 * Generate initial app configuration
 * Never include sensitive data here!
 */
export function getInitialAppData(): InitialAppData {
  return {
    apiUrl: process.env.API_URL || '/api',
    environment: process.env.NODE_ENV || 'development',
    features: {
      search: true,
      analytics: process.env.NODE_ENV === 'production',
      monitoring: process.env.NODE_ENV === 'production',
    },
    version: process.env.APP_VERSION || '1.0.0',
  };
}
