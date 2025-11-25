"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.optionalAuth = exports.jwtAuth = exports.apiKeyAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
// Simple API key authentication middleware
const apiKeyAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    // Skip auth in development if no API key is set and skip is enabled
    if (config_1.config.env.isDevelopment && config_1.config.auth.skipInDevelopment && !config_1.config.auth.apiKey) {
        return next();
    }
    if (!apiKey || apiKey !== config_1.config.auth.apiKey) {
        return res.status(401).json({ error: 'Unauthorized - Invalid API key' });
    }
    next();
};
exports.apiKeyAuth = apiKeyAuth;
// JWT authentication middleware
const jwtAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    // Skip auth in development if no JWT secret is set and skip is enabled
    if (config_1.config.env.isDevelopment && config_1.config.auth.skipInDevelopment && !config_1.config.auth.jwt.secret) {
        return next();
    }
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.auth.jwt.secret);
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(403).json({ error: 'Forbidden - Invalid token' });
    }
};
exports.jwtAuth = jwtAuth;
// Optional auth middleware (allows both authenticated and unauthenticated access)
const optionalAuth = (req, _res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token && config_1.config.auth.jwt.secret) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.auth.jwt.secret);
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
    return jsonwebtoken_1.default.sign({ id: userId, email }, config_1.config.auth.jwt.secret, { expiresIn: config_1.config.auth.jwt.expiresIn });
};
exports.generateToken = generateToken;
//# sourceMappingURL=auth.js.map