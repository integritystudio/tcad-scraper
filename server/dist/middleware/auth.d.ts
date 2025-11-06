import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        email?: string;
    };
}
export declare const apiKeyAuth: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const jwtAuth: (req: AuthRequest, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const optionalAuth: (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const generateToken: (userId: string, email?: string) => string;
//# sourceMappingURL=auth.d.ts.map