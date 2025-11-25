import { Request, Response, NextFunction } from 'express';
/**
 * Async handler wrapper to catch errors in async route handlers
 */
export declare const asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => void;
/**
 * Global error handling middleware
 */
export declare const errorHandler: (error: Error, _req: Request, res: Response, _next: NextFunction) => void;
/**
 * 404 Not Found handler
 */
export declare const notFoundHandler: (req: Request, res: Response) => void;
//# sourceMappingURL=error.middleware.d.ts.map