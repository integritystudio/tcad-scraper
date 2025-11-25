#!/usr/bin/env tsx
/**
 * Migration Helper: Replace console.log with Pino logger
 *
 * This script helps migrate console.log statements to the Pino logger
 * Usage: tsx migrate-to-logger.ts <file-path>
 */

import * as fs from 'fs';
import * as path from 'path';

function migrateFile(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let hasImport = false;
  let lastImportIndex = -1;

  // Check if logger is already imported
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("import") && line.includes("logger") && line.includes("../lib/logger")) {
      hasImport = true;
      break;
    }
    if (line.startsWith('import ') && !line.includes('type')) {
      lastImportIndex = i;
    }
  }

  // Replace console.log patterns with logger equivalents
  let modified = content;

  // Track different console methods and their logger equivalents
  const replacements: { pattern: RegExp; replacement: string }[] = [
    { pattern: /console\.error\(/g, replacement: 'logger.error(' },
    { pattern: /console\.warn\(/g, replacement: 'logger.warn(' },
    { pattern: /console\.info\(/g, replacement: 'logger.info(' },
    { pattern: /console\.debug\(/g, replacement: 'logger.debug(' },
    { pattern: /console\.log\(/g, replacement: 'logger.info(' },
  ];

  replacements.forEach(({ pattern, replacement }) => {
    modified = modified.replace(pattern, replacement);
  });

  // Add import if not present
  if (!hasImport && modified !== content) {
    const lines = modified.split('\n');
    const insertIndex = lastImportIndex >= 0 ? lastImportIndex + 1 : 0;

    // Calculate relative path
    const fileDir = path.dirname(filePath);
    const loggerPath = path.join(__dirname, '../lib/logger');
    const relativePath = path.relative(fileDir, loggerPath).replace(/\\/g, '/');
    const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;

    lines.splice(insertIndex, 0, `import logger from '${importPath}';`);
    modified = lines.join('\n');
  }

  // Write back if changed
  if (modified !== content) {
    fs.writeFileSync(filePath, modified, 'utf-8');
    console.log(`✅ Migrated: ${filePath}`);
  } else {
    console.log(`⏭️  No changes: ${filePath}`);
  }
}

// Get file path from command line
const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: tsx migrate-to-logger.ts <file-path>');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

try {
  migrateFile(filePath);
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}
