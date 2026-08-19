/**
 * D1 access for public Pulse operations.
 *
 * Every query is parameterized via bind(). The response INSERT writes exactly
 * the five columns the schema defines - there is no code path that could
 * attach an IP address, user agent, fingerprint, or any other identifier,
 * because no such column exists and no such value is ever read. Spec 8, 31
 * (Phase 1 brief).
 */

import type { D1DatabaseLike } from './d1.js';
import {
  customQuestionKey,
  isCustomQuestionType,
  type CustomQuestionOption,
  type PublicCustomQuestion,
} from '../../core/survey/customQuestions.js';

export interface PulseRow {
  readonly id: number;
  readonly public_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: string;
  readonly survey_version: string;
  readonly opens_on: string | null;
  readonly closes_on: string | null;
  readonly personal_results_enabled: number;
  readonly org_name: string;
  readonly logo_url: string | null;
  readonly accent_color: string | null;
  readonly survey_intro: string | null;
}

const SELECT_PULSE_SQL = `
SELECT p.id, p.public_id, p.name, p.description, p.status, p.survey_version,
       p.opens_on, p.closes_on, p.personal_results_enabled,
       o.name AS org_name, o.logo_url, o.accent_color, o.survey_intro
FROM pulses p
JOIN organizations o ON o.id = p.organization_id
WHERE p.public_id = ?`;

export async function findPulseByPublicId(
  db: D1DatabaseLike,
  publicId: string,
): Promise<PulseRow | null> {
  return db.prepare(SELECT_PULSE_SQL).bind(publicId).first<PulseRow>();
}

interface CustomQuestionRow {
  readonly position: number;
  readonly type: string;
  readonly question_text: string;
  readonly options_json: string | null;
}

const SELECT_CUSTOM_QUESTIONS_SQL = `
SELECT position, type, question_text, options_json
FROM custom_questions
WHERE pulse_id = ?
ORDER BY position`;

function parseOptions(row: CustomQuestionRow): readonly CustomQuestionOption[] | null {
  if (row.options_json === null) return null;
  // Configuration is validated on write; a row that fails to parse here is
  // corrupt configuration and must fail loudly rather than silently rendering
  // a broken question.
  const parsed: unknown = JSON.parse(row.options_json);
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (o): o is CustomQuestionOption =>
        typeof o === 'object' && o !== null &&
        typeof (o as CustomQuestionOption).id === 'string' &&
        typeof (o as CustomQuestionOption).label === 'string',
    )
  ) {
    throw new Error('Invalid custom question options configuration');
  }
  return parsed;
}

/**
 * Loads a Pulse's custom questions in their public shape - keyed by position,
 * never exposing the row id.
 */
export async function listPublicCustomQuestions(
  db: D1DatabaseLike,
  pulseId: number,
): Promise<readonly PublicCustomQuestion[]> {
  const { results } = await db
    .prepare(SELECT_CUSTOM_QUESTIONS_SQL)
    .bind(pulseId)
    .all<CustomQuestionRow>();

  return results.map((row) => {
    if (!isCustomQuestionType(row.type)) {
      throw new Error('Invalid custom question type configuration');
    }
    return {
      key: customQuestionKey(row.position),
      type: row.type,
      questionText: row.question_text,
      options: parseOptions(row),
    };
  });
}

const INSERT_RESPONSE_SQL = `
INSERT INTO responses (pulse_id, submitted_on, survey_version, answers_json, custom_answers_json)
VALUES (?, ?, ?, ?, ?)`;

export interface NewResponse {
  readonly pulseId: number;
  /** YYYY-MM-DD only. The database CHECK constraint enforces this as well. */
  readonly submittedOn: string;
  readonly surveyVersion: string;
  readonly answersJson: string;
  readonly customAnswersJson: string | null;
}

export async function insertResponse(db: D1DatabaseLike, response: NewResponse): Promise<void> {
  await db
    .prepare(INSERT_RESPONSE_SQL)
    .bind(
      response.pulseId,
      response.submittedOn,
      response.surveyVersion,
      response.answersJson,
      response.customAnswersJson,
    )
    .run();
}
