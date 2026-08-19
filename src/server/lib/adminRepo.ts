/**
 * D1 access for the admin control plane.
 *
 * Rules this module holds to:
 *   - every value is bound; no input is ever interpolated into SQL;
 *   - the one place a column name is chosen dynamically (the Pulse update
 *     SET clause) picks it from a closed literal map, never from request data;
 *   - nothing here reads `answers_json`. Operational admin screens need a
 *     COUNT, and loading response bodies to render a management page would put
 *     survey content somewhere it has no reason to be (brief 30, 44).
 */

import type { D1BoundStatement, D1DatabaseLike } from './d1.js';
import {
  customQuestionKey,
  isCustomQuestionType,
  type PublicCustomQuestion,
} from '../../core/survey/customQuestions.js';
import type { AdminCustomQuestion } from '../../core/admin/contracts.js';
import { generateOptionIds } from '../../core/admin/optionIds.js';
import type { CustomQuestionInput } from '../../core/admin/schemas.js';
import { ENGINE_VERSIONS } from '../../core/versions.js';
import { generatePublicId, PUBLIC_ID_MAX_ATTEMPTS } from './publicId.js';

// --- organization ----------------------------------------------------------

export interface OrganizationRow {
  readonly id: number;
  readonly name: string;
  readonly logo_url: string | null;
  readonly accent_color: string | null;
  readonly survey_intro: string | null;
}

/**
 * V1 is a single-organization deployment. The row is addressed as "the first
 * one" rather than by an id carried in the request, so no admin endpoint can
 * be pointed at a different organization.
 */
export async function findOrganization(db: D1DatabaseLike): Promise<OrganizationRow | null> {
  return db
    .prepare('SELECT id, name, logo_url, accent_color, survey_intro FROM organizations ORDER BY id LIMIT 1')
    .bind()
    .first<OrganizationRow>();
}

export interface OrganizationFields {
  readonly name: string;
  readonly logoUrl: string | null;
  readonly accentColor: string | null;
  readonly surveyIntro: string | null;
}

export async function insertOrganization(
  db: D1DatabaseLike,
  fields: OrganizationFields,
): Promise<void> {
  await db
    .prepare('INSERT INTO organizations (name, logo_url, accent_color, survey_intro) VALUES (?, ?, ?, ?)')
    .bind(fields.name, fields.logoUrl, fields.accentColor, fields.surveyIntro)
    .run();
}

