#!/usr/bin/env tsx

/**
 * TCAD Scraper - Test Database Setup Script (Cross-platform Node.js version)
 * This script automates the setup of a local test database for development
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as readline from 'readline';

const execAsync = promisify(exec);

// Configuration
const config = {
  dbName: process.env.POSTGRES_DB || 'tcad_scraper_test',
  dbUser: process.env.POSTGRES_USER || 'postgres',
  dbPassword: process.env.POSTGRES_PASSWORD || 'postgres',
  dbHost: process.env.POSTGRES_HOST || 'localhost',
  dbPort: process.env.POSTGRES_PORT || '5432',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: process.env.REDIS_PORT || '6379',
};

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

function log(message: string, color?: keyof typeof colors) {
  const colorCode = color ? colors[color] : '';
  console.log(`${colorCode}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✓ ${message}`, 'green');
}

function error(message: string) {
  log(`✗ ${message}`, 'red');
}

function warning(message: string) {
  log(`⚠ ${message}`, 'yellow');
}

async function checkCommand(command: string): Promise<boolean> {
  try {
    await execAsync(`${command} --version`);
    return true;
  } catch {
    return false;
  }
}

async function checkPostgres(): Promise<boolean> {
  process.stdout.write('Checking PostgreSQL connection... ');
  try {
    const cmd = process.platform === 'win32'
      ? `SET PGPASSWORD=${config.dbPassword} && psql -h ${config.dbHost} -p ${config.dbPort} -U ${config.dbUser} -c "SELECT 1" > nul 2>&1`
      : `PGPASSWORD="${config.dbPassword}" psql -h ${config.dbHost} -p ${config.dbPort} -U ${config.dbUser} -c "SELECT 1" > /dev/null 2>&1`;

    await execAsync(cmd);
    success('PostgreSQL is running');
    return true;
  } catch {
    error('PostgreSQL is not running');
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  process.stdout.write('Checking Redis connection... ');
  try {
    await execAsync(`redis-cli -h ${config.redisHost} -p ${config.redisPort} ping`);
    success('Redis is running');
    return true;
  } catch {
    error('Redis is not running');
    return false;
  }
}

async function createDatabase(): Promise<void> {
  process.stdout.write(`Checking if database '${config.dbName}' exists... `);

  try {
    // Check if database exists
    const checkCmd = process.platform === 'win32'
      ? `SET PGPASSWORD=${config.dbPassword} && psql -h ${config.dbHost} -p ${config.dbPort} -U ${config.dbUser} -lqt`
      : `PGPASSWORD="${config.dbPassword}" psql -h ${config.dbHost} -p ${config.dbPort} -U ${config.dbUser} -lqt`;

    const { stdout } = await execAsync(checkCmd);

    if (stdout.includes(config.dbName)) {
      warning('Database already exists');
      return;
    }

    // Create database
    console.log('Creating...');
    const createCmd = process.platform === 'win32'
      ? `SET PGPASSWORD=${config.dbPassword} && psql -h ${config.dbHost} -p ${config.dbPort} -U ${config.dbUser} -c "CREATE DATABASE ${config.dbName};"`
      : `PGPASSWORD="${config.dbPassword}" psql -h ${config.dbHost} -p ${config.dbPort} -U ${config.dbUser} -c "CREATE DATABASE ${config.dbName};"`;

    await execAsync(createCmd);
    success(`Database '${config.dbName}' created successfully`);
  } catch (err) {
    error(`Failed to create database: ${(err as Error).message}`);
    throw err;
  }
}

async function runMigrations(): Promise<void> {
  console.log('Running Prisma migrations...');
  const databaseUrl = `postgresql://${config.dbUser}:${config.dbPassword}@${config.dbHost}:${config.dbPort}/${config.dbName}`;

  process.env.DATABASE_URL = databaseUrl;

  try {
    // Generate Prisma Client
    process.stdout.write('Generating Prisma Client... ');
    await execAsync('npx prisma generate', {
      env: { ...process.env, DATABASE_URL: databaseUrl }
    });
    success('Done');

    // Run migrations
    process.stdout.write('Deploying migrations... ');
    await execAsync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: databaseUrl }
    });
    success('Done');
  } catch (err) {
    error(`Migration failed: ${(err as Error).message}`);
    throw err;
  }
}

async function verifySchema(): Promise<void> {
  process.stdout.write('Verifying database schema... ');

  try {
    const cmd = process.platform === 'win32'
      ? `SET PGPASSWORD=${config.dbPassword} && psql -h ${config.dbHost} -p ${config.dbPort} -U ${config.dbUser} -d ${config.dbName} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"`
      : `PGPASSWORD="${config.dbPassword}" psql -h ${config.dbHost} -p ${config.dbPort} -U ${config.dbUser} -d ${config.dbName} -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"`;

    const { stdout } = await execAsync(cmd);
    const tableCount = parseInt(stdout.trim(), 10);

    if (tableCount > 0) {
      success(`Found ${tableCount} tables`);
    } else {
      error('No tables found');
      throw new Error('Schema verification failed');
    }
  } catch (err) {
    error(`Schema verification failed: ${(err as Error).message}`);
    throw err;
  }
}

async function promptUser(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function seedTestData(): Promise<void> {
  const shouldSeed = await promptUser('Would you like to seed test data? (y/N): ');

  if (shouldSeed) {
    console.log('Seeding test data...');
    warning('Seed script not implemented yet');
  }
}

async function main() {
  console.log('==========================================');
  console.log('TCAD Scraper - Test Database Setup');
  console.log('==========================================');
  console.log('');

  console.log('Configuration:');
  console.log(`  Database: ${config.dbName}`);
  console.log(`  User: ${config.dbUser}`);
  console.log(`  Host: ${config.dbHost}:${config.dbPort}`);
  console.log(`  Redis: ${config.redisHost}:${config.redisPort}`);
  console.log('');

  try {
    // Check prerequisites
    const hasPsql = await checkCommand('psql');
    if (!hasPsql) {
      error('PostgreSQL client (psql) not found. Please install PostgreSQL.');
      process.exit(1);
    }

    const hasRedis = await checkCommand('redis-cli');
    if (!hasRedis) {
      warning('Redis CLI not found. Skipping Redis check.');
    } else {
      const redisRunning = await checkRedis();
      if (!redisRunning) {
        warning('Redis is not running. Tests may fail.');
        console.log('  To start Redis: redis-server');
      }
    }

    // Check PostgreSQL
    const postgresRunning = await checkPostgres();
    if (!postgresRunning) {
      console.log('');
      error('Cannot connect to PostgreSQL');
      console.log('');
      console.log('To start PostgreSQL:');
      console.log(`  - macOS (Homebrew): brew services start postgresql`);
      console.log(`  - Docker: docker run --name postgres -e POSTGRES_PASSWORD=${config.dbPassword} -p 5432:5432 -d postgres:16`);
      console.log(`  - Linux (systemd): sudo systemctl start postgresql`);
      console.log(`  - Windows: net start postgresql-x64-16`);
      console.log('');
      process.exit(1);
    }

    console.log('');

    // Create database
    await createDatabase();

    console.log('');

    // Run migrations
    await runMigrations();

    console.log('');

    // Verify schema
    await verifySchema();

    console.log('');

    // Optional: Seed data
    await seedTestData();

    console.log('');
    console.log('==========================================');
    success('Test database setup complete!');
    console.log('==========================================');
    console.log('');
    console.log(`Database URL: postgresql://${config.dbUser}:${config.dbPassword}@${config.dbHost}:${config.dbPort}/${config.dbName}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run tests: npm test');
    console.log('  2. Start dev server: npm run dev');
    console.log('  3. View database: npm run prisma:studio');
    console.log('');

    process.exit(0);
  } catch (err) {
    console.log('');
    error(`Setup failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

// Run main function
main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
