/**
 * The export service: D1 rows in, a safe file out.
 *
 * Every export runs the same gate the dashboard runs, in the same order:
 *
 *   1. the minimum-sample check comes FIRST, before any row content is
 *      loaded or shaped. A download must not become the one place where four
 *      responses are readable, which would trivialize the privacy model the
 *      rest of the product is built around. Phase 4 brief 20.
 *
 *   2. shaping is `src/core/privacy/exports.ts` - the same tested functions,
 *      not a second implementation that could drift away from the rules.
 *
 *   3. nothing here reads Q27 and work context together. The response export
 *      uses the analysis query, which removes free text in SQL; the free-text
 *      export uses the free-text query, which returns nothing else.
 */

import type { D1DatabaseLike } from './d1.js';
import { countResponses, listAdminCustomQuestions, publicKeyOf, type AdminPulseRow } from './adminRepo.js';
import { loadExportResponses, loadFreeTextResponses } from './resultsRepo.js';
import { buildResults, type ResultsOutcome } from './results.js';
import {
  buildAggregateExport,
  buildFreeTextExportFromTexts,
  buildResponseExport,
  safeFilenameSlug,
  type AggregateExportEnvelope,
  type CustomExportColumn,
} from '../../core/privacy/exports.js';
import { MINIMUM_REPORTABLE_RESPONSES } from '../../core/results/contracts.js';
import type { ResultsOk, ResultsResponse } from '../../core/results/contracts.js';
import type { SurveyAnswers, SurveyResponse } from '../../core/survey/answers.js';
import { validateStoredAnswers } from '../../core/survey/validation.js';
import { isSupportedSurveyVersion } from '../../core/versions.js';

/**
 * Cryptographically secure shuffle source.
 *
 * Row order is a privacy control here rather than a cosmetic one, so it does
 * not come from `Math.random`. `crypto.getRandomValues` is available in
 * Workers and in Node 24 alike.
 */
function secureRandom(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] as number) / 2 ** 32;
}

export type ExportFailureReason =
  | 'insufficient_sample'
  | 'unsupported_survey_version'
  | 'corrupt_response';

export type ExportOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: ExportFailureReason; readonly responseCount?: number };

/**
 * Custom questions that may become export columns.
 *
 * Select types only. A custom free-text question collects prose an employee
 * wrote, and prose beside twenty-five answers on one row is exactly the
 * linkage Q27's separate file exists to prevent.
 */
async function customColumns(
  db: D1DatabaseLike,
  pulseId: number,
): Promise<readonly CustomExportColumn[]> {
  const questions = await listAdminCustomQuestions(db, pulseId);
  return questions
    .filter((question) => question.type !== 'free_text')
    .map((question) => {
      const key = publicKeyOf(question);
      return { key, header: `${key}_${safeFilenameSlug(question.questionText, 'custom')}` };
    });
}

function parseExportRows(
  rows: readonly {
    submitted_on: string;
    survey_version: string;
    answers_json: string;
    custom_answers_json: string | null;
  }[],
  pulseSurveyVersion: string,
): ExportOutcome<readonly SurveyResponse[]> {
  if (!isSupportedSurveyVersion(pulseSurveyVersion)) {
    return { ok: false, reason: 'unsupported_survey_version' };
  }

  const responses: SurveyResponse[] = [];

  for (const row of rows) {
    if (row.survey_version !== pulseSurveyVersion) {
      return { ok: false, reason: 'unsupported_survey_version' };
    }

    let answers: unknown;
    let custom: unknown = undefined;
    try {
      answers = JSON.parse(row.answers_json);
      if (row.custom_answers_json !== null) custom = JSON.parse(row.custom_answers_json);
    } catch {
      return { ok: false, reason: 'corrupt_response' };
    }

    const validated = validateStoredAnswers(answers);
    if (!validated.ok) return { ok: false, reason: 'corrupt_response' };

    responses.push({
      // The export never emits an id, so there is nothing to derive one from.
      id: '',
      submittedOn: row.submitted_on,
      surveyVersion: row.survey_version,
      answers: validated.value as SurveyAnswers,
      ...(custom === undefined
        ? {}
        : { customAnswers: custom as Readonly<Record<string, string | readonly string[]>> }),
    });
  }

  return { ok: true, value: responses };
}

export interface CsvExport {
  readonly filename: string;
  readonly csv: string;
}

/**
 * Privacy-limited response CSV.
 *
 * Reads through `loadExportResponses`, which strips Q27 in SQL exactly as the
 * analysis query does, so free text is not in memory on this path at all.
 */
export async function exportResponsesCsv(
  db: D1DatabaseLike,
  pulse: AdminPulseRow,
): Promise<ExportOutcome<CsvExport>> {
  const rows = await loadExportResponses(db, pulse.id);

  if (rows.length < MINIMUM_REPORTABLE_RESPONSES) {
    return { ok: false, reason: 'insufficient_sample', responseCount: rows.length };
  }

  const parsed = parseExportRows(rows, pulse.survey_version);
  if (!parsed.ok) return parsed;

  const exported = buildResponseExport(parsed.value, {
    random: secureRandom,
    customColumns: await customColumns(db, pulse.id),
  });

  return {
    ok: true,
    value: { filename: exportFileName(pulse, 'responses', 'csv'), csv: exported.csv },
  };
}

/**
 * Free-text CSV.
 *
 * The gate is a COUNT rather than a read: deciding whether free text may be
 * exported must not itself be a reason to load it.
 */
export async function exportFreeTextCsv(
  db: D1DatabaseLike,
  pulse: AdminPulseRow,
): Promise<ExportOutcome<CsvExport>> {
  const total = await countResponses(db, pulse.id);

  if (total < MINIMUM_REPORTABLE_RESPONSES) {
    return { ok: false, reason: 'insufficient_sample', responseCount: total };
  }

  const texts = await loadFreeTextResponses(db, pulse.id);
  const exported = buildFreeTextExportFromTexts(texts, { random: secureRandom });

  return {
    ok: true,
    value: { filename: exportFileName(pulse, 'written-responses', 'csv'), csv: exported.csv },
  };
}

export interface JsonExport {
  readonly filename: string;
  readonly body: AggregateExportEnvelope<ResultsOk>;
}

/**
 * Aggregate results JSON.
 *
 * Deliberately built from the same `buildResults` payload the dashboard
 * renders, unsegmented. Two consequences worth stating: the file cannot
 * contain anything the dashboard would not show, and a reader can check the
 * download against the screen field by field. Phase 4 brief 19.
 */
export async function exportResultsJson(
  db: D1DatabaseLike,
  pulse: AdminPulseRow,
): Promise<ExportOutcome<JsonExport>> {
  const outcome: ResultsOutcome<ResultsResponse> = await buildResults(db, pulse, []);

  if (!outcome.ok) return { ok: false, reason: outcome.reason };

  if (outcome.value.status !== 'ok') {
    return {
      ok: false,
      reason: 'insufficient_sample',
      responseCount: outcome.value.pulse.responseCount,
    };
  }

  return {
    ok: true,
    value: {
      filename: exportFileName(pulse, 'results', 'json'),
      // Unsegmented: `segment` is null, and no suppressed group is described.
      body: buildAggregateExport(outcome.value, null),
    },
  };
}

function exportFileName(pulse: AdminPulseRow, suffix: string, extension: string): string {
  return `${safeFilenameSlug(pulse.name, `pulse-${pulse.id}`)}-${suffix}.${extension}`;
}
