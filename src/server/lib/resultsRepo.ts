/**
 * D1 access for organization results.
 *
 * This is the first admin feature that needs response CONTENT, so the
 * separation is enforced here at the data-access layer rather than downstream:
 *
 *   - the analysis read strips Q27 in SQL (`json_remove`). Free text is not
 *     used by scoring, aggregation, classification, the recommendation engine
 *     or the Opportunity Map - verified, and asserted by a test - so it has no
 *     reason to be in the process memory that builds an aggregate at all.
 *
 *   - the free-text read returns Q27 and NOTHING else. No row id, no
 *     submission date, no work context, no other answer. There is no query in
 *     this module that returns free text beside anything it could be joined
 *     to.
 *
 * Both queries are parameterized. Neither is reachable without a session.
 */

import type { D1DatabaseLike } from './d1.js';

export interface AnalysisResponseRow {
  readonly id: number;
  readonly submitted_on: string;
  readonly survey_version: string;
  /** Q27 already removed by the database. */
  readonly answers_json: string;
}

/**
 * `json_remove` drops Q27 before the row leaves SQLite. `submitted_on` is
 * loaded because `SurveyResponse` models it and fabricating a value would be
 * worse than carrying a day-granular one that never leaves the server; nothing
 * in the analysis pipeline reads it.
 */
const SELECT_ANALYSIS_RESPONSES = `
SELECT id,
       submitted_on,
       survey_version,
       json_remove(answers_json, '$.q27') AS answers_json
FROM responses
WHERE pulse_id = ?
ORDER BY id`;

export async function loadAnalysisResponses(
  db: D1DatabaseLike,
  pulseId: number,
): Promise<readonly AnalysisResponseRow[]> {
  const { results } = await db
    .prepare(SELECT_ANALYSIS_RESPONSES)
    .bind(pulseId)
    .all<AnalysisResponseRow>();
  return results;
}

export interface ExportResponseRow {
  readonly submitted_on: string;
  readonly survey_version: string;
  /** Q27 already removed by the database. */
  readonly answers_json: string;
  readonly custom_answers_json: string | null;
}

/**
 * The response-export read.
 *
 * Same `json_remove` as the analysis read - free text never travels with the
 * answers it was submitted beside - and deliberately no `id` column: the
 * export emits no row identifier, so it has no reason to hold one. Custom
 * answers come along because the export is the only place an administrator
 * can see the organization-specific questions they configured.
 *
 * `submitted_on` is selected because the row type models it; the response CSV
 * emits no date column at all.
 */
const SELECT_EXPORT_RESPONSES = `
SELECT submitted_on,
       survey_version,
       json_remove(answers_json, '$.q27') AS answers_json,
       custom_answers_json
FROM responses
WHERE pulse_id = ?
ORDER BY id`;

export async function loadExportResponses(
  db: D1DatabaseLike,
  pulseId: number,
): Promise<readonly ExportResponseRow[]> {
  const { results } = await db
    .prepare(SELECT_EXPORT_RESPONSES)
    .bind(pulseId)
    .all<ExportResponseRow>();
  return results;
}

/**
 * Q27 only.
 *
 * `ORDER BY random()` is deliberate: rows come back in insertion order
 * otherwise, which is submission order, which is a weak timing signal about
 * who wrote what. Randomising costs nothing at V1 scale and removes it.
 */
const SELECT_FREE_TEXT = `
SELECT json_extract(answers_json, '$.q27') AS text
FROM responses
WHERE pulse_id = ?
  AND json_extract(answers_json, '$.q27') IS NOT NULL
  AND trim(json_extract(answers_json, '$.q27')) <> ''
ORDER BY random()`;

export async function loadFreeTextResponses(
  db: D1DatabaseLike,
  pulseId: number,
): Promise<readonly string[]> {
  const { results } = await db
    .prepare(SELECT_FREE_TEXT)
    .bind(pulseId)
    .all<{ readonly text: string | null }>();

  return results
    .map((row) => (typeof row.text === 'string' ? row.text.trim() : ''))
    .filter((text) => text.length > 0);
}
