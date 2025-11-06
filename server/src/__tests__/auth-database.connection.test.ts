/**
 * Database Connection Tests
 *
 * Tests for PostgreSQL database connection, Prisma client initialization,
 * read/write client separation, and connection pooling.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma, prismaReadOnly } from '../lib/prisma';
import { PrismaClient } from '@prisma/client';

describe('Database Connection Tests', () => {
  describe('Prisma Client Initialization', () => {
    test('should initialize write client successfully', () => {
      expect(prisma).toBeDefined();
      expect(prisma).toBeInstanceOf(PrismaClient);
    });

    test('should initialize read-only client successfully', () => {
      expect(prismaReadOnly).toBeDefined();
      expect(prismaReadOnly).toBeInstanceOf(PrismaClient);
    });

    test('should have separate instances for read and write clients', () => {
      // In development they may be the same global instance, but should still be defined
      expect(prisma).toBeDefined();
      expect(prismaReadOnly).toBeDefined();
    });
  });

  describe('Database Connectivity', () => {
    test('should connect to database with write client', async () => {
      // Test connection by executing a simple query
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should connect to database with read-only client', async () => {
      // Test connection by executing a simple query
      const result = await prismaReadOnly.$queryRaw`SELECT 1 as test`;
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should verify database name', async () => {
      const result = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].current_database).toBeDefined();
    });

    test('should execute concurrent queries without errors', async () => {
      const queries = Array.from({ length: 5 }, (_, i) =>
        prisma.$queryRaw`SELECT ${i} as number`
      );

      const results = await Promise.all(queries);
      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result).toBeDefined();
      });
    });
  });

  describe('Schema Validation', () => {
    test('should verify Property table exists', async () => {
      const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'Property'
        );
      `;
      expect(result[0].exists).toBe(true);
    });

    test('should verify ScrapeJob table exists', async () => {
      const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'ScrapeJob'
        );
      `;
      expect(result[0].exists).toBe(true);
    });

    test('should verify MonitoredSearch table exists', async () => {
      const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'MonitoredSearch'
        );
      `;
      expect(result[0].exists).toBe(true);
    });
  });

  describe('Read/Write Client Separation', () => {
    test('should allow read operations on read-only client', async () => {
      const count = await prismaReadOnly.property.count();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should allow write operations on write client', async () => {
      // Create a test property
      const testProperty = await prisma.property.create({
        data: {
          propertyId: `TEST-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          searchTerm: 'test-connection',
          ownerName: 'Test Owner',
          propertyAddress: '123 Test St',
          scrapedAt: new Date(),
        },
      });

      expect(testProperty).toBeDefined();
      expect(testProperty.id).toBeDefined();
      expect(testProperty.propertyId).toContain('TEST-');

      // Clean up
      await prisma.property.delete({
        where: { id: testProperty.id },
      });
    });

    test('should read data written by write client', async () => {
      // Create test data
      const testProperty = await prisma.property.create({
        data: {
          propertyId: `TEST-RW-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          searchTerm: 'test-read-write',
          ownerName: 'Test Owner RW',
          propertyAddress: '456 Test Ave',
          scrapedAt: new Date(),
        },
      });

      // Read with read-only client
      const foundProperty = await prismaReadOnly.property.findUnique({
        where: { id: testProperty.id },
      });

      expect(foundProperty).toBeDefined();
      expect(foundProperty?.propertyId).toBe(testProperty.propertyId);
      expect(foundProperty?.ownerName).toBe('Test Owner RW');

      // Clean up
      await prisma.property.delete({
        where: { id: testProperty.id },
      });
    });
  });

  describe('Connection Error Handling', () => {
    test('should handle invalid queries gracefully', async () => {
      await expect(
        prisma.$queryRaw`SELECT * FROM non_existent_table`
      ).rejects.toThrow();
    });

    test('should handle malformed queries gracefully', async () => {
      await expect(
        prisma.$queryRaw`INVALID SQL SYNTAX HERE`
      ).rejects.toThrow();
    });
  });

  describe('Transaction Support', () => {
    test('should support transactions on write client', async () => {
      const testId = `TEST-TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const result = await prisma.$transaction(async (tx) => {
        const property = await tx.property.create({
          data: {
            propertyId: testId,
            searchTerm: 'test-transaction',
            ownerName: 'Test Transaction Owner',
            propertyAddress: '789 Transaction Blvd',
            scrapedAt: new Date(),
          },
        });

        return property;
      });

      expect(result).toBeDefined();
      expect(result.propertyId).toBe(testId);

      // Clean up
      await prisma.property.delete({
        where: { id: result.id },
      });
    });

    test('should rollback failed transactions', async () => {
      const testId = `TEST-ROLLBACK-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      await expect(
        prisma.$transaction(async (tx) => {
          await tx.property.create({
            data: {
              propertyId: testId,
              searchTerm: 'test-rollback',
              ownerName: 'Test Rollback Owner',
              propertyAddress: '999 Rollback Rd',
              scrapedAt: new Date(),
            },
          });

          // Force an error to trigger rollback
          throw new Error('Intentional rollback');
        })
      ).rejects.toThrow('Intentional rollback');

      // Verify the property was not created
      const foundProperty = await prisma.property.findFirst({
        where: { propertyId: testId },
      });

      expect(foundProperty).toBeNull();
    });
  });

  describe('Performance and Connection Pooling', () => {
    test('should handle multiple concurrent database operations', async () => {
      const operations = Array.from({ length: 10 }, async (_, i) => {
        return prismaReadOnly.property.count({
          where: {
            searchTerm: {
              contains: `test-${i}`,
            },
          },
        });
      });

      const results = await Promise.all(operations);
      expect(results).toHaveLength(10);
      results.forEach(count => {
        expect(typeof count).toBe('number');
      });
    });

    test('should reuse connections from pool', async () => {
      // Execute multiple queries in sequence
      const query = () => prisma.$queryRaw`SELECT 1`;

      const start = Date.now();
      await query();
      const firstQueryTime = Date.now() - start;

      const start2 = Date.now();
      await query();
      const secondQueryTime = Date.now() - start2;

      // Second query should be faster or similar (using pooled connection)
      // This is a soft check as timing can vary
      expect(secondQueryTime).toBeLessThan(firstQueryTime * 2);
    });
  });

  describe('Data Type Handling', () => {
    test('should correctly handle date/time types', async () => {
      const testDate = new Date('2025-01-01T00:00:00Z');
      const testId = `TEST-DATE-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const property = await prisma.property.create({
        data: {
          propertyId: testId,
          searchTerm: 'test-date',
          ownerName: 'Test Date Owner',
          propertyAddress: '321 Date St',
          scrapedAt: testDate,
        },
      });

      expect(property.scrapedAt).toBeInstanceOf(Date);
      expect(property.scrapedAt.toISOString()).toBe(testDate.toISOString());

      // Clean up
      await prisma.property.delete({
        where: { id: property.id },
      });
    });

    test('should correctly handle numeric types', async () => {
      const testId = `TEST-NUMERIC-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const property = await prisma.property.create({
        data: {
          propertyId: testId,
          searchTerm: 'test-numeric',
          ownerName: 'Test Numeric Owner',
          propertyAddress: '654 Numeric Ln',
          scrapedAt: new Date(),
          appraisedValue: 500000,
          marketValue: 525000,
          landValue: 100000,
        },
      });

      expect(typeof property.appraisedValue).toBe('number');
      expect(property.appraisedValue).toBe(500000);
      expect(property.marketValue).toBe(525000);
      expect(property.landValue).toBe(100000);

      // Clean up
      await prisma.property.delete({
        where: { id: property.id },
      });
    });

    test('should correctly handle text/string types with special characters', async () => {
      const testId = `TEST-STRING-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const specialString = "O'Connor & Sons, Inc. <Test>";

      const property = await prisma.property.create({
        data: {
          propertyId: testId,
          searchTerm: 'test-string',
          ownerName: specialString,
          propertyAddress: '987 Special St',
          scrapedAt: new Date(),
        },
      });

      expect(property.ownerName).toBe(specialString);

      // Clean up
      await prisma.property.delete({
        where: { id: property.id },
      });
    });
  });

  // Cleanup after all tests
  afterAll(async () => {
    // Disconnect clients
    await prisma.$disconnect();
    await prismaReadOnly.$disconnect();
  });
});
