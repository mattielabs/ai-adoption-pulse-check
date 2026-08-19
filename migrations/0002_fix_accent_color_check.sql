-- Fix: the accent-colour CHECK from 0001 used a GLOB pattern
-- ('#[0-9a-fA-F]' x 6 = 67 pattern bytes) that exceeds the LIKE/GLOB pattern
-- length limit in workerd's SQLite (~50 bytes). Any INSERT with a non-null
-- accent_color failed with "LIKE or GLOB pattern too complex". Phase 0 never
-- inserted organization rows, so the constraint was untested at runtime.
--
-- The replacement CHECK keeps the cheap structural guarantee (7 chars,
-- leading '#'); strict hex validation is the application layer's job (Zod on
-- the Phase 2 organization-settings write path), consistent with the schema's
-- documented stance that answer-level validation lives in Zod too.
--
-- SQLite cannot drop a CHECK constraint, so the table is rebuilt. Foreign key
-- checks are deferred to the end of the migration transaction; pulses rows
-- keep their organization_id values and the reference resolves against the
-- renamed table.

PRAGMA defer_foreign_keys = on;

CREATE TABLE organizations_new (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  logo_url       TEXT,
  accent_color   TEXT,
  survey_intro   TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),

  CONSTRAINT organizations_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT organizations_accent_color_shape
    CHECK (accent_color IS NULL OR (length(accent_color) = 7 AND substr(accent_color, 1, 1) = '#'))
);

INSERT INTO organizations_new (id, name, logo_url, accent_color, survey_intro, created_at, updated_at)
SELECT id, name, logo_url, accent_color, survey_intro, created_at, updated_at FROM organizations;

DROP TABLE organizations;

ALTER TABLE organizations_new RENAME TO organizations;
