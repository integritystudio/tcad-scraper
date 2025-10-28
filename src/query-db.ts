import { Pool } from 'pg';
import { stdin, stdout } from 'process';
import * as readline from 'readline';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/tcad_scraper'
});

async function displayStats() {
  console.log('\n📊 Database Statistics\n' + '='.repeat(50));

  const stats = await pool.query(`
    SELECT
      COUNT(*) as total_properties,
      COUNT(DISTINCT city) as unique_cities,
      MAX(scraped_at) as last_scraped
    FROM properties
  `);

  console.log(`Total Properties: ${stats.rows[0].total_properties}`);
  console.log(`Unique Cities: ${stats.rows[0].unique_cities}`);
  console.log(`Last Scraped: ${stats.rows[0].last_scraped || 'Never'}`);
}

async function displayCitySummary() {
  console.log('\n🏙️  Properties by City\n' + '='.repeat(50));

  const cities = await pool.query(`
    SELECT
      city,
      COUNT(*) as property_count,
      AVG(CAST(REPLACE(REPLACE(appraised_value, '$', ''), ',', '') AS NUMERIC)) as avg_value
    FROM properties
    WHERE city IS NOT NULL AND city != ''
    GROUP BY city
    ORDER BY property_count DESC
    LIMIT 10
  `);

  cities.rows.forEach(row => {
    const avgValue = row.avg_value ? `$${Math.round(row.avg_value).toLocaleString()}` : 'N/A';
    console.log(`${row.city.padEnd(20)} | ${String(row.property_count).padStart(5)} properties | Avg: ${avgValue}`);
  });
}

async function displayRecentProperties(limit: number = 10) {
  console.log(`\n🏠 Recent Properties (Last ${limit})\n` + '='.repeat(50));

  const properties = await pool.query(`
    SELECT
      property_id,
      owner_name,
      property_address,
      city,
      appraised_value,
      scraped_at
    FROM properties
    ORDER BY scraped_at DESC
    LIMIT $1
  `, [limit]);

  properties.rows.forEach((prop, idx) => {
    console.log(`\n${idx + 1}. Property ID: ${prop.property_id}`);
    console.log(`   Owner: ${prop.owner_name}`);
    console.log(`   Address: ${prop.property_address}, ${prop.city || 'N/A'}`);
    console.log(`   Value: ${prop.appraised_value || 'N/A'}`);
    console.log(`   Scraped: ${prop.scraped_at}`);
  });
}

async function searchProperties(searchTerm: string) {
  console.log(`\n🔍 Search Results for: "${searchTerm}"\n` + '='.repeat(50));

  const results = await pool.query(`
    SELECT
      property_id,
      owner_name,
      property_address,
      city,
      appraised_value
    FROM properties
    WHERE
      owner_name ILIKE $1 OR
      property_address ILIKE $1 OR
      city ILIKE $1
    LIMIT 20
  `, [`%${searchTerm}%`]);

  if (results.rows.length === 0) {
    console.log('No results found.');
  } else {
    results.rows.forEach((prop, idx) => {
      console.log(`\n${idx + 1}. ${prop.owner_name}`);
      console.log(`   ${prop.property_address}, ${prop.city || 'N/A'}`);
      console.log(`   Value: ${prop.appraised_value || 'N/A'} | ID: ${prop.property_id}`);
    });
  }
}

async function runCustomQuery(query: string) {
  try {
    const result = await pool.query(query);
    console.log('\n✓ Query executed successfully\n');
    console.table(result.rows);
    console.log(`\nRows returned: ${result.rowCount}`);
  } catch (error) {
    console.error('❌ Query error:', error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'stats':
        await displayStats();
        break;
      case 'cities':
        await displayCitySummary();
        break;
      case 'recent':
        const limit = parseInt(args[1]) || 10;
        await displayRecentProperties(limit);
        break;
      case 'search':
        if (!args[1]) {
          console.error('Please provide a search term: npm run db:query search "term"');
          process.exit(1);
        }
        await searchProperties(args[1]);
        break;
      case 'query':
        if (!args[1]) {
          console.error('Please provide a SQL query: npm run db:query query "SELECT * FROM properties LIMIT 5"');
          process.exit(1);
        }
        await runCustomQuery(args[1]);
        break;
      default:
        console.log(`
🗃️  TCAD Property Database Query Tool

Usage: npm run db:query <command> [args]

Commands:
  stats              - Show database statistics
  cities             - Show properties grouped by city
  recent [N]         - Show N most recent properties (default: 10)
  search <term>      - Search properties by owner, address, or city
  query "<SQL>"      - Execute custom SQL query

Examples:
  npm run db:query stats
  npm run db:query cities
  npm run db:query recent 20
  npm run db:query search "Austin"
  npm run db:query query "SELECT * FROM properties WHERE city = 'Austin' LIMIT 5"

Or use: npm run db:stats for quick statistics
        `);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
