-- 0004: Extend properties_fts with secondary owner-identity columns.
--
-- owner_name  (154,302 rows, 32% populated) — raw owner name from TCAD,
--             differs from `name` on 1,561 rows
-- name_secondary (36,401 rows, 7.5%)        — co-owner name
-- dba            (19,792 rows, 4%)           — doing business as
--
-- These columns were unindexed in 0002, making ~56k properties unsearchable
-- via the keyword fallback when using a DBA or co-owner name (T14, 2026-08-08).
-- first_name / last_name are not worth indexing (420 / 412 rows, ~0.09%).
--
-- The virtual table is recreated (DROP + CREATE) because FTS5 does not support
-- ALTER to add columns.  All three sync triggers are also replaced so that
-- future inserts / deletes / updates keep the new columns in sync.
-- The final `rebuild` repopulates the index from the live `properties` table.
--
-- Weights in keyword-search.ts must match the new column order:
--   name(10.0), property_address(8.0), city(4.0), description(1.0),
--   owner_name(9.0), name_secondary(9.0), dba(9.0)

DROP TABLE IF EXISTS properties_fts;
DROP TRIGGER IF EXISTS properties_fts_ai;
DROP TRIGGER IF EXISTS properties_fts_ad;
DROP TRIGGER IF EXISTS properties_fts_au;

CREATE VIRTUAL TABLE IF NOT EXISTS properties_fts USING fts5(
  name,
  property_address,
  city,
  description,
  owner_name,
  name_secondary,
  dba,
  content='properties',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS properties_fts_ai AFTER INSERT ON properties BEGIN
  INSERT INTO properties_fts(
    rowid, name, property_address, city, description,
    owner_name, name_secondary, dba
  )
  VALUES (
    new.rowid, new.name, new.property_address, new.city, new.description,
    new.owner_name, new.name_secondary, new.dba
  );
END;

CREATE TRIGGER IF NOT EXISTS properties_fts_ad AFTER DELETE ON properties BEGIN
  INSERT INTO properties_fts(
    properties_fts, rowid, name, property_address, city, description,
    owner_name, name_secondary, dba
  )
  VALUES (
    'delete', old.rowid, old.name, old.property_address, old.city, old.description,
    old.owner_name, old.name_secondary, old.dba
  );
END;

CREATE TRIGGER IF NOT EXISTS properties_fts_au AFTER UPDATE ON properties BEGIN
  INSERT INTO properties_fts(
    properties_fts, rowid, name, property_address, city, description,
    owner_name, name_secondary, dba
  )
  VALUES (
    'delete', old.rowid, old.name, old.property_address, old.city, old.description,
    old.owner_name, old.name_secondary, old.dba
  );
  INSERT INTO properties_fts(
    rowid, name, property_address, city, description,
    owner_name, name_secondary, dba
  )
  VALUES (
    new.rowid, new.name, new.property_address, new.city, new.description,
    new.owner_name, new.name_secondary, new.dba
  );
END;

-- Repopulate the index from all existing properties rows.
-- owner_name / name_secondary / dba are null for rows not re-scraped since
-- 2026-08-08; coverage grows as rows are re-scraped.
INSERT INTO properties_fts(properties_fts) VALUES ('rebuild');
