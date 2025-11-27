#!/usr/bin/env tsx
/**
 * Generate build-time constants from database
 *
 * This script fetches the total property count from the database
 * and generates a TypeScript constants file for use in the frontend.
 *
 * Run this before building the frontend to ensure the property count is up-to-date.
 *
 * Note: This script imports Prisma from the server directory
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, join, dirname } from 'path';

// Import Prisma client from server directory
async function importPrismaClient() {
  const serverPrismaPath = resolve(process.cwd(), 'server/node_modules/@prisma/client');
  try {
    const { PrismaClient } = await import(serverPrismaPath);
    return new PrismaClient();
  } catch (error) {
    console.error('Failed to import Prisma client from server directory');
    throw error;
  }
}

async function generateBuildConstants() {
  let prisma;

  try {
    console.log('📊 Initializing Prisma client...');
    prisma = await importPrismaClient();

    console.log('📊 Fetching property count from database...');

    // Fetch total property count
    const totalProperties = await prisma.property.count();

    console.log(`✓ Found ${totalProperties.toLocaleString()} properties`);

    // Generate TypeScript constants file
    const constantsFileContent = `/**
 * Build-time constants
 *
 * This file is auto-generated during the build process.
 * Do not edit manually - changes will be overwritten.
 *
 * Generated: ${new Date().toISOString()}
 */

export const BUILD_CONSTANTS = {
  /**
   * Total number of properties in the database at build time
   */
  TOTAL_PROPERTIES: ${totalProperties},

  /**
   * Build timestamp
   */
  BUILD_TIMESTAMP: '${new Date().toISOString()}',

  /**
   * Formatted property count for display
   */
  TOTAL_PROPERTIES_FORMATTED: '${totalProperties.toLocaleString()}',
} as const;
`;

    // Write to src/constants/build.ts
    const outputPath = resolve(process.cwd(), 'src/constants/build.ts');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, constantsFileContent, 'utf-8');

    console.log(`✓ Generated constants file: ${outputPath}`);
    console.log(`✓ Total properties: ${totalProperties.toLocaleString()}`);

  } catch (error) {
    console.error('✗ Failed to generate build constants:', error);

    // Use environment variable or hardcoded fallback for production builds
    const fallbackCount = process.env.FALLBACK_PROPERTY_COUNT
      ? parseInt(process.env.FALLBACK_PROPERTY_COUNT, 10)
      : 418823; // Last known count as of Nov 26, 2025

    console.log(`⚠️  Using fallback property count: ${fallbackCount.toLocaleString()}`);

    // Generate fallback constants file with approximate count
    const fallbackContent = `/**
 * Build-time constants (FALLBACK)
 *
 * This file was generated with fallback values due to database connection failure.
 * Property count is approximate and should be updated periodically.
 *
 * Generated: ${new Date().toISOString()}
 */

export const BUILD_CONSTANTS = {
  TOTAL_PROPERTIES: ${fallbackCount},
  BUILD_TIMESTAMP: '${new Date().toISOString()}',
  TOTAL_PROPERTIES_FORMATTED: '${fallbackCount.toLocaleString()}',
} as const;
`;

    const outputPath = resolve(process.cwd(), 'src/constants/build.ts');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, fallbackContent, 'utf-8');

    console.log('⚠️  Generated fallback constants file (database unavailable)');
    console.log(`⚠️  Using approximate count: ${fallbackCount.toLocaleString()} properties`);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

generateBuildConstants();
