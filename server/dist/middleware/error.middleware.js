"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = exports.asyncHandler = void 0;
const logger_1 = __importDefault(require("../lib/logger"));
/**
 * Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
/**
 * Global error handling middleware
 */
const errorHandler = (error, _req, res, _next) => {
    logger_1.default.error(`Error: ${error.message}${error.stack ? '\nStack: ' + error.stack : ''}`);
    // Handle specific error types
    if (error.name === 'ValidationError') {
        res.status(400).json({
            error: 'Validation failed',
            message: error.message,
        });
        return;
    }
    if (error.name === 'UnauthorizedError') {
        res.status(401).json({
            error: 'Unauthorized',
            message: error.message,
        });
        return;
    }
    // Default to 500 server error
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
};
exports.errorHandler = errorHandler;
/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`,
    });
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=error.middleware.js.map