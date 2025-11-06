"use strict";
/**
 * XController Middleware
 * Implements secure server-to-client data passing with CSP Level 3 compliance
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNonce = generateNonce;
exports.encodeJsonForHtml = encodeJsonForHtml;
exports.nonceMiddleware = nonceMiddleware;
exports.cspMiddleware = cspMiddleware;
exports.generateSecureHtml = generateSecureHtml;
exports.getInitialAppData = getInitialAppData;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
/**
 * Generate cryptographically secure nonce for CSP
 */
function generateNonce() {
    return crypto_1.default.randomBytes(config_1.config.security.csp.nonceLength).toString('base64');
}
/**
 * Encode JSON safely for embedding in HTML
 * Prevents XSS by encoding dangerous characters
 */
function encodeJsonForHtml(data) {
    return JSON.stringify(data)
        .replace(/</g, '\\u003C')
        .replace(/>/g, '\\u003E')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028') // Line separator
        .replace(/\u2029/g, '\\u2029'); // Paragraph separator
}
/**
 * Middleware to add CSP nonce to response locals
 * Usage: app.use(nonceMiddleware)
 */
function nonceMiddleware(req, res, next) {
    res.locals.nonce = generateNonce();
    next();
}
/**
 * Middleware to set CSP headers with nonce support
 * Usage: app.use(cspMiddleware)
 */
function cspMiddleware(req, res, next) {
    const nonce = res.locals.nonce;
    if (!nonce) {
        console.warn('CSP middleware called without nonce. Use nonceMiddleware first.');
    }
    // CSP Level 3 with nonce support
    if (config_1.config.security.csp.enabled) {
        const directives = config_1.config.security.csp.directives;
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
    if (config_1.config.env.isProduction && req.protocol === 'https') {
        res.setHeader('Strict-Transport-Security', `max-age=${config_1.config.security.hsts.maxAge}${config_1.config.security.hsts.includeSubDomains ? '; includeSubDomains' : ''}`);
    }
    next();
}
/**
 * Generate HTML with embedded secure data
 * Uses JSON Script Tag pattern for CSP compliance
 */
function generateSecureHtml(options) {
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
 * Generate initial app configuration
 * Never include sensitive data here!
 */
function getInitialAppData() {
    return {
        apiUrl: config_1.config.frontend.apiUrl,
        environment: config_1.config.env.nodeEnv,
        features: {
            search: config_1.config.frontend.features.search,
            analytics: config_1.config.frontend.features.analytics,
            monitoring: config_1.config.frontend.features.monitoring,
        },
        version: config_1.config.frontend.appVersion,
    };
}
//# sourceMappingURL=xcontroller.middleware.js.map