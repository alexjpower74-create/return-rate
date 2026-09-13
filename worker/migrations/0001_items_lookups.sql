-- Items the depot knows. class is derived from drink+material+size by rules.js and stored for stats only.
CREATE TABLE IF NOT EXISTS items (
  upc TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  size_ml INTEGER,
  drink TEXT NOT NULL,
  material TEXT NOT NULL,
  refillable INTEGER NOT NULL DEFAULT 0,
  class TEXT NOT NULL,
  source TEXT NOT NULL,
  added TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  edited_by TEXT
);

-- Every lookup, found or not. ip_hash is a salted SHA-256; nothing personal.
CREATE TABLE IF NOT EXISTS lookups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upc TEXT NOT NULL,
  found INTEGER NOT NULL,
  created TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ip_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS lookups_ip_created ON lookups (ip_hash, created);
CREATE INDEX IF NOT EXISTS lookups_created ON lookups (created);
