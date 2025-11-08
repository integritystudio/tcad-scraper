"use strict";
/**
 * App Routes - Serves the frontend application with secure data passing
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appRouter = void 0;
const express_1 = require("express");
const xcontroller_middleware_1 = require("../middleware/xcontroller.middleware");
const logger_1 = __importDefault(require("../lib/logger"));
const router = (0, express_1.Router)();
exports.appRouter = router;
/**
 * Serve the main application with secure initial data
 */
router.get('/', xcontroller_middleware_1.nonceMiddleware, xcontroller_middleware_1.cspMiddleware, (req, res) => {
    try {
        const nonce = res.locals.nonce;
        const initialData = (0, xcontroller_middleware_1.getInitialAppData)();
        const html = (0, xcontroller_middleware_1.generateSecureHtml)({
            title: 'TCAD Property Analytics',
            nonce,
            initialData,
            scriptSrc: '/src/main.tsx',
            styleSrc: '/src/App.css',
        });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    }
    catch (error) {
        logger_1.default.error('Error serving app:', error);
        res.status(500).send('Internal Server Error');
    }
});
/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
    });
});
//# sourceMappingURL=app.routes.js.map