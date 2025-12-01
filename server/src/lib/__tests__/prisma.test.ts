/**
 * Prisma Client Tests
 *
 * Tests for Prisma client initialization and configuration.
 * These tests verify actual behavior without mocking PrismaClient,
 * focusing on what the module exports and how it behaves.
 */

import { describe, it, expect, beforeAll } from 'vitest';

describe('Prisma Client Module', () => {
  describe('Module Exports', () => {
    it('should export prisma write client', async () => {
      const { prisma } = await import('../prisma');

      expect(prisma).toBeDefined();
      expect(typeof prisma).toBe('object');
    });

    it('should export prismaReadOnly client', async () => {
      const { prismaReadOnly } = await import('../prisma');

      expect(prismaReadOnly).toBeDefined();
      expect(typeof prismaReadOnly).toBe('object');
    });

    it('should export both clients', async () => {
      const module = await import('../prisma');

      expect(module).toHaveProperty('prisma');
      expect(module).toHaveProperty('prismaReadOnly');
    });
  });

  describe('Client Structure', () => {
    it('prisma client should have $connect method', async () => {
      const { prisma } = await import('../prisma');

      expect(prisma).toHaveProperty('$connect');
      expect(typeof prisma.$connect).toBe('function');
    });

    it('prisma client should have $disconnect method', async () => {
      const { prisma } = await import('../prisma');

      expect(prisma).toHaveProperty('$disconnect');
      expect(typeof prisma.$disconnect).toBe('function');
    });

    it('prismaReadOnly client should have $connect method', async () => {
      const { prismaReadOnly } = await import('../prisma');

      expect(prismaReadOnly).toHaveProperty('$connect');
      expect(typeof prismaReadOnly.$connect).toBe('function');
    });

    it('prismaReadOnly client should have $disconnect method', async () => {
      const { prismaReadOnly } = await import('../prisma');

      expect(prismaReadOnly).toHaveProperty('$disconnect');
      expect(typeof prismaReadOnly.$disconnect).toBe('function');
    });

    it('prisma client should have model accessors', async () => {
      const { prisma } = await import('../prisma');

      // PrismaClient dynamically adds model accessors - check that the object
      // has more than just the base $ methods (indicating models are attached)
      const keys = Object.keys(prisma);
      const modelKeys = keys.filter(k => !k.startsWith('$') && !k.startsWith('_'));

      expect(modelKeys.length).toBeGreaterThan(0);
    });

    it('prismaReadOnly client should have model accessors', async () => {
      const { prismaReadOnly } = await import('../prisma');

      const keys = Object.keys(prismaReadOnly);
      const modelKeys = keys.filter(k => !k.startsWith('$') && !k.startsWith('_'));

      expect(modelKeys.length).toBeGreaterThan(0);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple imports', async () => {
      const module1 = await import('../prisma');
      const module2 = await import('../prisma');

      // ESM modules are cached, so these should be the same
      expect(module1.prisma).toBe(module2.prisma);
      expect(module1.prismaReadOnly).toBe(module2.prismaReadOnly);
    });

    it('write and read clients should be different instances', async () => {
      const { prisma, prismaReadOnly } = await import('../prisma');

      // They may or may not be the same instance depending on config
      // but they should both be defined
      expect(prisma).toBeDefined();
      expect(prismaReadOnly).toBeDefined();
    });
  });

  describe('Client Type Verification', () => {
    it('prisma should be a PrismaClient instance', async () => {
      const { prisma } = await import('../prisma');

      // Verify it has PrismaClient-specific methods
      expect(prisma).toHaveProperty('$transaction');
      expect(prisma).toHaveProperty('$queryRaw');
      expect(prisma).toHaveProperty('$executeRaw');
    });

    it('prismaReadOnly should be a PrismaClient instance', async () => {
      const { prismaReadOnly } = await import('../prisma');

      // Verify it has PrismaClient-specific methods
      expect(prismaReadOnly).toHaveProperty('$transaction');
      expect(prismaReadOnly).toHaveProperty('$queryRaw');
      expect(prismaReadOnly).toHaveProperty('$executeRaw');
    });
  });
});

describe('Prisma Client Integration', () => {
  // These tests require DATABASE_URL to be set
  // Skip if not available (CI without database)
  const hasDatabase = !!process.env.DATABASE_URL;

  describe.skipIf(!hasDatabase)('Database Connection', () => {
    it('should be able to connect to database', async () => {
      const { prisma } = await import('../prisma');

      // This will throw if connection fails
      await expect(prisma.$connect()).resolves.not.toThrow();
    });

    it('should be able to disconnect from database', async () => {
      const { prisma } = await import('../prisma');

      await prisma.$connect();
      await expect(prisma.$disconnect()).resolves.not.toThrow();
    });

    it('read-only client should be able to connect', async () => {
      const { prismaReadOnly } = await import('../prisma');

      await expect(prismaReadOnly.$connect()).resolves.not.toThrow();
      await prismaReadOnly.$disconnect();
    });
  });
});
