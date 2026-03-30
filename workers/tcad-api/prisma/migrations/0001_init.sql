-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "property_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prop_type" TEXT NOT NULL,
    "city" TEXT,
    "property_address" TEXT NOT NULL,
    "assessed_value" REAL,
    "appraised_value" REAL NOT NULL,
    "geo_id" TEXT,
    "description" TEXT,
    "search_term" TEXT,
    "scraped_at" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',
    "updated_at" TEXT NOT NULL DEFAULT '',
    "year" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "scrape_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "search_term" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result_count" INTEGER,
    "total_api_results" INTEGER,
    "updated_count" INTEGER,
    "new_property_ids" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT,
    "started_at" TEXT NOT NULL DEFAULT '',
    "completed_at" TEXT
);

-- CreateTable
CREATE TABLE "monitored_searches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "search_term" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "last_run" TEXT,
    "created_at" TEXT NOT NULL DEFAULT '',
    "updated_at" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "search_term_analytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "search_term" TEXT NOT NULL,
    "term_length" INTEGER NOT NULL,
    "total_searches" INTEGER NOT NULL DEFAULT 0,
    "successful_searches" INTEGER NOT NULL DEFAULT 0,
    "failed_searches" INTEGER NOT NULL DEFAULT 0,
    "total_results" INTEGER NOT NULL DEFAULT 0,
    "avg_results_per_search" REAL NOT NULL DEFAULT 0,
    "max_results" INTEGER NOT NULL DEFAULT 0,
    "min_results" INTEGER,
    "last_searched" TEXT NOT NULL,
    "success_rate" REAL NOT NULL DEFAULT 0,
    "efficiency" REAL NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL DEFAULT '',
    "updated_at" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "api_usage_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "query_text" TEXT NOT NULL,
    "query_cost" REAL NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "response_time" INTEGER,
    "timestamp" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE INDEX "properties_search_term_scraped_at_idx" ON "properties"("search_term", "scraped_at");

-- CreateIndex
CREATE INDEX "properties_property_id_idx" ON "properties"("property_id");

-- CreateIndex
CREATE INDEX "properties_city_idx" ON "properties"("city");

-- CreateIndex
CREATE INDEX "properties_prop_type_idx" ON "properties"("prop_type");

-- CreateIndex
CREATE INDEX "properties_appraised_value_idx" ON "properties"("appraised_value");

-- CreateIndex
CREATE INDEX "properties_year_idx" ON "properties"("year");

-- CreateIndex
CREATE INDEX "properties_city_prop_type_idx" ON "properties"("city", "prop_type");

-- CreateIndex
CREATE INDEX "properties_city_appraised_value_idx" ON "properties"("city", "appraised_value");

-- CreateIndex
CREATE INDEX "properties_prop_type_appraised_value_idx" ON "properties"("prop_type", "appraised_value");

-- CreateIndex
CREATE INDEX "properties_city_prop_type_appraised_value_idx" ON "properties"("city", "prop_type", "appraised_value");

-- CreateIndex
CREATE INDEX "properties_year_city_idx" ON "properties"("year", "city");

-- CreateIndex
CREATE UNIQUE INDEX "properties_property_id_year_key" ON "properties"("property_id", "year");

-- CreateIndex
CREATE INDEX "scrape_jobs_status_started_at_idx" ON "scrape_jobs"("status", "started_at");

-- CreateIndex
CREATE INDEX "scrape_jobs_search_term_idx" ON "scrape_jobs"("search_term");

-- CreateIndex
CREATE UNIQUE INDEX "monitored_searches_search_term_key" ON "monitored_searches"("search_term");

-- CreateIndex
CREATE INDEX "search_term_analytics_efficiency_idx" ON "search_term_analytics"("efficiency");

-- CreateIndex
CREATE INDEX "search_term_analytics_avg_results_per_search_idx" ON "search_term_analytics"("avg_results_per_search");

-- CreateIndex
CREATE INDEX "search_term_analytics_term_length_idx" ON "search_term_analytics"("term_length");

-- CreateIndex
CREATE INDEX "search_term_analytics_last_searched_idx" ON "search_term_analytics"("last_searched");

-- CreateIndex
CREATE UNIQUE INDEX "search_term_analytics_search_term_key" ON "search_term_analytics"("search_term");

-- CreateIndex
CREATE INDEX "api_usage_logs_timestamp_idx" ON "api_usage_logs"("timestamp");

-- CreateIndex
CREATE INDEX "api_usage_logs_environment_idx" ON "api_usage_logs"("environment");

-- CreateIndex
CREATE INDEX "api_usage_logs_success_idx" ON "api_usage_logs"("success");

-- CreateIndex
CREATE INDEX "api_usage_logs_model_idx" ON "api_usage_logs"("model");

