"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.optionalAuth = exports.jwtAuth = exports.apiKeyAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Simple API key authentication middleware
const apiKeyAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const expectedApiKey = process.env.API_KEY;
    // Skip auth in development if no API key is set
    if (process.env.NODE_ENV === 'development' && !expectedApiKey) {
        return next();
    }
    if (!apiKey || apiKey !== expectedApiKey) {
        return res.status(401).json({ error: 'Unauthorized - Invalid API key' });
    }
    next();
};
exports.apiKeyAuth = apiKeyAuth;
// JWT authentication middleware
const jwtAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    // Skip auth in development if no JWT secret is set
    if (process.env.NODE_ENV === 'development' && !process.env.JWT_SECRET) {
        return next();
    }
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
    try {
        const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(403).json({ error: 'Forbidden - Invalid token' });
    }
};
exports.jwtAuth = jwtAuth;
// Optional auth middleware (allows both authenticated and unauthenticated access)
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token && process.env.JWT_SECRET) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        }
        catch (error) {
            // Invalid token, but we continue anyway
        }
    }
    next();
};
exports.optionalAuth = optionalAuth;
// Generate JWT token
const generateToken = (userId, email) => {
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    return jsonwebtoken_1.default.sign({ id: userId, email }, jwtSecret, { expiresIn });
};
exports.generateToken = generateToken;
//# sourceMappingURL=auth.js.map