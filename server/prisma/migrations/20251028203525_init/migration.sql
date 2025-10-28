-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prop_type" TEXT NOT NULL,
    "city" TEXT,
    "property_address" TEXT NOT NULL,
    "assessed_value" DOUBLE PRECISION,
    "appraised_value" DOUBLE PRECISION NOT NULL,
    "geo_id" TEXT,
    "description" TEXT,
    "search_term" TEXT,
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_jobs" (
    "id" TEXT NOT NULL,
    "search_term" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result_count" INTEGER,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "scrape_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitored_searches" (
    "id" TEXT NOT NULL,
    "search_term" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "last_run" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitored_searches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "properties_property_id_key" ON "properties"("property_id");

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
CREATE INDEX "scrape_jobs_status_started_at_idx" ON "scrape_jobs"("status", "started_at");

-- CreateIndex
CREATE INDEX "scrape_jobs_search_term_idx" ON "scrape_jobs"("search_term");

-- CreateIndex
CREATE UNIQUE INDEX "monitored_searches_search_term_key" ON "monitored_searches"("search_term");
