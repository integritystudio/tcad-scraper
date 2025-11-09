#!/usr/bin/env node
/**
 * Analyze all properties in the database for appraisal value issues
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeProperties() {
  console.log('🔍 Analyzing ALL properties in the database...\n');
  
  const totalCount = await prisma.property.count();
  console.log(`Total properties: ${totalCount}\n`);
  
  // Get all properties (might be a lot, but let's see the distribution)
  const properties = await prisma.property.findMany({
    select: {
      id: true,
      name: true,
      appraisedValue: true,
      assessedValue: true,
      searchTerm: true,
    }
  });
  
  let nullCount = 0;
  let zeroCount = 0;
  let validCount = 0;
  let nanCount = 0;
  
  const samples = {
    null: [],
    zero: [],
    valid: [],
    nan: []
  };
  
  properties.forEach(prop => {
    if (prop.appraisedValue === null) {
      nullCount++;
      if (samples.null.length < 3) samples.null.push(prop);
    } else if (isNaN(prop.appraisedValue)) {
      nanCount++;
      if (samples.nan.length < 3) samples.nan.push(prop);
    } else if (prop.appraisedValue === 0) {
      zeroCount++;
      if (samples.zero.length < 3) samples.zero.push(prop);
    } else {
      validCount++;
      if (samples.valid.length < 3) samples.valid.push(prop);
    }
  });
  
  console.log('📊 Appraisal Value Distribution:');
  console.log(`   NULL values: ${nullCount} (${(nullCount/totalCount*100).toFixed(1)}%)`);
  console.log(`   NaN values: ${nanCount} (${(nanCount/totalCount*100).toFixed(1)}%)`);
  console.log(`   ZERO values: ${zeroCount} (${(zeroCount/totalCount*100).toFixed(1)}%)`);
  console.log(`   Valid (> 0): ${validCount} (${(validCount/totalCount*100).toFixed(1)}%)`);
  
  if (samples.zero.length > 0) {
    console.log('\n📋 Sample ZERO value properties:');
    samples.zero.forEach(p => {
      console.log(`   ${p.name} - searchTerm: "${p.searchTerm}"`);
    });
  }
  
  if (samples.valid.length > 0) {
    console.log('\n✅ Sample VALID properties:');
    samples.valid.forEach(p => {
      console.log(`   ${p.name} - value: $${p.appraisedValue.toLocaleString()}`);
    });
  }
  
  await prisma.$disconnect();
}

analyzeProperties().catch(console.error);
