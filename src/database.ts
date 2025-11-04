import { Pool } from 'pg';

// Database connection configuration
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export interface Property {
  name: string;
  propType: string;
  city: string | null | undefined;
  propertyAddress: string;
  assessedValue: string;
  propertyID: string;
  appraisedValue: string;
  geoID: string | null | undefined;
  description: string | null | undefined;
}

/**
 * Insert a single property into the database
 */
export async function insertProperty(property: Property): Promise<void> {
  const query = `
    INSERT INTO properties (
      property_id, owner_name, property_type, city,
      property_address, assessed_value, appraised_value,
      geo_id, legal_description
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (property_id)
    DO UPDATE SET
      owner_name = EXCLUDED.owner_name,
      property_type = EXCLUDED.property_type,
      city = EXCLUDED.city,
      property_address = EXCLUDED.property_address,
      assessed_value = EXCLUDED.assessed_value,
      appraised_value = EXCLUDED.appraised_value,
      geo_id = EXCLUDED.geo_id,
      legal_description = EXCLUDED.legal_description,
      updated_at = CURRENT_TIMESTAMP
  `;

  const values = [
    property.propertyID,
    property.name,
    property.propType,
    property.city,
    property.propertyAddress,
    property.assessedValue,
    property.appraisedValue,
    property.geoID,
    property.description
  ];

  try {
    await pool.query(query, values);
    console.log(`✓ Saved property: ${property.propertyID}`);
  } catch (error) {
    console.error(`✗ Error saving property ${property.propertyID}:`, error);
    throw error;
  }
}

/**
 * Insert multiple properties at once
 */
export async function insertProperties(properties: Property[]): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const property of properties) {
      await insertProperty(property);
    }

    await client.query('COMMIT');
    console.log(`✓ Successfully saved ${properties.length} properties`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Error saving properties:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Query properties by city
 */
export async function getPropertiesByCity(city: string): Promise<Property[]> {
  const query = 'SELECT * FROM properties WHERE city = $1 ORDER BY appraised_value DESC';
  const result = await pool.query(query, [city]);
  return result.rows;
}

/**
 * Get total property count
 */
export async function getPropertyCount(): Promise<number> {
  const result = await pool.query('SELECT COUNT(*) FROM properties');
  return parseInt(result.rows[0].count);
}

/**
 * Close database connection pool
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
