"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitorRequestSchema = exports.historyQuerySchema = exports.naturalLanguageSearchSchema = exports.propertyFilterSchema = exports.scrapeRequestSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// Validation Schemas
// ============================================================================
exports.scrapeRequestSchema = zod_1.z.object({
    searchTerm: zod_1.z.string().min(4, 'Search term must be at least 4 characters').max(100),
    userId: zod_1.z.string().optional(),
});
exports.propertyFilterSchema = zod_1.z.object({
    searchTerm: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    propType: zod_1.z.string().optional(),
    minValue: zod_1.z.coerce.number().optional(),
    maxValue: zod_1.z.coerce.number().optional(),
    limit: zod_1.z.coerce.number().min(1).max(1000).default(100),
    offset: zod_1.z.coerce.number().min(0).default(0),
});
exports.naturalLanguageSearchSchema = zod_1.z.object({
    query: zod_1.z.string().min(1),
    limit: zod_1.z.number().min(1).max(1000).optional(),
    offset: zod_1.z.number().min(0).optional(),
});
exports.historyQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().min(1).max(100).default(20),
    offset: zod_1.z.coerce.number().min(0).default(0),
});
exports.monitorRequestSchema = zod_1.z.object({
    searchTerm: zod_1.z.string().min(1),
    frequency: zod_1.z.enum(['hourly', 'daily', 'weekly']).default('daily'),
});
//# sourceMappingURL=property.types.js.map