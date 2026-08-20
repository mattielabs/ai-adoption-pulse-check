/**
 * Export shaping.
 *
 * Exports must not become a way around the dashboard's privacy controls, so
 * the shaping rules live in core and are unit-tested independently of any
 * download UI. Spec 35.
 *
 * Three separate representations:
 *   1. Limited response CSV - no Q1-Q3, no Q27, no identifiers, no date,
 *      rows shuffled.
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

/**
 * Stable, readable column names.
 *
 * The question id stays in front so a column can always be traced back to the
 * survey, and the suffix says what it measures so the file is usable without
 * the spec open beside it. These strings are part of the export contract:
 * changing one changes every downstream spreadsheet, so treat them like option
 * ids rather than like display copy. Spec 35.1, 56.
 *
 * The four excluded questions are named here too, deliberately - so a reader
 * of this file can see exactly which ones never become a column.
 */
export const RESPONSE_EXPORT_COLUMN_NAMES: Readonly<Record<QuestionId, string>> = {
  q1: 'q1_department',
  q2: 'q2_role_level',
  q3: 'q3_work_type',
  q4: 'q4_general_ai_frequency',
  q5: 'q5_work_ai_frequency',
  q6: 'q6_tools_used',
  q7: 'q7_work_use_cases',
  q8: 'q8_confidence_instructions',
  q9: 'q9_confidence_context',
  q10: 'q10_confidence_evaluation',
  q11: 'q11_confidence_appropriate_use',
  q12: 'q12_workflow_behaviour',
  q13: 'q13_reuse_frequency',
  q14: 'q14_process_redesign',
  q15: 'q15_workflow_artifacts',
  q16: 'q16_verification_frequency',
  q17: 'q17_human_review_frequency',
  q18: 'q18_data_handling_confidence',
  q19: 'q19_approved_tool_clarity',
  q19b: 'q19b_unmanaged_tool_use',
  q20: 'q20_policy_clarity',
  q21: 'q21_tool_access',
  q22: 'q22_training_guidance',
  q23: 'q23_barriers',
  q24: 'q24_training_demand',
  q25: 'q25_learning_preferences',
  q26: 'q26_pain_areas',
  q27: 'q27_free_text',
  q28: 'q28_interest',
};

/**
 * Separator for multi-select values inside a single CSV cell.
 *
 * A pipe rather than a comma or semicolon: no option id contains one, so
 * splitting on it is unambiguous, and it survives a spreadsheet round trip
 * without being mistaken for a field separator.
 */
export const MULTI_VALUE_SEPARATOR = '|';

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

/**
 * One organization-specific question included in the response export.
 *
 * Callers supply select-type questions only: a custom FREE-TEXT answer is
 * employee-written prose, and prose belongs under Q27's restrictions rather
 * than on a row beside twenty-five other answers.
 */
export interface CustomExportColumn {
  /** The position key custom answers are stored under: c1, c2 or c3. */
  readonly key: string;
  readonly header: string;
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

export interface ResponseExportOptions extends ExportOptions {
  readonly customColumns?: readonly CustomExportColumn[];
}

/**
 * Limited response export.
 *
 * Excludes Q1-Q3, Q27, row ids, and every timestamp - including the day-level
 * `submitted_on` the database does store. V1 is not a timeline analysis tool,
 * so a date column would buy nothing while adding a correlation handle to
 * every row. Rows are shuffled so export order carries no submission-order
 * signal either. Spec 34.3, 35.1.
 */
export function buildResponseExport(
  responses: readonly SurveyResponse[],
  options: ResponseExportOptions = {},
): ResponseExport {
  const random = options.random ?? Math.random;
  const customColumns = options.customColumns ?? [];

  const headers = [
    'survey_version',
    ...RESPONSE_EXPORT_QUESTION_IDS.map((id) => RESPONSE_EXPORT_COLUMN_NAMES[id]),
    ...customColumns.map((column) => column.header),
  ];

  const rows = shuffle(responses, random).map((response) => [
    response.surveyVersion,
    ...RESPONSE_EXPORT_QUESTION_IDS.map((id) =>
      serializeAnswer(response.answers[id as keyof typeof response.answers]),
    ),
    ...customColumns.map((column) => serializeAnswer(response.customAnswers?.[column.key])),
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

export const FREE_TEXT_EXPORT_WARNING =
  'Written responses may contain identifying information voluntarily provided by employees. These responses are intentionally separated from work-context filters.';

/**
 * Free-text export, built from the text alone.
 *
 * This is the shape the server actually has: its free-text query returns
 * strings and nothing else, so nothing on this path ever holds a whole
 * response. The row token is generated per export and never stored, so it
 * cannot be linked back to a response row.
 */
export function buildFreeTextExportFromTexts(
  texts: readonly string[],
  options: ExportOptions = {},
): FreeTextExport {
  const random = options.random ?? Math.random;
  const headers = ['row_token', 'response_text'];

  const rows = shuffle(
    texts.map((text) => text.trim()).filter((text) => text.length > 0),
    random,
  ).map((text, index) => [
    // Sequential over the already-shuffled list: unique within the file,
    // meaningless outside it.
    `t${String(index + 1).padStart(4, '0')}`,
    text,
  ]);

  return {
    filename: 'free-text.csv',
    headers,
    rows,
    csv: toCsv([headers, ...rows]),
    warning: FREE_TEXT_EXPORT_WARNING,
  };
}

/**
 * Free-text export.
 *
 * Q27 text and nothing else. No department, no role, no work type, no other
 * survey answers, no submission date - anything that would let a reader
 * reconnect a comment to a person's context.
 */
export function buildFreeTextExport(
  responses: readonly SurveyResponse[],
  options: ExportOptions = {},
): FreeTextExport {
  return buildFreeTextExportFromTexts(
    responses.map((response) => (typeof response.answers.q27 === 'string' ? response.answers.q27 : '')),
    options,
  );
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

// --- download naming -------------------------------------------------------

/**
 * Reduces an organization-supplied name to something safe inside a
 * `Content-Disposition` header.
 *
 * Pulse names are free text typed by an administrator, so they can contain
 * quotes, semicolons, newlines, slashes and non-Latin characters. Rather than
 * escaping each hazard, this reduces to a strict allowlist - lowercase ASCII
 * letters, digits and single hyphens - which cannot terminate the header
 * parameter, cannot inject a second header, and cannot traverse a path.
 */
export function safeFilenameSlug(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  return slug.length > 0 ? slug : fallback;
}
