#!/usr/bin/env node
/**
 * Debug script to check appraisal values in the database
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugAppraisalValues() {
  console.log('🔍 Checking for properties with null/invalid appraisal values...\n');

  // Get sample of properties
  const properties = await prisma.property.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      propertyId: true,
      name: true,
      appraisedValue: true,
      assessedValue: true,
    }
  });

  console.log(`Found ${properties.length} properties\n`);

  properties.forEach((prop, index) => {
    console.log(`${index + 1}. ${prop.name} (ID: ${prop.propertyId})`);
    console.log(`   Appraised Value: ${prop.appraisedValue} (type: ${typeof prop.appraisedValue})`);
    console.log(`   Assessed Value: ${prop.assessedValue} (type: ${typeof prop.assessedValue})`);

    // Check for issues
    if (prop.appraisedValue === null) {
      console.log(`   ⚠️  NULL appraisedValue!`);
    } else if (typeof prop.appraisedValue !== 'number') {
      console.log(`   ⚠️  appraisedValue is not a number! It's a ${typeof prop.appraisedValue}`);
    } else if (isNaN(prop.appraisedValue)) {
      console.log(`   ⚠️  appraisedValue is NaN!`);
    } else if (prop.appraisedValue === 0) {
      console.log(`   ⚠️  appraisedValue is 0!`);
    }

    console.log('');
  });

  // Count properties with problematic values
  const nullCount = await prisma.property.count({
    where: { appraisedValue: null }
  });

  const zeroCount = await prisma.property.count({
    where: { appraisedValue: 0 }
  });

  console.log(`\n📊 Statistics:`);
  console.log(`   Properties with NULL appraisedValue: ${nullCount}`);
  console.log(`   Properties with ZERO appraisedValue: ${zeroCount}`);

  await prisma.$disconnect();
}

debugAppraisalValues().catch(console.error);
