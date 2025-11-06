"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prismaReadOnly = exports.prisma = void 0;
const client_1 = require("@prisma/client");
const writeClient = global.prisma || new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
if (process.env.NODE_ENV !== 'production') {
    global.prisma = writeClient;
}
const readClient = global.prismaReadOnly || new client_1.PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_READ_ONLY_URL || process.env.DATABASE_URL,
        },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
if (process.env.NODE_ENV !== 'production') {
    global.prismaReadOnly = readClient;
}
exports.prisma = writeClient;
exports.prismaReadOnly = readClient;
//# sourceMappingURL=prisma.js.map