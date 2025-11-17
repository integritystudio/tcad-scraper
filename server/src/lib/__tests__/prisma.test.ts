/**
 * Prisma Client Tests
 *
 * Tests for Prisma client initialization and configuration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock PrismaClient before imports
const mockPrismaClient = vi.fn().mockImplementation(() => ({
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: mockPrismaClient,
}));

describe('Prisma Client Module', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear module cache and global state
    vi.clearAllMocks();
    delete (global as any).prisma;
    delete (global as any).prismaReadOnly;

    // Reset module cache to force re-import
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Write Client Initialization', () => {
    it('should create write client with error logging in production', async () => {
      process.env.NODE_ENV = 'production';

      // Re-import after setting environment
      await import('../prisma');

      expect(mockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: ['error'],
        })
      );
    });

    it('should create write client with verbose logging in development', async () => {
      process.env.NODE_ENV = 'development';

      await import('../prisma');

      expect(mockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: ['query', 'error', 'warn'],
        })
      );
    });

    it('should use error-only logging when NODE_ENV is not development', async () => {
      process.env.NODE_ENV = 'test';

      await import('../prisma');

      expect(mockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: ['error'],
        })
      );
    });

    it('should not set global.prisma in production', async () => {
      process.env.NODE_ENV = 'production';

      await import('../prisma');

      expect((global as any).prisma).toBeUndefined();
    });

    it('should set global.prisma in non-production environments', async () => {
      process.env.NODE_ENV = 'development';

      await import('../prisma');

      expect((global as any).prisma).toBeDefined();
    });

    it('should reuse existing global.prisma if available', async () => {
      const existingClient = { existing: 'client' };
      (global as any).prisma = existingClient;

      const { prisma } = await import('../prisma');

      expect(prisma).toBe(existingClient);
      // Write client reused from global, but read-only client still created
      expect(mockPrismaClient).toHaveBeenCalledTimes(1); // Only for read-only client
    });
  });

  describe('Read-Only Client Initialization', () => {
    it('should create read-only client with separate database URL', async () => {
      process.env.DATABASE_READ_ONLY_URL = 'postgresql://readonly:pass@localhost:5432/db';
      process.env.DATABASE_URL = 'postgresql://write:pass@localhost:5432/db';
      process.env.NODE_ENV = 'production';

      await import('../prisma');

      expect(mockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          datasources: {
            db: {
              url: 'postgresql://readonly:pass@localhost:5432/db',
            },
          },
          log: ['error'],
        })
      );
    });

    it('should fallback to DATABASE_URL when DATABASE_READ_ONLY_URL is not set', async () => {
      delete process.env.DATABASE_READ_ONLY_URL;
      process.env.DATABASE_URL = 'postgresql://main:pass@localhost:5432/db';
      process.env.NODE_ENV = 'production';

      await import('../prisma');

      expect(mockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          datasources: {
            db: {
              url: 'postgresql://main:pass@localhost:5432/db',
            },
          },
        })
      );
    });

    it('should create read-only client with verbose logging in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';

      await import('../prisma');

      // Second call should be for read-only client
      expect(mockPrismaClient).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          log: ['query', 'error', 'warn'],
        })
      );
    });

    it('should not set global.prismaReadOnly in production', async () => {
      process.env.NODE_ENV = 'production';

      await import('../prisma');

      expect((global as any).prismaReadOnly).toBeUndefined();
    });

    it('should set global.prismaReadOnly in non-production environments', async () => {
      process.env.NODE_ENV = 'development';

      await import('../prisma');

      expect((global as any).prismaReadOnly).toBeDefined();
    });

    it('should reuse existing global.prismaReadOnly if available', async () => {
      const existingReadClient = { existing: 'readClient' };
      (global as any).prismaReadOnly = existingReadClient;

      const { prismaReadOnly } = await import('../prisma');

      expect(prismaReadOnly).toBe(existingReadClient);
    });
  });

  describe('Module Exports', () => {
    it('should export prisma write client', async () => {
      const { prisma } = await import('../prisma');

      expect(prisma).toBeDefined();
    });

    it('should export prismaReadOnly client', async () => {
      const { prismaReadOnly } = await import('../prisma');

      expect(prismaReadOnly).toBeDefined();
    });

    it('should export both clients as separate instances when no globals exist', async () => {
      const { prisma, prismaReadOnly } = await import('../prisma');

      expect(prisma).toBeDefined();
      expect(prismaReadOnly).toBeDefined();
      // When created fresh (not from globals), they should be different instances
      expect(mockPrismaClient).toHaveBeenCalledTimes(2);
    });
  });

  describe('Singleton Pattern', () => {
    it('should maintain singleton across multiple imports in non-production', async () => {
      process.env.NODE_ENV = 'development';

      // First import
      const module1 = await import('../prisma');

      // Second import should reuse global (ESM modules are cached)
      const module2 = await import('../prisma');

      expect(module1.prisma).toBe(module2.prisma);
      expect(module1.prismaReadOnly).toBe(module2.prismaReadOnly);
    });

    it.skip('should create new instances in production on each import - SKIPPED (ESM module caching)', () => {
      // ESM modules are always cached, so this test doesn't apply
    });
  });

  describe('Environment Variable Handling', () => {
    it('should handle missing DATABASE_URL gracefully', async () => {
      delete process.env.DATABASE_URL;
      delete process.env.DATABASE_READ_ONLY_URL;

      // Should not throw when importing
      await expect(import('../prisma')).resolves.toBeDefined();
    });

    it('should handle undefined NODE_ENV with error-only logging', async () => {
      delete process.env.NODE_ENV;

      await import('../prisma');

      // Should use error-only logging (only 'development' gets verbose logging)
      expect(mockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: ['error'],
        })
      );
    });
  });
});
