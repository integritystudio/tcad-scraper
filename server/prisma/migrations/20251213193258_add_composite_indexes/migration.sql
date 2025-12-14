-- CreateIndex
CREATE INDEX IF NOT EXISTS "properties_city_prop_type_idx" ON "properties"("city", "prop_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "properties_city_appraised_value_idx" ON "properties"("city", "appraised_value");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "properties_prop_type_appraised_value_idx" ON "properties"("prop_type", "appraised_value");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "properties_city_prop_type_appraised_value_idx" ON "properties"("city", "prop_type", "appraised_value");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "properties_scraped_at_desc_idx" ON "properties"("scraped_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "properties_year_city_idx" ON "properties"("year", "city");
