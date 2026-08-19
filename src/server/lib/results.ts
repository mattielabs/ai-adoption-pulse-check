/**
 * The results service: D1 rows in, privacy-safe DTO out.
 *
 * Order of operations matters and is deliberate:
 *
 *   1. the minimum-sample gate runs BEFORE any analysis. Below five responses
 *      nothing is computed at all, so there is no aggregate in memory that a
 *      later refactor could accidentally serialize. The browser never receives
 *      hidden results to obscure. Spec 32.
 *
 *   2. survey versions are checked before parsing. Mixing responses collected
 *      under different survey versions would silently average answers whose
 *      meanings differ; that fails loudly instead. Spec 57.
 *
 *   3. stored JSON is re-validated on the way in. A corrupt row fails the whole
 *      request rather than being dropped, because silently dropping one would
 *      change every denominator on the page without saying so. "Corrupt" here
 *      means wrong shape, wrong type or an option id that does not exist - NOT
 *      merely incomplete, which is a state the scoring engine is built to
 *      handle (see `validateStoredAnswers`).
 *
 *   4. segmentation and suppression are `runAnalysis`'s job, which applies
 *      them before computing anything.
 */

import type { D1DatabaseLike } from './d1.js';
import { loadAnalysisResponses, loadFreeTextResponses } from './resultsRepo.js';
import { countResponses, type AdminPulseRow } from './adminRepo.js';
import { todayUtcDate } from './dates.js';
import { computeOperationalState } from '../../core/pulse/status.js';
import { runAnalysis } from '../../core/analysis/runAnalysis.js';
import type { SegmentFilter } from '../../core/privacy/segmentation.js';
import { listReportableSegments } from '../../core/privacy/segmentation.js';
import { SEGMENTATION_DIMENSIONS, MAX_ACTIVE_SEGMENTATION_DIMENSIONS } from '../../core/privacy/thresholds.js';
import type { SurveyAnswers, SurveyResponse } from '../../core/survey/answers.js';
import { validateStoredAnswers } from '../../core/survey/validation.js';
import { isSupportedSurveyVersion } from '../../core/versions.js';
import { buildAnalysisPayload, buildSampleState } from '../../core/results/buildResults.js';
import { MINIMUM_REPORTABLE_RESPONSES } from '../../core/results/contracts.js';
import type {
  FreeTextResponse,
  ResultsPulseSummary,
  ResultsResponse,
  SegmentationState,
} from '../../core/results/contracts.js';

export type ResultsFailureReason =
  /** Responses were collected under a survey version this build cannot score. */
  | 'unsupported_survey_version'
  /** Stored answers did not parse or did not validate. */
  | 'corrupt_response';

export type ResultsOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: ResultsFailureReason };

function pulseSummary(row: AdminPulseRow, totalResponses: number): ResultsPulseSummary {
  return {
    id: row.id,
    name: row.name,
    state: computeOperationalState(
      { status: row.status, opensOn: row.opens_on, closesOn: row.closes_on },
      todayUtcDate(),
    ),
    opensOn: row.opens_on,
    closesOn: row.closes_on,
    responseCount: totalResponses,
    surveyVersion: row.survey_version,
  };
}

/**
 * Parses and validates stored responses.
 *
 * Every response for a Pulse is guaranteed same-version by the submission
 * endpoint, which refuses a payload whose `surveyVersion` does not match the
 * Pulse's. This re-checks the invariant rather than trusting it, because the
 * cost of being wrong is a silently mixed dataset.
 */
function parseResponses(
  rows: readonly { id: number; submitted_on: string; survey_version: string; answers_json: string }[],
  pulseSurveyVersion: string,
): ResultsOutcome<readonly SurveyResponse[]> {
  if (!isSupportedSurveyVersion(pulseSurveyVersion)) {
    return { ok: false, reason: 'unsupported_survey_version' };
  }

  const responses: SurveyResponse[] = [];

  for (const row of rows) {
    if (row.survey_version !== pulseSurveyVersion || !isSupportedSurveyVersion(row.survey_version)) {
      return { ok: false, reason: 'unsupported_survey_version' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(row.answers_json);
    } catch {
      return { ok: false, reason: 'corrupt_response' };
    }

    const validated = validateStoredAnswers(parsed);
    if (!validated.ok) {
      return { ok: false, reason: 'corrupt_response' };
    }

    responses.push({
      id: String(row.id),
      submittedOn: row.submitted_on,
      surveyVersion: row.survey_version,
      answers: validated.value as SurveyAnswers,
    });
  }

  return { ok: true, value: responses };
}

/**
 * Which segments could be reported, as booleans only.
 *
 * Computed from the FULL response set, not the current segment, so the control
 * offers the same options whichever segment is selected. It never carries a
 * group size: explaining a suppression with "only 3 respondents" would undo
 * the suppression. Spec 33.
 */
function segmentationState(
  responses: readonly SurveyResponse[],
  active: SegmentFilter | null,
): SegmentationState {
  return {
    available: SEGMENTATION_DIMENSIONS.map((dimension) => ({
      dimension,
      options: listReportableSegments(responses, dimension).map((segment) => ({
        value: segment.value,
        reportable: segment.reportable,
      })),
    })),
    active: active === null ? null : { dimension: active.dimension, value: active.value },
    maxActiveDimensions: MAX_ACTIVE_SEGMENTATION_DIMENSIONS,
  };
}

export async function buildResults(
  db: D1DatabaseLike,
  pulse: AdminPulseRow,
  filters: readonly SegmentFilter[],
): Promise<ResultsOutcome<ResultsResponse>> {
  const rows = await loadAnalysisResponses(db, pulse.id);
  const summary = pulseSummary(pulse, rows.length);

  // The gate runs first: below the threshold nothing is computed at all.
  if (rows.length < MINIMUM_REPORTABLE_RESPONSES) {
    return {
      ok: true,
      value: {
        status: 'insufficient_sample',
        pulse: summary,
        sample: buildSampleState(rows.length, null),
      },
    };
  }

  const parsed = parseResponses(rows, pulse.survey_version);
  if (!parsed.ok) return parsed;

  const responses = parsed.value;
  const analysis = runAnalysis(responses, { filters });
  const segmentation = segmentationState(responses, filters[0] ?? null);

  if (analysis.suppressed) {
    // No aggregate, not even a partial one.
    return {
      ok: true,
      value: { status: 'suppressed', pulse: summary, reason: analysis.reason, segmentation },
    };
  }

  return {
    ok: true,
    value: {
      status: 'ok',
      pulse: summary,
      versions: analysis.versions,
      segmentation,
      ...buildAnalysisPayload(analysis),
    },
  };
}

/**
 * Free text, subject to the same minimum-sample gate as everything else.
 *
 * Deliberately takes no filter argument. Q27 is never segmentable: pairing a
 * written answer with a department is precisely the re-identification path the
 * privacy model exists to close. Spec 34.4, 47.
 */
export async function buildFreeText(
  db: D1DatabaseLike,
  pulse: AdminPulseRow,
): Promise<FreeTextResponse> {
  // A COUNT, not the responses: the gate must not become a reason to load
  // every answer set just to decide whether free text may be shown.
  const total = await countResponses(db, pulse.id);

  if (total < MINIMUM_REPORTABLE_RESPONSES) {
    return { status: 'insufficient_sample', sample: buildSampleState(total, null) };
  }

  return {
    status: 'ok',
    sample: buildSampleState(total, null),
    responses: await loadFreeTextResponses(db, pulse.id),
  };
}
