-- AlterTable
ALTER TABLE "scrape_jobs" ADD COLUMN "total_api_results" INTEGER;
ALTER TABLE "scrape_jobs" ADD COLUMN "updated_count" INTEGER;
ALTER TABLE "scrape_jobs" ADD COLUMN "new_property_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
