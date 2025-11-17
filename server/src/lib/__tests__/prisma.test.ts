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
    it('should create write client with error logging in production', () => {
      process.env.NODE_ENV = 'production';

      // Re-import after setting environment
      require('../prisma');

      expect(mockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: ['error'],
        })
      );
    });

    it('should create write client with verbose logging in development', () => {
      process.env.NODE_ENV = 'development';

      require('../prisma');

      expect(mockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: ['query', 'error', 'warn'],
        })
      );
    });

    it('should use error-only logging when NODE_ENV is not development', () => {
      process.env.NODE_ENV = 'test';

      require('../prisma');

      expect(mockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: ['error'],
        })
      );
    });

    it('should not set global.prisma in production', () => {
      process.env.NODE_ENV = 'production';

      require('../prisma');

      expect((global as any).prisma).toBeUndefined();
    });

    it('should set global.prisma in non-production environments', () => {
      process.env.NODE_ENV = 'development';

      require('../prisma');

      expect((global as any).prisma).toBeDefined();
    });

    it('should reuse existing global.prisma if available', () => {
      const existingClient = { existing: 'client' };
      (global as any).prisma = existingClient;

      const { prisma } = require('../prisma');

      expect(prisma).toBe(existingClient);
      // Write client reused from global, but read-only client still created
      expect(mockPrismaClient).toHaveBeenCalledTimes(1); // Only for read-only client
    });
  });

  describe('Read-Only Client Initialization', () => {
    it('should create read-only client with separate database URL', () => {
      process.env.DATABASE_READ_ONLY_URL = 'postgresql://readonly:pass@localhost:5432/db';
      process.env.DATABASE_URL = 'postgresql://write:pass@localhost:5432/db';
      process.env.NODE_ENV = 'production';

      require('../prisma');

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

    it('should fallback to DATABASE_URL when DATABASE_READ_ONLY_URL is not set', () => {
      delete process.env.DATABASE_READ_ONLY_URL;
      process.env.DATABASE_URL = 'postgresql://main:pass@localhost:5432/db';
      process.env.NODE_ENV = 'production';

      require('../prisma');

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

    it('should create read-only client with verbose logging in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';

      require('../prisma');

      // Second call should be for read-only client
      expect(mockPrismaClient).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          log: ['query', 'error', 'warn'],
        })
      );
    });

    it('should not set global.prismaReadOnly in production', () => {
      process.env.NODE_ENV = 'production';

      require('../prisma');

      expect((global as any).prismaReadOnly).toBeUndefined();
    });

    it('should set global.prismaReadOnly in non-production environments', () => {
      process.env.NODE_ENV = 'development';

      require('../prisma');

      expect((global as any).prismaReadOnly).toBeDefined();
    });

    it('should reuse existing global.prismaReadOnly if available', () => {
      const existingReadClient = { existing: 'readClient' };
      (global as any).prismaReadOnly = existingReadClient;

      const { prismaReadOnly } = require('../prisma');

      expect(prismaReadOnly).toBe(existingReadClient);
    });
  });

  describe('Module Exports', () => {
    it('should export prisma write client', () => {
      const { prisma } = require('../prisma');

      expect(prisma).toBeDefined();
    });

    it('should export prismaReadOnly client', () => {
      const { prismaReadOnly } = require('../prisma');

      expect(prismaReadOnly).toBeDefined();
    });

    it('should export both clients as separate instances when no globals exist', () => {
      const { prisma, prismaReadOnly } = require('../prisma');

      expect(prisma).toBeDefined();
      expect(prismaReadOnly).toBeDefined();
      // When created fresh (not from globals), they should be different instances
      expect(mockPrismaClient).toHaveBeenCalledTimes(2);
    });
  });

  describe('Singleton Pattern', () => {
    it('should maintain singleton across multiple imports in non-production', () => {
      process.env.NODE_ENV = 'development';

      // First import
      const module1 = require('../prisma');

      // Clear require cache for module but keep globals
      const moduleId = require.resolve('../prisma');
      delete require.cache[moduleId];

      // Second import should reuse global
      const module2 = require('../prisma');

      expect(module1.prisma).toBe(module2.prisma);
      expect(module1.prismaReadOnly).toBe(module2.prismaReadOnly);
    });

    it.skip('should create new instances in production on each import - SKIPPED (Jest module caching)', () => {
      process.env.NODE_ENV = 'production';

      // First import
      require('../prisma');

      // Track how many times mock was called in first import
      const firstImportCalls = mockPrismaClient.mock.calls.length;
      expect(firstImportCalls).toBe(2); // write + read clients

      // Clear require cache to force re-import
      const moduleId = require.resolve('../prisma');
      delete require.cache[moduleId];

      // Second import should create new instances (globals not set in production)
      require('../prisma');

      // Should have created 2 more clients (4 total)
      expect(mockPrismaClient).toHaveBeenCalledTimes(4);
    });
  });

  describe('Environment Variable Handling', () => {
    it('should handle missing DATABASE_URL gracefully', () => {
      delete process.env.DATABASE_URL;
      delete process.env.DATABASE_READ_ONLY_URL;

      // Should not throw when importing
      expect(() => require('../prisma')).not.toThrow();
    });

    it('should handle undefined NODE_ENV with error-only logging', () => {
      delete process.env.NODE_ENV;

      require('../prisma');

      // Should use error-only logging (only 'development' gets verbose logging)
      expect(mockPrismaClient).toHaveBeenCalledWith(
        expect.objectContaining({
          log: ['error'],
        })
      );
    });
  });
});
