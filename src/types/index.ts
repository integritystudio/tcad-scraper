export interface Property {
  id: string;
  property_id: string;
  name: string;
  prop_type: string;
  city: string | null;
  property_address: string;
  assessed_value: number | null;  // Can be null per Prisma schema
  appraised_value: number;
  geo_id: string | null;
  description: string | null;
  search_term: string | null;
  scraped_at: string;
  created_at: string;
  updated_at: string;
}
