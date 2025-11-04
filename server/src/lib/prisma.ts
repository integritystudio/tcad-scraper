import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
  var prismaReadOnly: PrismaClient | undefined;
}

const writeClient = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = writeClient;
}

const readClient = global.prismaReadOnly || new PrismaClient({
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

export const prisma = writeClient;
export const prismaReadOnly = readClient;
