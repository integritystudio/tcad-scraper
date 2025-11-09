#!/usr/bin/env node
/**
 * Check for potential field name mismatches
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFields() {
  const prop = await prisma.property.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  
  if (!prop) {
    console.log('No properties found');
    return;
  }
  
  console.log('Property from Prisma (all fields):');
  console.log(JSON.stringify(prop, null, 2));
  
  console.log('\n\nField names:');
  Object.keys(prop).forEach(key => {
    console.log(`  ${key}: ${typeof prop[key]} = ${prop[key]}`);
  });
  
  console.log('\n\nTransformed (simulating controller):');
  const transformed = {
    id: prop.id,
    property_id: prop.propertyId,
    name: prop.name,
    prop_type: prop.propType,
    city: prop.city,
    property_address: prop.propertyAddress,
    assessed_value: prop.assessedValue,
    appraised_value: prop.appraisedValue,
    geo_id: prop.geoId,
    description: prop.description,
    search_term: prop.searchTerm,
    scraped_at: prop.scrapedAt.toISOString(),
    created_at: prop.createdAt.toISOString(),
    updated_at: prop.updatedAt.toISOString(),
  };
  
  console.log(JSON.stringify(transformed, null, 2));
  
  await prisma.$disconnect();
}

checkFields().catch(console.error);
