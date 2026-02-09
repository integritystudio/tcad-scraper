-- AlterTable: Add year column to properties
ALTER TABLE "properties" ADD COLUMN "year" INTEGER NOT NULL DEFAULT 2025;

-- DropIndex: Remove old single-column unique constraint on property_id
DROP INDEX IF EXISTS "properties_property_id_key";

-- CreateIndex: Add composite unique constraint on (property_id, year)
CREATE UNIQUE INDEX "properties_property_id_year_key" ON "properties"("property_id", "year");

-- CreateIndex: Add index on year column
CREATE INDEX "properties_year_idx" ON "properties"("year");
