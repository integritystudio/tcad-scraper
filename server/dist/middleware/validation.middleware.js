"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateParams = exports.validateQuery = exports.validateBody = exports.validate = void 0;
const zod_1 = require("zod");
/**
 * Middleware factory for validating request data using Zod schemas
 */
const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        try {
            const dataToValidate = req[source];
            const validatedData = schema.parse(dataToValidate);
            // Replace the original data with validated data (with defaults applied)
            req[source] = validatedData;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    error: 'Invalid request data',
                    details: error.errors.map(err => ({
                        path: err.path.join('.'),
                        message: err.message,
                    })),
                });
                return;
            }
            next(error);
        }
    };
};
exports.validate = validate;
/**
 * Convenience functions for common validation scenarios
 */
const validateBody = (schema) => (0, exports.validate)(schema, 'body');
exports.validateBody = validateBody;
const validateQuery = (schema) => (0, exports.validate)(schema, 'query');
exports.validateQuery = validateQuery;
const validateParams = (schema) => (0, exports.validate)(schema, 'params');
exports.validateParams = validateParams;
//# sourceMappingURL=validation.middleware.js.map