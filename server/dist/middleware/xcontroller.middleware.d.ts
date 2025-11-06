/**
 * XController Middleware
 * Implements secure server-to-client data passing with CSP Level 3 compliance
 */
import { Request, Response, NextFunction } from 'express';
/**
 * Generate cryptographically secure nonce for CSP
 */
export declare function generateNonce(): string;
/**
 * Encode JSON safely for embedding in HTML
 * Prevents XSS by encoding dangerous characters
 */
export declare function encodeJsonForHtml(data: any): string;
/**
 * Middleware to add CSP nonce to response locals
 * Usage: app.use(nonceMiddleware)
 */
export declare function nonceMiddleware(req: Request, res: Response, next: NextFunction): void;
/**
 * Middleware to set CSP headers with nonce support
 * Usage: app.use(cspMiddleware)
 */
export declare function cspMiddleware(req: Request, res: Response, next: NextFunction): void;
/**
 * Generate HTML with embedded secure data
 * Uses JSON Script Tag pattern for CSP compliance
 */
export declare function generateSecureHtml(options: {
    title: string;
    nonce: string;
    initialData?: any;
    scriptSrc: string;
    styleSrc?: string;
}): string;
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
export declare function getInitialAppData(): InitialAppData;
//# sourceMappingURL=xcontroller.middleware.d.ts.map