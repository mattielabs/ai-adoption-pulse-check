-- AI Adoption Pulse Check - initial schema
-- Source of truth: V1.1 spec section 55.
--
-- Deliberately NOT created (spec 55, 71):
--   * pulse_aggregates      - analysis is computed on read at V1 scale. An
--                             aggregate cache would add an invalidation problem
--                             and a second copy of respondent data for no
--                             measured benefit.
--   * organization_settings - known settings belong in `organizations` as real
--                             columns. A generic key/value settings table hides
--                             the schema and invites unvalidated writes.
--   * users / employees / accounts - the product collects no direct identifiers
--                             and has no per-person login. There is one
--                             deployment-level admin passcode instead.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
CREATE TABLE organizations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  logo_url       TEXT,
  accent_color   TEXT,
  survey_intro   TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),

  CONSTRAINT organizations_name_not_blank CHECK (length(trim(name)) > 0),
  -- Accent colour is rendered into the page, so constrain it at the storage
  -- layer as well as in Zod. Output escaping still applies.
  CONSTRAINT organizations_accent_color_format
    CHECK (accent_color IS NULL OR accent_color GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]')
);

-- ---------------------------------------------------------------------------
-- pulses
-- ---------------------------------------------------------------------------
CREATE TABLE pulses (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id          INTEGER NOT NULL,

  -- Public survey-link identifier. Must carry >= 128 bits of cryptographically
  -- secure randomness in a URL-safe encoding (spec 41). It is separate from the
  -- internal id so that guessing a sequential id reveals nothing.
  public_id                TEXT    NOT NULL,

  name                     TEXT    NOT NULL,
  description              TEXT,
  status                   TEXT    NOT NULL DEFAULT 'draft',

  -- Versions are recorded per Pulse so historical results stay reproducible
  -- under the engine they were produced with (spec 57).
  survey_version           TEXT    NOT NULL,
  scoring_version          TEXT    NOT NULL,
  recommendation_version   TEXT    NOT NULL,

  opens_on                 TEXT,
  closes_on                TEXT,
  personal_results_enabled INTEGER NOT NULL DEFAULT 1,

  created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
  closed_at                TEXT,

  CONSTRAINT pulses_organization_fk
    FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT pulses_status_enum
    CHECK (status IN ('draft', 'open', 'closed')),
  CONSTRAINT pulses_personal_results_bool
    CHECK (personal_results_enabled IN (0, 1)),
  CONSTRAINT pulses_dates_day_granularity
    CHECK (
      (opens_on  IS NULL OR opens_on  GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]') AND
      (closes_on IS NULL OR closes_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
    ),
  CONSTRAINT pulses_close_after_open
    CHECK (opens_on IS NULL OR closes_on IS NULL OR closes_on >= opens_on)
);

-- Unique so a public id can never address two Pulses. Also the lookup index for
-- the public survey route.
CREATE UNIQUE INDEX pulses_public_id_uidx ON pulses (public_id);
CREATE INDEX pulses_organization_status_idx ON pulses (organization_id, status);

-- ---------------------------------------------------------------------------
-- custom_questions
--
-- Up to three organization-specific questions per Pulse. They never affect
-- scoring. The maximum is enforced in application validation rather than by a
-- constraint, because SQLite cannot express "at most N rows per parent" without
-- a trigger, and the write path is single-purpose and validated (spec 40, 55).
-- ---------------------------------------------------------------------------
CREATE TABLE custom_questions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pulse_id      INTEGER NOT NULL,
  type          TEXT    NOT NULL,
  question_text TEXT    NOT NULL,
  -- JSON array of {id,label} for select types; NULL for free text.
  options_json  TEXT,
  position      INTEGER NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),

  CONSTRAINT custom_questions_pulse_fk
    FOREIGN KEY (pulse_id) REFERENCES pulses (id) ON DELETE CASCADE,
  CONSTRAINT custom_questions_type_enum
    CHECK (type IN ('single_select', 'multi_select', 'free_text')),
  CONSTRAINT custom_questions_position_range
    CHECK (position BETWEEN 1 AND 3),
  CONSTRAINT custom_questions_options_present
    CHECK ((type = 'free_text' AND options_json IS NULL) OR (type <> 'free_text' AND options_json IS NOT NULL)),
  CONSTRAINT custom_questions_text_not_blank
    CHECK (length(trim(question_text)) > 0)
);

CREATE UNIQUE INDEX custom_questions_pulse_position_uidx ON custom_questions (pulse_id, position);

-- ---------------------------------------------------------------------------
-- responses
--
-- Why answers are stored as versioned JSON rather than one column per question:
--
--   1. The survey is a versioned document. A column-per-question schema would
--      require a migration for every survey revision and would make historical
--      responses ambiguous once a question changed meaning. Storing the answer
--      set alongside `survey_version` keeps each response self-describing and
--      reproducible under the engine that collected it (spec 56, 57).
--   2. Analysis is computed on read in application code, not in SQL. Nothing in
--      V1 needs to filter or aggregate inside the database, so normalizing into
--      an answers table would add joins and write amplification for no benefit.
--   3. It keeps the row narrow and unindexed on content, which limits the ways
--      an accidental query could correlate individual answers.
--
-- The trade-off is accepted deliberately: answer-level validation is Zod's job
-- at the API boundary, not the database's.
--
-- There is NO respondent identifier, NO exact timestamp, NO IP address and NO
-- device information. `submitted_on` is day granularity only, which reduces
-- timing-correlation risk (spec 34.3).
-- ---------------------------------------------------------------------------
CREATE TABLE responses (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  pulse_id             INTEGER NOT NULL,
  submitted_on         TEXT    NOT NULL,
  survey_version       TEXT    NOT NULL,
  answers_json         TEXT    NOT NULL,
  custom_answers_json  TEXT,

  CONSTRAINT responses_pulse_fk
    FOREIGN KEY (pulse_id) REFERENCES pulses (id) ON DELETE CASCADE,
  CONSTRAINT responses_submitted_on_day_granularity
    CHECK (submitted_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CONSTRAINT responses_answers_json_object
    CHECK (json_valid(answers_json) AND json_type(answers_json) = 'object'),
  CONSTRAINT responses_custom_answers_json_object
    CHECK (custom_answers_json IS NULL OR (json_valid(custom_answers_json) AND json_type(custom_answers_json) = 'object'))
);

-- The only access pattern in V1: load every response for one Pulse and analyze
-- in application code.
CREATE INDEX responses_pulse_idx ON responses (pulse_id);
