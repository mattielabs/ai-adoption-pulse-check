/**
 * Segment + complement suppression. Spec 33.
 *
 * A segment may be returned only when BOTH the segment and its complement have
 * at least MIN_REPORTING_GROUP members. The complement check is the part people
 * forget: showing "Managers (18 of 20)" also reveals the two non-managers by
 * differencing, even though the displayed group is large.
 *
 * When a request is suppressed, the underlying aggregate is NEVER returned -
 * not the scores, not the counts, not a partial view. The caller receives a
 * typed refusal and nothing else.
 */

import type { SurveyResponse } from '../survey/answers.js';
import {
  MAX_ACTIVE_SEGMENTATION_DIMENSIONS,
  MIN_ORGANIZATION_RESPONSES,
  MIN_REPORTING_GROUP,
  SEGMENTATION_QUESTION_BY_DIMENSION,
  isSegmentationDimension,
  type SegmentationDimension,
  type SuppressionReason,
} from './thresholds.js';

export interface SegmentFilter {
  readonly dimension: SegmentationDimension;
  /** The option id to match, e.g. "it_technology". */
  readonly value: string;
}

export interface SegmentAllowed {
  readonly suppressed: false;
  readonly dimension: SegmentationDimension;
  readonly value: string;
  readonly segmentCount: number;
  readonly complementCount: number;
  readonly responses: readonly SurveyResponse[];
}

export interface SegmentSuppressed {
  readonly suppressed: true;
  readonly reason: SuppressionReason;
}

export type SegmentationResult = SegmentAllowed | SegmentSuppressed;

/** The unsegmented view: all responses, subject only to the minimum sample rule. */
export interface UnsegmentedResult {
  readonly suppressed: false;
  readonly dimension: null;
  readonly value: null;
  readonly segmentCount: number;
  readonly complementCount: 0;
  readonly responses: readonly SurveyResponse[];
}

export type SegmentationOutcome = SegmentationResult | UnsegmentedResult;

function answerFor(response: SurveyResponse, dimension: SegmentationDimension): string | undefined {
  const questionId = SEGMENTATION_QUESTION_BY_DIMENSION[dimension];
  const value = response.answers[questionId];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Applies at most one segmentation filter.
 *
 * Passing more than one filter is rejected outright rather than silently
 * using the first: a caller that asked for stacked filters must be told no.
 */
export function applySegmentation(
  responses: readonly SurveyResponse[],
  filters: readonly SegmentFilter[] = [],
): SegmentationOutcome {
  if (responses.length < MIN_ORGANIZATION_RESPONSES) {
    return { suppressed: true, reason: 'insufficient_total_responses' };
  }

  if (filters.length > MAX_ACTIVE_SEGMENTATION_DIMENSIONS) {
    return { suppressed: true, reason: 'multiple_segmentation_dimensions' };
  }

  if (filters.length === 0) {
    return {
      suppressed: false,
      dimension: null,
      value: null,
      segmentCount: responses.length,
      complementCount: 0,
      responses,
    };
  }

  const filter = filters[0] as SegmentFilter;
  if (!isSegmentationDimension(filter.dimension)) {
    return { suppressed: true, reason: 'unknown_segmentation_dimension' };
  }

  const segment = responses.filter((r) => answerFor(r, filter.dimension) === filter.value);
  const complementCount = responses.length - segment.length;

  if (segment.length < MIN_REPORTING_GROUP || complementCount < MIN_REPORTING_GROUP) {
    // Deliberately returns no counts and no aggregate.
    return { suppressed: true, reason: 'minimum_group_or_complement_size' };
  }

  return {
    suppressed: false,
    dimension: filter.dimension,
    value: filter.value,
    segmentCount: segment.length,
    complementCount,
    responses: segment,
  };
}

export interface SegmentAvailability {
  readonly dimension: SegmentationDimension;
  readonly value: string;
  readonly reportable: boolean;
}

/**
 * Which values of a dimension could be reported at all.
 *
 * This exists so the UI can disable unavailable filter options instead of
 * letting a user request one and receive a refusal. It returns booleans only,
 * never the underlying counts, so it cannot be used to infer group sizes.
 */
export function listReportableSegments(
  responses: readonly SurveyResponse[],
  dimension: SegmentationDimension,
): readonly SegmentAvailability[] {
  const counts = new Map<string, number>();
  for (const response of responses) {
    const value = answerFor(response, dimension);
    if (value === undefined) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => {
      const segmentCount = counts.get(value) ?? 0;
      const complementCount = responses.length - segmentCount;
      return {
        dimension,
        value,
        reportable:
          responses.length >= MIN_ORGANIZATION_RESPONSES &&
          segmentCount >= MIN_REPORTING_GROUP &&
          complementCount >= MIN_REPORTING_GROUP,
      };
    });
}
