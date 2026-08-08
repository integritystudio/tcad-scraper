-- 0005: Record the tax year on each scrape job.
--
-- `scrape_jobs` had no year column, so a job row could not say which roll year
-- it scraped. That was harmless while every job targeted one year, but the
-- 2026 backfill runs alongside the finished 2025 roll, and the in-flight guard
-- in scripts/lib/searched-terms.ts treats "a recent job exists for this term"
-- as "already searched for the year I am filling". Year-blind, that guard
-- excludes 2025's highest-yield vocabulary from the 2026 run — precisely the
-- terms it most needs.
--
-- Nullable + backfilled rather than NOT NULL DEFAULT: a hardcoded default year
-- in the schema silently mislabels every job once the roll year rolls over.
-- The workflow now always writes the column explicitly.
--
-- All 13,539 pre-existing jobs were 2025 scrapes — `properties` contains no
-- other year (verified 2026-08-08) — so a blanket backfill is exact, not an
-- approximation.

ALTER TABLE scrape_jobs ADD COLUMN year INTEGER;

UPDATE scrape_jobs SET year = 2025 WHERE year IS NULL;

CREATE INDEX IF NOT EXISTS scrape_jobs_year_started_at_idx
  ON scrape_jobs (year, started_at);