export async function updateOrganization(
  db: D1DatabaseLike,
  id: number,
  fields: OrganizationFields,
): Promise<void> {
  await db
    .prepare(
      `UPDATE organizations
       SET name = ?, logo_url = ?, accent_color = ?, survey_intro = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(fields.name, fields.logoUrl, fields.accentColor, fields.surveyIntro, id)
    .run();
}

// --- pulses ----------------------------------------------------------------

export interface AdminPulseRow {
  readonly id: number;
  readonly public_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: string;
  readonly survey_version: string;
  readonly opens_on: string | null;
  readonly closes_on: string | null;
  readonly personal_results_enabled: number;
  readonly response_count: number;
}

const PULSE_COLUMNS = `p.id, p.public_id, p.name, p.description, p.status, p.survey_version,
       p.opens_on, p.closes_on, p.personal_results_enabled,
       (SELECT COUNT(*) FROM responses r WHERE r.pulse_id = p.id) AS response_count`;

export async function listAdminPulses(
  db: D1DatabaseLike,
  organizationId: number,
): Promise<readonly AdminPulseRow[]> {
  const { results } = await db
    .prepare(
      `SELECT ${PULSE_COLUMNS}
       FROM pulses p
       WHERE p.organization_id = ?
       ORDER BY p.created_at DESC, p.id DESC`,
    )
    .bind(organizationId)
    .all<AdminPulseRow>();
  return results;
}

export async function findAdminPulse(
  db: D1DatabaseLike,
  id: number,
): Promise<AdminPulseRow | null> {
  return db
    .prepare(`SELECT ${PULSE_COLUMNS} FROM pulses p WHERE p.id = ?`)
    .bind(id)
    .first<AdminPulseRow>();
}

export async function countResponses(db: D1DatabaseLike, pulseId: number): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM responses WHERE pulse_id = ?')
    .bind(pulseId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// --- custom questions ------------------------------------------------------

interface CustomQuestionRow {
  readonly position: number;
  readonly type: string;
  readonly question_text: string;
  readonly options_json: string | null;
}

const SELECT_CUSTOM_QUESTIONS = `
SELECT position, type, question_text, options_json
FROM custom_questions
WHERE pulse_id = ?
ORDER BY position`;

function parseOptions(raw: string | null): AdminCustomQuestion['options'] {
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Invalid custom question options configuration');
  return parsed as AdminCustomQuestion['options'];
}

export async function listAdminCustomQuestions(
  db: D1DatabaseLike,
  pulseId: number,
): Promise<readonly AdminCustomQuestion[]> {
  const { results } = await db
    .prepare(SELECT_CUSTOM_QUESTIONS)
    .bind(pulseId)
    .all<CustomQuestionRow>();

  return results.map((row) => {
    if (!isCustomQuestionType(row.type)) {
      throw new Error('Invalid custom question type configuration');
    }
    return {
      position: row.position,
      type: row.type,
      questionText: row.question_text,
      options: parseOptions(row.options_json),
    };
  });
}

/** The employee-facing answer key for a stored custom question. */
export function publicKeyOf(question: AdminCustomQuestion): PublicCustomQuestion['key'] {
  return customQuestionKey(question.position);
}

// --- creation --------------------------------------------------------------

export interface NewPulse {
  readonly organizationId: number;
  readonly name: string;
  readonly description: string | null;
  readonly opensOn: string;
  readonly closesOn: string | null;
  readonly personalResultsEnabled: boolean;
  readonly customQuestions: readonly CustomQuestionInput[];
}

const INSERT_PULSE_SQL = `
INSERT INTO pulses (organization_id, public_id, name, description, status,
                    survey_version, scoring_version, recommendation_version,
                    opens_on, closes_on, personal_results_enabled)
VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)`;

/**
 * The custom-question insert resolves its parent through the freshly generated
 * public id rather than a returned row id. That is what lets the Pulse and all
 * of its questions go into ONE `batch()` transaction: without it the parent id
 * would have to be read back between statements, and a failure after the Pulse
 * insert would leave a half-configured Pulse behind.
 */
const INSERT_CUSTOM_QUESTION_SQL = `
INSERT INTO custom_questions (pulse_id, type, question_text, options_json, position)
VALUES ((SELECT id FROM pulses WHERE public_id = ?), ?, ?, ?, ?)`;

function customQuestionStatements(
  db: D1DatabaseLike,
  publicId: string,
  questions: readonly CustomQuestionInput[],
): D1BoundStatement[] {
  return questions.map((question, index) => {
    const optionsJson =
      question.type === 'free_text'
        ? null
        : JSON.stringify(generateOptionIds(question.optionLabels));

    return db
      .prepare(INSERT_CUSTOM_QUESTION_SQL)
      .bind(publicId, question.type, question.questionText, optionsJson, index + 1);
  });
}

function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed/i.test(message);
}

export class PublicIdCollisionError extends Error {
  constructor() {
    super('Could not allocate a unique public id');
    this.name = 'PublicIdCollisionError';
  }
}

/**
 * Creates a Pulse and its custom questions atomically, retrying a bounded
 * number of times if the unique index on `public_id` ever reports a collision.
 * Returns the generated public id.
 */
export async function createPulse(db: D1DatabaseLike, pulse: NewPulse): Promise<string> {
  for (let attempt = 0; attempt < PUBLIC_ID_MAX_ATTEMPTS; attempt += 1) {
    const publicId = generatePublicId();

    const statements: D1BoundStatement[] = [
      db
        .prepare(INSERT_PULSE_SQL)
        .bind(
          pulse.organizationId,
          publicId,
          pulse.name,
          pulse.description,
          ENGINE_VERSIONS.surveyVersion,
          ENGINE_VERSIONS.scoringVersion,
          ENGINE_VERSIONS.recommendationEngineVersion,
          pulse.opensOn,
          pulse.closesOn,
          pulse.personalResultsEnabled ? 1 : 0,
        ),
      ...customQuestionStatements(db, publicId, pulse.customQuestions),
    ];

    try {
      await db.batch(statements);
      return publicId;
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }

  throw new PublicIdCollisionError();
}

// --- updates ---------------------------------------------------------------

/**
 * Closed set of updatable columns. The keys are the only strings that can ever
 * reach the SET clause; request data supplies values only.
 */
const UPDATABLE_COLUMNS = {
  name: 'name',
  description: 'description',
  opensOn: 'opens_on',
  closesOn: 'closes_on',
  personalResultsEnabled: 'personal_results_enabled',
} as const;

export type UpdatablePulseField = keyof typeof UPDATABLE_COLUMNS;

export type PulseFieldUpdates = Partial<Record<UpdatablePulseField, string | number | null>>;

export async function updatePulseFields(
  db: D1DatabaseLike,
  id: number,
  updates: PulseFieldUpdates,
): Promise<void> {
  const assignments: string[] = [];
  const values: (string | number | null)[] = [];

  for (const field of Object.keys(UPDATABLE_COLUMNS) as UpdatablePulseField[]) {
    if (!(field in updates)) continue;
    assignments.push(`${UPDATABLE_COLUMNS[field]} = ?`);
    values.push(updates[field] ?? null);
  }

  if (assignments.length === 0) return;

  await db
    .prepare(`UPDATE pulses SET ${assignments.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();
}

/**
 * Replaces a Pulse's custom questions in one transaction. Only reachable while
 * the Pulse has no responses - the route enforces that before calling.
 */
export async function replaceCustomQuestions(
  db: D1DatabaseLike,
  pulseId: number,
  publicId: string,
  questions: readonly CustomQuestionInput[],
): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM custom_questions WHERE pulse_id = ?').bind(pulseId),
    ...customQuestionStatements(db, publicId, questions),
  ]);
}

export async function closePulse(db: D1DatabaseLike, id: number): Promise<void> {
  await db
    .prepare("UPDATE pulses SET status = 'closed', closed_at = datetime('now') WHERE id = ?")
    .bind(id)
    .run();
}

/**
 * Permanent deletion. `ON DELETE CASCADE` on `custom_questions.pulse_id` and
 * `responses.pulse_id` removes the configuration and the collected responses
 * with it; verified against local D1, not assumed.
 */
export async function deletePulse(db: D1DatabaseLike, id: number): Promise<void> {
  await db.prepare('DELETE FROM pulses WHERE id = ?').bind(id).run();
}
