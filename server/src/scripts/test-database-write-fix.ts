/**
 * Test script to verify the database write fix
 *
 * This script tests that:
 * 1. New properties are correctly counted as INSERTs
 * 2. Duplicate properties are counted as UPDATEs (not as new)
 * 3. resultCount reflects actual NEW properties, not total scraped
 *
 * Usage: npx tsx src/scripts/test-database-write-fix.ts
 */

import { PrismaClient } from '@prisma/client';

// Simple console logger for test script
const logger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
};

const prisma = new PrismaClient();

interface TestProperty {
  propertyId: string;
  name: string;
  propType: string | null;
  city: string | null;
  propertyAddress: string | null;
  assessedValue: number | null;
  appraisedValue: number | null;
  geoId: string | null;
  description: string | null;
}

async function testDatabaseWriteFix() {
  try {
    logger.info('🧪 Starting database write fix test...\n');

    // Step 1: Get baseline count
    const beforeCount = await prisma.property.count();
    logger.info(`📊 Baseline: ${beforeCount.toLocaleString()} properties in database\n`);

    // Step 2: Create test properties (mix of new and existing)
    const testProperties: TestProperty[] = [
      // New property 1
      {
        propertyId: 'TEST-NEW-001',
        name: 'Test Property New 1',
        propType: 'Residential',
        city: 'Austin',
        propertyAddress: '123 Test Lane',
        assessedValue: 500000,
        appraisedValue: 525000,
        geoId: 'TEST-GEO-001',
        description: 'Test property for database fix verification',
      },
      // New property 2
      {
        propertyId: 'TEST-NEW-002',
        name: 'Test Property New 2',
        propType: 'Commercial',
        city: 'Austin',
        propertyAddress: '456 Test Avenue',
        assessedValue: 750000,
        appraisedValue: 800000,
        geoId: 'TEST-GEO-002',
        description: 'Another test property',
      },
      // Duplicate property (will use first existing property from DB)
    ];

    // Get one existing property to test UPDATE behavior
    const existingProperty = await prisma.property.findFirst({
      select: {
        propertyId: true,
        name: true,
        propType: true,
        city: true,
        propertyAddress: true,
        assessedValue: true,
        appraisedValue: true,
        geoId: true,
        description: true,
      },
    });

    if (existingProperty) {
      testProperties.push({
        propertyId: existingProperty.propertyId,
        name: existingProperty.name + ' (UPDATED)',
        propType: existingProperty.propType,
        city: existingProperty.city,
        propertyAddress: existingProperty.propertyAddress,
        assessedValue: existingProperty.assessedValue,
        appraisedValue: existingProperty.appraisedValue,
        geoId: existingProperty.geoId,
        description: 'Updated via test script',
      });
      logger.info(`🔄 Using existing property ${existingProperty.propertyId} to test UPDATE\n`);
    }

    logger.info(`📝 Test batch: ${testProperties.length} properties (2 new, 1 existing)\n`);

    // Step 3: Execute the fixed upsert logic
    const now = new Date();
    const searchTerm = 'TEST-SEARCH';
    const valuesClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const property of testProperties) {
      valuesClauses.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, ` +
        `$${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, ` +
        `$${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12})`
      );

      params.push(
        property.propertyId,
        property.name,
        property.propType,
        property.city,
        property.propertyAddress,
        property.assessedValue,
        property.appraisedValue,
        property.geoId,
        property.description,
        searchTerm,
        now,
        now,
        now
      );

      paramIndex += 13;
    }

    const sql = `
      INSERT INTO properties (
        property_id, name, prop_type, city, property_address,
        assessed_value, appraised_value, geo_id, description,
        search_term, scraped_at, created_at, updated_at
      )
      VALUES ${valuesClauses.join(', ')}
      ON CONFLICT (property_id) DO UPDATE SET
        name = EXCLUDED.name,
        prop_type = EXCLUDED.prop_type,
        city = EXCLUDED.city,
        property_address = EXCLUDED.property_address,
        assessed_value = EXCLUDED.assessed_value,
        appraised_value = EXCLUDED.appraised_value,
        geo_id = EXCLUDED.geo_id,
        description = EXCLUDED.description,
        search_term = EXCLUDED.search_term,
        scraped_at = EXCLUDED.scraped_at,
        updated_at = EXCLUDED.updated_at
      RETURNING (xmax = 0) AS inserted
    `;

    logger.info('🔧 Executing upsert with RETURNING clause...\n');
    const result = await prisma.$queryRawUnsafe<{ inserted: boolean }[]>(sql, ...params);

    // Step 4: Analyze results
    const newPropertyCount = result.filter(r => r.inserted).length;
    const updatedPropertyCount = result.length - newPropertyCount;

    logger.info('✅ Results:');
    logger.info(`   Total processed: ${result.length}`);
    logger.info(`   New (INSERT): ${newPropertyCount}`);
    logger.info(`   Updated (UPDATE): ${updatedPropertyCount}\n`);

    // Step 5: Verify database count
    const afterCount = await prisma.property.count();
    const actualNewRecords = afterCount - beforeCount;

    logger.info('📊 Database verification:');
    logger.info(`   Before: ${beforeCount.toLocaleString()}`);
    logger.info(`   After: ${afterCount.toLocaleString()}`);
    logger.info(`   Actual new records: ${actualNewRecords}\n`);

    // Step 6: Validate fix
    const testsPassed: string[] = [];
    const testsFailed: string[] = [];

    if (newPropertyCount === actualNewRecords) {
      testsPassed.push('✅ RETURNING clause count matches database count');
    } else {
      testsFailed.push(`❌ Count mismatch: RETURNING=${newPropertyCount}, DB=${actualNewRecords}`);
    }

    if (newPropertyCount === 2) {
      testsPassed.push('✅ Correctly identified 2 new properties');
    } else {
      testsFailed.push(`❌ Expected 2 new properties, got ${newPropertyCount}`);
    }

    if (updatedPropertyCount === 1) {
      testsPassed.push('✅ Correctly identified 1 updated property');
    } else {
      testsFailed.push(`❌ Expected 1 updated property, got ${updatedPropertyCount}`);
    }

    // Step 7: Report results
    logger.info('🎯 Test Results:');
    testsPassed.forEach(msg => logger.info(`   ${msg}`));
    testsFailed.forEach(msg => logger.error(`   ${msg}`));
    logger.info('');

    if (testsFailed.length === 0) {
      logger.info('🎉 ALL TESTS PASSED! Database write fix is working correctly.\n');

      // Cleanup test data
      logger.info('🧹 Cleaning up test data...');
      await prisma.property.deleteMany({
        where: {
          propertyId: {
            in: ['TEST-NEW-001', 'TEST-NEW-002'],
          },
        },
      });
      logger.info('✅ Test data cleaned up\n');

      return true;
    } else {
      logger.error('❌ TESTS FAILED! Fix needs adjustment.\n');
      return false;
    }

  } catch (error) {
    logger.error('💥 Test script failed:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDatabaseWriteFix()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
