/**
 * Export shaping.
 *
 * Exports must not become a way around the dashboard's privacy controls, so
 * the shaping rules live in core and are unit-tested independently of any
 * download UI. Spec 35.
 *
 * Three separate representations:
 *   1. Limited response CSV - no Q1-Q3, no Q27, no identifiers, rows shuffled.
 *   2. Free-text CSV        - Q27 only, with no contextual columns at all.
 *   3. Aggregate JSON       - only after the same server-side privacy checks.
 */

import type { SurveyResponse } from '../survey/answers.js';
import type { QuestionId } from '../survey/questions.js';
import { SURVEY_QUESTIONS, WORK_CONTEXT_QUESTION_IDS, FREE_TEXT_QUESTION_IDS } from '../survey/questions.js';
import { ENGINE_VERSIONS } from '../versions.js';
import { shuffle, type RandomSource } from '../util/random.js';

/**
 * Question ids excluded from the default row-level response export.
 *
 * Q1-Q3 are excluded because department + role + work type on a single row is
 * a practical re-identification path in a 30-person company. Q27 is excluded
 * because free text belongs in its own unlinked file. Spec 35.1, 35.4.
 */
export const EXCLUDED_EXPORT_QUESTION_IDS: readonly QuestionId[] = [
  ...WORK_CONTEXT_QUESTION_IDS,
  ...FREE_TEXT_QUESTION_IDS,
];

export const RESPONSE_EXPORT_QUESTION_IDS: readonly QuestionId[] = SURVEY_QUESTIONS.map((q) => q.id).filter(
  (id) => !EXCLUDED_EXPORT_QUESTION_IDS.includes(id),
);

/** Separator for multi-select values inside a single CSV cell. */
const MULTI_VALUE_SEPARATOR = '|';

/**
 * Characters that make a spreadsheet treat a cell as a formula. Spec 59.
 *
 * Strategy: prefix the value with a single quote and always wrap the cell in
 * double quotes. The leading apostrophe is the documented convention Excel,
 * LibreOffice and Sheets all honour as "treat the rest as literal text", and it
 * is visible to anyone inspecting the file rather than silently mangling data.
 */
const FORMULA_TRIGGER_CHARACTERS = ['=', '+', '-', '@', '\t', '\r'];

export function escapeCsvValue(value: string): string {
  const needsFormulaGuard =
    value.length > 0 && FORMULA_TRIGGER_CHARACTERS.includes(value[0] as string);
  const guarded = needsFormulaGuard ? `'${value}` : value;
  // Standard RFC 4180 quoting: double the quotes, wrap the field.
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n');
}

function serializeAnswer(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(MULTI_VALUE_SEPARATOR);
  return String(value);
}

export interface ResponseExport {
  readonly filename: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly csv: string;
  /** Shown in the UI so this is never described as "fully anonymous data". Spec 35.1. */
  readonly disclosureLabel: string;
}

export interface ExportOptions {
  /** Injected so tests are reproducible. Production passes a crypto-backed source. */
  readonly random?: RandomSource;
}

/**
 * Limited response export.
 *
 * Excludes Q1-Q3, Q27, row ids, and any exact timestamp. `submitted_on` is
 * retained at day granularity only, which is the only precision the database
 * stores. Rows are shuffled so export order carries no submission-order signal.
 */
export function buildResponseExport(
  responses: readonly SurveyResponse[],
  options: ExportOptions = {},
): ResponseExport {
  const random = options.random ?? Math.random;
  const headers = ['submitted_on', 'survey_version', ...RESPONSE_EXPORT_QUESTION_IDS];

  const rows = shuffle(responses, random).map((response) => [
    response.submittedOn,
    response.surveyVersion,
    ...RESPONSE_EXPORT_QUESTION_IDS.map((id) =>
      serializeAnswer(response.answers[id as keyof typeof response.answers]),
    ),
  ]);

  return {
    filename: 'responses.csv',
    headers,
    rows,
    csv: toCsv([headers, ...rows]),
    disclosureLabel:
      'Limited response export. Work-context and free-text answers are excluded. This is not fully anonymous data.',
  };
}

export interface FreeTextExport {
  readonly filename: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly csv: string;
  readonly warning: string;
}

/**
 * Free-text export.
 *
 * Q27 text and nothing else. No department, no role, no work type, no other
 * survey answers, no submission date - anything that would let a reader
 * reconnect a comment to a person's context. The row token is generated per
 * export and is not stored, so it cannot be linked back to a response row.
 */
export function buildFreeTextExport(
  responses: readonly SurveyResponse[],
  options: ExportOptions = {},
): FreeTextExport {
  const random = options.random ?? Math.random;
  const headers = ['row_token', 'response_text'];

  const withText = responses.filter((r) => {
    const text = r.answers.q27;
    return typeof text === 'string' && text.trim().length > 0;
  });

  const rows = shuffle(withText, random).map((response, index) => [
    // Sequential over the already-shuffled list: unique within the file,
    // meaningless outside it.
    `t${String(index + 1).padStart(4, '0')}`,
    (response.answers.q27 as string).trim(),
  ]);

  return {
    filename: 'free-text.csv',
    headers,
    rows,
    csv: toCsv([headers, ...rows]),
    warning:
      'Written responses may contain identifying information voluntarily provided by employees. These responses are intentionally separated from work-context filters.',
  };
}

export interface AggregateExportEnvelope<T> {
  readonly filename: string;
  readonly generated: {
    readonly surveyVersion: string;
    readonly scoringVersion: string;
    readonly recommendationEngineVersion: string;
  };
  readonly segment: { readonly dimension: string; readonly value: string } | null;
  readonly data: T;
}

/**
 * Wraps an aggregate for export. The caller must already have passed the
 * segmentation privacy check - this function deliberately does not take raw
 * responses, so there is no path here that could bypass suppression.
 */
export function buildAggregateExport<T>(
  data: T,
  segment: { readonly dimension: string; readonly value: string } | null = null,
): AggregateExportEnvelope<T> {
  return {
    filename: 'results.json',
    generated: { ...ENGINE_VERSIONS },
    segment,
    data,
  };
}
