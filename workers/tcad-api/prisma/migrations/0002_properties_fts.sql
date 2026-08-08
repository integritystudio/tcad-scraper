-- FTS5 keyword index over the free-text property columns.
-- External-content table: rows live in "properties"; the FTS index stores
-- only tokens and reads originals through content_rowid at query time.
-- Used by the keyword-search fallback when no AI provider is reachable
-- (workers/tcad-api/src/lib/keyword-search.ts).

CREATE VIRTUAL TABLE IF NOT EXISTS properties_fts USING fts5(
  name,
  property_address,
  city,
  description,
  content='properties',
  content_rowid='rowid'
);

-- Keep the index in sync with all write paths, including the raw
-- multi-row INSERT ... ON CONFLICT batches (utils/upsert-sql.ts):
-- inserts fire _ai, conflict-updates fire _au, deletes fire _ad.
-- External-content FTS5 requires the explicit 'delete' command form.
CREATE TRIGGER IF NOT EXISTS properties_fts_ai AFTER INSERT ON properties BEGIN
  INSERT INTO properties_fts(rowid, name, property_address, city, description)
  VALUES (new.rowid, new.name, new.property_address, new.city, new.description);
END;

CREATE TRIGGER IF NOT EXISTS properties_fts_ad AFTER DELETE ON properties BEGIN
  INSERT INTO properties_fts(properties_fts, rowid, name, property_address, city, description)
  VALUES ('delete', old.rowid, old.name, old.property_address, old.city, old.description);
END;

CREATE TRIGGER IF NOT EXISTS properties_fts_au AFTER UPDATE ON properties BEGIN
  INSERT INTO properties_fts(properties_fts, rowid, name, property_address, city, description)
  VALUES ('delete', old.rowid, old.name, old.property_address, old.city, old.description);
  INSERT INTO properties_fts(rowid, name, property_address, city, description)
  VALUES (new.rowid, new.name, new.property_address, new.city, new.description);
END;

-- Backfill the index from existing rows.
INSERT INTO properties_fts(properties_fts) VALUES ('rebuild');
