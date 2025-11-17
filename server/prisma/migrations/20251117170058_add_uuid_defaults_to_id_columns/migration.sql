-- Add UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add default UUID generation to id columns
ALTER TABLE properties
ALTER COLUMN id SET DEFAULT uuid_generate_v4();

ALTER TABLE scrape_jobs
ALTER COLUMN id SET DEFAULT uuid_generate_v4();

ALTER TABLE monitored_searches
ALTER COLUMN id SET DEFAULT uuid_generate_v4();

ALTER TABLE search_term_analytics
ALTER COLUMN id SET DEFAULT uuid_generate_v4();
