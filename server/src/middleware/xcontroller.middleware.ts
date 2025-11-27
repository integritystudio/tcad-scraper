/**
 * XController Middleware
 * Implements secure server-to-client data passing with CSP Level 3 compliance
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import logger from '../lib/logger';

/**
 * Generate cryptographically secure nonce for CSP
 */
export function generateNonce(): string {
  return crypto.randomBytes(config.security.csp.nonceLength).toString('base64');
}

/**
 * Encode JSON safely for embedding in HTML
 * Prevents XSS by encoding dangerous characters
 */
export function encodeJsonForHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026')
    .replace(/=/g, '\\u003D')       // Equals sign (prevents attribute injection)
    .replace(/\u2028/g, '\\u2028')  // Line separator
    .replace(/\u2029/g, '\\u2029'); // Paragraph separator
}

/**
 * Middleware to add CSP nonce to response locals
 * Usage: app.use(nonceMiddleware)
 */
export function nonceMiddleware(_req: Request, res: Response, next: NextFunction) {
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
    logger.warn('CSP middleware called without nonce. Use nonceMiddleware first.');
  }

  // CSP Level 3 with nonce support
  if (config.security.csp.enabled) {
    const directives = config.security.csp.directives;
    const cspDirectives = [
      `default-src ${directives.defaultSrc.join(' ')}`,
      nonce
        ? `script-src ${directives.scriptSrc.join(' ')} 'nonce-${nonce}'`
        : `script-src ${directives.scriptSrc.join(' ')}`,
      nonce
        ? `style-src ${directives.styleSrc.join(' ')} 'nonce-${nonce}'`
        : `style-src ${directives.styleSrc.join(' ')}`,
      `img-src ${directives.imgSrc.join(' ')}`,
      `font-src ${directives.fontSrc.join(' ')}`,
      `connect-src ${directives.connectSrc.join(' ')}`,
      `frame-ancestors ${directives.frameAncestors.join(' ')}`,
      `base-uri ${directives.baseUri.join(' ')}`,
      `form-action ${directives.formAction.join(' ')}`,
    ].join('; ');

    res.setHeader('Content-Security-Policy', cspDirectives);
  }

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HSTS (only in production with HTTPS)
  if (config.env.isProduction && req.protocol === 'https') {
    res.setHeader(
      'Strict-Transport-Security',
      `max-age=${config.security.hsts.maxAge}${config.security.hsts.includeSubDomains ? '; includeSubDomains' : ''}`
    );
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
  initialData?: unknown;
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
    apiUrl: config.frontend.apiUrl || '',
    environment: config.env.nodeEnv,
    features: {
      search: config.frontend.features.search,
      analytics: config.frontend.features.analytics,
      monitoring: config.frontend.features.monitoring,
    },
    version: config.frontend.appVersion,
  };
}
